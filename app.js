/* ChristLab Team — console d'administration (statique, sans build).
   Consomme l'API /api/admin/* du backend. Auth JWT (login admin). */

const DEFAULT_BASE = "https://christlab-backend-production.up.railway.app";
const BASE = (new URLSearchParams(location.search).get("base")
  || localStorage.getItem("cl_admin_base") || DEFAULT_BASE).replace(/\/+$/, "");

const TOKEN_KEY = "cl_admin_token";
const EMAIL_KEY = "cl_admin_email";
let token = localStorage.getItem(TOKEN_KEY) || "";

const $ = (s, r = document) => r.querySelector(s);
const el = (t, cls, txt) => { const e = document.createElement(t); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

/* ---------- Vocabulaires du catalogue (alignés sur l'app Android + le contrat ALN-002) ---------- */
const VOC = {
  genre: ["Louange", "Adoration", "Saint-Esprit", "Guerre Spirituelle", "Action de grâce",
          "Méditation", "Guérison", "Intercession", "Réveil", "Évangélisation"],
  continent: ["Afrique", "Amériques", "Europe", "Asie", "Asie-Pacifique", "Caraïbes"],
  language: ["Français", "Anglais", "Espagnol", "Portugais", "Lingala", "Zulu", "Coréen",
             "Yoruba & Anglais", "Lingala & Français"],
  type: ["Chorale", "Solo", "Rap", "Gospel urbain", "Gospel traditionnel", "Worship moderne"],
  heartStates: ["Découragé", "Reconnaissant", "En combat", "En attente", "Brisé", "Victorieux"],
};

/* ---------- Spécifications de formulaires (d'après les DTO du backend) ---------- */
const F = {
  // TrackCreateRequest — sert pour la création ET l'édition (PUT = remplacement complet).
  track: [
    { name: "artistId", label: "Artiste", type: "artistPicker", required: true },
    { name: "title", label: "Titre", type: "text", required: true },
    { name: "album", label: "Album", type: "text" },
    { name: "genre", label: "Genre", type: "select", options: VOC.genre, required: true, placeholderOption: "— choisir —" },
    { name: "type", label: "Type", type: "select", options: VOC.type, required: true, placeholderOption: "— choisir —" },
    { name: "language", label: "Langue", type: "select", options: VOC.language, required: true, placeholderOption: "— choisir —" },
    { name: "continent", label: "Continent", type: "select", options: VOC.continent, required: true, placeholderOption: "— choisir —" },
    { name: "country", label: "Pays", type: "text", required: true },
    { name: "durationSec", label: "Durée (secondes)", type: "number", required: true },
    { name: "audioUrl", label: "URL audio", type: "url", required: true, placeholder: "https://…" },
    { name: "coverUrl", label: "URL pochette", type: "url", placeholder: "https://…" },
    { name: "heartStates", label: "États du cœur", type: "multi", options: VOC.heartStates },
    { name: "isPepite", label: "Pépite", type: "checkbox" },
    { name: "isPremiumOnly", label: "Réservé aux abonnés Premium", type: "checkbox" },
    { name: "bibleReference", label: "Référence biblique", type: "text", placeholder: "ex. Psaume 23:1" },
    { name: "lyrics", label: "Paroles", type: "textarea" },
  ],
  artistCreate: [
    { name: "name", label: "Nom d'artiste", type: "text", required: true },
    { name: "contactEmail", label: "E-mail de contact", type: "email" },
    { name: "contactPhone", label: "Téléphone", type: "text" },
    { name: "country", label: "Pays", type: "text" },
    { name: "isEmerging", label: "Artiste émergent (Pépite)", type: "checkbox" },
    { name: "contractType", label: "Type de contrat", type: "text", placeholder: "ex. EXCLUSIF, LICENCE, DISTRIBUTION" },
    { name: "royaltyRate", label: "Taux de royalties", type: "text", placeholder: "ex. 0.70 (laisser vide = taux de la plateforme)" },
    { name: "contractStartDate", label: "Début du contrat", type: "date" },
    { name: "payoutInfo", label: "Coordonnées de paiement", type: "textarea" },
  ],
  pepiteCreate: [
    { name: "type", label: "Type", type: "text", required: true, placeholder: "ex. ARTIST, EVENT, TRACK" },
    { name: "title", label: "Titre", type: "text", required: true },
    { name: "editorialText", label: "Texte éditorial", type: "textarea" },
    { name: "status", label: "Statut", type: "select", options: ["DRAFT", "PUBLISHED", "ARCHIVED"] },
    { name: "visibility", label: "Visibilité", type: "select", options: ["PUBLIC", "PREMIUM", "HIDDEN"] },
    { name: "priority", label: "Priorité", type: "number" },
    { name: "startDate", label: "Début", type: "date" },
    { name: "endDate", label: "Fin", type: "date" },
    { name: "metadata", label: "Métadonnées (JSON libre)", type: "textarea", placeholder: '{"trackId":123}' },
  ],
  adminCreate: [
    { name: "email", label: "E-mail", type: "email", required: true },
    { name: "name", label: "Nom", type: "text", required: true },
    { name: "adminRole", label: "Rôle", type: "select", options: ["DELEGATED_ADMIN", "SUPER_ADMIN"] },
    { name: "permissions", label: "Permissions (séparées par virgules)", type: "text", list: true, placeholder: "users, tracks, ads" },
    { name: "password", label: "Mot de passe (compte)", type: "password", required: true },
  ],
  adminEdit: [
    { name: "adminRole", label: "Rôle", type: "select", options: ["DELEGATED_ADMIN", "SUPER_ADMIN"] },
    { name: "permissions", label: "Permissions (séparées par virgules)", type: "text", list: true },
    { name: "status", label: "Statut", type: "select", options: ["ACTIVE", "SUSPENDED", "DELETED"] },
  ],
  userEdit: [
    { name: "name", label: "Nom", type: "text" },
    { name: "isSuspended", label: "Suspendu", type: "checkbox" },
  ],
  businessRuleEdit: [
    { name: "key", label: "Clé", type: "text", required: true },
    { name: "value", label: "Valeur", type: "text", required: true },
    { name: "unit", label: "Unité (optionnel)", type: "text" },
  ],
};
// UpdateArtistRequest = mêmes champs (tous optionnels) + le statut.
F.artistEdit = [
  ...F.artistCreate,
  { name: "status", label: "Statut", type: "select", options: ["ACTIVE", "SUSPENDED", "ARCHIVED"] },
];

/* Colonnes affichées pour le catalogue (les paroles restent visibles en édition seulement). */
const TRACK_COLS = ["id", "title", "artist", "artistId", "album", "genre", "type", "language",
  "country", "continent", "durationSec", "heartStates", "isPepite", "isPremiumOnly",
  "bibleReference", "audioUrl", "coverUrl"];

/* ---------- Modules (ordre du menu) ---------- */
const VIEWS = [
  { id: "dashboard",      title: "Tableau de bord", ico: "📊", ep: "/api/admin/dashboard" },
  { id: "users",          title: "Utilisateurs",    ico: "👤", ep: "/api/admin/users", rowActions: userActions },
  { id: "administrators", title: "Administrateurs",  ico: "🛡️", ep: "/api/admin/administrators", rowActions: adminActions,
      create: { fields: F.adminCreate, ep: "/api/admin/administrators", method: "POST", label: "Nouvel administrateur" } },
  // La liste du catalogue passe par la route publique /api/tracks : le backend n'expose pas
  // de GET /api/admin/tracks (seulement POST/PUT/DELETE).
  // ?lang=fr est OBLIGATOIRE : sans lui, le backend traduit genre/heartStates selon l'Accept-Language
  // du navigateur, et l'édition réécrirait en base des valeurs traduites au lieu des valeurs canoniques.
  { id: "tracks",         title: "Pistes",           ico: "🎵", ep: "/api/tracks?lang=fr", columns: TRACK_COLS,
      rowActions: trackActions,
      create: { fields: F.track, ep: "/api/admin/tracks", method: "POST", label: "Nouvelle piste", sendEmpty: true } },
  { id: "artists",        title: "Artistes",         ico: "🎙️", ep: "/api/admin/artists", rowActions: artistActions,
      create: { fields: F.artistCreate, ep: "/api/admin/artists", method: "POST", label: "Nouvel artiste" } },
  { id: "pepites",        title: "Pépites",          ico: "💎", ep: "/api/admin/pepites", rowActions: pepiteActions,
      create: { fields: F.pepiteCreate, ep: "/api/admin/pepites", method: "POST", label: "Nouvelle pépite" } },
  { id: "ads",            title: "Publicités",       ico: "📣", ep: "/api/admin/ads" },
  { id: "payouts",        title: "Paiements",        ico: "💰", ep: "/api/admin/payouts" },
  { id: "dividends",      title: "Dividendes",       ico: "📈", ep: "/api/admin/dividends" },
  { id: "settings",       title: "Réglages",         ico: "⚙️", ep: "/api/admin/settings" },
  { id: "business-rules", title: "Règles métier",    ico: "📐", ep: "/api/admin/business-rules", rowActions: businessRuleActions },
  { id: "audit-logs",     title: "Journal d'audit",  ico: "📜", ep: "/api/admin/audit-logs" },
];

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
  token = ""; ARTISTS = null; localStorage.removeItem(TOKEN_KEY);
  $("#app").hidden = true; $("#login").hidden = false;
}

