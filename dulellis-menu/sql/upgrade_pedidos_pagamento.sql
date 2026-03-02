-- Campos para vinculo e status de pagamento Mercado Pago
alter table if exists public.pedidos
  add column if not exists forma_pagamento text,
  add column if not exists pagamento_referencia text,
  add column if not exists pagamento_id text,
  add column if not exists status_pagamento text,
  add column if not exists pagamento_atualizado_em timestamptz;

create index if not exists idx_pedidos_pagamento_referencia on public.pedidos(pagamento_referencia);
create index if not exists idx_pedidos_pagamento_id on public.pedidos(pagamento_id);
create index if not exists idx_pedidos_status_pagamento on public.pedidos(status_pagamento);
