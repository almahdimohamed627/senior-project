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


# Copy built application
    # Copy necessary files from the builder stage with correct ownership
    COPY --from=builder --chown=nestapp:nodejs /app/package*.json ./
    COPY --from=builder --chown=nestapp:nodejs /app/node_modules ./node_modules
    COPY --from=builder --chown=nestapp:nodejs /app/dist ./dist
    # Copy configuration files required at runtime
    COPY --from=builder --chown=nestapp:nodejs /app/drizzle.config.json ./
    COPY --from=builder --chown=nestapp:nodejs /app/.env ./
    COPY /src ./

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestapp -u 1001
RUN chown -R nestapp:nodejs /app
USER nestapp

EXPOSE 3000
CMD [ "node", "dist/src/main" ]