/* ---------------- Modale formulaire ---------------- */
function openForm(title, fields, values = {}, opts = {}) {
  return new Promise((resolve) => {
    const back = el("div", "modal-back");
    const modal = el("div", "modal");
    modal.append(el("h3", null, title));
    const form = el("form", "modal-form");
    const inputs = {};
    fields.forEach(f => {
      const v = values[f.name];
      const lab = el("label", null, f.label + (f.required ? " *" : ""));
      let input;
      if (f.type === "textarea") { input = el("textarea"); input.rows = 3; }
      else if (f.type === "select") {
        input = el("select");
        if (f.placeholderOption) { const op = el("option", null, f.placeholderOption); op.value = ""; input.append(op); }
        const options = [...(f.options || [])];
        // Une valeur existante hors vocabulaire (donnée héritée) reste sélectionnable.
        if (v != null && v !== "" && !options.includes(v)) options.push(v);
        options.forEach(o => { const op = el("option", null, o); op.value = o; input.append(op); });
      }
      else if (f.type === "artistPicker") {
        input = el("select");
        const list = [...(ARTISTS || [])];
        const none = el("option", null, list.length
          ? "— choisir un artiste —"
          : "— aucun artiste : créez-le d'abord dans « Artistes » —");
        none.value = ""; input.append(none);
        // Piste rattachée à un artiste absent de la liste (ou liste non chargée) : on conserve le lien.
        if (v != null && v !== "" && !list.some(a => String(a.id) === String(v)))
          list.push({ id: v, name: values.artist || ("Artiste #" + v) });
        list.forEach(a => {
          const op = el("option", null, a.name); op.value = String(a.id); op.dataset.name = a.name; input.append(op);
        });
      }
      else if (f.type === "multi") {
        input = el("div", "multi");
        const cur = String(v ?? "").split(",").map(s => s.trim()).filter(Boolean);
        (f.options || []).forEach(o => {
          const row = el("label", "chk");
          const cb = el("input"); cb.type = "checkbox"; cb.value = o; cb.checked = cur.includes(o);
          row.append(cb, document.createTextNode(" " + o));
          input.append(row);
        });
      }
      else if (f.type === "checkbox") { input = el("input"); input.type = "checkbox"; }
      else { input = el("input"); input.type = f.type || "text"; }
      if (f.placeholder) input.placeholder = f.placeholder;
      if (f.required && f.type !== "checkbox" && f.type !== "multi") input.required = true;
      // pré-remplissage
      if (v != null && f.type !== "multi") {
        if (f.type === "checkbox") input.checked = !!v;
        else if (f.list && Array.isArray(v)) input.value = v.join(", ");
        else input.value = v;
      }
      inputs[f.name] = { input, spec: f };
      if (f.type === "checkbox") { const row = el("label", "chk"); row.append(input, document.createTextNode(" " + f.label)); form.append(row); }
      else if (f.type === "multi") {
        const wrap = el("div", "field");
        wrap.append(el("div", "field-label", f.label), input);
        form.append(wrap);
      }
      else { lab.append(input); form.append(lab); }
    });
    const errBox = el("div", "error"); errBox.hidden = true;
    const actions = el("div", "modal-actions");
    const cancel = el("button", "ghost", "Annuler"); cancel.type = "button";
    const submit = el("button", "btn", "Enregistrer"); submit.type = "submit";
    actions.append(cancel, submit);
    form.append(errBox, actions);
    modal.append(form); back.append(modal); document.body.append(back);
    const close = (val) => { back.remove(); resolve(val); };
    cancel.onclick = () => close(null);
    back.onclick = (e) => { if (e.target === back) close(null); };
    form.onsubmit = (e) => {
      e.preventDefault();
      const out = {};
      for (const [name, { input, spec }] of Object.entries(inputs)) {
        if (spec.type === "checkbox") { out[name] = input.checked; continue; }
        if (spec.type === "multi") {
          out[name] = [...input.querySelectorAll("input:checked")].map(c => c.value).join(", ");
          continue;
        }
        if (spec.type === "artistPicker") {
          // Le DTO porte à la fois artistId (clé) et artist (façade texte) : ils doivent rester cohérents.
          const opt = input.selectedOptions[0];
          if (!input.value) { out[name] = null; out.artist = ""; }
          else { out[name] = Number(input.value); out.artist = (opt && opt.dataset.name) || ""; }
          continue;
        }
        let val = input.value.trim();
        // opts.sendEmpty : le DTO exige la présence des champs (remplacement complet) -> on envoie même vide.
        if (val === "" && !opts.sendEmpty) continue;
        if (spec.list) out[name] = val.split(",").map(s => s.trim()).filter(Boolean);
        else if (spec.type === "number") out[name] = Number(val || 0);
        else out[name] = val;
      }
      close(out);
    };
  });
}

