begin;

alter table if exists public.estoque
  add column if not exists ordem_categoria integer not null default 0;

with ordenados as (
  select
    id,
    row_number() over (
      partition by lower(trim(coalesce(categoria, '')))
      order by lower(trim(coalesce(nome, ''))), nome, id
    )::integer as nova_ordem
  from public.estoque
)
update public.estoque as produto
set ordem_categoria = ordenados.nova_ordem
from ordenados
where produto.id = ordenados.id
  and produto.ordem_categoria = 0;

create index if not exists idx_estoque_categoria_ordem
  on public.estoque(categoria, ordem_categoria, nome);

create or replace function public.admin_mover_produto_categoria(
  p_produto_id bigint,
  p_direcao integer
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_categoria text;
  v_ordem integer;
  v_posicao bigint;
  v_vizinho_id bigint;
  v_vizinho_ordem integer;
begin
  if p_direcao not in (-1, 1) then
    raise exception 'Direcao invalida.';
  end if;

  select categoria, ordem_categoria
    into v_categoria, v_ordem
  from public.estoque
  where id = p_produto_id
  for update;

  if not found then
    raise exception 'Produto nao encontrado.';
  end if;

  select posicao
    into v_posicao
  from (
    select
      id,
      row_number() over (order by ordem_categoria, lower(nome), nome, id) as posicao
    from public.estoque
    where lower(trim(coalesce(categoria, ''))) = lower(trim(coalesce(v_categoria, '')))
  ) as itens
  where id = p_produto_id;

  select id, ordem_categoria
    into v_vizinho_id, v_vizinho_ordem
  from (
    select
      id,
      ordem_categoria,
      row_number() over (order by ordem_categoria, lower(nome), nome, id) as posicao
    from public.estoque
    where lower(trim(coalesce(categoria, ''))) = lower(trim(coalesce(v_categoria, '')))
  ) as itens
  where posicao = v_posicao + p_direcao;

  if v_vizinho_id is null then
    return;
  end if;

  update public.estoque
  set ordem_categoria = case
    when id = p_produto_id then v_vizinho_ordem
    when id = v_vizinho_id then v_ordem
  end
  where id in (p_produto_id, v_vizinho_id);
end;
$$;

revoke all on function public.admin_mover_produto_categoria(bigint, integer) from public;
revoke all on function public.admin_mover_produto_categoria(bigint, integer) from anon;
revoke all on function public.admin_mover_produto_categoria(bigint, integer) from authenticated;
grant execute on function public.admin_mover_produto_categoria(bigint, integer) to service_role;

commit;
