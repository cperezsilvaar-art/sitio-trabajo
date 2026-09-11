/* ============================================================
   Gestión de Talento — aplicación interna
   Los datos viven cifrados en este navegador (localStorage).
   La clave nunca se almacena: solo deriva la llave de cifrado.
   ============================================================ */
'use strict';

/* ---------- Utilidades ---------- */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const hoy = () => new Date().toISOString().slice(0, 10);
const aFecha = (s) => (s ? new Date(s + 'T00:00:00') : null);

const fmtFecha = (s) => {
  const d = aFecha(s);
  return d && !isNaN(d) ? d.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
};

const diasDesde = (s) => {
  const d = aFecha(s);
  return d && !isNaN(d) ? (Date.now() - d) / 86400000 : Infinity;
};

const aniosDesde = (s) => diasDesde(s) / 365.25;

const num = (n, dec = 0) =>
  Number.isFinite(n) ? n.toLocaleString('es', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '—';

const promedio = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : NaN);

/* "1 ingreso" / "3 ingresos" */
const plural = (n, singular, plural) => `${num(n)} ${n === 1 ? singular : plural}`;

let tempToast;
function aviso(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(tempToast);
  tempToast = setTimeout(() => { t.hidden = true; }, 3200);
}

function descargar(nombre, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ---------- Cifrado ---------- */

const ITERACIONES = 250000;
const CLAVE_ALMACEN = 'gt_boveda_v1';
const textoABytes = new TextEncoder();
const bytesATexto = new TextDecoder();

function aBase64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  }
  return btoa(s);
}

const deBase64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derivarLlave(clave, sal, iteraciones = ITERACIONES) {
  const base = await crypto.subtle.importKey('raw', textoABytes.encode(clave), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: sal, iterations: iteraciones, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function cifrar(objeto, llave) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, llave, textoABytes.encode(JSON.stringify(objeto))
  );
  return { iv: aBase64(iv), ct: aBase64(ct) };
}

async function descifrar(paquete, llave) {
  const plano = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: deBase64(paquete.iv) }, llave, deBase64(paquete.ct)
  );
  return JSON.parse(bytesATexto.decode(plano));
}

const leerBoveda = () => {
  try { return JSON.parse(localStorage.getItem(CLAVE_ALMACEN)); } catch { return null; }
};

/* ---------- Estado en memoria ---------- */

let llave = null;   // CryptoKey, solo mientras la sesión está abierta
let sal = null;     // Uint8Array
let datos = null;
let vista = 'dashboard';
let busqueda = '';

const ETAPAS = ['Postulado', 'Entrevista RRHH', 'Entrevista con el área', 'Prueba técnica', 'Oferta enviada', 'Contratado', 'Descartado'];
const ETAPAS_ACTIVAS = ETAPAS.slice(0, 5);
const ESTADOS_VACANTE = ['Abierta', 'En proceso', 'En pausa', 'Cerrada'];
const TIPOS_CAPACITACION = ['Inducción', 'Técnica', 'Liderazgo', 'Cumplimiento', 'Seguridad', 'Otra'];

const datosVacios = () => ({
  version: 1,
  org: 'Recursos Humanos',
  colaboradores: [],
  vacantes: [],
  candidatos: [],
  evaluaciones: [],
  capacitaciones: [],
});

function normalizar(d) {
  const base = datosVacios();
  const out = { ...base, ...(d || {}) };
  for (const k of ['colaboradores', 'vacantes', 'candidatos', 'evaluaciones', 'capacitaciones']) {
    if (!Array.isArray(out[k])) out[k] = [];
  }
  return out;
}

async function guardar() {
  const paquete = await cifrar(datos, llave);
  localStorage.setItem(CLAVE_ALMACEN, JSON.stringify({
    v: 1, iter: ITERACIONES, salt: aBase64(sal), ...paquete,
  }));
}

async function guardarYRenderizar() {
  await guardar();
  renderizar();
}

/* ---------- Pantalla de bloqueo ---------- */

const MINUTOS_INACTIVIDAD = 15;
let tempInactividad;

function reiniciarInactividad() {
  clearTimeout(tempInactividad);
  if (!llave) return;
  tempInactividad = setTimeout(() => {
    bloquear();
    aviso(`Sesión bloqueada por ${MINUTOS_INACTIVIDAD} minutos de inactividad`);
  }, MINUTOS_INACTIVIDAD * 60000);
}

function bloquear() {
  llave = null;
  sal = null;
  datos = null;
  clearTimeout(tempInactividad);
  $('#app').hidden = true;
  $('#lock').hidden = false;
  $('#lock-form').reset();
  prepararBloqueo();
  $('#pw').focus();
}

function prepararBloqueo() {
  const primeraVez = !leerBoveda();
  $('#lock-title').textContent = primeraVez ? 'Crear clave de acceso' : 'Gestión de Talento';
  $('#lock-sub').textContent = primeraVez
    ? 'Define la clave que protegerá la información'
    : 'Aplicación interna · acceso restringido';
  $('#pw-label').textContent = primeraVez ? 'Nueva clave (mínimo 8 caracteres)' : 'Clave de acceso';
  $('#pw').autocomplete = primeraVez ? 'new-password' : 'current-password';
  $('#pw2-wrap').hidden = !primeraVez;
  $('#pw2').required = primeraVez;
  $('#lock-warning').hidden = !primeraVez;
  $('#lock-submit').textContent = primeraVez ? 'Crear y entrar' : 'Entrar';
  $('#lock-error').hidden = true;
}

function errorBloqueo(msg) {
  const e = $('#lock-error');
  e.textContent = msg;
  e.hidden = false;
}

async function entrar(ev) {
  ev.preventDefault();
  const boton = $('#lock-submit');
  const clave = $('#pw').value;
  const primeraVez = !leerBoveda();

  if (!window.crypto || !crypto.subtle) {
    errorBloqueo('Este navegador no permite cifrado en esta dirección. Abre la app por HTTPS (GitHub Pages) o en localhost.');
    return;
  }
  if (primeraVez && clave !== $('#pw2').value) {
    errorBloqueo('Las dos claves no coinciden.');
    return;
  }

  boton.disabled = true;
  boton.textContent = 'Descifrando…';
  $('#lock-error').hidden = true;

  try {
    if (primeraVez) {
      sal = crypto.getRandomValues(new Uint8Array(16));
      llave = await derivarLlave(clave, sal);
      datos = datosVacios();
      await guardar();
    } else {
      const boveda = leerBoveda();
      sal = deBase64(boveda.salt);
      llave = await derivarLlave(clave, sal, boveda.iter || ITERACIONES);
      datos = normalizar(await descifrar(boveda, llave));
    }
  } catch {
    llave = null; sal = null; datos = null;
    errorBloqueo('Clave incorrecta.');
    boton.disabled = false;
    boton.textContent = primeraVez ? 'Crear y entrar' : 'Entrar';
    $('#pw').select();
    return;
  }

  boton.disabled = false;
  $('#lock-form').reset();
  $('#lock').hidden = true;
  $('#app').hidden = false;
  vista = 'dashboard';
  renderizar();
  reiniciarInactividad();
  $('#view').focus();
}

