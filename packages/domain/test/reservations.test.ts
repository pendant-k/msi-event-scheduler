import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabase, eventDays, events, initializeDatabase, timeslots, type SchedulerDb } from "@scheduler/db";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
let tempDir: string;

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

async function access(phoneNumber = "01012345678") {
  return createOrLoginParticipantAccess(db, {
    eventId: "event-test",
    phoneNumber,
    password: "1234"
  });
}

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "scheduler-domain-"));
  const created = createDatabase(`file:${join(tempDir, "test.db")}`);
  db = created.db;
  client = created.client;
  await initializeDatabase(db);
  await seedBase();
});

afterEach(async () => {
  await client.close();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("reservation domain", () => {
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

    const slot = await db.query.timeslots.findFirst();
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
});
