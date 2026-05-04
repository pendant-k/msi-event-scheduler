# Vercel + Supabase Deployment

This app uses Supabase Postgres for local development and production. `DATABASE_URL` must be a `postgres://` or `postgresql://` connection string.

## Supabase

1. Create a Supabase project.
2. In Supabase SQL Editor, run `supabase/schema.sql`.
3. Copy the Postgres transaction pooler connection string.
4. Use that value as `DATABASE_URL` in Vercel.

Use the transaction pooler connection string for Vercel/serverless deployments. The app uses the `postgres` driver with prepared statements disabled.

Required production values:

```text
DATABASE_URL=postgresql://...
PARTICIPANT_SESSION_SECRET=...
ADMIN_ID=...
ADMIN_PASSWORD=...
NEXT_PUBLIC_APP_URL=https://your-vercel-domain.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Vercel

Set the Vercel project Root Directory to `apps/web`. The app-level `vercel.json` runs the workspace install and filtered web build from the repository root.

CLI flow:

```bash
cd apps/web
vercel link
vercel env add DATABASE_URL production
vercel env add PARTICIPANT_SESSION_SECRET production
vercel env add ADMIN_ID production
vercel env add ADMIN_PASSWORD production
vercel env add NEXT_PUBLIC_APP_URL production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel --prod
```

Do not commit `.env`, `.env.local`, `.vercel`, Supabase service role keys, or database passwords.
