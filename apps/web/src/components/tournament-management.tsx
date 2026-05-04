"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFormStatus } from "react-dom";
import { AlertTriangle, Check, GitBranch, LoaderCircle, Play, RotateCcw, Shuffle, UserCheck, UserPlus, UserX, ZoomIn, ZoomOut } from "lucide-react";
import {
  cancelTournamentCheckInAction,
  createTournamentDraftAction,
  recordMatchWinnerAction,
  replaceMatchEntrantAction,
  startTournamentAction,
  tournamentCheckInAction
} from "@/app/actions";
import { FormLoadingModal, LoadingModal, PendingSubmitButton } from "@/components/loading-modal";
import { formatDateTime } from "@/lib/format";
import { getReservationStatusLabel } from "@/lib/status-labels";

type TournamentApplicant = {
  reservationId: string;
  reservationCode: string;
  reservationStatus: string;
  participantName: string;
  school: string;
  grade: number;
  maskedPhone: string;
  startsAt: string;
  tournamentCheckedIn: boolean;
  tournamentCheckedInAt: string | null;
};

type Tournament = {
  id: string;
  status: "DRAFT" | "STARTED" | "COMPLETED";
  bracketSize: number;
  seedingMode: "MANUAL" | "CHECK_IN_ORDER" | "RANDOM";
};

type TournamentEntrant = {
  id: string;
  reservationId: string;
  seed: number;
  participantName: string;
  school: string;
  grade: number;
  reservationCode: string;
};

type TournamentMatch = {
  id: string;
  tournamentId: string;
  kind: "MAIN" | "THIRD_PLACE";
  round: number;
  matchIndex: number;
  entrantAId: string | null;
  entrantBId: string | null;
  winnerEntrantId: string | null;
  status: "PENDING" | "READY" | "COMPLETED";
};

type TournamentManagementProps = {
  eventId: string;
  tournamentCapacity: number;
  applicants: TournamentApplicant[];
  tournament: Tournament | null;
  entrants: TournamentEntrant[];
  matches: TournamentMatch[];
};

type PickerState =
  | { kind: "match"; matchId: string; label: string; side: "A" | "B"; currentEntrantId: string | null };

const bracketSizes = [4, 8, 16, 32, 64];

const tournamentStatusLabels = {
  DRAFT: "준비 중",
  STARTED: "진행 중",
  COMPLETED: "완료"
} as const;

const bracketColumnWidth = "minmax(22rem, 24rem)";
const bracketRowHeightRem = 4.25;
const defaultBracketZoom = 0.65;
const minBracketZoom = 0.35;
const maxBracketZoom = 1.15;
const bracketZoomStep = 0.1;

function ConfirmingSubmitButton({
  children,
  className,
  message,
  pendingChildren,
  pendingTitle = "변경사항을 적용하고 있습니다",
  pendingDescription = "요청한 작업을 저장하는 중입니다.",
  disabled
}: {
  children: React.ReactNode;
  className: string;
  message: string;
  pendingChildren?: React.ReactNode;
  pendingTitle?: string;
  pendingDescription?: string;
  disabled?: boolean;
}) {
  const [form, setForm] = useState<HTMLFormElement | null>(null);
  const { pending } = useFormStatus();
  const modal =
    form && typeof document !== "undefined"
      ? createPortal(
          <div className="modal modal-open app-modal-layer" role="dialog" aria-modal="true">
            <div className="modal-box max-w-md">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
                  <AlertTriangle className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">변경사항 적용</h3>
                  <p className="mt-2 text-sm text-base-content/65">{message}</p>
                </div>
              </div>
              <div className="modal-action">
                <button className="btn btn-ghost" type="button" onClick={() => setForm(null)}>
                  취소
                </button>
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    const target = form;
                    setForm(null);
                    target.requestSubmit();
                  }}
                >
                  적용
                </button>
              </div>
            </div>
            <button className="modal-backdrop" type="button" aria-label="닫기" onClick={() => setForm(null)}>
              닫기
            </button>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        className={className}
        type="button"
        disabled={disabled || pending}
        onClick={(event) => {
          setForm(event.currentTarget.form);
        }}
      >
        {pending ? (
          <>
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            {pendingChildren ?? children}
          </>
        ) : (
          children
        )}
      </button>
      {modal}
      <LoadingModal open={pending} title={pendingTitle} description={pendingDescription} />
    </>
  );
}

