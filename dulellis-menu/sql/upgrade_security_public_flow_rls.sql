-- Endurece o fluxo público (cliente/vitrine/pedidos)
-- Execute no SQL Editor do Supabase após o script de segurança do admin.

begin;

-- Vitrine pública
alter table if exists public.estoque enable row level security;
drop policy if exists estoque_public_select on public.estoque;
create policy estoque_public_select
on public.estoque
for select
to anon, authenticated
using (true);

-- Dados sensíveis: sem leitura/escrita pública
alter table if exists public.clientes enable row level security;
alter table if exists public.pedidos enable row level security;

-- Importante:
-- Sem policies de select/insert/update/delete para anon/authenticated em clientes/pedidos.
-- Isso força toda gravação/leitura sensível a passar pelas APIs server com service role.

commit;
