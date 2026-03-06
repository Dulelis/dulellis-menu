-- Tokens de recuperacao de senha via e-mail
create table if not exists public.clientes_password_reset_tokens (
  id bigserial primary key,
  email text not null,
  token_hash text not null,
  tentativas smallint not null default 0,
  expira_em timestamptz not null,
  usado_em timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_clientes_reset_email
  on public.clientes_password_reset_tokens (email, created_at desc);

create index if not exists idx_clientes_reset_expira
  on public.clientes_password_reset_tokens (expira_em);
