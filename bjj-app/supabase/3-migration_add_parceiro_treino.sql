-- Migração: parceiro de treino por sparring + autocomplete por nome

create table if not exists public.parceiro_treino (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null,
  sexo text not null check (sexo in ('M', 'F')),
  aniversario date not null,
  faixa text not null check (faixa in ('branca', 'azul', 'marrom', 'preta')),
  peso_kg numeric(5,2) not null check (peso_kg > 0),
  created_at timestamptz not null default now()
);

create unique index if not exists parceiro_treino_user_nome_unique
  on public.parceiro_treino (user_id, lower(nome));

create index if not exists parceiro_treino_user_nome_prefix_idx
  on public.parceiro_treino (user_id, lower(nome));

alter table public.sparring
  add column if not exists parceiro_treino_id uuid references public.parceiro_treino (id);

alter table public.parceiro_treino enable row level security;

create policy "parceiro_treino select own" on public.parceiro_treino for select
  using (user_id = auth.uid());

create policy "parceiro_treino insert own" on public.parceiro_treino for insert
  with check (user_id = auth.uid());

create policy "parceiro_treino update own" on public.parceiro_treino for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "parceiro_treino delete own" on public.parceiro_treino for delete
  using (user_id = auth.uid());
