import Link from "next/link";
import { searchCheckInRows } from "@scheduler/domain";
import { checkInAction } from "@/app/actions";
import { getAdminUserId } from "@/lib/auth";
import { getAppDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { getReservationStatusLabel, getReservationStatusTone } from "@/lib/status-labels";
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

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/admin/events/${eventId}`} className="btn btn-ghost btn-sm">
          운영 허브
        </Link>
        <h1 className="text-2xl font-bold">체크인 대시보드</h1>
        <p className="text-sm text-base-content/60">전화번호 뒷자리, 이름 일부, 학교 일부, 예약번호로 검색합니다.</p>
      </div>
      <form className="flex gap-2">
        <input name="q" className="input input-bordered flex-1" placeholder="예: 1234, 홍길동, OO초" defaultValue={q ?? ""} />
        <button className="btn btn-primary" type="submit">
          검색
        </button>
      </form>
      <div className="grid gap-2">
        {rows.map((row) => (
          <div key={row.id} className="surface-flat flex flex-wrap items-center justify-between gap-3 p-3">
            <div>
              <div className="font-medium">
                {row.participantName} · {row.school} · {row.grade}학년
              </div>
              <div className="text-sm text-base-content/60">
                {formatDateTime(row.startsAt)} · {row.maskedPhone} · {row.reservationCode}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`status-pill status-pill-${getReservationStatusTone(row.status)}`}>
                {getReservationStatusLabel(row.status)}
              </span>
              <form action={checkInAction}>
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="reservationId" value={row.id} />
                <button className="btn btn-primary btn-sm" type="submit" disabled={row.status === "CHECKED_IN"}>
                  체크인
                </button>
              </form>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="alert">검색 결과가 없습니다.</div>}
      </div>
    </div>
  );
}
