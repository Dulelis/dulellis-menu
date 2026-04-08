alter table if exists public.clientes
  add column if not exists ponto_referencia text;

notify pgrst, 'reload schema';
