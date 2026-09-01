-- Define a cidade atendida pela unidade exibida na vitrine.
-- Execute este script no SQL Editor do Supabase antes de usar o controle no admin.
alter table public.configuracoes_loja
add column if not exists cidade_atendida text not null default 'Navegantes';

update public.configuracoes_loja
set cidade_atendida = 'Navegantes'
where nullif(btrim(cidade_atendida), '') is null;

alter table public.configuracoes_loja
drop constraint if exists configuracoes_loja_cidade_atendida_check;

alter table public.configuracoes_loja
add constraint configuracoes_loja_cidade_atendida_check
check (char_length(btrim(cidade_atendida)) between 1 and 80);
