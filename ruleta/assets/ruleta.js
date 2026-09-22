/* ============================================================
   Ruleta de premios — stand de expo
   Sin dependencias. Funciona sin conexión.
   Las porciones de cada premio definen su probabilidad real:
   lo que el visitante ve en la rueda es la chance que tiene.
   ============================================================ */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const num = (n, d = 0) => Number(n).toLocaleString('es', { minimumFractionDigits: d, maximumFractionDigits: d });

const CFG_KEY = 'ruleta_cfg_v1';
const LOG_KEY = 'ruleta_log_v1';

const CFG_BASE = () => ({
  marca: 'Farmatodo',
  logo: '',
  titulo: '¡Gira y gana!',
  subtitulo: 'Un giro por visitante. ¡Mucha suerte!',
  acento: '#382a63',   // violeta del logo
  acento2: '#1565c0',  // azul Farmatodo
  pedirNombre: false,
  sonido: true,
  confeti: true,
  premios: [
    { id: uid(), nombre: 'Botella', porciones: 2, stock: 12, tipo: 'premio' },
    { id: uid(), nombre: 'Gracias por participar', porciones: 5, stock: null, tipo: 'nada' },
    { id: uid(), nombre: 'Gira de nuevo', porciones: 1, stock: null, tipo: 'reintento' },
  ],
});

const TIPOS = {
  premio: 'Premio',
  nada: 'Gracias por participar',
  reintento: 'Gira de nuevo',
};

/* Las configuraciones guardadas antes usaban un campo booleano */
function migrarPremios(lista) {
  lista.forEach((p) => {
    if (!p.tipo) p.tipo = p.reintento ? 'reintento' : 'premio';
    delete p.reintento;
  });
  return lista;
}

let cfg = cargar(CFG_KEY, CFG_BASE());
migrarPremios(cfg.premios);
let registro = cargar(LOG_KEY, []);
let porciones = [];       // una entrada por porción de la rueda
let rotacion = 0;
let girando = false;
let participante = null;

function cargar(clave, porDefecto) {
  try {
    const guardado = JSON.parse(localStorage.getItem(clave));
    return guardado ?? porDefecto;
  } catch { return porDefecto; }
}

function guardarCfg() { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch {} }
function guardarLog() { try { localStorage.setItem(LOG_KEY, JSON.stringify(registro)); } catch {} }

let tempAviso;
function avisar(msg) {
  const a = $('#aviso');
  a.textContent = msg;
  a.hidden = false;
  clearTimeout(tempAviso);
  tempAviso = setTimeout(() => { a.hidden = true; }, 3000);
}

/* ---------- Color ---------- */

