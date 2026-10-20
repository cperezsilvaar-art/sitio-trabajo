/**
 * Codigo.gs — el buzón de los reclamos de los gerentes.
 *
 * Esto es lo único del proyecto que no vive en el navegador del coordinador.
 * Existe porque él pidió algo que una página sola no puede dar: que el gerente
 * apriete «Enviar a RRHH» y el reclamo le llegue al panel sin que nadie copie
 * ni pegue nada. Para eso hace falta un lugar donde el dato caiga, y este es el
 * único que está **adentro de la empresa**: Apps Script corre en el Google
 * Workspace de Farmatodo y la planilla es del coordinador. Ningún tercero.
 *
 * ──────────────────────────────────────────────────────────────────────────
 *  Por qué todo pasa por `doGet` y con `callback`, incluso lo que escribe
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Parece raro que **guardar** un reclamo sea un GET. Lo es, y es a propósito.
 *
 * Apps Script no contesta las consultas previas que el navegador manda antes de
 * un POST con JSON (el «preflight» de CORS), así que ese POST falla antes de
 * salir. Se puede esquivar mandando el POST como texto plano, pero entonces el
 * navegador **no deja leer la respuesta**: el dato se guardaría y la página no
 * podría decirle al gerente si salió bien. Un botón que no confirma nada es
 * exactamente el problema que esto viene a resolver.
 *
 * La vuelta que sí funciona siempre, sin depender de CORS, es JSONP: la página
 * pide una dirección con `?callback=nombre` y lo que vuelve es una línea de
 * JavaScript que llama a esa función con la respuesta adentro. Un `<script>`
 * no tiene restricción de origen. Es una técnica vieja y por eso es la que
 * anda en cualquier navegador, incluido el del teléfono de un gerente y el
 * visor donde el coordinador abre su panel.
 *
 * ──────────────────────────────────────────────────────────────────────────
 *  Quién puede hacer qué
 * ──────────────────────────────────────────────────────────────────────────
 *
 * - **Guardar** (`accion=guardar`) no pide clave. Tiene que poder hacerlo
 *   cualquier gerente con el link, sin cuenta y sin login — si hubiera que
 *   iniciar sesión, no lo usan.
 * - **Leer** (`accion=traer`) **sí pide la clave**, porque lo que devuelve son
 *   nombres de personas y reclamos de sueldo. Esa clave la conoce solamente el
 *   panel del coordinador. Sin ella, la dirección no entrega nada.
 *
 * Esa asimetría es la que hace que el link del anexo se pueda repartir a doce
 * personas sin que ninguna pueda leer lo que mandaron las otras.
 */

/* ╔══════════════════════════════════════════════════════════════════════╗
   ║  LO ÚNICO QUE HAY QUE TOCAR ANTES DE PUBLICAR                        ║
   ╚══════════════════════════════════════════════════════════════════════╝

   Poné una clave larga e inventada. No tiene que ser recordable: se escribe
   una vez acá y una vez en la build del panel, y nunca más.

   Que sea **larga** (treinta caracteres o más) y que no se parezca a ninguna
   otra que uses: es lo único que separa los reclamos del área de cualquiera
   que adivine la dirección. */
const CLAVE_PARA_LEER = 'PONER-UNA-CLAVE-LARGA-E-INVENTADA-ACA';

/* La hoja donde caen los reclamos. Se crea sola la primera vez. */
const HOJA = 'Reclamos';

/* Las columnas, en orden. El `id` es el que el panel usa para no importar dos
   veces lo mismo, y `tomado` es la marca de que ya lo trajo. */
const COLUMNAS = ['id', 'recibidoEl', 'rama', 'tienda', 'colaborador', 'dni',
                  'motivo', 'periodo', 'monto', 'detalle', 'informa',
                  'fechaDelAviso', 'tomado'];

