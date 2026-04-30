import type { Client } from "@libsql/client";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "./schema";

export type SchedulerDb = LibSQLDatabase<typeof schema>;

let singleton: { client: Client; db: SchedulerDb } | undefined;

function defaultDatabaseUrl(): string {
  const explicit = process.env.DATABASE_URL;
  if (explicit) return explicit;
  const packageSourceDir = dirname(fileURLToPath(import.meta.url));
  const filePath = join(packageSourceDir, "..", "..", "..", "data", "local.db");
  return `file:${filePath}`;
}

function ensureSqliteDirectory(url: string) {
  if (!url.startsWith("file:")) return;
  const rawPath = url.slice("file:".length);
  if (!rawPath || rawPath === ":memory:") return;
  const path = isAbsolute(rawPath) ? rawPath : join(process.cwd(), rawPath);
  mkdirSync(dirname(path), { recursive: true });
}

export function createDatabase(url = defaultDatabaseUrl()) {
  ensureSqliteDirectory(url);
  const require = createRequire(import.meta.url);
  const { createClient } = require("@libsql/client") as typeof import("@libsql/client");
  const { drizzle } = require("drizzle-orm/libsql") as typeof import("drizzle-orm/libsql");
  const client = createClient({ url });
  const db = drizzle(client, { schema });
  return { client, db };
}

export function getDatabase() {
  singleton ??= createDatabase();
  return singleton;
}

export async function initializeDatabase(db: SchedulerDb) {
  await db.run(`
    create table if not exists events (
      id text primary key,
      name text not null,
      description text,
      timezone text not null default 'Asia/Seoul',
      status text not null check (status in ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED')),
      reservation_close_after_minutes integer not null default 20,
      allow_late_reservation integer not null default 1,
      allow_multiple_booking integer not null default 0,
      allow_participant_cancellation integer not null default 1,
      participant_cancel_until_minutes_before_start integer not null default 0,
      enable_tournament integer not null default 1,
      tournament_capacity integer not null default 32,
      min_guardian_required_grade integer not null default 1,
      max_guardian_required_grade integer not null default 4,
      created_at text not null,
      updated_at text not null
    );
  `);
  await db.run(`
    create table if not exists event_days (
      id text primary key,
      event_id text not null references events(id) on delete cascade,
      event_date text not null,
      label text,
      starts_at text,
      ends_at text,
      created_at text not null,
      updated_at text not null,
      unique (event_id, event_date)
    );
  `);
  await db.run(`
    create table if not exists event_admins (
      id text primary key,
      event_id text not null references events(id) on delete cascade,
      admin_user_id text not null,
      role text not null check (role in ('OWNER', 'MANAGER', 'STAFF')),
      created_at text not null,
      unique (event_id, admin_user_id)
    );
  `);
  await db.run(`
    create table if not exists participant_accesses (
      id text primary key,
      event_id text not null references events(id) on delete cascade,
      phone_number text not null,
      phone_last4 text not null,
      password_hash text not null,
      failed_login_count integer not null default 0,
      locked_until text,
      last_login_at text,
      created_at text not null,
      updated_at text not null,
      unique (event_id, phone_number)
    );
  `);
  await db.run(`
    create table if not exists participant_sessions (
      id text primary key,
      event_id text not null references events(id) on delete cascade,
      access_id text not null references participant_accesses(id) on delete cascade,
      session_token_hash text not null unique,
      expires_at text not null,
      created_at text not null,
      last_seen_at text
    );
  `);
  await db.run(`
    create table if not exists participants (
      id text primary key,
      event_id text not null references events(id) on delete cascade,
      access_id text not null references participant_accesses(id) on delete cascade,
      name text not null,
      school text not null,
      grade integer not null,
      guardian_required integer not null,
      created_at text not null,
      updated_at text not null,
      unique (event_id, access_id, name, school, grade)
    );
  `);
  await db.run(`
    create table if not exists timeslots (
      id text primary key,
      event_id text not null references events(id) on delete cascade,
      event_day_id text not null references event_days(id) on delete cascade,
      starts_at text not null,
      ends_at text not null,
      capacity integer not null check (capacity >= 0),
      reserved_count integer not null default 0 check (reserved_count >= 0),
      status text not null check (status in ('OPEN', 'CLOSED', 'HIDDEN')),
      created_at text not null,
      updated_at text not null,
      check (ends_at > starts_at)
    );
  `);
  await db.run(`
    create table if not exists reservations (
      id text primary key,
      event_id text not null references events(id) on delete cascade,
      timeslot_id text not null references timeslots(id),
      access_id text not null references participant_accesses(id),
      participant_id text not null references participants(id),
      status text not null check (status in ('RESERVED', 'LATE_RESERVED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW')),
      tournament integer not null default 0,
      duplicate_key text,
      reservation_code text not null,
      check_in_code text not null,
      is_overbooked integer not null default 0,
      created_at text not null,
      updated_at text not null,
      checked_in_at text,
      cancelled_at text,
      cancelled_by text check (cancelled_by in ('PARTICIPANT', 'ADMIN')),
      cancellation_reason text,
      unique (event_id, reservation_code),
      unique (event_id, check_in_code)
    );
  `);
  await db.run(`
    create table if not exists admin_logs (
      id text primary key,
      event_id text not null references events(id) on delete cascade,
      admin_user_id text not null,
      action text not null,
      target_type text not null,
      target_id text,
      reason text,
      metadata text not null default '{}',
      created_at text not null
    );
  `);
  await db.run("create index if not exists idx_event_days_event_date on event_days (event_id, event_date);");
  await db.run("create index if not exists idx_timeslots_event_day_starts on timeslots (event_id, event_day_id, starts_at);");
  await db.run("create index if not exists idx_participant_accesses_event_phone_last4 on participant_accesses (event_id, phone_last4);");
  await db.run("create index if not exists idx_participant_sessions_access_expires on participant_sessions (access_id, expires_at);");
  await db.run("create index if not exists idx_participants_event_name on participants (event_id, name);");
  await db.run("create index if not exists idx_participants_event_school on participants (event_id, school);");
  await db.run("create index if not exists idx_reservations_event_timeslot_status on reservations (event_id, timeslot_id, status);");
  await db.run("create index if not exists idx_reservations_event_reservation_code on reservations (event_id, reservation_code);");
  await db.run(`
    create unique index if not exists idx_reservations_active_duplicate_key_unique
    on reservations (event_id, duplicate_key)
    where duplicate_key is not null and status in ('RESERVED', 'LATE_RESERVED', 'CHECKED_IN');
  `);
}
