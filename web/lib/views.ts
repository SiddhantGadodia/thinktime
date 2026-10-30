import { db } from "./db";
import { campaignById } from "./ads";
import {
  MAX_ADDRESSES_PER_INSTALL,
  MIN_GENERATION_MS,
  MIN_VISIBLE_MS,
  SITES,
  dailyCap,
  rateLimitMs,
} from "./config";

export type RejectReason =
  | "invalid"
  | "replay"
  | "too_short_generation"
  | "not_attended"
  | "rate_limited"
  | "daily_cap"
  | "install_abuse";

export type ViewResult = { status: "pending" | "rejected"; reason?: RejectReason };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADDR = /^0x[0-9a-fA-F]{40}$/;

export function utcDayStart(now = Date.now()) {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function str(v: unknown, max = 200): string | null {
  return typeof v === "string" && v.length > 0 && v.length <= max ? v : null;
}

// Records a view (always stores it) and returns the verdict.
export function recordView(body: Record<string, unknown>): ViewResult {
  const d = db();
  const now = Date.now();

  const viewId = str(body.viewId, 64);
  const address = typeof body.address === "string" && ADDR.test(body.address) ? body.address.toLowerCase() : null;
  const installId = str(body.installId, 64);
  const campaignId = Number.isInteger(body.campaignId) ? (body.campaignId as number) : null;
  const category = str(body.category, 32) ?? "general";
  const site = typeof body.site === "string" && (SITES as readonly string[]).includes(body.site) ? body.site : null;
  const generationMs = Number.isFinite(body.generationMs) ? Math.round(body.generationMs as number) : null;
  const visibleMs = Number.isFinite(body.visibleMs) ? Math.round(body.visibleMs as number) : null;

  const insert = d.prepare(
    `INSERT INTO views (id,address,install_id,campaign_id,category,site,generation_ms,visible_ms,status,reject_reason,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  );
  const store = (id: string, status: "pending" | "rejected", reason?: RejectReason): ViewResult => {
    insert.run(id, address, installId, campaignId, category, site, generationMs, visibleMs, status, reason ?? null, now);
    return reason ? { status, reason } : { status };
  };

  // 1. invalid
  if (
    !viewId || !UUID.test(viewId) || !address || !installId || campaignId === null || !campaignById(campaignId) ||
    !site || generationMs === null || visibleMs === null
  ) {
    return store(`invalid:${crypto.randomUUID()}`, "rejected", "invalid");
  }

  // 2. replay
  if (d.prepare("SELECT 1 FROM views WHERE id = ?").get(viewId)) {
    return store(`replay:${crypto.randomUUID()}`, "rejected", "replay");
  }

  // 3/4. content checks
  if (generationMs < MIN_GENERATION_MS) return store(viewId, "rejected", "too_short_generation");
  if (visibleMs < MIN_VISIBLE_MS || body.focused !== true) return store(viewId, "rejected", "not_attended");

  // 5. rate limit (counted = pending or paid)
  const recent = d
    .prepare("SELECT 1 FROM views WHERE address = ? AND status != 'rejected' AND created_at > ?")
    .get(address, now - rateLimitMs());
  if (recent) return store(viewId, "rejected", "rate_limited");

  // 6. daily cap (UTC)
  const today = d
    .prepare("SELECT COUNT(*) n FROM views WHERE address = ? AND status != 'rejected' AND created_at >= ?")
    .get(address, utcDayStart(now)) as { n: number };
  if (today.n >= dailyCap()) return store(viewId, "rejected", "daily_cap");

  // 7. one install may only serve a couple of wallets
  d.prepare("INSERT OR IGNORE INTO installs (install_id,address,first_seen) VALUES (?,?,?)").run(installId, address, now);
  const n = (d.prepare("SELECT COUNT(DISTINCT address) n FROM installs WHERE install_id = ?").get(installId) as { n: number }).n;
  if (n > MAX_ADDRESSES_PER_INSTALL) return store(viewId, "rejected", "install_abuse");

  return store(viewId, "pending");
}
