import Link from "next/link";
import { DataTable } from "@scheduler/ui/data-table";
import { getSchedule, searchCheckInRows } from "@scheduler/domain";
import { ArrowLeft, Ban, Download, UserX } from "lucide-react";
import { cancelAdminReservationAction, markNoShowAction } from "@/app/actions";
import { ManualReservationModal } from "@/components/manual-reservation-modal";
import { getAdminUserId } from "@/lib/auth";
import { getAppDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { getReservationStatusLabel, getReservationStatusTone, isActiveReservationStatus } from "@/lib/status-labels";
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
    status: getReservationStatusLabel(row.status),
    tournament: row.tournament ? "신청" : "-"
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/admin/events/${eventId}`} className="btn btn-ghost btn-sm">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            운영 허브
          </Link>
          <h1 className="mt-3 text-2xl font-bold">예약 관리</h1>
          <p className="text-sm text-base-content/60">{schedule.event.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ManualReservationModal
            eventId={eventId}
            enableTournament={schedule.event.enableTournament}
            timeslots={schedule.timeslots}
          />
          <Link href={`/admin/events/${eventId}/export`} className="btn btn-outline btn-sm">
            <Download aria-hidden="true" className="h-4 w-4" />
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">취소/노쇼 처리</h2>
          <div className="text-sm font-semibold text-base-content/55">활성 예약 {rows.filter((row) => isActiveReservationStatus(row.status)).length}건</div>
        </div>
        <div className="reservation-action-list">
          {rows.map((row) => {
            const active = isActiveReservationStatus(row.status);
            return (
              <div key={row.id} className="reservation-action-card">
                <div className="min-w-0">
                  <div className="reservation-action-title">
                    <span>{row.participantName}</span>
                    <span className={`status-pill status-pill-${getReservationStatusTone(row.status)}`}>
                      {getReservationStatusLabel(row.status)}
                    </span>
                  </div>
                  <div className="reservation-action-meta">
                    <span>{row.school}</span>
                    <span>{row.grade}학년</span>
                    <span>{formatDateTime(row.startsAt)}</span>
                    <span>{row.maskedPhone}</span>
                    <span>{row.reservationCode}</span>
                  </div>
                </div>

                <div className="reservation-action-buttons">
                  <form action={markNoShowAction}>
                    <input type="hidden" name="eventId" value={eventId} />
                    <input type="hidden" name="reservationId" value={row.id} />
                    <button className="btn btn-no-show btn-sm" type="submit" disabled={!active}>
                      <UserX aria-hidden="true" className="h-4 w-4" />
                      노쇼 처리
                    </button>
                  </form>
                  <form action={cancelAdminReservationAction}>
                    <input type="hidden" name="eventId" value={eventId} />
                    <input type="hidden" name="reservationId" value={row.id} />
                    <input type="hidden" name="reason" value="admin_cancel" />
                    <button className="btn btn-cancel-reservation btn-sm" type="submit" disabled={!active}>
                      <Ban aria-hidden="true" className="h-4 w-4" />
                      예약 취소
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
          {rows.length === 0 && <div className="alert">예약 내역이 없습니다.</div>}
        </div>
      </section>
    </div>
  );
}
