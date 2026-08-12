# Stage 1: Build the frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Build args injectados pelo docker-compose (variáveis públicas do Vite)
ARG VITE_RECAPTCHA_SITE_KEY
ARG VITE_API_URL
ARG VITE_MAINTENANCE_MODE
ENV VITE_RECAPTCHA_SITE_KEY=${VITE_RECAPTCHA_SITE_KEY:-}
ENV VITE_API_URL=${VITE_API_URL:-/api}
# Manutenção ativa por padrão; defina "false" para desativar
ENV VITE_MAINTENANCE_MODE=${VITE_MAINTENANCE_MODE:-true}

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the Vite project
RUN npm run build

# Stage 2: Serve the frontend using Nginx
FROM nginx:alpine

# Copy the built files from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration for React Router
COPY docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
