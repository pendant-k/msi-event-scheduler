import Link from "next/link";
import { listAdminEvents } from "@scheduler/domain";
import { adminLoginAction, createEventAction } from "@/app/actions";
import { getAdminUserId } from "@/lib/auth";
import { getAppDb } from "@/lib/db";

export default async function AdminHomePage() {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return (
      <form action={adminLoginAction} className="mx-auto max-w-md space-y-3 rounded border border-base-300 bg-base-100 p-4">
        <h1 className="text-xl font-semibold">관리자 로그인</h1>
        <input name="email" type="email" className="input input-bordered w-full" defaultValue="admin@example.com" required />
        <input name="password" type="password" className="input input-bordered w-full" defaultValue="password" required />
        <p className="text-sm text-base-content/60">로컬 프로토타입은 env 기반 mock gate를 사용합니다.</p>
        <button className="btn btn-primary w-full" type="submit">
          로그인
        </button>
      </form>
    );
  }

  const events = await listAdminEvents(await getAppDb(), adminUserId);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">관리자 대시보드</h1>
        <p className="text-sm text-base-content/60">행사를 만들고 운영 화면으로 이동합니다.</p>
      </div>

      <section className="rounded border border-base-300 bg-base-100 p-4">
        <h2 className="mb-3 text-lg font-semibold">행사 생성</h2>
        <form action={createEventAction} className="grid gap-3 md:grid-cols-2">
          <label className="form-control">
            <span className="label-text">행사 ID</span>
            <input name="eventId" className="input input-bordered" placeholder="msi-2026" />
          </label>
          <label className="form-control">
            <span className="label-text">행사명</span>
            <input name="name" className="input input-bordered" required />
          </label>
          <label className="form-control md:col-span-2">
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
          <div className="md:col-span-2">
            <button className="btn btn-primary" type="submit">
              행사 만들기
            </button>
          </div>
        </form>
      </section>

      <div className="grid gap-3">
        {events.map((event) => (
          <div key={event.id} className="flex items-center justify-between rounded border border-base-300 bg-base-100 p-4">
            <div>
              <div className="font-semibold">{event.name}</div>
              <div className="text-sm text-base-content/60">{event.status}</div>
            </div>
            <div className="flex gap-2">
              <Link href={`/admin/events/${event.id}`} className="btn btn-outline btn-sm">
                운영 현황
              </Link>
              <Link href={`/admin/events/${event.id}/check-in`} className="btn btn-primary btn-sm">
                체크인
              </Link>
            </div>
          </div>
        ))}
        {events.length === 0 && <div className="alert">관리 가능한 행사가 없습니다. seed를 실행해 주세요.</div>}
      </div>
    </div>
  );
}
