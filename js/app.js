import { encryptData, decryptData } from "./crypto.js";
import { CONFIG } from "./config.js";

// ---------- Constantes ----------
const ROLES = {
  GT: "Gerente de Tienda",
  DT: "Director Técnico",
  SENIOR: "APV Senior",
  APB: "Asistente de Piso de Venta (APV)",
  DERMO: "Dermo",
  ASESORA: "Asesora",
  FARM: "Farmacéutico Auxiliar",
  OTRO: "Otro puesto",
  NA: "Sin puesto asignado",
};
const ROLE_ORDER = ["GT", "DT", "FARM", "SENIOR", "APB", "DERMO", "ASESORA", "OTRO", "NA"];

const SECTIONS = [
  { key: "capacitacion", label: "Capacitación", color: "#2563eb" },
  { key: "ausentismo", label: "Ausentismo y licencias", color: "#0891b2" },
  { key: "casos", label: "Casos críticos", color: "#dc2626" },
  { key: "sanciones", label: "Sanciones disciplinarias", color: "#b45309" },
  { key: "bajas", label: "Bajas", color: "#6b7280" },
  { key: "movimientos", label: "Movimientos internos", color: "#7c3aed" },
  { key: "reuniones", label: "Reuniones con colaboradores", color: "#059669" },
  { key: "horasExtras", label: "Horas extras de la semana", color: "#ea580c", detailHint: "Cantidad de horas y motivo" },
  { key: "ingresos", label: "Ingresos", color: "#0d9488", detailHint: "Puesto y fecha de ingreso" },
];

const LS = { pw: "a3_pw", token: "a3_token", draft: "a3_draft", store: "a3_store" };

// ---------- Estado ----------
const state = {
  password: null,
  data: null, // copia de trabajo
  publishedJSON: null, // versión publicada (string) para descartar cambios
  dirty: false,
  localOnly: false,
  token: localStorage.getItem(LS.token) || "",
  store: localStorage.getItem(LS.store) || null,
  minuteId: null,
  search: "",
};
const isEditor = () => !!state.token;

// ---------- Utilidades ----------
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const uid = (p) => p + Math.random().toString(36).slice(2, 9);
const parseDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const fmtLong = (iso) => {
  const s = parseDate(iso).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const fmtShort = (iso) => parseDate(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
const toISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function defaultFriday() {
  const d = new Date();
  const day = d.getDay(); // 0 dom … 5 vie … 6 sáb
  const diff = day <= 5 ? 5 - day : -1;
  d.setDate(d.getDate() + diff);
  return toISO(d);
}
const storeName = (id) => state.data.stores.find((s) => s.id === id)?.name || "";

let toastTimer;
function toast(msg, ms = 3500) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), ms);
}

// ---------- Carga / guardado ----------
const ghUrl = () => {
  const g = CONFIG.github;
  return `https://api.github.com/repos/${g.owner}/${g.repo}/contents/${g.path}`;
};
const ghHeaders = () => ({ Authorization: `Bearer ${state.token}`, Accept: "application/vnd.github+json" });

