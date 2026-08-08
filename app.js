/* ChristLab Team — console d'administration (statique, sans build).
   Consomme l'API /api/admin/* du backend. Auth JWT (login admin). */

const DEFAULT_BASE = "https://christlab-backend-production.up.railway.app";
// URL du backend : surchargeable via ?base=... ou localStorage (utile en test local).
const BASE = (new URLSearchParams(location.search).get("base")
  || localStorage.getItem("cl_admin_base") || DEFAULT_BASE).replace(/\/+$/, "");

const TOKEN_KEY = "cl_admin_token";
const EMAIL_KEY = "cl_admin_email";
let token = localStorage.getItem(TOKEN_KEY) || "";

/* --- Modules (ordre du menu). endpoint relatif à /api/admin sauf indication. --- */
const VIEWS = [
  { id: "dashboard",      title: "Tableau de bord", ico: "📊", ep: "/api/admin/dashboard" },
  { id: "users",          title: "Utilisateurs",    ico: "👤", ep: "/api/admin/users", rowActions: userActions },
  { id: "administrators", title: "Administrateurs",  ico: "🛡️", ep: "/api/admin/administrators" },
  { id: "tracks",         title: "Pistes",           ico: "🎵", ep: "/api/admin/tracks" },
  { id: "artists",        title: "Artistes",         ico: "🎙️", ep: "/api/admin/artists" },
  { id: "pepites",        title: "Pépites",          ico: "💎", ep: "/api/admin/pepites" },
  { id: "ads",            title: "Publicités",       ico: "📣", ep: "/api/admin/ads" },
  { id: "payouts",        title: "Paiements",        ico: "💰", ep: "/api/admin/payouts" },
  { id: "dividends",      title: "Dividendes",       ico: "📈", ep: "/api/admin/dividends" },
  { id: "settings",       title: "Réglages",         ico: "⚙️", ep: "/api/admin/settings" },
  { id: "business-rules", title: "Règles métier",    ico: "📐", ep: "/api/admin/business-rules" },
  { id: "audit-logs",     title: "Journal d'audit",  ico: "📜", ep: "/api/admin/audit-logs" },
];

const $ = (s, r = document) => r.querySelector(s);
const el = (t, cls, txt) => { const e = document.createElement(t); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

/* ---------------- API ---------------- */
async function api(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) { doLogout(); throw new Error("Session expirée — reconnectez-vous."); }
  if (res.status === 403) throw new Error("Accès refusé : ce compte n'a pas les droits administrateur.");
  const text = await res.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error((data && data.error) || ("Erreur " + res.status));
  return data;
}

/* ---------------- Auth ---------------- */
async function doLogin(email, password) {
  const data = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  if (!data || !data.token) throw new Error("Réponse inattendue du serveur.");
  token = data.token;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EMAIL_KEY, (data.user && data.user.email) || email);
  showApp();
}
function doLogout() {
  token = ""; localStorage.removeItem(TOKEN_KEY);
  $("#app").hidden = true; $("#login").hidden = false;
}

