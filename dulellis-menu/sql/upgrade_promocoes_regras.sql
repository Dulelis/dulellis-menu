-- Evolucao da tabela de promocoes para suportar regras por tipo
alter table if exists public.promocoes
  add column if not exists tipo text not null default 'percentual',
  add column if not exists valor_promocional numeric(10,2) not null default 0,
  add column if not exists qtd_minima integer not null default 1,
  add column if not exists qtd_bonus integer not null default 1,
  add column if not exists valor_minimo_pedido numeric(10,2) not null default 0,
  add column if not exists data_inicio date,
  add column if not exists data_fim date;

-- Migra valor antigo, se existir
update public.promocoes
set valor_promocional = coalesce(valor_promocional, preco_promocional, 0)
where true;

create index if not exists idx_promocoes_tipo on public.promocoes(tipo);
create index if not exists idx_promocoes_periodo on public.promocoes(data_inicio, data_fim);
