# Stage 1: Build the frontend
# hadolint ignore=DL3006,DL3007
# trivy:ignore:AVD-DS-0001
FROM node:22-alpine AS builder

RUN apk update && apk upgrade --no-cache

WORKDIR /app

# Build args injectados pelo docker-compose (variáveis públicas do Vite)
ARG VITE_RECAPTCHA_SITE_KEY
ARG VITE_API_URL
ARG VITE_MAINTENANCE_MODE
ENV VITE_RECAPTCHA_SITE_KEY=${VITE_RECAPTCHA_SITE_KEY:-}
ENV VITE_API_URL=${VITE_API_URL:-/api}
# Manutenção desativada por padrão; defina "true" para ativar
ENV VITE_MAINTENANCE_MODE=${VITE_MAINTENANCE_MODE:-false}

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Remove stale incremental state (avoids incomplete NestJS build)
RUN rm -f backend/tsconfig.tsbuildinfo backend/tsconfig.build.tsbuildinfo

# Build the Vite project
RUN npm run build

# Stage 2: Serve the frontend using Nginx
# hadolint ignore=DL3006,DL3007
# trivy:ignore:AVD-DS-0001
FROM nginx:alpine

RUN apk update && apk upgrade --no-cache

# Copy the built files from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration for React Router
COPY docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
