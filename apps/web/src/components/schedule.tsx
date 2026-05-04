"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { Clock, Hash, Users, X } from "lucide-react";
import type { Event, EventDay, Timeslot } from "@scheduler/db";
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
  event: _event,
  day,
  timeslots,
  mode
}: {
  event: Event;
  day?: EventDay;
  timeslots: Timeslot[];
  mode: "participant" | "admin";
}) {
  const visibleTimeslots = mode === "participant" ? timeslots.filter((slot) => slot.status !== "HIDDEN") : timeslots;
  const adminTimetable = mode === "admin" ? getAdminTimetable(day, visibleTimeslots) : { rows: [], blocks: [], laneCount: 1, ticks: [] };
  const [selectedSlot, setSelectedSlot] = useState<Timeslot | null>(null);
  const selectedLoadState = selectedSlot ? getLoadState(selectedSlot) : null;
  const selectedRemaining = selectedSlot ? Math.max(0, selectedSlot.capacity - selectedSlot.reservedCount) : 0;
  const selectedUsage = selectedSlot?.capacity ? Math.round((selectedSlot.reservedCount / selectedSlot.capacity) * 100) : 0;

  return (
    <section className={`schedule-section schedule-${mode} space-y-3`}>
      <div>
        <h2 className="text-xl font-semibold">전체 시간표</h2>
        <p className="text-sm text-base-content/60">{day?.eventDate ?? "날짜 미정"}</p>
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
                    {formatTime(slot.startsAt)} - {formatTime(slot.endsAt)}
                  </div>
                  <div className="schedule-slot-meta">
                    예약 {slot.reservedCount}/{slot.capacity} · 잔여 {remaining}석
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
                      className={`timetable-slot-block schedule-load-${loadState}`}
                      style={{ gridColumn: lane + 1, gridRow: `${startIndex + 1} / span ${span}` }}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      aria-label={`${formatTime(slot.startsAt)} - ${formatTime(slot.endsAt)} 일정 상세 보기`}
                    >
                      <div className="timetable-slot-title">
                        {formatTime(slot.startsAt)} - {formatTime(slot.endsAt)}
                      </div>
                      <div className="timetable-slot-meta">
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
          {selectedSlot && selectedLoadState && (
            <div className="modal modal-open" role="dialog" aria-modal="true" aria-labelledby="timeslot-detail-title">
              <div className="modal-box max-w-xl p-0">
                <div className="flex items-start justify-between gap-3 border-b border-base-200 p-4">
                  <div className="min-w-0">
                    <h3 id="timeslot-detail-title" className="text-lg font-bold">
                      일정 상세
                    </h3>
                    <p className="mt-1 text-sm font-semibold text-base-content/65">
                      {formatTime(selectedSlot.startsAt)} - {formatTime(selectedSlot.endsAt)}
                    </p>
                  </div>
                  <button className="btn btn-ghost btn-sm btn-square" type="button" aria-label="닫기" onClick={() => setSelectedSlot(null)}>
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
                <div className="grid gap-3 p-4">
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
                </div>
              </div>
              <button className="modal-backdrop" type="button" aria-label="닫기" onClick={() => setSelectedSlot(null)}>
                닫기
              </button>
            </div>
          )}
        </div>
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
                      {formatTime(slot.startsAt)} - {formatTime(slot.endsAt)}
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