/* ---------- Piezas de interfaz ---------- */

function vacioHTML(titulo, texto) {
  return `<div class="empty"><strong>${esc(titulo)}</strong>${esc(texto)}</div>`;
}

function tablaHTML(encabezados, filas, titulo, texto, conAcciones = true) {
  if (!filas) return vacioHTML(titulo, texto);
  const th = encabezados.map((h) => `<th${h.num ? ' class="num"' : ''}>${esc(h.t)}</th>`).join('');
  const thAcc = conAcciones ? '<th><span class="sr">Acciones</span></th>' : '';
  return `<div class="table-wrap"><table>
    <thead><tr>${th}${thAcc}</tr></thead>
    <tbody>${filas}</tbody></table></div>`;
}

function accionesHTML(tipo, id) {
  return `<td class="actions">
    <button class="btn btn-sm btn-ghost" data-edit="${tipo}:${id}" type="button">Editar</button>
    <button class="btn btn-sm btn-danger" data-del="${tipo}:${id}" type="button">Borrar</button>
  </td>`;
}

function chip(texto, clase) {
  return `<span class="chip${clase ? ' ' + clase : ''}">${esc(texto)}</span>`;
}

const chipEstado = (e) => chip(e || 'Activo', e === 'Inactivo' ? '' : 'chip-good');

const chipVacante = (e) => chip(e, { Abierta: 'chip-accent', 'En proceso': 'chip-warning', 'En pausa': 'chip-serious' }[e] || '');

const chipEtapa = (e) => chip(e, e === 'Contratado' ? 'chip-good' : e === 'Descartado' ? 'chip-critical' : 'chip-accent');

function chipPuntaje(p) {
  if (!Number.isFinite(p)) return chip('Sin datos');
  const clase = p >= 4.5 ? 'chip-good' : p >= 3.5 ? 'chip-accent' : p >= 2.5 ? 'chip-warning' : 'chip-critical';
  return chip(`${num(p, 1)} / 5`, clase);
}

/* Barras horizontales, una sola serie: el valor va etiquetado en cada fila,
   así la lectura no depende del color. */
