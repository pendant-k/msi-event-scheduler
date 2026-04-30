import { listAdminEvents } from "@scheduler/domain";
import { adminLoginAction } from "@/app/actions";
import { getAdminUserId } from "@/lib/auth";
import { getAppDb } from "@/lib/db";

export default async function AdminHomePage() {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return (
      <form action={adminLoginAction} className="surface-flat mx-auto max-w-md space-y-3 p-5">
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
  const nextEvent = events[0];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">관리자 대시보드</h1>
          <p className="text-sm text-base-content/60">왼쪽 사이드바에서 날짜순으로 행사를 선택합니다.</p>
        </div>
      </div>

      <section className="surface-flat p-5">
        <h2 className="text-lg font-semibold">{nextEvent ? "가장 가까운 행사" : "행사 없음"}</h2>
        {nextEvent ? (
          <div className="mt-3">
            <div className="text-xl font-bold">{nextEvent.name}</div>
            <div className="mt-1 text-sm text-base-content/60">
              {nextEvent.eventDate ?? "날짜 미정"} · {nextEvent.status}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-base-content/60">사이드바에서 새 행사를 생성해 주세요.</p>
        )}
      </section>
    </div>
  );
}
