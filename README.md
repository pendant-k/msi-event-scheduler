# Scheduler MSI

Event booth reservation and check-in prototype based on the PRD in [`prd.md`](./prd.md).

## Stack

- `pnpm` workspace + Turborepo
- Next.js App Router in `apps/web`
- Drizzle ORM
- SQLite for local prototype
- Supabase Postgres/Auth as production target
- TanStack Table for admin tables

## Local Setup

```bash
pnpm install
pnpm db:seed
pnpm dev
```

Default local URLs:

- Participant: `http://localhost:3000/event/msi-2026`
- Schedule: `http://localhost:3000/event/msi-2026/schedule`
- Admin: `http://localhost:3000/admin`

Default local admin:

```text
admin@example.com
password
```

## Notes

- Participant access is event-scoped phone + password, not Supabase Auth.
- Participant sessions are stored in httpOnly cookies.
- Admin auth is mocked locally and isolated behind an adapter for Supabase Auth email/password.
- QR generation is not implemented in v1; the app provides event URLs only.
