    # ---- Build Stage ----
    FROM node:22-bookworm AS builder

    WORKDIR /usr/src/app

    # Copy package files and install all dependencies
    COPY package*.json ./
    RUN npm ci

    # Copy all source code
    COPY . .

    # Build the application
    RUN npm run build

    # ---- Production Stage ----
    FROM node:22-bookworm-slim

    WORKDIR /usr/src/app

    ENV NODE_ENV=production

    # Install production dependencies only
    COPY package*.json ./
    RUN npm ci --omit=dev

    # Copy the entire dist folder from builder
    COPY --from=builder /usr/src/app/dist ./dist
    COPY --from=builder /usr/src/app/dist/drizzle.config.js ./


    EXPOSE 3000
    USER node

    # Use the correct entry point
    CMD ["node", "dist/src/main.js"]
