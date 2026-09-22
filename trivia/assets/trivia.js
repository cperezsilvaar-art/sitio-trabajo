/* ============================================================
   Trivia de premios — stand de expo
   Sin dependencias. Funciona sin conexión.
   El visitante responde; gana si alcanza los aciertos pedidos.
   ============================================================ */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const num = (n) => Number(n).toLocaleString('es');
const plural = (n, uno, varios) => `${num(n)} ${n === 1 ? uno : varios}`;

/* botella -> botellas, reloj -> relojes */
const pluralizar = (palabra) => {
  const p = String(palabra).trim();
  if (!p) return p;
  if (/[aeiouáéíóú]$/i.test(p)) return p + 's';
  if (/[zZ]$/.test(p)) return p.slice(0, -1) + 'ces';
  return p + 'es';
};

const CFG_KEY = 'trivia_cfg_v1';
const LOG_KEY = 'trivia_log_v1';

const CFG_BASE = () => ({
  marca: 'Farmatodo',
  logo: '',
  titulo: 'Responde y gana',
  acento: '#382a63',
  acento2: '#1565c0',
  premio: 'botella',
  stock: 12,
  cuantas: 3,
  necesarios: 2,
  pedirNombre: false,
  sonido: true,
  confeti: true,
  mezclar: true,
  mostrarStock: false,
  preguntas: [
    {
      id: uid(),
      texto: '¿En qué país tiene su sede Farmatodo?',
      respuesta: 'Venezuela. La sede corporativa está en Caracas.',
      opciones: '*Venezuela | Colombia | Panamá',
    },
    {
      id: uid(),
      texto: '¿De qué país es originaria Farmatodo?',
      respuesta: 'Venezuela. Nació en 1918 en Barquisimeto.',
      opciones: '*Venezuela | Colombia | México',
    },
    {
      id: uid(),
      texto: 'Nombra un barrio donde haya un Farmatodo',
      respuesta: 'Cualquier barrio de tu ciudad con tienda. Tú decides si la respuesta cuenta.',
      opciones: '',
    },
  ],
});

let cfg = cargar(CFG_KEY, CFG_BASE());
let registro = cargar(LOG_KEY, []);
let ronda = null;
let participante = null;
let esperando = false;   // pausa entre responder y pasar a la siguiente

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

function nota(frec, dur, volumen = 0.06, tipo = 'triangle', retraso = 0) {
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

const sonidoBien = () => { nota(659.25, 0.12, 0.07); nota(987.77, 0.22, 0.07, 'triangle', 0.1); };
const sonidoMal = () => { nota(233.08, 0.26, 0.06, 'sawtooth'); };
const fanfarria = () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => nota(f, 0.32, 0.08, 'triangle', i * 0.11));

/* ---------- Confeti ---------- */

const confetiLienzo = $('#confeti');
const cctx = confetiLienzo.getContext('2d');
const menosMovimiento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
let particulas = [];
let animandoConfeti = false;

function mezclarColor(a, b, p) {
  const rgb = (h) => {
    const v = h.replace('#', '');
    const t = v.length === 3 ? v.split('').map((c) => c + c).join('') : v;
    return [0, 2, 4].map((i) => parseInt(t.slice(i, i + 2), 16));
  };
  const A = rgb(a), B = rgb(b);
  return '#' + A.map((c, i) => Math.round(c + (B[i] - c) * p).toString(16).padStart(2, '0')).join('');
}

