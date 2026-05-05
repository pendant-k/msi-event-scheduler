import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTournamentDashboard } from "@scheduler/domain";
import { TournamentManagement } from "@/components/tournament-management";
import { getAdminUserId } from "@/lib/auth";
import { getAppDb } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function AdminTournamentPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const adminUserId = await getAdminUserId();
  if (!adminUserId) redirect("/admin");

  const dashboard = await getTournamentDashboard(await getAppDb(), eventId, adminUserId);
  if (!dashboard.event.enableTournament) {
    return <div className="alert alert-warning">이 행사는 대회 기능이 꺼져 있습니다.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/events/${eventId}`} className="btn btn-ghost btn-sm">
          <ArrowLeft className="size-4" aria-hidden="true" />
          운영 허브
        </Link>
        <h1 className="mt-3 text-2xl font-bold">대회 관리</h1>
        <p className="text-sm text-base-content/60">{dashboard.event.name}</p>
      </div>

      <TournamentManagement
        eventId={eventId}
        applicants={dashboard.applicants}
        tournament={dashboard.tournament ?? null}
        entrants={dashboard.entrants}
        matches={dashboard.matches}
      />
    </div>
  );
}
