import Link from "next/link";
import { DataTable } from "@scheduler/ui/data-table";
import { getSchedule, searchCheckInRows } from "@scheduler/domain";
import { cancelAdminReservationAction, markNoShowAction } from "@/app/actions";
import { ManualReservationModal } from "@/components/manual-reservation-modal";
import { getAdminUserId } from "@/lib/auth";
import { getAppDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { redirect } from "next/navigation";

export default async function AdminReservationsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const adminUserId = await getAdminUserId();
  if (!adminUserId) redirect("/admin");
  const db = await getAppDb();
  const schedule = await getSchedule(db, eventId);
  if (!schedule) return <div className="alert alert-error">행사를 찾을 수 없습니다.</div>;
  const rows = await searchCheckInRows(db, { eventId });
  const tableRows = rows.map((row) => ({
    time: formatDateTime(row.startsAt),
    name: row.participantName,
    school: row.school,
    grade: `${row.grade}`,
    phone: row.maskedPhone,
    status: row.status,
    tournament: row.tournament ? "신청" : "-"
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/admin/events/${eventId}`} className="btn btn-ghost btn-sm">
            운영 허브
          </Link>
          <h1 className="mt-3 text-2xl font-bold">예약 관리</h1>
          <p className="text-sm text-base-content/60">{schedule.event.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ManualReservationModal eventId={eventId} timeslots={schedule.timeslots} />
          <Link href={`/admin/events/${eventId}/export`} className="btn btn-outline btn-sm">
            CSV Export
          </Link>
        </div>
      </div>

      <section className="surface-flat p-4">
        <h2 className="mb-3 text-lg font-semibold">예약 테이블</h2>
        <DataTable
          rows={tableRows}
          columns={[
            { key: "time", label: "시간" },
            { key: "name", label: "이름" },
            { key: "school", label: "학교" },
            { key: "grade", label: "학년" },
            { key: "phone", label: "전화번호" },
            { key: "status", label: "상태" },
            { key: "tournament", label: "대회" }
          ]}
        />
      </section>

      <section className="surface-flat p-4">
        <h2 className="mb-3 text-lg font-semibold">취소/노쇼 처리</h2>
        <div className="grid gap-2">
          {rows.map((row) => (
            <div key={row.id} className="slot-row-flat flex flex-wrap items-center justify-between gap-2 p-2">
              <div className="text-sm">
                {row.participantName} · {row.school} · {formatDateTime(row.startsAt)} · {row.status}
              </div>
              <div className="flex gap-2">
                <form action={cancelAdminReservationAction}>
                  <input type="hidden" name="eventId" value={eventId} />
                  <input type="hidden" name="reservationId" value={row.id} />
                  <input type="hidden" name="reason" value="admin_cancel" />
                  <button className="btn btn-outline btn-xs" type="submit">
                    취소
                  </button>
                </form>
                <form action={markNoShowAction}>
                  <input type="hidden" name="eventId" value={eventId} />
                  <input type="hidden" name="reservationId" value={row.id} />
                  <button className="btn btn-outline btn-xs" type="submit">
                    노쇼
                  </button>
                </form>
              </div>
            </div>
          ))}
          {rows.length === 0 && <div className="alert">예약 내역이 없습니다.</div>}
        </div>
      </section>
    </div>
  );
}
