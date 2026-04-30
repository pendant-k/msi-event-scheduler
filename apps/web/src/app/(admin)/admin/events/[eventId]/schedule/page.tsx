import Link from "next/link";
import { getSchedule } from "@scheduler/domain";
import { addEventDayAction, addTimeslotAction, updateTimeslotAction } from "@/app/actions";
import { Schedule } from "@/components/schedule";
import { getAdminUserId } from "@/lib/auth";
import { getAppDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { redirect } from "next/navigation";

export default async function AdminSchedulePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const adminUserId = await getAdminUserId();
  if (!adminUserId) redirect("/admin");
  const schedule = await getSchedule(await getAppDb(), eventId);
  if (!schedule) return <div className="alert alert-error">행사를 찾을 수 없습니다.</div>;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/events/${eventId}`} className="btn btn-ghost btn-sm">
          운영 허브
        </Link>
        <h1 className="mt-3 text-2xl font-bold">시간표 관리</h1>
        <p className="text-sm text-base-content/60">{schedule.event.name}</p>
      </div>

      <Schedule event={schedule.event} day={schedule.selectedDay} timeslots={schedule.timeslots} mode="admin" />

      <div className="grid gap-4 lg:grid-cols-2">
        <details className="surface-flat p-4">
          <summary className="cursor-pointer font-semibold">날짜 추가</summary>
          <form action={addEventDayAction} className="mt-4 grid gap-3">
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
        </details>

        <details className="surface-flat p-4">
          <summary className="cursor-pointer font-semibold">타임슬롯 추가</summary>
          <form action={addTimeslotAction} className="mt-4 grid gap-3">
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
        </details>
      </div>

      <section className="surface-flat p-4">
        <h2 className="mb-3 text-lg font-semibold">타임슬롯 상태/정원</h2>
        <div className="grid gap-2">
          {schedule.timeslots.map((slot) => (
            <form
              key={slot.id}
              action={updateTimeslotAction}
              className="slot-row-flat grid items-end gap-2 p-3 md:grid-cols-[1fr_120px_140px_auto]"
            >
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="timeslotId" value={slot.id} />
              <div className="text-sm">
                <div className="font-medium">{formatDateTime(slot.startsAt)}</div>
                <div className="text-base-content/60">예약 {slot.reservedCount}명</div>
              </div>
              <label className="form-control">
                <span className="label-text">정원</span>
                <input
                  name="capacity"
                  type="number"
                  min={slot.reservedCount}
                  className="input input-bordered input-sm"
                  defaultValue={slot.capacity}
                  required
                />
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
    </div>
  );
}
