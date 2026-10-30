"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Campaign = {
  campaignId: number; brand: string; category: string; gradient: string; emoji: string;
  budgetRemaining: number | null; budgetTotal: number | null; verifiedViews: number;
  uniqueUsersPaid: number; totalPaidMon: number; pendingViews: number; rejectedViews: number;
};
type Stats = {
  contractConfigured: boolean; contract: string | null; campaigns: Campaign[];
  totals: { totalPaidMon: number; verifiedViews: number; rejectedViews: number; rejectedPct: number };
  rejectedByReason: Record<string, number>;
  batches: { batchId: string; brand: string; txHash: string; url: string; totalViews: number; at: number }[];
};

const REASONS: Record<string, string> = {
  replay: "Replayed view IDs",
  too_short_generation: "Generation too short",
  not_attended: "Not watched / unfocused",
  rate_limited: "Rate limited",
  daily_cap: "Daily cap hit",
  install_abuse: "Install farming",
  invalid: "Invalid payload",
};

const mon = (n: number, d = 4) => `${n.toFixed(d)} MON`;

export default function Dashboard() {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/stats", { cache: "no-store" });
        if (alive) { setS(await r.json()); setErr(false); }
      } catch { if (alive) setErr(true); }
    };
    load();
    const t = setInterval(load, 3000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const maxReason = Math.max(1, ...Object.values(s?.rejectedByReason ?? {}));

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight"><span className="text-monad">●</span> ThinkTime</Link>
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <span className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${err ? "bg-red-500" : "bg-emerald-400 animate-pulse"}`} />{err ? "offline" : "live"}</span>
          {s?.contract && <span className="rounded-full border border-line px-3 py-1 font-mono">{s.contract.slice(0, 8)}…{s.contract.slice(-6)}</span>}
        </div>
      </header>

      <h1 className="mt-8 text-3xl font-bold tracking-tight">Sponsor dashboard</h1>
      <p className="mt-1 text-zinc-400">Escrowed budgets, verified attention, and every payout on Monad.</p>

      {s && !s.contractConfigured && (
        <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          <code>CONTRACT_ADDRESS</code> is not set — on-chain budgets are hidden. See the README to deploy and seed.
        </div>
      )}

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Paid to users" value={s ? mon(s.totals.totalPaidMon) : "—"} accent />
        <Stat label="Verified views" value={s ? String(s.totals.verifiedViews) : "—"} />
        <Stat label="Views rejected" value={s ? `${s.totals.rejectedPct}%` : "—"} sub={s ? `${s.totals.rejectedViews} blocked` : undefined} />
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {s?.campaigns.map((c) => {
          const pct = c.budgetRemaining !== null && c.budgetTotal ? Math.max(0, Math.min(100, (c.budgetRemaining / c.budgetTotal) * 100)) : 0;
          return (
            <div key={c.campaignId} className="overflow-hidden rounded-2xl border border-line bg-panel">
              <div className="flex items-center gap-3 px-5 py-4" style={{ background: c.gradient }}>
                <span className="text-2xl">{c.emoji}</span>
                <div>
                  <div className="font-semibold text-white">{c.brand}</div>
                  <div className="text-xs text-white/70">#{c.campaignId} · {c.category}</div>
                </div>
              </div>
              <div className="p-5">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Budget remaining</span>
                  <span className="font-mono">{c.budgetRemaining !== null ? mon(c.budgetRemaining, 3) : "—"}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-monad transition-all duration-700" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                  <Mini label="Verified views" value={c.verifiedViews} />
                  <Mini label="Users paid" value={c.uniqueUsersPaid} />
                  <Mini label="MON paid" value={c.totalPaidMon.toFixed(4)} />
                </div>
                {c.pendingViews > 0 && <p className="mt-3 text-xs text-zinc-500">{c.pendingViews} views awaiting settlement</p>}
              </div>
            </div>
          );
        })}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-line bg-panel p-5 lg:col-span-2">
          <h2 className="font-semibold">🛡️ Spam blocked</h2>
          <p className="mb-4 text-xs text-zinc-500">Sponsors never pay for these.</p>
          {s && Object.keys(s.rejectedByReason).length === 0 && <p className="text-sm text-zinc-500">Nothing blocked yet.</p>}
          <div className="space-y-3">
            {Object.entries(s?.rejectedByReason ?? {}).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
              <div key={k}>
                <div className="flex justify-between text-sm"><span>{REASONS[k] ?? k}</span><span className="font-mono text-zinc-400">{n}</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full bg-rose-400/80 transition-all duration-700" style={{ width: `${(n / maxReason) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-panel p-5 lg:col-span-3">
          <h2 className="font-semibold">Recent settlements</h2>
          <p className="mb-4 text-xs text-zinc-500">Each row is a real Monad transaction.</p>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-zinc-500">
              <tr><th className="pb-2 font-normal">When</th><th className="pb-2 font-normal">Campaign</th><th className="pb-2 font-normal">Views</th><th className="pb-2 text-right font-normal">Tx</th></tr>
            </thead>
            <tbody>
              {s?.batches.map((b) => (
                <tr key={b.batchId} className="border-t border-line">
                  <td className="py-2 text-zinc-400">{new Date(b.at).toLocaleTimeString()}</td>
                  <td>{b.brand}</td>
                  <td>{b.totalViews}</td>
                  <td className="text-right"><a href={b.url} target="_blank" rel="noreferrer" className="font-mono text-monad hover:underline">{b.txHash.slice(0, 10)}…↗</a></td>
                </tr>
              ))}
              {s && s.batches.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-zinc-500">No settlements yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-2 text-3xl font-bold ${accent ? "text-monad" : ""}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] py-2">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-[11px] text-zinc-500">{label}</div>
    </div>
  );
}
