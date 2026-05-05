import { and, desc, eq, like, or, sql } from "drizzle-orm";
import type { SchedulerDb } from "@scheduler/db";
import {
  adminLogs,
  events,
  participantAccesses,
  participants,
  reservations,
  timeslots
} from "@scheduler/db";
import { assertEventAdmin } from "./admin";
import { DomainError } from "./errors";
import { duplicateKey, id, normalizePhone, nowIso, shortCode } from "./utils";

type Actor =
  | { type: "participant"; accessId: string }
  | { type: "admin"; adminUserId: string };

const activeReservationStatusSql = sql`${reservations.status} in ('RESERVED', 'LATE_RESERVED', 'CHECKED_IN')`;
const reservationStatuses = new Set(["RESERVED", "LATE_RESERVED", "CHECKED_IN", "CANCELLED", "NO_SHOW"]);
type ReservationStatus = "RESERVED" | "LATE_RESERVED" | "CHECKED_IN" | "CANCELLED" | "NO_SHOW";

function countsTowardCapacity(status: string) {
  return status === "RESERVED" || status === "LATE_RESERVED" || status === "CHECKED_IN";
}

function parseReservationStatus(status: string): ReservationStatus {
  if (!reservationStatuses.has(status)) throw new DomainError("invalid_input", "예약 상태가 올바르지 않습니다.");
  return status as ReservationStatus;
}