function doGet(e) {
  const p = (e && e.parameter) || {};
  const callback = String(p.callback || '').replace(/[^A-Za-z0-9_$.]/g, '');

  let salida;
  try {
    if (p.accion === 'guardar')      salida = guardar(p);
    else if (p.accion === 'traer')   salida = traer(p);
    else if (p.accion === 'marcar')  salida = marcar(p);
    else if (p.accion === 'ping')    salida = { ok: true, version: 1 };
    else salida = { ok: false, error: 'No sé qué acción es «' + (p.accion || '') + '».' };
  } catch (err) {
    /* El error se devuelve y no se traga: una página que no sabe que falló le
       dice al gerente que mandó algo que nunca llegó. */
    salida = { ok: false, error: String((err && err.message) || err) };
  }

  const json = JSON.stringify(salida);
  if (!callback) {
    return ContentService.createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(callback + '(' + json + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

/** La hoja, creada con su encabezado si es la primera vez. */
function hoja_() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let h = libro.getSheetByName(HOJA);
  if (!h) {
    h = libro.insertSheet(HOJA);
    h.appendRow(COLUMNAS);
    h.setFrozenRows(1);
  }
  return h;
}

/**
 * Guarda un reclamo. No pide clave: lo manda un gerente con el link.
 *
 * **No duplica.** Dos toques al botón, o un teléfono con mala señal que
 * reintenta, no tienen que dejar dos reclamos: si ya hay uno de la misma
 * persona, la misma tienda y el mismo motivo en los últimos diez minutos, se
 * devuelve el que ya estaba. El gerente ve «enviado» las dos veces, que es lo
 * correcto —su reclamo está—, y el coordinador recibe uno.
 */
function guardar(p) {
  const colaborador = String(p.colaborador || '').trim();
  if (!colaborador) return { ok: false, error: 'Falta el nombre del colaborador.' };
  const tienda = String(p.tienda || '').trim();
  if (!tienda) return { ok: false, error: 'Falta la tienda.' };

  /* Un candado mientras se escribe: dos gerentes mandando al mismo tiempo
     podrían quedar los dos en la misma fila. */
  const candado = LockService.getScriptLock();
  candado.waitLock(20000);
  try {
    const h = hoja_();
    const ahora = new Date();
    const filas = h.getDataRange().getValues();
    const col = {};
    COLUMNAS.forEach(function (c, i) { col[c] = i; });

    for (let i = filas.length - 1; i >= 1; i--) {
      const f = filas[i];
      const cuando = new Date(f[col.recibidoEl]);
      if (isNaN(cuando.getTime()) || ahora - cuando > 10 * 60 * 1000) break;
      if (String(f[col.colaborador]).trim().toLowerCase() === colaborador.toLowerCase() &&
          String(f[col.tienda]).trim().toLowerCase() === tienda.toLowerCase() &&
          String(f[col.motivo]).trim() === String(p.motivo || '').trim()) {
        return { ok: true, id: f[col.id], repetido: true };
      }
    }

    const id = Utilities.getUuid();
    h.appendRow([
      id, ahora.toISOString(), String(p.rama || 'RECLAMO'), tienda, colaborador,
      String(p.dni || '').trim(), String(p.motivo || '').trim(),
      String(p.periodo || '').trim(), String(p.monto || '').trim(),
      String(p.detalle || '').trim(), String(p.informa || '').trim(),
      String(p.fecha || '').trim(), ''
    ]);
    return { ok: true, id: id, repetido: false };
  } finally {
    candado.releaseLock();
  }
}

/**
 * Devuelve los reclamos que el panel todavía no trajo. **Pide la clave.**
 *
 * No los marca como tomados acá: eso lo hace `marcar()` recién cuando el panel
 * confirma que los guardó. Si se marcaran al entregarlos, una pestaña que se
 * cierra en el medio se llevaría los reclamos a la nada.
 */
function traer(p) {
  if (String(p.clave || '') !== CLAVE_PARA_LEER) {
    return { ok: false, error: 'Clave incorrecta.' };
  }
  const h = hoja_();
  const filas = h.getDataRange().getValues();
  const col = {};
  COLUMNAS.forEach(function (c, i) { col[c] = i; });

  const pendientes = [];
  for (let i = 1; i < filas.length; i++) {
    const f = filas[i];
    if (String(f[col.tomado] || '').trim()) continue;
    const o = {};
    COLUMNAS.forEach(function (c) {
      if (c === 'tomado') return;
      o[c] = f[col[c]] instanceof Date ? f[col[c]].toISOString() : String(f[col[c]] || '');
    });
    pendientes.push(o);
  }
  return { ok: true, reclamos: pendientes, total: filas.length - 1 };
}

/** Marca como tomados los ids que el panel ya guardó. Pide la clave. */
function marcar(p) {
  if (String(p.clave || '') !== CLAVE_PARA_LEER) {
    return { ok: false, error: 'Clave incorrecta.' };
  }
  const ids = String(p.ids || '').split(',').map(function (x) { return x.trim(); })
    .filter(Boolean);
  if (!ids.length) return { ok: true, marcados: 0 };

  const candado = LockService.getScriptLock();
  candado.waitLock(20000);
  try {
    const h = hoja_();
    const filas = h.getDataRange().getValues();
    const col = {};
    COLUMNAS.forEach(function (c, i) { col[c] = i; });
    const ahora = new Date().toISOString();
    let n = 0;
    for (let i = 1; i < filas.length; i++) {
      if (ids.indexOf(String(filas[i][col.id])) < 0) continue;
      if (String(filas[i][col.tomado] || '').trim()) continue;
      h.getRange(i + 1, col.tomado + 1).setValue(ahora);
      n++;
    }
    return { ok: true, marcados: n };
  } finally {
    candado.releaseLock();
  }
}
