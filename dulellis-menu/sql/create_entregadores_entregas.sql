-- Cadastro de entregadores e controle operacional das entregas

create table if not exists public.entregadores (
  id bigserial primary key,
  nome text not null,
  whatsapp text,
  modelo_moto text,
  placa_moto text,
  cor_moto text,
  observacao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entregas (
  id bigserial primary key,
  pedido_id bigint not null,
  entregador_id bigint,
  status text not null default 'aceita',
  aceito_em timestamptz not null default now(),
  concluido_em timestamptz,
  acerto_status text not null default 'pendente',
  acerto_em timestamptz,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entregas_pedido_unique unique (pedido_id),
  constraint entregas_entregador_fk foreign key (entregador_id) references public.entregadores(id) on delete set null
);

create index if not exists idx_entregadores_ativo on public.entregadores(ativo);
create index if not exists idx_entregadores_nome on public.entregadores(nome);
create index if not exists idx_entregas_entregador_id on public.entregas(entregador_id);
create index if not exists idx_entregas_status on public.entregas(status);
create index if not exists idx_entregas_acerto_status on public.entregas(acerto_status);
create index if not exists idx_entregas_aceito_em on public.entregas(aceito_em desc);

create or replace function public.touch_updated_at_entregadores()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.touch_updated_at_entregas()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_updated_at_entregadores on public.entregadores;
create trigger trg_touch_updated_at_entregadores
before update on public.entregadores
for each row
execute function public.touch_updated_at_entregadores();

drop trigger if exists trg_touch_updated_at_entregas on public.entregas;
create trigger trg_touch_updated_at_entregas
before update on public.entregas
for each row
execute function public.touch_updated_at_entregas();

alter table if exists public.entregadores enable row level security;
alter table if exists public.entregas enable row level security;

revoke all on table public.entregadores from anon, authenticated;
revoke all on table public.entregas from anon, authenticated;
