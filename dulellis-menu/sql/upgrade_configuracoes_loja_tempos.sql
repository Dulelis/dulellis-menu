-- Faixas de tempo exibidas ao cliente no delivery.
-- Execute este script no SQL Editor do Supabase antes de usar os controles no admin.
alter table public.configuracoes_loja
  add column if not exists tempo_preparo_min integer not null default 30,
  add column if not exists tempo_preparo_max integer not null default 45,
  add column if not exists tempo_entrega_min integer not null default 15,
  add column if not exists tempo_entrega_max integer not null default 30;

alter table public.configuracoes_loja
  drop constraint if exists configuracoes_loja_tempos_check;

alter table public.configuracoes_loja
  add constraint configuracoes_loja_tempos_check check (
    tempo_preparo_min between 0 and 1440
    and tempo_preparo_max between tempo_preparo_min and 1440
    and tempo_entrega_min between 0 and 1440
    and tempo_entrega_max between tempo_entrega_min and 1440
  );
