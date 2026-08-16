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
    // Les 7 types sont fermés côté backend (PepiteTypes.ALLOWED) : toute autre valeur est rejetée.
    { name: "type", label: "Type", type: "select", required: true, placeholderOption: "— choisir —",
      options: ["PEPITE_TRACK", "PEPITE_ARTIST", "UPCOMING_ALBUM", "UPCOMING_EVENT",
                "UNOFFICIAL_TRACK", "EDITORIAL_SELECTION", "CHRISTLAB_NEWS"] },
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
    { name: "permissions", label: "Permissions (séparées par virgules)", type: "text", list: true, placeholder: "users, catalogue, finances, pub" },
    // Le backend ignore ce mot de passe si un compte existe déjà avec cet e-mail :
    // il se contente alors de passer le compte en rôle ADMIN.
    { name: "password", label: "Mot de passe (ignoré si le compte existe déjà)", type: "password", required: true },
  ],
  adminEdit: [
    { name: "adminRole", label: "Rôle", type: "select", options: ["DELEGATED_ADMIN", "SUPER_ADMIN"] },
    { name: "permissions", label: "Permissions (séparées par virgules)", type: "text", list: true, placeholder: "users, catalogue, finances, pub" },
    { name: "status", label: "Statut", type: "select", options: ["ACTIVE", "SUSPENDED", "DELETED"] },
  ],
  // UserUpdateRequest expose aussi l'abonnement : indispensable pour offrir ou prolonger un accès.
  userEdit: [
    { name: "name", label: "Nom", type: "text" },
    { name: "premiumStatus", label: "Abonnement", type: "select", options: ["ACTIVE", "TRIAL", "EXPIRED"], placeholderOption: "— inchangé —" },
    { name: "premiumEndDate", label: "Fin d'abonnement", type: "date" },
    { name: "isSuspended", label: "Suspendu", type: "checkbox" },
  ],
  dividendGrant: [
    { name: "amount", label: "Montant (USD)", type: "text", required: true, placeholder: "ex. 25.00" },
    { name: "reason", label: "Motif", type: "textarea", required: true, placeholder: "Pourquoi ce dividende est accordé" },
  ],
  businessRuleEdit: [
    { name: "key", label: "Clé", type: "text", required: true },
    { name: "value", label: "Valeur", type: "text", required: true },
    { name: "unit", label: "Unité (optionnel)", type: "text" },
  ],
};
// --- RÉGIE PUBLICITAIRE (annonceurs / campagnes / factures) ---
F.advertiser = [
  { name: "name", label: "Nom de l'annonceur", type: "text", required: true },
  { name: "contactEmail", label: "E-mail de contact", type: "email", required: true },
  { name: "contactPhone", label: "Téléphone", type: "text" },
  { name: "billingInfo", label: "Informations de facturation", type: "textarea" },
  { name: "status", label: "Statut", type: "select", options: ["ACTIVE", "INACTIVE"] },
];
F.campaign = [
  { name: "advertiserId", label: "Annonceur", type: "picker", source: "advertisers", required: true },
  { name: "placement", label: "Emplacement", type: "select", options: ["PAGE_GEMS"], required: true },
  // Le backend compare ces dates à un instant ISO complet : on borne la journée (voir `iso` dans openForm).
  { name: "startDate", label: "Début", type: "date", iso: "start", required: true },
  { name: "endDate", label: "Fin", type: "date", iso: "end", required: true },
  { name: "tariff", label: "Tarif (USD)", type: "text", required: true, placeholder: "ex. 50.00" },
  { name: "contentUrl", label: "URL de la bannière", type: "url", placeholder: "https://…" },
  { name: "targetUrl", label: "URL de destination (clic)", type: "url", placeholder: "https://…" },
  // Seul le statut ACTIVE est diffusé dans l'app, et uniquement entre les dates de début et de fin.
  { name: "status", label: "Statut", type: "select", options: ["PLANIFIEE", "ACTIVE", "TERMINEE"] },
];
F.invoice = [
  { name: "advertiserId", label: "Annonceur", type: "picker", source: "advertisers", required: true },
  { name: "campaignId", label: "Campagne", type: "picker", source: "campaigns", required: true },
  { name: "amount", label: "Montant (USD)", type: "text", required: true, placeholder: "ex. 250.00" },
  { name: "status", label: "Statut", type: "select", options: ["IMPAYEE", "PAYEE"] },
];
// Génère les relevés de répartition d'une période (POST /api/admin/payouts/calculate).
// Les bornes sont comparées à `listenedAt`, un horodatage ISO complet : une date nue
// exclurait toutes les écoutes du dernier jour de la période.
F.payoutCalc = [
  { name: "periodStart", label: "Début de période", type: "date", iso: "start", required: true },
  { name: "periodEnd", label: "Fin de période", type: "date", iso: "end", required: true },
  { name: "totalRevenueCollected", label: "Revenus encaissés sur la période (USD)", type: "text", required: true, placeholder: "ex. 1500.00" },
];

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
  // La régie publicitaire n'a pas de GET sur /api/admin/ads : le backend expose trois
  // ressources distinctes (annonceurs, campagnes, factures) + /stats repris au tableau de bord.
  { id: "advertisers",    title: "Annonceurs",       ico: "🏢", ep: "/api/admin/ads/advertisers", rowActions: advertiserActions,
      create: { fields: F.advertiser, ep: "/api/admin/ads/advertisers", method: "POST", label: "Nouvel annonceur" } },
  { id: "campaigns",      title: "Campagnes",        ico: "📣", ep: "/api/admin/ads/campaigns", rowActions: campaignActions,
      filters: [{ name: "status", label: "Statut", options: ["PLANIFIEE", "ACTIVE", "TERMINEE"] },
                { name: "placement", label: "Emplacement", options: ["PAGE_GEMS"] }],
      create: { fields: F.campaign, ep: "/api/admin/ads/campaigns", method: "POST", label: "Nouvelle campagne" } },
  { id: "invoices",       title: "Factures pub",     ico: "🧾", ep: "/api/admin/ads/invoices", rowActions: invoiceActions,
      filters: [{ name: "status", label: "Statut", options: ["IMPAYEE", "PAYEE"] }],
      create: { fields: F.invoice, ep: "/api/admin/ads/invoices", method: "POST", label: "Nouvelle facture" } },
  { id: "payouts",        title: "Paiements",        ico: "💰", ep: "/api/admin/payouts", rowActions: payoutActions,
      create: { fields: F.payoutCalc, ep: "/api/admin/payouts/calculate", method: "POST", label: "Calculer les versements", icon: "🧮", guard: guardPayoutPeriod } },
  { id: "dividends",      title: "Dividendes",       ico: "📈", ep: "/api/admin/dividends" },
  // Impact des artistes émergents : c'est ce qui justifie les dividendes accordés.
  { id: "emerging",       title: "Impact Pépites",   ico: "🌱", ep: "/api/admin/emerging-impact", rowActions: emergingActions },
  // NB : /api/admin/settings n'expose qu'un seul taux, déjà présent et ÉDITABLE dans
  // « Règles métier ». Le module faisait doublon en lecture seule, il a été retiré.
  { id: "business-rules", title: "Règles métier",    ico: "📐", ep: "/api/admin/business-rules", rowActions: businessRuleActions },
  { id: "audit-logs",     title: "Journal d'audit",  ico: "📜", ep: "/api/admin/audit-logs" },
];

