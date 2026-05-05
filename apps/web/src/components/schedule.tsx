"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { Clock, Hash, Loader2, Save, Trash2, Users, X } from "lucide-react";
import type { Event, EventDay, Timeslot } from "@scheduler/db";
import { deleteTimeslotAction, updateTimeslotAction } from "@/app/actions";
import { AdminRefreshButton } from "@/components/admin-refresh-button";
import type { AdminReservationRow } from "@/components/admin-live-reservations";
import { AdminReservationActionCard } from "@/components/admin-live-reservations";
import { FormLoadingModal, PendingSubmitButton } from "@/components/loading-modal";
import { formatTime } from "@/lib/format";

function getLoadState(slot: Timeslot) {
  if (slot.status !== "OPEN") return "closed";
  if (slot.capacity <= 0 || slot.reservedCount >= slot.capacity) return "full";
  const ratio = slot.reservedCount / slot.capacity;
  if (ratio >= 0.8) return "high";
  if (ratio >= 0.5) return "medium";
  return "low";
}

const statusLabels = {
  OPEN: "예약 가능",
  CLOSED: "마감",
  HIDDEN: "숨김"
} as const;

const loadStateLabels = {
  low: "여유",
  medium: "보통",
  high: "혼잡",
  full: "만석",
  closed: "예약 불가"
} as const;

const halfHourMs = 30 * 60 * 1000;

function floorToHalfHour(value: number) {
  return Math.floor(value / halfHourMs) * halfHourMs;
}

function ceilToHalfHour(value: number) {
  return Math.ceil(value / halfHourMs) * halfHourMs;
}

function dateValue(value: string) {
  return new Date(value).getTime();
}

function isoValue(value: number) {
  return new Date(value).toISOString();
}

function slotTitle(slot: Timeslot) {
  return slot.title?.trim() || `${formatTime(slot.startsAt)} - ${formatTime(slot.endsAt)}`;
}

function slotTime(slot: Timeslot) {
  return `${formatTime(slot.startsAt)} - ${formatTime(slot.endsAt)}`;
}

async function fetchTimeslotReservations(eventId: string, timeslotId: string) {
  const params = new URLSearchParams({ timeslotId });
  const response = await fetch(`/api/admin/events/${eventId}/reservations?${params.toString()}`, { cache: "no-store" });
  if (!response.ok) throw new Error("예약 정보를 불러오지 못했습니다.");
  return response.json() as Promise<{ rows: AdminReservationRow[]; updatedAt: string }>;
}

function getAdminTimetable(day: EventDay | undefined, timeslots: Timeslot[]) {
  if (timeslots.length === 0 && !day?.startsAt && !day?.endsAt) return { rows: [], blocks: [], laneCount: 1, ticks: [] };

  const starts = timeslots.map((slot) => dateValue(slot.startsAt));
  const ends = timeslots.map((slot) => dateValue(slot.endsAt));
  if (day?.startsAt) starts.push(dateValue(day.startsAt));
  if (day?.endsAt) ends.push(dateValue(day.endsAt));

  const start = floorToHalfHour(Math.min(...starts));
  const end = ceilToHalfHour(Math.max(...ends));
  const rows = [];
  for (let cursor = start; cursor < end; cursor += halfHourMs) {
    const rowEnd = cursor + halfHourMs;
    rows.push({
      id: `${cursor}-${rowEnd}`,
      startsAt: cursor,
      endsAt: rowEnd,
      hasSlot: timeslots.some((slot) => dateValue(slot.startsAt) < rowEnd && dateValue(slot.endsAt) > cursor)
    });
  }

  const laneEnds: number[] = [];
  const blocks = [...timeslots]
    .sort((left, right) => dateValue(left.startsAt) - dateValue(right.startsAt) || dateValue(left.endsAt) - dateValue(right.endsAt))
    .map((slot) => {
      const slotStart = dateValue(slot.startsAt);
      const slotEnd = dateValue(slot.endsAt);
      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= slotStart);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = slotEnd;

      return {
        slot,
        lane,
        startIndex: Math.max(0, Math.floor((slotStart - start) / halfHourMs)),
        span: Math.max(1, Math.ceil((slotEnd - slotStart) / halfHourMs))
      };
    });

  const lastRow = rows.at(-1);
  const ticks = lastRow ? [...rows.map((row) => row.startsAt), lastRow.endsAt] : [];

  return { rows, blocks, laneCount: Math.max(1, laneEnds.length), ticks };
}

