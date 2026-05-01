"use server";

import {
  cancelReservation,
  checkInReservation,
  createEventDay,
  createManagedEvent,
  createOrLoginParticipantAccess,
  createReservation,
  createTimeslot,
  DomainError,
  getOrCreateParticipantAccessByAdmin,
  getParticipantSession,
  localAdminUserId,
  manualOverbookReservation,
  markNoShowReservation,
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

export async function participantAccessAction(formData: FormData) {
  const eventId = formString(formData, "eventId");
  const phoneNumber = formString(formData, "phoneNumber");
  const password = formString(formData, "password");
  const redirectTo = formString(formData, "redirectTo");
  const db = await getAppDb();
  const session = await createOrLoginParticipantAccess(db, { eventId, phoneNumber, password });
  await setParticipantToken(session.token, session.expiresAt);
  const allowedRedirects = new Set([`/event/${eventId}`, `/event/${eventId}/reservations`]);
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
  redirect(`/event/${eventId}/reservations`);
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
  revalidatePath(`/event/${eventId}/reservations`);
}

export async function adminLoginAction(formData: FormData) {
  const email = formString(formData, "email");
  const password = formString(formData, "password");
  const expectedEmail = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const expectedPassword = process.env.ADMIN_PASSWORD ?? "password";
  if (email !== expectedEmail || password !== expectedPassword) {
    throw new DomainError("invalid_credentials", "관리자 이메일 또는 비밀번호가 올바르지 않습니다.");
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
  revalidatePath(`/admin/events/${eventId}/check-in`);
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
    startsAt: formString(formData, "startsAt"),
    endsAt: formString(formData, "endsAt"),
    timeslotMinutes: formNumber(formData, "timeslotMinutes", 30),
    capacity: formNumber(formData, "capacity", 20),
    tournamentCapacity: formNumber(formData, "tournamentCapacity", 32)
  });
  revalidatePath("/admin");
  redirect(`/admin/events/${result.eventId}`);
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
    startsAt: formString(formData, "startsAt"),
    endsAt: formString(formData, "endsAt")
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
    startsAt: formString(formData, "startsAt"),
    endsAt: formString(formData, "endsAt"),
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
    throw new DomainError("invalid_input", "타임슬롯 상태가 올바르지 않습니다.");
  }
  const db = await getAppDb();
  await updateTimeslotSettings(db, {
    adminUserId,
    eventId,
    timeslotId: formString(formData, "timeslotId"),
    capacity: formNumber(formData, "capacity", 20),
    status
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
  revalidatePath(`/event/${eventId}`);
}
