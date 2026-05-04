import { getDatabase } from "@scheduler/db";

export async function getAppDb() {
  const database = getDatabase();
  return database.db;
}
