import { listAdminEvents } from "@scheduler/domain";
import { AdminShell } from "@/components/admin-shell";
import { getAdminUserId } from "@/lib/auth";
import { getAppDb } from "@/lib/db";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const adminUserId = await getAdminUserId();
  const events = adminUserId ? await listAdminEvents(await getAppDb(), adminUserId) : [];

  if (!adminUserId) {
    return <>{children}</>;
  }

  return <AdminShell events={events}>{children}</AdminShell>;
}
