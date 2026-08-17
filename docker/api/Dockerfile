# Stage 1: Build
# hadolint ignore=DL3006,DL3007
# trivy:ignore:AVD-DS-0001
FROM node:22-alpine AS builder

RUN apk update && apk upgrade --no-cache

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source and prisma schema
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Remove stale incremental state (avoids incomplete NestJS build)
RUN rm -f tsconfig.tsbuildinfo tsconfig.build.tsbuildinfo

# Build the application
RUN npm run build

# Stage 2: Runtime
# hadolint ignore=DL3006,DL3007
# trivy:ignore:AVD-DS-0001
FROM node:22-alpine

RUN apk update && apk upgrade --no-cache

WORKDIR /app

# Copy built files and dependencies from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

# Expose port
EXPOSE 3000

# Run the app
CMD ["node", "dist/main"]
