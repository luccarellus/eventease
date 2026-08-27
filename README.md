# EventEase - Gestão de Eventos

Plataforma moderna e integrada de gestão de eventos, inscrição de participantes, controle de presença via QR Code e painel administrativo (Dashboard) em tempo real.

O projeto utiliza uma arquitetura monorepo simplificada contendo uma aplicação web React (SPA) no frontend e uma API REST em NestJS com banco de dados PostgreSQL estruturado via Prisma.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: [React 19](https://react.dev/), [Vite](https://vite.dev/), [React Router v7](https://reactrouter.com/), [TailwindCSS](https://tailwindcss.com/), [Motion](https://motion.dev/) (animações), [Lucide React](https://lucide.dev/) (ícones) e [Sonner](https://sonner.pages.dev/) (toasts).
- **Backend**: [NestJS 11](https://nestjs.com/), [Passport JWT](http://www.passportjs.org/) (autenticação segura via Cookies), [Helmet](https://helmetjs.github.io/) (headers de segurança), [Throttler](https://github.com/nestjs/throttler) (rate-limiting) e [Jest](https://jestjs.io/) (testes e2e).
- **Banco de Dados**: [PostgreSQL](https://www.postgresql.org/) com [Prisma ORM](https://www.prisma.io/).
- **Hospedagem**: Docker Compose (PostgreSQL + Redis + API + Frontend + Nginx) ou
  deploy manual na VPS.

---

## 📱 Funcionalidades Principais

1. **Inscrição de Alunos (Público)**: Formulário fluido e animado com seleção dinâmica de Cidade e Escola e geração instantânea de credencial com código único (`EVT-XXXXXX`) e QR Code.
2. **Consulta de Credencial**: Recuperação rápida da credencial física de acesso inserindo apenas o e-mail cadastrado.
3. **Validação de Check-in (Staff)**: Leitor de QR Code integrado para a câmera do celular ou digitação de código manual para registrar a presença dos participantes no evento em tempo real.
4. **Painel de Controle Administrativo (Dashboard)**:
   - Métricas globais de adesão e presença.
   - Criação, edição, exclusão e publicação de múltiplos eventos.
   - Lista geral de alunos cadastrados e participantes de cada evento.
   - Filtros de presença e exportação instantânea de relatórios em planilhas **CSV (compatível com Excel)**.
5. **Autenticação Segura**: Gerenciamento de acessos administrativos via cookies HTTPOnly com tokens JWT de expiração curta e rota de refresh automático contra ataques XSS/CSRF.

---

## ⚙️ Configuração do Ambiente (.env)

Crie um arquivo `.env` na raiz do projeto (o docker-compose usa essas variáveis). Consulte `.env.example` para o modelo completo.

```env
# PostgreSQL (Docker Compose)
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="sua-senha-forte-aqui"
POSTGRES_DB="eventease"

# As variáveis DATABASE_URL e DIRECT_URL são geradas automaticamente pelo docker-compose
# Se usar PostgreSQL externo, defina manualmente:
# DATABASE_URL="postgresql://usuario:senha@host:5432/eventease"
# DIRECT_URL="postgresql://usuario:senha@host:5432/eventease"

# Segurança
JWT_SECRET="gere-um-segredo-hexadecimal-forte-para-jwt"
JWT_REFRESH_SECRET="gere-outro-segredo-hexadecimal-forte-para-refresh"
VITE_RECAPTCHA_SITE_KEY="chave-publica-do-recaptcha-v3"
RECAPTCHA_SECRET_KEY="chave-secreta-do-recaptcha-v3"
RECAPTCHA_MIN_SCORE="0.5"
COOKIE_SECRET="gere-outro-segredo-forte-para-cookies"

# CORS / URL do Frontend
FRONTEND_URL="http://localhost:3000"
```

---

## 🚀 Como Executar Localmente

### Pré-requisitos

- Node.js (versão 18 ou superior)
- NPM instalado

### Passo 1: Instalar Dependências e Gerar o Prisma Client

Na raiz do projeto, instale os pacotes principais e gere a tipagem do banco:

```bash
npm install
```

Instale também as dependências da API NestJS dentro da pasta `backend`:

```bash
cd backend
npm install
cd ..
```

### Passo 2: Inicializar o Banco de Dados

O docker-compose já inclui um container PostgreSQL. Suba o banco e aplique as migrations:

```bash
# Inicia apenas o PostgreSQL e Redis
docker compose up -d postgres redis

# Aguarde o PostgreSQL estar pronto (healthcheck)
docker compose exec postgres pg_isready

# Popula o banco com o usuário administrador inicial
# Para definir uma senha conhecida, configure ADMIN_SEED_PASSWORD (e opcionalmente ADMIN_SEED_EMAIL):
ADMIN_SEED_PASSWORD="sua-senha-admin" npx prisma db seed --schema=backend/prisma/schema.prisma
```

> **Segurança:** o seed nunca imprime a senha no console. Se `ADMIN_SEED_PASSWORD` não for definida, uma senha aleatória é gerada. Para redefinir a senha de um admin existente, configure `ADMIN_SEED_PASSWORD` e rode o seed novamente. Nunca use credenciais padrão fixas em produção.

### Passo 3: Iniciar as Aplicações

Em terminais separados:

- **Iniciar API Backend** (porta `3001` padrão para proxy local):

  ```bash
  cd backend
  PORT=3001 npm run start:dev
  ```

  > A API é servida sob o prefixo `/api` (ex.: `/api/events`, `/api/health`).

- **Iniciar Frontend React (Vite)** (porta `3000` padrão):

  ```bash
  npm run dev
  ```

  > O proxy do Vite encaminha `/api/*` direto para a API na porta `3001` (sem
  > remover o prefixo `/api`).

Acesse o sistema localmente em: `http://localhost:3000`

---

## 🧪 Testes Automatizados (Backend)

O backend possui testes de ponta-a-ponta (E2E) robustos que validam segurança de rotas, LGPD, auth por cookies e persistência de dados. Para executá-los:

```bash
cd backend
npm run test:e2e
```

---

## 🌐 Como Implantar via Docker Compose (Produção)

O projeto roda inteiramente via Docker Compose: PostgreSQL, Redis, API NestJS,
frontend estático e Nginx (proxy). Tudo está containerizado.

> **Importante:** a API expõe as rotas sob o prefixo `/api` (ex.:
> `/api/events`). O Nginx encaminha `/api/*` **sem remover o prefixo**.

1. **Clone o repositório** e copie `.env.example` para `.env`:

   ```bash
   cp .env.example .env
   # Edite o .env com suas senhas e configurações
   ```

2. **Suba todos os containers**:

   ```bash
   docker compose up -d --build
   ```

   O PostgreSQL será criado automaticamente com as credenciais do `.env`.

3. **Aplique as migrations do banco** (após o primeiro boot):

   ```bash
   docker compose exec api npx prisma migrate deploy
   ```

4. **Popule o banco com o admin inicial**:

   ```bash
   ADMIN_SEED_PASSWORD="sua-senha" docker compose exec api npx prisma db seed
   ```

5. **DNS**: aponte o domínio (ex.: `eventease.com`) para o IP da VPS.
   Para HTTPS, descomente o bloco SSL em `docker/nginx/conf.d/default.conf` e
   gere o certificado com o Certbot.

### Variáveis de Ambiente (produção)

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` — credenciais do PostgreSQL
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET` — chaves de segurança
- `FRONTEND_URL` — domínio final (ex.: `https://eventease.com`)
- `VITE_RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY`, `RECAPTCHA_MIN_SCORE`
- `NEVAPRO_WEBHOOK_URL`, `NEVAPRO_WEBHOOK_SECRET`
- `VITE_MAINTENANCE_MODE` (opcional; `false` para o site ficar online)

> **Nota**: `DATABASE_URL` e `DIRECT_URL` são geradas automaticamente pelo
> docker-compose a partir das variáveis `POSTGRES_*`.
