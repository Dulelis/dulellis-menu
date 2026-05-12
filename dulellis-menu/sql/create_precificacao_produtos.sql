create table if not exists public.precificacao_produtos (
  id bigserial primary key,
  estoque_id bigint references public.estoque(id) on delete set null,
  nome text not null,
  unidade_rendimento text,
  custo_ingredientes numeric(10, 2) not null default 0,
  custo_embalagem numeric(10, 2) not null default 0,
  custo_mao_obra numeric(10, 2) not null default 0,
  custo_operacional numeric(10, 2) not null default 0,
  margem_percentual numeric(10, 2) not null default 0,
  preco_sugerido numeric(10, 2) not null default 0,
  preco_venda numeric(10, 2) not null default 0,
  ativo_vitrine boolean not null default false,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists precificacao_produtos_estoque_id_idx
  on public.precificacao_produtos (estoque_id);

create or replace function public.set_precificacao_produtos_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_precificacao_produtos_updated_at on public.precificacao_produtos;

create trigger set_precificacao_produtos_updated_at
before update on public.precificacao_produtos
for each row
execute function public.set_precificacao_produtos_updated_at();
