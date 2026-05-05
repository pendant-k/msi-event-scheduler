"use client";

import { useMemo, useState } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { DataTable } from "@scheduler/ui/data-table";
import { Ban, RefreshCw, RotateCcw, Save, Trophy, UserCheck, UserX } from "lucide-react";
import { addTournamentApplicationAction, updateReservationStatusAction } from "@/app/actions";
import { FormLoadingModal, PendingSubmitButton } from "@/components/loading-modal";
import { formatClockTime, formatDateTime, formatTime } from "@/lib/format";
import { getReservationStatusLabel, isActiveReservationStatus } from "@/lib/status-labels";

export type AdminReservationRow = {
  id: string;
  reservationCode: string;
  status: string;
  tournament: boolean;
  participantName: string;
  school: string;
  grade: number;
  phoneNumber: string;
  timeslotTitle: string | null;
  startsAt: string;
  endsAt: string;
  timeslotId: string;
};

type AdminReservationsPayload = {
  rows: AdminReservationRow[];
  updatedAt: string;
};

type AdminLiveReservationsProps = {
  eventId: string;
  enableTournament: boolean;
  initialRows: AdminReservationRow[];
  initialUpdatedAt: string;
  query?: string;
};

const refetchInterval = 5000;
const editableStatuses = ["RESERVED", "LATE_RESERVED", "CHECKED_IN", "NO_SHOW", "CANCELLED"] as const;

