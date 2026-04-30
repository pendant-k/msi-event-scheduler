-- Reservation mutation RPC placeholder.
-- The local prototype implements equivalent behavior in packages/domain.
-- Production should move create/cancel/check-in transactions here or call
-- server-side code with service role credentials.

create or replace function create_reservation_transaction()
returns void
language plpgsql
security definer
as $$
begin
  raise exception 'Implement production RPC from packages/domain reservation service behavior';
end;
$$;
