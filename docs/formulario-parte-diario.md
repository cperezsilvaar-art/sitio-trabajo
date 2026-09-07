# El formulario del parte diario

Es la mitad que vive afuera del panel: un link que se pega en el grupo de
WhatsApp de las sucursales, se abre desde el celular, **no pide iniciar sesión**
y tarda menos de un minuto en completarse. Lo que se carga ahí vuelve al panel
por la pestaña *Parte diario*.

Pide dos cosas en la misma pantalla:

1. **Las ausencias de hoy**: quién faltó, de qué turno, por qué y si avisó.
2. **Las horas extras de ayer**: quién las hizo, cuántas y por qué motivo. Se
   piden con un día de atraso a propósito, porque recién con la jornada
   cerrada el gerente sabe cuántas fueron. Así el acumulado del mes se arma
   día a día en lugar de aparecer en la liquidación.

## Cómo funciona el circuito

```
Grupo de WhatsApp ──► link del formulario ──► planilla de Google
                                                     │
                                        (pegar el CSV, o traerlo del endpoint)
                                                     ▼
                                        Panel → Parte diario
                                                     │
                                  ┌──────────────────┴──────────────────┐
                                  ▼                                     ▼
                        presentismo del día                 horas extras acumuladas
                                  │                                     │
                                  ▼                                     ▼
                    Visita → Ausentismo del mes            Visita → FTE y Costo
```

Nadie del panel necesita cuenta de Google: la planilla es tuya y el formulario
se publica como aplicación web abierta.

## Por qué no un Google Forms común

Un Google Form estándar no sabe repetir el bloque "colaborador + motivo +
avisó" cuando hay dos ausencias el mismo día, ni el de "colaborador + horas +
motivo" cuando hubo tres personas con horas extras; y guarda el turno como
texto libre. El script de abajo arma un formulario propio con las listas ya
cerradas —los turnos, los motivos de ausencia, los avisos y los cuatro motivos
de hora extra son exactamente los del panel— y escribe en la planilla con los
identificadores que el panel espera. Eso evita tener que traducir nada a mano.

## Paso a paso

