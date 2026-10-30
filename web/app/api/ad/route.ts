import { NextRequest, NextResponse } from "next/server";
import { pickAd } from "@/lib/ads";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category") ?? "general";
  return NextResponse.json(pickAd(category));
}
