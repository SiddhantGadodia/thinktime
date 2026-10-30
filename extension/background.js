// All network calls to the ThinkTime backend go through this service worker
// (avoids page CSP / CORS problems on chatgpt.com, claude.ai, gemini.google.com).
const API = "http://localhost:3000";

async function getInstallId() {
  const { installId } = await chrome.storage.local.get("installId");
  if (installId) return installId;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ installId: id });
  return id;
}

chrome.runtime.onInstalled.addListener(() => { getInstallId(); });

async function api(path, init) {
  const res = await fetch(API + path, init);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

const handlers = {
  async getAd({ category }) {
    return api(`/api/ad?category=${encodeURIComponent(category || "general")}`);
  },
  async sendView({ view }) {
    const installId = await getInstallId();
    return api("/api/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...view, installId }),
    });
  },
  async getUser({ address }) {
    return api(`/api/user/${address}`);
  },
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const h = handlers[msg && msg.type];
  if (!h) return false;
  h(msg).then(
    (data) => sendResponse({ ok: true, data }),
    (err) => sendResponse({ ok: false, error: String(err && err.message || err) }),
  );
  return true; // async response
});
