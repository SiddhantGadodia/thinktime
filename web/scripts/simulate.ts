// Demo fallback: posts a realistic mix of good and spammy views for 3 fake wallets.
//   npm run simulate              (works against a default server; ~45s because of the 20s per-address rate limit)
//   npm run simulate -- --fast    (server must be started with DEMO_FAST=1; also demonstrates daily_cap)
import { randomUUID } from "node:crypto";

const BASE = process.env.API_BASE || "http://localhost:3000";
const FAST = process.argv.includes("--fast");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const WALLETS = [
  "0x1111111111111111111111111111111111111111",
  "0x2222222222222222222222222222222222222222",
  "0x3333333333333333333333333333333333333333",
];
const INSTALLS = WALLETS.map((_, i) => `sim-install-${i}`);
const CATS = ["coding", "study", "travel", "finance"];
const SITES = ["chatgpt", "claude", "gemini"];

type V = { viewId: string; address: string; installId: string; campaignId: number; category: string; site: string; generationMs: number; visibleMs: number; focused: boolean };

const good = (w: number, n: number): V => ({
  viewId: randomUUID(), address: WALLETS[w], installId: INSTALLS[w], campaignId: n % 4, category: CATS[n % 4],
  site: SITES[(w + n) % 3], generationMs: 6000 + Math.floor(Math.random() * 9000), visibleMs: 5200 + Math.floor(Math.random() * 4000), focused: true,
});

async function post(label: string, v: Partial<V>) {
  const res = await fetch(`${BASE}/api/view`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) });
  const j = await res.json();
  console.log(`${label.padEnd(22)} → ${j.status}${j.reason ? ` (${j.reason})` : ""}`);
  return j;
}

async function round(n: number) {
  console.log(`\n— round ${n + 1} —`);
  const first = good(0, n);
  for (let w = 0; w < 3; w++) await post(`good wallet ${w + 1}`, w === 0 ? first : good(w, n + w));
  // deliberate spam
  await post("replay of wallet 1", first);
  await post("too-fast generation", { ...good(1, n), generationMs: 900 });
  await post("unfocused", { ...good(2, n), focused: false });
  await post("barely visible", { ...good(1, n), visibleMs: 1200 });
  await post("rate-limited (burst)", good(0, n));
  await post("bad address", { ...good(0, n), address: "0xnope" });
  if (n === 0) {
    // one install shared by 3 wallets: the 3rd must be rejected
    for (const a of ["a", "b", "c"]) await post(`install abuse (${a})`, { ...good(0, n), installId: "sim-shared-install", address: "0x" + a.repeat(40) });
  }
}

async function main() {
  const rounds = FAST ? 8 : 3;
  for (let r = 0; r < rounds; r++) {
    await round(r);
    if (r < rounds - 1) {
      const wait = FAST ? 700 : 21_000;
      console.log(`(waiting ${wait / 1000}s to clear the per-address rate limit)`);
      await sleep(wait);
    }
  }
  console.log("\nDone. The settler pays the pending views within ~30s.");
}

main().catch((e) => { console.error("Is the web server running on", BASE, "?", e.message); process.exit(1); });
