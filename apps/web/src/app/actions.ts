"use server";

import {
  cancelReservation,
  checkInReservation,
  createEventDay,
  createManagedEvent,
  createOrLoginParticipantAccess,
  createReservation,
  createTimeslot,
  deleteManagedEvent,
  deleteTimeslot,
  DomainError,
  getOrCreateParticipantAccessByAdmin,
  getParticipantSession,
  localAdminUserId,
  manualOverbookReservation,
  markNoShowReservation,
  cancelTournamentCheckIn,
  checkInTournamentEntrant,
  createTournamentDraft,
  recordMatchWinner,
  replaceMatchEntrant,
  startTournament,
  updateTournamentSeed,
  updateTimeslotSettings
} from "@scheduler/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminUserId, getParticipantToken, setAdminUserId, setParticipantToken } from "@/lib/auth";
import { getAppDb } from "@/lib/db";

function formString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function formNumber(formData: FormData, key: string, fallback: number) {
  const value = Number(formString(formData, key));
  return Number.isFinite(value) ? value : fallback;
}

function formTime(formData: FormData, key: string) {
  const value = formString(formData, key);
  if (value) return value;

  const period = formString(formData, `${key}Period`);
  const hourRaw = formString(formData, `${key}Hour`);
  const minuteRaw = formString(formData, `${key}Minute`);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if ((period !== "AM" && period !== "PM") || !Number.isInteger(hour) || hour < 1 || hour > 12 || !Number.isInteger(minute)) {
    return "";
  }
  if (!hourRaw || !minuteRaw || minute < 0 || minute > 59) return "";

  const hour24 = period === "AM" ? hour % 12 : (hour % 12) + 12;
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export async function participantAccessAction(formData: FormData) {
  const eventId = formString(formData, "eventId");
  const phoneNumber = formString(formData, "phoneNumber");
  const password = formString(formData, "password");
  const redirectTo = formString(formData, "redirectTo");
  const db = await getAppDb();
  const session = await createOrLoginParticipantAccess(db, { eventId, phoneNumber, password });
  await setParticipantToken(session.token, session.expiresAt);
  const allowedRedirects = new Set([`/event/${eventId}`, `/event/${eventId}?reservations=1`]);
  redirect(allowedRedirects.has(redirectTo) ? redirectTo : `/event/${eventId}`);
}

export async function createReservationAction(formData: FormData) {
  const eventId = formString(formData, "eventId");
  if (formData.get("privacyConsent") !== "on") {
    throw new DomainError("unauthorized", "개인정보 수집 및 이용 안내에 동의해 주세요.");
  }
  const db = await getAppDb();
  const session = await getParticipantSession(db, await getParticipantToken());
  if (!session || session.eventId !== eventId) redirect(`/event/${eventId}`);
  await createReservation(db, {
    eventId,
    accessId: session.accessId,
    timeslotId: formString(formData, "timeslotId"),
    name: formString(formData, "name"),
    school: formString(formData, "school"),
    grade: Number(formString(formData, "grade")),
    guardianConfirmed: formData.get("guardianConfirmed") === "on",
    tournament: formData.get("tournament") === "on"
  });
  revalidatePath(`/event/${eventId}`);
  redirect(`/event/${eventId}?reservations=1`);
}

export async function cancelParticipantReservationAction(formData: FormData) {
  const eventId = formString(formData, "eventId");
  const db = await getAppDb();
  const session = await getParticipantSession(db, await getParticipantToken());
  if (!session || session.eventId !== eventId) redirect(`/event/${eventId}`);
  await cancelReservation(db, {
    eventId,
    reservationId: formString(formData, "reservationId"),
    actor: { type: "participant", accessId: session.accessId },
    reason: "participant_self_cancel"
  });
  revalidatePath(`/event/${eventId}`);
  revalidatePath(`/event/${eventId}/reservations`);
  redirect(`/event/${eventId}?reservations=1`);
}

export async function adminLoginAction(formData: FormData) {
  const adminId = formString(formData, "adminId") || formString(formData, "email");
  const password = formString(formData, "password");
  const expectedAdminIds = [process.env.ADMIN_ID?.trim() || "admin", process.env.ADMIN_EMAIL?.trim()].filter(
    (value): value is string => Boolean(value)
  );
  const expectedPassword = process.env.ADMIN_PASSWORD ?? "password";
  if (!expectedAdminIds.includes(adminId) || password !== expectedPassword) {
    throw new DomainError("invalid_credentials", "관리자 아이디 또는 비밀번호가 올바르지 않습니다.");
  }
  await setAdminUserId(localAdminUserId);
  redirect("/admin");
}

export async function checkInAction(formData: FormData) {
  const eventId = formString(formData, "eventId");
  const adminUserId = await getAdminUserId();
  if (!adminUserId) redirect("/admin");
  const db = await getAppDb();
  await checkInReservation(db, {
    eventId,
    reservationId: formString(formData, "reservationId"),
    adminUserId
  });
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/admin/events/${eventId}/check-in`);
  revalidatePath(`/admin/events/${eventId}/reservations`);
  revalidatePath(`/admin/events/${eventId}/schedule`);
}

export async function cancelAdminReservationAction(formData: FormData) {
  const eventId = formString(formData, "eventId");
  const adminUserId = await getAdminUserId();
  if (!adminUserId) redirect("/admin");
  const db = await getAppDb();
  await cancelReservation(db, {
    eventId,
    reservationId: formString(formData, "reservationId"),
    actor: { type: "admin", adminUserId },
    reason: formString(formData, "reason") || "admin_cancel"
  });
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/admin/events/${eventId}/reservations`);
  revalidatePath(`/admin/events/${eventId}/check-in`);
  revalidatePath(`/admin/events/${eventId}/schedule`);
}

