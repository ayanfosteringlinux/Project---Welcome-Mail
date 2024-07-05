const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { Sequelize, DataTypes } = require('sequelize');
const Minio = require('minio');
const path = require('path');

// Initialize Express app
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Function to retry database connection
async function connectWithRetry(sequelize) {
    let retries = 5;
    while (retries) {
        try {
            await sequelize.authenticate();
            console.log('Connection has been established successfully.');
            return;
        } catch (err) {
            console.log(`Unable to connect to the database, retries left: ${retries}`);
            retries -= 1;
            console.log(err);
            await new Promise(res => setTimeout(res, 5000));
        }
    }
    throw new Error('Unable to establish a database connection after several retries');
}

// Initialize Sequelize
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST,
    dialect: 'postgres',
    port: process.env.DB_PORT,
});

// Define Employee model
const employees = sequelize.define('employees', {
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false
    },
    joining_date: {
        type: DataTypes.DATE,
        allowNull: false
    },
    image_url: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    timestamps: false
});

// Initialize Minio client
const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_END_POINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT, 10) || 9000,
    useSSL: false,
    accessKey: process.env.MINIO_ROOT_USER,
    secretKey: process.env.MINIO_ROOT_PASSWORD
});

// Check and create bucket if it doesn't exist
async function ensureBucketExists(bucketName) {
    try {
        const bucketExists = await minioClient.bucketExists(bucketName);
        if (!bucketExists) {
            await minioClient.makeBucket(bucketName, 'us-east-1');
            console.log(`Bucket ${bucketName} created successfully.`);
        } else {
            console.log(`Bucket ${bucketName} already exists.`);
        }
    } catch (error) {
        console.error('Error checking or creating bucket:', error);
        throw error;
    }
}

// Set up storage for Multer with file size limit of 1MB
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 1 * 1024 * 1024 }, // 1MB size limit
}).single('image');

// Initialize Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    }
});

// Route to serve the dashboard (Landing Page)
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Route to handle form submission
app.post('/submit', (req, res) => {
    upload(req, res, async (err) => {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).send('File size exceeds the limit of 1MB');
        } else if (err) {
            return res.status(500).send('An error occurred during file upload');
        }

        const { name, email, joining_date } = req.body;
        const image = req.file;

        if (!name || !email || !joining_date || !image) {
            return res.status(400).send('All fields are mandatory');
        }

        try {
            // Upload image to Minio
            const imageUrl = `uploads/${Date.now()}_${image.originalname}`;
            await minioClient.putObject('image', imageUrl, image.buffer);
            console.log('File uploaded successfully.');

            // Save employee details in PostgreSQL
            await employees.create({ name, email, joining_date, image_url: imageUrl });

            const imageBase64 = image.buffer.toString('base64');
            const imageSrc = `data:${image.mimetype};base64,${imageBase64}`;

            const emailTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome</title>
    <style>
                    body {
                        font-family: Arial, sans-serif;
                        background-color: #f4f4f4;
                        margin: 0;
                        padding: 0;
                        color: #333;
                    }
                    .container {
                        width: 80%;
                        max-width: 600px;
                        margin: 20px auto;
                        background-color: #fff;
                        padding: 20px;
                        border-radius: 8px;
                        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                        border:1px solid black;
                    }
                    .header {
                        background-color: #0073e6;
                        color: #fff;
                        padding: 10px;
                        text-align: center;
                        border-radius: 8px 8px 0 0;
                    }
                    .header img {
                        max-width: 100px;
                        margin-bottom: 10px;
                    }
                    .content {
                        color: rgb(61, 106, 255);
                        text-weight: bold;
                        padding: 20px;
                        line-height: 1.6;
                        border-radius: 0 0 8px 8px;
                        border:1px solid gray;
                    }
                    .content h1 {
                        color: white;
                    }
                    .footer {
                        text-align: center;
                        padding: 10px;
                        font-size: 12px;
                        color: #777;
                    }
                </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to KeenAble!</h1>
            <img src="cid:employee-image" alt="Employee Image">
        </div>
        <div class="content">
            <p>Dear ${name},</p>
            <p>Welcome to the team!</p>
            <p>We believe that you will be an excellent addition to our organization and are excited to see you thrive in your new role.</p>
            <p>We are confident that you will do great things here, and we look forward to working with you.</p>
            <p>Best regards,</p>
            <p>Belal Ahmad<br>Intern<br>KeenAble Computers Pvt. Ltd.</p>
        </div>
        <div class="footer">
            &copy; 2024 KeenAble Computers Pvt Ltd. All rights reserved.
        </div>
    </div>
</body>
</html>
`;



            // Send welcome email
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Welcome to the Organization',
                html: emailTemplate,
                attachments: [{
                    filename: image.originalname,
                    content: image.buffer,
                    cid: 'employee-image'
                }]
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log(error);
                    res.status(500).send('An error occurred while sending the email');
                } else {
                    console.log('Email sent: ' + info.response);
                    res.send('Welcome mail sent successfully');
                }
            });
        } catch (error) {
            console.log(error);
            res.status(500).send('An error occurred');
        }
    });
});

// Sync database, ensure bucket exists, and start server
sequelize.sync({ alter: true }).then(async () => {
    try {
        await ensureBucketExists('image');
        app.listen(3000, () => {
            console.log('Server is running on port 3000');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
    }
}).catch(err => {
    console.log('Failed to sync database:', err);
});
