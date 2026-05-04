"use client";

import { useMemo, useState } from "react";
import { LoaderCircle, Save, Trash2 } from "lucide-react";
import { deleteTimeslotAction, updateTimeslotsAction } from "@/app/actions";
import { FormLoadingModal, LoadingModal, PendingSubmitButton } from "@/components/loading-modal";
import { formatDateTime, formatTime } from "@/lib/format";

type TimeslotStatus = "OPEN" | "CLOSED" | "HIDDEN";

type EditableTimeslot = {
  id: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  reservedCount: number;
  status: TimeslotStatus;
};

type TimeslotDraft = {
  capacity: string;
  status: TimeslotStatus;
};

type TimeslotSettingsFormProps = {
  eventId: string;
  timeslots: EditableTimeslot[];
};

const statusLabels = {
  OPEN: "예약 가능",
  CLOSED: "마감",
  HIDDEN: "숨김"
} as const;

export function TimeslotSettingsForm({ eventId, timeslots }: TimeslotSettingsFormProps) {
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(timeslots.map((slot) => [slot.id, { capacity: String(slot.capacity), status: slot.status }]))
  );
  const [deletingSlotId, setDeletingSlotId] = useState<string | null>(null);

  const dirtySlotIds = useMemo(
    () =>
      timeslots
        .filter((slot) => {
          const draft = drafts[slot.id];
          return draft && (Number(draft.capacity) !== slot.capacity || draft.status !== slot.status);
        })
        .map((slot) => slot.id),
    [drafts, timeslots]
  );
  const dirtyCount = dirtySlotIds.length;

  function updateDraft(slotId: string, nextDraft: Partial<TimeslotDraft>) {
    setDrafts((current) => ({
      ...current,
      [slotId]: {
        capacity: current[slotId]?.capacity ?? "",
        status: current[slotId]?.status ?? "OPEN",
        ...nextDraft
      }
    }));
  }

  return (
    <>
      <form action={updateTimeslotsAction} className="grid gap-3">
        <input type="hidden" name="eventId" value={eventId} />
        <div className="grid gap-2">
          {timeslots.map((slot) => {
            const draft = drafts[slot.id] ?? { capacity: String(slot.capacity), status: slot.status };
            const capacityChanged = Number(draft.capacity) !== slot.capacity;
            const statusChanged = draft.status !== slot.status;
            const dirty = capacityChanged || statusChanged;
            const deleting = deletingSlotId === slot.id;

            return (
              <div
                key={slot.id}
                className="slot-row-flat grid overflow-hidden md:grid-cols-[minmax(0,1fr)_7.5rem_minmax(10.5rem,13rem)_7rem]"
                data-dirty={dirty ? "true" : undefined}
                data-deleting={deleting ? "true" : undefined}
              >
                <input type="hidden" name="slotId" value={slot.id} />
                <div className="slot-row-cell min-w-0 text-sm">
                  <div className="font-medium">
                    {formatDateTime(slot.startsAt)} - {formatTime(slot.endsAt)}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-base-content/60">
                    <span>예약 {slot.reservedCount}명</span>
                    <span className="slot-row-status">{statusLabels[slot.status]}</span>
                    {dirty && <span className="slot-row-pending">수정 예정</span>}
                    {statusChanged && (
                      <span className="slot-row-change">
                        {statusLabels[slot.status]} → {statusLabels[draft.status]}
                      </span>
                    )}
                    {capacityChanged && <span className="slot-row-change">정원 {slot.capacity} → {draft.capacity || "-"}</span>}
                    {deleting && (
                      <span className="slot-row-pending slot-row-pending-danger">
                        <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
                        삭제 중
                      </span>
                    )}
                  </div>
                </div>
                <label className="slot-row-cell form-control">
                  <span className="label-text">정원</span>
                  <input
                    name={`capacity-${slot.id}`}
                    type="number"
                    min={slot.reservedCount}
                    className="input input-bordered h-11 min-h-11 w-full min-w-0 text-sm"
                    value={draft.capacity}
                    onChange={(event) => updateDraft(slot.id, { capacity: event.target.value })}
                    required
                  />
                </label>
                <label className="slot-row-cell form-control">
                  <span className="label-text">공개 상태</span>
                  <select
                    name={`status-${slot.id}`}
                    className="select select-bordered h-11 min-h-11 w-full min-w-0 text-sm"
                    value={draft.status}
                    onChange={(event) => updateDraft(slot.id, { status: event.target.value as TimeslotStatus })}
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
                    disabled={slot.reservedCount > 0 || Boolean(deletingSlotId)}
                    title={slot.reservedCount > 0 ? "예약 이력이 있는 일정은 삭제할 수 없습니다." : "일정 삭제"}
                    onClick={() => setDeletingSlotId(slot.id)}
                  >
                    {deleting ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
                    {deleting ? "삭제 중" : "삭제"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="slot-bulk-save-bar" data-dirty={dirtyCount > 0 ? "true" : undefined}>
          <div className="grid gap-1 text-sm font-semibold text-base-content/65">
            <span>정원과 공개 상태 변경사항을 한 번에 저장합니다.</span>
            {dirtyCount > 0 && <span className="slot-save-pending">{dirtyCount}개 일정 수정 예정 · 저장 전까지 반영되지 않습니다.</span>}
          </div>
          <PendingSubmitButton className="btn btn-primary gap-2" pendingChildren="저장 중" disabled={dirtyCount === 0}>
            <Save className="size-4" aria-hidden="true" />
            전체 수정사항 저장
          </PendingSubmitButton>
        </div>
        <FormLoadingModal title="시간표 변경사항을 저장하고 있습니다" description="일정 정원과 공개 상태를 반영하는 중입니다." />
      </form>
      {timeslots.map((slot) => (
        <form key={`delete-${slot.id}`} id={`delete-timeslot-${slot.id}`} action={deleteTimeslotAction} className="hidden">
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="timeslotId" value={slot.id} />
        </form>
      ))}
      <LoadingModal
        open={Boolean(deletingSlotId)}
        title="일정을 삭제하고 있습니다"
        description="선택한 일정을 시간표에서 제거하는 중입니다."
      />
    </>
  );
}
