import Link from "next/link";
import { getSchedule, searchCheckInRows } from "@scheduler/domain";
import { Schedule } from "@/components/schedule";
import { getAdminUserId } from "@/lib/auth";
import { getAppDb } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function AdminEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const adminUserId = await getAdminUserId();
  if (!adminUserId) redirect("/admin");
  const db = await getAppDb();
  const schedule = await getSchedule(db, eventId);
  if (!schedule) return <div className="alert alert-error">행사를 찾을 수 없습니다.</div>;
  const rows = await searchCheckInRows(db, { eventId });
  const checkedInCount = rows.filter((row) => row.status === "CHECKED_IN").length;
  const activeCount = rows.filter((row) => row.status === "RESERVED" || row.status === "LATE_RESERVED").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin" className="btn btn-ghost btn-sm">
            대시보드
          </Link>
          <h1 className="mt-3 text-2xl font-bold">{schedule.event.name}</h1>
          <p className="text-sm text-base-content/60">{schedule.event.description ?? "행사 운영 허브"}</p>
        </div>
        <Link href={`/event/${eventId}`} className="btn btn-outline btn-sm">
          참가자 페이지
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="stat-flat p-4">
          <div className="text-sm text-base-content/60">예약</div>
          <div className="text-2xl font-bold">{rows.length}</div>
          <div className="text-sm text-base-content/60">활성 {activeCount}건</div>
        </div>
        <div className="stat-flat p-4">
          <div className="text-sm text-base-content/60">체크인</div>
          <div className="text-2xl font-bold">{checkedInCount}</div>
          <div className="text-sm text-base-content/60">현장 처리 완료</div>
        </div>
        <div className="stat-flat p-4">
          <div className="text-sm text-base-content/60">타임슬롯</div>
          <div className="text-2xl font-bold">{schedule.timeslots.length}</div>
          <div className="text-sm text-base-content/60">{schedule.selectedDay?.eventDate ?? "날짜 미정"}</div>
        </div>
      </div>

      <nav className="grid gap-3 md:grid-cols-2">
        <Link href={`/admin/events/${eventId}/check-in`} className="surface-flat interactive-flat p-4">
          <div className="font-semibold">체크인 대시보드</div>
          <div className="text-sm text-base-content/60">전화번호 뒷자리, 이름, 학교, 예약번호로 현장 참가자를 찾습니다.</div>
        </Link>
        <Link href={`/admin/events/${eventId}/reservations`} className="surface-flat interactive-flat p-4">
          <div className="font-semibold">예약 관리</div>
          <div className="text-sm text-base-content/60">예약 테이블, 수동 초과 예약, 취소/노쇼 처리를 관리합니다.</div>
        </Link>
        <Link href={`/admin/events/${eventId}/schedule`} className="surface-flat interactive-flat p-4">
          <div className="font-semibold">시간표 관리</div>
          <div className="text-sm text-base-content/60">행사 날짜, 타임슬롯, 정원과 공개 상태를 수정합니다.</div>
        </Link>
        <Link href={`/admin/events/${eventId}/export`} className="surface-flat interactive-flat p-4">
          <div className="font-semibold">CSV Export</div>
          <div className="text-sm text-base-content/60">예약/참가자 목록을 CSV로 내려받습니다.</div>
        </Link>
      </nav>

      <Schedule event={schedule.event} day={schedule.selectedDay} timeslots={schedule.timeslots} mode="admin" />
    </div>
  );
}
