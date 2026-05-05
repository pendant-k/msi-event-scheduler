import Link from "next/link";
import { getSchedule, searchCheckInRows } from "@scheduler/domain";
import { ArrowLeft, Download, Search } from "lucide-react";
import { AdminLiveReservations } from "@/components/admin-live-reservations";
import { ManualReservationModal } from "@/components/manual-reservation-modal";
import { getAdminUserId } from "@/lib/auth";
import { getAppDb } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function AdminReservationsPage({
  params,
  searchParams
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { eventId } = await params;
  const { q } = await searchParams;
  const adminUserId = await getAdminUserId();
  if (!adminUserId) redirect("/admin");
  const db = await getAppDb();
  const schedule = await getSchedule(db, eventId);
  if (!schedule) return <div className="alert alert-error">행사를 찾을 수 없습니다.</div>;
  const rows = await searchCheckInRows(db, { eventId, query: q });
  const initialUpdatedAt = new Date().toISOString();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/admin/events/${eventId}`} className="btn btn-ghost btn-sm">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            운영 허브
          </Link>
          <h1 className="mt-3 text-2xl font-bold">예약/체크인 관리</h1>
          <p className="text-sm text-base-content/60">
            {schedule.event.name} · 전화번호 뒷자리, 이름, 학교, 예약번호로 검색합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ManualReservationModal
            eventId={eventId}
            enableTournament={schedule.event.enableTournament}
            timeslots={schedule.timeslots}
          />
          <Link href={`/admin/events/${eventId}/export`} className="btn btn-outline btn-sm">
            <Download aria-hidden="true" className="h-4 w-4" />
            CSV Export
          </Link>
        </div>
      </div>

      <form className="surface-flat flex flex-col gap-2 p-3 sm:flex-row">
        <label className="sr-only" htmlFor="reservation-search">
          예약 검색
        </label>
        <input
          id="reservation-search"
          name="q"
          className="input input-bordered flex-1"
          placeholder="예: 1234, 홍길동, OO초, 예약번호"
          defaultValue={q ?? ""}
        />
        <button className="btn btn-primary gap-2" type="submit">
          <Search aria-hidden="true" className="h-4 w-4" />
          검색
        </button>
      </form>

      <AdminLiveReservations
        eventId={eventId}
        enableTournament={schedule.event.enableTournament}
        initialRows={rows}
        initialUpdatedAt={initialUpdatedAt}
        query={q}
      />
    </div>
  );
}
