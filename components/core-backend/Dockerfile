# ---- Build Stage ----
FROM node:22-bookworm AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

# Copy all source files
COPY . .

# 1. Temporarily override TypeScript's rootDir for a successful build
# This creates a custom config that extends yours but sets rootDir to "."
RUN echo ' \
  { \
    "extends": "./tsconfig.json", \
    "compilerOptions": { \
      "rootDir": "." \
    } \
  } \
' > tsconfig.docker.json

# 2. Build with the custom config
RUN npx nest build --tsconfig tsconfig.docker.json

# ---- Production Stage ----
FROM node:22-bookworm-slim

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

# 3. Selectively copy only the runtime files we need
# Copy the compiled application from src/ (now at dist/src)
COPY --from=builder /usr/src/app/dist/src ./dist

# Copy specific compiled config/script files if your app needs them at runtime
# Example: if your app expects drizzle.config.js in the root
COPY --from=builder /usr/src/app/dist/drizzle.config.js ./

EXPOSE 3000
USER node

CMD ["node", "dist/main.js"]
