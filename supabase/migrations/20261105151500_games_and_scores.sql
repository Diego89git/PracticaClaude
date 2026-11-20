-- SPEC 06: tablas games y scores con RLS y la fila inicial de ASTEROIDES.

create table public.games (
  id         text primary key,
  title      text not null,
  short      text not null,
  long       text not null,
  cat        text not null check (cat in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  cover      text not null,
  color      text not null check (color in ('cyan', 'magenta', 'yellow', 'green')),
  created_at timestamptz not null default now()
);

create table public.scores (
  id          uuid primary key default gen_random_uuid(),
  game_id     text not null references public.games (id),
  player_name text not null check (char_length(player_name) between 1 and 10),
  score       integer not null check (score >= 0),
  user_id     uuid,
  created_at  timestamptz not null default now()
);

create index scores_game_score_idx on public.scores (game_id, score desc);

alter table public.games enable row level security;
alter table public.scores enable row level security;

create policy "games_select_public" on public.games
  for select using (true);

create policy "scores_select_public" on public.scores
  for select using (true);

-- Mientras no exista Auth, solo se aceptan puntuaciones anónimas.
create policy "scores_insert_public" on public.scores
  for insert with check (user_id is null);

-- Sin políticas de UPDATE ni DELETE: quedan denegados.

insert into public.games (id, title, short, long, cat, cover, color) values (
  'asteroides',
  'ASTEROIDES',
  'Pulveriza rocas en gravedad cero.',
  'Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Supera niveles y acumula puntos antes de que los asteroides te alcancen.',
  'SHOOTER',
  'cover-asteroides',
  'cyan'
);