async function fetchRemote() {
  if (isEditor()) {
    const r = await fetch(`${ghUrl()}?ref=${CONFIG.github.branch}&t=${Date.now()}`, { headers: ghHeaders(), cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      return { payload: JSON.parse(atob(j.content.replace(/\n/g, ""))), sha: j.sha };
    }
    console.warn("No se pudo leer desde GitHub, uso la copia publicada", r.status);
  }
  const r = await fetch(`data/data.enc.json?t=${Date.now()}`, { cache: "no-store" });
  if (!r.ok) throw new Error("No se encontraron los datos del sitio.");
  return { payload: await r.json(), sha: null };
}

async function login(password) {
  const { payload } = await fetchRemote();
  let data;
  try {
    data = await decryptData(payload, password);
  } catch {
    throw new Error("Contraseña incorrecta.");
  }
  state.password = password;
  state.publishedJSON = JSON.stringify(data);
  state.data = data;

  // Borrador local (cambios guardados en este dispositivo)
  const raw = localStorage.getItem(LS.draft);
  if (raw) {
    try {
      const draft = await decryptData(JSON.parse(raw), password);
      if (draft.base === data.updatedAt) {
        state.data = draft.data;
        state.dirty = true;
        state.localOnly = true;
      } else {
        localStorage.removeItem(LS.draft);
        setTimeout(() => toast("Se publicó una versión más nueva; se descartaron cambios locales anteriores."), 500);
      }
    } catch {
      localStorage.removeItem(LS.draft);
    }
  }
}

function markDirty() {
  state.dirty = true;
  state.localOnly = false;
  renderDirty();
}

async function save() {
  const btn = $("#btn-save");
  btn.disabled = true;
  try {
    if (isEditor()) {
      await publish(state.data, state.password);
      toast("Publicado ✔ Puede tardar 1–2 minutos en verse para los demás.", 5000);
    } else {
      const base = JSON.parse(state.publishedJSON).updatedAt;
      const payload = await encryptData({ base, data: state.data }, state.password);
      localStorage.setItem(LS.draft, JSON.stringify(payload));
      state.localOnly = true;
      toast("Guardado en este dispositivo. Para que lo vean todos, debe publicarse desde el modo editor.", 5500);
    }
  } catch (e) {
    toast("Error al guardar: " + e.message, 6000);
  } finally {
    btn.disabled = false;
    renderDirty();
  }
}

async function publish(data, password) {
  const remote = await fetchRemote();
  if (!remote.sha) throw new Error("El token no tiene acceso al repositorio. Revisalo en Configuración.");
  try {
    const remoteData = await decryptData(remote.payload, state.password);
    const base = JSON.parse(state.publishedJSON).updatedAt;
    if (remoteData.updatedAt !== base &&
        !confirm("Hay una versión publicada más nueva que la que estás editando. ¿Querés sobrescribirla?")) {
      throw new Error("Publicación cancelada.");
    }
  } catch (e) {
    if (e.message === "Publicación cancelada.") throw e;
  }
  const next = { ...data, updatedAt: new Date().toISOString() };
  const payload = await encryptData(next, password);
  const body = {
    message: `Actualización del sitio ${new Date().toLocaleString("es-AR")}`,
    content: btoa(JSON.stringify(payload)),
    sha: remote.sha,
    branch: CONFIG.github.branch,
  };
  const r = await fetch(ghUrl(), { method: "PUT", headers: ghHeaders(), body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`GitHub respondió ${r.status}. Verificá el token.`);
  state.data = next;
  state.password = password;
  state.publishedJSON = JSON.stringify(next);
  state.dirty = false;
  state.localOnly = false;
  localStorage.removeItem(LS.draft);
  if (localStorage.getItem(LS.pw)) localStorage.setItem(LS.pw, password);
}

function discard() {
  if (!confirm("¿Descartar los cambios y volver a la versión publicada?")) return;
  state.data = JSON.parse(state.publishedJSON);
  state.dirty = false;
  state.localOnly = false;
  localStorage.removeItem(LS.draft);
  renderAll();
}

// ---------- Render general ----------
function renderDirty() {
  const bar = $("#dirty-bar");
  bar.hidden = !state.dirty;
  $("#dirty-text").textContent = state.localOnly
    ? "Cambios guardados solo en este dispositivo (no publicados)."
    : "Tenés cambios sin guardar.";
  $("#btn-save").textContent = isEditor() ? "Publicar cambios" : "Guardar cambios";
  $("#btn-save").hidden = state.localOnly && !isEditor();
}

function renderAll() {
  $("#editor-badge").hidden = !isEditor();
  $("#btn-new-minute").hidden = !isEditor();
  $("#pw-change").hidden = !isEditor();
  renderDirty();
  renderStores();
  renderChart();
  renderMinuteList();
  renderMinuteDetail();
}

// ---------- Organigrama ----------
function renderStores() {
  const { stores, people } = state.data;
  if (!stores.find((s) => s.id === state.store)) state.store = stores[0]?.id;
  const count = (id) => people.filter((p) => p.store === id).length;
  $("#store-pills").innerHTML = stores
    .map((s) => `<button class="pill ${s.id === state.store ? "active" : ""}" data-store="${esc(s.id)}">${esc(s.name)} <span>${count(s.id)}</span></button>`)
    .join("");
  $("#store-select").innerHTML = stores
    .map((s) => `<option value="${esc(s.id)}" ${s.id === state.store ? "selected" : ""}>${esc(s.name)} (${count(s.id)})</option>`)
    .join("");
}

function setStore(id) {
  state.store = id;
  localStorage.setItem(LS.store, id);
  renderStores();
  renderChart();
}

// Edad / antigüedad calculadas a la fecha de hoy
function yearsMonths(iso) {
  if (!iso) return null;
  const a = parseDate(iso), n = new Date();
  let m = (n.getFullYear() - a.getFullYear()) * 12 + (n.getMonth() - a.getMonth());
  if (n.getDate() < a.getDate()) m--;
  return m < 0 ? null : { y: Math.floor(m / 12), m: m % 12 };
}
const age = (p) => yearsMonths(p.nac)?.y ?? null;
function tenure(p) {
  const t = yearsMonths(p.ingreso);
  if (!t) return null;
  const y = t.y ? `${t.y} ${t.y === 1 ? "año" : "años"}` : "";
  const m = t.m ? `${t.m} ${t.m === 1 ? "mes" : "meses"}` : "";
  return [y, m].filter(Boolean).join(" ") || "menos de 1 mes";
}
const roleLabel = (p) => (p.role === "OTRO" && p.cargo) || ROLES[p.role];

const isFloatStore = (id) => String(id).startsWith("flotantes");
const LAB_SHORT = "Lab. Vassallo";

function card(p, guest = false) {
  const tags = [];
  if (guest === "float") tags.push(`<span class="tag tag-float">Flotante</span>`);
  else if (p.ubicacion) tags.push(`<span class="tag tag-work">Trabaja físicamente en ${esc(storeName(p.ubicacion))}</span>`);
  else if (p.trabajaEn) tags.push(`<span class="tag tag-work">Trabaja en ${esc(storeName(p.trabajaEn))}</span>`);
  if (p.empresa && p.store !== "laboratorios-vassallo" && !guest) tags.push(`<span class="tag tag-lab" title="${esc(p.empresa)}">${p.empresa === "Laboratorios Vassallo" ? LAB_SHORT : esc(p.empresa)}</span>`);
  const facts = [];
  if (p.ingreso) facts.push(`<span><i>Ingreso</i> ${esc(fmtShort(p.ingreso))}</span>`);
  if (tenure(p)) facts.push(`<span><i>Antig.</i> ${esc(tenure(p))}</span>`);
  if (age(p) !== null) facts.push(`<span><i>Edad</i> ${age(p)} años</span>`);
  return `<div class="card role-${p.role} ${p.vacante ? "is-vacant" : ""} ${guest ? "is-guest" : ""}" draggable="${!guest}" data-id="${esc(p.id)}" tabindex="0">
    <div class="card-role">${esc(roleLabel(p))}</div>
    <div class="card-name">${p.vacante ? "Vacante" : esc(p.name)}</div>
    ${tags.length ? `<div class="card-tags">${tags.join("")}</div>` : ""}
    ${facts.length ? `<div class="card-facts">${facts.join("")}</div>` : ""}
  </div>`;
}

function zone(role, people, extraClass = "") {
  const list = people.filter((p) => p.role === role).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const label = { SENIOR: "APV Senior", APB: "Asistentes de Piso de Venta (APV)", ASESORA: "Asesoras", FARM: "Farmacéuticos Auxiliares", OTRO: "Otros puestos" }[role] || ROLES[role];
  return `<div class="zone ${extraClass}" data-role="${role}">
    <div class="zone-label">${esc(label)} <span>${list.length || ""}</span></div>
    <div class="zone-cards">${list.length ? list.map((x) => card(x)).join("") : `<div class="empty">Vacante</div>`}</div>
  </div>`;
}

function renderChart() {
  const store = state.data.stores.find((s) => s.id === state.store);
  $("#store-title").textContent = store ? store.name : "";
  const people = state.data.people.filter((p) => p.store === state.store);
  const has = (r) => people.some((p) => p.role === r);
  const guests = state.data.people
    .filter((p) => p.trabajaEn === state.store && p.store !== state.store)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  $("#chart").innerHTML = `
    <div class="level level-top">
      ${zone("GT", people, "z-gt")}
      <div class="h-link" aria-hidden="true"></div>
      <div class="dt-col">
        ${zone("DT", people, "z-dt")}
        <div class="${has("FARM") ? "" : "hidden-na"}">${zone("FARM", people, "z-farm")}</div>
      </div>
    </div>
    <div class="v-link" aria-hidden="true"></div>
    <div class="level">${zone("SENIOR", people)}</div>
    <div class="v-link" aria-hidden="true"></div>
    <div class="level">${zone("APB", people)}</div>
    <div class="v-link" aria-hidden="true"></div>
    <div class="level level-split">${zone("DERMO", people)}${zone("ASESORA", people)}</div>
    <div class="level level-na ${has("OTRO") ? "" : "hidden-na"}">${zone("OTRO", people, "z-na")}</div>
    <div class="level level-na ${has("NA") ? "" : "hidden-na"}">${zone("NA", people, "z-na")}</div>
    ${guests.length ? `<div class="level level-na"><div class="guest-zone">
      <div class="zone-label">Flotantes trabajando en esta tienda <span>${guests.length}</span></div>
      <div class="zone-cards">${guests.map((g) => card(g, "float")).join("")}</div></div></div>` : ""}
    ${isEditor() ? `<div class="chart-actions"><button class="btn small" id="btn-add-person">+ Agregar persona a esta tienda</button></div>` : ""}
  `;
}

function movePerson(id, role, store) {
  const p = state.data.people.find((x) => x.id === id);
  if (!p) return;
  if ((role && p.role !== role) || (store && p.store !== store)) {
    if (role) p.role = role;
    if (store) p.store = store;
    markDirty();
    renderStores();
    renderChart();
  }
}

// Drag & drop
let dragId = null;
document.addEventListener("dragstart", (e) => {
  const c = e.target.closest?.(".card");
  if (!c) return;
  dragId = c.dataset.id;
  e.dataTransfer.setData("text/plain", dragId);
  e.dataTransfer.effectAllowed = "move";
  c.classList.add("dragging");
  $("#chart").classList.add("is-dragging");
});
document.addEventListener("dragend", () => {
  dragId = null;
  document.querySelectorAll(".dragging,.over").forEach((el) => el.classList.remove("dragging", "over"));
  $("#chart").classList.remove("is-dragging");
});
document.addEventListener("dragover", (e) => {
  const z = e.target.closest?.(".zone");
  if (!z || !dragId) return;
  e.preventDefault();
  document.querySelectorAll(".zone.over").forEach((el) => el !== z && el.classList.remove("over"));
  z.classList.add("over");
});
document.addEventListener("drop", (e) => {
  const z = e.target.closest?.(".zone");
  if (!z || !dragId) return;
  e.preventDefault();
  movePerson(dragId, z.dataset.role);
});

// Menú de tarjeta (clic / toque)
function openCardMenu(cardEl) {
  const p = state.data.people.find((x) => x.id === cardEl.dataset.id);
  const m = $("#card-menu");
  m.innerHTML = `
    <div class="pm-name">${p.vacante ? "Vacante" : esc(p.name)}</div>
    <div class="pm-sub">${esc(roleLabel(p))} · ${esc(storeName(p.store))}</div>
    <dl class="pm-facts">
      ${p.cargo ? `<dt>Cargo (nómina)</dt><dd>${esc(p.cargo)}</dd>` : ""}
      ${p.empresa ? `<dt>Empresa</dt><dd>${esc(p.empresa)}</dd>` : ""}
      ${p.ubicacion ? `<dt>Trabaja físicamente en</dt><dd>${esc(storeName(p.ubicacion))}</dd>` : ""}
      ${p.trabajaEn && !isFloatStore(p.trabajaEn) ? `<dt>Imputado/a en</dt><dd>${esc(storeName(p.store))}</dd><dt>Trabaja en</dt><dd>${esc(storeName(p.trabajaEn))}</dd>` : ""}
      ${p.legajo ? `<dt>Legajo</dt><dd>${esc(p.legajo)}</dd>` : ""}
      <dt>Fecha de ingreso</dt><dd>${p.ingreso ? esc(fmtShort(p.ingreso)) : "—"}</dd>
      <dt>Antigüedad</dt><dd>${esc(tenure(p) || "—")}</dd>
      <dt>Edad</dt><dd>${age(p) !== null ? age(p) + " años" : "—"}</dd>
    </dl>
    <div class="pm-label">Cambiar puesto</div>
    <div class="pm-roles">${ROLE_ORDER.filter((r) => r !== "NA" && (r !== "OTRO" || p.role === "OTRO"))
      .map((r) => `<button class="chip ${r === p.role ? "active" : ""}" data-role="${r}">${esc(ROLES[r])}</button>`)
      .join("")}</div>
    <div class="pm-label">Mover a otra tienda</div>
    <select class="pm-store">${state.data.stores
      .map((s) => `<option value="${esc(s.id)}" ${s.id === p.store ? "selected" : ""}>${esc(s.name)}</option>`)
      .join("")}</select>
    ${isFloatStore(p.store) || p.trabajaEn ? `<div class="pm-label">Tienda donde trabaja</div>
    <select class="pm-work"><option value="">— Sin asignar —</option>${state.data.stores
      .filter((s) => !isFloatStore(s.id))
      .map((s) => `<option value="${esc(s.id)}" ${s.id === p.trabajaEn ? "selected" : ""}>${esc(s.name)}</option>`)
      .join("")}</select>` : ""}
    ${p.store === "laboratorios-vassallo" || p.ubicacion ? `<div class="pm-label">Trabaja físicamente en</div>
    <select class="pm-imp"><option value="">— Ninguna —</option>${state.data.stores
      .filter((s) => !isFloatStore(s.id) && s.id !== p.store)
      .map((s) => `<option value="${esc(s.id)}" ${s.id === p.ubicacion ? "selected" : ""}>${esc(s.name)}</option>`)
      .join("")}</select>` : ""}
    <form class="pm-form" hidden>
      <label>Nombre y apellido<input name="name" value="${esc(p.name)}" required></label>
      <label>Fecha de ingreso<input name="ingreso" type="date" value="${esc(p.ingreso || "")}"></label>
      <label>Fecha de nacimiento<input name="nac" type="date" value="${esc(p.nac || "")}"></label>
      <label class="check"><input name="vacante" type="checkbox" ${p.vacante ? "checked" : ""}> Puesto vacante</label>
      <label class="check"><input name="lab" type="checkbox" ${p.empresa === "Laboratorios Vassallo" ? "checked" : ""}> Laboratorios Vassallo</label>
      <div class="row end"><button class="btn primary small" type="submit">Guardar</button></div>
    </form>
    ${isEditor() ? `<div class="pm-edit">
      <button class="btn small" data-act="edit">Editar datos</button>
      <button class="btn small danger" data-act="remove">Quitar del organigrama</button></div>` : ""}
  `;
  m.hidden = false;
  const r = cardEl.getBoundingClientRect();
  const w = Math.min(320, window.innerWidth - 16);
  m.style.width = w + "px";
  m.style.left = Math.max(8, Math.min(r.left + window.scrollX, window.scrollX + window.innerWidth - w - 8)) + "px";
  m.style.top = r.bottom + window.scrollY + 6 + "px";
  m.onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.role) movePerson(p.id, b.dataset.role);
    if (b.dataset.act === "edit") {
      $(".pm-form", m).hidden = false;
      $(".pm-edit", m).hidden = true;
      return;
    }
    if (b.type === "submit") return;
    if (b.dataset.act === "remove" && confirm(`¿Quitar a ${p.name} del organigrama?`)) {
      state.data.people = state.data.people.filter((x) => x.id !== p.id);
      markDirty(); renderStores(); renderChart();
    }
    m.hidden = true;
  };
  $(".pm-form", m).onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    p.name = f.get("name").trim() || p.name;
    for (const k of ["ingreso", "nac"]) f.get(k) ? (p[k] = f.get(k)) : delete p[k];
    f.get("vacante") ? (p.vacante = true) : delete p.vacante;
    if (f.get("lab")) p.empresa = "Laboratorios Vassallo";
    else if (p.empresa === "Laboratorios Vassallo") delete p.empresa;
    m.hidden = true;
    markDirty();
    renderChart();
  };
  const imp = $(".pm-imp", m);
  if (imp) imp.onchange = (e) => {
    e.target.value ? (p.ubicacion = e.target.value) : delete p.ubicacion;
    m.hidden = true;
    markDirty();
    renderChart();
  };
  const work = $(".pm-work", m);
  if (work) work.onchange = (e) => {
    e.target.value ? (p.trabajaEn = e.target.value) : delete p.trabajaEn;
    m.hidden = true;
    markDirty();
    renderChart();
  };
  $(".pm-store", m).onchange = (e) => {
    movePerson(p.id, null, e.target.value);
    m.hidden = true;
    toast(`${p.name} ahora está en ${storeName(e.target.value)}.`);
  };
}

