import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ADS } from "@/lib/ads";
import { readCampaign } from "@/lib/chain";
import { RATE_MON, USER_PER_VIEW_MON, contractAddress, txUrl } from "@/lib/config";

export const dynamic = "force-dynamic";

const fmt = (wei: bigint) => Number(wei) / 1e18;

export async function GET() {
  const d = db();
  const chain = await Promise.all(ADS.map((a) => readCampaign(a.campaignId)));

  const campaigns = ADS.map((a, i) => {
    const q = (sql: string) => (d.prepare(sql).get(a.campaignId) as { n: number }).n;
    const pending = q("SELECT COUNT(*) n FROM views WHERE campaign_id=? AND status='pending'");
    const paid = q("SELECT COUNT(*) n FROM views WHERE campaign_id=? AND status='paid'");
    const users = q("SELECT COUNT(DISTINCT address) n FROM views WHERE campaign_id=? AND status='paid'");
    const rejectedRows = d
      .prepare("SELECT reject_reason r, COUNT(*) n FROM views WHERE campaign_id=? AND status='rejected' GROUP BY r")
      .all(a.campaignId) as { r: string; n: number }[];
    const c = chain[i];
    return {
      campaignId: a.campaignId,
      brand: a.brand,
      category: a.category,
      gradient: a.gradient,
      emoji: a.emoji,
      budgetRemaining: c ? fmt(c.remaining) : null,
      budgetTotal: c ? fmt(c.remaining + c.totalPaid) : null,
      verifiedViews: pending + paid,
      pendingViews: pending,
      paidViews: paid,
      rejectedViews: rejectedRows.reduce((s, r) => s + r.n, 0),
      rejectedByReason: Object.fromEntries(rejectedRows.map((r) => [r.r, r.n])),
      uniqueUsersPaid: users,
      totalPaidMon: +(paid * USER_PER_VIEW_MON).toFixed(6),
      sponsorSpendMon: +(paid * RATE_MON).toFixed(6),
    };
  });

  // rejects with no valid campaign (invalid payloads) still count in the global panel
  const rejectedAll = d
    .prepare("SELECT reject_reason r, COUNT(*) n FROM views WHERE status='rejected' GROUP BY r")
    .all() as { r: string; n: number }[];
  const rejectedByReason = Object.fromEntries(rejectedAll.map((r) => [r.r, r.n]));
  const rejectedTotal = rejectedAll.reduce((s, r) => s + r.n, 0);
  const verified = campaigns.reduce((s, c) => s + c.verifiedViews, 0);
  const paidViews = campaigns.reduce((s, c) => s + c.paidViews, 0);

  const batches = (
    d.prepare("SELECT batch_id, campaign_id, tx_hash, total_views, created_at FROM batches ORDER BY created_at DESC LIMIT 10").all() as {
      batch_id: string; campaign_id: number; tx_hash: string; total_views: number; created_at: number;
    }[]
  ).map((b) => ({
    batchId: b.batch_id,
    campaignId: b.campaign_id,
    brand: ADS.find((a) => a.campaignId === b.campaign_id)?.brand ?? `#${b.campaign_id}`,
    txHash: b.tx_hash,
    url: txUrl(b.tx_hash),
    totalViews: b.total_views,
    at: b.created_at,
  }));

  return NextResponse.json({
    contractConfigured: !!contractAddress(),
    contract: contractAddress() || null,
    campaigns,
    totals: {
      totalPaidMon: +(paidViews * USER_PER_VIEW_MON).toFixed(6),
      verifiedViews: verified,
      rejectedViews: rejectedTotal,
      rejectedPct: verified + rejectedTotal ? Math.round((rejectedTotal / (verified + rejectedTotal)) * 100) : 0,
    },
    rejectedByReason,
    batches,
  });
}
