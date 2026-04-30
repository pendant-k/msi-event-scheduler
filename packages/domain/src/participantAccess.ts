import { and, eq } from "drizzle-orm";
import type { SchedulerDb } from "@scheduler/db";
import { participantAccesses, participantSessions } from "@scheduler/db";
import { appConfig } from "@scheduler/config";
import bcrypt from "bcryptjs";
import { DomainError } from "./errors";
import { addHours, hashToken, id, normalizePhone, nowIso, phoneLast4, randomToken } from "./utils";

export async function createOrLoginParticipantAccess(
  db: SchedulerDb,
  input: { eventId: string; phoneNumber: string; password: string }
) {
  const normalizedPhone = normalizePhone(input.phoneNumber);
  if (normalizedPhone.length < 8 || input.password.length < 4) {
    throw new DomainError("invalid_credentials", "전화번호 또는 비밀번호가 올바르지 않습니다.");
  }

  const existing = await db.query.participantAccesses.findFirst({
    where: and(eq(participantAccesses.eventId, input.eventId), eq(participantAccesses.phoneNumber, normalizedPhone))
  });
  const timestamp = nowIso();

  if (!existing) {
    const passwordHash = await bcrypt.hash(input.password, 10);
    const access = {
      id: id("access"),
      eventId: input.eventId,
      phoneNumber: normalizedPhone,
      phoneLast4: phoneLast4(normalizedPhone),
      passwordHash,
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await db.insert(participantAccesses).values(access);
    return issueParticipantSession(db, access.id, input.eventId);
  }

  if (existing.lockedUntil && new Date(existing.lockedUntil) > new Date()) {
    throw new DomainError("locked", "잠시 후 다시 시도해 주세요.");
  }

  const valid = await bcrypt.compare(input.password, existing.passwordHash);
  if (!valid) {
    const failedLoginCount = existing.failedLoginCount + 1;
    await db
      .update(participantAccesses)
      .set({
        failedLoginCount,
        lockedUntil: failedLoginCount >= 5 ? addHours(new Date(), 1).toISOString() : null,
        updatedAt: timestamp
      })
      .where(eq(participantAccesses.id, existing.id));
    throw new DomainError("invalid_credentials", "전화번호 또는 비밀번호가 올바르지 않습니다.");
  }

  await db
    .update(participantAccesses)
    .set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: timestamp, updatedAt: timestamp })
    .where(eq(participantAccesses.id, existing.id));
  return issueParticipantSession(db, existing.id, input.eventId);
}

export async function issueParticipantSession(db: SchedulerDb, accessId: string, eventId: string) {
  const token = randomToken();
  const timestamp = nowIso();
  const expiresAt = addHours(new Date(), appConfig.participantSessionTtlHours).toISOString();
  await db.insert(participantSessions).values({
    id: id("session"),
    eventId,
    accessId,
    sessionTokenHash: hashToken(token),
    expiresAt,
    createdAt: timestamp,
    lastSeenAt: timestamp
  });
  return { token, expiresAt, accessId, eventId };
}

export async function getOrCreateParticipantAccessByAdmin(
  db: SchedulerDb,
  input: { eventId: string; phoneNumber: string; initialPassword: string }
) {
  const normalizedPhone = normalizePhone(input.phoneNumber);
  if (normalizedPhone.length < 8 || input.initialPassword.length < 4) {
    throw new DomainError("invalid_credentials", "전화번호 또는 초기 비밀번호가 올바르지 않습니다.");
  }

  const existing = await db.query.participantAccesses.findFirst({
    where: and(eq(participantAccesses.eventId, input.eventId), eq(participantAccesses.phoneNumber, normalizedPhone))
  });
  if (existing) return existing;

  const timestamp = nowIso();
  const access = {
    id: id("access"),
    eventId: input.eventId,
    phoneNumber: normalizedPhone,
    phoneLast4: phoneLast4(normalizedPhone),
    passwordHash: await bcrypt.hash(input.initialPassword, 10),
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  await db.insert(participantAccesses).values(access);
  return access;
}

export async function getParticipantSession(db: SchedulerDb, token?: string) {
  if (!token) return null;
  const session = await db.query.participantSessions.findFirst({
    where: eq(participantSessions.sessionTokenHash, hashToken(token))
  });
  if (!session || new Date(session.expiresAt) <= new Date()) return null;
  await db
    .update(participantSessions)
    .set({ lastSeenAt: nowIso() })
    .where(eq(participantSessions.id, session.id));
  return session;
}
