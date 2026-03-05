-- Tokens de recuperacao de senha via WhatsApp
create table if not exists public.clientes_password_reset_tokens (
  id bigserial primary key,
  whatsapp text not null,
  token_hash text not null,
  tentativas smallint not null default 0,
  expira_em timestamptz not null,
  usado_em timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_clientes_reset_whatsapp
  on public.clientes_password_reset_tokens (whatsapp, created_at desc);

create index if not exists idx_clientes_reset_expira
  on public.clientes_password_reset_tokens (expira_em);