export async function createReservation(
  db: SchedulerDb,
  input: {
    eventId: string;
    timeslotId: string;
    accessId: string;
    name: string;
    school: string;
    grade: number;
    guardianConfirmed: boolean;
    tournament: boolean;
    allowOverbook?: boolean;
  }
) {
  return db.transaction(async (tx) => {
    const [event, slot, access] = await Promise.all([
      tx.query.events.findFirst({ where: eq(events.id, input.eventId) }),
      tx.query.timeslots.findFirst({ where: eq(timeslots.id, input.timeslotId) }),
      tx.query.participantAccesses.findFirst({ where: eq(participantAccesses.id, input.accessId) })
    ]);
    if (!event || event.status !== "PUBLISHED") throw new DomainError("event_closed", "예약할 수 없는 행사입니다.");
    if (!slot || slot.eventId !== event.id || slot.status !== "OPEN") throw new DomainError("timeslot_closed", "예약할 수 없는 시간입니다.");
    if (!access || access.eventId !== event.id) throw new DomainError("unauthorized", "참가자 접근 정보가 올바르지 않습니다.");

    const startsAt = new Date(slot.startsAt);
    const closeAt = new Date(startsAt.getTime() + event.reservationCloseAfterMinutes * 60_000);
    const isLate = new Date() > startsAt;
    if (new Date() > closeAt || (isLate && !event.allowLateReservation)) {
      throw new DomainError("timeslot_closed", "예약 마감 시간이 지났습니다.");
    }
    await tx.execute(sql`select id from ${participantAccesses} where id = ${access.id} for update`);
    const guardianRequired =
      input.grade >= event.minGuardianRequiredGrade && input.grade <= event.maxGuardianRequiredGrade;
    if (guardianRequired && !input.guardianConfirmed) {
      throw new DomainError("guardian_required", "보호자 동행 확인이 필요합니다.");
    }
    const timestamp = nowIso();
    const participantKey = {
      eventId: event.id,
      phoneNumber: access.phoneNumber,
      name: input.name,
      school: input.school,
      grade: input.grade
    };
    let participant = await tx.query.participants.findFirst({
      where: and(
        eq(participants.eventId, event.id),
        eq(participants.accessId, access.id),
        eq(participants.name, input.name.trim()),
        eq(participants.school, input.school.trim()),
        eq(participants.grade, input.grade)
      )
    });
    if (!participant) {
      const values = {
        id: id("participant"),
        eventId: event.id,
        accessId: access.id,
        name: input.name.trim(),
        school: input.school.trim(),
        grade: input.grade,
        guardianRequired,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await tx.insert(participants).values(values);
      participant = values;
    }

    const dupKey = event.allowMultipleBooking ? null : duplicateKey(participantKey);
    if (dupKey) {
      const duplicate = await tx.query.reservations.findFirst({
        where: and(
          eq(reservations.eventId, event.id),
          eq(reservations.duplicateKey, dupKey),
          sql`${reservations.status} in ('RESERVED', 'LATE_RESERVED', 'CHECKED_IN')`
        )
      });
      if (duplicate) throw new DomainError("duplicate_reservation", "이미 예약된 참가자입니다.");
    }

    const slotUpdateConditions = [eq(timeslots.id, slot.id), eq(timeslots.eventId, event.id), eq(timeslots.status, "OPEN")];
    if (!input.allowOverbook) {
      slotUpdateConditions.push(sql`${timeslots.reservedCount} < ${timeslots.capacity}`);
    }
    const [updatedSlot] = await tx
      .update(timeslots)
      .set({ reservedCount: sql`${timeslots.reservedCount} + 1`, updatedAt: timestamp })
      .where(and(...slotUpdateConditions))
      .returning({ reservedCount: timeslots.reservedCount, capacity: timeslots.capacity });
    if (!updatedSlot) throw new DomainError("capacity_full", "정원이 마감되었습니다.");

    const reservation = {
      id: id("reservation"),
      eventId: event.id,
      timeslotId: slot.id,
      accessId: access.id,
      participantId: participant.id,
      status: isLate ? ("LATE_RESERVED" as const) : ("RESERVED" as const),
      tournament: Boolean(input.tournament && event.enableTournament),
      duplicateKey: dupKey,
      reservationCode: shortCode(8),
      checkInCode: shortCode(10),
      isOverbooked: Boolean(input.allowOverbook && updatedSlot.reservedCount > updatedSlot.capacity),
      createdAt: timestamp,
      updatedAt: timestamp,
      checkedInAt: null,
      cancelledAt: null,
      cancelledBy: null,
      cancellationReason: null
    };
    await tx.insert(reservations).values(reservation);
    return reservation;
  });
}

export async function listReservationsForAccess(db: SchedulerDb, eventId: string, accessId: string) {
  return db
    .select({
      id: reservations.id,
      reservationCode: reservations.reservationCode,
      status: reservations.status,
      tournament: reservations.tournament,
      createdAt: reservations.createdAt,
      cancelledAt: reservations.cancelledAt,
      participantName: participants.name,
      school: participants.school,
      grade: participants.grade,
      startsAt: timeslots.startsAt,
      endsAt: timeslots.endsAt
    })
    .from(reservations)
    .innerJoin(participants, eq(participants.id, reservations.participantId))
    .innerJoin(timeslots, eq(timeslots.id, reservations.timeslotId))
    .where(and(eq(reservations.eventId, eventId), eq(reservations.accessId, accessId)))
    .orderBy(desc(reservations.createdAt));
}

export async function cancelReservation(
  db: SchedulerDb,
  input: { eventId: string; reservationId: string; actor: Actor; reason?: string }
) {
  return db.transaction(async (tx) => {
    const reservation = await tx.query.reservations.findFirst({
      where: and(eq(reservations.id, input.reservationId), eq(reservations.eventId, input.eventId))
    });
    if (!reservation) throw new DomainError("not_found", "예약을 찾을 수 없습니다.");
    if (reservation.status === "CANCELLED") return reservation;
    if (reservation.status === "CHECKED_IN" && input.actor.type === "participant") {
      throw new DomainError("cancel_not_allowed", "체크인 후에는 취소할 수 없습니다.");
    }
    if (input.actor.type === "participant" && reservation.accessId !== input.actor.accessId) {
      throw new DomainError("unauthorized", "예약 취소 권한이 없습니다.");
    }

    const [event, slot] = await Promise.all([
      tx.query.events.findFirst({ where: eq(events.id, input.eventId) }),
      tx.query.timeslots.findFirst({ where: eq(timeslots.id, reservation.timeslotId) })
    ]);
    if (!event || !slot) throw new DomainError("not_found", "예약 정보를 찾을 수 없습니다.");
    if (input.actor.type === "participant") {
      if (!event.allowParticipantCancellation) throw new DomainError("cancel_not_allowed", "참가자 취소가 허용되지 않습니다.");
      const deadline = new Date(new Date(slot.startsAt).getTime() - event.participantCancelUntilMinutesBeforeStart * 60_000);
      if (new Date() > deadline) throw new DomainError("cancel_not_allowed", "취소 가능 시간이 지났습니다.");
    }

    const timestamp = nowIso();
    await tx
      .update(reservations)
      .set({
        status: "CANCELLED",
        cancelledAt: timestamp,
        cancelledBy: input.actor.type === "participant" ? "PARTICIPANT" : "ADMIN",
        cancellationReason: input.reason ?? null,
        updatedAt: timestamp
      })
      .where(eq(reservations.id, reservation.id));
    if (reservation.status === "RESERVED" || reservation.status === "LATE_RESERVED") {
      await tx
        .update(timeslots)
        .set({ reservedCount: Math.max(0, slot.reservedCount - 1), updatedAt: timestamp })
        .where(eq(timeslots.id, slot.id));
    }
    if (input.actor.type === "admin") {
      await tx.insert(adminLogs).values({
        id: id("log"),
        eventId: input.eventId,
        adminUserId: input.actor.adminUserId,
        action: "CANCEL_RESERVATION",
        targetType: "reservation",
        targetId: reservation.id,
        reason: input.reason ?? null,
        metadata: {},
        createdAt: timestamp
      });
    }
    return { ...reservation, status: "CANCELLED" as const };
  });
}

export async function checkInReservation(
  db: SchedulerDb,
  input: { eventId: string; reservationId: string; adminUserId: string }
) {
  const reservation = await db.query.reservations.findFirst({
    where: and(eq(reservations.id, input.reservationId), eq(reservations.eventId, input.eventId))
  });
  if (!reservation) throw new DomainError("not_found", "예약을 찾을 수 없습니다.");
  if (reservation.status === "CHECKED_IN") return reservation;
  if (reservation.status === "CANCELLED" || reservation.status === "NO_SHOW") {
    throw new DomainError("invalid_state", "체크인할 수 없는 예약 상태입니다.");
  }
  const timestamp = nowIso();
  await db
    .update(reservations)
    .set({ status: "CHECKED_IN", checkedInAt: timestamp, updatedAt: timestamp })
    .where(eq(reservations.id, reservation.id));
  await db.insert(adminLogs).values({
    id: id("log"),
    eventId: input.eventId,
    adminUserId: input.adminUserId,
    action: "CHECK_IN",
    targetType: "reservation",
    targetId: reservation.id,
    reason: null,
    metadata: {},
    createdAt: timestamp
  });
  return { ...reservation, status: "CHECKED_IN" as const };
}

export async function markNoShowReservation(
  db: SchedulerDb,
  input: { eventId: string; reservationId: string; adminUserId: string }
) {
  const reservation = await db.query.reservations.findFirst({
    where: and(eq(reservations.id, input.reservationId), eq(reservations.eventId, input.eventId))
  });
  if (!reservation) throw new DomainError("not_found", "예약을 찾을 수 없습니다.");
  if (reservation.status === "CHECKED_IN" || reservation.status === "CANCELLED") {
    throw new DomainError("invalid_state", "노쇼 처리할 수 없는 예약 상태입니다.");
  }
  const timestamp = nowIso();
  await db
    .update(reservations)
    .set({ status: "NO_SHOW", updatedAt: timestamp })
    .where(eq(reservations.id, reservation.id));
  await db.insert(adminLogs).values({
    id: id("log"),
    eventId: input.eventId,
    adminUserId: input.adminUserId,
    action: "MARK_NO_SHOW",
    targetType: "reservation",
    targetId: reservation.id,
    reason: null,
    metadata: {},
    createdAt: timestamp
  });
  return { ...reservation, status: "NO_SHOW" as const };
}

export async function updateAdminReservationStatus(
  db: SchedulerDb,
  input: { eventId: string; reservationId: string; adminUserId: string; status: string; reason?: string }
) {
  const targetStatus = parseReservationStatus(input.status);
  return db.transaction(async (tx) => {
    const reservation = await tx.query.reservations.findFirst({
      where: and(eq(reservations.id, input.reservationId), eq(reservations.eventId, input.eventId))
    });
    if (!reservation) throw new DomainError("not_found", "예약을 찾을 수 없습니다.");
    if (reservation.status === targetStatus) return reservation;

    const slot = await tx.query.timeslots.findFirst({ where: eq(timeslots.id, reservation.timeslotId) });
    if (!slot) throw new DomainError("not_found", "예약 일정을 찾을 수 없습니다.");

    const timestamp = nowIso();
    const currentCounts = countsTowardCapacity(reservation.status);
    const targetCounts = countsTowardCapacity(targetStatus);
    if (currentCounts !== targetCounts) {
      await tx
        .update(timeslots)
        .set({
          reservedCount: targetCounts
            ? sql`${timeslots.reservedCount} + 1`
            : sql`greatest(${timeslots.reservedCount} - 1, 0)`,
          updatedAt: timestamp
        })
        .where(eq(timeslots.id, slot.id));
    }

    const checkedInAt = targetStatus === "CHECKED_IN" ? reservation.checkedInAt ?? timestamp : null;
    const cancellationFields =
      targetStatus === "CANCELLED"
        ? {
            cancelledAt: reservation.cancelledAt ?? timestamp,
            cancelledBy: "ADMIN" as const,
            cancellationReason: input.reason ?? reservation.cancellationReason ?? "admin_status_change"
          }
        : {
            cancelledAt: null,
            cancelledBy: null,
            cancellationReason: null
          };

    await tx
      .update(reservations)
      .set({
        status: targetStatus,
        checkedInAt,
        ...cancellationFields,
        isOverbooked: targetCounts ? slot.reservedCount + (currentCounts ? 0 : 1) > slot.capacity : false,
        updatedAt: timestamp
      })
      .where(eq(reservations.id, reservation.id));

    await tx.insert(adminLogs).values({
      id: id("log"),
      eventId: input.eventId,
      adminUserId: input.adminUserId,
      action: "UPDATE_RESERVATION_STATUS",
      targetType: "reservation",
      targetId: reservation.id,
      reason: input.reason ?? null,
      metadata: {
        from: reservation.status,
        to: targetStatus
      },
      createdAt: timestamp
    });

    return {
      ...reservation,
      status: targetStatus,
      checkedInAt,
      ...cancellationFields,
      updatedAt: timestamp
    };
  });
}

export async function addTournamentApplication(
  db: SchedulerDb,
  input: { eventId: string; reservationId: string; adminUserId: string }
) {
  await assertEventAdmin(db, input.eventId, input.adminUserId);
  const reservation = await db.query.reservations.findFirst({
    where: and(eq(reservations.id, input.reservationId), eq(reservations.eventId, input.eventId))
  });
  if (!reservation) throw new DomainError("not_found", "예약을 찾을 수 없습니다.");
  if (reservation.tournament) return reservation;
  if (reservation.status === "CANCELLED" || reservation.status === "NO_SHOW") {
    throw new DomainError("invalid_state", "취소 또는 노쇼 예약은 대회 신청으로 변경할 수 없습니다.");
  }

  const timestamp = nowIso();
  await db
    .update(reservations)
    .set({ tournament: true, updatedAt: timestamp })
    .where(and(eq(reservations.id, reservation.id), eq(reservations.eventId, input.eventId)));
  await db.insert(adminLogs).values({
    id: id("log"),
    eventId: input.eventId,
    adminUserId: input.adminUserId,
    action: "ADD_TOURNAMENT_APPLICATION",
    targetType: "reservation",
    targetId: reservation.id,
    reason: "admin_tournament_application",
    metadata: {},
    createdAt: timestamp
  });
  return { ...reservation, tournament: true, updatedAt: timestamp };
}

export async function searchCheckInRows(
  db: SchedulerDb,
  input: { eventId: string; query?: string; timeslotId?: string }
) {
  const query = input.query?.trim();
  const conditions = [eq(reservations.eventId, input.eventId)];
  if (input.timeslotId) conditions.push(eq(reservations.timeslotId, input.timeslotId));
  if (query) {
    const normalizedPhone = normalizePhone(query);
    conditions.push(
      or(
        like(participants.name, `%${query}%`),
        like(participants.school, `%${query}%`),
        like(reservations.reservationCode, `%${query.toUpperCase()}%`),
        normalizedPhone ? eq(participantAccesses.phoneLast4, normalizedPhone.slice(-4)) : undefined
      )!
    );
  }
  const rows = await db
    .select({
      id: reservations.id,
      reservationCode: reservations.reservationCode,
      status: reservations.status,
      tournament: reservations.tournament,
      participantName: participants.name,
      school: participants.school,
      grade: participants.grade,
      phoneNumber: participantAccesses.phoneNumber,
      timeslotTitle: timeslots.title,
      startsAt: timeslots.startsAt,
      endsAt: timeslots.endsAt,
      timeslotId: timeslots.id
    })
    .from(reservations)
    .innerJoin(participants, eq(participants.id, reservations.participantId))
    .innerJoin(participantAccesses, eq(participantAccesses.id, reservations.accessId))
    .innerJoin(timeslots, eq(timeslots.id, reservations.timeslotId))
    .where(and(...conditions))
    .orderBy(timeslots.startsAt, participants.name);
  return rows;
}
