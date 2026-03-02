-- Cria tabela de promocoes usada no admin
create table if not exists public.promocoes (
  id bigserial primary key,
  titulo text not null,
  descricao text,
  produto_id bigint references public.estoque(id) on delete set null,
  preco_promocional numeric(10,2) not null default 0,
  ativa boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_promocoes_produto_id on public.promocoes(produto_id);
create index if not exists idx_promocoes_ativa on public.promocoes(ativa);
create index if not exists idx_promocoes_created_at on public.promocoes(created_at desc);
