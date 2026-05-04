import Link from "next/link";
import { ArrowLeft, EyeOff } from "lucide-react";
import { getSchedule } from "@scheduler/domain";
import { Schedule } from "@/components/schedule";
import { ScheduleEditorModals } from "@/components/schedule-editor-modals";
import { TimeslotSettingsForm } from "@/components/timeslot-settings-form";
import { getAdminUserId } from "@/lib/auth";
import { getAppDb } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function AdminSchedulePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const adminUserId = await getAdminUserId();
  if (!adminUserId) redirect("/admin");
  const schedule = await getSchedule(await getAppDb(), eventId);
  if (!schedule) return <div className="alert alert-error">행사를 찾을 수 없습니다.</div>;
  const defaultCapacity = schedule.timeslots[0]?.capacity ?? 20;
  const hiddenCount = schedule.timeslots.filter((slot) => slot.status === "HIDDEN").length;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/events/${eventId}`} className="btn btn-ghost btn-sm">
          <ArrowLeft className="size-4" aria-hidden="true" />
          운영 허브
        </Link>
        <h1 className="mt-3 text-2xl font-bold">시간표 관리</h1>
        <p className="text-sm text-base-content/60">
          {schedule.event.name} · 숨김 {hiddenCount}개
        </p>
      </div>

      <Schedule event={schedule.event} day={schedule.selectedDay} timeslots={schedule.timeslots} mode="admin" />

      <ScheduleEditorModals eventId={eventId} days={schedule.days} defaultCapacity={defaultCapacity} />

      <section className="surface-flat p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">일정 공개 상태와 정원</h2>
          <div className="inline-flex items-center gap-1 rounded-full bg-base-200 px-3 py-1 text-xs font-semibold text-base-content/70">
            <EyeOff className="size-3.5" aria-hidden="true" />
            숨김 {hiddenCount}
          </div>
        </div>
        {schedule.timeslots.length === 0 ? (
          <div className="admin-empty-hint">등록된 일정이 없습니다.</div>
        ) : (
          <TimeslotSettingsForm eventId={eventId} timeslots={schedule.timeslots} />
        )}
      </section>
    </div>
  );
}
