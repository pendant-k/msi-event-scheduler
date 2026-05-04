"use client";

import { useEffect, useRef, useState } from "react";
import { ClipboardList, X } from "lucide-react";
import { cancelParticipantReservationAction, participantAccessAction } from "@/app/actions";
import { FormLoadingModal, PendingSubmitButton } from "@/components/loading-modal";
import { formatDateTime } from "@/lib/format";
import { getReservationStatusLabel, getReservationStatusTone } from "@/lib/status-labels";

type ReservationRow = {
  id: string;
  reservationCode: string;
  status: string;
  tournament: boolean;
  participantName: string;
  school: string;
  grade: number;
  startsAt: string;
};

type ParticipantReservationsModalProps = {
  eventId: string;
  rows: ReservationRow[];
  authenticated: boolean;
  defaultOpen?: boolean;
};

export function ParticipantReservationsModal({ eventId, rows, authenticated, defaultOpen = false }: ParticipantReservationsModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen]);

  return (
    <>
      <button className="btn btn-outline btn-sm" type="button" onClick={() => setOpen(true)}>
        <ClipboardList className="size-4" aria-hidden="true" />
        내 예약 확인
      </button>
      <dialog ref={dialogRef} className="modal participant-reservations-modal" onClose={() => setOpen(false)}>
        <div className="modal-box p-0">
          <div className="participant-reservations-modal-header border-b border-base-200 p-4">
            <div className="min-w-0">
              <h2 className="text-lg font-bold">내 예약 확인</h2>
              <p className="mt-1 text-sm text-base-content/60">
                {authenticated ? "예약 내역과 상태를 확인합니다." : "예약 시 사용한 전화번호와 비밀번호로 확인합니다."}
              </p>
            </div>
            <button
              className="btn btn-ghost btn-sm participant-reservations-modal-close"
              type="button"
              aria-label="닫기"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          {authenticated ? (
            <div className="max-h-[70dvh] overflow-y-auto p-4">
              {rows.length === 0 ? (
                <div className="admin-empty-hint">예약 내역이 없습니다.</div>
              ) : (
                <div className="grid gap-3">
                  {rows.map((row) => (
                    <div key={row.id} className="reservation-history-card">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-semibold">{row.participantName}</div>
                          <div className={`status-pill status-pill-${getReservationStatusTone(row.status)}`}>
                            {getReservationStatusLabel(row.status)}
                          </div>
                        </div>
                        <div className="mt-1 text-sm text-base-content/60">
                          {row.school} · {row.grade}학년 · {formatDateTime(row.startsAt)}
                        </div>
                        <div className="mt-2 text-sm font-semibold">예약번호: {row.reservationCode}</div>
                      </div>
                      {(row.status === "RESERVED" || row.status === "LATE_RESERVED") && (
                        <form action={cancelParticipantReservationAction}>
                          <input type="hidden" name="eventId" value={eventId} />
                          <input type="hidden" name="reservationId" value={row.id} />
                          <PendingSubmitButton className="btn btn-error btn-outline btn-sm gap-2" pendingChildren="취소 중">
                            예약 취소
                          </PendingSubmitButton>
                          <FormLoadingModal title="예약을 취소하고 있습니다" description={`${row.participantName}님의 예약 상태를 갱신하는 중입니다.`} />
                        </form>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form action={participantAccessAction} className="grid gap-3 p-4">
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="redirectTo" value={`/event/${eventId}?reservations=1`} />
              <label className="form-control">
                <span className="label-text">전화번호</span>
                <input name="phoneNumber" className="input input-bordered" inputMode="tel" required />
              </label>
              <label className="form-control">
                <span className="label-text">행사 비밀번호</span>
                <input name="password" type="password" className="input input-bordered" required />
              </label>
              <p className="text-sm text-base-content/60">비밀번호를 잊은 경우 현장 운영자에게 문의해 주세요.</p>
              <PendingSubmitButton className="btn btn-primary w-full gap-2" pendingChildren="확인 중">
                확인하기
              </PendingSubmitButton>
              <FormLoadingModal title="예약 내역을 확인하고 있습니다" description="입력한 전화번호와 비밀번호를 확인하는 중입니다." />
            </form>
          )}
        </div>
        <form method="dialog" className="modal-backdrop">
          <button aria-label="닫기">close</button>
        </form>
      </dialog>
    </>
  );
}
