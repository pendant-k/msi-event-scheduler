import type { Event, EventDay, Timeslot } from "@scheduler/db";
import { formatTime } from "@/lib/format";

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
      <div className="grid gap-2">
        {timeslots.map((slot) => {
          const remaining = Math.max(0, slot.capacity - slot.reservedCount);
          const full = remaining === 0;
          return (
            <div key={slot.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-base-300 bg-base-100 p-3">
              <div>
                <div className="font-medium">
                  {formatTime(slot.startsAt)} - {formatTime(slot.endsAt)}
                </div>
                <div className="text-sm text-base-content/60">
                  {mode === "admin"
                    ? `예약 ${slot.reservedCount} / 정원 ${slot.capacity}`
                    : full
                      ? "마감"
                      : `잔여 ${remaining}석`}
                </div>
              </div>
              <div className={`badge ${full ? "badge-error" : "badge-success"}`}>
                {slot.status === "OPEN" ? (full ? "마감" : "예약 가능") : "닫힘"}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