function barrasHTML(items) {
  if (!items.length) return `<p class="card-sub" style="margin:0">Sin datos para mostrar.</p>`;
  const max = Math.max(...items.map((i) => i.valor), 1);
  return `<div class="bars">${items.map((i) => `
    <div class="bar-row">
      <div class="bar-name" title="${esc(i.nombre)}">${esc(i.nombre)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${((i.valor / max) * 100).toFixed(1)}%"></div></div>
      <div class="bar-value">${num(i.valor)}</div>
    </div>`).join('')}</div>`;
}

function kpi(etiqueta, valor, sufijo, pie) {
  return `<div class="kpi">
    <div class="kpi-label">${esc(etiqueta)}</div>
    <div class="kpi-value">${valor}${sufijo ? `<small> ${esc(sufijo)}</small>` : ''}</div>
    <div class="kpi-foot">${esc(pie || '')}</div>
  </div>`;
}

function cabecera(titulo, descripcion, herramientas) {
  return `<div class="view-head">
    <div><h1>${esc(titulo)}</h1><p>${esc(descripcion)}</p></div>
    <div class="view-tools">${herramientas || ''}</div>
  </div>`;
}

const botonBuscar = () =>
  `<input class="search" id="buscar" type="search" placeholder="Buscar…" value="${esc(busqueda)}" aria-label="Buscar">`;

const botonNuevo = (tipo, etiqueta) =>
  `<button class="btn btn-primary" data-nuevo="${tipo}" type="button">+ ${esc(etiqueta)}</button>`;

/* ---------- Consultas sobre los datos ---------- */

const activos = () => datos.colaboradores.filter((c) => c.estado !== 'Inactivo');
const nombreCol = (id) => datos.colaboradores.find((c) => c.id === id)?.nombre || '—';
const tituloVac = (id) => datos.vacantes.find((v) => v.id === id)?.titulo || 'Sin vacante';
const puntaje = (e) => promedio([e.objetivos, e.competencias].filter(Number.isFinite));
const coincide = (...campos) => !busqueda || campos.join(' ').toLowerCase().includes(busqueda.toLowerCase());

function porGrupo(items, clave) {
  const mapa = new Map();
  items.forEach((i) => {
    const k = (i[clave] || 'Sin asignar').trim() || 'Sin asignar';
    mapa.set(k, (mapa.get(k) || 0) + 1);
  });
  return [...mapa].map(([nombre, valor]) => ({ nombre, valor })).sort((a, b) => b.valor - a.valor);
}

/* ---------- Vista: Panel ---------- */

function vistaPanel() {
  const anio = new Date().getFullYear();
  const act = activos();
  const bajas12 = datos.colaboradores.filter((c) => c.estado === 'Inactivo' && diasDesde(c.fechaEgreso) <= 365);
  const rotacion = act.length + bajas12.length ? (bajas12.length / (act.length + bajas12.length)) * 100 : NaN;
  const altasAnio = datos.colaboradores.filter((c) => (c.fechaIngreso || '').startsWith(String(anio))).length;
  const vacAbiertas = datos.vacantes.filter((v) => v.estado !== 'Cerrada');
  const enProceso = datos.candidatos.filter((c) => ETAPAS_ACTIVAS.includes(c.etapa));
  const desempeno = promedio(datos.evaluaciones.map(puntaje).filter(Number.isFinite));
  const antiguedad = promedio(act.map((c) => aniosDesde(c.fechaIngreso)).filter(Number.isFinite));
  const capAnio = datos.capacitaciones.filter((c) => (c.fecha || '').startsWith(String(anio)));
  const horasPersona = capAnio.reduce((t, c) => t + (c.horas || 0) * (c.participantes?.length || 0), 0);

  const evaluadosAnio = new Set(
    datos.evaluaciones.filter((e) => (e.fecha || '').startsWith(String(anio))).map((e) => e.colaboradorId)
  );
  const pendientes = act.filter((c) => !evaluadosAnio.has(c.id));

  const embudo = ETAPAS_ACTIVAS.map((e) => ({
    nombre: e, valor: datos.candidatos.filter((c) => c.etapa === e).length,
  }));

  const filasPendientes = pendientes.slice(0, 10).map((c) => `<tr>
    <td>${esc(c.nombre)}</td><td>${esc(c.cargo || '—')}</td><td>${esc(c.area || '—')}</td>
    <td>${fmtFecha(c.fechaIngreso)}</td><td class="num">${num(aniosDesde(c.fechaIngreso), 1)}</td>
  </tr>`).join('');

  return cabecera('Panel de gestión de talento', `Indicadores al ${fmtFecha(hoy())}`) + `
    <div class="kpis">
      ${kpi('Colaboradores activos', num(act.length), '', `${plural(altasAnio, 'ingreso', 'ingresos')} en ${anio}`)}
      ${kpi('Vacantes abiertas', num(vacAbiertas.length), '', `${plural(enProceso.length, 'candidato', 'candidatos')} en proceso`)}
      ${kpi('Desempeño promedio', Number.isFinite(desempeno) ? num(desempeno, 1) : '—', '/ 5', `${plural(datos.evaluaciones.length, 'evaluación registrada', 'evaluaciones registradas')}`)}
      ${kpi('Rotación 12 meses', Number.isFinite(rotacion) ? num(rotacion, 1) : '—', '%', `${plural(bajas12.length, 'baja', 'bajas')} en el período`)}
      ${kpi('Antigüedad promedio', Number.isFinite(antiguedad) ? num(antiguedad, 1) : '—', 'años', 'Sobre la plantilla activa')}
      ${kpi('Capacitación', num(horasPersona, 0), 'h‑persona', `${plural(capAnio.length, 'actividad', 'actividades')} en ${anio}`)}
    </div>

    <div class="grid-2">
      <section class="card">
        <h2>Plantilla activa por área</h2>
        <p class="card-sub">Cantidad de colaboradores</p>
        ${barrasHTML(porGrupo(act, 'area'))}
      </section>
      <section class="card">
        <h2>Embudo de reclutamiento</h2>
        <p class="card-sub">Candidatos por etapa, sin contar contratados ni descartados</p>
        ${barrasHTML(embudo)}
      </section>
    </div>

    <section class="card">
      <h2>Pendientes de evaluación en ${anio}</h2>
      <p class="card-sub">${pendientes.length} de ${act.length} colaboradores activos aún no tienen evaluación cargada este año</p>
      ${tablaHTML(
        [{ t: 'Colaborador' }, { t: 'Cargo' }, { t: 'Área' }, { t: 'Ingreso' }, { t: 'Antigüedad', num: true }],
        filasPendientes,
        pendientes.length ? '' : 'Todo al día',
        act.length ? 'Todos los colaboradores activos tienen evaluación este año.' : 'Carga colaboradores para empezar.',
        false
      )}
    </section>`;
}

/* ---------- Vista: Colaboradores ---------- */

function vistaColaboradores() {
  const lista = datos.colaboradores
    .filter((c) => coincide(c.nombre, c.cargo, c.area, c.email, c.documento))
    .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));

  const filas = lista.map((c) => `<tr>
    <td>${esc(c.nombre)}</td>
    <td>${esc(c.cargo || '—')}</td>
    <td>${esc(c.area || '—')}</td>
    <td>${fmtFecha(c.fechaIngreso)}</td>
    <td class="num">${Number.isFinite(aniosDesde(c.fechaIngreso)) ? num(aniosDesde(c.fechaIngreso), 1) : '—'}</td>
    <td>${chipEstado(c.estado)}</td>
    ${accionesHTML('colaboradores', c.id)}
  </tr>`).join('');

  return cabecera('Colaboradores', `${activos().length} activos de ${datos.colaboradores.length} registrados`,
    botonBuscar() + botonNuevo('colaboradores', 'Colaborador')) +
    tablaHTML(
      [{ t: 'Nombre' }, { t: 'Cargo' }, { t: 'Área' }, { t: 'Ingreso' }, { t: 'Años', num: true }, { t: 'Estado' }],
      filas,
      busqueda ? 'Sin resultados' : 'Aún no hay colaboradores',
      busqueda ? 'Prueba con otro término de búsqueda.' : 'Usa el botón "+ Colaborador" para cargar el primero.'
    );
}

/* ---------- Vista: Reclutamiento ---------- */

