# Use a Node.js base image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the entire server directory
COPY . .

# Expose the server's port (5000 internally)
EXPOSE 5000

# Start the Express.js server
CMD ["node", "index.js"]