/**
 * Parte diario de asistencia — Área 3 · Farmatodo
 *
 * Un solo archivo. Al publicarlo como aplicación web queda un link de internet
 * que las sucursales abren desde el celular sin iniciar sesión: cargan las
 * ausencias del día y las horas extras del día anterior, y todo se guarda en
 * esta misma planilla.
 *
 * El mismo link con ?datos=json al final devuelve lo cargado, que es lo que
 * importa el Panel de Control de RRHH.
 */

var HOJA = 'partes';
var ZONA = 'America/Argentina/Buenos_Aires';

var SUCURSALES = [
  'Botánico', 'Devoto', 'La Nobleza', 'Mark', 'Olivos', 'Olleros',
  'Parque Chacabuco', 'Rivadavia', 'Scalabrini', 'San Martín Center',
  'Villa del Parque', 'Villa Devoto'
];

var TURNOS = [
  { id: 'manana',     nombre: 'Mañana 08-16' },
  { id: 'intermedio', nombre: 'Intermedio 10-19' },
  { id: 'noche',      nombre: 'Noche 16-cierre' }
];

var MOTIVOS = [
  { id: 'enfermedad', nombre: 'Enfermedad' },
  { id: 'accidente',  nombre: 'Accidente o ART' },
  { id: 'famEnfermo', nombre: 'Enfermedad de familiar' },
  { id: 'tramite',    nombre: 'Trámite personal' },
  { id: 'estudio',    nombre: 'Estudio o examen' },
  { id: 'personal',   nombre: 'Tema personal' },
  { id: 'transporte', nombre: 'Problema de transporte' },
  { id: 'sinAviso',   nombre: 'No se presentó ni avisó' },
  { id: 'licencia',   nombre: 'Licencia (vacaciones, matrimonio, etc.)' },
  { id: 'suspension', nombre: 'Suspensión' },
  { id: 'otro',       nombre: 'Otro' }
];

var AVISOS = [
  { id: 'previo',   nombre: 'Avisó con anticipación' },
  { id: 'mismoDia', nombre: 'Avisó el mismo día' },
  { id: 'tarde',    nombre: 'Avisó después de su horario' },
  { id: 'no',       nombre: 'No avisó' }
];

var MOTIVOS_HORAS = [
  { id: 'afluencia',     nombre: 'Afluencia de público' },
  { id: 'ausencia',      nombre: 'Cubrir una ausencia' },
  { id: 'promoBancaria', nombre: 'Promoción bancaria' },
  { id: 'inventario',    nombre: 'Inventario' }
];

/* Una sola hoja para todo. `tipo` distingue la ausencia de la hora extra, y
   `fechaTrabajo` es el día al que se imputa: para las horas, el anterior. */
var COLUMNAS = ['recibido', 'tipo', 'fecha', 'fechaTrabajo', 'sucursal',
                'reportadoPor', 'sinNovedad', 'colaborador', 'posicion',
                'turno', 'motivo', 'aviso', 'quienAviso', 'horaAviso',
                'horas', 'autorizadoPor', 'notas'];

/* ------------------------------ la página ------------------------------ */

