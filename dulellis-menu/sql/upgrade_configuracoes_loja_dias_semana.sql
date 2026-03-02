-- Adiciona controle de dias da semana no horario de funcionamento
alter table public.configuracoes_loja
add column if not exists dias_semana text[] not null default array['domingo','segunda','terca','quarta','quinta','sexta','sabado'];

-- Garante valor para registros antigos
update public.configuracoes_loja
set dias_semana = array['domingo','segunda','terca','quarta','quinta','sexta','sabado']::text[]
where dias_semana is null or array_length(dias_semana, 1) is null;