// ---------- Minutas ----------
// Cada bloque se guarda como texto libre. También se leen minutas viejas (lista de ítems).
function sectionText(m, key) {
  const v = m.sections?.[key];
  if (!v) return "";
  if (typeof v === "string") return v;
  return v
    .map((i) => [[i.person, storeName(i.store)].filter(Boolean).join(" · "), i.detail].filter(Boolean).join(" — "))
    .join("\n");
}
const sectionLines = (m, key) => sectionText(m, key).split("\n").map((l) => l.trim()).filter(Boolean);
const sortedMinutes = () => [...state.data.minutes].sort((a, b) => b.date.localeCompare(a.date));
const itemCount = (m) => SECTIONS.reduce((n, s) => n + sectionLines(m, s.key).length, 0);
const minuteText = (m) => [m.summary, ...SECTIONS.map((s) => sectionText(m, s.key))].join(" ").toLowerCase();

function renderMinuteList() {
  const q = state.search.trim().toLowerCase();
  const list = sortedMinutes().filter((m) => !q || minuteText(m).includes(q) || fmtShort(m.date).includes(q));
  if (!state.minuteId && list[0]) state.minuteId = list[0].id;
  $("#minute-list").innerHTML = list.length
    ? list
        .map((m) => `<li><button class="${m.id === state.minuteId ? "active" : ""}" data-minute="${esc(m.id)}">
          <b>Viernes ${esc(fmtShort(m.date))}</b><span>${itemCount(m)} novedades</span></button></li>`)
        .join("")
    : `<li class="muted small">${q ? "Sin resultados." : "Todavía no hay minutas."}</li>`;
}

