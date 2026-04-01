alter table if exists public.entregas
  add column if not exists rastreamento_token text,
  add column if not exists rastreamento_ativo boolean not null default false,
  add column if not exists latitude numeric(10,7),
  add column if not exists longitude numeric(10,7),
  add column if not exists precisao_metros numeric(10,2),
  add column if not exists velocidade_m_s numeric(10,2),
  add column if not exists direcao_graus numeric(10,2),
  add column if not exists localizacao_atualizada_em timestamptz;

create index if not exists idx_entregas_rastreamento_ativo on public.entregas(rastreamento_ativo);
create index if not exists idx_entregas_localizacao_atualizada_em on public.entregas(localizacao_atualizada_em desc);
