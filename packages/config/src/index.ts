export const appConfig = {
  participantSessionCookieName: "scheduler_participant_session",
  participantSessionTtlHours: 24,
  privacyRetentionDays: 90,
  defaultTournamentCapacity: 32,
  defaultTimezone: "Asia/Seoul"
} as const;

export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