1. Entrá a [sheets.new](https://sheets.new) y creá una planilla. Llamala, por
   ejemplo, **Parte diario Área 3**.
2. Menú **Extensiones → Apps Script**.
3. Borrá lo que haya y pegá el archivo `Codigo.gs` de más abajo.
4. Agregá un archivo HTML: **+ → HTML**, nombralo `form` (sin `.html`), y pegá
   el segundo bloque.
5. **Implementar → Nueva implementación → Aplicación web**.
   - *Ejecutar como*: **Yo**.
   - *Quién tiene acceso*: **Cualquier persona**.
6. Copiá la URL que termina en `/exec`. Esa es la que va al grupo de WhatsApp.
7. En el panel, **Configuración → Link del formulario del parte diario**: pegá
   esa misma URL. Ahí queda armado el mensaje diario que copiás al grupo.
8. Opcional: en **Endpoint para traer los partes**, pegá la misma URL con
   `?datos=json` al final. Con eso aparece el botón *Traer del endpoint* y te
   ahorrás el copiar y pegar.

> Cada vez que edites el script tenés que volver a **Implementar → Administrar
> implementaciones → editar (lápiz) → Versión: nueva**. Si no, el link sigue
> sirviendo la versión vieja.

## `Codigo.gs`

```javascript
/**
 * Parte diario de asistencia — Área 3.
 * Sirve el formulario, guarda en la planilla y devuelve el JSON que importa
 * el Panel de Control de RRHH.
 */

var HOJA = 'partes';

var SUCURSALES = [
  'Botánico', 'Devoto', 'La Nobleza', 'Mark', 'Olivos', 'Olleros',
  'Parque Chacabuco', 'Rivadavia', 'Scalabrini', 'San Martín Center',
  'Villa del Parque', 'Villa Devoto'
];

var TURNOS = [
  { id: 'manana',     nombre: 'Mañana (08 a 16)' },
  { id: 'intermedio', nombre: 'Intermedio (10 a 18/19)' },
  { id: 'noche',      nombre: 'Noche (16 al cierre)' }
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
   `fechaTrabajo` es el día al que se imputa: para las horas es el anterior. */
var COLUMNAS = ['recibido', 'tipo', 'fecha', 'fechaTrabajo', 'sucursal',
                'reportadoPor', 'sinNovedad', 'colaborador', 'posicion',
                'turno', 'motivo', 'aviso', 'quienAviso', 'horaAviso',
                'horas', 'autorizadoPor', 'notas'];

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

/** GET: el formulario, o el JSON para el panel si viene ?datos=json */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.datos === 'json') {
    return ContentService
      .createTextOutput(JSON.stringify(partesJson(p.desde, p.hasta)))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var t = HtmlService.createTemplateFromFile('form');
  t.sucursales = SUCURSALES;
  t.turnos = TURNOS;
  t.motivos = MOTIVOS;
  t.avisos = AVISOS;
  t.motivosHoras = MOTIVOS_HORAS;
  var hoy = new Date();
  var ayer = new Date(hoy.getTime() - 24 * 60 * 60 * 1000);
  t.hoy  = Utilities.formatDate(hoy,  'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
  t.ayer = Utilities.formatDate(ayer, 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
  return t.evaluate()
    .setTitle('Parte diario de asistencia')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
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

  /* Una fila por evento. El orden de las columnas es el de COLUMNAS. */
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

  var partes = [];
  partes.push((datos.sinNovedad || !ausencias.length)
    ? 'equipo completo'
    : ausencias.length + ' ausencia(s)');
  if (horas.length) partes.push(horas.length + ' persona(s) con horas extras');
  return 'Parte cargado: ' + partes.join(' y ') + '.';
}

/** Arma el JSON agrupando por sucursal y día, como lo espera el panel. */
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
  if (v instanceof Date) {
    return Utilities.formatDate(v, 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
  }
  return String(v || '').slice(0, 10);
}

function horaTexto(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, 'America/Argentina/Buenos_Aires', 'HH:mm');
  }
  return String(v || '');
}
```

## `form.html`

```html
<!DOCTYPE html>
<html lang="es">
<head><base target="_top"><meta charset="utf-8">
<style>
  :root { --azul:#0033A0; --rojo:#E4002B; --borde:#d6dbe4; }
  * { box-sizing:border-box }
  body { margin:0; padding:18px 16px 48px; background:#f4f6fa; color:#16202e;
         font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif }
  h1 { font-size:19px; margin:0 0 2px; color:var(--azul) }
  p.sub { margin:0 0 18px; font-size:13px; color:#5a6473 }
  h2 { font-size:13px; text-transform:uppercase; letter-spacing:.05em;
       color:var(--azul); margin:22px 0 8px }
  p.nota { margin:8px 0 0; font-size:12px; color:#5a6473 }
  .caja { background:#fff; border:1px solid var(--borde); border-radius:12px;
          padding:16px; margin-bottom:14px }
  label { display:block; font-size:12px; font-weight:600; color:#5a6473;
          text-transform:uppercase; letter-spacing:.03em; margin:12px 0 4px }
  input, select, textarea { width:100%; padding:11px 12px; font-size:16px;
          border:1px solid var(--borde); border-radius:8px; background:#fff;
          color:inherit; font-family:inherit }
  button { width:100%; padding:14px; font-size:16px; font-weight:600;
           border:0; border-radius:8px; background:var(--azul); color:#fff }
  button.sec { background:#fff; color:var(--azul); border:1px solid var(--azul);
               font-weight:500; padding:11px }
  button[disabled] { opacity:.55 }
  .ausencia { border-top:1px solid var(--borde); padding-top:6px; margin-top:14px;
              position:relative }
  .quitar { position:absolute; top:10px; right:0; width:auto; padding:4px 10px;
            background:transparent; color:var(--rojo); font-size:13px }
  .fila { display:flex; gap:10px } .fila > * { flex:1 }
  .switch { display:flex; align-items:center; gap:10px; margin-top:14px;
            font-size:15px; font-weight:500; color:#16202e }
  .switch input { width:20px; height:20px; flex:0 0 auto }
  #estado { margin-top:14px; padding:12px; border-radius:8px; font-size:14px; display:none }
  .ok { background:#e6f4ea; color:#12633a } .mal { background:#fdeaed; color:#a3132a }
</style>
</head>
<body>
  <h1>Parte diario de asistencia</h1>
  <p class="sub">Completalo aunque no tengas novedades. Se envía una vez por día y por sucursal.</p>

  <form id="f">
    <div class="caja">
      <div class="fila">
        <div><label>Sucursal</label>
          <select name="sucursal" required>
            <option value="">Elegir…</option>
            <? for (var i = 0; i < sucursales.length; i++) { ?>
              <option><?= sucursales[i] ?></option>
            <? } ?>
          </select></div>
        <div><label>Día</label>
          <input type="date" name="fecha" value="<?= hoy ?>" required></div>
      </div>
      <label>Quién reporta</label>
      <input name="reportadoPor" placeholder="Nombre del gerente o encargado" required>

      <div class="switch">
        <input type="checkbox" id="sn"> <span>Sin novedad, el equipo está completo</span>
      </div>
    </div>

    <h2>Ausencias de hoy</h2>
    <div id="lista"></div>
    <div id="masBox" class="caja" style="padding:10px">
      <button type="button" class="sec" id="mas">+ Agregar una ausencia</button>
    </div>

    <h2>Horas extras de ayer</h2>
    <div class="caja" style="padding:12px 16px">
      <label style="margin-top:0">Día trabajado</label>
      <input type="date" name="fechaHoras" value="<?= ayer ?>">
      <p class="nota">Se piden con un día de atraso, con la jornada ya cerrada.
        Si no hubo horas extras, dejalo vacío.</p>
    </div>
    <div id="listaH"></div>
    <div class="caja" style="padding:10px">
      <button type="button" class="sec" id="masH">+ Agregar una hora extra</button>
    </div>

    <button type="submit" id="enviar">Enviar el parte</button>
    <div id="estado"></div>
  </form>

<script>
  var TURNOS  = <?= JSON.stringify(turnos) ?>;
  var MOTIVOS = <?= JSON.stringify(motivos) ?>;
  var AVISOS  = <?= JSON.stringify(avisos) ?>;
  var MOTIVOS_HORAS = <?= JSON.stringify(motivosHoras) ?>;

  function opciones(lista) {
    return lista.map(function (x) {
      return '<option value="' + x.id + '">' + x.nombre + '</option>';
    }).join('');
  }

  var lista = document.getElementById('lista');
  var n = 0;

  function agregar() {
    var d = document.createElement('div');
    d.className = 'caja ausencia';
    d.innerHTML =
      '<button type="button" class="quitar">Quitar</button>' +
      '<label>Colaborador</label><input class="colaborador" placeholder="Apellido y nombre" required>' +
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
    n++;
  }

  document.getElementById('mas').onclick = agregar;

  var listaH = document.getElementById('listaH');

  function agregarHora() {
    var d = document.createElement('div');
    d.className = 'caja ausencia';
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

  document.getElementById('masH').onclick = agregarHora;

  document.getElementById('sn').onchange = function () {
    var sinNovedad = this.checked;
    lista.style.display = sinNovedad ? 'none' : '';
    document.getElementById('masBox').style.display = sinNovedad ? 'none' : '';
    lista.querySelectorAll('input, select').forEach(function (el) { el.disabled = sinNovedad; });
  };

  function mostrar(texto, clase) {
    var e = document.getElementById('estado');
    e.textContent = texto;
    e.className = clase;
    e.style.display = 'block';
  }

  document.getElementById('f').onsubmit = function (ev) {
    ev.preventDefault();
    var f = ev.target;
    var sinNovedad = document.getElementById('sn').checked;

    var ausencias = [].map.call(lista.querySelectorAll('.ausencia'), function (d) {
      var v = function (c) { return d.querySelector('.' + c).value; };
      return { colaborador: v('colaborador'), posicion: '', turno: v('turno'),
               motivo: v('motivo'), aviso: v('aviso'),
               quienAviso: v('quienAviso'), horaAviso: v('horaAviso') };
    }).filter(function (a) { return a.colaborador.trim(); });

    var horasExtras = [].map.call(listaH.querySelectorAll('.ausencia'), function (d) {
      var v = function (c) { return d.querySelector('.' + c).value; };
      return { colaborador: v('colaborador'), posicion: '', horas: v('horas'),
               motivo: v('motivo'), autorizadoPor: v('autorizadoPor') };
    }).filter(function (h) { return h.colaborador.trim() && Number(h.horas) > 0; });

    if (!sinNovedad && !ausencias.length) {
      return mostrar('Agregá al menos una ausencia, o marcá "sin novedad".', 'mal');
    }
    if (listaH.children.length && !horasExtras.length) {
      return mostrar('En las horas extras falta el nombre o la cantidad de horas.', 'mal');
    }

    var boton = document.getElementById('enviar');
    boton.disabled = true;
    boton.textContent = 'Enviando…';

    google.script.run
      .withSuccessHandler(function (msg) {
        mostrar(msg + ' Gracias.', 'ok');
        boton.textContent = 'Enviado ✓';
        f.querySelectorAll('input, select, button').forEach(function (el) { el.disabled = true; });
      })
      .withFailureHandler(function (err) {
        mostrar('No se pudo enviar: ' + err.message, 'mal');
        boton.disabled = false;
        boton.textContent = 'Enviar el parte';
      })
      .guardarParte({
        fecha: f.fecha.value,
        fechaHoras: f.fechaHoras.value,
        sucursal: f.sucursal.value,
        reportadoPor: f.reportadoPor.value,
        sinNovedad: sinNovedad,
        ausencias: sinNovedad ? [] : ausencias,
        horasExtras: horasExtras
      });
  };
</script>
</body>
</html>
```

## Traer los partes al panel

Hay dos caminos y los dos terminan igual:

**Pegar.** En la planilla, *Archivo → Descargar → CSV*, o seleccionar y copiar
las filas. En el panel, *Parte diario → Traer los partes del formulario*, pegar
y **Importar lo pegado**. El panel entiende CSV con encabezados y también el
JSON del script.

**Endpoint.** Si cargaste la URL con `?datos=json` en Configuración, aparece el
botón *Traer del endpoint* y hace lo mismo sin copiar nada. Si el navegador lo
bloquea por seguridad (pasa al abrir el panel como archivo local), el camino de
pegar sigue estando.

En los dos casos la importación es **idempotente**: volver a importar el mismo
día no duplica nada, porque las ausencias se comparan por colaborador y turno y
las horas extras por colaborador y motivo. Y las sucursales que el panel no
reconoce no se descartan en silencio: se listan para que se corrija el nombre.

### Si preferís armar el CSV a mano

El panel lee cualquier planilla con encabezados, separada por coma, punto y
coma o tabulación. Reconoce estas columnas —el orden no importa, y las que
falten se dan por vacías:

| Columna | Para qué |
|---|---|
| `Fecha` | Día del parte. Obligatoria. |
| `Sucursal` | Nombre o código de la tienda. Obligatoria. |
| `Reporta` | Quién manda el parte. |
| `Colaborador` | Vacío en la fila = *sin novedad* ese día. |
| `Posicion` | Puesto, opcional. |
| `Turno` | Mañana, Intermedio o Noche. |
| `Motivo` | El motivo de la ausencia, o el de la hora extra si la fila trae horas. |
| `Aviso` | Avisó con anticipación / el mismo día / después de su horario / No avisó. |
| `QuienAviso`, `Hora` | Quién avisó y a qué hora. |
| `Horas` | **Si trae un número mayor que cero, la fila es una hora extra**, no una ausencia. |
| `FechaHoras` | Día trabajado al que se imputan esas horas. Si falta, se usa `Fecha`. |
| `AutorizadoPor` | Quién autorizó la hora extra. |

Los nombres se comparan sin acentos ni mayúsculas, y los valores de turno,
motivo y aviso se aceptan tanto por su nombre visible como por su
identificador.

## Qué alimenta

- **Presentismo del día** (panel de la red y pestaña *Parte diario*): ausentes
  contra la dotación esperada de cada turno. Esa dotación se carga una sola vez
  por sucursal, en la ficha de *Sucursales*.
- **Ausentismo del mes** de la visita: el acumulado de días-persona del período,
  que aparece como control cruzado junto a la carga manual.
- **Ausencias sin aviso**: el corte que separa lo gestionable de la licencia, y
  el que se sigue en la reunión con el gerente.
- **Horas extras acumuladas del mes**, por sucursal y para toda el área, con la
  apertura por motivo, el equivalente en FTE y la proyección de cierre al ritmo
  de los días ya cargados.
- La misma acumulación aparece como **control cruzado en la solapa *FTE y
  Costo*** de la visita: si lo que se cargó día a día no coincide con las horas
  de la matriz, el panel lo dice y muestra la diferencia. Y queda en el reporte
  al Gerente de Operaciones.

## Los cuatro motivos de hora extra

La lista es cerrada: **afluencia de público**, **cubrir una ausencia**,
**promoción bancaria** e **inventario**. No hay opción "otro", y es a propósito:
si todo cae en una bolsa genérica, el acumulado no dice nada y no se puede
decidir sobre él. Las cuatro son las causas reales del área, y cada una lleva a
una conversación distinta —dotación, ausentismo, calendario comercial o
planificación—, que es lo que hace útil el corte.

Un caso que conviene mirar: las horas cargadas como *cubrir una ausencia* son
la traducción en pesos del ausentismo de esa misma sucursal. Cuando ese motivo
es el que manda, el problema no son las horas.

## Los turnos

El formulario ofrece los tres turnos del área: **mañana 08 a 16**, **intermedio
10 a 18/19** y **noche 16 al cierre**. El horario exacto del turno noche y la
dotación de cada uno son propios de cada sucursal y se editan en el panel
(*Sucursales → ficha → Turnos*): el panel los deriva del horario de atención
como punto de partida, y las tiendas que solo abren de 10 a 18 —Parque
Chacabuco y Villa Devoto— quedan con un único turno activo.
