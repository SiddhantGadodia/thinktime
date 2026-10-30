import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { USER_PER_VIEW_MON, txUrl } from "@/lib/config";
import { utcDayStart } from "@/lib/views";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ address: string }> }) {
  const { address: raw } = await ctx.params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(raw)) return NextResponse.json({ error: "invalid address" }, { status: 400 });
  const address = raw.toLowerCase();
  const d = db();

  const count = (sql: string, ...args: unknown[]) => (d.prepare(sql).get(...args) as { n: number }).n;
  const today = count(
    "SELECT COUNT(*) n FROM views WHERE address=? AND status!='rejected' AND created_at>=?",
    address,
    utcDayStart(),
  );
  const pending = count("SELECT COUNT(*) n FROM views WHERE address=? AND status='pending'", address);
  const paid = count("SELECT COUNT(*) n FROM views WHERE address=? AND status='paid'", address);

  const payouts = d
    .prepare(
      `SELECT b.tx_hash, b.created_at, COUNT(*) views FROM views v JOIN batches b ON b.batch_id = v.batch_id
       WHERE v.address=? GROUP BY b.batch_id ORDER BY b.created_at DESC LIMIT 5`,
    )
    .all(address) as { tx_hash: string; created_at: number; views: number }[];

  return NextResponse.json({
    address,
    todayViews: today,
    pendingViews: pending,
    paidViews: paid,
    pendingMon: +(pending * USER_PER_VIEW_MON).toFixed(6),
    paidMon: +(paid * USER_PER_VIEW_MON).toFixed(6),
    payouts: payouts.map((p) => ({
      txHash: p.tx_hash,
      url: txUrl(p.tx_hash),
      views: p.views,
      at: p.created_at,
    })),
  });
}
