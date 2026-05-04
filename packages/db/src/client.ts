import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { createRequire } from "node:module";
import * as schema from "./schema";

export type SchedulerDb = PostgresJsDatabase<typeof schema>;
type DatabaseHandle = { close: () => Promise<void> | void };

let singleton: { client: DatabaseHandle; db: SchedulerDb; dialect: "postgres" } | undefined;

function databaseUrl(): string {
  const explicit = process.env.DATABASE_URL;
  if (!explicit) {
    throw new Error("DATABASE_URL is required. Configure the Supabase Postgres transaction pooler URL.");
  }
  if (!explicit.startsWith("postgres://") && !explicit.startsWith("postgresql://")) {
    throw new Error("DATABASE_URL must be a Postgres connection string.");
  }
  return explicit;
}

export function createDatabase(url = databaseUrl()) {
  if (!url.startsWith("postgres://") && !url.startsWith("postgresql://")) {
    throw new Error("createDatabase only supports Postgres connection strings.");
  }

  const require = createRequire(import.meta.url);
  const postgres = require("postgres") as typeof import("postgres");
  const { drizzle } = require("drizzle-orm/postgres-js") as typeof import("drizzle-orm/postgres-js");
  const queryClient = postgres(url, {
    max: 1,
    prepare: false
  });
  const db = drizzle(queryClient, { schema });
  const client = {
    close: () => queryClient.end()
  };
  return { client, db, dialect: "postgres" as const };
}

export function getDatabase() {
  singleton ??= createDatabase();
  return singleton;
}

export async function initializeDatabase() {
  // Supabase schema is managed by migrations. Runtime DDL is intentionally disabled.
}
