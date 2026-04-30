import { createHash, randomBytes, randomUUID } from "node:crypto";

export function id(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function normalizePhone(phoneNumber: string) {
  return phoneNumber.replace(/\D/g, "");
}

export function phoneLast4(phoneNumber: string) {
  const normalized = normalizePhone(phoneNumber);
  return normalized.slice(-4).padStart(Math.min(4, normalized.length), "*");
}

export function maskPhone(phoneNumber: string) {
  const last4 = phoneLast4(phoneNumber);
  return `****${last4}`;
}

export function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function duplicateKey(input: {
  eventId: string;
  phoneNumber: string;
  name: string;
  school: string;
  grade: number;
}) {
  return [
    input.eventId,
    normalizePhone(input.phoneNumber),
    normalizeText(input.name),
    normalizeText(input.school),
    input.grade
  ].join("|");
}

export function shortCode(size = 6) {
  return randomBytes(size).toString("base64url").slice(0, size).toUpperCase();
}

export function randomToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}
