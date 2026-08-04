# EventEase - Olhar Jovem Eventos

Plataforma moderna e integrada de gestão de eventos, inscrição de participantes, controle de presença via QR Code e painel administrativo (Dashboard) em tempo real.

O projeto utiliza uma arquitetura monorepo simplificada contendo uma aplicação web React (SPA) no frontend e uma API REST em NestJS com banco de dados PostgreSQL estruturado via Prisma.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: [React 19](https://react.dev/), [Vite](https://vite.dev/), [React Router v7](https://reactrouter.com/), [TailwindCSS](https://tailwindcss.com/), [Motion](https://motion.dev/) (animações), [Lucide React](https://lucide.dev/) (ícones) e [Sonner](https://sonner.pages.dev/) (toasts).
- **Backend**: [NestJS 11](https://nestjs.com/), [Passport JWT](http://www.passportjs.org/) (autenticação segura via Cookies), [Helmet](https://helmetjs.github.io/) (headers de segurança), [Throttler](https://github.com/nestjs/throttler) (rate-limiting) e [Jest](https://jestjs.io/) (testes e2e).
- **Banco de Dados**: [PostgreSQL](https://www.postgresql.org/) (hospedado no [Supabase](https://supabase.com/)) com [Prisma ORM](https://www.prisma.io/).
- **Hospedagem & Nuvem**: [Vercel](https://vercel.com/) (Serverless) e Docker (para auto-hospedagem opcional).

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
# URL do Supabase com pooling de conexões (porta 6543) - Usada em produção/servidor
DATABASE_URL="postgresql://postgres.xxx:senha@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# URL de conexão direta ao Supabase (porta 5432) - Usada para migrations e pushes
DIRECT_URL="postgresql://postgres.xxx:senha@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"

# Segurança
JWT_SECRET="gere-um-segredo-hexadecimal-forte-para-jwt"
JWT_REFRESH_SECRET="gere-outro-segredo-hexadecimal-forte-para-refresh"
VITE_RECAPTCHA_SITE_KEY="chave-publica-do-recaptcha-v3"
RECAPTCHA_SECRET_KEY="chave-secreta-do-recaptcha-v3"
RECAPTCHA_MIN_SCORE="0.5"
COOKIE_SECRET="gere-outro-segredo-forte-para-cookies"

# CORS / URL do Frontend
FRONTEND_URL="http://localhost:3000"

# Supabase Auth
SUPABASE_URL="https://xxxx.supabase.co"
SUPABASE_ANON_KEY="sua-chave-anon-aqui"
SUPABASE_SERVICE_ROLE_KEY="sua-chave-service-role-aqui"
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

Certifique-se de configurar as strings do Supabase no `.env` e aplique as tabelas no banco:

```bash
# Sincroniza o schema.prisma com o Supabase
npm run prisma:db-push

# Popula o banco com o usuário administrador inicial
# Para definir uma senha conhecida, configure ADMIN_SEED_PASSWORD (e opcionalmente ADMIN_SEED_EMAIL):
npx prisma db seed --schema=backend/prisma/schema.prisma
```

> **Segurança:** o seed nunca imprime a senha no console. Se `ADMIN_SEED_PASSWORD` não for definida, uma senha aleatória é gerada e você deve redefini-la pelo painel do Supabase Auth. Nunca use credenciais padrão fixas em produção.

### Passo 3: Iniciar as Aplicações

Em terminais separados:

- **Iniciar API Backend** (porta `3001` padrão para proxy local):

  ```bash
  cd backend
  npm run start:dev
  ```

- **Iniciar Frontend React (Vite)** (porta `3000` padrão):

  ```bash
  npm run dev
  ```

Acesse o sistema localmente em: `http://localhost:3000`

---

## 🧪 Testes Automatizados (Backend)

O backend possui testes de ponta-a-ponta (E2E) robustos que validam segurança de rotas, LGPD, auth por cookies e persistência de dados. Para executá-los:

```bash
cd backend
npm run test:e2e
```

---

## 🌐 Como Implantar na Vercel

O projeto está totalmente configurado para deploy serverless de monorepos na Vercel através do arquivo `vercel.json` e do handler em `api/index.ts`.

1. **GitHub**: Suba o código para o seu repositório pessoal do GitHub.
2. **Painel Vercel**: Importe o projeto a partir do repositório conectado.
3. **Configuração de Build**:
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. **Variáveis de Ambiente**:
   No menu *Environment Variables* da Vercel, cadastre as mesmas chaves do seu arquivo `.env`:
   - `DATABASE_URL` (com pooling / porta 6543)
   - `DIRECT_URL` (conexão direta / porta 5432)
   - `JWT_SECRET`
   - `JWT_REFRESH_SECRET` (deve ser diferente de `JWT_SECRET`)
   - `VITE_RECAPTCHA_SITE_KEY`
   - `RECAPTCHA_SECRET_KEY`
   - `RECAPTCHA_MIN_SCORE` (opcional; padrão `0.5`)
   - `COOKIE_SECRET`
   - `FRONTEND_URL` (o domínio final do seu app gerado na Vercel)
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. **Deploy**: Clique em **Deploy**. A Vercel servirá a SPA estática em `/` e compilará o NestJS em `/api/*` em uma única implantação serverless e segura.