function aRGB(hex) {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

/* Luminancia relativa, para decidir si el rótulo va en blanco o en negro */
function luminancia(hex) {
  const [r, g, b] = aRGB(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const tintaSobre = (hex) => (luminancia(hex) > 0.45 ? '#10151c' : '#ffffff');

function mezclar(a, b, p) {
  const A = aRGB(a), B = aRGB(b);
  return '#' + A.map((c, i) => Math.round(c + (B[i] - c) * p).toString(16).padStart(2, '0')).join('');
}

function oscurecer(hex, p) { return mezclar(hex, '#000000', p); }

/* ---------- Construcción de la rueda ---------- */

function reconstruir() {
  const disponibles = cfg.premios.filter((p) => p.nombre.trim() && (p.stock === null || p.stock > 0));
  const pendientes = disponibles.map((p) => ({ p, n: Math.max(1, Math.min(20, p.porciones | 0)) }));
  const lista = [];
  // Reparto por rondas: las porciones de un mismo premio quedan separadas en la rueda
  let quedan = pendientes.reduce((s, r) => s + r.n, 0);
  while (quedan > 0) {
    for (const r of pendientes) {
      if (r.n > 0) { lista.push(r.p); r.n--; quedan--; }
    }
  }
  porciones = lista;
  actualizarPie();
}

function colorPorcion(i, total) {
  const a = cfg.acento, b = cfg.acento2;
  if (total % 2 === 1 && i === total - 1) return oscurecer(a, 0.28);
  return i % 2 === 0 ? a : b;
}

/* ---------- Dibujo ---------- */

const lienzo = $('#lienzo');
const ctx = lienzo.getContext('2d');
const FUENTE = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function redimensionar() {
  const zona = $('.ruleta-zona');
  const lado = Math.max(220, Math.floor(Math.min(zona.clientWidth, zona.clientHeight)));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  lienzo.style.width = lado + 'px';
  lienzo.style.height = lado + 'px';
  lienzo.width = Math.round(lado * dpr);
  lienzo.height = Math.round(lado * dpr);
  dibujar();
}

/* Parte el rótulo en líneas que quepan en el ancho dado */
function partir(texto, maxAncho, maxLineas) {
  const palabras = String(texto).split(/\s+/).filter(Boolean);
  const lineas = [];
  let actual = '';
  for (const palabra of palabras) {
    const prueba = actual ? actual + ' ' + palabra : palabra;
    if (ctx.measureText(prueba).width <= maxAncho || !actual) { actual = prueba; continue; }
    if (lineas.length === maxLineas - 1) { actual = prueba; continue; }
    lineas.push(actual);
    actual = palabra;
  }
  if (actual) lineas.push(actual);
  return lineas.slice(0, maxLineas);
}

/* Busca el tamaño de letra más grande con el que el rótulo entra completo.
   Si ni el más chico alcanza, recorta con puntos suspensivos. */
function ajustar(texto, maxAncho, tamMax, maxLineas) {
  for (let t = tamMax; t >= tamMax * 0.58; t -= tamMax * 0.07) {
    ctx.font = `700 ${t.toFixed(1)}px ${FUENTE}`;
    const lineas = partir(texto, maxAncho, maxLineas);
    if (lineas.every((l) => ctx.measureText(l).width <= maxAncho)) return { tam: t, lineas };
  }
  const t = tamMax * 0.58;
  ctx.font = `700 ${t.toFixed(1)}px ${FUENTE}`;
  const lineas = partir(texto, maxAncho, maxLineas).map((l) => {
    if (ctx.measureText(l).width <= maxAncho) return l;
    let corte = l;
    while (corte.length > 1 && ctx.measureText(corte + '…').width > maxAncho) corte = corte.slice(0, -1);
    return corte.trimEnd() + '…';
  });
  return { tam: t, lineas };
}

function dibujar() {
  const d = lienzo.width;
  const r = d / 2;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, d, d);

  const n = porciones.length;
  const aro = r * 0.055;
  const radio = r - aro;

  if (!n) {
    ctx.save();
    ctx.translate(r, r);
    ctx.fillStyle = '#d7dde5';
    ctx.beginPath(); ctx.arc(0, 0, radio, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6b7482';
    ctx.font = `700 ${Math.round(r * 0.09)}px ${FUENTE}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Sin premios', 0, -r * 0.16);
    ctx.fillText('disponibles', 0, r * 0.02);
    ctx.restore();
    return;
  }

  const ang = (Math.PI * 2) / n;

  ctx.save();
  ctx.translate(r, r);
  ctx.rotate(rotacion);

  for (let i = 0; i < n; i++) {
    const a0 = -Math.PI / 2 + i * ang;
    const fondo = colorPorcion(i, n);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radio, a0, a0 + ang);
    ctx.closePath();
    ctx.fillStyle = fondo;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.6)';
    ctx.lineWidth = Math.max(1, r * 0.006);
    ctx.stroke();

    // Rótulo: se lee desde el centro hacia afuera y nunca queda cabeza abajo
    const medio = a0 + ang / 2;
    const tamMax = Math.max(10, r * 0.082);
    const maxLineas = Math.max(1, Math.min(3, Math.floor((ang * radio * 0.8) / (tamMax * 1.15))));
    const maxAncho = radio * 0.62;
    const { tam, lineas } = ajustar(porciones[i].nombre, maxAncho, tamMax, maxLineas);

    // Ángulo real en pantalla, ya contando la rotación de la rueda
    const enPantalla = (((medio + rotacion) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const bocaAbajo = enPantalla > Math.PI / 2 && enPantalla < Math.PI * 1.5;

    ctx.save();
    ctx.rotate(medio);
    if (bocaAbajo) ctx.rotate(Math.PI);
    ctx.fillStyle = tintaSobre(fondo);
    ctx.textAlign = bocaAbajo ? 'left' : 'right';
    ctx.textBaseline = 'middle';
    const x = (bocaAbajo ? -1 : 1) * radio * 0.93;
    const paso = tam * 1.14;
    const y0 = -((lineas.length - 1) * paso) / 2;
    lineas.forEach((l, k) => ctx.fillText(l, x, y0 + k * paso));
    ctx.restore();
  }

  // Clavijas sobre las divisiones
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + i * ang;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * (radio + aro * 0.5), Math.sin(a) * (radio + aro * 0.5), Math.max(1.5, r * 0.011), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.fill();
  }

  ctx.restore();

  // Aro exterior y eje central, fijos
  ctx.save();
  ctx.translate(r, r);
  ctx.beginPath();
  ctx.arc(0, 0, radio + aro / 2, 0, Math.PI * 2);
  ctx.strokeStyle = oscurecer(cfg.acento, 0.45);
  ctx.lineWidth = aro;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
}

/* ---------- Sonido ---------- */

let audio = null;
function ctxAudio() {
  if (!audio) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audio = new AC();
  }
  if (audio.state === 'suspended') audio.resume();
  return audio;
}

function nota(frec, dur, volumen = 0.06, tipo = 'square', retraso = 0) {
  if (!cfg.sonido) return;
  const a = ctxAudio();
  if (!a) return;
  const t = a.currentTime + retraso;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(frec, t);
  g.gain.setValueAtTime(volumen, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(a.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

const tic = () => nota(1150, 0.04, 0.04);
function fanfarria() {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => nota(f, 0.3, 0.07, 'triangle', i * 0.1));
}

/* ---------- Confeti ---------- */

const confetiLienzo = $('#confeti');
const cctx = confetiLienzo.getContext('2d');
let particulas = [];
let animandoConfeti = false;

const menosMovimiento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function lanzarConfeti() {
  if (!cfg.confeti || menosMovimiento) return;
  confetiLienzo.width = window.innerWidth;
  confetiLienzo.height = window.innerHeight;
  const colores = [cfg.acento, cfg.acento2, '#ffffff', mezclar(cfg.acento, '#ffffff', 0.45)];
  particulas = Array.from({ length: 140 }, () => ({
    x: Math.random() * confetiLienzo.width,
    y: -20 - Math.random() * confetiLienzo.height * 0.4,
    vx: (Math.random() - 0.5) * 2.4,
    vy: 2.5 + Math.random() * 3.5,
    giro: Math.random() * Math.PI,
    vgiro: (Math.random() - 0.5) * 0.25,
    lado: 5 + Math.random() * 7,
    color: colores[Math.floor(Math.random() * colores.length)],
  }));
  if (!animandoConfeti) { animandoConfeti = true; requestAnimationFrame(pasoConfeti); }
}

function pasoConfeti() {
  cctx.clearRect(0, 0, confetiLienzo.width, confetiLienzo.height);
  particulas = particulas.filter((p) => p.y < confetiLienzo.height + 30);
  for (const p of particulas) {
    p.x += p.vx; p.y += p.vy; p.giro += p.vgiro;
    cctx.save();
    cctx.translate(p.x, p.y);
    cctx.rotate(p.giro);
    cctx.fillStyle = p.color;
    cctx.fillRect(-p.lado / 2, -p.lado / 4, p.lado, p.lado / 2);
    cctx.restore();
  }
  if (particulas.length) requestAnimationFrame(pasoConfeti);
  else { animandoConfeti = false; cctx.clearRect(0, 0, confetiLienzo.width, confetiLienzo.height); }
}

/* ---------- Giro ---------- */

const indiceBajoPuntero = () => {
  const n = porciones.length;
  if (!n) return -1;
  const ang = (Math.PI * 2) / n;
  const a = (((-rotacion) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return Math.min(n - 1, Math.floor(a / ang));
};

function pedirGiro() {
  if (girando) return;
  if (!porciones.length) { avisar('No quedan premios disponibles'); return; }
  ctxAudio();
  if (cfg.pedirNombre && !participante) {
    $('#capa-datos').hidden = false;
    $('#p-nombre').focus();
    return;
  }
  girar();
}

function girar() {
  girando = true;
  $('#girar').disabled = true;

  const desde = rotacion;
  const vueltas = 5 + Math.floor(Math.random() * 4);
  const hasta = desde + vueltas * Math.PI * 2 + Math.random() * Math.PI * 2;
  const duracion = 5000 + Math.random() * 900;
  const t0 = performance.now();
  let ultimo = indiceBajoPuntero();

  function paso(t) {
    const p = Math.min(1, (t - t0) / duracion);
    rotacion = desde + (hasta - desde) * (1 - Math.pow(1 - p, 4));
    dibujar();
    const i = indiceBajoPuntero();
    if (i !== ultimo) { ultimo = i; tic(); }
    if (p < 1) return requestAnimationFrame(paso);
    rotacion = hasta % (Math.PI * 2);
    dibujar();
    girando = false;
    resolver(indiceBajoPuntero());
  }
  requestAnimationFrame(paso);
}

let ultimoTipo = 'premio';

function resolver(indice) {
  const premio = porciones[indice];
  if (!premio) { $('#girar').disabled = false; return; }
  ultimoTipo = premio.tipo || 'premio';

  $('#premio-nombre').textContent = premio.nombre;

  if (ultimoTipo === 'reintento') {
    $('#premio-rotulo').textContent = '¡Otra oportunidad!';
    $('#premio-nota').textContent = 'Vuelve a girar la ruleta.';
    $('#premio-cerrar').textContent = 'Girar otra vez';
  } else if (ultimoTipo === 'nada') {
    $('#premio-rotulo').textContent = 'Gracias por participar';
    $('#premio-nota').textContent = '¡Te esperamos en la próxima!';
    $('#premio-cerrar').textContent = 'Siguiente visitante';
    registrar(premio.nombre, false);
  } else {
    const real = cfg.premios.find((p) => p.id === premio.id);
    if (real && real.stock !== null) real.stock = Math.max(0, real.stock - 1);
    guardarCfg();
    registrar(premio.nombre, true);
    $('#premio-rotulo').textContent = '¡Felicitaciones!';
    $('#premio-nota').textContent = real && real.stock !== null
      ? `Quedan ${real.stock} ${real.stock === 1 ? 'unidad' : 'unidades'}.` : '';
    $('#premio-cerrar').textContent = 'Siguiente visitante';
    fanfarria();
    lanzarConfeti();
  }

  $('#capa-premio').hidden = false;
  $('#premio-cerrar').focus();
}

function registrar(premio, entregado) {
  registro.push({
    fecha: new Date().toISOString(),
    premio,
    entregado,
    nombre: participante?.nombre || '',
    contacto: participante?.contacto || '',
  });
  guardarLog();
}

function cerrarPremio() {
  $('#capa-premio').hidden = true;
  if (ultimoTipo !== 'reintento') participante = null;
  reconstruir();
  dibujar();
  $('#girar').disabled = false;
  if (panelAbierto()) pintarPanel();
}

function actualizarPie() {
  const reales = cfg.premios.filter((p) => (p.tipo || 'premio') === 'premio');
  const conStock = reales.filter((p) => p.stock !== null);
  const restantes = conStock.reduce((s, p) => s + p.stock, 0);
  const ilimitados = reales.some((p) => p.stock === null);
  const partes = [];
  if (conStock.length) partes.push(`${num(restantes)} unidades con stock${ilimitados ? ' (más premios sin límite)' : ''}`);
  const entregas = registro.filter((r) => r.entregado !== false).length;
  partes.push(`${num(entregas)} ${entregas === 1 ? 'entrega' : 'entregas'} registradas`);
  $('#pie').textContent = partes.join(' · ');
}

/* ---------- Identidad visual ---------- */

function aplicarIdentidad() {
  document.documentElement.style.setProperty('--acento', cfg.acento);
  document.documentElement.style.setProperty('--acento2', cfg.acento2);
  $('#marca-texto').textContent = cfg.marca;
  $('#titulo').textContent = cfg.titulo;
  $('#subtitulo').textContent = cfg.subtitulo;
  const img = $('#logo');
  if (cfg.logo) { img.src = cfg.logo; img.hidden = false; img.alt = cfg.marca; }
  else { img.removeAttribute('src'); img.hidden = true; }
  document.title = `Ruleta de premios · ${cfg.marca}`;
}

/* ---------- Panel de configuración ---------- */

const panel = $('#panel');
const panelAbierto = () => panel.open;

function porcionesDisponibles() {
  return cfg.premios
    .filter((p) => p.nombre.trim() && (p.stock === null || p.stock > 0))
    .reduce((s, p) => s + Math.max(1, Math.min(20, p.porciones | 0)), 0);
}

function probabilidad(p) {
  if (!p.nombre.trim()) return '—';
  if (p.stock !== null && p.stock <= 0) return 'agotado';
  const total = porcionesDisponibles();
  if (!total) return '—';
  return num((Math.max(1, Math.min(20, p.porciones | 0)) / total) * 100, 1) + ' %';
}

function pintarPremios() {
  $('#lista-premios').innerHTML = cfg.premios.map((p) => `
    <div class="fila-premio" data-id="${p.id}">
      <input type="text" data-k="nombre" value="${esc(p.nombre)}" maxlength="34" placeholder="Nombre del premio">
      <input type="number" data-k="porciones" value="${Math.max(1, p.porciones | 0)}" min="1" max="20" step="1">
      <input type="number" data-k="stock" value="${p.stock === null ? '' : p.stock}" min="0" step="1" placeholder="∞">
      <span class="prob">${probabilidad(p)}</span>
      <select data-k="tipo">${Object.entries(TIPOS).map(([v, t]) =>
        `<option value="${v}"${(p.tipo || 'premio') === v ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
      <button class="quitar" type="button" data-quitar="${p.id}" aria-label="Quitar premio">×</button>
    </div>`).join('');
}

function refrescarProbabilidades() {
  $$('#lista-premios .fila-premio').forEach((fila) => {
    const p = cfg.premios.find((x) => x.id === fila.dataset.id);
    if (p) fila.querySelector('.prob').textContent = probabilidad(p);
  });
}

function pintarRegistro() {
  $('#c-resumen').textContent = registro.length
    ? `${num(registro.length)} ${registro.length === 1 ? 'entrega' : 'entregas'} desde el inicio del evento.`
    : 'Todavía no hay entregas registradas.';

  if (!registro.length) { $('#c-tabla').innerHTML = ''; return; }

  const filas = registro.slice().reverse().slice(0, 100).map((r) => {
    const d = new Date(r.fecha);
    return `<tr>
      <td>${esc(d.toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))}</td>
      <td>${esc(r.premio)}</td>
      <td>${r.entregado === false ? 'No' : 'Sí'}</td>
      <td>${esc(r.nombre || '—')}</td>
      <td>${esc(r.contacto || '—')}</td>
    </tr>`;
  }).join('');

  $('#c-tabla').innerHTML = `<table>
    <thead><tr><th>Fecha</th><th>Resultado</th><th>Entregado</th><th>Participante</th><th>Contacto</th></tr></thead>
    <tbody>${filas}</tbody></table>`;
}

function pintarPanel() {
  $('#c-marca').value = cfg.marca;
  $('#c-titulo').value = cfg.titulo;
  $('#c-subtitulo').value = cfg.subtitulo;
  $('#c-acento').value = cfg.acento;
  $('#c-acento2').value = cfg.acento2;
  $('#c-pedir').checked = cfg.pedirNombre;
  $('#c-sonido').checked = cfg.sonido;
  $('#c-confeti').checked = cfg.confeti;
  pintarPremios();
  pintarRegistro();
}

function abrirPanel() {
  if (girando) return;
  pintarPanel();
  panel.showModal();
}

function aplicarYRedibujar() {
  guardarCfg();
  aplicarIdentidad();
  reconstruir();
  dibujar();
}

/* ---------- Descarga de archivos ---------- */

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

function textoCSV() {
  const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const filas = registro.map((r) => {
    const d = new Date(r.fecha);
    return [d.toLocaleDateString('es'), d.toLocaleTimeString('es'), r.premio,
      r.entregado === false ? 'No' : 'Sí', r.nombre, r.contacto].map(celda).join(';');
  });
  return [['Fecha', 'Hora', 'Resultado', 'Premio entregado', 'Participante', 'Contacto'].map(celda).join(';'), ...filas].join('\r\n');
}

/* Muestra el texto en pantalla además de ofrecer la descarga: dentro de una
   página embebida el navegador bloquea las descargas, y copiar y pegar
   funciona siempre. */
function exportarCSV() {
  if (!registro.length) { avisar('No hay entregas para exportar'); return; }
  $('#export-texto').value = textoCSV();
  $('#capa-export').hidden = false;
  $('#export-texto').select();
}

/* ---------- Eventos ---------- */

$('#girar').addEventListener('click', pedirGiro);
lienzo.addEventListener('click', pedirGiro);
$('#premio-cerrar').addEventListener('click', cerrarPremio);

$('#form-datos').addEventListener('submit', (ev) => {
  ev.preventDefault();
  participante = {
    nombre: $('#p-nombre').value.trim(),
    contacto: $('#p-contacto').value.trim(),
  };
  $('#capa-datos').hidden = true;
  $('#form-datos').reset();
  girar();
});

document.addEventListener('click', (ev) => {
  const cerrar = ev.target.closest('[data-cerrar]');
  if (cerrar) {
    $('#' + cerrar.dataset.cerrar).hidden = true;
    $('#form-datos').reset();
  }
});

// Acceso al panel: mantener presionada la marca, o tecla A
let tempPresion;
const marca = $('#marca');
['pointerdown'].forEach((e) => marca.addEventListener(e, () => {
  clearTimeout(tempPresion);
  tempPresion = setTimeout(abrirPanel, 900);
}));
['pointerup', 'pointerleave', 'pointercancel'].forEach((e) =>
  marca.addEventListener(e, () => clearTimeout(tempPresion)));

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'a' && !panelAbierto() && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) abrirPanel();
  if (ev.code === 'Space' && !panelAbierto() && $('#capa-premio').hidden && $('#capa-datos').hidden) {
    ev.preventDefault();
    pedirGiro();
  }
});

$('#panel-cerrar').addEventListener('click', () => panel.close());

$('#c-marca').addEventListener('input', (e) => { cfg.marca = e.target.value; aplicarYRedibujar(); });
$('#c-titulo').addEventListener('input', (e) => { cfg.titulo = e.target.value; aplicarYRedibujar(); });
$('#c-subtitulo').addEventListener('input', (e) => { cfg.subtitulo = e.target.value; aplicarYRedibujar(); });
$('#c-acento').addEventListener('input', (e) => { cfg.acento = e.target.value; aplicarYRedibujar(); });
$('#c-acento2').addEventListener('input', (e) => { cfg.acento2 = e.target.value; aplicarYRedibujar(); });
$('#c-pedir').addEventListener('change', (e) => { cfg.pedirNombre = e.target.checked; guardarCfg(); });
$('#c-sonido').addEventListener('change', (e) => { cfg.sonido = e.target.checked; guardarCfg(); });
$('#c-confeti').addEventListener('change', (e) => { cfg.confeti = e.target.checked; guardarCfg(); });

['input', 'change'].forEach((evento) => $('#lista-premios').addEventListener(evento, (ev) => {
  const fila = ev.target.closest('.fila-premio');
  const clave = ev.target.dataset.k;
  if (!fila || !clave) return;
  const p = cfg.premios.find((x) => x.id === fila.dataset.id);
  if (!p) return;

  if (clave === 'nombre') p.nombre = ev.target.value;
  else if (clave === 'porciones') p.porciones = Math.max(1, Math.min(20, parseInt(ev.target.value, 10) || 1));
  else if (clave === 'stock') p.stock = ev.target.value === '' ? null : Math.max(0, parseInt(ev.target.value, 10) || 0);
  else if (clave === 'tipo') p.tipo = ev.target.value;

  guardarCfg();
  reconstruir();
  dibujar();
  refrescarProbabilidades();
}));

$('#c-agregar').addEventListener('click', () => {
  cfg.premios.push({ id: uid(), nombre: '', porciones: 1, stock: null, reintento: false });
  guardarCfg();
  pintarPremios();
  $('#lista-premios .fila-premio:last-child input')?.focus();
});

$('#lista-premios').addEventListener('click', (ev) => {
  const id = ev.target.closest('[data-quitar]')?.dataset.quitar;
  if (!id) return;
  cfg.premios = cfg.premios.filter((p) => p.id !== id);
  guardarCfg();
  reconstruir();
  dibujar();
  pintarPremios();
});

$('#c-logo').addEventListener('change', (ev) => {
  const archivo = ev.target.files?.[0];
  if (!archivo) return;
  if (archivo.size > 500 * 1024) { avisar('El logo supera los 500 KB'); ev.target.value = ''; return; }
  const lector = new FileReader();
  lector.onload = () => { cfg.logo = String(lector.result); aplicarYRedibujar(); avisar('Logo cargado'); };
  lector.readAsDataURL(archivo);
});

$('#c-logo-quitar').addEventListener('click', () => {
  cfg.logo = '';
  $('#c-logo').value = '';
  aplicarYRedibujar();
});

$('#c-pantalla').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    avisar('Si la ruleta está dentro de otra página, ábrela en una pestaña aparte. En una notebook también sirve F11.');
  }
});

