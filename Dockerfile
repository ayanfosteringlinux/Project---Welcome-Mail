FROM node:16

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./

RUN npm install

# Install netcat

RUN apt-get update && apt-get install -y netcat

# Bundle app source
COPY . .

EXPOSE 3000

COPY wait-for-it.sh /wait-for-it.sh

RUN chmod +x /wait-for-it.sh

CMD ["sh", "-c", "/wait-for-it.sh db 5432 -- node server.js" ]