/** GET: el formulario, o el JSON para el panel si viene ?datos=json */
function doGet(e) {
  var p = (e && e.parameter) || {};

  if (p.datos === 'json') {
    return ContentService
      .createTextOutput(JSON.stringify(partesJson(p.desde, p.hasta)))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var hoy = new Date();
  var ayer = new Date(hoy.getTime() - 24 * 60 * 60 * 1000);

  /* Los datos se inyectan reemplazando marcadores que ya son JavaScript
     válido, así la página se puede abrir y probar tal cual está escrita. */
  var html = PAGINA
    .replace('/*SUCURSALES*/null',    JSON.stringify(SUCURSALES))
    .replace('/*TURNOS*/null',        JSON.stringify(TURNOS))
    .replace('/*MOTIVOS*/null',       JSON.stringify(MOTIVOS))
    .replace('/*AVISOS*/null',        JSON.stringify(AVISOS))
    .replace('/*MOTIVOS_HORAS*/null', JSON.stringify(MOTIVOS_HORAS))
    .replace('/*HOY*/""',             JSON.stringify(fechaTexto(hoy)))
    .replace('/*AYER*/""',            JSON.stringify(fechaTexto(ayer)))
    .replace('/*SUCURSAL*/""',        JSON.stringify(String(p.sucursal || '')));

  return HtmlService.createHtmlOutput(html)
    .setTitle('Parte diario de asistencia')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ------------------------------- guardar ------------------------------- */

function hoja() {
  var libro = SpreadsheetApp.getActiveSpreadsheet();
  var h = libro.getSheetByName(HOJA);
  if (!h) {
    h = libro.insertSheet(HOJA);
    h.appendRow(COLUMNAS);
    h.setFrozenRows(1);
  }
  return h;
}

/** Lo llama el formulario desde el navegador. */
function guardarParte(datos) {
  var h = hoja();
  var recibido = new Date();
  var fecha = String(datos.fecha || '').slice(0, 10);
  var fechaHoras = String(datos.fechaHoras || '').slice(0, 10) || fecha;
  if (!fecha || !datos.sucursal) throw new Error('Falta la fecha o la sucursal.');

  var ausencias = datos.ausencias || [];
  var horas = datos.horasExtras || [];

  /* Una fila por evento, en el orden que declara COLUMNAS. */
  function fila(tipo, fechaTrabajo, extra) {
    var f = {
      recibido: recibido, tipo: tipo, fecha: fecha, fechaTrabajo: fechaTrabajo,
      sucursal: datos.sucursal, reportadoPor: datos.reportadoPor || '',
      sinNovedad: '', colaborador: '', posicion: '', turno: '', motivo: '',
      aviso: '', quienAviso: '', horaAviso: '', horas: '', autorizadoPor: '', notas: ''
    };
    for (var k in extra) f[k] = extra[k];
    return COLUMNAS.map(function (c) { return f[c]; });
  }

  var filas = [];

  if (datos.sinNovedad || !ausencias.length) {
    filas.push(fila('ausencia', fecha, { sinNovedad: 'si' }));
  } else {
    ausencias.forEach(function (a) {
      filas.push(fila('ausencia', fecha, {
        colaborador: a.colaborador || '', posicion: a.posicion || '',
        turno: a.turno || '', motivo: a.motivo || '', aviso: a.aviso || '',
        quienAviso: a.quienAviso || '', horaAviso: a.horaAviso || ''
      }));
    });
  }

  horas.forEach(function (x) {
    if (!x.colaborador || !Number(x.horas)) return;
    filas.push(fila('horas', fechaHoras, {
      colaborador: x.colaborador, posicion: x.posicion || '',
      horas: Number(x.horas), motivo: x.motivo || 'afluencia',
      autorizadoPor: x.autorizadoPor || ''
    }));
  });

  h.getRange(h.getLastRow() + 1, 1, filas.length, COLUMNAS.length).setValues(filas);

  var dicho = [(datos.sinNovedad || !ausencias.length)
    ? 'equipo completo'
    : ausencias.length + ' ausencia(s)'];
  if (horas.length) dicho.push(horas.length + ' persona(s) con horas extras');
  return 'Parte cargado: ' + dicho.join(' y ') + '.';
}

/* -------------------------------- leer --------------------------------- */

/** Agrupa por sucursal y día, como lo espera el panel. */
function partesJson(desde, hasta) {
  var filas = hoja().getDataRange().getValues();
  if (filas.length < 2) return { partes: [] };

  var enc = filas[0].map(function (x) { return String(x).trim(); });
  var col = {};
  COLUMNAS.forEach(function (c) { col[c] = enc.indexOf(c); });

  var porClave = {};
  var orden = [];

  function bloque(suc, fecha) {
    var k = suc + '|' + fecha;
    if (!porClave[k]) {
      porClave[k] = { sucursal: suc, fecha: fecha, reportadoPor: '',
                      sinNovedad: false, ausencias: [], horasExtras: [] };
      orden.push(k);
    }
    return porClave[k];
  }

  filas.slice(1).forEach(function (f) {
    var suc = String(f[col.sucursal] || '').trim();
    if (!suc) return;

    /* Las horas se imputan al día trabajado, no al día en que se reportaron. */
    var tipo = String(f[col.tipo] || 'ausencia');
    var fecha = fechaTexto(f[col.fechaTrabajo]) || fechaTexto(f[col.fecha]);
    if (!fecha) return;
    if (desde && fecha < desde) return;
    if (hasta && fecha > hasta) return;

    var p = bloque(suc, fecha);
    if (f[col.reportadoPor]) p.reportadoPor = String(f[col.reportadoPor]);

    var colaborador = String(f[col.colaborador] || '').trim();

    if (tipo === 'horas') {
      if (!colaborador || !Number(f[col.horas])) return;
      p.horasExtras.push({
        colaborador:   colaborador,
        posicion:      String(f[col.posicion] || ''),
        horas:         Number(f[col.horas]),
        motivo:        String(f[col.motivo] || 'afluencia'),
        autorizadoPor: String(f[col.autorizadoPor] || '')
      });
      return;
    }

    if (!colaborador) { p.sinNovedad = true; return; }

    p.sinNovedad = false;
    p.ausencias.push({
      colaborador: colaborador,
      posicion:   String(f[col.posicion] || ''),
      turno:      String(f[col.turno] || 'manana'),
      motivo:     String(f[col.motivo] || 'otro'),
      aviso:      String(f[col.aviso] || 'no'),
      quienAviso: String(f[col.quienAviso] || ''),
      horaAviso:  horaTexto(f[col.horaAviso]),
      notas:      String(f[col.notas] || '')
    });
  });

  return { partes: orden.map(function (k) { return porClave[k]; }) };
}

function fechaTexto(v) {
  if (v instanceof Date) return Utilities.formatDate(v, ZONA, 'yyyy-MM-dd');
  return String(v || '').slice(0, 10);
}

function horaTexto(v) {
  if (v instanceof Date) return Utilities.formatDate(v, ZONA, 'HH:mm');
  return String(v || '');
}

/* ======================================================================= *
 * La página que ven las sucursales. Es texto: doGet le inyecta los datos  *
 * reemplazando los marcadores y la devuelve.                              *
 * ======================================================================= */

var PAGINA = `
<!DOCTYPE html>
<html lang="es">
<head><base target="_top"><meta charset="utf-8">
<title>Parte diario de asistencia</title>
<style>
  :root { --azul:#0b3b72; --rojo:#c8102e; --borde:#d6dbe4; --suave:#5a6473; }
  * { box-sizing:border-box }
  body { margin:0; padding:18px 16px 56px; background:#f4f6fa; color:#16202e;
         font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif }
  .cont { max-width:560px; margin:0 auto }
  h1 { font-size:19px; margin:0 0 2px; color:var(--azul) }
  p.sub { margin:0 0 18px; font-size:13px; color:var(--suave) }
  h2 { font-size:12px; text-transform:uppercase; letter-spacing:.06em;
       color:var(--azul); margin:24px 0 8px }
  .caja { background:#fff; border:1px solid var(--borde); border-radius:12px;
          padding:16px; margin-bottom:12px }
  label { display:block; font-size:12px; font-weight:600; color:var(--suave);
          text-transform:uppercase; letter-spacing:.03em; margin:14px 0 4px }
  label:first-child, .caja > label:first-of-type { margin-top:0 }
  input, select { width:100%; padding:11px 12px; font-size:16px;
          border:1px solid var(--borde); border-radius:8px; background:#fff;
          color:inherit; font-family:inherit }
  input:focus, select:focus { outline:2px solid var(--azul); outline-offset:-1px }
  button { width:100%; padding:14px; font-size:16px; font-weight:600;
           border:0; border-radius:8px; background:var(--azul); color:#fff; cursor:pointer }
  button.sec { background:#fff; color:var(--azul); border:1px solid var(--azul);
               font-weight:500; padding:11px }
  button[disabled] { opacity:.55 }
  .item { border-top:1px solid var(--borde); padding-top:8px; margin-top:16px; position:relative }
  .item:first-child { border-top:0; padding-top:0; margin-top:0 }
  .quitar { position:absolute; top:8px; right:0; width:auto; padding:4px 10px;
            background:transparent; color:var(--rojo); font-size:13px; font-weight:500 }
  .fila { display:flex; gap:10px } .fila > * { flex:1; min-width:0 }
  .switch { display:flex; align-items:center; gap:10px; margin-top:16px;
            font-size:15px; font-weight:500; color:#16202e; cursor:pointer;
            text-transform:none; letter-spacing:0 }
  .switch input { width:20px; height:20px; flex:0 0 auto }
  p.nota { margin:8px 0 0; font-size:12px; color:var(--suave) }
  #estado { margin-top:14px; padding:12px; border-radius:8px; font-size:14px; display:none }
  .ok  { background:#e6f4ea; color:#12633a; display:block !important }
  .mal { background:#fdeaed; color:#a3132a; display:block !important }
</style>
</head>
<body>
<div class="cont">
  <h1>Parte diario de asistencia</h1>
  <p class="sub">Completalo aunque no tengas novedades. Una vez por día y por sucursal.</p>

  <form id="f" novalidate>
    <div class="caja">
      <div class="fila">
        <div><label>Sucursal</label><select id="sucursal"></select></div>
        <div><label>Día</label><input type="date" id="fecha"></div>
      </div>
      <label>Quién reporta</label>
      <input id="reportadoPor" placeholder="Tu nombre">
      <label class="switch"><input type="checkbox" id="sn">
        <span>Sin novedad, el equipo está completo</span></label>
    </div>

    <div id="bloqueAus">
      <h2>Ausencias de hoy</h2>
      <div class="caja"><div id="lista"></div>
        <button type="button" class="sec" id="mas" style="margin-top:14px">+ Agregar una ausencia</button>
      </div>
    </div>

    <h2>Horas extras de ayer</h2>
    <div class="caja">
      <label>Día trabajado</label>
      <input type="date" id="fechaHoras">
      <p class="nota">Se piden con un día de atraso, con el turno ya cerrado.
         Si no hubo horas extras, dejá esta parte vacía.</p>
      <div id="listaH" style="margin-top:16px"></div>
      <button type="button" class="sec" id="masH" style="margin-top:14px">+ Agregar una hora extra</button>
    </div>

    <button type="submit" id="enviar">Enviar el parte</button>
    <div id="estado"></div>
    <button type="button" class="sec" id="otro" hidden style="margin-top:12px">Cargar otro parte</button>
  </form>
</div>

<script>
  var SUCURSALES    = /*SUCURSALES*/null;
  var TURNOS        = /*TURNOS*/null;
  var MOTIVOS       = /*MOTIVOS*/null;
  var AVISOS        = /*AVISOS*/null;
  var MOTIVOS_HORAS = /*MOTIVOS_HORAS*/null;
  var HOY           = /*HOY*/"";
  var AYER          = /*AYER*/"";
  var SUCURSAL      = /*SUCURSAL*/"";

  var $ = function (id) { return document.getElementById(id); };

  function opciones(lista) {
    return lista.map(function (x) {
      return '<option value="' + x.id + '">' + x.nombre + '</option>';
    }).join('');
  }

  /* Arranque: sucursales, fechas y la sucursal preseleccionada si el link la trae. */
  $('sucursal').innerHTML = '<option value="">Elegir…</option>' +
    SUCURSALES.map(function (s) { return '<option>' + s + '</option>'; }).join('');
  if (SUCURSAL) $('sucursal').value = SUCURSAL;
  $('fecha').value = HOY;
  $('fechaHoras').value = AYER;

  var lista = $('lista'), listaH = $('listaH');

  function agregarAusencia() {
    var d = document.createElement('div');
    d.className = 'item';
    d.innerHTML =
      '<button type="button" class="quitar">Quitar</button>' +
      '<label>Colaborador</label><input class="colaborador" placeholder="Apellido y nombre">' +
      '<div class="fila">' +
        '<div><label>Turno</label><select class="turno">' + opciones(TURNOS) + '</select></div>' +
        '<div><label>¿Avisó?</label><select class="aviso">' + opciones(AVISOS) + '</select></div>' +
      '</div>' +
      '<label>Motivo</label><select class="motivo">' + opciones(MOTIVOS) + '</select>' +
      '<div class="fila">' +
        '<div><label>Quién avisó</label><input class="quienAviso" placeholder="El colaborador, un familiar"></div>' +
        '<div><label>Hora del aviso</label><input type="time" class="horaAviso"></div>' +
      '</div>';
    d.querySelector('.quitar').onclick = function () { d.remove(); };
    lista.appendChild(d);
  }

  function agregarHora() {
    var d = document.createElement('div');
    d.className = 'item';
    d.innerHTML =
      '<button type="button" class="quitar">Quitar</button>' +
      '<label>Colaborador</label><input class="colaborador" placeholder="Apellido y nombre">' +
      '<div class="fila">' +
        '<div><label>Horas</label><input type="number" step="0.5" min="0" class="horas" placeholder="Ej. 2"></div>' +
        '<div><label>Autorizó</label><input class="autorizadoPor" placeholder="Quién la autorizó"></div>' +
      '</div>' +
      '<label>Motivo</label><select class="motivo">' + opciones(MOTIVOS_HORAS) + '</select>';
    d.querySelector('.quitar').onclick = function () { d.remove(); };
    listaH.appendChild(d);
  }

  $('mas').onclick = agregarAusencia;
  $('masH').onclick = agregarHora;

  $('otro').onclick = function () { location.reload(); };

  $('sn').onchange = function () {
    $('bloqueAus').style.display = this.checked ? 'none' : '';
  };

  function mostrar(texto, clase) {
    var e = $('estado');
    e.textContent = texto;
    e.className = clase;
  }

  function juntar(caja, campos) {
    return [].map.call(caja.querySelectorAll('.item'), function (d) {
      var o = {};
      campos.forEach(function (c) {
        var el = d.querySelector('.' + c);
        o[c] = el ? el.value : '';
      });
      return o;
    });
  }

  $('f').onsubmit = function (ev) {
    ev.preventDefault();
    var sinNovedad = $('sn').checked;

    if (!$('sucursal').value) return mostrar('Elegí la sucursal.', 'mal');
    if (!$('fecha').value) return mostrar('Falta el día del parte.', 'mal');
    if (!$('reportadoPor').value.trim()) return mostrar('Poné tu nombre en "Quién reporta".', 'mal');

    var ausencias = sinNovedad ? [] :
      juntar(lista, ['colaborador', 'turno', 'aviso', 'motivo', 'quienAviso', 'horaAviso'])
        .filter(function (a) { return a.colaborador.trim(); });

    var horasExtras = juntar(listaH, ['colaborador', 'horas', 'autorizadoPor', 'motivo'])
      .filter(function (h) { return h.colaborador.trim() && Number(h.horas) > 0; });

    if (!sinNovedad && !ausencias.length) {
      return mostrar('Agregá al menos una ausencia, o marcá "sin novedad".', 'mal');
    }
    if (listaH.children.length && !horasExtras.length) {
      return mostrar('En las horas extras falta el nombre o la cantidad de horas.', 'mal');
    }

    var boton = $('enviar');
    boton.disabled = true;
    boton.textContent = 'Enviando…';

    google.script.run
      .withSuccessHandler(function (msg) {
        mostrar(msg + ' Gracias.', 'ok');
        boton.textContent = 'Enviado ✓';
        [].forEach.call(document.querySelectorAll('input, select, button'), function (el) {
          el.disabled = true;
        });
        var otro = $('otro');
        otro.hidden = false;
        otro.disabled = false;
      })
      .withFailureHandler(function (err) {
        mostrar('No se pudo enviar: ' + err.message, 'mal');
        boton.disabled = false;
        boton.textContent = 'Enviar el parte';
      })
      .guardarParte({
        fecha: $('fecha').value,
        fechaHoras: $('fechaHoras').value,
        sucursal: $('sucursal').value,
        reportadoPor: $('reportadoPor').value,
        sinNovedad: sinNovedad,
        ausencias: ausencias,
        horasExtras: horasExtras
      });
  };
</script>
</body>
</html>
`;
