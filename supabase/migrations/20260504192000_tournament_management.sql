create table if not exists tournament_checkins (
  id text primary key,
  event_id text not null references events(id) on delete cascade,
  reservation_id text not null references reservations(id) on delete cascade,
  checked_in_at timestamptz not null,
  checked_in_by text not null,
  cancelled_at timestamptz,
  cancelled_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reservation_id)
);

create table if not exists tournaments (
  id text primary key,
  event_id text not null references events(id) on delete cascade,
  status text not null check (status in ('DRAFT', 'STARTED', 'COMPLETED')),
  bracket_size integer not null check (bracket_size in (4, 8, 16, 32, 64)),
  include_third_place boolean not null default true,
  seeding_mode text not null check (seeding_mode in ('MANUAL', 'CHECK_IN_ORDER', 'RANDOM')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique (event_id)
);

create table if not exists tournament_entrants (
  id text primary key,
  tournament_id text not null references tournaments(id) on delete cascade,
  reservation_id text not null references reservations(id) on delete cascade,
  seed integer not null check (seed > 0),
  created_at timestamptz not null default now(),
  unique (tournament_id, seed),
  unique (tournament_id, reservation_id)
);

create table if not exists tournament_matches (
  id text primary key,
  tournament_id text not null references tournaments(id) on delete cascade,
  kind text not null check (kind in ('MAIN', 'THIRD_PLACE')),
  round integer not null check (round > 0),
  match_index integer not null check (match_index > 0),
  entrant_a_id text references tournament_entrants(id) on delete set null,
  entrant_b_id text references tournament_entrants(id) on delete set null,
  winner_entrant_id text references tournament_entrants(id) on delete set null,
  status text not null check (status in ('PENDING', 'READY', 'COMPLETED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, kind, round, match_index)
);

create index if not exists idx_tournament_checkins_event on tournament_checkins (event_id, cancelled_at);
create index if not exists idx_tournament_matches_tournament on tournament_matches (tournament_id, kind, round);

alter table tournament_checkins enable row level security;
alter table tournaments enable row level security;
alter table tournament_entrants enable row level security;
alter table tournament_matches enable row level security;
