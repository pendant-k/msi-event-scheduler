import Link from "next/link";
import { getParticipantSession, listReservationsForAccess } from "@scheduler/domain";
import { cancelParticipantReservationAction, participantAccessAction } from "@/app/actions";
import { getParticipantToken } from "@/lib/auth";
import { getAppDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { getReservationStatusLabel, getReservationStatusTone } from "@/lib/status-labels";

export default async function ParticipantReservationsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const db = await getAppDb();
  const session = await getParticipantSession(db, await getParticipantToken());
  if (!session || session.eventId !== eventId) {
    return (
      <form action={participantAccessAction} className="surface-flat mx-auto max-w-md space-y-3 p-4">
        <h1 className="text-xl font-semibold">내 예약 확인</h1>
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="redirectTo" value={`/event/${eventId}/reservations`} />
        <input name="phoneNumber" className="input input-bordered w-full" placeholder="전화번호" required />
        <input name="password" type="password" className="input input-bordered w-full" placeholder="행사 비밀번호" required />
        <p className="text-sm text-base-content/60">비밀번호를 잊은 경우 현장 운영자에게 문의해 주세요.</p>
        <button className="btn btn-primary w-full" type="submit">
          확인하기
        </button>
      </form>
    );
  }

  const rows = await listReservationsForAccess(db, eventId, session.accessId);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">내 예약</h1>
        <Link href={`/event/${eventId}`} className="btn btn-outline btn-sm">
          추가 예약
        </Link>
      </div>
      <div className="grid gap-3">
        {rows.map((row) => (
          <div key={row.id} className="surface-flat p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{row.participantName}</div>
                <div className="text-sm text-base-content/60">
                  {row.school} · {row.grade}학년 · {formatDateTime(row.startsAt)}
                </div>
                <div className="mt-2 text-sm">예약번호: {row.reservationCode}</div>
              </div>
              <div className={`status-pill status-pill-${getReservationStatusTone(row.status)}`}>
                {getReservationStatusLabel(row.status)}
              </div>
            </div>
            {(row.status === "RESERVED" || row.status === "LATE_RESERVED") && (
              <form action={cancelParticipantReservationAction} className="mt-3">
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="reservationId" value={row.id} />
                <button className="btn btn-error btn-sm" type="submit">
                  예약 취소
                </button>
              </form>
            )}
          </div>
        ))}
        {rows.length === 0 && <div className="alert">예약 내역이 없습니다.</div>}
      </div>
    </div>
  );
}
