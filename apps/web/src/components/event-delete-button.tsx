"use client";

import { useState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { deleteEventAction } from "@/app/actions";
import { FormLoadingModal, PendingSubmitButton } from "@/components/loading-modal";

type EventDeleteButtonProps = {
  eventId: string;
  eventName: string;
};

export function EventDeleteButton({ eventId, eventName }: EventDeleteButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="btn btn-error btn-outline btn-sm btn-square"
        type="button"
        aria-label={`${eventName} 삭제`}
        title="행사 삭제"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
      {open && (
        <div className="modal modal-open" role="dialog" aria-modal="true" aria-labelledby="event-delete-title">
          <div className="modal-box max-w-md p-0">
            <div className="flex items-start justify-between gap-3 border-b border-base-200 p-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-error/10 text-error">
                  <AlertTriangle className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2 id="event-delete-title" className="text-lg font-bold">
                    행사 삭제
                  </h2>
                  <p className="mt-1 text-sm text-base-content/60">삭제하면 예약, 참가자, 일정 데이터도 함께 제거됩니다.</p>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm btn-square" type="button" aria-label="닫기" onClick={() => setOpen(false)}>
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <form action={deleteEventAction} className="grid gap-4 p-4">
              <input type="hidden" name="eventId" value={eventId} />
              <div className="rounded-lg bg-base-200 p-3">
                <div className="text-xs font-black text-base-content/50">삭제 대상</div>
                <div className="mt-1 truncate text-sm font-bold">{eventName}</div>
              </div>
              <div className="flex justify-end gap-2">
                <button className="btn btn-ghost" type="button" onClick={() => setOpen(false)}>
                  취소
                </button>
                <PendingSubmitButton className="btn btn-error gap-2" pendingChildren="삭제 중">
                  <Trash2 className="size-4" aria-hidden="true" />
                  삭제
                </PendingSubmitButton>
              </div>
              <FormLoadingModal title="행사를 삭제하고 있습니다" description="연관 예약과 일정 데이터를 함께 정리하는 중입니다." />
            </form>
          </div>
          <button className="modal-backdrop" type="button" aria-label="닫기" onClick={() => setOpen(false)}>
            닫기
          </button>
        </div>
      )}
    </>
  );
}
