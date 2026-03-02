-- Tabela de propagandas/banners da vitrine
create table if not exists public.propagandas (
  id bigserial primary key,
  titulo text not null,
  descricao text,
  imagem_url text,
  botao_texto text,
  botao_link text,
  ordem integer not null default 0,
  data_inicio date,
  data_fim date,
  ativa boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_propagandas_ativa on public.propagandas(ativa);
create index if not exists idx_propagandas_ordem on public.propagandas(ordem asc);
create index if not exists idx_propagandas_periodo on public.propagandas(data_inicio, data_fim);