function vistaReclutamiento() {
  const vacantes = datos.vacantes
    .filter((v) => coincide(v.titulo, v.area, v.estado))
    .sort((a, b) => (b.fechaApertura || '').localeCompare(a.fechaApertura || ''));

  const filasVac = vacantes.map((v) => {
    const cands = datos.candidatos.filter((c) => c.vacanteId === v.id);
    const dias = v.estado === 'Cerrada' ? null : diasDesde(v.fechaApertura);
    return `<tr>
      <td>${esc(v.titulo)}</td>
      <td>${esc(v.area || '—')}</td>
      <td class="num">${num(v.posiciones || 1)}</td>
      <td>${chipVacante(v.estado || 'Abierta')}</td>
      <td>${fmtFecha(v.fechaApertura)}</td>
      <td class="num">${dias != null && Number.isFinite(dias) ? num(dias) : '—'}</td>
      <td class="num">${cands.length}</td>
      ${accionesHTML('vacantes', v.id)}
    </tr>`;
  }).join('');

  const candidatos = datos.candidatos
    .filter((c) => coincide(c.nombre, c.email, c.etapa, tituloVac(c.vacanteId), c.fuente))
    .sort((a, b) => ETAPAS.indexOf(a.etapa) - ETAPAS.indexOf(b.etapa) || (a.nombre || '').localeCompare(b.nombre || '', 'es'));

  const filasCand = candidatos.map((c) => `<tr>
    <td>${esc(c.nombre)}</td>
    <td>${esc(tituloVac(c.vacanteId))}</td>
    <td>${chipEtapa(c.etapa || 'Postulado')}</td>
    <td>${esc(c.fuente || '—')}</td>
    <td>${fmtFecha(c.fecha)}</td>
    <td>${esc(c.email || c.telefono || '—')}</td>
    ${accionesHTML('candidatos', c.id)}
  </tr>`).join('');

  return cabecera('Reclutamiento y selección',
    `${plural(datos.vacantes.filter((v) => v.estado !== 'Cerrada').length, 'vacante abierta', 'vacantes abiertas')} · ${plural(datos.candidatos.length, 'candidato', 'candidatos')} en la base`,
    botonBuscar() + botonNuevo('vacantes', 'Vacante') + botonNuevo('candidatos', 'Candidato')) + `
    <section class="card">
      <h2>Vacantes</h2>
      <p class="card-sub">"Días" cuenta el tiempo abierto desde la fecha de apertura</p>
      ${tablaHTML(
        [{ t: 'Vacante' }, { t: 'Área' }, { t: 'Posiciones', num: true }, { t: 'Estado' }, { t: 'Apertura' }, { t: 'Días', num: true }, { t: 'Candidatos', num: true }],
        filasVac,
        busqueda ? 'Sin resultados' : 'Aún no hay vacantes',
        busqueda ? 'Prueba con otro término.' : 'Crea una vacante para empezar a cargar candidatos.'
      )}
    </section>
    <section class="card">
      <h2>Candidatos</h2>
      <p class="card-sub">Ordenados por etapa del proceso</p>
      ${tablaHTML(
        [{ t: 'Candidato' }, { t: 'Vacante' }, { t: 'Etapa' }, { t: 'Fuente' }, { t: 'Postulación' }, { t: 'Contacto' }],
        filasCand,
        busqueda ? 'Sin resultados' : 'Aún no hay candidatos',
        busqueda ? 'Prueba con otro término.' : 'Carga candidatos y hazlos avanzar por las etapas.'
      )}
    </section>`;
}

/* ---------- Vista: Desempeño ---------- */

function vistaDesempeno() {
  const lista = datos.evaluaciones
    .filter((e) => coincide(nombreCol(e.colaboradorId), e.periodo, e.potencial))
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

  const filas = lista.map((e) => `<tr>
    <td>${esc(nombreCol(e.colaboradorId))}</td>
    <td>${esc(e.periodo || '—')}</td>
    <td class="num">${num(e.objetivos, 1)}</td>
    <td class="num">${num(e.competencias, 1)}</td>
    <td>${chipPuntaje(puntaje(e))}</td>
    <td>${esc(e.potencial || '—')}</td>
    <td>${fmtFecha(e.fecha)}</td>
    ${accionesHTML('evaluaciones', e.id)}
  </tr>`).join('');

  const porArea = porGrupo(activos(), 'area').map((a) => {
    const ids = activos().filter((c) => (c.area || 'Sin asignar') === a.nombre).map((c) => c.id);
    const p = promedio(datos.evaluaciones.filter((e) => ids.includes(e.colaboradorId)).map(puntaje).filter(Number.isFinite));
    return { nombre: a.nombre, valor: Number.isFinite(p) ? Number(p.toFixed(1)) : 0 };
  }).filter((a) => a.valor > 0);

  return cabecera('Gestión del desempeño', `${plural(datos.evaluaciones.length, 'evaluación registrada', 'evaluaciones registradas')}`,
    botonBuscar() + botonNuevo('evaluaciones', 'Evaluación')) + `
    ${porArea.length ? `<section class="card">
      <h2>Puntaje promedio por área</h2>
      <p class="card-sub">Escala de 1 a 5, promedio de objetivos y competencias</p>
      ${barrasHTML(porArea)}
    </section>` : ''}
    ${tablaHTML(
      [{ t: 'Colaborador' }, { t: 'Período' }, { t: 'Objetivos', num: true }, { t: 'Competencias', num: true }, { t: 'Puntaje' }, { t: 'Potencial' }, { t: 'Fecha' }],
      filas,
      busqueda ? 'Sin resultados' : 'Aún no hay evaluaciones',
      busqueda ? 'Prueba con otro término.' : 'Registra la primera evaluación de desempeño.'
    )}`;
}

/* ---------- Vista: Capacitación ---------- */

function vistaCapacitacion() {
  const lista = datos.capacitaciones
    .filter((c) => coincide(c.nombre, c.tipo, c.proveedor, c.modalidad))
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

  const filas = lista.map((c) => `<tr>
    <td class="wrap">${esc(c.nombre)}</td>
    <td>${esc(c.tipo || '—')}</td>
    <td>${esc(c.modalidad || '—')}</td>
    <td>${fmtFecha(c.fecha)}</td>
    <td class="num">${num(c.horas, 1)}</td>
    <td class="num">${(c.participantes || []).length}</td>
    <td class="num">${num((c.horas || 0) * (c.participantes || []).length, 1)}</td>
    ${accionesHTML('capacitaciones', c.id)}
  </tr>`).join('');

  const total = datos.capacitaciones.reduce((t, c) => t + (c.horas || 0) * (c.participantes?.length || 0), 0);
  const porTipo = porGrupo(datos.capacitaciones, 'tipo');

  return cabecera('Capacitación y desarrollo', `${num(total, 0)} horas‑persona acumuladas`,
    botonBuscar() + botonNuevo('capacitaciones', 'Actividad')) + `
    ${porTipo.length ? `<section class="card">
      <h2>Actividades por tipo</h2>
      <p class="card-sub">Cantidad de actividades registradas</p>
      ${barrasHTML(porTipo)}
    </section>` : ''}
    ${tablaHTML(
      [{ t: 'Actividad' }, { t: 'Tipo' }, { t: 'Modalidad' }, { t: 'Fecha' }, { t: 'Horas', num: true }, { t: 'Participantes', num: true }, { t: 'H‑persona', num: true }],
      filas,
      busqueda ? 'Sin resultados' : 'Aún no hay capacitaciones',
      busqueda ? 'Prueba con otro término.' : 'Registra la primera actividad de formación.'
    )}`;
}

/* ---------- Vista: Datos y ajustes ---------- */

