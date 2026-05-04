"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const MODAL_EXIT_MS = 180;

export function PrivacyNoticeModal() {
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
      <button
        className="privacy-notice-trigger"
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          openModal();
        }}
      >
        개인정보 수집 및 이용 안내
      </button>

      <dialog
        ref={dialogRef}
        className="modal privacy-notice-modal"
        data-closing={isClosing ? "true" : undefined}
        onCancel={(event) => {
          event.preventDefault();
          closeModal();
        }}
      >
        <div className="modal-box max-w-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">개인정보 수집 및 이용 안내</h2>
              <p className="mt-1 text-sm text-base-content/60">행사 예약과 현장 운영을 위해 필요한 최소한의 개인정보만 수집합니다.</p>
            </div>
            <button className="btn btn-ghost btn-sm" type="button" onClick={closeModal} aria-label="닫기">
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>

          <div className="privacy-notice-content mt-5 space-y-4 text-sm">
            <section>
              <h3 className="font-bold">수집 항목</h3>
              <p className="mt-1 text-base-content/70">전화번호, 참가자 이름, 학교, 학년, 보호자 동행 확인, 예약 정보, 체크인 정보</p>
            </section>
            <section>
              <h3 className="font-bold">이용 목적</h3>
              <p className="mt-1 text-base-content/70">예약 생성, 예약 확인, 현장 체크인, 정원 관리, 운영 문의 대응</p>
            </section>
            <section>
              <h3 className="font-bold">보관 기간</h3>
              <p className="mt-1 text-base-content/70">행사 종료 후 기본 90일간 보관한 뒤 삭제 또는 익명화합니다.</p>
            </section>
            <section>
              <h3 className="font-bold">문의</h3>
              <p className="mt-1 text-base-content/70">비밀번호를 잊은 경우 현장 운영자에게 문의해 주세요.</p>
            </section>
          </div>

          <div className="mt-5 flex justify-end">
            <button className="btn btn-primary" type="button" onClick={closeModal}>
              확인
            </button>
          </div>
        </div>
        <div className="modal-backdrop" onClick={closeModal}>
          <button type="button">닫기</button>
        </div>
      </dialog>
    </>
  );
}
