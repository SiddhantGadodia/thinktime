import { NextRequest, NextResponse } from "next/server";
import { recordView } from "@/lib/views";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* falls through as invalid */
  }
  return NextResponse.json(recordView(body && typeof body === "object" ? body : {}));
}