/* Cache de la liste des artistes (alimente le sélecteur d'artiste des pistes). */
let ARTISTS = null;
async function ensureArtists(force = false) {
  if (!ARTISTS || force) {
    try { ARTISTS = await api("/api/admin/artists"); }
    catch { ARTISTS = ARTISTS || []; }
  }
  return ARTISTS;
}
async function prepareFields(fields) {
  if (fields.some(f => f.type === "artistPicker")) await ensureArtists();
}

async function runCreate(view) {
  await prepareFields(view.create.fields);
  const values = await openForm(view.create.label, view.create.fields, {}, { sendEmpty: view.create.sendEmpty });
  if (!values) return;
  try {
    await api(view.create.ep, { method: view.create.method, body: JSON.stringify(values) });
    if (view.id === "artists") await ensureArtists(true);
    loadView(current);
  } catch (e) { alert(e.message); }
}
async function runEdit(title, fields, initial, ep, method = "PUT", opts = {}) {
  await prepareFields(fields);
  const values = await openForm(title, fields, initial, opts);
  if (!values) return;
  try {
    await api(ep, { method, body: JSON.stringify(values) });
    if (opts.refreshArtists) await ensureArtists(true);
    loadView(current);
  } catch (e) { alert(e.message); }
}
async function runDelete(ep, label) {
  if (!confirm(`Supprimer ${label} ? Cette action est définitive.`)) return;
  try { await api(ep, { method: "DELETE" }); loadView(current); }
  catch (e) { alert(e.message); }
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
  const map = { ACTIVE: "ok", PUBLISHED: "ok", PAID: "ok", SUPER_ADMIN: "info", DELEGATED_ADMIN: "info",
    DRAFT: "warn", PENDING: "warn", ARCHIVED: "warn", SUSPENDED: "danger", DELETED: "danger", HIDDEN: "danger" };
  return el("span", "badge " + (map[s] || "info"), v);
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
    const c = el("div", "stat"); c.append(el("div", "k", k), el("div", "v", fmt(v))); wrap.append(c);
  }
  return wrap.children.length ? wrap : el("div", "empty", "Aucune donnée.");
}
function renderTable(rows, rowActions, columns) {
  if (!rows.length) return el("div", "empty", "Aucun élément.");
  const all = [...rows.reduce((s, r) => { Object.keys(r).forEach(k => s.add(k)); return s; }, new Set())];
  // `columns` fixe l'ordre et masque le bruit (paroles…) ; sinon toutes les clés présentes.
  const cols = columns ? columns.filter(c => all.includes(c)) : all;
  const card = el("div", "card");
  const head = el("h3");
  const count = el("span", null, `${rows.length} élément(s)`);
  const filter = el("input", "table-filter"); filter.type = "search"; filter.placeholder = "Filtrer…";
  head.append(count, filter);
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
      const td = el("td"); const key = c.toLowerCase();
      if (r[c] != null && (key.includes("status") || key.includes("role") || key === "visibility")) td.append(statusBadge(r[c]));
      else {
        const txt = fmt(r[c]);
        td.textContent = txt.length > 120 ? txt.slice(0, 120) + "…" : txt;
        if (txt.length > 120) td.title = txt;
      }
      tr.append(td);
    });
    if (rowActions) { const td = el("td", "actions-cell"); rowActions(r).forEach(b => td.append(b)); tr.append(td); }
    tr.dataset.search = cols.map(c => fmt(r[c])).join(" ").toLowerCase();
    tb.append(tr);
  });
  filter.oninput = () => {
    const q = filter.value.trim().toLowerCase();
    let shown = 0;
    [...tb.children].forEach(tr => {
      const ok = !q || tr.dataset.search.includes(q);
      tr.hidden = !ok; if (ok) shown++;
    });
    count.textContent = q ? `${shown} / ${rows.length} élément(s)` : `${rows.length} élément(s)`;
  };
  table.append(tb); scroll.append(table);
  card.append(head, scroll);
  return card;
}
function smartRender(data, view) {
  if (Array.isArray(data)) return renderTable(data, view.rowActions, view.columns);
  if (data && typeof data === "object") {
    const arrKey = Object.keys(data).find(k => Array.isArray(data[k]));
    if (arrKey && Object.keys(data).length <= 3 && data[arrKey].length)
      return renderTable(data[arrKey], view.rowActions, view.columns);
    return renderStats(data);
  }
  return el("div", "empty", "Aucune donnée.");
}

