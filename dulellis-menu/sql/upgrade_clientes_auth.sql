-- Login de clientes por telefone/e-mail + senha
alter table if exists public.clientes
  add column if not exists senha_hash text,
  add column if not exists email text;

create index if not exists idx_clientes_whatsapp_auth on public.clientes(whatsapp);
create index if not exists idx_clientes_email_auth on public.clientes(email);
