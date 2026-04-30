import Link from "next/link";
import { listAdminEvents } from "@scheduler/domain";
import { getAdminUserId } from "@/lib/auth";
import { getAppDb } from "@/lib/db";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const adminUserId = await getAdminUserId();
  const events = adminUserId ? await listAdminEvents(await getAppDb(), adminUserId) : [];

  if (!adminUserId) {
    return <>{children}</>;
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar surface-flat">
        <div className="px-4 py-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-base-content/50">Admin</div>
          <Link href="/admin" className="mt-1 block text-lg font-bold">
            행사 관리
          </Link>
        </div>

        <nav className="space-y-2 px-2 pb-4">
          <Link href="/admin/events/new" className="admin-nav-item">
            새 행사
          </Link>
          <details open className="admin-event-list">
            <summary>행사 목록</summary>
            <div className="mt-2 space-y-1">
              {events.map((event) => (
                <details key={event.id} open className="admin-event-group">
                  <summary>
                    <span className="truncate">{event.name}</span>
                    <span>{event.eventDate ?? "날짜 미정"}</span>
                  </summary>
                  <div className="mt-1 grid gap-1 pl-2">
                    <Link href={`/admin/events/${event.id}`} className="admin-sub-nav-item">
                      운영 허브
                    </Link>
                    <Link href={`/admin/events/${event.id}/check-in`} className="admin-sub-nav-item">
                      체크인
                    </Link>
                    <Link href={`/admin/events/${event.id}/reservations`} className="admin-sub-nav-item">
                      예약
                    </Link>
                    <Link href={`/admin/events/${event.id}/schedule`} className="admin-sub-nav-item">
                      시간표
                    </Link>
                  </div>
                </details>
              ))}
              {events.length === 0 && <div className="px-3 py-2 text-sm text-base-content/50">행사가 없습니다.</div>}
            </div>
          </details>
        </nav>
      </aside>
      <section className="min-w-0 flex-1">{children}</section>
    </div>
  );
}
