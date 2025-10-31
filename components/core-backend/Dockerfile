# Build stage
FROM node:20-alpine AS builder
WORKDIR /
COPY package*.json tsconfig*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /
COPY package*.json tsconfig*.json ./
RUN npm install --only=production
COPY --from=builder /dist ./dist
CMD [ "node", "dist/main" ]