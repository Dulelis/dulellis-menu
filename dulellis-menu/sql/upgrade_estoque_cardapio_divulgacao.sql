begin;

alter table if exists public.estoque
  add column if not exists exibir_cardapio boolean not null default false;

comment on column public.estoque.exibir_cardapio is
  'Define se o produto aparece no cardapio publico de divulgacao.';

update public.estoque
set exibir_cardapio = true
where
  lower(coalesce(categoria, '')) like '%por encomenda%'
  or lower(trim(coalesce(categoria, ''))) = 'salgados assados';

create index if not exists idx_estoque_exibir_cardapio
  on public.estoque(exibir_cardapio)
  where exibir_cardapio = true;

commit;