$('#c-csv').addEventListener('click', exportarCSV);

$('#export-copiar').addEventListener('click', async () => {
  const caja = $('#export-texto');
  try {
    await navigator.clipboard.writeText(caja.value);
    avisar('Copiado al portapapeles');
  } catch {
    caja.select();
    avisar('Texto seleccionado: cópialo con Ctrl+C');
  }
});

$('#export-descargar').addEventListener('click', () => {
  descargar(`ruleta-entregas-${new Date().toISOString().slice(0, 10)}.csv`,
    '\uFEFF' + textoCSV(), 'text/csv;charset=utf-8');
});

$('#c-borrar-log').addEventListener('click', () => {
  if (!confirm('¿Borrar el registro de entregas? El stock de los premios no cambia.')) return;
  registro = [];
  guardarLog();
  pintarRegistro();
  actualizarPie();
  avisar('Registro borrado');
});

$('#c-reset').addEventListener('click', () => {
  if (!confirm('Se restablecen los premios, los colores y el registro a los valores iniciales. ¿Continuar?')) return;
  try { localStorage.removeItem(CFG_KEY); localStorage.removeItem(LOG_KEY); } catch {}
  cfg = CFG_BASE();
  registro = [];
  guardarCfg();
  guardarLog();
  pintarPanel();
  aplicarYRedibujar();
  avisar('Configuración restablecida');
});

/* ---------- Arranque ---------- */

let ladoPrevio = 0;
function quizasRedimensionar() {
  const zona = $('.ruleta-zona');
  const lado = Math.floor(Math.min(zona.clientWidth, zona.clientHeight));
  if (Math.abs(lado - ladoPrevio) < 2) return;
  ladoPrevio = lado;
  redimensionar();
}

/* Embebida en otra página, el navegador bloquea las descargas:
   ahí solo tiene sentido copiar y pegar. */
const embebida = window.self !== window.top;

(function iniciar() {
  if (embebida) $('#export-descargar').hidden = true;
  aplicarIdentidad();
  reconstruir();
  redimensionar();
  ladoPrevio = Math.floor(Math.min($('.ruleta-zona').clientWidth, $('.ruleta-zona').clientHeight));

  window.addEventListener('resize', quizasRedimensionar);
  window.addEventListener('orientationchange', () => setTimeout(redimensionar, 250));
  if (window.ResizeObserver) new ResizeObserver(quizasRedimensionar).observe($('.ruleta-zona'));
})();
