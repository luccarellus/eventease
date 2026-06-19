# ==========================================
# STAGE 1: Build Frontend (Vite)
# ==========================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app
COPY package*.json ./
RUN npm install --ignore-scripts

COPY . .

# Não usa mais Supabase, API é servida na mesma origem

RUN npm run build


# ==========================================
# STAGE 2: Build Backend (NestJS)
# ==========================================
FROM node:20-alpine AS backend-builder

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install

COPY backend/ .
# Gera o client do Prisma antes de compilar
RUN npx prisma generate
RUN npm run build


# ==========================================
# STAGE 3: Imagem Final (Roda Nginx + Node)
# ==========================================
FROM node:20-alpine

# Instala o Nginx e Supervisor (para rodar 2 processos juntos)
RUN apk add --no-cache nginx supervisor

WORKDIR /app

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
    echo '        rewrite ^/api/(.*) /$1 break;' >> /etc/nginx/http.d/default.conf && \
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



# 4. Configura o Supervisor para rodar Nginx + Node simultaneamente
RUN mkdir -p /etc/supervisor.d && \
    echo '[supervisord]' > /etc/supervisord.conf && \
    echo 'nodaemon=true' >> /etc/supervisord.conf && \
    echo '[program:nginx]' >> /etc/supervisord.conf && \
    echo 'command=nginx -g "daemon off;"' >> /etc/supervisord.conf && \
    echo 'autostart=true' >> /etc/supervisord.conf && \
    echo 'autorestart=true' >> /etc/supervisord.conf && \
    echo '[program:backend]' >> /etc/supervisord.conf && \
    echo 'command=sh -c "npx prisma db push --accept-data-loss || true; node dist/main.js"' >> /etc/supervisord.conf && \
    echo 'directory=/app/backend' >> /etc/supervisord.conf && \
    echo 'autostart=true' >> /etc/supervisord.conf && \
    echo 'autorestart=true' >> /etc/supervisord.conf && \
    echo 'stdout_logfile=/dev/stdout' >> /etc/supervisord.conf && \
    echo 'stdout_logfile_maxbytes=0' >> /etc/supervisord.conf && \
    echo 'stderr_logfile=/dev/stderr' >> /etc/supervisord.conf && \
    echo 'stderr_logfile_maxbytes=0' >> /etc/supervisord.conf

EXPOSE 80

# Inicia o Supervisor (ele vai ligar o Nginx e o Backend juntos)
CMD ["supervisord", "-c", "/etc/supervisord.conf"]
