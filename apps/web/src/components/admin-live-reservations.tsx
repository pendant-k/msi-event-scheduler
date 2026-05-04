"use client";

import { useMemo, useState } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { DataTable } from "@scheduler/ui/data-table";
import { Ban, RefreshCw, UserX } from "lucide-react";
import { cancelAdminReservationAction, checkInAction, markNoShowAction } from "@/app/actions";
import { formatClockTime, formatDateTime } from "@/lib/format";
import { getReservationStatusLabel, getReservationStatusTone, isActiveReservationStatus } from "@/lib/status-labels";

export type AdminReservationRow = {
  id: string;
  reservationCode: string;
  status: string;
  tournament: boolean;
  participantName: string;
  school: string;
  grade: number;
  maskedPhone: string;
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
  initialRows: AdminReservationRow[];
  initialUpdatedAt: string;
  mode: "reservations" | "check-in";
  query?: string;
};

const refetchInterval = 5000;

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

function AdminLiveReservationsInner({ eventId, initialRows, initialUpdatedAt, mode, query }: AdminLiveReservationsProps) {
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

  const tableRows = rows.map((row) => ({
    time: formatDateTime(row.startsAt),
    name: row.participantName,
    school: row.school,
    grade: `${row.grade}`,
    phone: row.maskedPhone,
    status: getReservationStatusLabel(row.status),
    tournament: row.tournament ? "신청" : "-"
  }));

  if (mode === "check-in") {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold text-base-content/45">마지막 확인 {lastUpdatedAt}</div>
          <RefreshButton isFetching={isFetching} onRefresh={() => void refetch()} />
        </div>
        {error && <div className="alert alert-warning">예약 정보를 다시 확인하지 못했습니다.</div>}
        <div className="grid gap-2">
          {rows.map((row) => (
            <div key={row.id} className="surface-flat flex flex-wrap items-center justify-between gap-3 p-3">
              <div>
                <div className="font-medium">
                  {row.participantName} · {row.school} · {row.grade}학년
                </div>
                <div className="text-sm text-base-content/60">
                  {formatDateTime(row.startsAt)} · {row.maskedPhone} · {row.reservationCode}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`status-pill status-pill-${getReservationStatusTone(row.status)}`}>
                  {getReservationStatusLabel(row.status)}
                </span>
                <form action={checkInAction}>
                  <input type="hidden" name="eventId" value={eventId} />
                  <input type="hidden" name="reservationId" value={row.id} />
                  <button className="btn btn-primary btn-sm" type="submit" disabled={row.status === "CHECKED_IN"}>
                    체크인
                  </button>
                </form>
              </div>
            </div>
          ))}
          {rows.length === 0 && <div className="alert">검색 결과가 없습니다.</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <RefreshButton isFetching={isFetching} onRefresh={() => void refetch()} />
      </div>
      {error && <div className="alert alert-warning">예약 정보를 다시 확인하지 못했습니다.</div>}
      <section className="surface-flat p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">예약 테이블</h2>
          <div className="text-xs font-semibold text-base-content/45">마지막 확인 {lastUpdatedAt}</div>
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
          <h2 className="text-lg font-semibold">취소/노쇼 처리</h2>
          <div className="text-sm font-semibold text-base-content/55">
            활성 예약 {rows.filter((row) => isActiveReservationStatus(row.status)).length}건
          </div>
        </div>
        <div className="reservation-action-list">
          {rows.map((row) => {
            const active = isActiveReservationStatus(row.status);
            return (
              <div key={row.id} className="reservation-action-card">
                <div className="min-w-0">
                  <div className="reservation-action-title">
                    <span>{row.participantName}</span>
                    <span className={`status-pill status-pill-${getReservationStatusTone(row.status)}`}>
                      {getReservationStatusLabel(row.status)}
                    </span>
                  </div>
                  <div className="reservation-action-meta">
                    <span>{row.school}</span>
                    <span>{row.grade}학년</span>
                    <span>{formatDateTime(row.startsAt)}</span>
                    <span>{row.maskedPhone}</span>
                    <span>{row.reservationCode}</span>
                  </div>
                </div>

                <div className="reservation-action-buttons">
                  <form action={markNoShowAction}>
                    <input type="hidden" name="eventId" value={eventId} />
                    <input type="hidden" name="reservationId" value={row.id} />
                    <button className="btn btn-no-show btn-sm" type="submit" disabled={!active}>
                      <UserX aria-hidden="true" className="h-4 w-4" />
                      노쇼 처리
                    </button>
                  </form>
                  <form action={cancelAdminReservationAction}>
                    <input type="hidden" name="eventId" value={eventId} />
                    <input type="hidden" name="reservationId" value={row.id} />
                    <input type="hidden" name="reason" value="admin_cancel" />
                    <button className="btn btn-cancel-reservation btn-sm" type="submit" disabled={!active}>
                      <Ban aria-hidden="true" className="h-4 w-4" />
                      예약 취소
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
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