export function Schedule({
  event,
  day,
  timeslots,
  mode
}: {
  event: Event;
  day?: EventDay;
  timeslots: Timeslot[];
  mode: "participant" | "admin";
}) {
  const [showHiddenSlots, setShowHiddenSlots] = useState(false);
  const hiddenTimeslotCount = timeslots.filter((slot) => slot.status === "HIDDEN").length;
  const visibleTimeslots = mode === "participant" ? timeslots.filter((slot) => slot.status !== "HIDDEN") : timeslots;
  const adminDisplayTimeslots =
    mode === "admin" && !showHiddenSlots ? visibleTimeslots.filter((slot) => slot.status !== "HIDDEN") : visibleTimeslots;
  const adminTimetable = mode === "admin" ? getAdminTimetable(day, adminDisplayTimeslots) : { rows: [], blocks: [], laneCount: 1, ticks: [] };
  const [selectedSlot, setSelectedSlot] = useState<Timeslot | null>(null);
  const [detailTab, setDetailTab] = useState<"overview" | "settings" | "reservations">("overview");
  const [slotRows, setSlotRows] = useState<AdminReservationRow[]>([]);
  const [slotRowsLoading, setSlotRowsLoading] = useState(false);
  const [slotRowsError, setSlotRowsError] = useState(false);
  const selectedLoadState = selectedSlot ? getLoadState(selectedSlot) : null;
  const selectedRemaining = selectedSlot ? Math.max(0, selectedSlot.capacity - selectedSlot.reservedCount) : 0;
  const selectedUsage = selectedSlot?.capacity ? Math.round((selectedSlot.reservedCount / selectedSlot.capacity) * 100) : 0;

  useEffect(() => {
    if (mode !== "admin" || !selectedSlot) return;
    let ignore = false;
    setDetailTab("overview");
    setSlotRows([]);
    setSlotRowsError(false);
    setSlotRowsLoading(true);
    fetchTimeslotReservations(event.id, selectedSlot.id)
      .then((payload) => {
        if (!ignore) setSlotRows(payload.rows);
      })
      .catch(() => {
        if (!ignore) setSlotRowsError(true);
      })
      .finally(() => {
        if (!ignore) setSlotRowsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [event.id, mode, selectedSlot]);

  return (
    <section className={`schedule-section schedule-${mode} space-y-3`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">전체 시간표</h2>
          <p className="text-sm text-base-content/60">{day?.eventDate ?? "날짜 미정"}</p>
        </div>
        {mode === "admin" && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {hiddenTimeslotCount > 0 && (
              <label className="timetable-hidden-toggle">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={showHiddenSlots}
                  onChange={(event) => setShowHiddenSlots(event.target.checked)}
                />
                <span>숨김 일정 표시</span>
                <strong>{hiddenTimeslotCount}</strong>
              </label>
            )}
            <AdminRefreshButton label="시간표 새로고침" />
          </div>
        )}
      </div>

      {mode === "participant" && (
        <div className="schedule-card-list">
          {visibleTimeslots.map((slot) => {
            const remaining = Math.max(0, slot.capacity - slot.reservedCount);
            const loadState = getLoadState(slot);
            const bookable = slot.status === "OPEN" && remaining > 0;
            return (
              <div key={slot.id} className={`schedule-slot-card schedule-load-${loadState}`}>
                <div className="min-w-0">
                  <div className="schedule-slot-time">
                    {slotTitle(slot)}
                  </div>
                  <div className="schedule-slot-meta">
                    {slot.title ? `${slotTime(slot)} · ` : ""}예약 {slot.reservedCount}/{slot.capacity} · 잔여 {remaining}석
                  </div>
                </div>
                {bookable ? (
                  <a href="#reservation-form" className="btn btn-primary btn-sm">
                    예약
                  </a>
                ) : (
                  <span className="btn btn-disabled btn-sm">마감</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {mode === "admin" ? (
        <>
          <div className="timetable-wrap surface-flat overflow-x-auto">
            {adminTimetable.rows.length === 0 ? (
              <div className="timetable-empty">표시할 타임라인이 없습니다.</div>
            ) : (
              <div
                className="timetable"
                style={
                  {
                    gridTemplateRows: `2.75rem repeat(${adminTimetable.rows.length}, 3.25rem)`
                  } satisfies CSSProperties
                }
              >
              <div className="timetable-corner">시간</div>
              <div className="timetable-lanes-head">일정</div>
              <div
                className="timetable-time-axis"
                style={
                  {
                    gridColumn: 1,
                    gridRow: `2 / span ${adminTimetable.rows.length}`,
                    gridTemplateRows: `repeat(${adminTimetable.rows.length}, 3.25rem)`
                  } satisfies CSSProperties
                }
              >
                {adminTimetable.rows.map((row, index) => (
                  <div
                    key={row.id}
                    className={`timetable-time-row ${row.hasSlot ? "" : "is-empty"}`}
                    style={{ gridRow: index + 1 }}
                  />
                ))}
                {adminTimetable.ticks.map((tick, index) => (
                  <div
                    key={tick}
                    className={`timetable-time-tick ${index === 0 ? "is-first" : ""} ${
                      index === adminTimetable.ticks.length - 1 ? "is-last" : ""
                    }`}
                    style={{ top: `${(index / adminTimetable.rows.length) * 100}%` }}
                  >
                    {formatTime(isoValue(tick))}
                  </div>
                ))}
              </div>
              <div
                className="timetable-lanes"
                style={
                  {
                    gridColumn: 2,
                    gridRow: `2 / span ${adminTimetable.rows.length}`,
                    gridTemplateColumns: `repeat(${adminTimetable.laneCount}, minmax(12rem, 1fr))`,
                    gridTemplateRows: `repeat(${adminTimetable.rows.length}, 3.25rem)`
                  } satisfies CSSProperties
                }
              >
                {adminTimetable.rows.map((row, index) => (
                  <div
                    key={row.id}
                    className={`timetable-row-bg ${row.hasSlot ? "" : "is-empty"}`}
                    style={{ gridColumn: "1 / -1", gridRow: index + 1 }}
                  />
                ))}
                {adminTimetable.rows.map((row, index) =>
                  row.hasSlot ? null : (
                    <div key={`${row.id}-empty`} className="timetable-empty-label" style={{ gridColumn: "1 / -1", gridRow: index + 1 }}>
                      운영 없음
                    </div>
                  )
                )}
                {adminTimetable.blocks.map(({ slot, lane, startIndex, span }) => {
                  const loadState = getLoadState(slot);
                  return (
                    <button
                      key={slot.id}
                      className={`timetable-slot-block schedule-load-${loadState} ${slot.status === "HIDDEN" ? "timetable-slot-hidden" : ""}`}
                      style={{ gridColumn: lane + 1, gridRow: `${startIndex + 1} / span ${span}` }}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      aria-label={`${slotTitle(slot)} 일정 상세 보기`}
                    >
                      <div className="timetable-slot-title">{slotTitle(slot)}</div>
                      <div className="timetable-slot-meta">
                        {slot.title && <span>{slotTime(slot)}</span>}
                        <span>{statusLabels[slot.status]}</span>
                        <span>
                          예약 {slot.reservedCount}/{slot.capacity}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              </div>
            )}
          </div>
          {selectedSlot && selectedLoadState && (
            <div className="modal modal-open" role="dialog" aria-modal="true" aria-labelledby="timeslot-detail-title">
              <div className="modal-box max-w-3xl p-0">
                <div className="flex items-start justify-between gap-3 border-b border-base-200 p-4">
                  <div className="min-w-0">
                    <h3 id="timeslot-detail-title" className="text-lg font-bold">
                      일정 상세
                    </h3>
                    <p className="mt-1 text-sm font-semibold text-base-content/65">
                      {selectedSlot.title ? `${selectedSlot.title} · ` : ""}
                      {slotTime(selectedSlot)}
                    </p>
                  </div>
                  <button className="btn btn-ghost btn-sm btn-square" type="button" aria-label="닫기" onClick={() => setSelectedSlot(null)}>
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
                <div className="border-b border-base-200 px-4 pt-3">
                  <div className="timeslot-modal-tabs" role="tablist" aria-label="일정 상세 탭">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={detailTab === "overview"}
                      data-active={detailTab === "overview" ? "true" : undefined}
                      onClick={() => setDetailTab("overview")}
                    >
                      상세
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={detailTab === "settings"}
                      data-active={detailTab === "settings" ? "true" : undefined}
                      onClick={() => setDetailTab("settings")}
                    >
                      설정
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={detailTab === "reservations"}
                      data-active={detailTab === "reservations" ? "true" : undefined}
                      onClick={() => setDetailTab("reservations")}
                    >
                      예약/체크인
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 p-4">
                  {detailTab === "overview" ? (
                    <>
                      <div className="timeslot-detail-hero">
                        <div>
                          <div className="timeslot-detail-label">공개 상태</div>
                          <div className={`timeslot-detail-status schedule-load-${selectedLoadState}`}>{statusLabels[selectedSlot.status]}</div>
                        </div>
                        <div className="text-right">
                          <div className="timeslot-detail-label">예약률</div>
                          <div className="text-xl font-black">{selectedUsage}%</div>
                        </div>
                      </div>
                      <div className="timeslot-detail-grid">
                        <div className="timeslot-detail-item">
                          <Clock className="size-4" aria-hidden="true" />
                          <span>시작</span>
                          <strong>{formatTime(selectedSlot.startsAt)}</strong>
                        </div>
                        <div className="timeslot-detail-item">
                          <Clock className="size-4" aria-hidden="true" />
                          <span>종료</span>
                          <strong>{formatTime(selectedSlot.endsAt)}</strong>
                        </div>
                        <div className="timeslot-detail-item">
                          <Users className="size-4" aria-hidden="true" />
                          <span>예약</span>
                          <strong>
                            {selectedSlot.reservedCount}/{selectedSlot.capacity}
                          </strong>
                        </div>
                        <div className="timeslot-detail-item">
                          <Users className="size-4" aria-hidden="true" />
                          <span>잔여</span>
                          <strong>{selectedRemaining}</strong>
                        </div>
                        <div className="timeslot-detail-item">
                          <Hash className="size-4" aria-hidden="true" />
                          <span>일정 ID</span>
                          <strong className="truncate">{selectedSlot.id}</strong>
                        </div>
                        <div className="timeslot-detail-item">
                          <Users className="size-4" aria-hidden="true" />
                          <span>부하</span>
                          <strong>{loadStateLabels[selectedLoadState]}</strong>
                        </div>
                      </div>
                    </>
                  ) : detailTab === "settings" ? (
                    <div className="timeslot-settings-panel">
                      <form action={updateTimeslotAction} className="timeslot-settings-form">
                        <input type="hidden" name="eventId" value={event.id} />
                        <input type="hidden" name="timeslotId" value={selectedSlot.id} />
                        <label className="form-control">
                          <span className="label-text">일정 이름</span>
                          <input
                            name="title"
                            className="input input-bordered"
                            defaultValue={selectedSlot.title ?? ""}
                            placeholder="예: 오전 체험"
                          />
                        </label>
                        <label className="form-control">
                          <span className="label-text">정원</span>
                          <input
                            name="capacity"
                            type="number"
                            min={selectedSlot.reservedCount}
                            className="input input-bordered"
                            defaultValue={selectedSlot.capacity}
                            required
                          />
                        </label>
                        <label className="form-control">
                          <span className="label-text">공개 상태</span>
                          <select name="status" className="select select-bordered" defaultValue={selectedSlot.status}>
                            <option value="OPEN">예약 가능</option>
                            <option value="CLOSED">마감</option>
                            <option value="HIDDEN">숨김</option>
                          </select>
                        </label>
                        <div className="timeslot-settings-actions">
                          <PendingSubmitButton className="btn btn-primary gap-2" pendingChildren="저장 중">
                            <Save className="size-4" aria-hidden="true" />
                            설정 저장
                          </PendingSubmitButton>
                        </div>
                      </form>
                      <form action={deleteTimeslotAction} className="timeslot-delete-form">
                        <input type="hidden" name="eventId" value={event.id} />
                        <input type="hidden" name="timeslotId" value={selectedSlot.id} />
                        <div className="min-w-0">
                          <div className="text-sm font-black">일정 삭제</div>
                          <div className="mt-1 text-xs font-semibold text-base-content/55">
                            예약 이력이 있는 일정은 삭제할 수 없습니다. 운영에서 제외하려면 숨김으로 저장하세요.
                          </div>
                        </div>
                        <PendingSubmitButton
                          className="btn btn-error btn-outline btn-sm gap-2"
                          pendingChildren="삭제 중"
                          disabled={selectedSlot.reservedCount > 0}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                          삭제
                        </PendingSubmitButton>
                        <FormLoadingModal title="일정을 삭제하고 있습니다" description="선택한 일정을 시간표에서 제거하는 중입니다." />
                      </form>
                    </div>
                  ) : (
                    <div className="timeslot-reservation-panel">
                      {slotRowsLoading && (
                        <div className="timeslot-reservation-state">
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          예약 정보를 확인하고 있습니다.
                        </div>
                      )}
                      {slotRowsError && <div className="alert alert-warning">예약 정보를 다시 확인하지 못했습니다.</div>}
                      {!slotRowsLoading && !slotRowsError && (
                        <div className="reservation-action-list">
                          {slotRows.map((row) => (
                            <AdminReservationActionCard
                              key={row.id}
                              eventId={event.id}
                              enableTournament={event.enableTournament}
                              row={row}
                            />
                          ))}
                          {slotRows.length === 0 && <div className="alert">이 시간대 예약이 없습니다.</div>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <button className="modal-backdrop" type="button" aria-label="닫기" onClick={() => setSelectedSlot(null)}>
                닫기
              </button>
            </div>
          )}
        </>
      ) : (
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
                const remaining = Math.max(0, slot.capacity - slot.reservedCount);
                const loadState = getLoadState(slot);
                const bookable = slot.status === "OPEN" && remaining > 0;
                return (
                  <tr key={slot.id}>
                    <td className="font-medium">
                        {slot.title ? (
                          <>
                            <span className="block">{slot.title}</span>
                            <span className="text-xs font-semibold text-base-content/50">{slotTime(slot)}</span>
                          </>
                        ) : (
                          slotTime(slot)
                        )}
                    </td>
                    <td className={`schedule-load-cell schedule-load-${loadState}`}>
                      {slot.reservedCount} / {slot.capacity}
                    </td>
                    <td>
                      {bookable ? (
                        <a href="#reservation-form" className="btn btn-primary btn-xs">
                          예약하기
                        </a>
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
      )}
    </section>
  );
}
