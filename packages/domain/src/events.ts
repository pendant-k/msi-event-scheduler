import { and, asc, eq } from "drizzle-orm";
import type { SchedulerDb } from "@scheduler/db";
import { eventAdmins, eventDays, events, timeslots } from "@scheduler/db";
import { assertEventAdmin } from "./admin";
import { DomainError } from "./errors";
import { id, nowIso } from "./utils";

export async function listPublishedEvents(db: SchedulerDb) {
  return db.query.events.findMany({
    where: eq(events.status, "PUBLISHED"),
    orderBy: asc(events.createdAt)
  });
}

export async function getEventBundle(db: SchedulerDb, eventId: string) {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return null;
  const days = await db.query.eventDays.findMany({
    where: eq(eventDays.eventId, eventId),
    orderBy: asc(eventDays.eventDate)
  });
  const slots = await db.query.timeslots.findMany({
    where: eq(timeslots.eventId, eventId),
    orderBy: asc(timeslots.startsAt)
  });
  return { event, days, timeslots: slots };
}

export async function getSchedule(db: SchedulerDb, eventId: string, eventDayId?: string) {
  const bundle = await getEventBundle(db, eventId);
  if (!bundle) return null;
  const selectedDay = eventDayId
    ? bundle.days.find((day) => day.id === eventDayId)
    : bundle.days[0];
  const slots = selectedDay
    ? await db.query.timeslots.findMany({
        where: and(eq(timeslots.eventId, eventId), eq(timeslots.eventDayId, selectedDay.id)),
        orderBy: asc(timeslots.startsAt)
      })
    : [];
  return { ...bundle, selectedDay, timeslots: slots };
}

function slugifyEventId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function parsePositiveInt(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export async function createManagedEvent(
  db: SchedulerDb,
  input: {
    adminUserId: string;
    eventId?: string;
    name: string;
    description?: string;
    eventDate: string;
    startsAt: string;
    endsAt: string;
    timeslotMinutes: number;
    capacity: number;
    tournamentCapacity?: number;
  }
) {
  const name = input.name.trim();
  const eventId = (input.eventId?.trim() || slugifyEventId(name) || id("event")).slice(0, 64);
  if (!name || !input.eventDate || !input.startsAt || !input.endsAt) {
    throw new DomainError("invalid_input", "행사 이름, 날짜, 시작/종료 시간이 필요합니다.");
  }
  const start = new Date(`${input.eventDate}T${input.startsAt}:00+09:00`);
  const end = new Date(`${input.eventDate}T${input.endsAt}:00+09:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    throw new DomainError("invalid_input", "행사 시간이 올바르지 않습니다.");
  }

  return db.transaction(async (tx) => {
    const existing = await tx.query.events.findFirst({ where: eq(events.id, eventId) });
    if (existing) throw new DomainError("duplicate_event", "이미 같은 ID의 행사가 있습니다.");

    const timestamp = nowIso();
    const eventDayId = id("day");
    await tx.insert(events).values({
      id: eventId,
      name,
      description: input.description?.trim() || null,
      timezone: "Asia/Seoul",
      status: "PUBLISHED",
      reservationCloseAfterMinutes: 20,
      allowLateReservation: true,
      allowMultipleBooking: false,
      allowParticipantCancellation: true,
      participantCancelUntilMinutesBeforeStart: 0,
      enableTournament: true,
      tournamentCapacity: parsePositiveInt(input.tournamentCapacity ?? 32, 32),
      minGuardianRequiredGrade: 1,
      maxGuardianRequiredGrade: 4,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    await tx.insert(eventAdmins).values({
      id: id("event_admin"),
      eventId,
      adminUserId: input.adminUserId,
      role: "OWNER",
      createdAt: timestamp
    });
    await tx.insert(eventDays).values({
      id: eventDayId,
      eventId,
      eventDate: input.eventDate,
      label: "Day 1",
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      createdAt: timestamp,
      updatedAt: timestamp
    });

    const minutes = parsePositiveInt(input.timeslotMinutes, 30);
    const capacity = parsePositiveInt(input.capacity, 20);
    const slotValues = [];
    for (let cursor = start.getTime(); cursor < end.getTime(); cursor += minutes * 60_000) {
      const slotEnd = Math.min(cursor + minutes * 60_000, end.getTime());
      slotValues.push({
        id: id("slot"),
        eventId,
        eventDayId,
        startsAt: new Date(cursor).toISOString(),
        endsAt: new Date(slotEnd).toISOString(),
        capacity,
        reservedCount: 0,
        status: "OPEN" as const,
        createdAt: timestamp,
        updatedAt: timestamp
      });
    }
    if (slotValues.length > 0) await tx.insert(timeslots).values(slotValues);
    return { eventId, eventDayId };
  });
}

export async function createEventDay(
  db: SchedulerDb,
  input: { adminUserId: string; eventId: string; eventDate: string; label?: string; startsAt?: string; endsAt?: string }
) {
  await assertEventAdmin(db, input.eventId, input.adminUserId);
  const timestamp = nowIso();
  const day = {
    id: id("day"),
    eventId: input.eventId,
    eventDate: input.eventDate,
    label: input.label?.trim() || null,
    startsAt: input.startsAt ? new Date(`${input.eventDate}T${input.startsAt}:00+09:00`).toISOString() : null,
    endsAt: input.endsAt ? new Date(`${input.eventDate}T${input.endsAt}:00+09:00`).toISOString() : null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  await db.insert(eventDays).values(day);
  return day;
}

export async function createTimeslot(
  db: SchedulerDb,
  input: { adminUserId: string; eventId: string; eventDayId: string; startsAt: string; endsAt: string; capacity: number }
) {
  await assertEventAdmin(db, input.eventId, input.adminUserId);
  const day = await db.query.eventDays.findFirst({ where: and(eq(eventDays.id, input.eventDayId), eq(eventDays.eventId, input.eventId)) });
  if (!day) throw new DomainError("not_found", "행사 날짜를 찾을 수 없습니다.");
  const start = new Date(`${day.eventDate}T${input.startsAt}:00+09:00`);
  const end = new Date(`${day.eventDate}T${input.endsAt}:00+09:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    throw new DomainError("invalid_input", "타임슬롯 시간이 올바르지 않습니다.");
  }
  const timestamp = nowIso();
  const slot = {
    id: id("slot"),
    eventId: input.eventId,
    eventDayId: input.eventDayId,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    capacity: parsePositiveInt(input.capacity, 20),
    reservedCount: 0,
    status: "OPEN" as const,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  await db.insert(timeslots).values(slot);
  return slot;
}

export async function updateTimeslotSettings(
  db: SchedulerDb,
  input: { adminUserId: string; eventId: string; timeslotId: string; capacity: number; status: "OPEN" | "CLOSED" | "HIDDEN" }
) {
  await assertEventAdmin(db, input.eventId, input.adminUserId);
  const slot = await db.query.timeslots.findFirst({ where: and(eq(timeslots.id, input.timeslotId), eq(timeslots.eventId, input.eventId)) });
  if (!slot) throw new DomainError("not_found", "타임슬롯을 찾을 수 없습니다.");
  if (input.capacity < slot.reservedCount) {
    throw new DomainError("invalid_input", "정원은 현재 예약 수보다 작을 수 없습니다.");
  }
  await db
    .update(timeslots)
    .set({ capacity: parsePositiveInt(input.capacity, slot.capacity), status: input.status, updatedAt: nowIso() })
    .where(eq(timeslots.id, input.timeslotId));
}
