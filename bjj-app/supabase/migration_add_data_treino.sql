-- Migração: um treino por dia por usuário (execute no SQL Editor se já existir registro_treino sem data_treino)

alter table public.registro_treino add column if not exists data_treino date;

update public.registro_treino
set data_treino = (created_at at time zone 'America/Sao_Paulo')::date
where data_treino is null;

-- Mantém o registro mais recente por (user_id, data_treino)
with ranked as (
  select
    id,
    row_number() over (partition by user_id, data_treino order by created_at desc) as rn
  from public.registro_treino
  where data_treino is not null
)
delete from public.registro_treino r
using ranked x
where r.id = x.id and x.rn > 1;

alter table public.registro_treino alter column data_treino set not null;

create unique index if not exists registro_treino_user_data_unique
  on public.registro_treino (user_id, data_treino);
