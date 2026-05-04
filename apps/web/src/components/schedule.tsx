import type { CSSProperties } from "react";
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
  if (timeslots.length === 0 && !day?.startsAt && !day?.endsAt) return { rows: [], blocks: [], laneCount: 1 };

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

  return { rows, blocks, laneCount: Math.max(1, laneEnds.length) };
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
  const adminTimetable = mode === "admin" ? getAdminTimetable(day, visibleTimeslots) : { rows: [], blocks: [], laneCount: 1 };

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
              <div className="timetable-lanes-head">타임슬롯</div>
              {adminTimetable.rows.map((row, index) => (
                <div
                  key={row.id}
                  className={`timetable-time ${row.hasSlot ? "" : "is-empty"}`}
                  style={{ gridColumn: 1, gridRow: index + 2 }}
                >
                  <span>{formatTime(isoValue(row.startsAt))}</span>
                  <small>{formatTime(isoValue(row.endsAt))}</small>
                </div>
              ))}
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
                    <div
                      key={slot.id}
                      className={`timetable-slot-block schedule-load-${loadState}`}
                      style={{ gridColumn: lane + 1, gridRow: `${startIndex + 1} / span ${span}` }}
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
                    </div>
                  );
                })}
              </div>
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