export async function markNoShowAction(formData: FormData) {
  const eventId = formString(formData, "eventId");
  const adminUserId = await getAdminUserId();
  if (!adminUserId) redirect("/admin");
  const db = await getAppDb();
  await markNoShowReservation(db, {
    eventId,
    reservationId: formString(formData, "reservationId"),
    adminUserId
  });
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/admin/events/${eventId}/reservations`);
  revalidatePath(`/admin/events/${eventId}/check-in`);
  revalidatePath(`/admin/events/${eventId}/schedule`);
}

export async function createEventAction(formData: FormData) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) redirect("/admin");
  const db = await getAppDb();
  const result = await createManagedEvent(db, {
    adminUserId,
    name: formString(formData, "name"),
    description: formString(formData, "description"),
    eventDate: formString(formData, "eventDate"),
    startsAt: formTime(formData, "startsAt"),
    endsAt: formTime(formData, "endsAt"),
    timeslotMinutes: formNumber(formData, "timeslotMinutes", 60),
    capacity: formNumber(formData, "capacity", 20),
    enableTournament: formData.get("enableTournament") === "on",
    tournamentCapacity: formNumber(formData, "tournamentCapacity", 32)
  });
  revalidatePath("/admin");
  redirect(`/admin/events/${result.eventId}`);
}

export async function deleteEventAction(formData: FormData) {
  const eventId = formString(formData, "eventId");
  const adminUserId = await getAdminUserId();
  if (!adminUserId) redirect("/admin");
  const db = await getAppDb();
  await deleteManagedEvent(db, { adminUserId, eventId });
  revalidatePath("/admin");
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/event/${eventId}`);
  redirect("/admin");
}

