# Dulellis Menu

Aplicacao Next.js do cardapio com pedido online, autenticacao de clientes e recuperacao de senha por e-mail.

## Rodar localmente

```bash
cmd /c npm install
cmd /c npm run dev
```

Abra `http://localhost:3000`.

## Variaveis de ambiente

Crie um arquivo `.env.local` com o minimo abaixo:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CUSTOMER_AUTH_SECRET=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Reset de senha por e-mail

O fluxo de reset usa:

- `CUSTOMER_AUTH_SECRET` para assinar o link e gerar hashes de senha/token.
- `SUPABASE_SERVICE_ROLE_KEY` para ler e atualizar clientes/tokens no backend.
- `NEXT_PUBLIC_SITE_URL` ou `APP_URL` para montar a URL enviada ao cliente.

Configure um dos canais abaixo para envio do e-mail:

```env
# Opcao 1: SMTP
SMTP_HOST=
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
SMTP_SECURE=true
EMAIL_OTP_FROM=
```

```env
# Opcao 2: Resend
RESEND_API_KEY=
EMAIL_OTP_FROM=
```

```env
# Opcao 3: Webhook proprio
EMAIL_OTP_API_URL=
EMAIL_OTP_FROM=
```

Se nenhum canal estiver configurado, `POST /api/public/auth/forgot-password` responde com erro de configuracao.

## SQL necessario no Supabase

Rode estes arquivos no SQL Editor:

1. `sql/upgrade_clientes_auth.sql`
2. `sql/upgrade_clientes_password_reset.sql`
3. `sql/upgrade_clientes_auth_email.sql`

Esses scripts adicionam:

- `clientes.senha_hash`
- `clientes.email`
- `clientes_password_reset_tokens`

## Fluxo implementado

1. Cliente clica em `Esqueci minha senha`.
2. A tela envia o e-mail para `POST /api/public/auth/forgot-password`.
3. O backend gera um token com validade de 10 minutos e salva o hash em `clientes_password_reset_tokens`.
4. O cliente recebe um link como `/?reset_token=...`.
5. A home abre o modal de autenticacao em modo de recuperacao e envia a nova senha para `POST /api/public/auth/reset-password`.

## Verificacao rapida

- `cmd /c npm run lint`
- `cmd /c npx tsc --noEmit`

Ultima verificacao local: lint e TypeScript ok em `2026-03-13`.
