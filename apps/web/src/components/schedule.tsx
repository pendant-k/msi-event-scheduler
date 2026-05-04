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

      <div className="schedule-table-wrap surface-flat overflow-x-auto">
        <table className="schedule-table min-w-[640px] w-full text-sm">
          <thead>
            <tr>
              <th>시간</th>
              {mode === "admin" && <th>상태</th>}
              <th>예약 현황</th>
              {mode === "participant" && <th>신청</th>}
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
                  {mode === "admin" && (
                    <td>
                      <span className={`schedule-status-pill schedule-load-${loadState}`}>{statusLabels[slot.status]}</span>
                    </td>
                  )}
                  <td className={`schedule-load-cell schedule-load-${loadState}`}>
                    {slot.reservedCount} / {slot.capacity}
                  </td>
                  {mode === "participant" && (
                    <td>
                      {bookable ? (
                        <a href="#reservation-form" className="btn btn-primary btn-xs">
                          예약하기
                        </a>
                      ) : (
                        <span className="btn btn-disabled btn-xs">마감</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