/* ---------------- Rendu générique ---------------- */
function fmt(v) {
  if (v == null) return "—";
  if (typeof v === "boolean") return v ? "✔️" : "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
function statusBadge(v) {
  const s = String(v).toUpperCase();
  const map = { ACTIVE: "ok", SUPER_ADMIN: "info", DELEGATED_ADMIN: "info",
    SUSPENDED: "danger", DELETED: "danger", PENDING: "warn", PAID: "ok" };
  const b = el("span", "badge " + (map[s] || "info"), v);
  return b;
}
function renderStats(obj) {
  const wrap = el("div", "stats");
  const flat = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v != null && typeof v === "object" && !Array.isArray(v))
      for (const [k2, v2] of Object.entries(v)) flat[`${k} · ${k2}`] = v2;
    else if (!Array.isArray(v)) flat[k] = v;
  }
  for (const [k, v] of Object.entries(flat)) {
    const c = el("div", "stat");
    c.append(el("div", "k", k), el("div", "v", fmt(v)));
    wrap.append(c);
  }
  return wrap.children.length ? wrap : el("div", "empty", "Aucune donnée.");
}
function renderTable(rows, rowActions) {
  if (!rows.length) return el("div", "empty", "Aucun élément.");
  const cols = [...rows.reduce((s, r) => { Object.keys(r).forEach(k => s.add(k)); return s; }, new Set())];
  const card = el("div", "card");
  const scroll = el("div", "table-scroll");
  const table = el("table");
  const thead = el("thead"), htr = el("tr");
  cols.forEach(c => htr.append(el("th", null, c)));
  if (rowActions) htr.append(el("th", null, "Actions"));
  thead.append(htr); table.append(thead);
  const tb = el("tbody");
  rows.forEach(r => {
    const tr = el("tr");
    cols.forEach(c => {
      const td = el("td");
      const key = c.toLowerCase();
      if (r[c] != null && (key.includes("status") || key.includes("role"))) td.append(statusBadge(r[c]));
      else td.textContent = fmt(r[c]);
      tr.append(td);
    });
    if (rowActions) { const td = el("td"); rowActions(r).forEach(b => td.append(b)); tr.append(td); }
    tb.append(tr);
  });
  table.append(tb); scroll.append(table);
  card.append(el("h3", null, `${rows.length} élément(s)`), scroll);
  return card;
}
function smartRender(data, view) {
  if (Array.isArray(data)) return renderTable(data, view.rowActions);
  if (data && typeof data === "object") {
    // objet contenant une liste principale -> table ; sinon cartes de stats.
    const arrKey = Object.keys(data).find(k => Array.isArray(data[k]));
    if (arrKey && data[arrKey].length !== undefined && Object.keys(data).length <= 3 && data[arrKey].length)
      return renderTable(data[arrKey], view.rowActions);
    return renderStats(data);
  }
  return el("div", "empty", "Aucune donnée.");
}

/* ---------------- Actions ---------------- */
function userActions(row) {
  const id = row.id ?? row.userId;
  const suspended = String(row.status || "").toUpperCase() === "SUSPENDED";
  const btn = el("button", "rowbtn " + (suspended ? "" : "danger"), suspended ? "Réactiver" : "Suspendre");
  btn.onclick = async () => {
    if (!id) return;
    btn.disabled = true;
    try {
      await api(`/api/admin/users/${id}/suspend`, { method: "PUT",
        body: JSON.stringify({ status: suspended ? "ACTIVE" : "SUSPENDED" }) });
      loadView(current);
    } catch (e) { alert(e.message); btn.disabled = false; }
  };
  return [btn];
}

/* ---------------- Navigation ---------------- */
let current = "dashboard";
function buildNav() {
  const nav = $("#nav"); nav.innerHTML = "";
  VIEWS.forEach(v => {
    const b = el("button"); b.dataset.id = v.id;
    b.append(el("span", "nav-ico", v.ico), document.createTextNode(v.title));
    b.onclick = () => loadView(v.id);
    nav.append(b);
  });
}
async function loadView(id) {
  current = id;
  const view = VIEWS.find(v => v.id === id);
  $("#view-title").textContent = view.title;
  document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("active", b.dataset.id === id));
  const host = $("#view"); host.innerHTML = ""; host.append(el("div", "loading", "Chargement…"));
  try {
    const data = await api(view.ep);
    host.innerHTML = ""; host.append(smartRender(data, view));
  } catch (e) {
    host.innerHTML = ""; host.append(el("div", "err-inline", e.message));
  }
}

/* ---------------- Boot ---------------- */
function showApp() {
  $("#login").hidden = true; $("#app").hidden = false;
  $("#who").textContent = localStorage.getItem(EMAIL_KEY) || "";
  buildNav(); loadView("dashboard");
}
$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("#login-error"); err.hidden = true;
  const btn = $("#login-btn"); btn.disabled = true; btn.textContent = "Connexion…";
  try { await doLogin($("#email").value.trim(), $("#password").value); }
  catch (ex) { err.textContent = ex.message; err.hidden = false; }
  finally { btn.disabled = false; btn.textContent = "Se connecter"; }
});
$("#logout").addEventListener("click", doLogout);
$("#refresh").addEventListener("click", () => loadView(current));

if (token) showApp(); else { $("#login").hidden = false; }