export async function addEventDayAction(formData: FormData) {
  const eventId = formString(formData, "eventId");
  const adminUserId = await getAdminUserId();
  if (!adminUserId) redirect("/admin");
  const db = await getAppDb();
  await createEventDay(db, {
    adminUserId,
    eventId,
    eventDate: formString(formData, "eventDate"),
    label: formString(formData, "label"),
    startsAt: formTime(formData, "startsAt"),
    endsAt: formTime(formData, "endsAt")
  });
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/admin/events/${eventId}/schedule`);
}

export async function addTimeslotAction(formData: FormData) {
  const eventId = formString(formData, "eventId");
  const adminUserId = await getAdminUserId();
  if (!adminUserId) redirect("/admin");
  const db = await getAppDb();
  await createTimeslot(db, {
    adminUserId,
    eventId,
    eventDayId: formString(formData, "eventDayId"),
    title: formString(formData, "title"),
    startsAt: formTime(formData, "startsAt"),
    endsAt: formTime(formData, "endsAt"),
    capacity: formNumber(formData, "capacity", 20)
  });
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/admin/events/${eventId}/schedule`);
  revalidatePath(`/event/${eventId}`);
  revalidatePath(`/event/${eventId}/schedule`);
}

export async function updateTimeslotAction(formData: FormData) {
  const eventId = formString(formData, "eventId");
  const adminUserId = await getAdminUserId();
  if (!adminUserId) redirect("/admin");
  const status = formString(formData, "status");
  if (status !== "OPEN" && status !== "CLOSED" && status !== "HIDDEN") {
    throw new DomainError("invalid_input", "일정 상태가 올바르지 않습니다.");
  }
  const db = await getAppDb();
  await updateTimeslotSettings(db, {
    adminUserId,
    eventId,
    timeslotId: formString(formData, "timeslotId"),
    title: formString(formData, "title"),
    capacity: formNumber(formData, "capacity", 20),
    status
  });
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/admin/events/${eventId}/schedule`);
  revalidatePath(`/event/${eventId}`);
  revalidatePath(`/event/${eventId}/schedule`);
}

export async function updateTimeslotsAction(formData: FormData) {
  const eventId = formString(formData, "eventId");
  const adminUserId = await getAdminUserId();
  if (!adminUserId) redirect("/admin");
  const slotIds = formData
    .getAll("slotId")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const db = await getAppDb();

  for (const timeslotId of slotIds) {
    const status = formString(formData, `status-${timeslotId}`);
    if (status !== "OPEN" && status !== "CLOSED" && status !== "HIDDEN") {
      throw new DomainError("invalid_input", "일정 상태가 올바르지 않습니다.");
    }
    await updateTimeslotSettings(db, {
      adminUserId,
      eventId,
      timeslotId,
      title: formString(formData, `title-${timeslotId}`),
      capacity: formNumber(formData, `capacity-${timeslotId}`, 20),
      status
    });
  }

  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/admin/events/${eventId}/schedule`);
  revalidatePath(`/event/${eventId}`);
  revalidatePath(`/event/${eventId}/schedule`);
}

export async function deleteTimeslotAction(formData: FormData) {
  const eventId = formString(formData, "eventId");
  const adminUserId = await getAdminUserId();
  if (!adminUserId) redirect("/admin");
  const db = await getAppDb();
  await deleteTimeslot(db, {
    adminUserId,
    eventId,
    timeslotId: formString(formData, "timeslotId")
  });
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/admin/events/${eventId}/schedule`);
  revalidatePath(`/event/${eventId}`);
  revalidatePath(`/event/${eventId}/schedule`);
}

export async function manualOverbookAction(formData: FormData) {
  const eventId = formString(formData, "eventId");
  const adminUserId = await getAdminUserId();
  if (!adminUserId) redirect("/admin");
  const db = await getAppDb();
  const access = await getOrCreateParticipantAccessByAdmin(db, {
    eventId,
    phoneNumber: formString(formData, "phoneNumber"),
    initialPassword: formString(formData, "initialPassword")
  });
  await manualOverbookReservation(db, {
    adminUserId,
    eventId,
    accessId: access.id,
    timeslotId: formString(formData, "timeslotId"),
    name: formString(formData, "name"),
    school: formString(formData, "school"),
    grade: formNumber(formData, "grade", 1),
    guardianConfirmed: formData.get("guardianConfirmed") === "on",
    tournament: formData.get("tournament") === "on",
    reason: formString(formData, "reason") || "admin_manual_overbook"
  });
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/admin/events/${eventId}/reservations`);
  revalidatePath(`/admin/events/${eventId}/check-in`);
  revalidatePath(`/admin/events/${eventId}/schedule`);
  revalidatePath(`/event/${eventId}`);
  revalidatePath(`/event/${eventId}/schedule`);
}

