-- Mantém encomendas canceladas por 15 dias e remove somente as expiradas.
-- Execute no SQL Editor do Supabase antes de publicar o código correspondente.

begin;

alter table public.pedidos
  add column if not exists cancelado_em timestamptz;

-- Cancelados existentes começam uma nova janela conservadora de 15 dias quando
-- não possuem uma data de cancelamento válida registrada no JSON legado.
update public.pedidos
set cancelado_em = case
  when nullif(detalhes_encomenda #>> '{cancelamento,cancelado_em}', '')
    ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}'
    then (detalhes_encomenda #>> '{cancelamento,cancelado_em}')::timestamptz
  else now()
end
where tipo_pedido = 'encomenda'
  and lower(coalesce(status_producao, '')) = 'cancelada'
  and cancelado_em is null;

create index if not exists idx_pedidos_cancelados_retencao
  on public.pedidos(cancelado_em)
  where tipo_pedido = 'encomenda'
    and status_producao = 'cancelada';

create or replace function public.manter_data_cancelamento_encomenda()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.tipo_pedido = 'encomenda' and lower(coalesce(new.status_producao, '')) = 'cancelada' then
    if tg_op = 'INSERT'
      or lower(coalesce(old.status_producao, '')) <> 'cancelada'
      or new.cancelado_em is null then
      new.cancelado_em := coalesce(new.cancelado_em, now());
    end if;
  elsif new.cancelado_em is not null then
    new.cancelado_em := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_manter_data_cancelamento_encomenda on public.pedidos;
create trigger trg_manter_data_cancelamento_encomenda
before insert or update of tipo_pedido, status_producao, cancelado_em
on public.pedidos
for each row execute function public.manter_data_cancelamento_encomenda();

create or replace function public.admin_cleanup_cancelled_preorders(
  retention_days integer default 15
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  removed_ids bigint[];
  removed_count integer;
  safe_retention_days integer := greatest(coalesce(retention_days, 15), 1);
begin
  with removed as (
    delete from public.pedidos
    where tipo_pedido = 'encomenda'
      and lower(coalesce(status_producao, '')) = 'cancelada'
      and cancelado_em is not null
      and cancelado_em < now() - make_interval(days => safe_retention_days)
    returning id
  )
  select coalesce(array_agg(id), '{}'::bigint[]), count(*)::integer
    into removed_ids, removed_count
    from removed;

  if removed_count > 0 and to_regclass('public.admin_audit_logs') is not null then
    execute
      'insert into public.admin_audit_logs (actor, action, details) values ($1, $2, $3)'
      using
        'system',
        'cleanup_cancelled_preorders',
        jsonb_build_object(
          'retention_days', safe_retention_days,
          'removed_count', removed_count,
          'order_ids', to_jsonb(removed_ids)
        );
  end if;

  return jsonb_build_object(
    'retention_days', safe_retention_days,
    'removed_count', removed_count
  );
end;
$$;

revoke all on function public.admin_cleanup_cancelled_preorders(integer) from public, anon, authenticated;
grant execute on function public.admin_cleanup_cancelled_preorders(integer) to service_role;

commit;
