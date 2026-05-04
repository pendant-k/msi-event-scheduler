import Link from "next/link";
import { getSchedule, searchCheckInRows } from "@scheduler/domain";
import { ArrowLeft, Download } from "lucide-react";
import { AdminLiveReservations } from "@/components/admin-live-reservations";
import { ManualReservationModal } from "@/components/manual-reservation-modal";
import { getAdminUserId } from "@/lib/auth";
import { getAppDb } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function AdminReservationsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const adminUserId = await getAdminUserId();
  if (!adminUserId) redirect("/admin");
  const db = await getAppDb();
  const schedule = await getSchedule(db, eventId);
  if (!schedule) return <div className="alert alert-error">행사를 찾을 수 없습니다.</div>;
  const rows = await searchCheckInRows(db, { eventId });
  const initialUpdatedAt = new Date().toISOString();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/admin/events/${eventId}`} className="btn btn-ghost btn-sm">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            운영 허브
          </Link>
          <h1 className="mt-3 text-2xl font-bold">예약 관리</h1>
          <p className="text-sm text-base-content/60">{schedule.event.name}</p>
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

      <AdminLiveReservations eventId={eventId} initialRows={rows} initialUpdatedAt={initialUpdatedAt} mode="reservations" />
    </div>
  );
}
