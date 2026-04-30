import Link from "next/link";
import { getEventBundle } from "@scheduler/domain";
import { getParticipantSession } from "@scheduler/domain";
import { createReservationAction, participantAccessAction } from "@/app/actions";
import { Schedule } from "@/components/schedule";
import { getParticipantToken } from "@/lib/auth";
import { getAppDb } from "@/lib/db";

export default async function EventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const db = await getAppDb();
  const bundle = await getEventBundle(db, eventId);
  if (!bundle) {
    return <div className="alert alert-error">행사를 찾을 수 없습니다.</div>;
  }
  const session = await getParticipantSession(db, await getParticipantToken());
  const activeSession = session?.eventId === eventId ? session : null;
  const day = bundle.days[0];
  const openSlots = bundle.timeslots.filter((slot) => slot.status === "OPEN");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <section className="space-y-3">
          <h1 className="text-3xl font-bold">{bundle.event.name}</h1>
          <p className="text-base-content/70">{bundle.event.description}</p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/event/${eventId}/schedule`} className="btn btn-outline btn-sm">
              전체 시간표
            </Link>
            <Link href={`/event/${eventId}/reservations`} className="btn btn-outline btn-sm">
              내 예약 확인
            </Link>
          </div>
        </section>
        <Schedule event={bundle.event} day={day} timeslots={bundle.timeslots} mode="participant" />
      </div>

      <aside id="reservation-form" className="surface-flat scroll-mt-6 p-4">
        {activeSession ? (
          <form action={createReservationAction} className="space-y-3">
            <h2 className="text-lg font-semibold">예약하기</h2>
            <input type="hidden" name="eventId" value={eventId} />
            <label className="form-control">
              <span className="label-text">시간 선택</span>
              <select name="timeslotId" className="select select-bordered" required>
                {openSlots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {new Date(slot.startsAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} · 잔여{" "}
                    {Math.max(0, slot.capacity - slot.reservedCount)}석
                  </option>
                ))}
              </select>
            </label>
            <label className="form-control">
              <span className="label-text">이름</span>
              <input name="name" className="input input-bordered" required />
            </label>
            <label className="form-control">
              <span className="label-text">학교</span>
              <input name="school" className="input input-bordered" required />
            </label>
            <label className="form-control">
              <span className="label-text">학년</span>
              <input name="grade" type="number" min={1} max={12} className="input input-bordered" required />
            </label>
            <label className="label cursor-pointer justify-start gap-3">
              <input name="guardianConfirmed" type="checkbox" className="checkbox" />
              <span className="label-text">보호자 동행 확인</span>
            </label>
            <label className="label cursor-pointer justify-start gap-3">
              <input name="tournament" type="checkbox" className="checkbox" />
              <span className="label-text">대회 참가 신청</span>
            </label>
            <label className="label cursor-pointer items-start justify-start gap-3">
              <input name="privacyConsent" type="checkbox" className="checkbox mt-1" required />
              <span className="label-text">
                <Link href="/privacy" className="link">
                  개인정보 수집 및 이용 안내
                </Link>
                에 동의합니다.
              </span>
            </label>
            <button className="btn btn-primary w-full" type="submit">
              예약하기
            </button>
          </form>
        ) : (
          <form action={participantAccessAction} className="space-y-3">
            <h2 className="text-lg font-semibold">예약 접근</h2>
            <p className="text-sm text-base-content/60">
              처음이면 비밀번호가 설정되고, 이미 등록했다면 같은 비밀번호로 내 예약에 접근합니다. 비밀번호를 잊은 경우 현장
              운영자에게 문의해 주세요.
            </p>
            <input type="hidden" name="eventId" value={eventId} />
            <label className="form-control">
              <span className="label-text">전화번호</span>
              <input name="phoneNumber" className="input input-bordered" inputMode="tel" required />
            </label>
            <label className="form-control">
              <span className="label-text">행사 비밀번호</span>
              <input name="password" type="password" className="input input-bordered" required />
            </label>
            <button className="btn btn-primary w-full" type="submit">
              계속하기
            </button>
          </form>
        )}
      </aside>
    </div>
  );
}
