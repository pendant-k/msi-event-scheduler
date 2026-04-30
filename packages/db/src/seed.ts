import { eq } from "drizzle-orm";
import { createDatabase, initializeDatabase } from "./client";
import { eventAdmins, eventDays, events, timeslots } from "./schema";

const now = () => new Date().toISOString();

async function main() {
  const { db, client } = createDatabase();
  await initializeDatabase(db);

  const existing = await db.query.events.findFirst({ where: eq(events.id, "msi-2026") });
  const timestamp = now();
  if (!existing) {
    await db.insert(events).values({
      id: "msi-2026",
      name: "MSI Experience Booth",
      description: "현장 체험 부스 예약",
      timezone: "Asia/Seoul",
      status: "PUBLISHED",
      reservationCloseAfterMinutes: 20,
      allowLateReservation: true,
      allowMultipleBooking: false,
      allowParticipantCancellation: true,
      participantCancelUntilMinutesBeforeStart: 0,
      enableTournament: true,
      tournamentCapacity: 32,
      minGuardianRequiredGrade: 1,
      maxGuardianRequiredGrade: 4,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    await db.insert(eventDays).values({
      id: "msi-2026-day-1",
      eventId: "msi-2026",
      eventDate: "2026-05-01",
      label: "Day 1",
      startsAt: "2026-05-01T10:00:00+09:00",
      endsAt: "2026-05-01T17:00:00+09:00",
      createdAt: timestamp,
      updatedAt: timestamp
    });
    await db.insert(eventAdmins).values({
      id: "seed-admin-msi-2026",
      eventId: "msi-2026",
      adminUserId: "local-super-admin",
      role: "OWNER",
      createdAt: timestamp
    });
  }

  const existingDay = await db.query.eventDays.findFirst({ where: eq(eventDays.id, "msi-2026-day-1") });
  if (!existingDay) {
    await db.insert(eventDays).values({
      id: "msi-2026-day-1",
      eventId: "msi-2026",
      eventDate: "2026-05-01",
      label: "Day 1",
      startsAt: new Date("2026-05-01T10:00:00+09:00").toISOString(),
      endsAt: new Date("2026-05-01T17:00:00+09:00").toISOString(),
      createdAt: timestamp,
      updatedAt: timestamp
    });
  }

  const existingSlot = await db.query.timeslots.findFirst({ where: eq(timeslots.id, "msi-2026-slot-1") });
  if (!existingSlot) {
    const starts = [
      "2026-05-01T10:00:00+09:00",
      "2026-05-01T10:30:00+09:00",
      "2026-05-01T11:00:00+09:00",
      "2026-05-01T11:30:00+09:00",
      "2026-05-01T13:00:00+09:00",
      "2026-05-01T13:30:00+09:00",
      "2026-05-01T14:00:00+09:00",
      "2026-05-01T14:30:00+09:00"
    ];
    await db.insert(timeslots).values(
      starts.map((start, index) => {
        const startDate = new Date(start);
        const end = new Date(startDate.getTime() + 30 * 60 * 1000).toISOString();
        return {
          id: `msi-2026-slot-${index + 1}`,
          eventId: "msi-2026",
          eventDayId: "msi-2026-day-1",
          startsAt: startDate.toISOString(),
          endsAt: end,
          capacity: 20,
          reservedCount: 0,
          status: "OPEN" as const,
          createdAt: timestamp,
          updatedAt: timestamp
        };
      })
    );
  }

  await client.close();
  console.log("Seed complete. Event URL: /event/msi-2026");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
