-- Login de clientes por telefone + senha
alter table if exists public.clientes
  add column if not exists senha_hash text;

create index if not exists idx_clientes_whatsapp_auth on public.clientes(whatsapp);

