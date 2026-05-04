import Link from "next/link";
import { searchCheckInRows } from "@scheduler/domain";
import { AdminLiveReservations } from "@/components/admin-live-reservations";
import { getAdminUserId } from "@/lib/auth";
import { getAppDb } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function CheckInPage({
  params,
  searchParams
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { eventId } = await params;
  const { q } = await searchParams;
  const adminUserId = await getAdminUserId();
  if (!adminUserId) redirect("/admin");
  const rows = await searchCheckInRows(await getAppDb(), { eventId, query: q });
  const initialUpdatedAt = new Date().toISOString();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/admin/events/${eventId}`} className="btn btn-ghost btn-sm">
            운영 허브
          </Link>
          <h1 className="text-2xl font-bold">체크인 대시보드</h1>
          <p className="text-sm text-base-content/60">전화번호 뒷자리, 이름 일부, 학교 일부, 예약번호로 검색합니다.</p>
        </div>
      </div>
      <form className="flex gap-2">
        <input name="q" className="input input-bordered flex-1" placeholder="예: 1234, 홍길동, OO초" defaultValue={q ?? ""} />
        <button className="btn btn-primary" type="submit">
          검색
        </button>
      </form>
      <AdminLiveReservations eventId={eventId} initialRows={rows} initialUpdatedAt={initialUpdatedAt} mode="check-in" query={q} />
    </div>
  );
}
