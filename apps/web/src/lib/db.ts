import { getDatabase, initializeDatabase } from "@scheduler/db";

let initialized = false;

export async function getAppDb() {
  const database = getDatabase();
  if (!initialized && database.dialect === "sqlite") {
    await initializeDatabase(database.db);
    initialized = true;
  }
  return database.db;
}
