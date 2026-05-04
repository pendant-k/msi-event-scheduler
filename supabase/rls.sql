alter table events enable row level security;
alter table event_days enable row level security;
alter table event_admins enable row level security;
alter table timeslots enable row level security;
alter table reservations enable row level security;
alter table participants enable row level security;
alter table participant_accesses enable row level security;
alter table participant_sessions enable row level security;
alter table tournament_checkins enable row level security;
alter table tournaments enable row level security;
alter table tournament_entrants enable row level security;
alter table tournament_matches enable row level security;
alter table admin_logs enable row level security;

create policy "public can read published events"
on events for select
using (status = 'PUBLISHED');

create policy "public can read published event days"
on event_days for select
using (exists (select 1 from events e where e.id = event_days.event_id and e.status = 'PUBLISHED'));

create policy "public can read visible timeslots"
on timeslots for select
using (
  status <> 'HIDDEN'
  and exists (select 1 from events e where e.id = timeslots.event_id and e.status = 'PUBLISHED')
);

create policy "admins can read assigned event data"
on event_admins for select
using (admin_user_id = auth.uid()::text);

-- Participant access, reservation mutation, and CSV export are intentionally
-- server-side only. Use service role RPC/server actions for those flows.