function renderMinuteDetail() {
  const el = $("#minute-detail");
  const m = state.data.minutes.find((x) => x.id === state.minuteId);
  if (!m) {
    el.innerHTML = `<div class="empty-state"><h3>Minuta semanal</h3><p class="muted">Acá vas a ver cada viernes el resumen de RRHH del área: capacitación, ausentismo, casos críticos, sanciones, bajas, movimientos, reuniones, horas extras e ingresos.</p>
      ${isEditor() ? `<button class="btn primary" data-act="new-minute">+ Cargar la primera minuta</button>` : ""}</div>`;
    return;
  }
  const blocks = SECTIONS.map((s) => {
    const lines = sectionLines(m, s.key);
    return `<article class="block ${lines.length ? "" : "is-empty"}" style="--c:${s.color}">
      <header><h4>${esc(s.label)}</h4><span class="count">${lines.length}</span></header>
      ${lines.length
        ? `<ul>${lines.map((l) => `<li><div class="what">${esc(l.replace(/^[-•*]\s*/, ""))}</div></li>`).join("")}</ul>`
        : `<p class="none">Sin novedades</p>`}
    </article>`;
  }).join("");
  el.innerHTML = `
    <div class="minute-head">
      <div>
        <div class="eyebrow">Minuta semanal de RRHH</div>
        <h2>${esc(fmtLong(m.date))}</h2>
      </div>
      ${isEditor() ? `<button class="btn small" data-act="edit-minute">Editar</button>` : ""}
    </div>
    ${m.summary ? `<p class="summary">${esc(m.summary)}</p>` : ""}
    <div class="kpis">${SECTIONS.map((s) => `<div class="kpi" style="--c:${s.color}"><b>${sectionLines(m, s.key).length}</b><span>${esc(s.label)}</span></div>`).join("")}</div>
    <div class="blocks">${blocks}</div>`;
}

