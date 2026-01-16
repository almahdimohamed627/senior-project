# Stage 1: Build the Angular application
FROM node:24-alpine AS build

# # Install NVM (if absolutely necessary)
# RUN apk add --no-cache bash wget

# ENV NVM_DIR /usr/local/nvm
# RUN mkdir -p $NVM_DIR && \
# wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash \
# && . $NVM_DIR/nvm.sh \
# && nvm install 24 \
# && nvm use 24

# Set working directory
WORKDIR /app

# Install Angular CLI globally (you can also use npx)
RUN npm install -g @angular/cli@19

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production --legacy-peer-deps

# Copy application source
COPY . .

# Build the Angular app
RUN ng build --configuration=production

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Remove default nginx website
RUN rm -rf /usr/share/nginx/html/*

# Copy built files from build stage
COPY --from=build /app/dist/admin-dashboard/browser /usr/share/nginx/html

# Copy custom nginx config (optional)
# COPY nginx.conf /etc/nginx/nginx.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
