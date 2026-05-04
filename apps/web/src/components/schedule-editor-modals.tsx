"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarPlus, Clock, Plus, X } from "lucide-react";
import { addEventDayAction, addTimeslotAction } from "@/app/actions";
import { FormLoadingModal, PendingSubmitButton } from "@/components/loading-modal";
import { KoreanTimeInput } from "@/components/korean-time-input";

const MODAL_EXIT_MS = 180;

type DayOption = {
  id: string;
  eventDate: string;
  label: string | null;
};

type ScheduleEditorModalsProps = {
  eventId: string;
  days: DayOption[];
  defaultCapacity: number;
};

function useAnimatedDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  const openModal = useCallback(() => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    setIsClosing(false);
    dialogRef.current?.showModal();
  }, []);

  const closeModal = useCallback(() => {
    if (!dialogRef.current?.open || isClosing) return;
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      dialogRef.current?.close();
      setIsClosing(false);
      closeTimerRef.current = null;
    }, MODAL_EXIT_MS);
  }, [isClosing]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  return { dialogRef, isClosing, openModal, closeModal };
}

export function ScheduleEditorModals({ eventId, days, defaultCapacity }: ScheduleEditorModalsProps) {
  const dayDialog = useAnimatedDialog();
  const slotDialog = useAnimatedDialog();

  return (
    <>
      <div className="schedule-editor-actions surface-flat">
        <button className="btn btn-outline gap-2" type="button" onClick={dayDialog.openModal}>
          <CalendarPlus className="size-4" aria-hidden="true" />
          행사 날짜 추가
        </button>
        <button className="btn btn-primary gap-2" type="button" onClick={slotDialog.openModal}>
          <Plus className="size-4" aria-hidden="true" />
          예외 일정 추가
        </button>
      </div>

      <dialog
        ref={dayDialog.dialogRef}
        className="modal schedule-editor-modal"
        data-closing={dayDialog.isClosing ? "true" : undefined}
        onCancel={(event) => {
          event.preventDefault();
          dayDialog.closeModal();
        }}
      >
        <div className="modal-box max-w-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">행사 날짜 추가</h2>
              <p className="mt-1 text-sm text-base-content/60">여러 날 운영하는 행사일 때 날짜와 운영 시간을 추가합니다.</p>
            </div>
            <button className="btn btn-ghost btn-sm" type="button" onClick={dayDialog.closeModal} aria-label="닫기">
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>

          <form action={addEventDayAction} className="mt-5 grid gap-3">
            <input type="hidden" name="eventId" value={eventId} />
            <label className="form-control">
              <span className="label-text">날짜</span>
              <input name="eventDate" type="date" className="input input-bordered" required />
            </label>
            <label className="form-control">
              <span className="label-text">라벨</span>
              <input name="label" className="input input-bordered" placeholder="Day 2" />
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <KoreanTimeInput name="startsAt" label="시작" />
              <KoreanTimeInput name="endsAt" label="종료" />
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" type="button" onClick={dayDialog.closeModal}>
                취소
              </button>
              <PendingSubmitButton className="btn btn-primary gap-2" pendingChildren="추가 중">
                <CalendarPlus className="size-4" aria-hidden="true" />
                추가
              </PendingSubmitButton>
            </div>
            <FormLoadingModal title="행사 날짜를 추가하고 있습니다" description="운영 날짜 정보를 저장하는 중입니다." />
          </form>
        </div>
        <div className="modal-backdrop" onClick={dayDialog.closeModal}>
          <button type="button">닫기</button>
        </div>
      </dialog>

      <dialog
        ref={slotDialog.dialogRef}
        className="modal schedule-editor-modal"
        data-closing={slotDialog.isClosing ? "true" : undefined}
        onCancel={(event) => {
          event.preventDefault();
          slotDialog.closeModal();
        }}
      >
        <div className="modal-box max-w-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">예외 일정 추가</h2>
              <p className="mt-1 text-sm text-base-content/60">기본 간격과 다른 회차만 별도로 추가합니다.</p>
            </div>
            <button className="btn btn-ghost btn-sm" type="button" onClick={slotDialog.closeModal} aria-label="닫기">
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>

          <form action={addTimeslotAction} className="mt-5 grid gap-3">
            <input type="hidden" name="eventId" value={eventId} />
            <label className="form-control">
              <span className="label-text">행사 날짜</span>
              <select name="eventDayId" className="select select-bordered" required>
                {days.map((day) => (
                  <option key={day.id} value={day.id}>
                    {day.label ?? day.eventDate} · {day.eventDate}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <KoreanTimeInput name="startsAt" label="시작" required />
              <KoreanTimeInput name="endsAt" label="종료" required />
            </div>
            <label className="form-control">
              <span className="label-text">정원</span>
              <input name="capacity" type="number" min={1} className="input input-bordered" defaultValue={defaultCapacity} required />
            </label>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" type="button" onClick={slotDialog.closeModal}>
                취소
              </button>
              <PendingSubmitButton className="btn btn-primary gap-2" pendingChildren="추가 중">
                <Clock className="size-4" aria-hidden="true" />
                추가
              </PendingSubmitButton>
            </div>
            <FormLoadingModal title="예외 일정을 추가하고 있습니다" description="선택한 시간대를 시간표에 반영하는 중입니다." />
          </form>
        </div>
        <div className="modal-backdrop" onClick={slotDialog.closeModal}>
          <button type="button">닫기</button>
        </div>
      </dialog>
    </>
  );
}
