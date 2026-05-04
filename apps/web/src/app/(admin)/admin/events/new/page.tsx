import Link from "next/link";
import { ArrowLeft, CalendarPlus } from "lucide-react";
import { createEventAction } from "@/app/actions";
import { KoreanTimeInput } from "@/components/korean-time-input";
import { FormLoadingModal, PendingSubmitButton } from "@/components/loading-modal";
import { getAdminUserId } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function NewEventPage() {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) redirect("/admin");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/admin" className="btn btn-ghost btn-sm">
          <ArrowLeft className="size-4" aria-hidden="true" />
          대시보드
        </Link>
        <h1 className="mt-3 text-2xl font-bold">새 행사</h1>
        <p className="text-sm text-base-content/60">행사 URL에 쓰이는 ID는 자동으로 생성됩니다.</p>
      </div>

      <form action={createEventAction} className="surface-flat grid gap-4 p-4">
        <label className="form-control">
          <span className="label-text">행사명</span>
          <input name="name" className="input input-bordered" required />
        </label>
        <label className="form-control">
          <span className="label-text">설명</span>
          <input name="description" className="input input-bordered" />
        </label>
        <label className="form-control">
          <span className="label-text">날짜</span>
          <input name="eventDate" type="date" className="input input-bordered" required />
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <KoreanTimeInput name="startsAt" label="시작" defaultValue="10:00" required />
          <KoreanTimeInput name="endsAt" label="종료" defaultValue="17:00" required />
        </div>
        <label className="form-control">
          <span className="label-text">기본 일정 길이(분)</span>
          <input name="timeslotMinutes" type="number" min={5} className="input input-bordered" defaultValue={60} required />
          <span className="label-text-alt text-base-content/60">특수 회차는 시간표 관리에서 별도로 추가할 수 있습니다.</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="form-control">
            <span className="label-text">일정 정원</span>
            <input name="capacity" type="number" min={1} className="input input-bordered" defaultValue={20} required />
          </label>
          <label className="form-control">
            <span className="label-text">행사 전체 대회 정원</span>
            <input name="tournamentCapacity" type="number" min={1} className="input input-bordered" defaultValue={32} required />
            <span className="label-text-alt text-base-content/60">일정별 정원과 별개로, 대회 참가 신청자만 행사 전체에서 카운트합니다.</span>
          </label>
        </div>
        <label className="label cursor-pointer justify-start gap-3 rounded-lg bg-base-200 px-3">
          <input name="enableTournament" type="checkbox" className="checkbox" defaultChecked />
          <span className="label-text">예약 시 대회 참가 여부 받기</span>
        </label>
        <PendingSubmitButton pendingChildren="행사 생성 중">
          <CalendarPlus className="size-4" aria-hidden="true" />
          행사 만들기
        </PendingSubmitButton>
        <FormLoadingModal
          title="행사를 생성하고 있습니다"
          description="행사 정보와 기본 일정을 저장하는 중입니다."
        />
      </form>
    </div>
  );
}