function vistaDatos() {
  const boveda = leerBoveda();
  const peso = boveda ? (JSON.stringify(boveda).length / 1024).toFixed(1) : '0';
  const conteos = [
    ['Colaboradores', datos.colaboradores.length],
    ['Vacantes', datos.vacantes.length],
    ['Candidatos', datos.candidatos.length],
    ['Evaluaciones', datos.evaluaciones.length],
    ['Capacitaciones', datos.capacitaciones.length],
  ];

  return cabecera('Datos y ajustes', 'Respaldos, seguridad y mantenimiento de la información') + `
    <section class="card">
      <h2>Organización</h2>
      <p class="card-sub">Nombre que aparece en el encabezado</p>
      <label class="field" for="org-input" style="max-width:360px">
        <span>Nombre de la organización o área</span>
        <input type="text" id="org-input" value="${esc(datos.org || '')}" maxlength="60">
      </label>
    </section>

    <section class="card">
      <h2>Respaldos</h2>
      <p class="card-sub">El respaldo se descarga cifrado: es seguro guardarlo en la nube o enviarlo por correo. Solo se abre con la clave con la que fue creado.</p>
      <div class="view-tools">
        <button class="btn btn-primary" data-action="respaldar" type="button">Descargar respaldo cifrado</button>
        <button class="btn" data-action="restaurar" type="button">Restaurar desde respaldo</button>
        <button class="btn" data-action="csv" type="button">Exportar colaboradores a CSV</button>
      </div>
      <p class="field-hint" style="margin-top:12px">El CSV <strong>no está cifrado</strong>: contiene datos personales legibles. Descárgalo solo cuando lo necesites y bórralo después.</p>
    </section>

    <section class="card">
      <h2>Seguridad</h2>
      <p class="card-sub">Cifrado AES‑256‑GCM · llave derivada con PBKDF2‑SHA256 (${num(ITERACIONES)} iteraciones) · bloqueo automático a los ${MINUTOS_INACTIVIDAD} minutos de inactividad</p>
      <div class="view-tools">
        <button class="btn" data-action="cambiar-clave" type="button">Cambiar la clave de acceso</button>
        <button class="btn btn-lock" data-action="bloquear" type="button">Bloquear ahora</button>
      </div>
    </section>

    <section class="card">
      <h2>Contenido almacenado</h2>
      <p class="card-sub">${peso} KB cifrados en este navegador</p>
      ${tablaHTML(
        [{ t: 'Módulo' }, { t: 'Registros', num: true }],
        conteos.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${num(v)}</td></tr>`).join(''),
        '', '', false
      )}
      <div class="view-tools" style="margin-top:16px">
        <button class="btn" data-action="ejemplo" type="button">Cargar datos de ejemplo</button>
        <button class="btn btn-danger" data-action="borrar-todo" type="button">Borrar todo</button>
      </div>
    </section>`;
}

/* ---------- Enrutador ---------- */

const VISTAS = {
  dashboard: vistaPanel,
  colaboradores: vistaColaboradores,
  reclutamiento: vistaReclutamiento,
  desempeno: vistaDesempeno,
  capacitacion: vistaCapacitacion,
  datos: vistaDatos,
};

function renderizar() {
  if (!datos) return;
  $('#org-name').textContent = datos.org || 'Recursos Humanos';
  $$('.nav-item').forEach((b) => b.classList.toggle('is-active', b.dataset.view === vista));
  const caja = $('#view');
  const aBuscar = document.activeElement?.id === 'buscar';
  caja.innerHTML = (VISTAS[vista] || vistaPanel)();
  if (aBuscar) {
    const s = $('#buscar');
    if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
  }
}

function irA(nombre) {
  vista = nombre;
  busqueda = '';
  renderizar();
  window.scrollTo({ top: 0 });
}

/* ---------- Formularios ---------- */

function campoHTML(c, v) {
  const id = 'f_' + c.n;
  const ancho = c.ancho === 2 ? ' span-2' : '';
  const req = c.req ? ' required' : '';
  const val = v ?? c.defecto ?? '';
  const ayuda = c.ayuda ? `<span class="field-hint">${esc(c.ayuda)}</span>` : '';

  if (c.t === 'checklist') {
    const marcados = Array.isArray(v) ? v.map(String) : [];
    const items = c.opciones.length
      ? c.opciones.map((o) => `<label><input type="checkbox" name="${c.n}" value="${esc(o.v)}"${marcados.includes(String(o.v)) ? ' checked' : ''}>${esc(o.t)}</label>`).join('')
      : '<span class="field-hint">Primero carga colaboradores en el módulo correspondiente.</span>';
    return `<div class="field${ancho}"><span>${esc(c.et)}</span><div class="checklist">${items}</div>${ayuda}</div>`;
  }

  let control;
  if (c.t === 'select') {
    control = `<select id="${id}" name="${c.n}"${req}>` + c.opciones.map((o) => {
      const ov = typeof o === 'string' ? o : o.v;
      const ot = typeof o === 'string' ? o : o.t;
      return `<option value="${esc(ov)}"${String(ov) === String(val) ? ' selected' : ''}>${esc(ot)}</option>`;
    }).join('') + `</select>`;
  } else if (c.t === 'textarea') {
    control = `<textarea id="${id}" name="${c.n}"${req}>${esc(val)}</textarea>`;
  } else {
    const extra =
      (c.min != null ? ` min="${c.min}"` : '') +
      (c.max != null ? ` max="${c.max}"` : '') +
      (c.paso != null ? ` step="${c.paso}"` : '') +
      (c.minlong ? ` minlength="${c.minlong}"` : '') +
      (c.lista ? ` list="l_${c.n}"` : '') +
      (c.t === 'password' ? ' autocomplete="off" spellcheck="false"' : '');
    control = `<input type="${c.t}" id="${id}" name="${c.n}" value="${esc(val)}"${req}${extra}>` +
      (c.lista ? `<datalist id="l_${c.n}">${c.lista.map((o) => `<option value="${esc(o)}"></option>`).join('')}</datalist>` : '');
  }
  return `<label class="field${ancho}" for="${id}"><span>${esc(c.et)}</span>${control}${ayuda}</label>`;
}

function abrirForm({ titulo, campos, valores = {}, onGuardar, etiqueta }) {
  const dlg = $('#dlg');
  const form = $('#dlg-form');
  $('#dlg-title').textContent = titulo;
  $('#dlg-fields').innerHTML = campos.map((c) => campoHTML(c, valores[c.n])).join('');
  form.querySelector('button[value="save"]').textContent = etiqueta || 'Guardar';
  dlg.returnValue = '';

  dlg.onclose = async () => {
    dlg.onclose = null;
    if (dlg.returnValue !== 'save') return;
    const fd = new FormData(form);
    const v = {};
    for (const c of campos) {
      if (c.t === 'checklist') v[c.n] = fd.getAll(c.n);
      else if (c.t === 'number') {
        const n = fd.get(c.n);
        v[c.n] = n === '' || n == null ? null : Number(n);
      } else v[c.n] = String(fd.get(c.n) ?? '').trim();
    }
    try { await onGuardar(v); } catch (e) { aviso('No se pudo guardar: ' + e.message); }
  };

  dlg.showModal();
  form.querySelector('input, select, textarea')?.focus();
}

/* ---------- Definición de los módulos ---------- */

const areasConocidas = () => [...new Set(
  datos.colaboradores.map((c) => c.area).concat(datos.vacantes.map((v) => v.area)).filter(Boolean)
)].sort((a, b) => a.localeCompare(b, 'es'));

const opcionesColaboradores = () => datos.colaboradores
  .slice()
  .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'))
  .map((c) => ({ v: c.id, t: c.nombre + (c.estado === 'Inactivo' ? ' (inactivo)' : '') }));

const ENTIDADES = {
  colaboradores: {
    singular: 'colaborador',
    predeterminados: () => ({ fechaIngreso: hoy(), estado: 'Activo' }),
    campos: () => [
      { n: 'nombre', t: 'text', et: 'Nombre y apellido', req: true, ancho: 2 },
      { n: 'documento', t: 'text', et: 'Documento o legajo' },
      { n: 'cargo', t: 'text', et: 'Cargo', req: true },
      { n: 'area', t: 'text', et: 'Área', req: true, lista: areasConocidas() },
      { n: 'jefe', t: 'text', et: 'Reporta a' },
      { n: 'email', t: 'email', et: 'Correo' },
      { n: 'telefono', t: 'tel', et: 'Teléfono' },
      { n: 'fechaIngreso', t: 'date', et: 'Fecha de ingreso', req: true },
      { n: 'estado', t: 'select', et: 'Estado', opciones: ['Activo', 'Inactivo'] },
      { n: 'fechaEgreso', t: 'date', et: 'Fecha de egreso', ayuda: 'Solo si el estado es Inactivo' },
      { n: 'notas', t: 'textarea', et: 'Notas', ancho: 2 },
    ],
  },
  vacantes: {
    singular: 'vacante',
    predeterminados: () => ({ fechaApertura: hoy(), estado: 'Abierta', posiciones: 1 }),
    campos: () => [
      { n: 'titulo', t: 'text', et: 'Título de la vacante', req: true, ancho: 2 },
      { n: 'area', t: 'text', et: 'Área', req: true, lista: areasConocidas() },
      { n: 'estado', t: 'select', et: 'Estado', opciones: ESTADOS_VACANTE },
      { n: 'posiciones', t: 'number', et: 'Posiciones a cubrir', min: 1, paso: 1 },
      { n: 'solicitante', t: 'text', et: 'Solicitante' },
      { n: 'fechaApertura', t: 'date', et: 'Fecha de apertura', req: true },
      { n: 'fechaCierre', t: 'date', et: 'Fecha de cierre' },
      { n: 'notas', t: 'textarea', et: 'Perfil buscado y notas', ancho: 2 },
    ],
  },
  candidatos: {
    singular: 'candidato',
    predeterminados: () => ({ fecha: hoy(), etapa: 'Postulado' }),
    campos: () => [
      { n: 'nombre', t: 'text', et: 'Nombre y apellido', req: true, ancho: 2 },
      {
        n: 'vacanteId', t: 'select', et: 'Vacante',
        opciones: [{ v: '', t: '— sin asignar —' }].concat(datos.vacantes.map((v) => ({ v: v.id, t: v.titulo }))),
      },
      { n: 'etapa', t: 'select', et: 'Etapa del proceso', opciones: ETAPAS },
      { n: 'email', t: 'email', et: 'Correo' },
      { n: 'telefono', t: 'tel', et: 'Teléfono' },
      { n: 'fuente', t: 'text', et: 'Fuente', ayuda: 'LinkedIn, referido, portal…' },
      { n: 'fecha', t: 'date', et: 'Fecha de postulación' },
      { n: 'notas', t: 'textarea', et: 'Notas de entrevista', ancho: 2 },
    ],
  },
  evaluaciones: {
    singular: 'evaluación',
    predeterminados: () => ({ fecha: hoy(), periodo: String(new Date().getFullYear()), potencial: 'Medio' }),
    campos: () => [
      { n: 'colaboradorId', t: 'select', et: 'Colaborador', req: true, ancho: 2, opciones: opcionesColaboradores() },
      { n: 'periodo', t: 'text', et: 'Período', req: true, ayuda: 'Por ejemplo 2026 o 2026-S1' },
      { n: 'fecha', t: 'date', et: 'Fecha de la evaluación', req: true },
      { n: 'objetivos', t: 'number', et: 'Cumplimiento de objetivos', req: true, min: 1, max: 5, paso: 0.5, ayuda: 'Escala de 1 a 5' },
      { n: 'competencias', t: 'number', et: 'Competencias', req: true, min: 1, max: 5, paso: 0.5, ayuda: 'Escala de 1 a 5' },
      { n: 'potencial', t: 'select', et: 'Potencial', opciones: ['Bajo', 'Medio', 'Alto'] },
      { n: 'fortalezas', t: 'textarea', et: 'Fortalezas', ancho: 2 },
      { n: 'planAccion', t: 'textarea', et: 'Plan de acción y desarrollo', ancho: 2 },
    ],
  },
  capacitaciones: {
    singular: 'actividad de capacitación',
    predeterminados: () => ({ fecha: hoy(), modalidad: 'Presencial', tipo: 'Técnica', horas: 2 }),
    campos: () => [
      { n: 'nombre', t: 'text', et: 'Nombre de la actividad', req: true, ancho: 2 },
      { n: 'tipo', t: 'select', et: 'Tipo', opciones: TIPOS_CAPACITACION },
      { n: 'modalidad', t: 'select', et: 'Modalidad', opciones: ['Presencial', 'Virtual', 'Mixta'] },
      { n: 'fecha', t: 'date', et: 'Fecha', req: true },
      { n: 'horas', t: 'number', et: 'Duración en horas', req: true, min: 0, paso: 0.5 },
      { n: 'proveedor', t: 'text', et: 'Proveedor o facilitador', ancho: 2 },
      { n: 'participantes', t: 'checklist', et: 'Participantes', ancho: 2, opciones: opcionesColaboradores() },
      { n: 'notas', t: 'textarea', et: 'Notas', ancho: 2 },
    ],
  },
};

function abrirRegistro(tipo, id) {
  const e = ENTIDADES[tipo];
  if (!e) return;
  const actual = id ? datos[tipo].find((x) => x.id === id) : null;
  abrirForm({
    titulo: (actual ? 'Editar ' : 'Nuevo ') + e.singular,
    campos: e.campos(),
    valores: actual || e.predeterminados(),
    onGuardar: async (v) => {
      if (actual) Object.assign(actual, v);
      else datos[tipo].push({ id: uid(), ...v });
      await guardarYRenderizar();
      aviso(actual ? 'Cambios guardados' : 'Registro creado');
    },
  });
}

async function eliminarRegistro(tipo, id) {
  const item = datos[tipo]?.find((x) => x.id === id);
  if (!item) return;
  const nombre = item.nombre || item.titulo || 'este registro';
  if (!confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return;

  datos[tipo] = datos[tipo].filter((x) => x.id !== id);
  if (tipo === 'colaboradores') {
    datos.evaluaciones = datos.evaluaciones.filter((e) => e.colaboradorId !== id);
    datos.capacitaciones.forEach((c) => { c.participantes = (c.participantes || []).filter((p) => p !== id); });
  }
  if (tipo === 'vacantes') {
    datos.candidatos.forEach((c) => { if (c.vacanteId === id) c.vacanteId = ''; });
  }
  await guardarYRenderizar();
  aviso('Registro eliminado');
}

/* ---------- Respaldos y mantenimiento ---------- */

function respaldar() {
  const boveda = leerBoveda();
  if (!boveda) { aviso('Todavía no hay nada para respaldar'); return; }
  descargar(`respaldo-gestion-talento-${hoy()}.json`, JSON.stringify(boveda), 'application/json');
  aviso('Respaldo cifrado descargado');
}

function restaurar() {
  const input = $('#file-input');
  input.value = '';
  input.onchange = async () => {
    const archivo = input.files?.[0];
    if (!archivo) return;
    let boveda;
    try {
      boveda = JSON.parse(await archivo.text());
      if (!boveda?.salt || !boveda?.iv || !boveda?.ct) throw new Error('formato');
    } catch {
      aviso('El archivo no es un respaldo válido');
      return;
    }
    abrirForm({
      titulo: 'Restaurar respaldo',
      etiqueta: 'Restaurar',
      campos: [{
        n: 'clave', t: 'password', et: 'Clave con la que se creó el respaldo', req: true, ancho: 2,
        ayuda: 'Reemplaza toda la información actual de este navegador.',
      }],
      onGuardar: async ({ clave }) => {
        let contenido;
        try {
          const llaveArchivo = await derivarLlave(clave, deBase64(boveda.salt), boveda.iter || ITERACIONES);
          contenido = await descifrar(boveda, llaveArchivo);
        } catch {
          aviso('Clave incorrecta: el respaldo no se pudo abrir');
          return;
        }
        datos = normalizar(contenido);
        await guardarYRenderizar();   // se vuelve a cifrar con tu clave actual
        aviso('Respaldo restaurado');
      },
    });
  };
  input.click();
}

function exportarCSV() {
  const cols = ['nombre', 'documento', 'cargo', 'area', 'jefe', 'email', 'telefono', 'fechaIngreso', 'estado', 'fechaEgreso', 'notas'];
  const titulos = ['Nombre', 'Documento', 'Cargo', 'Área', 'Reporta a', 'Correo', 'Teléfono', 'Ingreso', 'Estado', 'Egreso', 'Notas'];
  const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const filas = datos.colaboradores.map((c) => cols.map((k) => celda(c[k])).join(';'));
  const csv = '\uFEFF' + [titulos.map(celda).join(';'), ...filas].join('\r\n');
  descargar(`colaboradores-${hoy()}.csv`, csv, 'text/csv;charset=utf-8');
  aviso('CSV descargado — recuerda que no está cifrado');
}

function cambiarClave() {
  abrirForm({
    titulo: 'Cambiar la clave de acceso',
    etiqueta: 'Cambiar clave',
    campos: [
      { n: 'actual', t: 'password', et: 'Clave actual', req: true, ancho: 2 },
      { n: 'nueva', t: 'password', et: 'Clave nueva', req: true, minlong: 8, ancho: 2, ayuda: 'Mínimo 8 caracteres. Si la olvidas, los datos no se pueden recuperar.' },
      { n: 'repetir', t: 'password', et: 'Repetir la clave nueva', req: true, ancho: 2 },
    ],
    onGuardar: async ({ actual, nueva, repetir }) => {
      if (nueva.length < 8) { aviso('La clave nueva debe tener al menos 8 caracteres'); return; }
      if (nueva !== repetir) { aviso('Las claves nuevas no coinciden'); return; }
      const boveda = leerBoveda();
      try {
        const llaveActual = await derivarLlave(actual, deBase64(boveda.salt), boveda.iter || ITERACIONES);
        await descifrar(boveda, llaveActual);
      } catch {
        aviso('La clave actual no es correcta');
        return;
      }
      sal = crypto.getRandomValues(new Uint8Array(16));
      llave = await derivarLlave(nueva, sal);
      await guardar();
      aviso('Clave actualizada. Úsala en el próximo ingreso.');
    },
  });
}

async function borrarTodo() {
  if (!confirm('Se borrará TODA la información de este navegador, incluida la clave. Solo podrás recuperarla desde un respaldo. ¿Continuar?')) return;
  if ((prompt('Para confirmar, escribe BORRAR en mayúsculas:') || '').trim() !== 'BORRAR') {
    aviso('Operación cancelada');
    return;
  }
  localStorage.removeItem(CLAVE_ALMACEN);
  llave = null; sal = null; datos = null;
  location.reload();
}

function fechaRel(dias) {
  return new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);
}

async function cargarEjemplo() {
  if (datos.colaboradores.length || datos.vacantes.length) {
    if (!confirm('Se agregarán registros de ejemplo a los datos actuales. ¿Continuar?')) return;
  }
  const plantilla = [
    ['Ana Rivas', 'Analista de Nómina', 'Recursos Humanos', -1500],
    ['Bruno Carrasco', 'Jefe de Tienda', 'Operaciones', -2400],
    ['Carla Medina', 'Vendedora', 'Operaciones', -700],
    ['Diego Salas', 'Químico Farmacéutico', 'Farmacia', -1100],
    ['Elena Ortiz', 'Analista de Selección', 'Recursos Humanos', -320],
    ['Fabián Núñez', 'Auxiliar de Depósito', 'Logística', -180],
    ['Gabriela Ruiz', 'Contadora', 'Administración', -3000],
    ['Hugo Peralta', 'Supervisor de Turno', 'Operaciones', -900],
  ];
  const nuevos = plantilla.map(([nombre, cargo, area, dias]) => ({
    id: uid(), nombre, cargo, area,
    email: nombre.toLowerCase().replace(/ /g, '.').normalize('NFD').replace(/[\u0300-\u036f]/g, '') + '@empresa.com',
    fechaIngreso: fechaRel(dias), estado: 'Activo', notas: '',
  }));
  nuevos.push({
    id: uid(), nombre: 'Irene Bustos', cargo: 'Cajera', area: 'Operaciones',
    fechaIngreso: fechaRel(-800), estado: 'Inactivo', fechaEgreso: fechaRel(-90),
    notas: 'Renuncia voluntaria.',
  });
  datos.colaboradores.push(...nuevos);

  const vac1 = { id: uid(), titulo: 'Analista de Compensaciones', area: 'Recursos Humanos', estado: 'En proceso', posiciones: 1, solicitante: 'Dirección de RRHH', fechaApertura: fechaRel(-25), notas: '' };
  const vac2 = { id: uid(), titulo: 'Vendedor de Tienda', area: 'Operaciones', estado: 'Abierta', posiciones: 3, solicitante: 'Jefatura de Tienda', fechaApertura: fechaRel(-8), notas: '' };
  datos.vacantes.push(vac1, vac2);

  datos.candidatos.push(
    { id: uid(), nombre: 'Jorge Aliaga', vacanteId: vac1.id, etapa: 'Entrevista con el área', email: 'jorge.aliaga@correo.com', fuente: 'LinkedIn', fecha: fechaRel(-20), notas: '' },
    { id: uid(), nombre: 'Karen Soto', vacanteId: vac1.id, etapa: 'Oferta enviada', email: 'karen.soto@correo.com', fuente: 'Referido', fecha: fechaRel(-18), notas: '' },
    { id: uid(), nombre: 'Luis Prado', vacanteId: vac2.id, etapa: 'Postulado', email: 'luis.prado@correo.com', fuente: 'Portal de empleo', fecha: fechaRel(-5), notas: '' },
    { id: uid(), nombre: 'Marta Vega', vacanteId: vac2.id, etapa: 'Entrevista RRHH', email: 'marta.vega@correo.com', fuente: 'Portal de empleo', fecha: fechaRel(-4), notas: '' },
    { id: uid(), nombre: 'Néstor Fuentes', vacanteId: vac2.id, etapa: 'Descartado', email: 'nestor.fuentes@correo.com', fuente: 'Referido', fecha: fechaRel(-6), notas: 'No cumple disponibilidad horaria.' },
  );

  const anio = new Date().getFullYear();
  [[0, 4.5, 4], [1, 3.5, 3.5], [3, 5, 4.5], [6, 4, 4.5]].forEach(([i, o, c]) => {
    datos.evaluaciones.push({
      id: uid(), colaboradorId: nuevos[i].id, periodo: String(anio), fecha: fechaRel(-40),
      objetivos: o, competencias: c, potencial: o >= 4.5 ? 'Alto' : 'Medio', fortalezas: '', planAccion: '',
    });
  });

  datos.capacitaciones.push(
    { id: uid(), nombre: 'Inducción corporativa', tipo: 'Inducción', modalidad: 'Presencial', fecha: fechaRel(-60), horas: 8, proveedor: 'Recursos Humanos', participantes: nuevos.slice(4, 8).map((c) => c.id), notas: '' },
    { id: uid(), nombre: 'Atención al cliente en farmacia', tipo: 'Técnica', modalidad: 'Virtual', fecha: fechaRel(-30), horas: 4, proveedor: 'Consultora externa', participantes: nuevos.slice(1, 5).map((c) => c.id), notas: '' },
    { id: uid(), nombre: 'Liderazgo de equipos de turno', tipo: 'Liderazgo', modalidad: 'Mixta', fecha: fechaRel(-12), horas: 12, proveedor: 'Escuela de Negocios', participantes: [nuevos[1].id, nuevos[7].id], notas: '' },
  );

  await guardarYRenderizar();
  aviso('Datos de ejemplo cargados');
}

/* ---------- Tema visual ---------- */

function alternarTema() {
  const oscuroActual = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  const tema = oscuroActual ? 'light' : 'dark';
  document.documentElement.dataset.theme = tema;
  localStorage.setItem('gt_tema', tema);
}

/* ---------- Eventos ---------- */

const ACCIONES = {
  respaldar,
  restaurar,
  csv: exportarCSV,
  'cambiar-clave': cambiarClave,
  'borrar-todo': borrarTodo,
  ejemplo: cargarEjemplo,
  bloquear,
  tema: alternarTema,
};

document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-view],[data-nuevo],[data-edit],[data-del],[data-action]');
  if (!b) return;

  if (b.dataset.view) return irA(b.dataset.view);
  if (b.dataset.action) return void ACCIONES[b.dataset.action]?.();
  if (!datos) return;
  if (b.dataset.nuevo) return abrirRegistro(b.dataset.nuevo, null);
  if (b.dataset.edit) {
    const [tipo, id] = b.dataset.edit.split(':');
    return abrirRegistro(tipo, id);
  }
  if (b.dataset.del) {
    const [tipo, id] = b.dataset.del.split(':');
    return void eliminarRegistro(tipo, id);
  }
});

document.addEventListener('input', (ev) => {
  if (ev.target.id === 'buscar') {
    busqueda = ev.target.value;
    renderizar();
  }
});

document.addEventListener('change', async (ev) => {
  if (ev.target.id === 'org-input' && datos) {
    datos.org = ev.target.value.trim() || 'Recursos Humanos';
    await guardar();
    $('#org-name').textContent = datos.org;
    aviso('Nombre actualizado');
  }
});

/* ---------- Arranque ---------- */

(function iniciar() {
  const tema = localStorage.getItem('gt_tema');
  if (tema) document.documentElement.dataset.theme = tema;

  prepararBloqueo();
  $('#lock-form').addEventListener('submit', entrar);
  ['pointerdown', 'keydown'].forEach((e) =>
    document.addEventListener(e, reiniciarInactividad, { passive: true }));
  $('#pw').focus();
})();
