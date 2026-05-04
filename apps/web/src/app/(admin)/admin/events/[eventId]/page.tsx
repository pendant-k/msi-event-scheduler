import Link from "next/link";
import { getSchedule, searchCheckInRows } from "@scheduler/domain";
import { ArrowRight, Clock3, ClipboardList, Download, LayoutDashboard, Trophy } from "lucide-react";
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
  const adminActions = [
    {
      href: `/admin/events/${eventId}/reservations`,
      title: "예약/체크인 관리",
      description: "예약 검색, 현장 체크인, 취소/노쇼, 수동 예약을 한 화면에서 처리합니다.",
      Icon: ClipboardList,
      iconClass: "bg-emerald-50 text-emerald-700",
      buttonClass: "bg-emerald-600 text-white hover:bg-emerald-700"
    },
    {
      href: `/admin/events/${eventId}/schedule`,
      title: "시간표 관리",
      description: "행사 날짜, 일정, 정원과 공개 상태를 수정합니다.",
      Icon: Clock3,
      iconClass: "bg-amber-50 text-amber-700",
      buttonClass: "bg-amber-500 text-white hover:bg-amber-600"
    },
    ...(schedule.event.enableTournament
      ? [
          {
            href: `/admin/events/${eventId}/tournament`,
            title: "대회 관리",
            description: "대회 체크인, 참가 명단, 토너먼트 대진표를 관리합니다.",
            Icon: Trophy,
            iconClass: "bg-violet-50 text-violet-700",
            buttonClass: "bg-violet-600 text-white hover:bg-violet-700"
          }
        ]
      : []),
    {
      href: `/admin/events/${eventId}/export`,
      title: "CSV Export",
      description: "예약/참가자 목록을 CSV로 내려받습니다.",
      Icon: Download,
      iconClass: "bg-slate-100 text-slate-700",
      buttonClass: "bg-slate-700 text-white hover:bg-slate-800"
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin" className="btn btn-ghost btn-sm gap-2">
            <LayoutDashboard aria-hidden="true" className="h-4 w-4" />
            대시보드
          </Link>
          <h1 className="mt-3 text-2xl font-bold">{schedule.event.name}</h1>
          <p className="text-sm text-base-content/60">{schedule.event.description ?? "행사 운영 허브"}</p>
        </div>
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
          <div className="text-sm text-base-content/60">일정</div>
          <div className="text-2xl font-bold">{schedule.timeslots.length}</div>
          <div className="text-sm text-base-content/60">{schedule.selectedDay?.eventDate ?? "날짜 미정"}</div>
        </div>
      </div>

      <nav className="grid gap-3 md:grid-cols-2">
        {adminActions.map(({ href, title, description, Icon, iconClass, buttonClass }) => (
          <Link
            key={href}
            href={href}
            className="surface-flat interactive-flat group flex flex-col gap-4 border border-base-300/60 p-4 focus:outline-none focus:ring-2 focus:ring-primary/30 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-start gap-3">
              <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">{title}</span>
                <span className="mt-1 block text-sm text-base-content/60">{description}</span>
              </span>
            </div>
            <span className={`btn btn-sm w-full shrink-0 gap-2 sm:w-auto ${buttonClass}`}>
              이동
              <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </nav>

      <Schedule event={schedule.event} day={schedule.selectedDay} timeslots={schedule.timeslots} mode="admin" />
    </div>
  );
}
