# Base deps
FROM node:20-alpine AS deps
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci

# Build
FROM node:20-alpine AS build
WORKDIR /usr/src/app
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production
FROM node:20-alpine AS production
WORKDIR /usr/src/app
ENV NODE_ENV=production
ENV DRIZZLE_CONFIG_PATH=/usr/src/app/drizzle.config.ts
COPY package*.json ./
COPY --from=build /usr/src/app/dist ./dist
COPY --from=deps /usr/src/app/node_modules ./node_modules
CMD ["node", "dist/src/main.js"]  # or dist/main.js if you set rootDir=./src in tsconfig
