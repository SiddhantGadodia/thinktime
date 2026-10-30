// Per-site selector config. If a site changes its DOM, fixing ThinkTime is a one-line edit here.
// STATUS: selectors are best guesses from each site's markup at time of writing and were NOT
// verified against the live (logged-in) sites — see README "Known limitations".

const TT_SITES = {
  chatgpt: {
    hosts: ["chatgpt.com"],
    // elements that exist ONLY while the model is generating
    generatingSelectors: [
      'button[data-testid="stop-button"]',
      'button[aria-label="Stop streaming"]',
      'button[aria-label="Stop generating"]',
    ],
    lastUserMessageSelectors: ['[data-message-author-role="user"]'],
    composerSelectors: ["#prompt-textarea", "form textarea", '[contenteditable="true"]'],
  },
  claude: {
    hosts: ["claude.ai"],
    generatingSelectors: [
      'button[aria-label="Stop response"]',
      'button[aria-label*="Stop"]',
      'button[data-testid="stop-button"]',
    ],
    lastUserMessageSelectors: ['[data-testid="user-message"]', ".font-user-message"],
    composerSelectors: ['div[contenteditable="true"].ProseMirror', '[contenteditable="true"]', "textarea"],
  },
  gemini: {
    hosts: ["gemini.google.com"],
    generatingSelectors: [
      'button[aria-label*="Stop"]',
      "button.stop",
      ".stop-icon",
      'mat-icon[fonticon="stop"]',
    ],
    lastUserMessageSelectors: ["user-query .query-text", "user-query", ".query-text"],
    composerSelectors: [".ql-editor", 'rich-textarea [contenteditable="true"]', '[contenteditable="true"]', "textarea"],
  },
};

function ttDetectSite() {
  const host = location.hostname;
  for (const [name, cfg] of Object.entries(TT_SITES)) {
    if (cfg.hosts.some((h) => host === h || host.endsWith("." + h))) return { name, ...cfg };
  }
  return null;
}

function ttVisible(el) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  const s = getComputedStyle(el);
  return s.visibility !== "hidden" && s.display !== "none";
}

function ttFirstMatch(selectors, requireVisible = false) {
  for (const sel of selectors) {
    let el = null;
    try { el = document.querySelector(sel); } catch (_) { /* bad selector: ignore */ }
    if (el && (!requireVisible || ttVisible(el) || el.closest("button"))) return el;
  }
  return null;
}

// Generic fallback: any visible button whose aria-label matches /stop/i near the composer.
function ttGenericStopButton(site) {
  const composer = ttFirstMatch(site.composerSelectors);
  let scope = composer;
  for (let i = 0; scope && i < 5; i++) {
    const hit = [...scope.querySelectorAll("button")].find(
      (b) => /stop/i.test(b.getAttribute("aria-label") || "") && ttVisible(b),
    );
    if (hit) return hit;
    scope = scope.parentElement;
  }
  return null;
}

function ttIsGenerating(site) {
  if (ttFirstMatch(site.generatingSelectors)) return true;
  return !!ttGenericStopButton(site);
}

function ttLastUserMessage(site) {
  for (const sel of site.lastUserMessageSelectors) {
    let nodes = [];
    try { nodes = document.querySelectorAll(sel); } catch (_) { /* ignore */ }
    if (nodes.length) return nodes[nodes.length - 1].innerText || nodes[nodes.length - 1].textContent || "";
  }
  return "";
}

function ttComposerText(site) {
  const el = ttFirstMatch(site.composerSelectors);
  return el ? el.value ?? el.innerText ?? "" : "";
}
