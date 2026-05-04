import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabase, eventAdmins, eventDays, events, initializeDatabase, timeslots, type SchedulerDb } from "@scheduler/db";
import { eq, sql } from "drizzle-orm";
import { updateTimeslotSettings } from "../src/events";
import { createOrLoginParticipantAccess } from "../src/participantAccess";
import {
  cancelReservation,
  createReservation,
  listReservationsForAccess,
  searchCheckInRows
} from "../src/reservations";
import { DomainError } from "../src/errors";

let db: SchedulerDb;
let client: ReturnType<typeof createDatabase>["client"];

const describeWithDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

async function cleanupBase() {
  await db.execute(sql`delete from events where id = 'event-test'`);
}

async function seedBase() {
  const timestamp = new Date().toISOString();
  await db.insert(events).values({
    id: "event-test",
    name: "Test Event",
    description: "Test",
    timezone: "Asia/Seoul",
    status: "PUBLISHED",
    reservationCloseAfterMinutes: 20,
    allowLateReservation: true,
    allowMultipleBooking: false,
    allowParticipantCancellation: true,
    participantCancelUntilMinutesBeforeStart: 0,
    enableTournament: true,
    tournamentCapacity: 1,
    minGuardianRequiredGrade: 1,
    maxGuardianRequiredGrade: 4,
    createdAt: timestamp,
    updatedAt: timestamp
  });
  await db.insert(eventAdmins).values({
    id: "event-admin-test",
    eventId: "event-test",
    adminUserId: "admin-test",
    role: "OWNER",
    createdAt: timestamp
  });
  await db.insert(eventDays).values({
    id: "day-test",
    eventId: "event-test",
    eventDate: "2099-01-01",
    label: "Day 1",
    startsAt: "2099-01-01T00:00:00.000Z",
    endsAt: "2099-01-01T09:00:00.000Z",
    createdAt: timestamp,
    updatedAt: timestamp
  });
  await db.insert(timeslots).values({
    id: "slot-test",
    eventId: "event-test",
    eventDayId: "day-test",
    startsAt: "2099-01-01T01:00:00.000Z",
    endsAt: "2099-01-01T01:30:00.000Z",
    capacity: 2,
    reservedCount: 0,
    status: "OPEN",
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

async function access(phoneNumber = "01012345678", targetDb = db) {
  return createOrLoginParticipantAccess(targetDb, {
    eventId: "event-test",
    phoneNumber,
    password: "1234"
  });
}

beforeEach(async () => {
  const created = createDatabase(process.env.TEST_DATABASE_URL);
  db = created.db;
  client = created.client;
  await initializeDatabase();
  await cleanupBase();
  await seedBase();
});

afterEach(async () => {
  await cleanupBase();
  await client.close();
});

describeWithDb("reservation domain", () => {
  it("blocks active duplicate reservations for the same participant identity", async () => {
    const session = await access();
    await createReservation(db, {
      eventId: "event-test",
      accessId: session.accessId,
      timeslotId: "slot-test",
      name: "홍길동",
      school: "OO초",
      grade: 4,
      guardianConfirmed: true,
      tournament: false
    });

    await expect(
      createReservation(db, {
        eventId: "event-test",
        accessId: session.accessId,
        timeslotId: "slot-test",
        name: "홍길동",
        school: "OO초",
        grade: 4,
        guardianConfirmed: true,
        tournament: false
      })
    ).rejects.toMatchObject({ code: "duplicate_reservation" } satisfies Partial<DomainError>);
  });

  it("allows siblings under the same phone number", async () => {
    const session = await access();
    await createReservation(db, {
      eventId: "event-test",
      accessId: session.accessId,
      timeslotId: "slot-test",
      name: "홍길동",
      school: "OO초",
      grade: 4,
      guardianConfirmed: true,
      tournament: false
    });
    await createReservation(db, {
      eventId: "event-test",
      accessId: session.accessId,
      timeslotId: "slot-test",
      name: "홍길순",
      school: "OO초",
      grade: 2,
      guardianConfirmed: true,
      tournament: false
    });

    const rows = await listReservationsForAccess(db, "event-test", session.accessId);
    expect(rows).toHaveLength(2);
  });

  it("restores reserved count when a participant cancels", async () => {
    const session = await access();
    const reservation = await createReservation(db, {
      eventId: "event-test",
      accessId: session.accessId,
      timeslotId: "slot-test",
      name: "홍길동",
      school: "OO초",
      grade: 4,
      guardianConfirmed: true,
      tournament: false
    });

    await cancelReservation(db, {
      eventId: "event-test",
      reservationId: reservation.id,
      actor: { type: "participant", accessId: session.accessId }
    });

    const slot = await db.query.timeslots.findFirst({ where: eq(timeslots.id, "slot-test") });
    expect(slot?.reservedCount).toBe(0);
  });

  it("supports check-in search by phone last four digits", async () => {
    const session = await access("01099991234");
    await createReservation(db, {
      eventId: "event-test",
      accessId: session.accessId,
      timeslotId: "slot-test",
      name: "김민준",
      school: "샘플초",
      grade: 5,
      guardianConfirmed: false,
      tournament: false
    });

    const rows = await searchCheckInRows(db, { eventId: "event-test", query: "1234" });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.maskedPhone).toBe("****1234");
  });

  it("prevents concurrent reservations from exceeding slot capacity", async () => {
    await db.update(timeslots).set({ capacity: 1 }).where(eq(timeslots.id, "slot-test"));
    const second = createDatabase(process.env.TEST_DATABASE_URL);
    try {
      const [sessionA, sessionB] = await Promise.all([access("01011110001", db), access("01011110002", second.db)]);
      const results = await Promise.allSettled([
        createReservation(db, {
          eventId: "event-test",
          accessId: sessionA.accessId,
          timeslotId: "slot-test",
          name: "예약자A",
          school: "동시초",
          grade: 5,
          guardianConfirmed: false,
          tournament: false
        }),
        createReservation(second.db, {
          eventId: "event-test",
          accessId: sessionB.accessId,
          timeslotId: "slot-test",
          name: "예약자B",
          school: "동시초",
          grade: 5,
          guardianConfirmed: false,
          tournament: false
        })
      ]);

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
      const rejected = results.find((result) => result.status === "rejected");
      expect(rejected).toMatchObject({ reason: { code: "capacity_full" } });
      const slot = await db.query.timeslots.findFirst({ where: eq(timeslots.id, "slot-test") });
      expect(slot?.reservedCount).toBe(1);
      expect(slot?.reservedCount).toBeLessThanOrEqual(slot?.capacity ?? 0);
    } finally {
      await second.client.close();
    }
  });

  it("keeps timeslot capacity valid when reservation and capacity update race", async () => {
    const second = createDatabase(process.env.TEST_DATABASE_URL);
    try {
      const session = await access("01022220001", second.db);
      const results = await Promise.allSettled([
        updateTimeslotSettings(db, {
          adminUserId: "admin-test",
          eventId: "event-test",
          timeslotId: "slot-test",
          capacity: 0,
          status: "OPEN"
        }),
        createReservation(second.db, {
          eventId: "event-test",
          accessId: session.accessId,
          timeslotId: "slot-test",
          name: "정원경합",
          school: "동시초",
          grade: 5,
          guardianConfirmed: false,
          tournament: false
        })
      ]);

      expect(results.some((result) => result.status === "fulfilled")).toBe(true);
      const slot = await db.query.timeslots.findFirst({ where: eq(timeslots.id, "slot-test") });
      expect(slot?.reservedCount ?? 0).toBeLessThanOrEqual(slot?.capacity ?? 0);
    } finally {
      await second.client.close();
    }
  });

  it("prevents concurrent tournament reservations from exceeding tournament capacity", async () => {
    const second = createDatabase(process.env.TEST_DATABASE_URL);
    try {
      const [sessionA, sessionB] = await Promise.all([access("01033330001", db), access("01033330002", second.db)]);
      const results = await Promise.allSettled([
        createReservation(db, {
          eventId: "event-test",
          accessId: sessionA.accessId,
          timeslotId: "slot-test",
          name: "대회A",
          school: "동시초",
          grade: 5,
          guardianConfirmed: false,
          tournament: true
        }),
        createReservation(second.db, {
          eventId: "event-test",
          accessId: sessionB.accessId,
          timeslotId: "slot-test",
          name: "대회B",
          school: "동시초",
          grade: 5,
          guardianConfirmed: false,
          tournament: true
        })
      ]);

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
      const rejected = results.find((result) => result.status === "rejected");
      expect(rejected).toMatchObject({ reason: { code: "tournament_full" } });
      const rows = await searchCheckInRows(db, { eventId: "event-test" });
      expect(rows.filter((row) => row.tournament)).toHaveLength(1);
    } finally {
      await second.client.close();
    }
  });
});
