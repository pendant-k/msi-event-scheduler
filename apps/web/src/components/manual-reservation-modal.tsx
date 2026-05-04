"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { manualOverbookAction } from "@/app/actions";
import { formatDateTime } from "@/lib/format";

const MODAL_EXIT_MS = 180;

type ManualReservationSlot = {
  id: string;
  startsAt: string;
  reservedCount: number;
  capacity: number;
};

type ManualReservationModalProps = {
  eventId: string;
  enableTournament: boolean;
  timeslots: ManualReservationSlot[];
};

export function ManualReservationModal({ eventId, enableTournament, timeslots }: ManualReservationModalProps) {
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

  return (
    <>
      <button className="btn btn-accent btn-sm text-white" type="button" onClick={openModal}>
        <Plus aria-hidden="true" className="h-4 w-4" />
        수동 예약 추가
      </button>

      <dialog
        ref={dialogRef}
        className="modal manual-reservation-modal"
        data-closing={isClosing ? "true" : undefined}
        onCancel={(event) => {
          event.preventDefault();
          closeModal();
        }}
      >
        <div className="modal-box max-w-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">수동 예약 추가</h2>
              <p className="mt-1 text-sm text-base-content/60">현장에서 운영자가 확인한 참가자를 예약에 직접 추가합니다.</p>
            </div>
            <button className="btn btn-ghost btn-sm" type="button" onClick={closeModal} aria-label="닫기">
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>

          <form action={manualOverbookAction} className="mt-5 grid gap-3 md:grid-cols-2">
            <input type="hidden" name="eventId" value={eventId} />
            <label className="form-control md:col-span-2">
              <span className="label-text">일정</span>
              <select name="timeslotId" className="select select-bordered" required>
                {timeslots.map((slot) => (
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
            {enableTournament && (
              <label className="label cursor-pointer justify-start gap-3">
                <input name="tournament" type="checkbox" className="checkbox" />
                <span className="label-text">대회 참가 신청</span>
              </label>
            )}
            <div className="flex justify-end gap-2 md:col-span-2">
              <button className="btn btn-ghost" type="button" onClick={closeModal}>
                취소
              </button>
              <button className="btn btn-primary" type="submit">
                추가하기
              </button>
            </div>
          </form>
        </div>
        <div className="modal-backdrop" onClick={closeModal}>
          <button type="button">닫기</button>
        </div>
      </dialog>
    </>
  );
}
