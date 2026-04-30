import Link from "next/link";
import { listAdminEvents } from "@scheduler/domain";
import { adminLoginAction } from "@/app/actions";
import { getAdminUserId } from "@/lib/auth";
import { getAppDb } from "@/lib/db";

export default async function AdminHomePage() {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return (
      <form action={adminLoginAction} className="mx-auto max-w-md space-y-3 rounded border border-base-300 bg-base-100 p-4">
        <h1 className="text-xl font-semibold">관리자 로그인</h1>
        <input name="email" type="email" className="input input-bordered w-full" defaultValue="admin@example.com" required />
        <input name="password" type="password" className="input input-bordered w-full" defaultValue="password" required />
        <p className="text-sm text-base-content/60">로컬 프로토타입은 env 기반 mock gate를 사용합니다.</p>
        <button className="btn btn-primary w-full" type="submit">
          로그인
        </button>
      </form>
    );
  }

  const events = await listAdminEvents(await getAppDb(), adminUserId);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">관리자 대시보드</h1>
          <p className="text-sm text-base-content/60">행사를 선택해 운영하거나 새 행사를 만듭니다.</p>
        </div>
        <Link href="/admin/events/new" className="btn btn-primary">
          새 행사
        </Link>
      </div>

      <div className="grid gap-3">
        {events.map((event) => (
          <div key={event.id} className="flex items-center justify-between rounded border border-base-300 bg-base-100 p-4">
            <div>
              <div className="font-semibold">{event.name}</div>
              <div className="text-sm text-base-content/60">{event.status}</div>
            </div>
            <div className="flex gap-2">
              <Link href={`/admin/events/${event.id}`} className="btn btn-outline btn-sm">
                운영 현황
              </Link>
              <Link href={`/admin/events/${event.id}/check-in`} className="btn btn-primary btn-sm">
                체크인
              </Link>
            </div>
          </div>
        ))}
        {events.length === 0 && <div className="alert">관리 가능한 행사가 없습니다. seed를 실행해 주세요.</div>}
      </div>
    </div>
  );
}
