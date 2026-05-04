import Link from "next/link";
import { ArrowLeft, CalendarPlus, Clock, EyeOff, Plus, Save } from "lucide-react";
import { getSchedule } from "@scheduler/domain";
import { addEventDayAction, addTimeslotAction, updateTimeslotAction } from "@/app/actions";
import { Schedule } from "@/components/schedule";
import { getAdminUserId } from "@/lib/auth";
import { getAppDb } from "@/lib/db";
import { formatDateTime, formatTime } from "@/lib/format";
import { redirect } from "next/navigation";

const statusLabels = {
  OPEN: "예약 가능",
  CLOSED: "마감",
  HIDDEN: "예약 페이지 숨김"
} as const;

export default async function AdminSchedulePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const adminUserId = await getAdminUserId();
  if (!adminUserId) redirect("/admin");
  const schedule = await getSchedule(await getAppDb(), eventId);
  if (!schedule) return <div className="alert alert-error">행사를 찾을 수 없습니다.</div>;
  const defaultCapacity = schedule.timeslots[0]?.capacity ?? 20;
  const hiddenCount = schedule.timeslots.filter((slot) => slot.status === "HIDDEN").length;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/events/${eventId}`} className="btn btn-ghost btn-sm">
          <ArrowLeft className="size-4" aria-hidden="true" />
          운영 허브
        </Link>
        <h1 className="mt-3 text-2xl font-bold">시간표 관리</h1>
        <p className="text-sm text-base-content/60">
          {schedule.event.name} · 숨김 {hiddenCount}개
        </p>
      </div>

      <Schedule event={schedule.event} day={schedule.selectedDay} timeslots={schedule.timeslots} mode="admin" />

      <div className="grid gap-4 lg:grid-cols-2">
        <details className="admin-editor-card surface-flat p-4">
          <summary>
            <span className="admin-editor-summary-title">
              <CalendarPlus className="size-4" aria-hidden="true" />
              날짜 추가
            </span>
            <Plus className="size-4 text-base-content/50" aria-hidden="true" />
          </summary>
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
              <CalendarPlus className="size-4" aria-hidden="true" />
              날짜 추가
            </button>
          </form>
        </details>

        <details className="admin-editor-card surface-flat p-4" open>
          <summary>
            <span className="admin-editor-summary-title">
              <Clock className="size-4" aria-hidden="true" />
              예외 타임슬롯 추가
            </span>
            <Plus className="size-4 text-base-content/50" aria-hidden="true" />
          </summary>
          <p className="mt-2 text-sm text-base-content/60">
            기본 슬롯과 다른 길이의 회차만 별도로 추가하고, 필요 없는 기본 슬롯은 아래에서 숨김 처리합니다.
          </p>
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
              <input name="capacity" type="number" min={1} className="input input-bordered" defaultValue={defaultCapacity} required />
            </label>
            <button className="btn btn-outline" type="submit">
              <Plus className="size-4" aria-hidden="true" />
              예외 슬롯 추가
            </button>
          </form>
        </details>
      </div>

      <section className="surface-flat p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">슬롯 공개 상태와 정원</h2>
          <div className="inline-flex items-center gap-1 rounded-full bg-base-200 px-3 py-1 text-xs font-semibold text-base-content/70">
            <EyeOff className="size-3.5" aria-hidden="true" />
            숨김 {hiddenCount}
          </div>
        </div>
        <div className="grid gap-2">
          {schedule.timeslots.length === 0 ? (
            <div className="admin-empty-hint">등록된 타임슬롯이 없습니다.</div>
          ) : (
            schedule.timeslots.map((slot) => (
              <form
                key={slot.id}
                action={updateTimeslotAction}
                className="slot-row-flat grid items-end gap-2 p-3 md:grid-cols-[minmax(0,1fr)_120px_170px_auto]"
              >
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="timeslotId" value={slot.id} />
                <div className="min-w-0 text-sm">
                  <div className="truncate font-medium">
                    {formatDateTime(slot.startsAt)} - {formatTime(slot.endsAt)}
                  </div>
                  <div className="text-base-content/60">
                    예약 {slot.reservedCount}명 · {statusLabels[slot.status]}
                  </div>
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
                  <span className="label-text">공개 상태</span>
                  <select name="status" className="select select-bordered select-sm" defaultValue={slot.status}>
                    <option value="OPEN">예약 가능</option>
                    <option value="CLOSED">마감</option>
                    <option value="HIDDEN">예약 페이지 숨김</option>
                  </select>
                </label>
                <button className="btn btn-outline btn-sm" type="submit">
                  <Save className="size-4" aria-hidden="true" />
                  저장
                </button>
              </form>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
