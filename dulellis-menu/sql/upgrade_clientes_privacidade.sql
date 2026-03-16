alter table if exists public.clientes
  add column if not exists politica_privacidade_aceita_em timestamptz,
  add column if not exists politica_privacidade_versao text;
