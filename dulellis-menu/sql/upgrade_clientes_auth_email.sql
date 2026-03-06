-- Cadastro de e-mail para clientes e reset por e-mail
alter table if exists public.clientes
  add column if not exists email text;

create index if not exists idx_clientes_email_auth on public.clientes(email);

alter table if exists public.clientes_password_reset_tokens
  add column if not exists email text;

create index if not exists idx_clientes_reset_email
  on public.clientes_password_reset_tokens (email, created_at desc);