function lanzarConfeti() {
  if (!cfg.confeti || menosMovimiento) return;
  confetiLienzo.width = window.innerWidth;
  confetiLienzo.height = window.innerHeight;
  const colores = [cfg.acento, cfg.acento2, '#ffffff', mezclarColor(cfg.acento, '#ffffff', 0.45)];
  particulas = Array.from({ length: 150 }, () => ({
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

/* ---------- Preguntas ---------- */

/* "*Venezuela | Colombia" -> [{texto:'Venezuela', correcta:true}, …]
   Si no hay al menos dos opciones con una marcada, la pregunta la juzga
   la persona que atiende el stand. */
function parsearOpciones(texto) {
  const partes = String(texto || '').split('|').map((s) => s.trim()).filter(Boolean);
  const opciones = partes.map((s) => ({
    texto: s.replace(/^\*\s*/, ''),
    correcta: s.startsWith('*'),
  }));
  return opciones.length >= 2 && opciones.some((o) => o.correcta) ? opciones : [];
}

const preguntasValidas = () => cfg.preguntas.filter((p) => p.texto.trim());

function revolver(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- Pantallas ---------- */

function mostrar(id) {
  ['p-inicio', 'p-pregunta', 'p-resultado'].forEach((p) => { $('#' + p).hidden = p !== id; });
}

function pintarInicio() {
  const banco = preguntasValidas().length;
  const cuantas = Math.min(cfg.cuantas, banco);
  $('#regla').textContent = banco
    ? `Responde ${cuantas === 1 ? 'la pregunta' : `${num(cuantas)} preguntas`} y gana una ${cfg.premio}. ` +
      `Necesitas ${plural(Math.min(cfg.necesarios, cuantas), 'acierto', 'aciertos')}.`
    : 'Todavía no hay preguntas cargadas.';
  $('#empezar').disabled = !banco;
  const agotado = cfg.stock <= 0;
  $('#stock-inicio').textContent = agotado
    ? `Se agotaron las unidades de ${cfg.premio}.`
    : cfg.mostrarStock
      ? `Quedan ${plural(cfg.stock, cfg.premio, pluralizar(cfg.premio))}.`
      : '';
  mostrar('p-inicio');
  actualizarPie();
}

function pintarPuntos() {
  $('#puntos').innerHTML = ronda.preguntas.map((_, i) => {
    const r = ronda.resultados[i];
    const clase = r === true ? 'es-bien' : r === false ? 'es-mal' : i === ronda.indice ? 'es-turno' : '';
    return `<span class="punto ${clase}"></span>`;
  }).join('');
  $('#puntos').setAttribute('aria-label',
    `Pregunta ${ronda.indice + 1} de ${ronda.preguntas.length}. ${plural(ronda.aciertos, 'acierto', 'aciertos')}.`);
}

function pintarPregunta() {
  const p = ronda.preguntas[ronda.indice];
  $('#contador').textContent = `Pregunta ${ronda.indice + 1} de ${ronda.preguntas.length}`;
  $('#pregunta-texto').textContent = p.texto;
  $('#respuesta').textContent = p.respuesta || 'Sin machete cargado para esta pregunta.';
  $('#respuesta').hidden = true;

  const opciones = parsearOpciones(p.opciones);
  const lista = $('#opciones');

  if (opciones.length) {
    const orden = cfg.mezclar ? revolver(opciones) : opciones;
    lista.innerHTML = orden.map((o, i) =>
      `<button class="opcion" type="button" data-opcion="${i}"${o.correcta ? ' data-correcta="1"' : ''}>${esc(o.texto)}</button>`
    ).join('');
    lista.hidden = false;
    $('#juez').hidden = true;
  } else {
    lista.innerHTML = '';
    lista.hidden = true;
    $('#juez').hidden = false;
  }

  pintarPuntos();
  mostrar('p-pregunta');
}

function iniciarRonda() {
  const banco = preguntasValidas();
  if (!banco.length) { avisar('Carga al menos una pregunta en el panel'); return; }
  ctxAudio();

  if (cfg.pedirNombre && !participante) {
    $('#capa-datos').hidden = false;
    $('#p-nombre').focus();
    return;
  }

  const cuantas = Math.max(1, Math.min(cfg.cuantas, banco.length));
  const elegidas = cuantas < banco.length ? revolver(banco).slice(0, cuantas) : banco.slice();
  ronda = { preguntas: elegidas, indice: 0, aciertos: 0, resultados: elegidas.map(() => null) };
  esperando = false;
  pintarPregunta();
}

function responder(correcta) {
  if (esperando || !ronda) return;
  ronda.resultados[ronda.indice] = correcta;
  if (correcta) { ronda.aciertos++; sonidoBien(); } else sonidoMal();
  pintarPuntos();

  esperando = true;
  setTimeout(() => {
    esperando = false;
    ronda.indice++;
    if (ronda.indice >= ronda.preguntas.length) finalizarRonda();
    else pintarPregunta();
  }, 900);
}

function finalizarRonda() {
  const total = ronda.preguntas.length;
  const necesarios = Math.max(1, Math.min(cfg.necesarios, total));
  const gano = ronda.aciertos >= necesarios;
  const hayStock = cfg.stock > 0;
  const entregado = gano && hayStock;

  if (entregado) {
    cfg.stock = Math.max(0, cfg.stock - 1);
    guardarCfg();
  }

  registro.push({
    fecha: new Date().toISOString(),
    nombre: participante?.nombre || '',
    contacto: participante?.contacto || '',
    aciertos: ronda.aciertos,
    total,
    gano,
    entregado,
  });
  guardarLog();

  const detalle = `Acertaste ${ronda.aciertos} de ${total}.`;

  if (entregado) {
    $('#resultado-rotulo').textContent = '¡Felicitaciones!';
    $('#resultado-titulo').textContent = `Ganaste una ${cfg.premio}`;
    $('#resultado-nota').textContent = detalle;
    fanfarria();
    lanzarConfeti();
  } else if (gano) {
    $('#resultado-rotulo').textContent = '¡Respondiste bien!';
    $('#resultado-titulo').textContent = detalle;
    $('#resultado-nota').textContent = `Se agotaron las unidades de ${cfg.premio}. Gracias por participar.`;
    fanfarria();
  } else {
    $('#resultado-rotulo').textContent = 'Gracias por participar';
    $('#resultado-titulo').textContent = detalle;
    $('#resultado-nota').textContent = `Necesitabas ${plural(necesarios, 'acierto', 'aciertos')} para ganar. ¡Te esperamos!`;
    sonidoMal();
  }

  mostrar('p-resultado');
  $('#siguiente').focus();
  actualizarPie();
  if (panelAbierto()) pintarPanel();
}

function siguienteVisitante() {
  participante = null;
  ronda = null;
  pintarInicio();
  $('#empezar').focus();
}

function actualizarPie() {
  const ganadores = registro.filter((r) => r.entregado).length;
  const partes = [`Premio: ${cfg.premio}`];
  if (cfg.mostrarStock) partes.push(plural(cfg.stock, 'unidad disponible', 'unidades disponibles'));
  partes.push(plural(registro.length, 'participante', 'participantes'));
  partes.push(plural(ganadores, 'premio entregado', 'premios entregados'));
  $('#pie').textContent = partes.join(' · ');
}

/* ---------- Identidad visual ---------- */

function aplicarIdentidad() {
  document.documentElement.style.setProperty('--acento', cfg.acento);
  document.documentElement.style.setProperty('--acento2', cfg.acento2);
  $('#marca-texto').textContent = cfg.marca;
  $('#titulo').textContent = cfg.titulo;
  const img = $('#logo');
  if (cfg.logo) { img.src = cfg.logo; img.hidden = false; img.alt = cfg.marca; }
  else { img.removeAttribute('src'); img.hidden = true; }
  document.title = `Trivia · ${cfg.marca}`;
}

/* ---------- Panel de configuración ---------- */

const panel = $('#panel');
const panelAbierto = () => panel.open;

function pintarPreguntas() {
  $('#lista-preguntas').innerHTML = cfg.preguntas.map((p, i) => {
    const opciones = parsearOpciones(p.opciones);
    const modo = opciones.length
      ? `${opciones.length} opciones en pantalla`
      : 'la juzgas tú';
    return `<div class="ficha-pregunta" data-id="${p.id}">
      <div class="ficha-cabecera">
        <span>Pregunta ${i + 1} · ${esc(modo)}</span>
        <button class="quitar" type="button" data-quitar="${p.id}" aria-label="Quitar pregunta">×</button>
      </div>
      <label><span>Pregunta</span>
        <input type="text" data-k="texto" value="${esc(p.texto)}" maxlength="140" placeholder="¿En qué país…?"></label>
      <label><span>Respuesta (tu machete, no se muestra al visitante)</span>
        <input type="text" data-k="respuesta" value="${esc(p.respuesta)}" maxlength="160" placeholder="Venezuela"></label>
      <label><span>Opciones en pantalla, separadas por | y la correcta con * adelante (vacío = la juzgas tú)</span>
        <input type="text" data-k="opciones" value="${esc(p.opciones)}" maxlength="200" placeholder="*Venezuela | Colombia | Panamá"></label>
    </div>`;
  }).join('');
}

function pintarRegistro() {
  const ganadores = registro.filter((r) => r.entregado).length;
  $('#c-resumen').textContent = registro.length
    ? `${plural(registro.length, 'participante', 'participantes')} · ${plural(ganadores, 'premio entregado', 'premios entregados')}.`
    : 'Todavía no hay participantes registrados.';

  if (!registro.length) { $('#c-tabla').innerHTML = ''; return; }

  const filas = registro.slice().reverse().slice(0, 100).map((r) => {
    const d = new Date(r.fecha);
    return `<tr>
      <td>${esc(d.toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))}</td>
      <td>${esc(r.nombre || '—')}</td>
      <td>${esc(r.contacto || '—')}</td>
      <td>${r.aciertos} / ${r.total}</td>
      <td>${r.entregado ? 'Sí' : 'No'}</td>
    </tr>`;
  }).join('');

  $('#c-tabla').innerHTML = `<table>
    <thead><tr><th>Fecha</th><th>Participante</th><th>Contacto</th><th>Aciertos</th><th>Premio</th></tr></thead>
    <tbody>${filas}</tbody></table>`;
}

function pintarPanel() {
  $('#c-marca').value = cfg.marca;
  $('#c-titulo').value = cfg.titulo;
  $('#c-acento').value = cfg.acento;
  $('#c-acento2').value = cfg.acento2;
  $('#c-premio').value = cfg.premio;
  $('#c-stock').value = cfg.stock;
  $('#c-cuantas').value = cfg.cuantas;
  $('#c-necesarios').value = cfg.necesarios;
  $('#c-pedir').checked = cfg.pedirNombre;
  $('#c-sonido').checked = cfg.sonido;
  $('#c-confeti').checked = cfg.confeti;
  $('#c-mezclar').checked = cfg.mezclar;
  $('#c-mostrar-stock').checked = cfg.mostrarStock;
  pintarPreguntas();
  pintarRegistro();
}

function abrirPanel() {
  pintarPanel();
  panel.showModal();
}

function aplicarCambios({ repintarPreguntas = false } = {}) {
  guardarCfg();
  aplicarIdentidad();
  if (!ronda) pintarInicio(); else actualizarPie();
  if (repintarPreguntas) pintarPreguntas();
}

/* ---------- Exportación ---------- */

function textoCSV() {
  const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const filas = registro.map((r) => {
    const d = new Date(r.fecha);
    return [d.toLocaleDateString('es'), d.toLocaleTimeString('es'), r.nombre, r.contacto,
      `${r.aciertos} de ${r.total}`, r.entregado ? 'Sí' : 'No'].map(celda).join(';');
  });
  const titulos = ['Fecha', 'Hora', 'Participante', 'Contacto', 'Aciertos', 'Premio entregado'];
  return [titulos.map(celda).join(';'), ...filas].join('\r\n');
}

function exportar() {
  if (!registro.length) { avisar('No hay participantes para exportar'); return; }
  $('#export-texto').value = textoCSV();
  $('#capa-export').hidden = false;
  $('#export-texto').select();
}

/* ---------- Eventos del juego ---------- */

$('#empezar').addEventListener('click', iniciarRonda);
$('#siguiente').addEventListener('click', siguienteVisitante);
$('#ver-respuesta').addEventListener('click', () => {
  const caja = $('#respuesta');
  caja.hidden = !caja.hidden;
});

$('#juez').addEventListener('click', (ev) => {
  const v = ev.target.closest('[data-juez]')?.dataset.juez;
  if (v) responder(v === 'si');
});

$('#opciones').addEventListener('click', (ev) => {
  const boton = ev.target.closest('.opcion');
  if (!boton || esperando) return;
  const correcta = boton.dataset.correcta === '1';
  $$('#opciones .opcion').forEach((b) => {
    b.disabled = true;
    if (b.dataset.correcta === '1') b.classList.add('es-bien');
  });
  if (!correcta) boton.classList.add('es-mal');
  responder(correcta);
});

$('#form-datos').addEventListener('submit', (ev) => {
  ev.preventDefault();
  participante = { nombre: $('#p-nombre').value.trim(), contacto: $('#p-contacto').value.trim() };
  $('#capa-datos').hidden = true;
  $('#form-datos').reset();
  iniciarRonda();
});

document.addEventListener('click', (ev) => {
  const cerrar = ev.target.closest('[data-cerrar]');
  if (!cerrar) return;
  $('#' + cerrar.dataset.cerrar).hidden = true;
  $('#form-datos').reset();
});

// Acceso al panel: presión larga en la marca, o tecla A
let tempPresion;
const marca = $('#marca');
marca.addEventListener('pointerdown', () => {
  clearTimeout(tempPresion);
  tempPresion = setTimeout(abrirPanel, 900);
});
['pointerup', 'pointerleave', 'pointercancel'].forEach((e) =>
  marca.addEventListener(e, () => clearTimeout(tempPresion)));

document.addEventListener('keydown', (ev) => {
  const escribiendo = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
  if (panelAbierto() || escribiendo) return;

  if (ev.key === 'a' || ev.key === 'A') return abrirPanel();

  const enPregunta = !$('#p-pregunta').hidden;
  const juezVisible = !$('#juez').hidden;

  if (enPregunta && juezVisible) {
    if (ev.key === 'c' || ev.key === 'C') return responder(true);
    if (ev.key === 'x' || ev.key === 'X') return responder(false);
  }
  if (ev.code === 'Space' || ev.key === 'Enter') {
    if (!$('#p-inicio').hidden) { ev.preventDefault(); iniciarRonda(); }
    else if (!$('#p-resultado').hidden) { ev.preventDefault(); siguienteVisitante(); }
  }
});

/* ---------- Eventos del panel ---------- */

$('#panel-cerrar').addEventListener('click', () => panel.close());

$('#c-marca').addEventListener('input', (e) => { cfg.marca = e.target.value; aplicarCambios(); });
$('#c-titulo').addEventListener('input', (e) => { cfg.titulo = e.target.value; aplicarCambios(); });
$('#c-acento').addEventListener('input', (e) => { cfg.acento = e.target.value; aplicarCambios(); });
$('#c-acento2').addEventListener('input', (e) => { cfg.acento2 = e.target.value; aplicarCambios(); });
$('#c-premio').addEventListener('input', (e) => { cfg.premio = e.target.value.trim() || 'premio'; aplicarCambios(); });
$('#c-stock').addEventListener('input', (e) => {
  cfg.stock = Math.max(0, parseInt(e.target.value, 10) || 0);
  aplicarCambios();
});
$('#c-cuantas').addEventListener('input', (e) => {
  cfg.cuantas = Math.max(1, parseInt(e.target.value, 10) || 1);
  aplicarCambios();
});
$('#c-necesarios').addEventListener('input', (e) => {
  cfg.necesarios = Math.max(1, parseInt(e.target.value, 10) || 1);
  aplicarCambios();
});
$('#c-pedir').addEventListener('change', (e) => { cfg.pedirNombre = e.target.checked; guardarCfg(); });
$('#c-sonido').addEventListener('change', (e) => { cfg.sonido = e.target.checked; guardarCfg(); });
$('#c-confeti').addEventListener('change', (e) => { cfg.confeti = e.target.checked; guardarCfg(); });
$('#c-mezclar').addEventListener('change', (e) => { cfg.mezclar = e.target.checked; guardarCfg(); });
$('#c-mostrar-stock').addEventListener('change', (e) => { cfg.mostrarStock = e.target.checked; aplicarCambios(); });

$('#lista-preguntas').addEventListener('input', (ev) => {
  const ficha = ev.target.closest('.ficha-pregunta');
  const clave = ev.target.dataset.k;
  if (!ficha || !clave) return;
  const p = cfg.preguntas.find((x) => x.id === ficha.dataset.id);
  if (!p) return;
  p[clave] = ev.target.value;
  guardarCfg();
  if (!ronda) pintarInicio();
  // El rótulo dice si la pregunta la juzga el operador o el propio juego
  if (clave === 'opciones') {
    const opciones = parsearOpciones(p.opciones);
    const indice = cfg.preguntas.indexOf(p) + 1;
    ficha.querySelector('.ficha-cabecera span').textContent =
      `Pregunta ${indice} · ${opciones.length ? `${opciones.length} opciones en pantalla` : 'la juzgas tú'}`;
  }
});

$('#c-agregar').addEventListener('click', () => {
  cfg.preguntas.push({ id: uid(), texto: '', respuesta: '', opciones: '' });
  guardarCfg();
  pintarPreguntas();
  $('#lista-preguntas .ficha-pregunta:last-child input')?.focus();
});

$('#lista-preguntas').addEventListener('click', (ev) => {
  const id = ev.target.closest('[data-quitar]')?.dataset.quitar;
  if (!id) return;
  if (cfg.preguntas.length === 1) { avisar('Debe quedar al menos una pregunta'); return; }
  cfg.preguntas = cfg.preguntas.filter((p) => p.id !== id);
  guardarCfg();
  pintarPreguntas();
  if (!ronda) pintarInicio();
});

$('#c-logo').addEventListener('change', (ev) => {
  const archivo = ev.target.files?.[0];
  if (!archivo) return;
  if (archivo.size > 500 * 1024) { avisar('El logo supera los 500 KB'); ev.target.value = ''; return; }
  const lector = new FileReader();
  lector.onload = () => { cfg.logo = String(lector.result); aplicarCambios(); avisar('Logo cargado'); };
  lector.readAsDataURL(archivo);
});

$('#c-logo-quitar').addEventListener('click', () => {
  cfg.logo = '';
  $('#c-logo').value = '';
  aplicarCambios();
});

$('#c-pantalla').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    avisar('Si la trivia está dentro de otra página, ábrela en una pestaña aparte. En una notebook también sirve F11.');
  }
});

$('#c-csv').addEventListener('click', exportar);

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
  descargar(`trivia-participantes-${new Date().toISOString().slice(0, 10)}.csv`,
    '﻿' + textoCSV(), 'text/csv;charset=utf-8');
});

$('#c-borrar-log').addEventListener('click', () => {
  if (!confirm('¿Borrar el registro de participantes? El stock del premio no cambia.')) return;
  registro = [];
  guardarLog();
  pintarRegistro();
  actualizarPie();
  avisar('Registro borrado');
});

$('#c-reset').addEventListener('click', () => {
  if (!confirm('Se restablecen las preguntas, el premio, los colores y el registro a los valores iniciales. ¿Continuar?')) return;
  try { localStorage.removeItem(CFG_KEY); localStorage.removeItem(LOG_KEY); } catch {}
  cfg = CFG_BASE();
  registro = [];
  participante = null;
  ronda = null;
  guardarCfg();
  guardarLog();
  pintarPanel();
  aplicarIdentidad();
  pintarInicio();
  avisar('Configuración restablecida');
});

/* ---------- Arranque ---------- */

const embebida = window.self !== window.top;

(function iniciar() {
  if (embebida) $('#export-descargar').hidden = true;
  aplicarIdentidad();
  pintarInicio();
})();
