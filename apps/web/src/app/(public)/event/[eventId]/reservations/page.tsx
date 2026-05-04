import { redirect } from "next/navigation";

export default async function ParticipantReservationsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  redirect(`/event/${eventId}?reservations=1`);
}
