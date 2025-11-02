# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install ALL dependencies for build
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install ALL dependencies (not just production) to ensure runtime deps are available
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestapp -u 1001

# Change ownership to non-root user
RUN chown -R nestapp:nodejs /app
USER nestapp

EXPOSE 3000
CMD [ "node", "dist/src/main" ]