// Editor de minuta: un cuadro de texto libre por bloque (cada renglón = una novedad)
function openMinuteEditor(m) {
  const dlg = $("#minute-editor");
  $("#minute-editor-title").textContent = m ? "Editar minuta" : "Nueva minuta";
  $("#m-date").value = m?.date || defaultFriday();
  $("#m-summary").value = m?.summary || "";
  $("#btn-minute-delete").hidden = !m;
  $("#m-sections").innerHTML = SECTIONS.map((s) => `
    <fieldset data-key="${s.key}" style="--c:${s.color}">
      <legend>${esc(s.label)}</legend>
      <textarea class="f-text" rows="3" placeholder="${esc(s.detailHint ? `Ej.: ${s.detailHint}. ` : "")}Escribí libremente; cada renglón es una novedad.">${esc(m ? sectionText(m, s.key) : "")}</textarea>
    </fieldset>`).join("");
  dlg.dataset.editing = m?.id || "";
  dlg.returnValue = "";
  dlg.showModal();
}

$("#minute-editor").addEventListener("close", () => {
  const dlg = $("#minute-editor");
  if (dlg.returnValue !== "ok") return;
  const sections = {};
  dlg.querySelectorAll("fieldset").forEach((fs) => {
    sections[fs.dataset.key] = $(".f-text", fs).value.trim();
  });
  const id = dlg.dataset.editing || uid("m");
  const minute = { id, date: $("#m-date").value, summary: $("#m-summary").value.trim(), sections, updatedAt: new Date().toISOString() };
  state.data.minutes = state.data.minutes.filter((x) => x.id !== id).concat(minute);
  state.minuteId = id;
  markDirty();
  renderMinuteList();
  renderMinuteDetail();
  toast("Minuta guardada. Tocá “Publicar cambios” para que la vea tu gerente.", 5000);
});

