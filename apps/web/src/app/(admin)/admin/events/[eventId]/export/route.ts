import { asc, eq } from "drizzle-orm";
import { assertEventAdmin } from "@scheduler/domain";
import { eventDays, events, participantAccesses, participants, reservations, timeslots } from "@scheduler/db";
import { getAdminUserId } from "@/lib/auth";
import { getAppDb } from "@/lib/db";
import { formatTime } from "@/lib/format";
import { getReservationStatusLabel } from "@/lib/status-labels";

type ExportReservation = {
  name: string;
  school: string;
  grade: number;
  phoneNumber: string;
  status: string;
  tournament: boolean;
  reservationCode: string;
  checkInCode: string;
};

type ExportSlot = {
  eventName: string;
  eventDate: string;
  dayLabel: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
  capacity: number;
  reservations: ExportReservation[];
};

const slotStatusLabels: Record<string, string> = {
  OPEN: "예약 가능",
  CLOSED: "비활성화",
  HIDDEN: "숨김"
};

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function csvRow(values: Array<string | number>) {
  return values.map(csvCell).join(",");
}

function slotStatusLabel(status: string) {
  return slotStatusLabels[status] ?? status;
}

function reservationSummary(reservation: ExportReservation, index: number) {
  const tournament = reservation.tournament ? ", 대회 참가" : "";
  return `${index + 1}. ${reservation.name} (${reservation.school} ${reservation.grade}학년, ${getReservationStatusLabel(
    reservation.status
  )}${tournament}, ${reservation.phoneNumber})`;
}

function countByStatus(reservationsForSlot: ExportReservation[], status: string) {
  return reservationsForSlot.filter((reservation) => reservation.status === status).length;
}

export async function GET(_: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { eventId } = await params;
  const db = await getAppDb();
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) {
    return new Response("Not found", { status: 404 });
  }

  await assertEventAdmin(db, eventId, adminUserId);

  const rows = await db
    .select({
      eventName: events.name,
      eventDate: eventDays.eventDate,
      dayLabel: eventDays.label,
      timeslotId: timeslots.id,
      startsAt: timeslots.startsAt,
      endsAt: timeslots.endsAt,
      slotStatus: timeslots.status,
      capacity: timeslots.capacity,
      reservationId: reservations.id,
      reservationStatus: reservations.status,
      tournament: reservations.tournament,
      reservationCode: reservations.reservationCode,
      checkInCode: reservations.checkInCode,
      participantName: participants.name,
      school: participants.school,
      grade: participants.grade,
      phoneNumber: participantAccesses.phoneNumber
    })
    .from(timeslots)
    .innerJoin(events, eq(events.id, timeslots.eventId))
    .innerJoin(eventDays, eq(eventDays.id, timeslots.eventDayId))
    .leftJoin(reservations, eq(reservations.timeslotId, timeslots.id))
    .leftJoin(participants, eq(participants.id, reservations.participantId))
    .leftJoin(participantAccesses, eq(participantAccesses.id, reservations.accessId))
    .where(eq(timeslots.eventId, eventId))
    .orderBy(asc(eventDays.eventDate), asc(timeslots.startsAt), asc(participants.name), asc(reservations.createdAt));

  const slots = new Map<string, ExportSlot>();
  for (const row of rows) {
    const slot = slots.get(row.timeslotId) ?? {
      eventName: row.eventName,
      eventDate: row.dayLabel ? `${row.eventDate} (${row.dayLabel})` : row.eventDate,
      dayLabel: row.dayLabel,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      status: row.slotStatus,
      capacity: row.capacity,
      reservations: []
    };

    if (row.reservationId && row.participantName && row.school && row.grade && row.reservationStatus) {
      slot.reservations.push({
        name: row.participantName,
        school: row.school,
        grade: row.grade,
        phoneNumber: row.phoneNumber ?? "",
        status: row.reservationStatus,
        tournament: row.tournament ?? false,
        reservationCode: row.reservationCode ?? "",
        checkInCode: row.checkInCode ?? ""
      });
    }

    slots.set(row.timeslotId, slot);
  }

  const header = [
    "행사명",
    "행사일",
    "행사시간",
    "일정상태",
    "일정정원",
    "예약/정원",
    "예약완료",
    "체크인",
    "노쇼",
    "취소",
    "대회참가",
    "예약자 명단",
    "연락처",
    "예약번호",
    "체크인코드"
  ];
  const body = [...slots.values()].map((slot) => {
    const activeCount = slot.reservations.filter((reservation) =>
      ["RESERVED", "LATE_RESERVED", "CHECKED_IN", "NO_SHOW"].includes(reservation.status)
    ).length;
    const reservedCount = countByStatus(slot.reservations, "RESERVED") + countByStatus(slot.reservations, "LATE_RESERVED");
    const checkedInCount = countByStatus(slot.reservations, "CHECKED_IN");
    const noShowCount = countByStatus(slot.reservations, "NO_SHOW");
    const cancelledCount = countByStatus(slot.reservations, "CANCELLED");
    const tournamentCount = slot.reservations.filter((reservation) => reservation.tournament).length;

    return csvRow([
      slot.eventName,
      slot.eventDate,
      `${formatTime(slot.startsAt)} ~ ${formatTime(slot.endsAt)}`,
      slotStatusLabel(slot.status),
      slot.capacity,
      `${activeCount}/${slot.capacity}`,
      reservedCount,
      checkedInCount,
      noShowCount,
      cancelledCount,
      tournamentCount,
      slot.reservations.length > 0 ? slot.reservations.map(reservationSummary).join("\n") : "예약 없음",
      slot.reservations.map((reservation) => reservation.phoneNumber).join("\n"),
      slot.reservations.map((reservation) => reservation.reservationCode).join("\n"),
      slot.reservations.map((reservation) => reservation.checkInCode).join("\n")
    ]);
  });

  const csv = `\uFEFF${[csvRow(header), ...body].join("\n")}`;
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="schedule-reservations-${eventId}.csv"`
    }
  });
}
