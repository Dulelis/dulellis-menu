alter table if exists public.pedidos
  add column if not exists status_pedido text;

update public.pedidos
set status_pedido = case
  when coalesce(status_pedido, '') <> '' then status_pedido
  when lower(coalesce(status_pagamento, '')) in ('approved', 'paid', 'authorized', 'pago') then 'recebido'
  else 'aguardando_aceite'
end
where coalesce(status_pedido, '') = '';

create index if not exists idx_pedidos_status_pedido on public.pedidos(status_pedido);
