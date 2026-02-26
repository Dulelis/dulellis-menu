# Deploy Netlify (Next.js)

## Como subir

1. Suba a raiz do projeto `dulellis-menu` (preferencialmente via repositorio Git).
2. Nao suba pastas temporarias:
   - `.next`
   - `node_modules`
   - `.env.local`
3. No Netlify, o build usa:
   - Command: `npm run build`
   - Node: `20` (configurado no `netlify.toml`)

## Variaveis de ambiente no Netlify

Cadastre estas variaveis em `Site settings > Environment variables`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `CARTAO_API_TOKEN`
- `PAGBANK_APP_KEY`
- `CARTAO_API_URL`
- `CARTAO_SOURCE_URL`
- `PAGBANK_WEBHOOK_USERNAME`
- `PAGBANK_WEBHOOK_PASSWORD`

## URLs para PagBank

- URL da aplicacao: `https://deliverydulelisconfeitaria.netlify.app/`
- URL de retorno: `https://deliverydulelisconfeitaria.netlify.app/retorno-pagamento`
- URL de notificacao: `https://deliverydulelisconfeitaria.netlify.app/api/pagamento/notificacao`
