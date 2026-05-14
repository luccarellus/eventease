# Projeto Olhar Jovem - Evento

Este projeto foi desenvolvido para a gestão de inscrições e check-in do evento Olhar Jovem.

## 🚀 Como implantar na Vercel

1.  **Suba o código para o GitHub:**
    *   Se a exportação direta falhar, baixe o **ZIP** do projeto no AI Studio.
    *   Crie um novo repositório no seu GitHub.
    *   Suba os arquivos para lá.

2.  **Conecte na Vercel:**
    *   Acesse [vercel.com](https://vercel.com) e importe o repositório.

3.  **Configure as Variáveis de Ambiente (CRÍTICO):**
    No painel da Vercel, antes de clicar em "Deploy", vá em **Environment Variables** e adicione:
    *   `VITE_SUPABASE_URL`: (Sua URL do Supabase)
    *   `VITE_SUPABASE_ANON_KEY`: (Sua Chave Anon do Supabase)

    *Nota: Você encontra esses valores no painel do Supabase em Project Settings -> API.*

4.  **Configurações de Build:**
    *   Framework Preset: `Vite`
    *   Build Command: `npm run build`
    *   Output Directory: `dist`

## 🔐 Segurança Administrativa

Os e-mails autorizados como administradores estão configurados no arquivo `src/constants.ts`. Somente usuários com estes e-mails e autenticados via Supabase terão acesso às funcionalidades de:
*   Painel de Liderança (Métricas)
*   Check-in de participantes
*   Controle de Sincronização

## 📱 Funcionalidades
- **Inscrição:** Cadastro de novos participantes via formulário fluido.
- **Check-in:** Validação de ingressos via QR Code ou código manual.
- **Painel Admin:** Visualização de estatísticas em tempo real.