/* ---------------- API ---------------- */
async function api(path, opts = {}) {
  // isLogin : sur l'écran de connexion, un 401 veut dire « identifiants refusés »,
  // surtout pas « session expirée » (message trompeur qui masque la vraie cause).
  const { isLogin, ...fetchOpts } = opts;
  const res = await fetch(BASE + path, {
    ...fetchOpts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) {
    if (isLogin) throw new Error("E-mail ou mot de passe incorrect — ou compte suspendu.");
    doLogout(); throw new Error("Session expirée — reconnectez-vous.");
  }
  if (res.status === 403) throw new Error("Accès refusé : ce compte n'a pas les droits administrateur.");
  const text = await res.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error((data && data.error) || ("Erreur " + res.status));
  return data;
}

/* ---------------- Auth ---------------- */
async function doLogin(email, password) {
  const data = await api("/api/auth/login", { method: "POST", isLogin: true, body: JSON.stringify({ email, password }) });
  if (!data || !data.token) throw new Error("Réponse inattendue du serveur.");
  token = data.token;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EMAIL_KEY, (data.user && data.user.email) || email);
  showApp();
}
function doLogout() {
  token = ""; ARTISTS = null; Object.keys(REFS).forEach(k => delete REFS[k]); localStorage.removeItem(TOKEN_KEY);
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
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
      else if (f.type === "picker") {
        input = el("select");
        const none = el("option", null, "— choisir —"); none.value = ""; input.append(none);
        const src = REF_SOURCES[f.source] || {};
        const list = REFS[f.source] || [];
        list.forEach(r => {
          const op = el("option", null, src.label ? src.label(r) : String(r.id));
          op.value = String(r.id); input.append(op);
        });
        // Référence pointant hors de la liste chargée : on la conserve plutôt que de la perdre.
        if (v != null && v !== "" && !list.some(r => String(r.id) === String(v))) {
          const op = el("option", null, "#" + v); op.value = String(v); input.append(op);
        }
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
        // Un champ date n'accepte que AAAA-MM-JJ : on tronque une valeur ISO complète.
        else if (f.type === "date" && typeof v === "string") input.value = v.slice(0, 10);
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
    const actions = el("div", "modal-actions");
    const cancel = el("button", "ghost", "Annuler"); cancel.type = "button";
    const submit = el("button", "btn", "Enregistrer"); submit.type = "submit";
    actions.append(cancel, submit);
    form.append(actions);
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
        if (spec.type === "picker") { out[name] = input.value ? Number(input.value) : null; continue; }
        let val = input.value.trim();
        // Le backend compare les bornes de campagne à un instant ISO complet : une date nue
        // exclurait la campagne le jour même de sa fin. On borne donc la journée.
        if (spec.iso && val.length === 10) val += (spec.iso === "start" ? "T00:00:00Z" : "T23:59:59Z");
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
/* Listes de référence génériques pour les champs `picker` (annonceurs, campagnes…). */
const REF_SOURCES = {
  advertisers: { ep: "/api/admin/ads/advertisers", label: r => r.name },
  campaigns: { ep: "/api/admin/ads/campaigns", label: r => `#${r.id} — ${r.placement} — ${r.advertiserName || ""}`.trim() },
};
const REFS = {};
async function ensureRef(source, force = false) {
  if (!REFS[source] || force) {
    try { REFS[source] = await api(REF_SOURCES[source].ep); }
    catch { REFS[source] = REFS[source] || []; }
  }
  return REFS[source];
}

async function prepareFields(fields) {
  if (fields.some(f => f.type === "artistPicker")) await ensureArtists();
  const sources = [...new Set(fields.filter(f => f.type === "picker").map(f => f.source))];
  await Promise.all(sources.map(s => ensureRef(s)));
}

/* Le backend n'a AUCUN contrôle de doublon sur le calcul des versements : relancer la même
   période crée des relevés en double, et aucun endpoint ne permet de les supprimer. */
async function guardPayoutPeriod(values) {
  const debut = String(values.periodStart || "").slice(0, 10);
  const fin = String(values.periodEnd || "").slice(0, 10);
  let existants = [];
  try { existants = await api("/api/admin/payouts"); } catch { return true; }
  const doublons = (existants || []).filter(p =>
    String(p.periodStart || "").slice(0, 10) === debut && String(p.periodEnd || "").slice(0, 10) === fin);
  if (!doublons.length) return true;
  return confirm(
    `ATTENTION — ${doublons.length} relevé(s) existent déjà pour la période du ${debut} au ${fin}.\n\n` +
    `Relancer le calcul créera des relevés EN DOUBLE : les montants dus seront comptés deux fois, ` +
    `et le serveur ne permet pas de les supprimer ensuite.\n\nContinuer quand même ?`);
}

async function runCreate(view) {
  await prepareFields(view.create.fields);
  const values = await openForm(view.create.label, view.create.fields, {}, { sendEmpty: view.create.sendEmpty });
  if (!values) return;
  if (view.create.guard && !(await view.create.guard(values))) return;
  try {
    await api(view.create.ep, { method: view.create.method, body: JSON.stringify(values) });
    if (view.id === "artists") await ensureArtists(true);
    if (REF_SOURCES[view.id]) await ensureRef(view.id, true);
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
    if (opts.refreshRef) await ensureRef(opts.refreshRef, true);
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
  const map = {
    ACTIVE: "ok", PUBLISHED: "ok", PAID: "ok", PAYEE: "ok", TERMINEE: "ok", TRIAL: "ok",
    SUPER_ADMIN: "info", DELEGATED_ADMIN: "info", PUBLIC: "info",
    DRAFT: "warn", PENDING: "warn", ARCHIVED: "warn", PLANIFIEE: "warn", IMPAYEE: "warn",
    EXPIRED: "warn", PREMIUM: "warn",
    SUSPENDED: "danger", DELETED: "danger", HIDDEN: "danger", INACTIVE: "danger",
  };
  return el("span", "badge " + (map[s] || "info"), v);
}
/* Libellés lisibles des indicateurs du tableau de bord (les clés brutes viennent de l'API). */
const STAT_LABELS = {
  totalUsers: "Utilisateurs", activePremiumUsers: "Abonnés actifs", trialUsers: "En période d'essai",
  suspendedUsers: "Comptes suspendus", totalPlaybacks: "Écoutes totales", totalValidPlaybacks: "Écoutes valides",
  currency: "Devise", estimatedMonthlyRevenue: "Revenu mensuel estimé",
  adRevenuePaid: "Revenus pub encaissés", adRevenueUnpaid: "Revenus pub en attente",
  totalAdRevenue: "Revenus pub totaux", adViews: "Impressions pub", adClicks: "Clics pub",
  emergingRoyaltyRate: "Taux de royalties Pépites",
};
function renderStats(obj) {
  const wrap = el("div", "stats");
  const flat = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v != null && typeof v === "object" && !Array.isArray(v))
      for (const [k2, v2] of Object.entries(v)) flat[STAT_LABELS[k2] || `${k} · ${k2}`] = v2;
    else if (!Array.isArray(v)) flat[STAT_LABELS[k] || k] = v;
  }
  for (const [k, v] of Object.entries(flat)) {
    const c = el("div", "stat"); c.append(el("div", "k", k), el("div", "v", fmt(v))); wrap.append(c);
  }
  return wrap.children.length ? wrap : el("div", "empty", "Aucune donnée.");
}
/* Nombre de lignes affichées d'un coup. La pagination est forcément côté navigateur :
   aucun endpoint du backend n'accepte de limite ni de décalage. */
const PAGE_SIZE = 50;

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
  // Filtre et pagination partagent le même état : filtrer remet à la première page.
  const trs = [...tb.children];
  let page = 0, q = "";
  const pager = el("div", "pager");
  const prev = el("button", "ghost small", "‹ Précédent");
  const next = el("button", "ghost small", "Suivant ›");
  const pageInfo = el("span", "muted");
  pager.append(prev, pageInfo, next);

  function apply() {
    const match = q ? trs.filter(tr => tr.dataset.search.includes(q)) : trs;
    const pages = Math.max(1, Math.ceil(match.length / PAGE_SIZE));
    if (page >= pages) page = pages - 1;
    if (page < 0) page = 0;
    trs.forEach(tr => { tr.hidden = true; });
    match.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).forEach(tr => { tr.hidden = false; });
    count.textContent = q ? `${match.length} / ${rows.length} élément(s)` : `${rows.length} élément(s)`;
    pager.hidden = match.length <= PAGE_SIZE;
    pageInfo.textContent = `Page ${page + 1} sur ${pages}`;
    prev.disabled = page === 0;
    next.disabled = page >= pages - 1;
  }
  filter.oninput = () => { q = filter.value.trim().toLowerCase(); page = 0; apply(); };
  prev.onclick = () => { page--; apply(); };
  next.onclick = () => { page++; apply(); };
  apply();

  table.append(tb); scroll.append(table);
  card.append(head, scroll, pager);
  return card;
}
const SECTION_LABELS = {
  topTracks: "Top 5 des pistes", topArtists: "Top 5 des artistes", blocks: "Blocs",
};
function smartRender(data, view) {
  if (Array.isArray(data)) return renderTable(data, view.rowActions, view.columns);
  if (data && typeof data === "object") {
    const arrKeys = Object.keys(data).filter(k => Array.isArray(data[k]));
    // Réponse enveloppant une seule liste : on rend la liste directement.
    if (arrKeys.length === 1 && Object.keys(data).length === 1)
      return renderTable(data[arrKeys[0]], view.rowActions, view.columns);
    // Réponse mixte (tableau de bord : kpis + topTracks + topArtists) : on affiche TOUT.
    // L'ancienne version ne gardait que la première liste et perdait silencieusement les KPI.
    if (arrKeys.length) {
      const wrap = el("div", "sections");
      const scalaires = Object.fromEntries(Object.entries(data).filter(([k]) => !arrKeys.includes(k)));
      if (Object.keys(scalaires).length) wrap.append(renderStats(scalaires));
      arrKeys.forEach(k => {
        if (!data[k].length) return;
        const sec = el("div", "section");
        sec.append(el("h2", "section-title", SECTION_LABELS[k] || k));
        sec.append(renderTable(data[k], null));
        wrap.append(sec);
      });
      return wrap.children.length ? wrap : el("div", "empty", "Aucune donnée.");
    }
    return renderStats(data);
  }
  return el("div", "empty", "Aucune donnée.");
}

