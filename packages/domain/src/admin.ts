import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { SchedulerDb } from "@scheduler/db";
import { adminLogs, eventAdmins, eventDays, events, reservations, timeslots } from "@scheduler/db";
import { DomainError } from "./errors";
import { createReservation } from "./reservations";
import { id, nowIso } from "./utils";

export const localAdminUserId = "local-super-admin";

export async function assertEventAdmin(db: SchedulerDb, eventId: string, adminUserId = localAdminUserId) {
  const admin = await db.query.eventAdmins.findFirst({
    where: and(eq(eventAdmins.eventId, eventId), eq(eventAdmins.adminUserId, adminUserId))
  });
  if (!admin) throw new DomainError("unauthorized", "관리자 권한이 없습니다.");
  return admin;
}

export async function listAdminEvents(db: SchedulerDb, adminUserId = localAdminUserId) {
  return db
    .select({
      id: events.id,
      name: events.name,
      status: events.status,
      description: events.description,
      eventDate: sql<string | null>`min(${eventDays.eventDate})`,
      createdAt: events.createdAt
    })
    .from(events)
    .innerJoin(eventAdmins, eq(eventAdmins.eventId, events.id))
    .leftJoin(eventDays, eq(eventDays.eventId, events.id))
    .where(eq(eventAdmins.adminUserId, adminUserId))
    .groupBy(events.id)
    .orderBy(desc(events.createdAt), asc(sql`min(${eventDays.eventDate})`));
}

export async function manualOverbookReservation(
  db: SchedulerDb,
  input: Parameters<typeof createReservation>[1] & { adminUserId: string; reason: string }
) {
  await assertEventAdmin(db, input.eventId, input.adminUserId);
  const reservation = await createReservation(db, { ...input, allowOverbook: true });
  await db.update(reservations).set({ isOverbooked: true, updatedAt: nowIso() }).where(eq(reservations.id, reservation.id));
  await db.insert(adminLogs).values({
    id: id("log"),
    eventId: input.eventId,
    adminUserId: input.adminUserId,
    action: "MANUAL_OVERBOOK",
    targetType: "reservation",
    targetId: reservation.id,
    reason: input.reason,
    metadata: {},
    createdAt: nowIso()
  });
  return { ...reservation, isOverbooked: true };
}