function entrantLabel(entrant: TournamentEntrant | undefined) {
  if (!entrant) return "빈 자리";
  return `${entrant.participantName} · ${entrant.school} ${entrant.grade}학년`;
}

function roundLabel(round: number, bracketSize: number) {
  const size = bracketSize / 2 ** (round - 1);
  if (size === 2) return "결승";
  return `${size}강`;
}

function matchSourceLabel(match: TournamentMatch, side: "A" | "B", bracketSize: number) {
  if (match.kind === "THIRD_PLACE") {
    const sourceMatchIndex = side === "A" ? 1 : 2;
    return `${roundLabel(Math.max(1, Math.log2(bracketSize) - 1), bracketSize)} ${sourceMatchIndex}경기 패자`;
  }
  if (match.round > 1) {
    const sourceMatchIndex = side === "A" ? match.matchIndex * 2 - 1 : match.matchIndex * 2;
    return `${roundLabel(match.round - 1, bracketSize)} ${sourceMatchIndex}경기 승자`;
  }
  return side === "A" ? "상단 참가자" : "하단 참가자";
}

function pointerDistance(left: { x: number; y: number }, right: { x: number; y: number }) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

export function TournamentManagement({ eventId, tournamentCapacity, applicants, tournament, entrants, matches }: TournamentManagementProps) {
  const [query, setQuery] = useState("");
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [bracketZoom, setBracketZoom] = useState(defaultBracketZoom);
  const bracketZoomRef = useRef(defaultBracketZoom);
  const activePointers = useRef(new Map<number, { x: number; y: number }>());
  const panState = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const pinchState = useRef<{
    startDistance: number;
    startZoom: number;
  } | null>(null);
  const checkedInApplicants = applicants.filter((applicant) => applicant.tournamentCheckedIn);
  const filteredApplicants = applicants.filter((applicant) => {
    const target = `${applicant.participantName} ${applicant.school} ${applicant.maskedPhone} ${applicant.reservationCode}`.toLowerCase();
    return target.includes(query.trim().toLowerCase());
  });
  const entrantsById = useMemo(() => new Map(entrants.map((entrant) => [entrant.id, entrant])), [entrants]);
  const entrantReservationIds = new Set(entrants.map((entrant) => entrant.reservationId));
  const tournamentFlow = useMemo(() => {
    const bracketSize = tournament?.bracketSize ?? 32;
    const mainGroups = new Map<number, TournamentMatch[]>();
    const thirdPlaceMatches: TournamentMatch[] = [];
    for (const match of matches) {
      if (match.kind === "THIRD_PLACE") {
        thirdPlaceMatches.push(match);
        continue;
      }
      mainGroups.set(match.round, [...(mainGroups.get(match.round) ?? []), match]);
    }
    return {
      mainRounds: [...mainGroups.entries()]
        .sort(([leftRound], [rightRound]) => leftRound - rightRound)
        .map(([round, roundMatches]) => ({
          label: roundLabel(round, bracketSize),
          matches: [...roundMatches].sort((left, right) => left.matchIndex - right.matchIndex),
          round
        })),
      thirdPlaceMatches: thirdPlaceMatches.sort((left, right) => left.matchIndex - right.matchIndex)
    };
  }, [matches, tournament?.bracketSize]);
  const updateBracketZoom = (nextZoom: number) => {
    const clampedZoom = Math.min(maxBracketZoom, Math.max(minBracketZoom, Number(nextZoom.toFixed(2))));
    bracketZoomRef.current = clampedZoom;
    setBracketZoom(clampedZoom);
  };

  const renderMatchSide = (match: TournamentMatch, label: string, side: "A" | "B") => {
    const entrantId = side === "A" ? match.entrantAId : match.entrantBId;
    const entrant = entrantsById.get(entrantId ?? "");
    const source = tournament ? matchSourceLabel(match, side, tournament.bracketSize) : "";
    return (
      <div key={side} className="tournament-match-side" data-winner={match.winnerEntrantId === entrantId && entrantId ? "true" : undefined}>
        <div className="tournament-match-side-source">{source}</div>
        <div className="tournament-match-side-main">
          <div className="min-w-0">
            <div className="truncate font-bold">{entrantLabel(entrant)}</div>
            {entrant && <div className="text-xs text-base-content/55">{entrant.seed}번 자리 · {entrant.reservationCode}</div>}
          </div>
          <div className="tournament-match-side-actions">
            {entrantId && tournament && (
              <form action={recordMatchWinnerAction}>
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="tournamentId" value={tournament.id} />
                <input type="hidden" name="matchId" value={match.id} />
                <input type="hidden" name="winnerEntrantId" value={entrantId} />
                <ConfirmingSubmitButton
                  className="btn btn-ghost btn-xs shrink-0"
                  message="승자 변경으로 영향받는 후속 경기 결과가 초기화됩니다."
                  pendingChildren="저장 중"
                  pendingTitle="경기 결과를 저장하고 있습니다"
                  pendingDescription="선택한 승자와 후속 경기 정보를 갱신하는 중입니다."
                >
                  <Check className="size-3" aria-hidden="true" />
                  우승
                </ConfirmingSubmitButton>
              </form>
            )}
            <button
              className="btn btn-ghost btn-xs shrink-0 text-[var(--app-blue)]"
              type="button"
              onClick={() =>
                setPicker({
                  kind: "match",
                  matchId: match.id,
                  label: `${label} ${match.matchIndex}경기 ${side}`,
                  side,
                  currentEntrantId: entrantId ?? null
                })
              }
            >
              변경
            </button>
          </div>
        </div>
      </div>
    );
  };

  const matchGridStyle = (match: TournamentMatch) => {
    const slotSpan = 2 ** (match.round + 1);
    return {
      gridColumn: match.round,
      gridRow: `${(match.matchIndex - 1) * slotSpan + 1} / span ${slotSpan}`,
      "--merge-height": `${slotSpan * bracketRowHeightRem}rem`
    } as React.CSSProperties;
  };

  const createBracketForm = (
    <form action={createTournamentDraftAction} className="tournament-create-form tournament-create-form-compact">
      <input type="hidden" name="eventId" value={eventId} />
      <label className="form-control">
        <span className="label-text">대진 규모</span>
        <select name="bracketSize" className="select select-bordered" defaultValue={tournament?.bracketSize ?? 32}>
          {bracketSizes.map((size) => (
            <option key={size} value={size}>{size}강</option>
          ))}
        </select>
      </label>
      <label className="form-control">
        <span className="label-text">배치 방식</span>
        <select name="seedingMode" className="select select-bordered" defaultValue="CHECK_IN_ORDER">
          <option value="CHECK_IN_ORDER">체크인 순</option>
          <option value="RANDOM">랜덤</option>
          <option value="MANUAL">선택 순서</option>
        </select>
      </label>
      <div className="md:col-span-2">
        <div className="mb-2 text-sm font-bold">참가자</div>
        <div className="tournament-candidate-grid">
          {checkedInApplicants.map((applicant) => (
            <label key={applicant.reservationId} className="tournament-candidate">
              <input name="reservationId" type="checkbox" className="checkbox checkbox-sm" value={applicant.reservationId} defaultChecked />
              <span>
                <span className="block font-bold">{applicant.participantName}</span>
                <span className="block text-xs text-base-content/55">{applicant.school} · {applicant.reservationCode}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
      <ConfirmingSubmitButton
        className="btn btn-primary gap-2 md:col-span-2"
        message="새 대진표를 만들면 기존 대진표와 경기 결과가 대체됩니다."
        pendingChildren="생성 중"
        pendingTitle="대진표를 만들고 있습니다"
        pendingDescription="선택한 참가자를 기준으로 대진표와 경기 정보를 저장하는 중입니다."
        disabled={checkedInApplicants.length === 0}
      >
        <Shuffle className="size-4" aria-hidden="true" />
        {tournament ? "대진표 다시 만들기" : "대진표 만들기"}
      </ConfirmingSubmitButton>
    </form>
  );

  const renderMatchNode = (match: TournamentMatch, label: string, hasNextMatch = false) => {
    return (
      <div
        key={match.id}
        className="tournament-tree-node"
        data-completed={match.status === "COMPLETED" ? "true" : undefined}
        data-flow={hasNextMatch ? "true" : undefined}
        data-round={match.kind === "MAIN" ? match.round : undefined}
        data-match-parity={match.matchIndex % 2 === 1 ? "odd" : "even"}
        style={match.kind === "MAIN" ? matchGridStyle(match) : undefined}
      >
        {match.kind === "MAIN" && match.round > 1 && <span className="tournament-connector tournament-connector-in" aria-hidden="true" />}
        {hasNextMatch && <span className="tournament-connector tournament-connector-out" aria-hidden="true" />}
        {hasNextMatch && match.matchIndex % 2 === 1 && <span className="tournament-connector tournament-connector-merge" aria-hidden="true" />}
        <div className="tournament-node-head">
          <span>{match.matchIndex}경기</span>
          <span className="status-pill">{match.status === "COMPLETED" ? "완료" : match.status === "READY" ? "대기" : "미배정"}</span>
        </div>
        <div className="tournament-branch">
          {renderMatchSide(match, label, "A")}
          {renderMatchSide(match, label, "B")}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="stat-flat p-4">
          <div className="text-sm text-base-content/60">대회 정원</div>
          <div className="text-2xl font-bold">{tournamentCapacity}</div>
          <div className="text-sm text-base-content/60">행사 전체 기준</div>
        </div>
        <div className="stat-flat p-4">
          <div className="text-sm text-base-content/60">대회 신청</div>
          <div className="text-2xl font-bold">{applicants.length}</div>
          <div className="text-sm text-base-content/60">활성 예약</div>
        </div>
        <div className="stat-flat p-4">
          <div className="text-sm text-base-content/60">대회 체크인</div>
          <div className="text-2xl font-bold">{checkedInApplicants.length}</div>
          <div className="text-sm text-base-content/60">대진표 후보</div>
        </div>
        <div className="stat-flat p-4">
          <div className="text-sm text-base-content/60">대진표</div>
          <div className="text-2xl font-bold">{tournament ? tournamentStatusLabels[tournament.status] : "없음"}</div>
          <div className="text-sm text-base-content/60">{tournament ? `${tournament.bracketSize}강` : "생성 필요"}</div>
        </div>
      </div>

      <section className="surface-flat p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">대회 체크인</h2>
            <p className="text-sm text-base-content/60">행사 체크인과 별개로 대회 참가 확정자를 관리합니다.</p>
          </div>
          <label className="input input-bordered flex w-full items-center gap-2 sm:w-72">
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="grow" placeholder="이름, 학교, 번호 검색" />
          </label>
        </div>
        <div className="mt-3 grid gap-2">
          {filteredApplicants.map((applicant) => (
            <div key={applicant.reservationId} className="tournament-applicant-card">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{applicant.participantName}</span>
                  <span className="status-pill">{applicant.tournamentCheckedIn ? "대회 체크인 완료" : "대회 미체크인"}</span>
                  {entrantReservationIds.has(applicant.reservationId) && <span className="slot-row-pending">대진표 배정됨</span>}
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-sm text-base-content/60">
                  <span>{applicant.school} {applicant.grade}학년</span>
                  <span>{applicant.maskedPhone}</span>
                  <span>{applicant.reservationCode}</span>
                  <span>{getReservationStatusLabel(applicant.reservationStatus)}</span>
                  <span>{formatDateTime(applicant.startsAt)}</span>
                </div>
              </div>
              {applicant.tournamentCheckedIn ? (
                <form action={cancelTournamentCheckInAction}>
                  <input type="hidden" name="eventId" value={eventId} />
                  <input type="hidden" name="reservationId" value={applicant.reservationId} />
                  <ConfirmingSubmitButton
                    className="btn btn-outline btn-error btn-sm gap-2"
                    message="대회 체크인을 취소하면 대진표에 배정된 경우 영향받는 후속 경기 결과가 초기화됩니다."
                    pendingChildren="취소 중"
                    pendingTitle="대회 체크인을 취소하고 있습니다"
                    pendingDescription={`${applicant.participantName}님의 대회 체크인 상태를 갱신하는 중입니다.`}
                  >
                    <UserX className="size-4" aria-hidden="true" />
                    체크인 취소
                  </ConfirmingSubmitButton>
                </form>
              ) : (
                <form action={tournamentCheckInAction}>
                  <input type="hidden" name="eventId" value={eventId} />
                  <input type="hidden" name="reservationId" value={applicant.reservationId} />
                  <PendingSubmitButton className="btn btn-primary btn-sm gap-2" pendingChildren="체크인 중">
                    <UserCheck className="size-4" aria-hidden="true" />
                    대회 체크인
                  </PendingSubmitButton>
                  <FormLoadingModal title="대회 체크인 처리 중입니다" description={`${applicant.participantName}님의 대회 참가 상태를 저장하는 중입니다.`} />
                </form>
              )}
            </div>
          ))}
          {filteredApplicants.length === 0 && <div className="admin-empty-hint">대회 신청자가 없습니다.</div>}
        </div>
      </section>

      {!tournament && (
        <section className="surface-flat p-4">
          <div className="mb-3">
            <h2 className="text-lg font-semibold">대진표 만들기</h2>
            <p className="text-sm text-base-content/60">대회 체크인 완료자만 대진표에 배치할 수 있습니다.</p>
          </div>
          {createBracketForm}
        </section>
      )}

      {tournament && (
        <section className="surface-flat p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <GitBranch className="size-5 text-[var(--app-blue)]" aria-hidden="true" />
              <h2 className="text-lg font-semibold">토너먼트 현황</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {tournament.status === "DRAFT" && (
                <form action={startTournamentAction}>
                  <input type="hidden" name="eventId" value={eventId} />
                  <input type="hidden" name="tournamentId" value={tournament.id} />
                  <PendingSubmitButton className="btn btn-outline btn-sm gap-2" pendingChildren="시작 중">
                    <Play className="size-4" aria-hidden="true" />
                    진행 시작
                  </PendingSubmitButton>
                  <FormLoadingModal title="토너먼트를 시작하고 있습니다" description="대진표 상태를 진행 중으로 변경하는 중입니다." />
                </form>
              )}
              <details className="dropdown dropdown-end">
                <summary className="btn btn-ghost btn-sm gap-2">
                  <Shuffle className="size-4" aria-hidden="true" />
                  재생성
                </summary>
                <div className="dropdown-content z-20 mt-2 w-[min(34rem,calc(100vw-2rem))] rounded-lg border border-base-300 bg-base-100 p-4 shadow-xl">
                  <div className="mb-3">
                    <h3 className="font-bold">대진표 다시 만들기</h3>
                    <p className="text-sm text-base-content/60">기존 대진표와 경기 결과가 대체됩니다.</p>
                  </div>
                  {createBracketForm}
                </div>
              </details>
              <div className="tournament-zoom-controls" aria-label="대진표 확대 축소">
                <button
                  className="btn btn-ghost btn-sm btn-square"
                  type="button"
                  aria-label="대진표 축소"
                  onClick={() => updateBracketZoom(bracketZoom - bracketZoomStep)}
                  disabled={bracketZoom <= minBracketZoom}
                >
                  <ZoomOut className="size-4" aria-hidden="true" />
                </button>
                <span>{Math.round(bracketZoom * 100)}%</span>
                <button
                  className="btn btn-ghost btn-sm btn-square"
                  type="button"
                  aria-label="대진표 확대"
                  onClick={() => updateBracketZoom(bracketZoom + bracketZoomStep)}
                  disabled={bracketZoom >= maxBracketZoom}
                >
                  <ZoomIn className="size-4" aria-hidden="true" />
                </button>
                <button
                  className="btn btn-ghost btn-sm btn-square"
                  type="button"
                  aria-label="대진표 배율 초기화"
                  onClick={() => updateBracketZoom(defaultBracketZoom)}
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
          <div
            className="tournament-bracket-scroll"
            data-panning={isPanning ? "true" : undefined}
            onWheel={(event) => {
              if (!event.ctrlKey && !event.metaKey) return;
              event.preventDefault();
              updateBracketZoom(bracketZoomRef.current + (event.deltaY > 0 ? -0.08 : 0.08));
            }}
            onPointerDown={(event) => {
              if (event.pointerType === "mouse" && event.button !== 0) return;
              const target = event.target as HTMLElement;
              if (target.closest("button, a, input, select, textarea, label")) return;

              activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
              event.currentTarget.setPointerCapture(event.pointerId);

              if (activePointers.current.size === 2) {
                const pointers = [...activePointers.current.values()];
                const firstPointer = pointers[0];
                const secondPointer = pointers[1];
                if (!firstPointer || !secondPointer) return;
                pinchState.current = {
                  startDistance: pointerDistance(firstPointer, secondPointer),
                  startZoom: bracketZoomRef.current
                };
                panState.current = null;
                setIsPanning(false);
                return;
              }

              if (activePointers.current.size > 1) return;

              panState.current = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                scrollLeft: event.currentTarget.scrollLeft,
                scrollTop: event.currentTarget.scrollTop
              };
              setIsPanning(true);
            }}
            onPointerMove={(event) => {
              if (activePointers.current.has(event.pointerId)) {
                activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
              }

              if (pinchState.current && activePointers.current.size >= 2) {
                const pointers = [...activePointers.current.values()];
                const firstPointer = pointers[0];
                const secondPointer = pointers[1];
                if (!firstPointer || !secondPointer) return;
                const nextDistance = pointerDistance(firstPointer, secondPointer);
                if (pinchState.current.startDistance > 0) {
                  updateBracketZoom(pinchState.current.startZoom * (nextDistance / pinchState.current.startDistance));
                }
                return;
              }

              const current = panState.current;
              if (!current || current.pointerId !== event.pointerId) return;
              event.currentTarget.scrollLeft = current.scrollLeft - (event.clientX - current.startX);
              event.currentTarget.scrollTop = current.scrollTop - (event.clientY - current.startY);
            }}
            onPointerUp={(event) => {
              activePointers.current.delete(event.pointerId);
              if (activePointers.current.size < 2) {
                pinchState.current = null;
              }
              if (panState.current?.pointerId === event.pointerId) {
                panState.current = null;
                setIsPanning(false);
              }
            }}
            onPointerCancel={(event) => {
              activePointers.current.delete(event.pointerId);
              if (activePointers.current.size < 2) {
                pinchState.current = null;
              }
              if (panState.current?.pointerId === event.pointerId) {
                panState.current = null;
                setIsPanning(false);
              }
            }}
            onPointerLeave={(event) => {
              if (event.pointerType !== "mouse") return;
              activePointers.current.delete(event.pointerId);
              if (activePointers.current.size < 2) {
                pinchState.current = null;
              }
              if (panState.current?.pointerId === event.pointerId && event.buttons === 0) {
                panState.current = null;
                setIsPanning(false);
              }
            }}
          >
            <div className="tournament-bracket-canvas" style={{ zoom: bracketZoom } as React.CSSProperties}>
              <div
                className="tournament-bracket-header"
                style={{ gridTemplateColumns: `repeat(${tournamentFlow.mainRounds.length}, ${bracketColumnWidth})` }}
              >
                {tournamentFlow.mainRounds.map(({ label, matches: roundMatches }) => (
                  <div key={label} className="tournament-bracket-round-title">
                    <span>{label}</span>
                    <small>{roundMatches.length}경기</small>
                  </div>
                ))}
              </div>
              <div
                className="tournament-bracket-board"
                style={{
                  gridTemplateColumns: `repeat(${tournamentFlow.mainRounds.length}, ${bracketColumnWidth})`,
                  gridTemplateRows: `repeat(${tournament.bracketSize * 2}, ${bracketRowHeightRem}rem)`
                }}
              >
                {tournamentFlow.mainRounds.flatMap(({ label, matches: roundMatches, round }) =>
                  roundMatches.map((match) => renderMatchNode(match, label, round < Math.log2(tournament.bracketSize)))
                )}
              </div>
              {tournamentFlow.thirdPlaceMatches.length > 0 && (
                <div className="tournament-third-place">
                  <div className="tournament-bracket-round-title">
                    <span>3/4위전</span>
                    <small>{tournamentFlow.thirdPlaceMatches.length}경기</small>
                  </div>
                  <div className="tournament-third-place-list">
                    {tournamentFlow.thirdPlaceMatches.map((match) => renderMatchNode(match, "3/4위전", false))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
      {picker && tournament && (
        <div className="modal modal-open" role="dialog" aria-modal="true">
          <div className="modal-box max-w-2xl">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--app-blue-soft)] text-[var(--app-blue)]">
                <UserPlus className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold">{picker.label} 참가자 선택</h3>
                <p className="mt-1 text-sm text-base-content/60">선택하면 영향받는 후속 경기 결과는 초기화됩니다.</p>
              </div>
            </div>
            <div className="tournament-picker-list mt-4">
              <form action={replaceMatchEntrantAction} onSubmit={() => setPicker(null)}>
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="tournamentId" value={tournament.id} />
                <input type="hidden" name="matchId" value={picker.matchId} />
                <input type="hidden" name="side" value={picker.side} />
                <input type="hidden" name="entrantId" value="" />
                <button className="tournament-picker-option" type="submit" data-selected={!picker.currentEntrantId ? "true" : undefined}>
                  <span>
                    <strong>빈 자리</strong>
                    <small>이 경기 위치를 비워둡니다.</small>
                  </span>
                  <span>{!picker.currentEntrantId ? "현재 선택" : "선택"}</span>
                </button>
                <FormLoadingModal title="참가자 배정을 변경하고 있습니다" description="선택한 경기 위치를 비우는 중입니다." />
              </form>
              {entrants.map((entrant) => {
                const selected = picker.currentEntrantId === entrant.id;
                return (
                  <form key={entrant.id} action={replaceMatchEntrantAction} onSubmit={() => setPicker(null)}>
                    <input type="hidden" name="eventId" value={eventId} />
                    <input type="hidden" name="tournamentId" value={tournament.id} />
                    <input type="hidden" name="matchId" value={picker.matchId} />
                    <input type="hidden" name="side" value={picker.side} />
                    <input type="hidden" name="entrantId" value={entrant.id} />
                    <button className="tournament-picker-option" type="submit" data-selected={selected ? "true" : undefined}>
                      <span>
                        <strong>{entrant.participantName}</strong>
                        <small>
                          {entrant.school} {entrant.grade}학년 · {entrant.seed}번 자리 · {entrant.reservationCode}
                        </small>
                      </span>
                      <span>{selected ? "현재 선택" : "선택"}</span>
                    </button>
                    <FormLoadingModal title="참가자 배정을 변경하고 있습니다" description={`${entrant.participantName}님을 선택한 경기 위치에 저장하는 중입니다.`} />
                  </form>
                );
              })}
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost" type="button" onClick={() => setPicker(null)}>
                닫기
              </button>
            </div>
          </div>
          <button className="modal-backdrop" type="button" aria-label="닫기" onClick={() => setPicker(null)}>
            닫기
          </button>
        </div>
      )}
    </div>
  );
}