export async function tournamentCheckInAction(formData: FormData) {
  const eventId = formString(formData, "eventId");
  const adminUserId = await getAdminUserId();
  if (!adminUserId) redirect("/admin");
  await checkInTournamentEntrant(await getAppDb(), {
    adminUserId,
    eventId,
    reservationId: formString(formData, "reservationId")
  });
  revalidatePath(`/admin/events/${eventId}/tournament`);
}

export async function cancelTournamentCheckInAction(formData: FormData) {
  const eventId = formString(formData, "eventId");
  const adminUserId = await getAdminUserId();
  if (!adminUserId) redirect("/admin");
  await cancelTournamentCheckIn(await getAppDb(), {
    adminUserId,
    eventId,
    reservationId: formString(formData, "reservationId")
  });
  revalidatePath(`/admin/events/${eventId}/tournament`);
}

export async function createTournamentDraftAction(formData: FormData) {
  const eventId = formString(formData, "eventId");
  const adminUserId = await getAdminUserId();
  if (!adminUserId) redirect("/admin");
  const reservationIds = formData
    .getAll("reservationId")
    .map((value) => String(value).trim())
    .filter(Boolean);
  await createTournamentDraft(await getAppDb(), {
    adminUserId,
    eventId,
    bracketSize: formNumber(formData, "bracketSize", 32),
    seedingMode: formString(formData, "seedingMode") === "RANDOM" ? "RANDOM" : formString(formData, "seedingMode") === "MANUAL" ? "MANUAL" : "CHECK_IN_ORDER",
    reservationIds
  });
  revalidatePath(`/admin/events/${eventId}/tournament`);
}

export async function updateTournamentSeedAction(formData: FormData) {
  const eventId = formString(formData, "eventId");
  const adminUserId = await getAdminUserId();
  if (!adminUserId) redirect("/admin");
  await updateTournamentSeed(await getAppDb(), {
    adminUserId,
    tournamentId: formString(formData, "tournamentId"),
    seed: formNumber(formData, "seed", 1),
    reservationId: formString(formData, "reservationId") || null
  });
  revalidatePath(`/admin/events/${eventId}/tournament`);
}

export async function startTournamentAction(formData: FormData) {
  const eventId = formString(formData, "eventId");
  const adminUserId = await getAdminUserId();
  if (!adminUserId) redirect("/admin");
  await startTournament(await getAppDb(), {
    adminUserId,
    tournamentId: formString(formData, "tournamentId")
  });
  revalidatePath(`/admin/events/${eventId}/tournament`);
}

export async function recordMatchWinnerAction(formData: FormData) {
  const eventId = formString(formData, "eventId");
  const adminUserId = await getAdminUserId();
  if (!adminUserId) redirect("/admin");
  await recordMatchWinner(await getAppDb(), {
    adminUserId,
    tournamentId: formString(formData, "tournamentId"),
    matchId: formString(formData, "matchId"),
    winnerEntrantId: formString(formData, "winnerEntrantId")
  });
  revalidatePath(`/admin/events/${eventId}/tournament`);
}

export async function replaceMatchEntrantAction(formData: FormData) {
  const eventId = formString(formData, "eventId");
  const adminUserId = await getAdminUserId();
  if (!adminUserId) redirect("/admin");
  await replaceMatchEntrant(await getAppDb(), {
    adminUserId,
    tournamentId: formString(formData, "tournamentId"),
    matchId: formString(formData, "matchId"),
    side: formString(formData, "side") === "B" ? "B" : "A",
    entrantId: formString(formData, "entrantId") || null
  });
  revalidatePath(`/admin/events/${eventId}/tournament`);
}
