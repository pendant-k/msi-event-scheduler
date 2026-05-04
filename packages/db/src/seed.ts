import { createDatabase, initializeDatabase } from "./client";
import { eventAdmins, eventDays, events, participantAccesses, participants, reservations, timeslots } from "./schema";
import { sql } from "drizzle-orm";

const now = () => new Date().toISOString();
const demoPasswordHash = "$2b$10$PE9h7UffDCh0AbaXsGGfZOeAgAH3yk.vRT.2F/s2pcR4ulVhQ3Qe2";

const eventId = "msi-2026";
const eventDayId = "msi-2026-day-1";

function toIso(value: string) {
  return new Date(value).toISOString();
}

async function main() {
  const { db, client } = createDatabase();
  await initializeDatabase();
  const executeRaw = async (statement: string) => {
    const database = db as typeof db & {
      execute?: (query: ReturnType<typeof sql.raw>) => Promise<unknown>;
      run?: (query: string) => Promise<unknown>;
    };
    if (typeof database.run === "function") {
      await database.run(statement);
      return;
    }
    if (typeof database.execute !== "function") {
      throw new Error("Database driver does not support raw SQL execution.");
    }
    await database.execute(sql.raw(statement));
  };

  const timestamp = now();

  await db
    .insert(events)
    .values({
      id: eventId,
      name: "2026 어린이날 미니카 대회",
      description: "어린이날 한정 미니카 타임어택, 튜닝 체험, 결승 레이스 예약",
      timezone: "Asia/Seoul",
      status: "PUBLISHED",
      reservationCloseAfterMinutes: 20,
      allowLateReservation: true,
      allowMultipleBooking: false,
      allowParticipantCancellation: true,
      participantCancelUntilMinutesBeforeStart: 0,
      enableTournament: true,
      tournamentCapacity: 48,
      minGuardianRequiredGrade: 1,
      maxGuardianRequiredGrade: 4,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .onConflictDoUpdate({
      target: events.id,
      set: {
        name: "2026 어린이날 미니카 대회",
        description: "어린이날 한정 미니카 타임어택, 튜닝 체험, 결승 레이스 예약",
        status: "PUBLISHED",
        tournamentCapacity: 48,
        updatedAt: timestamp
      }
    });

  await db
    .insert(eventDays)
    .values({
      id: eventDayId,
      eventId,
      eventDate: "2026-05-05",
      label: "어린이날 본선",
      startsAt: toIso("2026-05-05T09:30:00+09:00"),
      endsAt: toIso("2026-05-05T17:00:00+09:00"),
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .onConflictDoUpdate({
      target: eventDays.id,
      set: {
        eventDate: "2026-05-05",
        label: "어린이날 본선",
        startsAt: toIso("2026-05-05T09:30:00+09:00"),
        endsAt: toIso("2026-05-05T17:00:00+09:00"),
        updatedAt: timestamp
      }
    });

  await db
    .insert(eventAdmins)
    .values({
      id: "seed-admin-msi-2026",
      eventId,
      adminUserId: "local-super-admin",
      role: "OWNER",
      createdAt: timestamp
    })
    .onConflictDoNothing();

  const slotSeeds = [
    { title: "오전 타임어택", start: "2026-05-05T09:30:00+09:00", end: "2026-05-05T11:00:00+09:00", capacity: 12, status: "OPEN" },
    { title: "튜닝 체험 A", start: "2026-05-05T11:00:00+09:00", end: "2026-05-05T12:00:00+09:00", capacity: 16, status: "OPEN" },
    { title: "오후 타임어택", start: "2026-05-05T13:00:00+09:00", end: "2026-05-05T14:00:00+09:00", capacity: 16, status: "OPEN" },
    { title: "튜닝 체험 B", start: "2026-05-05T14:00:00+09:00", end: "2026-05-05T15:00:00+09:00", capacity: 16, status: "OPEN" },
    { title: "결승 레이스", start: "2026-05-05T15:00:00+09:00", end: "2026-05-05T16:00:00+09:00", capacity: 16, status: "OPEN" },
    { title: "운영 리허설", start: "2026-05-05T10:00:00+09:00", end: "2026-05-05T11:00:00+09:00", capacity: 16, status: "HIDDEN" },
    { title: "점심 정비", start: "2026-05-05T12:00:00+09:00", end: "2026-05-05T13:00:00+09:00", capacity: 16, status: "HIDDEN" },
    { title: "마감 정리", start: "2026-05-05T16:00:00+09:00", end: "2026-05-05T17:00:00+09:00", capacity: 16, status: "CLOSED" }
  ] as const;
  for (const [index, slotSeed] of slotSeeds.entries()) {
    const startDate = new Date(slotSeed.start);
    const endDate = new Date(slotSeed.end);
    await db
      .insert(timeslots)
      .values({
        id: `msi-2026-slot-${index + 1}`,
        eventId,
        eventDayId,
        title: slotSeed.title,
        startsAt: startDate.toISOString(),
        endsAt: endDate.toISOString(),
        capacity: slotSeed.capacity,
        reservedCount: 0,
        status: slotSeed.status,
        createdAt: timestamp,
        updatedAt: timestamp
      })
      .onConflictDoUpdate({
        target: timeslots.id,
        set: {
          eventDayId,
          title: slotSeed.title,
          startsAt: startDate.toISOString(),
          endsAt: endDate.toISOString(),
          capacity: slotSeed.capacity,
          status: slotSeed.status,
          updatedAt: timestamp
        }
      });
  }

  const accessRows = [
    { id: "seed-access-minicar-1", phoneNumber: "01012345678" },
    { id: "seed-access-minicar-2", phoneNumber: "01022223333" },
    { id: "seed-access-minicar-3", phoneNumber: "01077778888" },
    { id: "seed-access-minicar-4", phoneNumber: "01099990000" }
  ];
  for (const access of accessRows) {
    await db
      .insert(participantAccesses)
      .values({
        id: access.id,
        eventId,
        phoneNumber: access.phoneNumber,
        phoneLast4: access.phoneNumber.slice(-4),
        passwordHash: demoPasswordHash,
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: null,
        createdAt: timestamp,
        updatedAt: timestamp
      })
      .onConflictDoUpdate({
        target: participantAccesses.id,
        set: {
          phoneNumber: access.phoneNumber,
          phoneLast4: access.phoneNumber.slice(-4),
          passwordHash: demoPasswordHash,
          updatedAt: timestamp
        }
      });
  }

  const participantRows = [
    { id: "seed-participant-minicar-1", accessId: "seed-access-minicar-1", name: "김도윤", school: "새싹초", grade: 3 },
    { id: "seed-participant-minicar-2", accessId: "seed-access-minicar-2", name: "이지아", school: "하늘초", grade: 5 },
    { id: "seed-participant-minicar-3", accessId: "seed-access-minicar-3", name: "박민준", school: "은하초", grade: 4 },
    { id: "seed-participant-minicar-4", accessId: "seed-access-minicar-4", name: "최서연", school: "바다초", grade: 6 }
  ];
  for (const participant of participantRows) {
    await db
      .insert(participants)
      .values({
        ...participant,
        eventId,
        guardianRequired: participant.grade <= 4,
        createdAt: timestamp,
        updatedAt: timestamp
      })
      .onConflictDoUpdate({
        target: participants.id,
        set: {
          name: participant.name,
          school: participant.school,
          grade: participant.grade,
          guardianRequired: participant.grade <= 4,
          updatedAt: timestamp
        }
      });
  }

  const reservationRows = [
    {
      id: "seed-reservation-minicar-1",
      timeslotId: "msi-2026-slot-1",
      accessId: "seed-access-minicar-1",
      participantId: "seed-participant-minicar-1",
      status: "RESERVED" as const,
      tournament: true,
      reservationCode: "CAR05001",
      checkInCode: "CKCAR05001",
      checkedInAt: null,
      cancelledAt: null,
      cancelledBy: null,
      cancellationReason: null
    },
    {
      id: "seed-reservation-minicar-2",
      timeslotId: "msi-2026-slot-2",
      accessId: "seed-access-minicar-2",
      participantId: "seed-participant-minicar-2",
      status: "CHECKED_IN" as const,
      tournament: true,
      reservationCode: "CAR05002",
      checkInCode: "CKCAR05002",
      checkedInAt: timestamp,
      cancelledAt: null,
      cancelledBy: null,
      cancellationReason: null
    },
    {
      id: "seed-reservation-minicar-3",
      timeslotId: "msi-2026-slot-3",
      accessId: "seed-access-minicar-3",
      participantId: "seed-participant-minicar-3",
      status: "NO_SHOW" as const,
      tournament: false,
      reservationCode: "CAR05003",
      checkInCode: "CKCAR05003",
      checkedInAt: null,
      cancelledAt: null,
      cancelledBy: null,
      cancellationReason: null
    },
    {
      id: "seed-reservation-minicar-4",
      timeslotId: "msi-2026-slot-4",
      accessId: "seed-access-minicar-4",
      participantId: "seed-participant-minicar-4",
      status: "CANCELLED" as const,
      tournament: false,
      reservationCode: "CAR05004",
      checkInCode: "CKCAR05004",
      checkedInAt: null,
      cancelledAt: timestamp,
      cancelledBy: "PARTICIPANT" as const,
      cancellationReason: "participant_self_cancel"
    }
  ];
  for (const reservation of reservationRows) {
    await db
      .insert(reservations)
      .values({
        ...reservation,
        eventId,
        duplicateKey: null,
        isOverbooked: false,
        createdAt: timestamp,
        updatedAt: timestamp
      })
      .onConflictDoUpdate({
        target: reservations.id,
        set: {
          timeslotId: reservation.timeslotId,
          accessId: reservation.accessId,
          participantId: reservation.participantId,
          status: reservation.status,
          tournament: reservation.tournament,
          checkedInAt: reservation.checkedInAt,
          cancelledAt: reservation.cancelledAt,
          cancelledBy: reservation.cancelledBy,
          cancellationReason: reservation.cancellationReason,
          updatedAt: timestamp
        }
      });
  }

  await executeRaw(`
    update timeslots
    set reserved_count = (
      select count(*)
      from reservations
      where reservations.timeslot_id = timeslots.id
        and reservations.status in ('RESERVED', 'LATE_RESERVED', 'CHECKED_IN', 'NO_SHOW')
    )
    where event_id = '${eventId}';
  `);

  await client.close();
  console.log("Seed complete. Event URL: /event/msi-2026");
  console.log("Demo participant password: minicar");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
