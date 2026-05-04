import { NextResponse } from "next/server";
import { getEventBundle } from "@scheduler/domain";
import { getAppDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const bundle = await getEventBundle(await getAppDb(), eventId);
  if (!bundle || bundle.event.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    day: bundle.days[0] ?? null,
    timeslots: bundle.timeslots,
    updatedAt: new Date().toISOString()
  });
}