$("#btn-minute-delete").addEventListener("click", () => {
  const dlg = $("#minute-editor");
  if (!confirm("¿Eliminar esta minuta?")) return;
  state.data.minutes = state.data.minutes.filter((x) => x.id !== dlg.dataset.editing);
  state.minuteId = null;
  dlg.close("deleted");
  markDirty();
  renderMinuteList();
  renderMinuteDetail();
});

// ---------- Eventos generales ----------
document.addEventListener("click", (e) => {
  const t = e.target;
  const menu = $("#card-menu");
  const c = t.closest(".card");
  if (c && !menu.contains(t)) return openCardMenu(c);
  if (!menu.contains(t)) menu.hidden = true;

  const tab = t.closest(".tab");
  if (tab) {
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b === tab));
    $("#view-org").hidden = tab.dataset.view !== "org";
    $("#view-minutes").hidden = tab.dataset.view !== "minutes";
  }
  const pill = t.closest(".pill");
  if (pill) setStore(pill.dataset.store);
  const mb = t.closest("[data-minute]");
  if (mb) {
    state.minuteId = mb.dataset.minute;
    renderMinuteList();
    renderMinuteDetail();
    if (window.innerWidth < 800) $("#minute-detail").scrollIntoView({ behavior: "smooth" });
  }
  if (t.closest("[data-act=new-minute]") || t.closest("#btn-new-minute")) openMinuteEditor(null);
  if (t.closest("[data-act=edit-minute]")) openMinuteEditor(state.data.minutes.find((x) => x.id === state.minuteId));
  if (t.closest("#btn-add-person")) {
    const n = prompt("Nombre y apellido de la persona");
    if (n && n.trim()) {
      state.data.people.push({ id: uid("p"), name: n.trim(), store: state.store, role: "NA" });
      markDirty(); renderStores(); renderChart();
    }
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") $("#card-menu").hidden = true;
  if (e.key === "Enter" && e.target.classList?.contains("card")) openCardMenu(e.target);
});

