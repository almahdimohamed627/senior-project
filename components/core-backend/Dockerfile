# Build stage
FROM node:22-alpine AS builder
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
FROM node:22-alpine AS production
WORKDIR /app

# Copy package files AND node_modules from builder to ensure all deps are available
COPY package*.json ./
COPY tsconfig*.json ./

# Install production dependencies but keep all transitive dependencies
RUN npm ci --production --no-optional && npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestapp -u 1001
RUN chown -R nestapp:nodejs /app
USER nestapp


EXPOSE 3000 4000
CMD [ "node", "dist/src/main.js" ]