/* ---------------- Actions par ligne ---------------- */
function iconBtn(label, cls, onClick) { const b = el("button", "rowbtn " + (cls || ""), label); b.onclick = onClick; return b; }

function userActions(row) {
  const id = row.id ?? row.userId;
  const suspended = String(row.status || "").toUpperCase() === "SUSPENDED" || row.isSuspended === true;
  return [
    iconBtn("Éditer", "", () => runEdit("Éditer l'utilisateur", F.userEdit,
      { name: row.name, isSuspended: suspended }, `/api/admin/users/${id}`)),
    iconBtn(suspended ? "Réactiver" : "Suspendre", suspended ? "" : "danger", async () => {
      try { await api(`/api/admin/users/${id}/suspend`, { method: "PUT", body: JSON.stringify({ status: suspended ? "ACTIVE" : "SUSPENDED" }) }); loadView(current); }
      catch (e) { alert(e.message); }
    }),
  ];
}
function adminActions(row) {
  const id = row.id;
  return [ iconBtn("Éditer", "", () => runEdit("Éditer l'administrateur", F.adminEdit,
    { adminRole: row.adminRole, permissions: row.permissions, status: row.status }, `/api/admin/administrators/${id}`)) ];
}
function pepiteActions(row) {
  const id = row.id;
  return [
    iconBtn("Éditer", "", () => runEdit("Éditer la pépite", F.pepiteCreate, row, `/api/admin/pepites/${id}`)),
    iconBtn("Supprimer", "danger", () => runDelete(`/api/admin/pepites/${id}`, `« ${row.title} »`)),
  ];
}
function trackActions(row) {
  return [
    iconBtn("Éditer", "", () => runEdit("Éditer la piste", F.track, row,
      `/api/admin/tracks/${encodeURIComponent(row.id)}`, "PUT", { sendEmpty: true })),
    iconBtn("Supprimer", "danger", () => runDelete(`/api/admin/tracks/${encodeURIComponent(row.id)}`, `« ${row.title} »`)),
  ];
}
function artistActions(row) {
  const id = row.id;
  return [
    iconBtn("Éditer", "", () => runEdit("Éditer l'artiste", F.artistEdit, row,
      `/api/admin/artists/${id}`, "PUT", { refreshArtists: true })),
    iconBtn("Chants", "", () => showArtistTracks(id, row.name)),
  ];
}

