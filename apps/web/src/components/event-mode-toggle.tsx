import Link from "next/link";

type EventModeToggleProps = {
  eventId: string;
  active: "reservation" | "admin";
};

export function EventModeToggle({ eventId, active }: EventModeToggleProps) {
  return (
    <nav className="mode-toggle" aria-label="행사 화면 전환">
      <Link
        href={`/event/${eventId}`}
        className="mode-toggle-item"
        aria-current={active === "reservation" ? "page" : undefined}
      >
        예약
      </Link>
      <Link href={`/admin/events/${eventId}`} className="mode-toggle-item" aria-current={active === "admin" ? "page" : undefined}>
        관리자
      </Link>
    </nav>
  );
}
