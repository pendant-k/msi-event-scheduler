import { redirect } from "next/navigation";

export default async function CheckInPage({
  params,
  searchParams
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { eventId } = await params;
  const { q } = await searchParams;
  redirect(`/admin/events/${eventId}/reservations${q ? `?q=${encodeURIComponent(q)}` : ""}`);
}
