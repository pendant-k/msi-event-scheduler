import Link from "next/link";
import { getEventBundle, listReservationsForAccess } from "@scheduler/domain";
import { getParticipantSession } from "@scheduler/domain";
import { participantAccessAction } from "@/app/actions";
import { EventDescriptionMarkdown } from "@/components/event-description-markdown";
import { ParticipantReservation } from "@/components/participant-reservation";
import { ParticipantReservationsModal } from "@/components/participant-reservations-modal";
import { FormLoadingModal, PendingSubmitButton } from "@/components/loading-modal";
import { getParticipantToken } from "@/lib/auth";
import { getAppDb } from "@/lib/db";

export default async function EventPage({
  params,
  searchParams
}: {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<{ reservations?: string }>;
}) {
  const { eventId } = await params;
  const query = await searchParams;
  const db = await getAppDb();
  const bundle = await getEventBundle(db, eventId);
  if (!bundle) {
    return <div className="alert alert-error">행사를 찾을 수 없습니다.</div>;
  }
  const session = await getParticipantSession(db, await getParticipantToken());
  const activeSession = session?.eventId === eventId ? session : null;
  const reservationRows = activeSession ? await listReservationsForAccess(db, eventId, activeSession.accessId) : [];
  const day = bundle.days[0];
  const initialUpdatedAt = new Date().toISOString();
  const openReservationsModal = query?.reservations === "1";

  if (!activeSession) {
    return (
      <div className="event-reservation-page mx-auto grid max-w-4xl gap-8 lg:grid-cols-[1fr_380px] lg:items-start">
        <section className="event-hero space-y-5">
          <div className="space-y-3">
            <h1 className="event-title text-3xl font-bold">{bundle.event.name}</h1>
            <EventDescriptionMarkdown
              description={bundle.event.description}
              className="event-description-markdown text-base-content/70"
            />
          </div>
          <div className="event-actions flex flex-wrap gap-2">
            <Link href={`/event/${eventId}/schedule`} className="btn btn-outline btn-sm">
              전체 시간표
            </Link>
            <ParticipantReservationsModal
              eventId={eventId}
              rows={reservationRows}
              authenticated={false}
              defaultOpen={openReservationsModal}
            />
          </div>
        </section>

        <form action={participantAccessAction} className="reservation-panel surface-flat space-y-3 p-4">
          <h2 className="text-lg font-semibold">예약 접근</h2>
          <p className="text-sm text-base-content/60">
            전화번호와 비밀번호로 내 예약에 접근합니다. 비밀번호를 잊은 경우 현장 운영자에게 문의해 주세요.
          </p>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="redirectTo" value={`/event/${eventId}`} />
          <label className="form-control">
            <span className="label-text">전화번호</span>
            <input name="phoneNumber" className="input input-bordered" inputMode="tel" required />
          </label>
          <label className="form-control">
            <span className="label-text">비밀번호</span>
            <input
              name="password"
              type="text"
              className="input input-bordered"
              placeholder="4자리 숫자"
              autoComplete="off"
              required
            />
          </label>
          <p className="text-sm text-base-content/60">
            비밀번호로 활용할 4자리 숫자를 입력해 주세요.
          </p>
          <PendingSubmitButton className="btn btn-primary w-full gap-2" pendingChildren="확인 중">
            계속하기
          </PendingSubmitButton>
          <FormLoadingModal title="예약 접근을 확인하고 있습니다" description="입력한 전화번호와 비밀번호를 확인하는 중입니다." />
        </form>
      </div>
    );
  }

  return (
    <div className="event-reservation-page grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="lg:col-span-2">
        <section className="event-hero space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="event-title text-3xl font-bold">{bundle.event.name}</h1>
              <EventDescriptionMarkdown
                description={bundle.event.description}
                className="event-description-markdown mt-3 text-base-content/70"
              />
            </div>
          </div>
          <div className="event-actions flex flex-wrap gap-2">
            <Link href={`/event/${eventId}/schedule`} className="btn btn-outline btn-sm">
              전체 시간표
            </Link>
            <ParticipantReservationsModal
              eventId={eventId}
              rows={reservationRows}
              authenticated
              defaultOpen={openReservationsModal}
            />
          </div>
        </section>
      </div>
      <ParticipantReservation
        eventId={eventId}
        enableTournament={bundle.event.enableTournament}
        day={day}
        timeslots={bundle.timeslots}
        initialUpdatedAt={initialUpdatedAt}
      />
    </div>
  );
}
