"use client";

import { useEffect, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import type { EventDay, Timeslot } from "@scheduler/db";
import { RefreshCw } from "lucide-react";
import { createReservationAction } from "@/app/actions";
import { formatClockTime, formatTime } from "@/lib/format";
import { FormLoadingModal, PendingSubmitButton } from "./loading-modal";
import { PrivacyNoticeModal } from "./privacy-notice-modal";

type ParticipantReservationProps = {
  eventId: string;
  enableTournament: boolean;
  day?: EventDay;
  timeslots: Timeslot[];
  initialUpdatedAt: string;
};

type PublicSchedulePayload = {
  day: EventDay | null;
  timeslots: Timeslot[];
  updatedAt: string;
};

const refetchInterval = 5000;

function getLoadState(slot: Timeslot) {
  if (slot.status !== "OPEN") return "closed";
  if (slot.capacity <= 0 || slot.reservedCount >= slot.capacity) return "full";
  const ratio = slot.reservedCount / slot.capacity;
  if (ratio >= 0.8) return "high";
  if (ratio >= 0.5) return "medium";
  return "low";
}

function getRemaining(slot: Timeslot) {
  return Math.max(0, slot.capacity - slot.reservedCount);
}

function getBookable(slot: Timeslot) {
  return slot.status === "OPEN" && getRemaining(slot) > 0;
}

function getSlotTitle(slot: Timeslot) {
  return slot.title?.trim() || `${formatTime(slot.startsAt)} - ${formatTime(slot.endsAt)}`;
}

function getSlotTime(slot: Timeslot) {
  return `${formatTime(slot.startsAt)} - ${formatTime(slot.endsAt)}`;
}

async function fetchPublicSchedule(eventId: string): Promise<PublicSchedulePayload> {
  const response = await fetch(`/api/events/${eventId}/schedule`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("시간표를 불러오지 못했습니다.");
  }
  return response.json() as Promise<PublicSchedulePayload>;
}

function ParticipantReservationInner({ eventId, enableTournament, day, timeslots, initialUpdatedAt }: ParticipantReservationProps) {
  const initialData = useMemo<PublicSchedulePayload>(
    () => ({ day: day ?? null, timeslots, updatedAt: initialUpdatedAt }),
    [day, timeslots, initialUpdatedAt]
  );
  const { data, error, isFetching, refetch } = useQuery({
    queryKey: ["public-schedule", eventId],
    queryFn: () => fetchPublicSchedule(eventId),
    initialData,
    refetchInterval,
    refetchIntervalInBackground: true
  });
  const activeDay = data.day ?? day;
  const activeTimeslots = data.timeslots;
  const visibleTimeslots = useMemo(() => activeTimeslots.filter((slot) => slot.status !== "HIDDEN"), [activeTimeslots]);
  const openSlots = useMemo(() => visibleTimeslots.filter(getBookable), [visibleTimeslots]);
  const [selectedTimeslotId, setSelectedTimeslotId] = useState(openSlots[0]?.id ?? "");
  const lastUpdatedAt = formatClockTime(data.updatedAt);

  useEffect(() => {
    if (!openSlots.some((slot) => slot.id === selectedTimeslotId)) {
      setSelectedTimeslotId(openSlots[0]?.id ?? "");
    }
  }, [openSlots, selectedTimeslotId]);

  function selectTimeslot(timeslotId: string) {
    setSelectedTimeslotId(timeslotId);
    document.getElementById("reservation-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <div className="space-y-6">
        <section className="schedule-section schedule-participant space-y-3">
          <div>
            <h2 className="text-xl font-semibold">전체 시간표</h2>
            <p className="text-sm text-base-content/60">{activeDay?.eventDate ?? "날짜 미정"}</p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold text-base-content/45">마지막 확인 {lastUpdatedAt}</div>
            <button
              className="btn btn-outline btn-sm gap-2 border-[var(--app-blue)]/25 bg-[var(--app-blue)]/8 text-[var(--app-blue)] hover:border-[var(--app-blue)] hover:bg-[var(--app-blue)] hover:text-white"
              type="button"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              <RefreshCw aria-hidden="true" className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              {isFetching ? "확인 중" : "새로고침"}
            </button>
          </div>
          {error && <div className="alert alert-warning">시간표를 다시 확인하지 못했습니다.</div>}

          <div className="schedule-card-list">
            {visibleTimeslots.map((slot) => {
              const remaining = getRemaining(slot);
              const loadState = getLoadState(slot);
              const bookable = getBookable(slot);
              const selected = selectedTimeslotId === slot.id;
              return (
                <div
                  key={slot.id}
                  className={`schedule-slot-card schedule-load-${loadState}`}
                  data-selected={selected ? "true" : undefined}
                >
                  <div className="min-w-0">
                    <div className="schedule-slot-time">{getSlotTitle(slot)}</div>
                    <div className="schedule-slot-meta">
                      {slot.title ? `${getSlotTime(slot)} · ` : ""}예약 {slot.reservedCount}/{slot.capacity} · 잔여 {remaining}석
                    </div>
                  </div>
                  {bookable ? (
                    <button
                      className={`btn btn-sm ${selected ? "btn-primary" : "btn-outline"}`}
                      type="button"
                      onClick={() => selectTimeslot(slot.id)}
                    >
                      {selected ? "선택됨" : "선택"}
                    </button>
                  ) : (
                    <span className="btn btn-disabled btn-sm">마감</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="schedule-table-wrap surface-flat overflow-x-auto">
            <table className="schedule-table min-w-[640px] w-full text-sm">
              <thead>
                <tr>
                  <th>시간</th>
                  <th>예약 현황</th>
                  <th>신청</th>
                </tr>
              </thead>
              <tbody>
                {visibleTimeslots.map((slot) => {
                  const remaining = getRemaining(slot);
                  const loadState = getLoadState(slot);
                  const bookable = getBookable(slot);
                  const selected = selectedTimeslotId === slot.id;
                  return (
                    <tr key={slot.id} data-selected={selected ? "true" : undefined}>
                      <td className="font-medium">
                        {slot.title ? (
                          <>
                            <span className="block">{slot.title}</span>
                            <span className="text-xs font-semibold text-base-content/50">{getSlotTime(slot)}</span>
                          </>
                        ) : (
                          getSlotTime(slot)
                        )}
                      </td>
                      <td className={`schedule-load-cell schedule-load-${loadState}`}>
                        {slot.reservedCount} / {slot.capacity}
                      </td>
                      <td>
                        {bookable ? (
                          <button
                            className={`btn btn-xs ${selected ? "btn-primary" : "btn-outline"}`}
                            type="button"
                            onClick={() => selectTimeslot(slot.id)}
                          >
                            {selected ? "선택됨" : "선택"}
                          </button>
                        ) : (
                          <span className="btn btn-disabled btn-xs">마감</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <aside id="reservation-form" className="reservation-panel surface-flat scroll-mt-6 p-4">
        <form action={createReservationAction} className="space-y-3">
          <h2 className="text-lg font-semibold">예약하기</h2>
          <input type="hidden" name="eventId" value={eventId} />
          <label className="form-control">
            <span className="label-text">시간 선택</span>
            <select
              name="timeslotId"
              className="select select-bordered"
              required
              value={selectedTimeslotId}
              onChange={(event) => setSelectedTimeslotId(event.target.value)}
            >
              {openSlots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.title ? `${slot.title} · ` : ""}
                  {getSlotTime(slot)} · 잔여 {getRemaining(slot)}석
                </option>
              ))}
            </select>
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
          <div className="privacy-consent-row">
            <input
              name="privacyConsent"
              type="checkbox"
              className="checkbox mt-1"
              required
              aria-label="개인정보 수집 및 이용 안내 동의"
            />
            <span className="label-text">
              <PrivacyNoticeModal />
              에 동의합니다.
            </span>
          </div>
          <PendingSubmitButton className="btn btn-primary w-full gap-2" pendingChildren="예약 신청 중" disabled={!selectedTimeslotId}>
            예약하기
          </PendingSubmitButton>
          <FormLoadingModal title="예약을 신청하고 있습니다" description="선택한 시간대의 잔여석을 확인하고 예약을 저장하는 중입니다." />
        </form>
      </aside>
    </>
  );
}

export function ParticipantReservation(props: ParticipantReservationProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ParticipantReservationInner {...props} />
    </QueryClientProvider>
  );
}