$("#store-select").addEventListener("change", (e) => setStore(e.target.value));
$("#minute-search").addEventListener("input", (e) => {
  state.search = e.target.value;
  renderMinuteList();
});
$("#btn-save").addEventListener("click", save);
$("#btn-discard").addEventListener("click", discard);
$("#btn-logout").addEventListener("click", () => {
  if (state.dirty && !state.localOnly && !confirm("Tenés cambios sin guardar. ¿Salir igual?")) return;
  localStorage.removeItem(LS.pw);
  location.reload();
});
window.addEventListener("beforeunload", (e) => {
  if (state.dirty && !state.localOnly) e.preventDefault();
});

// Configuración
$("#btn-settings").addEventListener("click", () => {
  $("#gh-token").value = state.token;
  $("#settings-msg").textContent = "";
  $("#settings").showModal();
});
$("#btn-token-save").addEventListener("click", async () => {
  const tok = $("#gh-token").value.trim();
  const msg = $("#settings-msg");
  msg.textContent = "Verificando…";
  const r = await fetch(`${ghUrl()}?ref=${CONFIG.github.branch}`, { headers: { Authorization: `Bearer ${tok}` } }).catch(() => null);
  if (!r || !r.ok) {
    msg.textContent = "El token no pudo leer el repositorio. Revisá permisos (Contents: Read and write).";
    return;
  }
  state.token = tok;
  localStorage.setItem(LS.token, tok);
  msg.textContent = "Modo editor activado en este navegador.";
  renderAll();
});
$("#btn-token-clear").addEventListener("click", () => {
  state.token = "";
  localStorage.removeItem(LS.token);
  $("#gh-token").value = "";
  $("#settings-msg").textContent = "Token quitado. Modo lectura.";
  renderAll();
});
$("#btn-pw-change").addEventListener("click", async () => {
  const pw = $("#new-pw").value;
  const msg = $("#settings-msg");
  if (pw.length < 10) return (msg.textContent = "La contraseña debe tener al menos 10 caracteres.");
  if (!confirm("Se publicará todo (incluidos cambios pendientes) con la nueva contraseña. ¿Continuar?")) return;
  msg.textContent = "Publicando…";
  try {
    await publish(state.data, pw);
    $("#new-pw").value = "";
    msg.textContent = "Contraseña cambiada. Compartí la nueva con tu gerente.";
    renderDirty();
  } catch (e) {
    msg.textContent = "Error: " + e.message;
  }
});
$("#btn-backup").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `respaldo-area3-${toISO(new Date())}.json` });
  a.click();
  URL.revokeObjectURL(a.href);
});

// ---------- Inicio ----------
async function start(pw, remember) {
  await login(pw);
  if (remember) localStorage.setItem(LS.pw, pw);
  $("#login").hidden = true;
  $("#app").hidden = false;
  document.title = CONFIG.siteTitle;
  renderAll();
}

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("#login-error");
  const btn = $("#login-form button");
  err.hidden = true;
  btn.disabled = true;
  btn.textContent = "Ingresando…";
  try {
    await start($("#pw").value, $("#remember").checked);
  } catch (ex) {
    err.textContent = ex.message;
    err.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = "Ingresar";
  }
});

const saved = localStorage.getItem(LS.pw);
if (saved) start(saved, true).catch(() => localStorage.removeItem(LS.pw));
