-- Migração: adiciona faixa roxa para parceiro_treino

do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.parceiro_treino'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%faixa%'
  loop
    execute format('alter table public.parceiro_treino drop constraint %I', c.conname);
  end loop;
end;
$$;

alter table public.parceiro_treino
  add constraint parceiro_treino_faixa_check
  check (faixa in ('branca', 'azul', 'roxa', 'marrom', 'preta'));