async function fetchReservations(eventId: string, query?: string): Promise<AdminReservationsPayload> {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  const response = await fetch(`/api/admin/events/${eventId}/reservations?${params.toString()}`, {
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error("예약 정보를 불러오지 못했습니다.");
  }
  return response.json() as Promise<AdminReservationsPayload>;
}

function RefreshButton({ isFetching, onRefresh }: { isFetching: boolean; onRefresh: () => void }) {
  return (
    <button
      className="btn btn-outline btn-sm gap-2 border-[var(--app-blue)]/25 bg-[var(--app-blue)]/8 text-[var(--app-blue)] hover:border-[var(--app-blue)] hover:bg-[var(--app-blue)] hover:text-white"
      type="button"
      aria-label="예약 새로고침"
      disabled={isFetching}
      onClick={onRefresh}
    >
      <RefreshCw aria-hidden="true" className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
      <span>{isFetching ? "확인 중" : "예약 새로고침"}</span>
    </button>
  );
}

function getTimeslotLabel(row: Pick<AdminReservationRow, "timeslotTitle" | "startsAt" | "endsAt">) {
  const time = `${formatDateTime(row.startsAt)} - ${formatTime(row.endsAt)}`;
  return row.timeslotTitle ? `${row.timeslotTitle} · ${time}` : time;
}

export function AdminReservationActionCard({
  eventId,
  enableTournament,
  row
}: {
  eventId: string;
  enableTournament: boolean;
  row: AdminReservationRow;
}) {
  const tournamentActionDisabled = row.tournament || row.status === "CANCELLED" || row.status === "NO_SHOW";

  return (
    <div className="reservation-action-card">
      <div className="min-w-0">
        <div className="reservation-action-title">
          <span>{row.participantName}</span>
        </div>
        <div className="reservation-action-meta">
          <span>{row.school}</span>
          <span>{row.grade}학년</span>
          <span>{getTimeslotLabel(row)}</span>
          <span>{row.phoneNumber}</span>
          <span>{row.reservationCode}</span>
        </div>
      </div>

      <div className="reservation-action-buttons">
        <form action={updateReservationStatusAction}>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="reservationId" value={row.id} />
          <input type="hidden" name="status" value="CHECKED_IN" />
          <input type="hidden" name="reason" value="admin_quick_check_in" />
          <PendingSubmitButton className="btn btn-primary btn-sm gap-2" pendingChildren="체크인 중" disabled={row.status === "CHECKED_IN"}>
            <UserCheck aria-hidden="true" className="h-4 w-4" />
            체크인
          </PendingSubmitButton>
          <FormLoadingModal title="체크인 처리 중입니다" description={`${row.participantName} 예약 상태를 갱신하고 있습니다.`} />
        </form>
        {row.status === "CHECKED_IN" && (
          <form action={updateReservationStatusAction}>
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="reservationId" value={row.id} />
            <input type="hidden" name="status" value="RESERVED" />
            <input type="hidden" name="reason" value="admin_undo_check_in" />
            <PendingSubmitButton className="btn btn-outline btn-sm gap-2" pendingChildren="취소 중">
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              체크인 취소
            </PendingSubmitButton>
            <FormLoadingModal title="체크인을 취소하고 있습니다" description={`${row.participantName} 예약 상태를 되돌리는 중입니다.`} />
          </form>
        )}
        <form action={updateReservationStatusAction}>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="reservationId" value={row.id} />
          <input type="hidden" name="status" value="NO_SHOW" />
          <input type="hidden" name="reason" value="admin_quick_no_show" />
          <PendingSubmitButton className="btn btn-no-show btn-sm gap-2" pendingChildren="노쇼 처리 중" disabled={row.status === "NO_SHOW"}>
            <UserX aria-hidden="true" className="h-4 w-4" />
            노쇼
          </PendingSubmitButton>
          <FormLoadingModal title="노쇼 처리 중입니다" description={`${row.participantName} 예약 상태를 갱신하고 있습니다.`} />
        </form>
        <form action={updateReservationStatusAction}>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="reservationId" value={row.id} />
          <input type="hidden" name="status" value="CANCELLED" />
          <input type="hidden" name="reason" value="admin_cancel" />
          <PendingSubmitButton className="btn btn-cancel-reservation btn-sm gap-2" pendingChildren="취소 중" disabled={row.status === "CANCELLED"}>
            <Ban aria-hidden="true" className="h-4 w-4" />
            취소
          </PendingSubmitButton>
          <FormLoadingModal title="예약을 취소하고 있습니다" description={`${row.participantName} 예약을 취소 처리하는 중입니다.`} />
        </form>
        {enableTournament && (
          <form action={addTournamentApplicationAction}>
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="reservationId" value={row.id} />
            <PendingSubmitButton className="btn btn-outline btn-sm gap-2" pendingChildren="추가 중" disabled={tournamentActionDisabled}>
              <Trophy aria-hidden="true" className="h-4 w-4" />
              {row.tournament ? "대회 신청됨" : "대회 신청 추가"}
            </PendingSubmitButton>
            <FormLoadingModal title="대회 신청을 추가하고 있습니다" description={`${row.participantName} 예약을 대회 신청으로 변경하는 중입니다.`} />
          </form>
        )}
        <form action={updateReservationStatusAction} className="reservation-status-form">
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="reservationId" value={row.id} />
          <input type="hidden" name="reason" value="admin_status_select" />
          <select className="select select-bordered select-sm" name="status" defaultValue={row.status}>
            {editableStatuses.map((status) => (
              <option key={status} value={status}>
                {getReservationStatusLabel(status)}
              </option>
            ))}
          </select>
          <PendingSubmitButton className="btn btn-outline btn-sm gap-2" pendingChildren="변경 중">
            <Save aria-hidden="true" className="h-4 w-4" />
            상태 변경
          </PendingSubmitButton>
          <FormLoadingModal title="예약 상태를 변경하고 있습니다" description={`${row.participantName} 예약 상태를 저장하는 중입니다.`} />
        </form>
      </div>
    </div>
  );
}

function AdminLiveReservationsInner({ eventId, enableTournament, initialRows, initialUpdatedAt, query }: AdminLiveReservationsProps) {
  const initialData = useMemo<AdminReservationsPayload>(
    () => ({ rows: initialRows, updatedAt: initialUpdatedAt }),
    [initialRows, initialUpdatedAt]
  );
  const { data, error, isFetching, refetch } = useQuery({
    queryKey: ["admin-reservations", eventId, query ?? ""],
    queryFn: () => fetchReservations(eventId, query),
    initialData,
    refetchInterval,
    refetchIntervalInBackground: true
  });
  const rows = data.rows;
  const lastUpdatedAt = formatClockTime(data.updatedAt);
  const activeCount = rows.filter((row) => isActiveReservationStatus(row.status)).length;
  const checkedInCount = rows.filter((row) => row.status === "CHECKED_IN").length;

  const tableRows = rows.map((row) => ({
    time: getTimeslotLabel(row),
    name: row.participantName,
    school: row.school,
    grade: `${row.grade}`,
    phone: row.phoneNumber,
    status: getReservationStatusLabel(row.status),
    tournament: row.tournament ? "신청" : "-"
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2 text-sm font-semibold text-base-content/60">
          <span>전체 {rows.length}건</span>
          <span>활성 {activeCount}건</span>
          <span>체크인 {checkedInCount}건</span>
          <span className="text-xs text-base-content/45">마지막 확인 {lastUpdatedAt}</span>
        </div>
        <RefreshButton isFetching={isFetching} onRefresh={() => void refetch()} />
      </div>
      {error && <div className="alert alert-warning">예약 정보를 다시 확인하지 못했습니다.</div>}
      <section className="surface-flat p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">예약 테이블</h2>
          <div className="text-xs font-semibold text-base-content/45">검색 결과 {rows.length}건</div>
        </div>
        <DataTable
          rows={tableRows}
          columns={[
            { key: "time", label: "시간" },
            { key: "name", label: "이름" },
            { key: "school", label: "학교" },
            { key: "grade", label: "학년" },
            { key: "phone", label: "전화번호" },
            { key: "status", label: "상태" },
            { key: "tournament", label: "대회" }
          ]}
        />
      </section>

      <section className="surface-flat p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">체크인/예약 처리</h2>
          <div className="text-sm font-semibold text-base-content/55">활성 예약 {activeCount}건</div>
        </div>
        <div className="reservation-action-list">
          {rows.map((row) => (
            <AdminReservationActionCard key={row.id} eventId={eventId} enableTournament={enableTournament} row={row} />
          ))}
          {rows.length === 0 && <div className="alert">예약 내역이 없습니다.</div>}
        </div>
      </section>
    </div>
  );
}

export function AdminLiveReservations(props: AdminLiveReservationsProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AdminLiveReservationsInner {...props} />
    </QueryClientProvider>
  );
}
