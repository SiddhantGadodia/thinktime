import Link from "next/link";

const steps = [
  { n: "1", t: "Install & add your wallet", d: "Load the extension and paste a Monad address. No sign-up, no email." },
  { n: "2", t: "Use AI like normal", d: "While ChatGPT, Claude or Gemini is thinking, a small sponsored card appears in the corner — never in the answer." },
  { n: "3", t: "Get paid on-chain", d: "Verified views are settled in batches from the sponsor's escrow straight to your wallet. Every payout is a public Monad tx." },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <nav className="flex items-center justify-between">
        <div className="text-lg font-semibold tracking-tight">
          <span className="text-monad">●</span> ThinkTime
        </div>
        <Link href="/dashboard" className="rounded-full border border-line px-4 py-1.5 text-sm hover:border-monad hover:text-monad transition">
          Sponsor dashboard →
        </Link>
      </nav>

      <section className="pt-24 pb-20 text-center">
        <p className="mb-5 inline-block rounded-full border border-monad/40 bg-monad/10 px-3 py-1 text-xs tracking-wide text-monad">
          Built on Monad · Track 03: Social, Attention &amp; Culture
        </p>
        <h1 className="mx-auto max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
          Get paid for the ads you see while <span className="text-monad">AI is thinking</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-zinc-400">
          OpenAI keeps 100%. ThinkTime gives users their cut.
        </p>
        <div className="mt-9 flex justify-center gap-3">
          <Link href="/dashboard" className="rounded-full bg-monad px-6 py-3 font-medium text-white shadow-lg shadow-monad/30 hover:brightness-110 transition">
            Open dashboard
          </Link>
          <a href="#how" className="rounded-full border border-line px-6 py-3 text-zinc-300 hover:border-zinc-500 transition">
            How it works
          </a>
        </div>
      </section>

      <section id="how" className="grid gap-4 sm:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n} className="rounded-2xl border border-line bg-panel p-6">
            <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-full bg-monad/15 text-sm font-semibold text-monad">{s.n}</div>
            <h3 className="font-semibold">{s.t}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.d}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-panel p-6 text-sm text-zinc-400">
        <span className="font-semibold text-zinc-200">Private by design.</span> Your prompt never leaves your browser — only a coarse
        category like “coding” is used to pick an ad. Sponsors escrow budget in a contract and pay only for views that pass anti-spam checks.
      </section>
    </main>
  );
}
