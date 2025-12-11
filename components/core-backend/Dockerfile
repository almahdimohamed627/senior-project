    # Build stage
    FROM node:22-bookworm AS builder

    WORKDIR /usr/src/app

    # Copy package files and install all dependencies
    COPY package*.json ./
    RUN npm ci

    # Copy all source code
    COPY . .

    # Build the application using the project's own build command
    # If this fails, it will use a direct TypeScript compile as fallback
    RUN npm run build || \
    (echo "Standard build failed, trying direct compilation..." && \
    npx tsc --project . --outDir ./dist)

    # Production stage  
    FROM node:22-bookworm-slim

    WORKDIR /usr/src/app

    ENV NODE_ENV=production

    # Install production dependencies only
    COPY package*.json ./
    RUN npm ci --omit=dev

    # Copy the entire dist folder from builder
    COPY --from=builder /usr/src/app/dist ./dist

    EXPOSE 3000
    USER node

    # Default command - will need adjustment after inspection
    CMD ["node", "dist/main.js"]