/* ---------------- Actions par ligne ---------------- */
function iconBtn(label, cls, onClick) { const b = el("button", "rowbtn " + (cls || ""), label); b.onclick = onClick; return b; }

function userActions(row) {
  const id = row.id ?? row.userId;
  const suspended = String(row.status || "").toUpperCase() === "SUSPENDED" || row.isSuspended === true;
  const btns = [
    iconBtn("Éditer", "", () => runEdit("Éditer l'utilisateur", F.userEdit,
      { name: row.name, isSuspended: suspended, premiumStatus: row.premiumStatus, premiumEndDate: row.premiumEndDate },
      `/api/admin/users/${id}`)),
  ];
  // Garde-fou : se suspendre soi-même verrouille la console sans aucun recours applicatif
  // (le backend n'a pas de réinitialisation) — il faudrait repasser par la base de données.
  if (estMonCompte(row.email)) {
    btns.push(el("span", "muted", "— votre compte"));
    return btns;
  }
  // Le backend inverse lui-même le statut : cette route ne lit aucun corps de requête.
  btns.push(iconBtn(suspended ? "Réactiver" : "Suspendre", suspended ? "" : "danger", async () => {
    if (!confirm(`${suspended ? "Réactiver" : "Suspendre"} le compte de ${row.name} (${row.email}) ?`)) return;
    try { await api(`/api/admin/users/${id}/suspend`, { method: "PUT" }); loadView(current); }
    catch (e) { alert(e.message); }
  }));
  return btns;
}
function estMonCompte(email) {
  const moi = (localStorage.getItem(EMAIL_KEY) || "").trim().toLowerCase();
  return !!moi && String(email || "").trim().toLowerCase() === moi;
}
function emergingActions(row) {
  return [iconBtn("Dividende", "", () => runEdit(`Accorder un dividende à ${row.artistName}`,
    F.dividendGrant, {}, `/api/admin/dividends/artist/${row.artistId}`, "POST"))];
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
    // Les artistes émergents sont EXCLUS du calcul automatique des versements :
    // le dividende manuel est leur seul mode de rémunération.
    iconBtn("Dividende", "", () => runEdit(`Accorder un dividende à ${row.name}`, F.dividendGrant, {},
      `/api/admin/dividends/artist/${id}`, "POST")),
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

/* --- RÉGIE PUBLICITAIRE --- */
function advertiserActions(row) {
  const id = row.id;
  const inactive = String(row.status || "").toUpperCase() === "INACTIVE";
  const btns = [
    iconBtn("Éditer", "", () => runEdit("Éditer l'annonceur", F.advertiser, row,
      `/api/admin/ads/advertisers/${id}`, "PUT", { refreshRef: "advertisers" })),
  ];
  // Le backend n'a pas de vraie suppression : DELETE bascule le statut en INACTIVE.
  if (!inactive) {
    btns.push(iconBtn("Désactiver", "danger", async () => {
      if (!confirm(`Désactiver l'annonceur « ${row.name} » ? Ses campagnes ne seront plus diffusées.`)) return;
      try { await api(`/api/admin/ads/advertisers/${id}`, { method: "DELETE" }); await ensureRef("advertisers", true); loadView(current); }
      catch (e) { alert(e.message); }
    }));
  }
  return btns;
}
function campaignActions(row) {
  const id = row.id;
  const status = String(row.status || "").toUpperCase();
  const setStatus = (s, label) => iconBtn(label, "", async () => {
    try { await api(`/api/admin/ads/campaigns/${id}/status`, { method: "PUT", body: JSON.stringify({ status: s }) }); loadView(current); }
    catch (e) { alert(e.message); }
  });
  const btns = [
    iconBtn("Éditer", "", () => runEdit("Éditer la campagne", F.campaign, row,
      `/api/admin/ads/campaigns/${id}`, "PUT", { refreshRef: "campaigns" })),
  ];
  // Seule une campagne ACTIVE est diffusée, et uniquement entre ses dates de début et de fin.
  if (status !== "ACTIVE") btns.push(setStatus("ACTIVE", "Activer"));
  if (status !== "TERMINEE") btns.push(setStatus("TERMINEE", "Terminer"));
  return btns;
}
function invoiceActions(row) {
  const id = row.id;
  if (String(row.status || "").toUpperCase() === "PAYEE") return [el("span", "muted", "Payée")];
  return [iconBtn("Marquer payée", "", async () => {
    if (!confirm(`Marquer la facture #${id} (${row.amount} USD) comme payée ?`)) return;
    try { await api(`/api/admin/ads/invoices/${id}/pay`, { method: "PUT" }); loadView(current); }
    catch (e) { alert(e.message); }
  })];
}

/* --- VERSEMENTS AUX ARTISTES --- */
function payoutActions(row) {
  const id = row.id;
  const paid = row.isPaid === true;
  return [iconBtn(paid ? "Annuler le paiement" : "Marquer payé", paid ? "danger" : "", async () => {
    const label = `${row.artistName} — ${row.amountDue} ${row.currency || "USD"}`;
    if (!confirm(paid ? `Annuler le paiement de ${label} ?` : `Marquer ${label} comme payé ?`)) return;
    try { await api(`/api/admin/payouts/${id}/pay`, { method: "PUT", body: JSON.stringify({ isPaid: !paid }) }); loadView(current); }
    catch (e) { alert(e.message); }
  })];
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
/* Filtres appliqués CÔTÉ SERVEUR (le backend les accepte en paramètres d'URL),
   contrairement au champ « Filtrer… » du tableau qui ne trie que ce qui est déjà chargé. */
const FILTER_STATE = {};

async function loadView(id) {
  current = id;
  const view = VIEWS.find(v => v.id === id);
  $("#view-title").textContent = view.title;
  document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("active", b.dataset.id === id));
  const host = $("#view"); host.innerHTML = "";

  if (view.create || view.filters) {
    const bar = el("div", "toolbar");
    if (view.filters) {
      const grp = el("div", "filters");
      view.filters.forEach(f => {
        const wrap = el("label", "filter-field", f.label);
        const sel = el("select");
        const any = el("option", null, "Tous"); any.value = ""; sel.append(any);
        f.options.forEach(o => { const op = el("option", null, o); op.value = o; sel.append(op); });
        sel.value = (FILTER_STATE[id] && FILTER_STATE[id][f.name]) || "";
        sel.onchange = () => {
          FILTER_STATE[id] = { ...(FILTER_STATE[id] || {}), [f.name]: sel.value };
          loadView(id);
        };
        wrap.append(sel); grp.append(wrap);
      });
      bar.append(grp);
    }
    if (view.create) {
      const add = el("button", "btn small", (view.create.icon || "＋") + " " + view.create.label);
      add.onclick = () => runCreate(view);
      bar.append(add);
    }
    host.append(bar);
  }

  const holder = el("div"); host.append(holder);
  holder.append(el("div", "loading", "Chargement…"));
  try {
    const data = await api(withFilters(view.ep, FILTER_STATE[id]));
    holder.innerHTML = ""; holder.append(smartRender(data, view));
  } catch (e) {
    holder.innerHTML = ""; holder.append(el("div", "err-inline", e.message));
  }
}
function withFilters(ep, state) {
  const qs = Object.entries(state || {}).filter(([, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
  if (!qs.length) return ep;
  return ep + (ep.includes("?") ? "&" : "?") + qs.join("&");
}

/* ---------------- Session ---------------- */
/* Le jeton a une durée de vie limitée : on le renouvelle en tâche de fond plutôt que
   d'éjecter l'administrateur en pleine saisie. Un échec laisse le 401 faire son travail. */
let refreshTimer = null;
async function refreshSession() {
  if (!token) return;
  try {
    const d = await api("/api/auth/refresh", { method: "POST" });
    if (d && d.token) { token = d.token; localStorage.setItem(TOKEN_KEY, token); }
  } catch { /* jeton expiré : api() a déjà déconnecté */ }
}

/* ---------------- Boot ---------------- */
function showApp() {
  $("#login").hidden = true; $("#app").hidden = false;
  $("#who").textContent = localStorage.getItem(EMAIL_KEY) || "";
  buildNav(); loadView("dashboard");
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(refreshSession, 25 * 60 * 1000);
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
