import Link from "next/link";
import { createEventAction } from "@/app/actions";
import { getAdminUserId } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function NewEventPage() {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) redirect("/admin");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/admin" className="btn btn-ghost btn-sm">
          대시보드
        </Link>
        <h1 className="mt-3 text-2xl font-bold">새 행사</h1>
        <p className="text-sm text-base-content/60">행사 URL에 쓰이는 ID는 자동으로 생성됩니다.</p>
      </div>

      <form action={createEventAction} className="grid gap-4 rounded border border-base-300 bg-base-100 p-4">
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
        <div className="grid grid-cols-2 gap-2">
          <label className="form-control">
            <span className="label-text">시작</span>
            <input name="startsAt" type="time" className="input input-bordered" defaultValue="10:00" required />
          </label>
          <label className="form-control">
            <span className="label-text">종료</span>
            <input name="endsAt" type="time" className="input input-bordered" defaultValue="17:00" required />
          </label>
        </div>
        <label className="form-control">
          <span className="label-text">슬롯 간격(분)</span>
          <input name="timeslotMinutes" type="number" min={5} className="input input-bordered" defaultValue={30} required />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="form-control">
            <span className="label-text">슬롯 정원</span>
            <input name="capacity" type="number" min={1} className="input input-bordered" defaultValue={20} required />
          </label>
          <label className="form-control">
            <span className="label-text">대회 정원</span>
            <input name="tournamentCapacity" type="number" min={1} className="input input-bordered" defaultValue={32} required />
          </label>
        </div>
        <button className="btn btn-primary" type="submit">
          행사 만들기
        </button>
      </form>
    </div>
  );
}
