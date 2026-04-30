import Link from "next/link";
import { getSchedule } from "@scheduler/domain";
import { Schedule } from "@/components/schedule";
import { getAppDb } from "@/lib/db";

export default async function PublicSchedulePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const schedule = await getSchedule(await getAppDb(), eventId);
  if (!schedule) return <div className="alert alert-error">시간표를 찾을 수 없습니다.</div>;
  return (
    <div className="space-y-4">
      <Link href={`/event/${eventId}`} className="btn btn-ghost btn-sm">
        예약 페이지로
      </Link>
      <Schedule event={schedule.event} day={schedule.selectedDay} timeslots={schedule.timeslots} mode="participant" />
    </div>
  );
}
