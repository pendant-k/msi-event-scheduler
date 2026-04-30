import Link from "next/link";
import { DataTable } from "@scheduler/ui/data-table";
import { getSchedule, searchCheckInRows } from "@scheduler/domain";
import {
  addEventDayAction,
  addTimeslotAction,
  cancelAdminReservationAction,
  manualOverbookAction,
  markNoShowAction,
  updateTimeslotAction
} from "@/app/actions";
import { Schedule } from "@/components/schedule";
import { getAdminUserId } from "@/lib/auth";
import { getAppDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { redirect } from "next/navigation";

export default async function AdminEventPage({ params }: { params: Promise<{ eventId: string }> }) {
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
          <h1 className="text-2xl font-bold">{schedule.event.name}</h1>
          <p className="text-sm text-base-content/60">운영 현황</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/events/${eventId}/check-in`} className="btn btn-primary btn-sm">
            체크인 대시보드
          </Link>
          <Link href={`/admin/events/${eventId}/export`} className="btn btn-outline btn-sm">
            CSV Export
          </Link>
        </div>
      </div>

      <Schedule event={schedule.event} day={schedule.selectedDay} timeslots={schedule.timeslots} mode="admin" />

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded border border-base-300 bg-base-100 p-4">
          <h2 className="mb-3 text-lg font-semibold">날짜 추가</h2>
          <form action={addEventDayAction} className="grid gap-3">
            <input type="hidden" name="eventId" value={eventId} />
            <label className="form-control">
              <span className="label-text">날짜</span>
              <input name="eventDate" type="date" className="input input-bordered" required />
            </label>
            <label className="form-control">
              <span className="label-text">라벨</span>
              <input name="label" className="input input-bordered" placeholder="Day 2" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="form-control">
                <span className="label-text">시작</span>
                <input name="startsAt" type="time" className="input input-bordered" />
              </label>
              <label className="form-control">
                <span className="label-text">종료</span>
                <input name="endsAt" type="time" className="input input-bordered" />
              </label>
            </div>
            <button className="btn btn-outline" type="submit">
              날짜 추가
            </button>
          </form>
        </div>

        <div className="rounded border border-base-300 bg-base-100 p-4">
          <h2 className="mb-3 text-lg font-semibold">타임슬롯 추가</h2>
          <form action={addTimeslotAction} className="grid gap-3">
            <input type="hidden" name="eventId" value={eventId} />
            <label className="form-control">
              <span className="label-text">행사 날짜</span>
              <select name="eventDayId" className="select select-bordered" required>
                {schedule.days.map((day) => (
                  <option key={day.id} value={day.id}>
                    {day.label ?? day.eventDate} · {day.eventDate}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="form-control">
                <span className="label-text">시작</span>
                <input name="startsAt" type="time" className="input input-bordered" required />
              </label>
              <label className="form-control">
                <span className="label-text">종료</span>
                <input name="endsAt" type="time" className="input input-bordered" required />
              </label>
            </div>
            <label className="form-control">
              <span className="label-text">정원</span>
              <input name="capacity" type="number" min={1} className="input input-bordered" defaultValue={20} required />
            </label>
            <button className="btn btn-outline" type="submit">
              타임슬롯 추가
            </button>
          </form>
        </div>
      </section>

      <section className="rounded border border-base-300 bg-base-100 p-4">
        <h2 className="mb-3 text-lg font-semibold">타임슬롯 상태/정원</h2>
        <div className="grid gap-2">
          {schedule.timeslots.map((slot) => (
            <form key={slot.id} action={updateTimeslotAction} className="grid items-end gap-2 rounded border border-base-200 p-3 md:grid-cols-[1fr_120px_140px_auto]">
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="timeslotId" value={slot.id} />
              <div className="text-sm">
                <div className="font-medium">{formatDateTime(slot.startsAt)}</div>
                <div className="text-base-content/60">예약 {slot.reservedCount}명</div>
              </div>
              <label className="form-control">
                <span className="label-text">정원</span>
                <input name="capacity" type="number" min={slot.reservedCount} className="input input-bordered input-sm" defaultValue={slot.capacity} required />
              </label>
              <label className="form-control">
                <span className="label-text">상태</span>
                <select name="status" className="select select-bordered select-sm" defaultValue={slot.status}>
                  <option value="OPEN">OPEN</option>
                  <option value="CLOSED">CLOSED</option>
                  <option value="HIDDEN">HIDDEN</option>
                </select>
              </label>
              <button className="btn btn-outline btn-sm" type="submit">
                저장
              </button>
            </form>
          ))}
        </div>
      </section>

      <section className="rounded border border-base-300 bg-base-100 p-4">
        <h2 className="mb-3 text-lg font-semibold">수동 초과 예약</h2>
        <form action={manualOverbookAction} className="grid gap-3 md:grid-cols-2">
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
      </section>

      <section className="rounded border border-base-300 bg-base-100 p-4">
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

      <section className="rounded border border-base-300 bg-base-100 p-4">
        <h2 className="mb-3 text-lg font-semibold">취소/노쇼 처리</h2>
        <div className="grid gap-2">
          {rows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-base-200 p-2">
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
        </div>
      </section>
    </div>
  );
}
