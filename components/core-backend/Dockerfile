# ---- Build Stage (Uses full image for dev dependencies) ----
FROM node:22 AS builder

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install ALL dependencies (including dev dependencies needed for the NestJS CLI and build)
RUN npm ci --only=production=false

# Copy the rest of the application files
COPY . .

# Build the NestJS application
RUN npm run build

# ---- Production Stage (Uses the slim variant for runtime) ----
FROM node:22-slim

# Set the working directory inside the container
WORKDIR /usr/src/app

ENV NODE_ENV=production

# Copy only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built application from the builder stage
# ADJUST THE PATH HERE if your 'main.js' is not directly in '/dist'
# Example if your file is at 'dist/src/main.js':
COPY --from=builder /usr/src/app/dist ./dist

# Expose the application port
EXPOSE 3000

# Security best practice: run as a non-root user
USER node

# Command to run the application
# ADJUST THE PATH HERE to match your actual output location
CMD ["node", "dist/main.js"]
