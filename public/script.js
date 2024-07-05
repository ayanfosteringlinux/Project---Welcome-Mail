const form = document.getElementById('welcomeForm');
const submitButton = document.getElementById('submitButton');
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const joiningDateInput = document.getElementById('joining_date');
const imageInput = document.getElementById('image');
const previewDiv = document.getElementById('preview');

// Function to update the preview
const updatePreview = () => {
    const name = nameInput.value;
    const email = emailInput.value;
    const joiningDate = joiningDateInput.value;
    const imageFile = imageInput.files[0];

    if (!name || !email || !joiningDate || !imageFile) {
        previewDiv.innerHTML = '<p>Please fill in all fields to see the preview.</p>';
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const imageSrc = e.target.result;
        const emailTemplate = `
        <div class="container">
            <div class="header">
                <h1 style="color: white;">Welcome to KeenAble!</h1>
                <img src="${imageSrc}" alt="Employee Image" style="max-width: 100px; margin-bottom: 10px; margin-left: 37%;">
            </div>
            <div style="color: white;" class="content">
                <p>Dear ${name},</p>
                <p>Welcome to the team!</p>
                <p>We believe that you will be an excellent addition to our organization and are excited to see you thrive in your new role.</p>
                <p>We are confident that you will do great things here, and we look forward to working with you.</p>
                <p>Best regards,</p>
                <p>Belal Ahmad<br>Contractor<br>KeenAble Computers Pvt. Ltd.</p>
            </div>
            <div style="color: white;" class="footer">
                &copy; 2024 KeenAble Computers Pvt Ltd. All rights reserved.
            </div>
        </div>
        `;
        previewDiv.innerHTML = emailTemplate;
    };

    reader.readAsDataURL(imageFile);
};

// Add event listeners to update the preview
nameInput.addEventListener('input', updatePreview);
emailInput.addEventListener('input', updatePreview);
joiningDateInput.addEventListener('input', updatePreview);
imageInput.addEventListener('change', updatePreview);

// Add event listeners to check form validity
form.addEventListener('input', function() {
    if (form.checkValidity()) {
        submitButton.style.display = 'block';
    } else {
        submitButton.style.display = 'none';
    }
});

form.addEventListener('submit', async function(event) {
    event.preventDefault();

    const progressBarContainer = document.getElementById('progressBarContainer');
    const progressBar = document.getElementById('progressBar');
    progressBarContainer.style.display = 'block';

    let progress = 0;
    const interval = setInterval(() => {
        progress += 10;
        if (progress <= 90) {
            progressBar.style.width = progress + '%';
            progressBar.textContent = progress + '%';
        }
    }, 300); // Simulate progress

    const formData = new FormData(this);

    try {
        const response = await fetch('/submit', {
            method: 'POST',
            body: formData
        });

        clearInterval(interval);
        progressBar.style.width = '100%';
        progressBar.textContent = '100%';

        const result = await response.text();

        if (response.ok) {
            alert('Welcome mail sent successfully');
            console.log('Form submission successful, resetting form.');
            form.reset(); // Reset the form after successful submission
            submitButton.style.display = 'none'; // Hide the submit button after reset
            previewDiv.innerHTML = ''; // Clear the preview after submission
        } else {
            alert('Error: ' + result);
            console.log('Form submission error: ' + result);
        }
    } catch (error) {
        clearInterval(interval);
        console.error('Error:', error);
        alert('An error occurred while sending the email');
    } finally {
        setTimeout(() => {
            progressBarContainer.style.display = 'none';
        }, 1000);
    }
});
