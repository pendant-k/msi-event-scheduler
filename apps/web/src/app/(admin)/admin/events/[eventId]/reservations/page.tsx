import Link from "next/link";
import { DataTable } from "@scheduler/ui/data-table";
import { getSchedule, searchCheckInRows } from "@scheduler/domain";
import { cancelAdminReservationAction, manualOverbookAction, markNoShowAction } from "@/app/actions";
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
        <Link href={`/admin/events/${eventId}/export`} className="btn btn-outline btn-sm">
          CSV Export
        </Link>
      </div>

      <details className="surface-flat p-4">
        <summary className="cursor-pointer font-semibold">수동 초과 예약</summary>
        <form action={manualOverbookAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <input type="hidden" name="eventId" value={eventId} />
          <label className="form-control md:col-span-2">
            <span className="label-text">타임슬롯</span>
            <select name="timeslotId" className="select select-bordered" required>
              {schedule.timeslots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {formatDateTime(slot.startsAt)} · {slot.reservedCount}/{slot.capacity}
                </option>
              ))}
            </select>
          </label>
          <label className="form-control">
            <span className="label-text">전화번호</span>
            <input name="phoneNumber" className="input input-bordered" inputMode="tel" required />
          </label>
          <label className="form-control">
            <span className="label-text">신규 접근 비밀번호</span>
            <input name="initialPassword" type="password" className="input input-bordered" minLength={4} required />
          </label>
          <label className="form-control">
            <span className="label-text">이름</span>
            <input name="name" className="input input-bordered" required />
          </label>
          <label className="form-control">
            <span className="label-text">학교</span>
            <input name="school" className="input input-bordered" required />
          </label>
          <label className="form-control">
            <span className="label-text">학년</span>
            <input name="grade" type="number" min={1} max={12} className="input input-bordered" required />
          </label>
          <label className="form-control">
            <span className="label-text">사유</span>
            <input name="reason" className="input input-bordered" placeholder="현장 운영자 승인" />
          </label>
          <label className="label cursor-pointer justify-start gap-3">
            <input name="guardianConfirmed" type="checkbox" className="checkbox" />
            <span className="label-text">보호자 동행 확인</span>
          </label>
          <label className="label cursor-pointer justify-start gap-3">
            <input name="tournament" type="checkbox" className="checkbox" />
            <span className="label-text">대회 참가 신청</span>
          </label>
          <div className="md:col-span-2">
            <button className="btn btn-primary" type="submit">
              수동 예약
            </button>
          </div>
        </form>
      </details>

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