/* Détail artiste : GET /api/admin/artists/{id} renvoie { artist, tracks }. */
async function showArtistTracks(id, name) {
  const back = el("div", "modal-back");
  const modal = el("div", "modal wide");
  modal.append(el("h3", null, `Chants de ${name}`));
  const body = el("div"); body.append(el("div", "loading", "Chargement…"));
  const actions = el("div", "modal-actions");
  const closeBtn = el("button", "ghost", "Fermer");
  actions.append(closeBtn);
  modal.append(body, actions); back.append(modal); document.body.append(back);
  const close = () => back.remove();
  closeBtn.onclick = close;
  back.onclick = (e) => { if (e.target === back) close(); };
  try {
    const data = await api(`/api/admin/artists/${id}`);
    const tracks = (data && data.tracks) || [];
    body.innerHTML = "";
    body.append(tracks.length
      ? renderTable(tracks, null, ["id", "title", "album", "genre", "type", "durationSec", "isPepite", "isPremiumOnly"])
      : el("div", "empty", "Aucun chant rattaché à cet artiste."));
  } catch (e) {
    body.innerHTML = ""; body.append(el("div", "err-inline", e.message));
  }
}

function businessRuleActions(row) {
  return [ iconBtn("Éditer", "", () => runEdit("Éditer la règle", F.businessRuleEdit,
    { key: row.key, value: row.value, unit: row.unit }, `/api/admin/business-rules`)) ];
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
  const host = $("#view"); host.innerHTML = "";
  if (view.create) {
    const bar = el("div", "toolbar");
    const add = el("button", "btn small", "＋ " + view.create.label);
    add.onclick = () => runCreate(view);
    bar.append(add); host.append(bar);
  }
  const holder = el("div"); host.append(holder);
  holder.append(el("div", "loading", "Chargement…"));
  try {
    const data = await api(view.ep);
    holder.innerHTML = ""; holder.append(smartRender(data, view));
  } catch (e) {
    holder.innerHTML = ""; holder.append(el("div", "err-inline", e.message));
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
