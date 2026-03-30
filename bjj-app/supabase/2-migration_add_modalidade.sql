-- Migração: Adicionando a coluna modalidade na tabela registro_treino
alter table public.registro_treino add column if not exists modalidade text;