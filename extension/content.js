// ThinkTime content script. Detects "model is generating", shows a sponsored card while it does,
// tracks genuinely-visible time, and reports a view. The prompt text stays in this file:
// only a coarse category is sent (see classify.js).
(() => {
  const site = ttDetectSite();
  if (!site) return;

  const POLL_MS = 500;
  const TICK_MS = 250;
  const MAX_SESSION_MS = 60_000;
  const END_GRACE_MS = 1500; // ignore stop-button flicker between response phases
  const REQUIRED_VISIBLE_MS = 5000;
  const USER_PER_VIEW_MON = 0.0007;
  const ADDR = /^0x[0-9a-fA-F]{40}$/;

  let settings = { address: "", paused: false };
  let session = null; // active view session
  let consumed = false; // hit the 60s cap; wait for generation to actually end before re-arming
  let lastComposerText = "";

  // ---- settings ----------------------------------------------------------
  const loadSettings = () =>
    chrome.storage.local.get(["address", "paused"]).then((s) => {
      settings = { address: s.address || "", paused: !!s.paused };
    }).catch(() => {});
  loadSettings();
  chrome.storage.onChanged.addListener(loadSettings);
  const enabled = () => ADDR.test(settings.address) && !settings.paused;

  // ---- remember composer text at submit time (fallback for classification) ----
  const grabComposer = () => {
    const t = ttComposerText(site);
    if (t && t.trim()) lastComposerText = t;
  };
  document.addEventListener("input", grabComposer, true);
  document.addEventListener("keydown", grabComposer, true);
  document.addEventListener("click", grabComposer, true);

  // ---- messaging ---------------------------------------------------------
  const send = (msg) =>
    new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (r) => resolve(chrome.runtime.lastError ? { ok: false } : r));
      } catch (_) { resolve({ ok: false }); } // extension reloaded
    });

  // ---- card (Shadow DOM) -------------------------------------------------
  async function buildCard(ad) {
    const host = document.createElement("div");
    host.id = "thinktime-host";
    const root = host.attachShadow({ mode: "closed" });

    let css = "";
    try { css = await (await fetch(chrome.runtime.getURL("card.css"))).text(); } catch (_) { /* unstyled fallback */ }
    const style = document.createElement("style");
    style.textContent = css;

    const card = document.createElement("div");
    card.className = "card";
    card.style.background = ad.gradient;
    const el = (tag, cls, text) => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    };
    const inner = el("div", "inner");
    const top = el("div", "top");
    top.append(el("span", "", "Sponsored · via ThinkTime"));
    const close = el("button", "close", "×");
    close.setAttribute("aria-label", "Dismiss ad");
    top.append(close);

    const brand = el("div", "brand");
    brand.append(el("span", "emoji", ad.emoji), el("span", "", ad.brand));
    const cta = el("a", "cta", ad.cta);
    cta.href = ad.ctaUrl;
    cta.target = "_blank";
    cta.rel = "noopener noreferrer sponsored";

    const earn = el("div", "earn");
    const row = el("div", "earn-row");
    const label = el("span", "", "You earn");
    const amt = el("span", "amt", "+0.0000 MON");
    row.append(label, amt);
    const bar = el("div", "bar");
    const fill = el("div", "fill");
    bar.append(fill);
    const hint = el("div", "hint", "Keep this tab focused for 5s");
    earn.append(row, bar, hint);

    inner.append(top, brand, el("div", "headline", ad.headline), el("div", "body", ad.body), cta, earn);
    card.append(inner);
    root.append(style, card);
    document.documentElement.append(host);
    requestAnimationFrame(() => card.classList.add("in"));

    return { host, card, close, amt, fill, hint };
  }

  // ---- session lifecycle -------------------------------------------------
  async function startSession() {
    const promptText = ttLastUserMessage(site) || lastComposerText || "";
    const category = ttClassify(promptText); // local only
    session = {
      startedAt: Date.now(),
      category,
      campaignId: null,
      visibleMs: 0,
      dismissed: false,
      intersecting: true,
      ui: null,
      lastTick: Date.now(),
      ending: false,
    };
    const s = session;
    const res = await send({ type: "getAd", category });
    if (session !== s) return; // ended while fetching
    if (!res || !res.ok) { session = null; return; } // backend down: stay silent
    s.campaignId = res.data.campaignId;
    s.ui = await buildCard(res.data);
    if (session !== s) { s.ui.host.remove(); return; }

    s.ui.close.addEventListener("click", () => {
      s.dismissed = true;
      s.ui.host.remove();
    });
    s.io = new IntersectionObserver((entries) => {
      for (const e of entries) s.intersecting = e.isIntersecting && e.intersectionRatio >= 0.5;
    }, { threshold: [0, 0.5, 1] });
    s.io.observe(s.ui.card);
    s.lastTick = Date.now();
  }

  function tickSession() {
    const s = session;
    if (!s || !s.ui) return;
    const now = Date.now();
    const dt = now - s.lastTick;
    s.lastTick = now;
    const attending =
      !s.dismissed && s.intersecting && document.visibilityState === "visible" && document.hasFocus();
    if (attending) s.visibleMs += dt;

    const p = Math.min(1, s.visibleMs / REQUIRED_VISIBLE_MS);
    if (!s.dismissed) {
      s.ui.fill.style.width = `${p * 100}%`;
      s.ui.amt.textContent = `+${(USER_PER_VIEW_MON * p).toFixed(4)} MON`;
      s.ui.card.classList.toggle("done", p >= 1);
      s.ui.hint.textContent =
        p >= 1 ? "Verified ✓ — payout is settled on Monad" : attending ? "Counting your attention…" : "Paused — tab not focused/visible";
    }
    if (now - s.startedAt >= MAX_SESSION_MS && !s.ending) {
      consumed = true;
      endSession(MAX_SESSION_MS);
    }
  }

  function endSession(generationMsOverride) {
    const s = session;
    if (!s || s.ending) return;
    s.ending = true;
    session = null;
    tickSessionFinal(s);
    const generationMs = generationMsOverride ?? Date.now() - s.startedAt;
    if (s.io) s.io.disconnect();
    if (s.ui) s.ui.host.remove();
    if (!s.ui || s.campaignId == null || generationMs < 3000) return; // nothing was shown / too short to bother
    send({
      type: "sendView",
      view: {
        viewId: crypto.randomUUID(),
        address: settings.address,
        campaignId: s.campaignId,
        category: s.category,
        site: site.name,
        generationMs: Math.round(generationMs),
        visibleMs: Math.round(s.visibleMs),
        focused: !s.dismissed && s.visibleMs > 0,
      },
    });
  }
  function tickSessionFinal(s) {
    // account for the last partial tick
    if (!s.ui || s.dismissed) return;
    const attending = s.intersecting && document.visibilityState === "visible" && document.hasFocus();
    if (attending) s.visibleMs += Date.now() - s.lastTick;
  }

  // ---- generation detection ---------------------------------------------
  let goneSince = 0;
  function check() {
    let generating = false;
    try { generating = ttIsGenerating(site); } catch (_) { /* DOM mid-update */ }
    const now = Date.now();

    if (generating) {
      goneSince = 0;
      if (!session && !consumed && enabled()) startSession();
    } else {
      consumed = false;
      if (session) {
        if (!goneSince) goneSince = now;
        else if (now - goneSince >= END_GRACE_MS) {
          // generation actually ended at goneSince
          endSession(goneSince - session.startedAt);
          goneSince = 0;
        }
      }
    }
    // user paused / cleared wallet mid-session → drop the card, don't report
    if (session && !enabled()) {
      if (session.io) session.io.disconnect();
      if (session.ui) session.ui.host.remove();
      session = null;
    }
  }

  let pending = false;
  new MutationObserver(() => {
    if (pending) return;
    pending = true;
    setTimeout(() => { pending = false; check(); }, 150);
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-label", "data-testid"] });

  setInterval(check, POLL_MS);
  setInterval(tickSession, TICK_MS);
})();
