import { appConfig } from "@scheduler/config";
import { cookies } from "next/headers";

export const adminCookieName = "scheduler_admin_session";

export async function getParticipantToken() {
  return (await cookies()).get(appConfig.participantSessionCookieName)?.value;
}

export async function setParticipantToken(token: string, expiresAt: string) {
  (await cookies()).set(appConfig.participantSessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(expiresAt),
    path: "/"
  });
}

export async function getAdminUserId() {
  const value = (await cookies()).get(adminCookieName)?.value;
  return value === "local-super-admin" ? value : null;
}

export async function setAdminUserId(adminUserId: string) {
  (await cookies()).set(adminCookieName, adminUserId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
}
