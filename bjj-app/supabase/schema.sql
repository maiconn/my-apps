-- BJJ App — schema inicial (executar no SQL Editor do Supabase)
-- Ajuste RLS conforme sua política de auth.

create extension if not exists "pgcrypto";

-- Tipos de treino (globais com user_id null; novos do usuário com user_id)
create table if not exists public.tipo_treino (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  user_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists tipo_treino_global_nome
  on public.tipo_treino (lower(nome))
  where user_id is null;

create unique index if not exists tipo_treino_user_nome
  on public.tipo_treino (user_id, lower(nome))
  where user_id is not null;

-- Variação vinculada ao tipo
create table if not exists public.variacao (
  id uuid primary key default gen_random_uuid(),
  tipo_treino_id uuid not null references public.tipo_treino (id) on delete cascade,
  nome text not null,
  user_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists variacao_tipo_nome_global
  on public.variacao (tipo_treino_id, lower(nome))
  where user_id is null;

create unique index if not exists variacao_tipo_nome_user
  on public.variacao (tipo_treino_id, user_id, lower(nome))
  where user_id is not null;

-- Registro de treino (um por dia por usuário: data_treino)
create table if not exists public.registro_treino (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  data_treino date not null,
  tecnica_aprendida text,
  nivel_entendimento smallint not null check (nivel_entendimento between 1 and 5),
  duvidas text,
  nivel_energia smallint not null check (nivel_energia between 1 and 5),
  nivel_foco smallint not null check (nivel_foco between 1 and 5),
  created_at timestamptz not null default now()
);

create unique index if not exists registro_treino_user_data_unique
  on public.registro_treino (user_id, data_treino);

-- Múltiplos tipos + variação por registro
create table if not exists public.registro_treino_item (
  id uuid primary key default gen_random_uuid(),
  registro_treino_id uuid not null references public.registro_treino (id) on delete cascade,
  tipo_treino_id uuid not null references public.tipo_treino (id),
  variacao_id uuid not null references public.variacao (id),
  ordem smallint not null default 0
);

-- Catálogo de ações técnicas
create table if not exists public.acao_tecnica (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  user_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists acao_tecnica_global_nome
  on public.acao_tecnica (lower(nome))
  where user_id is null;

create unique index if not exists acao_tecnica_user_nome
  on public.acao_tecnica (user_id, lower(nome))
  where user_id is not null;

-- Sparring ligado ao registro
create table if not exists public.sparring (
  id uuid primary key default gen_random_uuid(),
  registro_treino_id uuid not null references public.registro_treino (id) on delete cascade,
  duracao_mm_ss text not null,
  duracao_segundos int not null check (duracao_segundos >= 0),
  nivel_sparring smallint not null check (nivel_sparring between 1 and 3),
  inicio text not null check (inicio in ('Guarda', 'Passagem')),
  observacoes text,
  ordem smallint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.sparring_acao (
  id uuid primary key default gen_random_uuid(),
  sparring_id uuid not null references public.sparring (id) on delete cascade,
  acao_tecnica_id uuid not null references public.acao_tecnica (id),
  falha int not null default 0 check (falha >= 0),
  parcial int not null default 0 check (parcial >= 0),
  sucesso int not null default 0 check (sucesso >= 0),
  ordem smallint not null default 0
);

-- Seeds: tipos de treino globais (idempotente)
insert into public.tipo_treino (nome, user_id)
select v.nome, null
from (values
  ('Guarda'),
  ('Passagem'),
  ('Escape'),
  ('Finalização'),
  ('Queda'),
  ('Raspagem')
) as v(nome)
where not exists (
  select 1 from public.tipo_treino t
  where t.user_id is null and lower(t.nome) = lower(v.nome)
);

-- RLS (habilite e adapte; exemplo mínimo)
alter table public.tipo_treino enable row level security;
alter table public.variacao enable row level security;
alter table public.registro_treino enable row level security;
alter table public.registro_treino_item enable row level security;
alter table public.acao_tecnica enable row level security;
alter table public.sparring enable row level security;
alter table public.sparring_acao enable row level security;

-- Políticas exemplo: usuário autenticado lê tipos globais + próprios; escreve só próprios
create policy "tipos leitura" on public.tipo_treino for select
  using (user_id is null or user_id = auth.uid());
create policy "tipos insert own" on public.tipo_treino for insert
  with check (user_id = auth.uid());

create policy "variacao select" on public.variacao for select
  using (
    user_id is null
    or user_id = auth.uid()
    or exists (
      select 1 from public.tipo_treino tt
      where tt.id = variacao.tipo_treino_id and (tt.user_id is null or tt.user_id = auth.uid())
    )
  );
create policy "variacao insert" on public.variacao for insert
  with check (user_id = auth.uid());

create policy "registro all own" on public.registro_treino for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "registro_item all" on public.registro_treino_item for all
  using (
    exists (select 1 from public.registro_treino r where r.id = registro_treino_item.registro_treino_id and r.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.registro_treino r where r.id = registro_treino_item.registro_treino_id and r.user_id = auth.uid())
  );

create policy "acao select" on public.acao_tecnica for select
  using (user_id is null or user_id = auth.uid());
create policy "acao insert" on public.acao_tecnica for insert
  with check (user_id = auth.uid());

create policy "sparring all" on public.sparring for all
  using (
    exists (select 1 from public.registro_treino r where r.id = sparring.registro_treino_id and r.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.registro_treino r where r.id = sparring.registro_treino_id and r.user_id = auth.uid())
  );

create policy "sparring_acao all" on public.sparring_acao for all
  using (
    exists (
      select 1 from public.sparring s
      join public.registro_treino r on r.id = s.registro_treino_id
      where s.id = sparring_acao.sparring_id and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.sparring s
      join public.registro_treino r on r.id = s.registro_treino_id
      where s.id = sparring_acao.sparring_id and r.user_id = auth.uid()
    )
  );
