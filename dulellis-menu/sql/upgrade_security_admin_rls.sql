-- Segurança base para áreas administrativas
-- Execute este script no SQL Editor do Supabase.

begin;

-- Tabelas usadas na vitrine (somente leitura pública)
alter table if exists public.promocoes enable row level security;
alter table if exists public.propagandas enable row level security;
alter table if exists public.configuracoes_loja enable row level security;
alter table if exists public.taxas_entrega enable row level security;

drop policy if exists promocoes_public_select on public.promocoes;
create policy promocoes_public_select
on public.promocoes
for select
to anon, authenticated
using (true);

drop policy if exists propagandas_public_select on public.propagandas;
create policy propagandas_public_select
on public.propagandas
for select
to anon, authenticated
using (true);

drop policy if exists configuracoes_loja_public_select on public.configuracoes_loja;
create policy configuracoes_loja_public_select
on public.configuracoes_loja
for select
to anon, authenticated
using (true);

drop policy if exists taxas_entrega_public_select on public.taxas_entrega;
create policy taxas_entrega_public_select
on public.taxas_entrega
for select
to anon, authenticated
using (true);

-- Sem policies de insert/update/delete nessas tabelas:
-- o cliente anon não consegue mais escrever nelas.
-- Escritas administrativas agora devem ocorrer pela API server com service role.

commit;
