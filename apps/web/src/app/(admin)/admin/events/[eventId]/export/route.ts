import { searchCheckInRows } from "@scheduler/domain";
import { getAdminUserId } from "@/lib/auth";
import { getAppDb } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { eventId } = await params;
  const rows = await searchCheckInRows(await getAppDb(), { eventId });
  const header = ["time", "name", "school", "grade", "phone", "status", "tournament", "reservationCode"];
  const body = rows.map((row) =>
    [
      row.startsAt,
      row.participantName,
      row.school,
      row.grade,
      row.maskedPhone,
      row.status,
      row.tournament ? "Y" : "N",
      row.reservationCode
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(",")
  );
  const csv = `\uFEFF${[header.join(","), ...body].join("\n")}`;
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="reservations-${eventId}.csv"`
    }
  });
}
