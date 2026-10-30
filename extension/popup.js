const ADDR = /^0x[0-9a-fA-F]{40}$/;
const $ = (id) => document.getElementById(id);
let address = "";
let paused = false;

function setMsg(text, cls = "") { const m = $("msg"); m.textContent = text; m.className = "msg " + cls; }
function renderToggle() { $("toggle").textContent = paused ? "Resume" : "Pause"; }

async function refresh() {
  if (!ADDR.test(address)) return;
  chrome.runtime.sendMessage({ type: "getUser", address }, (r) => {
    if (chrome.runtime.lastError || !r || !r.ok) { setMsg("Backend offline — start it with npm run dev:all", "err"); return; }
    const u = r.data;
    $("today").textContent = u.todayViews;
    $("pending").textContent = u.pendingMon.toFixed(4);
    $("paid").textContent = u.paidMon.toFixed(4);
    const ul = $("payouts");
    ul.textContent = "";
    if (!u.payouts.length) { const li = document.createElement("li"); li.className = "empty"; li.textContent = "No payouts yet."; ul.append(li); return; }
    for (const p of u.payouts) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = p.url; a.target = "_blank"; a.textContent = p.txHash.slice(0, 10) + "…" + p.txHash.slice(-6);
      const s = document.createElement("span");
      s.textContent = `${p.views} view${p.views === 1 ? "" : "s"}`;
      li.append(a, s);
      ul.append(li);
    }
  });
}

$("save").addEventListener("click", async () => {
  const v = $("addr").value.trim();
  if (!ADDR.test(v)) { $("addr").classList.add("bad"); setMsg("Enter a valid 0x… address (42 chars).", "err"); return; }
  $("addr").classList.remove("bad");
  address = v;
  await chrome.storage.local.set({ address: v });
  setMsg("Saved. You'll earn on your next AI answer.", "ok");
  refresh();
});

$("toggle").addEventListener("click", async () => {
  paused = !paused;
  await chrome.storage.local.set({ paused });
  renderToggle();
  setMsg(paused ? "Paused — no ads will be shown." : "Resumed.", "");
});

(async () => {
  const s = await chrome.storage.local.get(["address", "paused"]);
  address = s.address || "";
  paused = !!s.paused;
  $("addr").value = address;
  renderToggle();
  if (!address) setMsg("Add your wallet to start earning.");
  refresh();
  setInterval(refresh, 4000);
})();
