# ==========================================
# STAGE 1: Build Frontend (Vite)
# ==========================================
# hadolint ignore=DL3006,DL3007
# trivy:ignore:AVD-DS-0001
FROM node:22-alpine AS frontend-builder

RUN apk update && apk upgrade --no-cache

WORKDIR /app
COPY package*.json ./
COPY backend/package*.json ./backend/

# Instala dependências sem rodar scripts de postinstall pré-maturos
RUN npm install --ignore-scripts
RUN npm install --prefix backend --ignore-scripts

COPY . .

# Gera o client do Prisma com as tipagens completas do banco de dados
RUN npx prisma generate --schema=backend/prisma/schema.prisma

# Remove estado incremental obsoleto (evita build incompleto do NestJS)
RUN rm -f backend/tsconfig.tsbuildinfo backend/tsconfig.build.tsbuildinfo

# Compila o backend e o frontend React
RUN npm run build


# ==========================================
# STAGE 2: Build Backend (NestJS)
# ==========================================
# hadolint ignore=DL3006,DL3007
# trivy:ignore:AVD-DS-0001
FROM node:22-alpine AS backend-builder

RUN apk update && apk upgrade --no-cache

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --ignore-scripts

COPY backend/ .
# Gera o client do Prisma antes de compilar
RUN npx prisma generate
# Remove estado incremental obsoleto (evita build incompleto do NestJS)
RUN rm -f tsconfig.tsbuildinfo tsconfig.build.tsbuildinfo
RUN npm run build


# ==========================================
# STAGE 3: Imagem Final (Roda Nginx + Node)
# ==========================================
# hadolint ignore=DL3006,DL3007
# trivy:ignore:AVD-DS-0001
FROM node:22-alpine

# Instala Nginx + Redis + Bash (para o terminal do Easypanel funcionar)
RUN apk update && apk upgrade --no-cache && apk add --no-cache nginx redis bash

WORKDIR /app

# Redis roda dentro do próprio container (127.0.0.1:6379)
ENV REDIS_HOST=127.0.0.1
ENV REDIS_PORT=6379

# 1. Copia o frontend compilado para o Nginx
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# 2. Configura o Nginx (Frontend no /, Backend no /api)
RUN echo 'server {' > /etc/nginx/http.d/default.conf && \
    echo '    listen 80;' >> /etc/nginx/http.d/default.conf && \
    echo '    location / {' >> /etc/nginx/http.d/default.conf && \
    echo '        root /usr/share/nginx/html;' >> /etc/nginx/http.d/default.conf && \
    echo '        index index.html;' >> /etc/nginx/http.d/default.conf && \
    echo '        try_files $uri $uri/ /index.html;' >> /etc/nginx/http.d/default.conf && \
    echo '    }' >> /etc/nginx/http.d/default.conf && \
    echo '    location /api/ {' >> /etc/nginx/http.d/default.conf && \
    echo '        # A API expõe as rotas sob /api (ex.: /api/events) — NÃO remover o prefixo' >> /etc/nginx/http.d/default.conf && \
    echo '        proxy_pass http://127.0.0.1:3000;' >> /etc/nginx/http.d/default.conf && \
    echo '        proxy_http_version 1.1;' >> /etc/nginx/http.d/default.conf && \
    echo '        proxy_set_header Upgrade $http_upgrade;' >> /etc/nginx/http.d/default.conf && \
    echo '        proxy_set_header Connection "upgrade";' >> /etc/nginx/http.d/default.conf && \
    echo '        proxy_set_header Host $host;' >> /etc/nginx/http.d/default.conf && \
    echo '    }' >> /etc/nginx/http.d/default.conf && \
    echo '}' >> /etc/nginx/http.d/default.conf

# 3. Copia o backend compilado
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder /app/backend/package*.json ./backend/
COPY --from=backend-builder /app/backend/prisma ./backend/prisma
COPY --from=backend-builder /app/backend/prisma.config.ts ./backend/
COPY --from=backend-builder /app/backend/tsconfig.json ./backend/

# 4. Script de inicialização direto (sem Supervisor): Redis + API + Nginx
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'mkdir -p /data' >> /app/start.sh && \
    echo 'redis-server --save 60 1 --dir /data --daemonize yes || true' >> /app/start.sh && \
    echo 'cd /app/backend' >> /app/start.sh && \
    echo 'timeout 60 npx prisma migrate deploy --schema=prisma/schema.prisma || true' >> /app/start.sh && \
    echo 'node dist/main.js &' >> /app/start.sh && \
    echo 'exec nginx -g "daemon off;"' >> /app/start.sh && \
    chmod +x /app/start.sh

EXPOSE 80

CMD ["/app/start.sh"]
