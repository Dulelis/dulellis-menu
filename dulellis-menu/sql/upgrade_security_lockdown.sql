-- LOCKDOWN COMPLETO DE RLS/POLICIES
-- Use este script para remover policies antigas/permissivas e aplicar regras seguras.
-- Execute no SQL Editor do Supabase.

begin;

-- 1) Remove TODAS as policies existentes das tabelas críticas
do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'estoque',
        'taxas_entrega',
        'promocoes',
        'propagandas',
        'configuracoes_loja',
        'clientes',
        'pedidos'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- 2) Ativa RLS em todas as tabelas relevantes
alter table if exists public.estoque enable row level security;
alter table if exists public.taxas_entrega enable row level security;
alter table if exists public.promocoes enable row level security;
alter table if exists public.propagandas enable row level security;
alter table if exists public.configuracoes_loja enable row level security;
alter table if exists public.clientes enable row level security;
alter table if exists public.pedidos enable row level security;

-- 3) Revoga escrita para papéis públicos
revoke insert, update, delete on table public.estoque from anon, authenticated;
revoke insert, update, delete on table public.taxas_entrega from anon, authenticated;
revoke insert, update, delete on table public.promocoes from anon, authenticated;
revoke insert, update, delete on table public.propagandas from anon, authenticated;
revoke insert, update, delete on table public.configuracoes_loja from anon, authenticated;
revoke insert, update, delete on table public.clientes from anon, authenticated;
revoke insert, update, delete on table public.pedidos from anon, authenticated;

-- 4) Policies de leitura pública somente para vitrine
create policy estoque_public_select
on public.estoque
for select
to anon, authenticated
using (true);

create policy taxas_entrega_public_select
on public.taxas_entrega
for select
to anon, authenticated
using (true);

create policy promocoes_public_select
on public.promocoes
for select
to anon, authenticated
using (true);

create policy propagandas_public_select
on public.propagandas
for select
to anon, authenticated
using (true);

create policy configuracoes_loja_public_select
on public.configuracoes_loja
for select
to anon, authenticated
using (true);

-- 5) Sem policies para clientes/pedidos => sem leitura/escrita pública.
-- A API server usa service role e ignora RLS para operações internas.

commit;
