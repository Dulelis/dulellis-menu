# Deploy Hostinger (Next.js) + Mercado Pago

## Pré-requisitos

1.  Plano Hostinger com suporte a **Node.js** (hPanel ou VPS).
2.  Acesso ao painel de controle ou SSH.
3.  Domínio configurado.

## Passo a Passo (hPanel - Hospedagem Compartilhada/Cloud)

1.  **Configurar Node.js**:
    - No hPanel, vá em **Node.js**.
    - Crie uma aplicação selecionando a versão **Node 18** ou **20**.
    - **Application Root**: Pasta do projeto (ex: `public_html`).
    - **Application Startup File**: `node_modules/next/dist/bin/next`
    - **Arguments**: `start`

2.  **Subir Arquivos**:
    - Suba os arquivos do projeto para a pasta escolhida.
    - **N�O suba**: `node_modules`, `.next`, `.git`.
    - **Suba**: `package.json`, `public/`, `next.config.ts` (ou .js), e as pastas de código (`app/`, `components/`, `lib/`, etc).
    - Rode `npm install` e depois `npm run build` no terminal da Hostinger ou via SSH.

3.  **Variáveis de Ambiente (.env)**:
    - Crie um arquivo `.env` na raiz da aplicação na Hostinger com as chaves:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=...
    NEXT_PUBLIC_SUPABASE_ANON_KEY=...
    
    # Mercado Pago
    MERCADOPAGO_ACCESS_TOKEN=...
    MERCADOPAGO_WEBHOOK_SECRET=...
    
    # Outras (se necessário)
    CARTAO_API_TOKEN=...
    CARTAO_API_URL=...
    CARTAO_SOURCE_URL=...
    ```

## URLs para Mercado Pago

- **URL de notificação (Webhook)**: `https://seu-dominio.com.br/api/webhooks/mercadopago`