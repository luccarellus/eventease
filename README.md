# EventEase - Olhar Jovem Eventos

Plataforma moderna e integrada de gestão de eventos, inscrição de participantes, controle de presença via QR Code e painel administrativo (Dashboard) em tempo real.

O projeto utiliza uma arquitetura monorepo simplificada contendo uma aplicação web React (SPA) no frontend e uma API REST em NestJS com banco de dados PostgreSQL estruturado via Prisma.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: [React 19](https://react.dev/), [Vite](https://vite.dev/), [React Router v7](https://reactrouter.com/), [TailwindCSS](https://tailwindcss.com/), [Motion](https://motion.dev/) (animações), [Lucide React](https://lucide.dev/) (ícones) e [Sonner](https://sonner.pages.dev/) (toasts).
- **Backend**: [NestJS 11](https://nestjs.com/), [Passport JWT](http://www.passportjs.org/) (autenticação segura via Cookies), [Helmet](https://helmetjs.github.io/) (headers de segurança), [Throttler](https://github.com/nestjs/throttler) (rate-limiting) e [Jest](https://jestjs.io/) (testes e2e).
- **Banco de Dados**: [PostgreSQL](https://www.postgresql.org/) com [Prisma ORM](https://www.prisma.io/).
- **Hospedagem**: Docker na VPS (frontend + API + Redis + Nginx).

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

Crie arquivos `.env` na raiz do projeto e dentro do diretório `/backend`. Utilize as chaves conforme o modelo abaixo:

```env
# URL do PostgreSQL usada pela API em runtime (pode incluir pooling, ex.: PgBouncer)
DATABASE_URL="postgresql://usuario:senha@host:5432/eventease"

# URL de conexão direta - Usada para migrations e pushes do Prisma
DIRECT_URL="postgresql://usuario:senha@host:5432/eventease"

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

Certifique-se de configurar as strings do PostgreSQL no `.env` e aplique as tabelas no banco:

```bash
# Sincroniza o schema.prisma com o banco
npm run prisma:db-push

# Popula o banco com o usuário administrador inicial
# Para definir uma senha conhecida, configure ADMIN_SEED_PASSWORD (e opcionalmente ADMIN_SEED_EMAIL):
npx prisma db seed --schema=backend/prisma/schema.prisma
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

## 🔄 Migração: Supabase → PostgreSQL independente

O sistema não depende mais do Supabase: a autenticação (login, cadastro e
roles) agora é feita 100% no próprio PostgreSQL, com senhas armazenadas em
`admin_users.password_hash` (bcrypt). O `dump.sql` do repositório já inclui
tudo que você precisa — inclusive uma tabela `supabase_auth_users_backup` com
os hashes das senhas dos admins, para que **ninguém precise trocar a senha**.

### Passo a passo

1. **Crie o banco PostgreSQL** em qualquer provedor (VPS, Docker, Neon, etc.).

2. **Importe o dump** (cria tabelas, dados e a tabela de backup de senhas):

   ```bash
   psql "$DATABASE_URL" < dump.sql
   ```

3. **Marque as migrations antigas como aplicadas** — o dump já criou o schema,
   então o Prisma não deve tentar recriá-lo:

   ```bash
   npx prisma migrate resolve --applied 0_init --schema=backend/prisma/schema.prisma
   npx prisma migrate resolve --applied 20260804120000_participante_email_unique --schema=backend/prisma/schema.prisma
   ```

4. **Aplique a migration nova** (adiciona `password_hash` em `admin_users` e
   copia os hashes do backup):

   ```bash
   npx prisma migrate deploy --schema=backend/prisma/schema.prisma
   ```

   Confira: `SELECT email, password_hash IS NOT NULL AS tem_senha FROM admin_users;`
   deve retornar `tem_senha = true` para os 3 admins.

5. **Atualize o `.env`**: aponte `DATABASE_URL`/`DIRECT_URL` para o novo
   PostgreSQL e **remova** as variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` e
   `SUPABASE_SERVICE_ROLE_KEY`.

6. **Substitua a senha de algum admin se necessário**: com
   `ADMIN_SEED_PASSWORD` definida, rode o seed para redefini-la:

   ```bash
   npx prisma db seed --schema=backend/prisma/schema.prisma
   ```

7. **Pronto**: os admins entram com as mesmas senhas de antes. Depois de
   validar em produção, remova as variáveis do Supabase do painel
   (Easypanel/VPS) e delete o projeto no Supabase. Os arquivos `supabase/` e
   `supabase_setup.sql` ficaram obsoletos e podem ser excluídos.

---

## 🧪 Testes Automatizados (Backend)

O backend possui testes de ponta-a-ponta (E2E) robustos que validam segurança de rotas, LGPD, auth por cookies e persistência de dados. Para executá-los:

```bash
cd backend
npm run test:e2e
```

---

## 🌐 Como Implantar na VPS (Docker Compose)

O projeto roda inteiramente na sua VPS via Docker Compose: Nginx (proxy),
frontend estático, API NestJS e Redis. O PostgreSQL fica fora dos containers
(no host ou em um container dedicado, ex.: `eventease_postgresql`).

> **Importante:** a API expõe as rotas sob o prefixo `/api` (ex.:
> `/api/events`). O Nginx encaminha `/api/*` **sem remover o prefixo** —
> mantenha isso no proxy da VPS se você não usar o `docker-compose` deste
> repositório.

1. **Clone o repositório na VPS** e copie um `.env` com as variáveis abaixo.
2. **Crie/importe o banco** (`psql "$DATABASE_URL" < dump.sql`) e aplique as
   migrations (`npx prisma migrate deploy`).
3. **Suba os containers**:

   ```bash
   docker compose up -d --build
   ```

4. **Variáveis de Ambiente** (no `.env` da VPS ou no painel do Easypanel):
   - `DATABASE_URL` / `DIRECT_URL` — URL do PostgreSQL. Dentro da rede Docker
     use `postgres://postgres:senha@eventease_postgresql:5432/eventease`;
     de fora, use o IP/host e a porta publicada (ex.: porta `5433`).
   - `JWT_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET`
   - `VITE_RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY`, `RECAPTCHA_MIN_SCORE`
   - `FRONTEND_URL` (domínio final)
   - `NEVAPRO_WEBHOOK_URL`, `NEVAPRO_WEBHOOK_SECRET`
   - `VITE_MAINTENANCE_MODE` (opcional; `false` para o site ficar online)
5. **DNS**: aponte o domínio (ex.: `eventease.olharjovem.org`) para o IP da VPS.
   Para HTTPS, descomente o bloco SSL em `docker/nginx/conf.d/default.conf` e
   gere o certificado com o Certbot.

> **Nota**: este projeto não usa mais a Vercel — os arquivos `vercel.json` e
> `api/` foram removidos.
