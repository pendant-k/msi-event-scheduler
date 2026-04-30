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
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold">전체 시간표</h2>
        <p className="text-sm text-base-content/60">
          {day?.eventDate ?? "날짜 미정"} · {event.name}
        </p>
      </div>

      <div className="surface-flat overflow-x-auto">
        <table className="schedule-table min-w-[640px] w-full text-sm">
          <thead>
            <tr>
              <th>시간</th>
              <th>예약 현황</th>
              {mode === "participant" && <th>신청</th>}
            </tr>
          </thead>
          <tbody>
            {timeslots.map((slot) => {
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
