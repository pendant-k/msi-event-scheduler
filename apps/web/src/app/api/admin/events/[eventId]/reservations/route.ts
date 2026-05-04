import { NextResponse } from "next/server";
import { searchCheckInRows } from "@scheduler/domain";
import { getAdminUserId } from "@/lib/auth";
import { getAppDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { eventId } = await params;
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? undefined;
  const rows = await searchCheckInRows(await getAppDb(), { eventId, query });

  return NextResponse.json({
    rows,
    updatedAt: new Date().toISOString()
  });
}
