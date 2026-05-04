import Link from "next/link";
import { ArrowLeft, EyeOff, Save, Trash2 } from "lucide-react";
import { getSchedule } from "@scheduler/domain";
import { deleteTimeslotAction, updateTimeslotsAction } from "@/app/actions";
import { AdminRefreshButton } from "@/components/admin-refresh-button";
import { FormLoadingModal, PendingSubmitButton } from "@/components/loading-modal";
import { Schedule } from "@/components/schedule";
import { ScheduleEditorModals } from "@/components/schedule-editor-modals";
import { getAdminUserId } from "@/lib/auth";
import { getAppDb } from "@/lib/db";
import { formatDateTime, formatTime } from "@/lib/format";
import { redirect } from "next/navigation";

const statusLabels = {
  OPEN: "예약 가능",
  CLOSED: "마감",
  HIDDEN: "숨김"
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
      <div className="flex flex-wrap items-start justify-between gap-3">
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
        <AdminRefreshButton label="시간표 새로고침" />
      </div>

      <Schedule event={schedule.event} day={schedule.selectedDay} timeslots={schedule.timeslots} mode="admin" />

      <ScheduleEditorModals eventId={eventId} days={schedule.days} defaultCapacity={defaultCapacity} />

      <section className="surface-flat p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">일정 공개 상태와 정원</h2>
          <div className="inline-flex items-center gap-1 rounded-full bg-base-200 px-3 py-1 text-xs font-semibold text-base-content/70">
            <EyeOff className="size-3.5" aria-hidden="true" />
            숨김 {hiddenCount}
          </div>
        </div>
        {schedule.timeslots.length === 0 ? (
          <div className="admin-empty-hint">등록된 일정이 없습니다.</div>
        ) : (
          <form action={updateTimeslotsAction} className="grid gap-3">
            <input type="hidden" name="eventId" value={eventId} />
            <div className="grid gap-2">
              {schedule.timeslots.map((slot) => (
                <div
                  key={slot.id}
                  className="slot-row-flat grid overflow-hidden md:grid-cols-[minmax(0,1fr)_minmax(9rem,12rem)_7.5rem_minmax(10.5rem,13rem)_7rem]"
                >
                  <input type="hidden" name="slotId" value={slot.id} />
                  <div className="slot-row-cell min-w-0 text-sm">
                    <div className="font-medium">
                      {formatDateTime(slot.startsAt)} - {formatTime(slot.endsAt)}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-base-content/60">
                      <span>예약 {slot.reservedCount}명</span>
                      <span className="slot-row-status">{statusLabels[slot.status]}</span>
                    </div>
                  </div>
                  <label className="slot-row-cell form-control">
                    <span className="label-text">이름</span>
                    <input
                      name={`title-${slot.id}`}
                      className="input input-bordered h-11 min-h-11 w-full min-w-0 text-sm"
                      defaultValue={slot.title ?? ""}
                      placeholder="예: 오전 체험"
                    />
                  </label>
                  <label className="slot-row-cell form-control">
                    <span className="label-text">정원</span>
                    <input
                      name={`capacity-${slot.id}`}
                      type="number"
                      min={slot.reservedCount}
                      className="input input-bordered h-11 min-h-11 w-full min-w-0 text-sm"
                      defaultValue={slot.capacity}
                      required
                    />
                  </label>
                  <label className="slot-row-cell form-control">
                    <span className="label-text">공개 상태</span>
                    <select
                      name={`status-${slot.id}`}
                      className="select select-bordered h-11 min-h-11 w-full min-w-0 text-sm"
                      defaultValue={slot.status}
                    >
                      <option value="OPEN">예약 가능</option>
                      <option value="CLOSED">마감</option>
                      <option value="HIDDEN">숨김</option>
                    </select>
                  </label>
                  <div className="slot-row-cell">
                    <button
                      className="btn btn-error btn-outline btn-sm w-full gap-2 whitespace-nowrap"
                      type="submit"
                      form={`delete-timeslot-${slot.id}`}
                      formNoValidate
                      disabled={slot.reservedCount > 0}
                      title={slot.reservedCount > 0 ? "예약 이력이 있는 일정은 삭제할 수 없습니다." : "일정 삭제"}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="slot-bulk-save-bar">
              <div className="text-sm font-semibold text-base-content/65">정원과 공개 상태 변경사항을 한 번에 저장합니다.</div>
              <PendingSubmitButton className="btn btn-primary gap-2" pendingChildren="저장 중">
                <Save className="size-4" aria-hidden="true" />
                전체 수정사항 저장
              </PendingSubmitButton>
            </div>
            <FormLoadingModal title="시간표 변경사항을 저장하고 있습니다" description="일정 정원과 공개 상태를 반영하는 중입니다." />
          </form>
        )}
        {schedule.timeslots.map((slot) => (
          <form key={`delete-${slot.id}`} id={`delete-timeslot-${slot.id}`} action={deleteTimeslotAction} className="hidden">
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="timeslotId" value={slot.id} />
          </form>
        ))}
      </section>
    </div>
  );
}
