import { listAdminEvents } from "@scheduler/domain";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { adminLoginAction } from "@/app/actions";
import { getAdminUserId } from "@/lib/auth";
import { getAppDb } from "@/lib/db";

const eventStatusLabels = {
  DRAFT: "작성 중",
  PUBLISHED: "공개",
  CLOSED: "마감",
  ARCHIVED: "보관됨"
} as const;

export default async function AdminHomePage() {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    const defaultEmail = process.env.ADMIN_EMAIL ?? "admin@example.com";
    return (
      <form action={adminLoginAction} className="surface-flat mx-auto max-w-md space-y-3 p-5">
        <h1 className="text-xl font-semibold">관리자 로그인</h1>
        <input name="email" type="email" className="input input-bordered w-full" defaultValue={defaultEmail} required />
        <input name="password" type="password" className="input input-bordered w-full" placeholder="관리자 비밀번호" required />
        <p className="text-sm text-base-content/60">Vercel 환경변수에 등록된 관리자 계정으로 로그인합니다.</p>
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
          <Link
            href={`/admin/events/${nextEvent.id}`}
            className="interactive-flat mt-3 flex flex-col gap-4 rounded-lg border border-base-300/70 p-4 focus:outline-none focus:ring-2 focus:ring-primary/30 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="truncate text-xl font-bold">{nextEvent.name}</div>
              <div className="mt-1 text-sm text-base-content/60">
                {nextEvent.eventDate ?? "날짜 미정"} · {eventStatusLabels[nextEvent.status]}
              </div>
            </div>
            <span className="btn btn-primary btn-sm w-full shrink-0 sm:w-auto">
              이동
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </span>
          </Link>
        ) : (
          <p className="mt-2 text-sm text-base-content/60">사이드바에서 새 행사를 생성해 주세요.</p>
        )}
      </section>
    </div>
  );
}
