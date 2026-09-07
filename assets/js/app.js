/*
 * app.js — Interfaz y ruteo del tablero.
 *
 * Ruteo por hash:
 *   #/red                      panel consolidado de la red
 *   #/sucursales               alta, renombrado y baja de sucursales
 *   #/config                   parámetros de cálculo y destinatarios
 *   #/visita/<id>/<pestaña>    ficha de una visita
 */

const App = (() => {
  let contexto = null;          // objeto que editan los campos con data-path
  let vistaActual = null;       // función de re-render de la vista en curso
  let temporizador = null;

  /* --------------------------- utilidades --------------------------- */
  const $ = sel => document.querySelector(sel);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function setPath(obj, path, valor) {
    const partes = path.split('.');
    let ref = obj;
    for (let i = 0; i < partes.length - 1; i++) {
      if (ref[partes[i]] === undefined || ref[partes[i]] === null) ref[partes[i]] = {};
      ref = ref[partes[i]];
    }
    ref[partes[partes.length - 1]] = valor;
  }

  function getPath(obj, path) {
    return path.split('.').reduce((r, k) => (r === undefined || r === null ? r : r[k]), obj);
  }

  function guardarDiferido() {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => Store.save(), 400);
  }

  const moneda = () => Store.get().config.parametros.moneda || '$';
  const dinero = n => fmtMoneda(n, moneda());

  function chipSemaforo(s) {
    const clase = { ampliar: 'verde', optima: 'verde', revisar: 'ambar', reducir: 'rojo', sd: '' }[s.clave] || '';
    return `<span class="chip ${clase}">${s.icono} ${esc(s.texto)}</span>`;
  }

  /* --------------------- confirmación y avisos ---------------------- *
     El visor de la página publicada bloquea confirm() y alert(): devuelven
     false o no muestran nada. El tablero dibuja los suyos para que las
     acciones destructivas se puedan completar en cualquier entorno. */
  function avisar(mensaje, tipo) {
    let cont = document.querySelector('.avisos');
    if (!cont) {
      cont = document.createElement('div');
      cont.className = 'avisos';
      document.body.appendChild(cont);
    }
    const el = document.createElement('div');
    el.className = 'aviso-flotante' + (tipo === 'error' ? ' error' : '');
    el.textContent = mensaje;
    cont.appendChild(el);
    setTimeout(() => el.remove(), tipo === 'error' ? 7000 : 4000);
  }

  function confirmar(titulo, mensaje, textoConfirmar) {
    return new Promise(resolve => {
      const velo = document.createElement('div');
      velo.className = 'velo';
      velo.innerHTML = `<div class="dialogo" role="dialog" aria-modal="true">
        <h3>${esc(titulo)}</h3>
        <p>${esc(mensaje)}</p>
        <div class="acciones">
          <button class="b sec" data-r="0">Cancelar</button>
          <button class="b peligro" data-r="1">${esc(textoConfirmar || 'Borrar')}</button>
        </div>
      </div>`;
      const cerrar = valor => { velo.remove(); document.removeEventListener('keydown', tecla); resolve(valor); };
      const tecla = ev => { if (ev.key === 'Escape') cerrar(false); };
      velo.addEventListener('click', ev => {
        const btn = ev.target.closest('[data-r]');
        if (btn) return cerrar(btn.dataset.r === '1');
        if (ev.target === velo) cerrar(false);
      });
      document.addEventListener('keydown', tecla);
      document.body.appendChild(velo);
      velo.querySelector('[data-r="1"]').focus();
    });
  }

  /* ------------------------ componentes de campo -------------------- */
  function campo(etiqueta, path, opciones) {
    const o = opciones || {};
    const v = esc(getPath(contexto, path) ?? '');
    const attrs = `data-path="${path}"${o.calc ? ' data-calc="1"' : ''}${o.placeholder ? ` placeholder="${esc(o.placeholder)}"` : ''}`;
    let control;
    if (o.tipo === 'textarea') {
      control = `<textarea ${attrs}${o.alto ? ` style="min-height:${o.alto}px"` : ''}>${v}</textarea>`;
    } else if (o.tipo === 'select') {
      control = `<select ${attrs}>` + (o.opciones || []).map(op =>
        `<option value="${esc(op.valor)}"${String(op.valor) === String(getPath(contexto, path) ?? '') ? ' selected' : ''}>${esc(op.texto)}</option>`).join('') + `</select>`;
    } else if (o.tipo === 'number') {
      control = `<input class="num" type="number" step="${o.step || 'any'}" ${attrs} value="${v}">`;
    } else {
      control = `<input type="${o.tipo || 'text'}" ${attrs} value="${v}">`;
    }
    return `<label class="campo"><span>${esc(etiqueta)}</span>${control}</label>`;
  }

  const hoyISO = () => new Date().toISOString().slice(0, 10);

  /* Acciones sin cumplir de la visita anterior a la misma sucursal. */
  function pendientesAnteriores(v) {
    const previas = Store.visitasDe(v.sucursalId).filter(x => x.id !== v.id && (x.fecha || '') <= (v.fecha || ''));
    const anterior = previas[0];
    if (!anterior) return [];
    const yaEstan = new Set((v.diagnostico.plan || []).map(x => (x.compromiso || '').trim()));
    return (anterior.diagnostico.plan || [])
      .filter(x => x.estado !== 'Cumplido' && (x.compromiso || '').trim() && !yaEstan.has(x.compromiso.trim()));
  }

  function kpi(etiqueta, valor, nota, clase) {
    return `<div class="kpi ${clase || ''}">
      <div class="etiqueta">${esc(etiqueta)}</div>
      <div class="valor">${valor}</div>
      ${nota ? `<div class="nota">${nota}</div>` : ''}
    </div>`;
  }

  /* ============================ VISTA: RED ========================== */
  function vistaRed() {
    const e = Store.get();
    contexto = e.config;

    const filas = e.sucursales.map(s => {
      const v = Store.ultimaVisita(s.id);
      if (!v) return { s, v: null };
      return { s, v, c: Reporte.calcular(v, s, e.config) };
    });

    const conDatos = filas.filter(f => f.c);
    const sum = k => conDatos.reduce((a, f) => a + num(getPath(f.c, k)), 0);
    const headcount = sum('matriz.total.heads');
    const fteVinculo = sum('matriz.total.fteVinculo');
    const fte = sum('matriz.total.fteReal');
    const costo = sum('matriz.total.costoTotal');
    const diasAus = sum('ausentismo.totalDias');
    const diasBase = sum('matriz.total.diasTrabajados');
    const he = sum('matriz.total.horasExtras');
    const ventaRed = conDatos.reduce((a, f) => a + num(f.v.comercial.venta), 0);
    const pctAus = diasBase > 0 ? diasAus / diasBase : null;
    const visitadas = filas.filter(f => f.v).length;
    const enviadas = filas.filter(f => f.v && f.v.envio.enviado).length;

    const html = `
      <h1 class="titulo">${esc(e.config.area || 'Panel de la red')}</h1>
      <p class="subtitulo">Consolidado de la última visita registrada en cada sucursal${e.config.coordinador ? ` · ${esc(e.config.coordinador)}` : ''}.</p>

      <div class="kpis">
        ${kpi('Sucursales a cargo', e.sucursales.length, `${visitadas} con visita registrada`)}
        ${kpi('Headcount', headcount || '—', 'personas en nómina')}
        ${kpi('FTE Real', fte ? fmtNum(fte) : '—', fteVinculo ? `brecha ${fmtNum(fte - fteVinculo)} FTE` : '', fte && fte < fteVinculo - 0.5 ? 'aviso' : '')}
        ${kpi('Costo laboral', costo ? dinero(costo) : '—', fte ? `${dinero(costo / fte)} por FTE` : '')}
        ${kpi('Ausentismo', pctAus === null ? '—' : fmtPct(pctAus), `${diasAus} días`, pctAus !== null && pctAus > e.config.parametros.umbralAusentismo ? 'alerta' : 'ok')}
        ${kpi('Horas extras', he ? fmtNum(he, 0) + ' hs' : '—', he ? `${fmtNum(he / e.config.parametros.horasMes)} FTE equivalentes` : '')}
        ${kpi('Venta neta', ventaRed ? dinero(ventaRed) : '—', costo && ventaRed ? `costo/venta ${fmtPct(costo / ventaRed)}` : '')}
        ${kpi('Reportes enviados', `${enviadas} / ${visitadas}`, 'al Gerente de Operaciones', enviadas < visitadas ? 'aviso' : 'ok')}
      </div>

      <section class="tarjeta">
        <h2>Sucursales</h2>
        <p class="ayuda">Los códigos <em>sucursal1</em>, <em>sucursal2</em>… son provisorios: reemplazalos por el nombre real desde “Sucursales”.</p>
        <div class="tabla-scroll">
        <table>
          <thead><tr>
            <th>Sucursal</th><th>Tipo</th><th>Última visita</th>
            <th class="num">HC</th><th class="num">FTE Real</th><th class="num">Ausent.</th>
            <th class="num">Hs. Ext.</th><th class="num">Costo / FTE</th>
            <th>Dotación</th><th>Reporte</th><th></th>
          </tr></thead>
          <tbody>
          ${e.sucursales.map(({ id }) => {
            const f = filas.find(x => x.s.id === id);
            const s = f.s, v = f.v, c = f.c;
            return `<tr>
              <td><strong>${esc(Store.etiquetaSucursal(s))}</strong>${s.gerente ? `<br><span class="nota" style="font-size:12px;color:var(--texto-suave)">${esc(s.gerente)}</span>` : ''}</td>
              <td class="tipo">${s.tipo === 'staff' ? '🏢 Staff' : '🏪 Venta'}</td>
              <td>${v ? fmtFecha(v.fecha) : '<span class="chip">sin visita</span>'}</td>
              <td class="num">${c ? (c.matriz.total.heads || '—') : '—'}</td>
              <td class="num">${c && c.matriz.total.fteReal ? fmtNum(c.matriz.total.fteReal) : '—'}</td>
              <td class="num">${c && c.ausentismo.pctTotal !== null ? fmtPct(c.ausentismo.pctTotal) : '—'}</td>
              <td class="num">${c && c.matriz.total.horasExtras ? fmtNum(c.matriz.total.horasExtras, 0) : '—'}</td>
              <td class="num">${c && c.matriz.total.costoPorFte ? dinero(c.matriz.total.costoPorFte) : '—'}</td>
              <td>${c ? chipSemaforo(c.dotacion.semaforo) : '—'}</td>
              <td>${v ? (v.envio.enviado ? '<span class="chip verde">enviado</span>' : '<span class="chip ambar">pendiente</span>') : '—'}</td>
              <td class="num">${v
                  ? `<a class="chip azul" href="#/visita/${v.id}/minutas" style="text-decoration:none">Abrir</a>`
                  : `<button class="mini" data-accion="nueva-visita" data-id="${s.id}" style="color:var(--azul);border-color:var(--azul)">Registrar visita</button>`}</td>
            </tr>`;
          }).join('')}
          </tbody>
        </table>
        </div>
      </section>

      ${historialVisitas(e)}
    `;
    return html;
  }

  function historialVisitas(e) {
    const visitas = e.visitas.slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    if (!visitas.length) return '';
    return `<section class="tarjeta">
      <h2>Historial de visitas</h2>
      <div class="tabla-scroll"><table>
        <thead><tr><th>Fecha</th><th>Sucursal</th><th>Período</th><th>Coordinador</th><th>Envío</th><th></th></tr></thead>
        <tbody>${visitas.map(v => {
          const s = Store.sucursal(v.sucursalId);
          return `<tr>
            <td>${fmtFecha(v.fecha)}</td>
            <td>${esc(Store.etiquetaSucursal(s))}</td>
            <td>${esc(v.periodo || '—')}</td>
            <td>${esc(v.coordinador || '—')}</td>
            <td>${v.envio.enviado ? `<span class="chip verde">${esc(v.envio.via)}</span>` : '<span class="chip ambar">pendiente</span>'}</td>
            <td class="num">
              <a class="chip azul" href="#/visita/${v.id}/minutas" style="text-decoration:none">Abrir</a>
              <button class="mini" data-accion="borrar-visita" data-id="${v.id}">Borrar</button>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </section>`;
  }

  /* ======================== VISTA: SUCURSALES ======================= */
  function vistaSucursales() {
    const e = Store.get();
    contexto = e;
    return `
      <h1 class="titulo">Sucursales de ${esc(e.config.area || 'mi área')}</h1>
      <p class="subtitulo">Los códigos provisorios <em>sucursal1…N</em> se mantienen como identificador interno; el campo “Nombre real” es el que aparece en los reportes.
        El email del gerente recibe automáticamente copia del reporte de su sucursal.</p>
      <section class="tarjeta">
        <div class="tabla-scroll"><table>
          <thead><tr><th>Código</th><th>Nombre real</th><th>Tipo</th><th>Gerente de Tienda</th><th>Email del gerente</th><th>Dirección</th><th></th></tr></thead>
          <tbody>
          ${e.sucursales.map((s, i) => `<tr>
            <td><input data-path="sucursales.${i}.codigo" value="${esc(s.codigo)}" style="max-width:120px"></td>
            <td><input data-path="sucursales.${i}.nombre" data-calc="1" value="${esc(s.nombre)}" placeholder="ej. Farmatodo Centro"></td>
            <td><select data-path="sucursales.${i}.tipo" data-calc="1">
              <option value="venta"${s.tipo === 'venta' ? ' selected' : ''}>🏪 Venta</option>
              <option value="staff"${s.tipo === 'staff' ? ' selected' : ''}>🏢 Staff / soporte</option>
            </select></td>
            <td><input data-path="sucursales.${i}.gerente" value="${esc(s.gerente)}"></td>
            <td><input type="email" data-path="sucursales.${i}.emailGerente" data-calc="1" value="${esc(s.emailGerente)}" placeholder="recibe copia del reporte"></td>
            <td><input data-path="sucursales.${i}.direccion" value="${esc(s.direccion)}"></td>
            <td class="num"><button class="mini" data-accion="borrar-sucursal" data-id="${s.id}">Eliminar</button></td>
          </tr>`).join('')}
          </tbody>
        </table></div>
        <div class="acciones">
          <button class="b" data-accion="agregar-sucursal">+ Agregar sucursal</button>
        </div>
      </section>`;
  }

  /* ========================== VISTA: CONFIG ========================= */
  function vistaConfig() {
    const e = Store.get();
    contexto = e.config;
    return `
      <h1 class="titulo">Configuración</h1>
      <p class="subtitulo">Destinatarios de los reportes y parámetros de cálculo.</p>

      <section class="tarjeta">
        <h2>Coordinación y destinatarios</h2>
        <p class="ayuda">El reporte de cada visita se envía al Gerente de Operaciones apenas se cierra la visita.</p>
        <div class="grid c2">
          ${campo('Coordinador de RRHH', 'coordinador', { calc: true, placeholder: 'Tu nombre' })}
          ${campo('Área a cargo', 'area', { calc: true, placeholder: 'ej. Área 3' })}
          ${campo('Gerente de Operaciones', 'gerenteOperaciones.nombre')}
          ${campo('Email del Gerente de Operaciones', 'gerenteOperaciones.email', { tipo: 'email', placeholder: 'nombre@empresa.com' })}
          ${campo('Copias (separadas por coma)', 'copias', { placeholder: 'rrhh@empresa.com, gerencia@empresa.com' })}
        </div>
        <div class="grid" style="margin-top:14px">
          ${campo('Endpoint de envío automático (opcional)', 'webhook', { placeholder: 'https://hook.make.com/... o URL de Google Apps Script' })}
        </div>
        <div class="aviso-caja info">
          <strong>Cómo se envía el reporte.</strong>
          <ul>
            <li><strong>Sin endpoint:</strong> el botón “Enviar al Gerente de Operaciones” abre tu cliente de correo con destinatario, asunto y cuerpo ya cargados. Solo confirmás el envío.</li>
            <li><strong>Con endpoint:</strong> el reporte se envía solo, por <code>POST</code> en JSON, sin intervención. Ver <code>docs/automatizacion-email.md</code> para armarlo con Google Apps Script, Make o Zapier.</li>
          </ul>
        </div>
      </section>

      <section class="tarjeta">
        <h2>Parámetros de cálculo</h2>
        <p class="ayuda">Valores tomados del tablero de dotación. Cambiarlos recalcula todas las visitas.</p>
        <div class="grid c4">
          ${campo('Días del mes (divisor FTE)', 'parametros.diasMes', { tipo: 'number', calc: true })}
          ${campo('Horas del mes (divisor HE)', 'parametros.horasMes', { tipo: 'number', calc: true })}
          ${campo('Factor de cargas sociales', 'parametros.factorCargas', { tipo: 'number', step: '0.01', calc: true })}
          ${campo('Benchmark costo/venta', 'parametros.benchmarkCostoVenta', { tipo: 'number', step: '0.01', calc: true })}
          ${campo('Benchmark staff s/venta red', 'parametros.benchmarkStaff', { tipo: 'number', step: '0.01', calc: true })}
          ${campo('Objetivo tickets/hora', 'parametros.ticketsHoraObjetivo', { tipo: 'number', step: '0.5', calc: true })}
          ${campo('Umbral de ausentismo', 'parametros.umbralAusentismo', { tipo: 'number', step: '0.01', calc: true })}
          ${campo('Umbral de horas extras', 'parametros.umbralHorasExtras', { tipo: 'number', step: '0.01', calc: true })}
          ${campo('Símbolo de moneda', 'parametros.moneda', { calc: true })}
        </div>
      </section>

      <section class="tarjeta">
        <h2>Respaldo de datos</h2>
        <p class="ayuda">La información se guarda solo en este navegador. Exportá un respaldo para llevarla a otro equipo o para archivarla.
          Los datos de ejemplo sirven para recorrer el tablero antes de cargar información real: reemplazan todo el contenido y se limpian con “Borrar todo”.</p>
        <div class="acciones">
          <button class="b sec" data-accion="ejemplo">Cargar datos de ejemplo</button>
          <button class="b sec" data-accion="exportar">Exportar respaldo (.json)</button>
          <button class="b sec" data-accion="importar">Importar respaldo</button>
          <button class="b peligro" data-accion="reiniciar">Borrar todo</button>
          <input type="file" id="archivo-import" accept="application/json" hidden>
        </div>
      </section>`;
  }

  /* ========================== VISTA: VISITA ========================= */
  const PESTANAS = [
    ['minutas',    'Minutas'],
    ['fte',        'FTE y Costo'],
    ['ausentismo', 'Ausentismo'],
    ['rotacion',   'Rotación y Bajas'],
    ['sanciones',  'Sanciones'],
    ['sucesion',   'Sucesión'],
    ['dotacion',   'Dotación vs. Venta'],
    ['reporte',    'Reporte y Envío']
  ];

  function vistaVisita(id, pestana) {
    const e = Store.get();
    const v = Store.visita(id);
    if (!v) return `<p class="vacio">La visita no existe o fue eliminada.</p>`;
    const s = Store.sucursal(v.sucursalId);
    contexto = v;
    const c = Reporte.calcular(v, s, e.config);

    const cuerpo = {
      minutas:    () => panelMinutas(v, s),
      fte:        () => panelFte(v, c),
      ausentismo: () => panelAusentismo(v, c),
      rotacion:   () => panelRotacion(v, c),
      sanciones:  () => panelSanciones(v),
      sucesion:   () => panelSucesion(v, c),
      dotacion:   () => panelDotacion(v, s, c),
      reporte:    () => panelReporte(v, s, e.config, c)
    }[pestana] || (() => panelMinutas(v, s));

    return `
      <h1 class="titulo">${esc(Store.etiquetaSucursal(s))}</h1>
      <p class="subtitulo">${e.config.area ? esc(e.config.area) + ' · ' : ''}Visita del ${fmtFecha(v.fecha)} · período ${esc(v.periodo || '—')} ·
        ${v.envio.enviado ? '<span class="chip verde">reporte enviado</span>' : '<span class="chip ambar">reporte pendiente de envío</span>'}</p>

      <div class="kpis">
        ${kpi('FTE Real', c.matriz.total.fteReal ? fmtNum(c.matriz.total.fteReal) : '—',
              c.matriz.total.diasTrabajados ? `dotación equiv. ${fmtNum(c.matriz.total.fteVinculo)}` : 'sin dotación cargada')}
        ${kpi('Costo / FTE', c.matriz.total.costoPorFte ? dinero(c.matriz.total.costoPorFte) : '—', c.matriz.total.costoTotal ? `total ${dinero(c.matriz.total.costoTotal)}` : '')}
        ${kpi('Ausentismo', c.ausentismo.pctTotal === null ? '—' : fmtPct(c.ausentismo.pctTotal), `${c.ausentismo.totalDias} días`,
              c.ausentismo.pctTotal !== null && c.ausentismo.pctTotal > e.config.parametros.umbralAusentismo ? 'alerta' : 'ok')}
        ${kpi('Horas extras', c.matriz.total.horasExtras ? fmtNum(c.matriz.total.horasExtras, 0) + ' hs' : '—', fmtPct(c.matriz.total.ratioExtras) + ' de las teóricas',
              c.matriz.total.ratioExtras !== null && c.matriz.total.ratioExtras > e.config.parametros.umbralHorasExtras ? 'alerta' : 'ok')}
        ${kpi('Rotación anualizada', c.rotacion.proyeccionAnual === null ? '—' : fmtPct(c.rotacion.proyeccionAnual, 1), `${c.rotacion.bajas} bajas en el mes`)}
      </div>

      <nav class="tabs" style="border-radius:10px;border:1px solid var(--borde);margin-bottom:18px">
        ${PESTANAS.map(([k, t]) => `<a href="#/visita/${v.id}/${k}" class="${k === pestana ? 'activo' : ''}">${t}</a>`).join('')}
      </nav>

      ${cuerpo()}`;
  }

  /* --------------------------- 1. Minutas --------------------------- */
  function panelMinutas(v, s) {
    return `
      <section class="tarjeta">
        <h2>Datos de la visita</h2>
        <div class="grid c4">
          ${campo('Fecha de visita', 'fecha', { tipo: 'date', calc: true })}
          ${campo('Período analizado', 'periodo', { tipo: 'month', calc: true })}
          ${campo('Coordinador de RRHH', 'coordinador')}
          ${campo('Gerente de Tienda', 'minutaGerente.participante', { placeholder: s.gerente || 'Nombre' })}
        </div>
      </section>

      <section class="tarjeta">
        <h2>1. Minuta — Reunión con el Gerente de Tienda</h2>
        <div class="grid c2">
          ${campo('Puntos tratados', 'minutaGerente.puntos', { tipo: 'textarea', alto: 150, placeholder: 'Un punto por línea' })}
          ${campo('Acuerdos y compromisos', 'minutaGerente.acuerdos', { tipo: 'textarea', alto: 150, placeholder: 'Qué se acordó, con qué plazo' })}
        </div>
      </section>

      <section class="tarjeta">
        <h2>Minuta — Reunión con colaborador</h2>
        <div class="grid c2">
          ${campo('Nombre del colaborador', 'minutaColaborador.nombre')}
          ${campo('Posición', 'minutaColaborador.posicion', {
            tipo: 'select',
            opciones: [{ valor: '', texto: '— seleccionar —' }].concat(POSICIONES.map(p => ({ valor: p.nombre, texto: p.nombre })))
          })}
        </div>
        <div style="margin-top:14px">
          ${campo('Feedback y temas de clima laboral', 'minutaColaborador.feedback', { tipo: 'textarea', alto: 140 })}
        </div>
      </section>`;
  }

  /* ------------------------- 2. FTE y costos ------------------------ */
  /* Se separa en dos tablas: la de dotación es la que se completa in situ
     durante la visita, y la de costos la que se cruza después con nómina.
     Juntas no entran en pantalla sin scroll horizontal. */
  function panelFte(v, c) {
    const p = Store.get().config.parametros;
    const inp = (i, campo, ancho, titulo) =>
      `<input class="num" type="number" data-path="posiciones.${i}.${campo}" data-calc="1" ` +
      `value="${esc(v.posiciones[i][campo])}" style="width:${ancho}px"${titulo ? ` title="${esc(titulo)}"` : ''}>`;

    const t = c.matriz.total;

    const filaDotacion = (f, i) => {
      const k = c.matriz.filas[i];
      return `<tr>
        <td><strong>${esc(f.rol)}</strong></td>
        <td class="num">${inp(i, 'heads', 70, 'Personas que estuvieron los ' + p.diasMes + ' días. No incluir acá a quienes ingresaron o egresaron durante el mes.')}</td>
        <td class="num">${inp(i, 'diasAltas', 70, 'Días que alcanzó a trabajar quien ingresó durante el mes')}</td>
        <td class="num">${inp(i, 'diasBajas', 70, 'Días que alcanzó a trabajar quien egresó durante el mes')}</td>
        <td class="num">${inp(i, 'diasAusentes', 70, 'Días de ausencia y vacaciones')}</td>
        <td class="num">${inp(i, 'horasExtras', 80)}</td>
        <td class="num">${fmtNum(k.diasTrabajados, 0)}</td>
        <td class="num">${fmtNum(k.fteVinculo)}</td>
        <td class="num"><strong>${fmtNum(k.fteReal)}</strong></td>
        <td class="num">${k.diasTrabajados ? fmtNum(k.brechaFte) : '—'}</td>
      </tr>`;
    };

    const filaCosto = (f, i) => {
      const k = c.matriz.filas[i];
      return `<tr>
        <td><strong>${esc(f.rol)}</strong></td>
        <td class="num">${fmtNum(k.fteReal)}</td>
        <td class="num">${inp(i, 'sueldoBruto', 120)}</td>
        <td class="num">${inp(i, 'costoHE', 110)}</td>
        <td class="num">${inp(i, 'bonos', 110)}</td>
        <td class="num">${inp(i, 'cargasManual', 110, 'Dejar vacío para calcular con el factor de cargas')}</td>
        <td class="num">${k.cargas ? dinero(k.cargas) : '—'}</td>
        <td class="num">${k.costoTotal ? dinero(k.costoTotal) : '—'}</td>
        <td class="num">${k.costoPorFte ? dinero(k.costoPorFte) : '—'}</td>
      </tr>`;
    };

    return `
      <section class="tarjeta">
        <h2>2.a Dotación y FTE Real</h2>
        <p class="ayuda">
          FTE Real = (días de vínculo ÷ ${p.diasMes}) − (días de ausencia ÷ ${p.diasMes}) + (horas extras ÷ ${p.horasMes}).
        </p>
        <div class="aviso-caja info">
          <strong>Cómo se cargan los ingresos y los egresos.</strong>
          Quien ingresó o egresó durante el mes <strong>no va en “Mes completo”</strong>: va solo con los días que
          efectivamente trabajó. Esos días <em>se suman</em>, porque son trabajo prestado; lo que baja el FTE es que
          sean menos de ${p.diasMes}, no la baja en sí.
          <br><br>
          Ejemplo: 5 APV todo el mes y una sexta persona que renunció el día 25 →
          <strong>Mes completo 5</strong> y <strong>Egresos 25</strong>. Da ${p.diasMes * 5 + 25} días de vínculo,
          es decir ${fmtNum((p.diasMes * 5 + 25) / p.diasMes)} personas equivalentes, no 6.
          Si además cargaras 6 en “Mes completo”, esa persona se contaría dos veces.
          <br><br>
          La columna <strong>Personas equiv.</strong> es el control: tiene que parecerse a la dotación que viste en la tienda.
        </div>
        ${avisoAltasBajas(v, c, p)}
        <div class="tabla-scroll"><table>
          <thead><tr>
            <th>Posición</th><th class="num">Mes completo<br><small style="font-weight:400;text-transform:none">personas</small></th>
            <th class="num">Ingresos<br><small style="font-weight:400;text-transform:none">días trabajados</small></th>
            <th class="num">Egresos<br><small style="font-weight:400;text-transform:none">días trabajados</small></th>
            <th class="num">Ausencias<br><small style="font-weight:400;text-transform:none">días</small></th>
            <th class="num">Hs. extras</th>
            <th class="num">Días de vínculo</th><th class="num">Personas equiv.</th><th class="num">FTE Real</th>
            <th class="num" title="FTE Real menos personas equivalentes: lo que se pierde por ausencias, neto de lo que se recupera con horas extras.">Brecha de cobertura</th>
          </tr></thead>
          <tbody>${v.posiciones.map(filaDotacion).join('')}</tbody>
          <tfoot><tr class="total">
            <td>TOTAL</td>
            <td class="num">${t.heads || '—'}</td>
            <td class="num">${fmtNum(t.diasAltas, 0)}</td>
            <td class="num">${fmtNum(t.diasBajas, 0)}</td>
            <td class="num">${fmtNum(t.diasAusentes, 0)}</td>
            <td class="num">${fmtNum(t.horasExtras, 0)}</td>
            <td class="num">${fmtNum(t.diasTrabajados, 0)}</td>
            <td class="num">${fmtNum(t.diasTrabajados / p.diasMes)}</td>
            <td class="num">${fmtNum(t.fteReal)}</td>
            <td class="num">${t.diasTrabajados ? fmtNum(t.brechaFte) : '—'}</td>
          </tr></tfoot>
        </table></div>

        <div class="aviso-caja info">
          Descomposición del FTE total: vínculo ${fmtNum(t.diasTrabajados / p.diasMes)}
          − ausencias ${fmtNum(t.diasAusentes / p.diasMes)}
          + horas extras ${fmtNum(t.horasExtras / p.horasMes)}
          = <strong>${fmtNum(t.fteReal)} FTE</strong>
          ${t.diasTrabajados ? ` sobre una dotación equivalente de ${fmtNum(t.diasTrabajados / p.diasMes)} personas (brecha de cobertura ${fmtNum(t.brechaFte)} FTE).` : '.'}
        </div>
      </section>

      <section class="tarjeta">
        <h2>2.b Costo laboral por posición</h2>
        <p class="ayuda">
          Las cargas sociales se calculan con factor ${fmtNum(p.factorCargas)} sobre brutos + horas extras + bonos.
          Si tenés el valor real de cargas de una posición, cargalo en su columna y pisa el cálculo automático.
        </p>
        <div class="tabla-scroll"><table>
          <thead><tr>
            <th>Posición</th><th class="num">FTE Real</th><th class="num">Sueldo bruto</th><th class="num">Costo hs. extras</th>
            <th class="num">Bonos / otros</th><th class="num">Cargas a mano</th>
            <th class="num">Cargas aplicadas</th><th class="num">Costo total</th><th class="num">Costo / FTE</th>
          </tr></thead>
          <tbody>${v.posiciones.map(filaCosto).join('')}</tbody>
          <tfoot><tr class="total">
            <td>TOTAL</td>
            <td class="num">${fmtNum(t.fteReal)}</td>
            <td class="num">${t.sueldoBruto ? dinero(t.sueldoBruto) : '—'}</td>
            <td class="num">${t.costoHE ? dinero(t.costoHE) : '—'}</td>
            <td class="num">${t.bonos ? dinero(t.bonos) : '—'}</td>
            <td class="num">—</td>
            <td class="num">${t.cargas ? dinero(t.cargas) : '—'}</td>
            <td class="num">${t.costoTotal ? dinero(t.costoTotal) : '—'}</td>
            <td class="num">${t.costoPorFte ? dinero(t.costoPorFte) : '—'}</td>
          </tr></tfoot>
        </table></div>
      </section>`;
  }

  /* Detecta las dos formas de cargar mal ingresos y egresos: un valor de un mes
     completo o más (esa persona va en “Mes completo”), y días de ausencia que
     superan los días de vínculo de la posición. */
  function avisoAltasBajas(v, c, p) {
    const problemas = [];
    c.matriz.filas.forEach(f => {
      if (f.diasAltas >= p.diasMes) {
        problemas.push(`<strong>${esc(f.rol)}</strong>: ${fmtNum(f.diasAltas, 0)} días de ingreso equivalen a un mes completo o más. ` +
          `Si la persona trabajó los ${p.diasMes} días, contala en “Mes completo”.`);
      }
      if (f.diasBajas >= p.diasMes) {
        problemas.push(`<strong>${esc(f.rol)}</strong>: ${fmtNum(f.diasBajas, 0)} días de egreso equivalen a un mes completo o más. ` +
          `Si la persona trabajó los ${p.diasMes} días antes de irse, contala en “Mes completo”.`);
      }
      if (f.diasAusentes > f.diasTrabajados && f.diasTrabajados > 0) {
        problemas.push(`<strong>${esc(f.rol)}</strong>: hay más días de ausencia (${fmtNum(f.diasAusentes, 0)}) que días de vínculo ` +
          `(${fmtNum(f.diasTrabajados, 0)}). El FTE queda negativo.`);
      }
    });
    if (!problemas.length) return '';
    return `<div class="aviso-caja"><strong>Revisá esta carga.</strong><ul>` +
      problemas.map(x => `<li>${x}</li>`).join('') + `</ul></div>`;
  }

  /* -------------------------- 3. Ausentismo ------------------------- */
  function panelAusentismo(v, c) {
    const base = c.matriz.total.diasTrabajados;
    return `
      <section class="tarjeta">
        <h2>3. Ausentismo por concepto</h2>
        <p class="ayuda">
          Días de ausencia del período, con la apertura del tablero de estadísticas.
          La base de cálculo son los ${fmtNum(base, 0)} días de vínculo que surgen de la matriz de FTE.
          Cargar acá el detalle no modifica el FTE: para eso está la columna “Días ausentes” de la matriz.
        </p>
        ${!base ? '<div class="aviso-caja">Cargá primero el headcount en la solapa <strong>FTE y Costo</strong> para poder calcular porcentajes.</div>' : ''}
        ${avisoDesvioAusentismo(c)}
        ${c.ausentismo.sinApertura ? `<div class="aviso-caja info">
          Todavía no hay apertura por concepto. Mientras tanto, el ausentismo del período se toma de los
          <strong>${fmtNum(c.ausentismo.diasMatriz, 0)}</strong> días cargados en la matriz de FTE.
          Al desagregarlos acá abajo vas a poder separar lo gestionable de lo que no lo es.
        </div>` : ''}

        ${c.ausentismo.grupos.map(g => `
          <h3 style="font-size:14px;margin:18px 0 6px;color:var(--texto)">${esc(g.nombre)}
            <span class="chip">${g.dias} días · ${fmtPct(g.pct)}</span></h3>
          <p class="ayuda" style="margin:0 0 10px">${esc(g.ayuda)}</p>
          <div class="grid c4">
            ${g.conceptos.map(x => campo(`${x.nombre} (${x.cod})`, `ausentismo.detalle.${x.cod}`, { tipo: 'number', calc: true })).join('')}
          </div>`).join('')}

        <div class="kpis" style="margin-top:20px">
          ${kpi('Ausentismo total', fmtPct(c.ausentismo.pctTotal), `${c.ausentismo.totalDias} días`)}
          ${kpi('Días gestionables', c.ausentismo.diasGestionables, fmtPct(c.ausentismo.pctGestionable) + ' de la base', 'aviso')}
          ${kpi('Impacto en FTE', fmtNum(c.ausentismo.totalDias / Store.get().config.parametros.diasMes), 'FTE perdidos por ausencia')}
        </div>
      </section>`;
  }

  /* Advierte cuando el detalle por concepto no cierra contra la matriz de FTE:
     el FTE Real se calcula con la columna de la matriz, no con este detalle. */
  function avisoDesvioAusentismo(c) {
    const detalle = c.ausentismo.diasDetallados;
    const matriz = c.matriz.total.diasAusentes;
    if (!detalle || Math.abs(detalle - matriz) <= 0.5) return '';
    return `<div class="aviso-caja">
      <strong>El detalle no cierra con la matriz de FTE.</strong>
      Acá hay <strong>${fmtNum(detalle, 0)}</strong> días cargados por concepto, pero la columna
      “Días ausentes” de la solapa <em>FTE y Costo</em> suma <strong>${fmtNum(matriz, 0)}</strong>.
      El FTE Real y el costo por FTE se calculan con el dato de la matriz, así que conviene
      igualarlos antes de enviar el reporte.
    </div>`;
  }

  /* ----------------------- 4. Rotación y bajas ---------------------- */
  function panelRotacion(v, c) {
    const r = c.rotacion;
    const movs = v.movimientos || [];
    return `
      <section class="tarjeta">
        <h2>4. Rotación del período</h2>
        <p class="ayuda">Rotación mensual = bajas ÷ dotación promedio. La proyección anual multiplica ese valor por 12, como en el tablero de estadísticas.</p>
        <div class="grid c4">
          ${campo('Dotación anterior', 'rotacion.dotacionAnterior', { tipo: 'number', calc: true })}
          ${campo('Altas externas', 'rotacion.altasExternas', { tipo: 'number', calc: true })}
          ${campo('Altas internas', 'rotacion.altasInternas', { tipo: 'number', calc: true })}
          ${campo('Bajas externas', 'rotacion.bajasExternas', { tipo: 'number', calc: true })}
          ${campo('Bajas internas', 'rotacion.bajasInternas', { tipo: 'number', calc: true })}
        </div>
        <div class="kpis" style="margin-top:18px">
          ${kpi('Nueva dotación', r.nueva || '—', `variación ${fmtPct(r.variacion)}`)}
          ${kpi('Dotación promedio', fmtNum(r.promedio, 1))}
          ${kpi('Rotación del mes', fmtPct(r.mensual))}
          ${kpi('Proyección anual', fmtPct(r.proyeccionAnual, 1), '', r.proyeccionAnual !== null && r.proyeccionAnual > 0.3 ? 'alerta' : 'ok')}
        </div>
      </section>

      <section class="tarjeta">
        <h2>Altas y bajas del período</h2>
        <div class="tabla-scroll"><table>
          <thead><tr><th>Tipo</th><th>Apellido y nombre</th><th>Fecha</th><th>Puesto</th><th>Categoría</th><th>Motivo</th><th>Causa</th><th></th></tr></thead>
          <tbody>
          ${movs.length ? movs.map((m, i) => `<tr>
            <td><select data-path="movimientos.${i}.tipo" data-calc="1">
              <option value="alta"${m.tipo === 'alta' ? ' selected' : ''}>Alta</option>
              <option value="baja"${m.tipo === 'baja' ? ' selected' : ''}>Baja</option>
            </select></td>
            <td><input data-path="movimientos.${i}.nombre" value="${esc(m.nombre)}"></td>
            <td><input type="date" data-path="movimientos.${i}.fecha" value="${esc(m.fecha)}"></td>
            <td><select data-path="movimientos.${i}.puesto">
              <option value="">—</option>
              ${POSICIONES.map(p => `<option value="${esc(p.nombre)}"${m.puesto === p.nombre ? ' selected' : ''}>${esc(p.nombre)}</option>`).join('')}
            </select></td>
            <td><select data-path="movimientos.${i}.categoria" data-calc="1">
              <option value="">—</option>
              ${MOTIVOS_BAJA.map(g => `<option value="${g.id}"${m.categoria === g.id ? ' selected' : ''}>${esc(g.nombre)}</option>`).join('')}
            </select></td>
            <td><select data-path="movimientos.${i}.motivo">
              <option value="">—</option>
              ${MOTIVOS_BAJA.flatMap(g => g.motivos).map(x => `<option value="${esc(x)}"${m.motivo === x ? ' selected' : ''}>${esc(x)}</option>`).join('')}
            </select></td>
            <td><select data-path="movimientos.${i}.causa">
              <option value="">—</option>
              ${CAUSAS_ROTACION.map(x => `<option value="${x.cod}"${m.causa === x.cod ? ' selected' : ''}>${x.cod} · ${esc(x.nombre)}</option>`).join('')}
            </select></td>
            <td class="num"><button class="mini" data-accion="borrar-item" data-arr="movimientos" data-idx="${i}">✕</button></td>
          </tr>`).join('') : '<tr><td colspan="8" class="vacio">Sin movimientos cargados.</td></tr>'}
          </tbody>
        </table></div>
        <div class="acciones"><button class="b sec" data-accion="agregar-movimiento">+ Agregar movimiento</button></div>

        ${c.bajas.total ? `<div class="aviso-caja info">
          Bajas por categoría: ${c.bajas.grupos.map(g => `<strong>${esc(g.nombre)}</strong> ${g.casos} (${fmtPct(g.pct)})`).join(' · ')}
        </div>` : ''}
      </section>`;
  }

  /* --------------------------- 5. Sanciones ------------------------- */
  function panelSanciones(v) {
    const ss = v.sanciones || [];
    const conteo = t => ss.filter(x => x.tipo === t).length;

    return `
      <section class="tarjeta">
        <h2>5. Sanciones disciplinarias</h2>
        <p class="ayuda">
          Registro de las medidas aplicadas en el período: a quién, por qué motivo, quién la aplicó y si
          quedó notificada. La concentración por motivo suele explicar buena parte del ausentismo controlable.
        </p>
        <div class="tabla-scroll"><table>
          <thead><tr>
            <th>Colaborador</th><th>Fecha</th><th>Tipo</th><th>Motivo</th><th>Posición</th>
            <th class="num">Días</th><th>Aplicada por</th><th>Notificada</th><th>Detalle del hecho</th><th></th>
          </tr></thead>
          <tbody>
          ${ss.length ? ss.map((x, i) => `<tr>
            <td><input data-path="sanciones.${i}.nombre" data-calc="1" value="${esc(x.nombre)}" placeholder="Apellido y nombre"></td>
            <td><input type="date" data-path="sanciones.${i}.fecha" value="${esc(x.fecha)}"></td>
            <td><select data-path="sanciones.${i}.tipo" data-calc="1">
              <option value="">—</option>
              ${TIPOS_SANCION.map(t => `<option value="${esc(t)}"${x.tipo === t ? ' selected' : ''}>${esc(t)}</option>`).join('')}
            </select></td>
            <td><select data-path="sanciones.${i}.motivo" data-calc="1">
              <option value="">—</option>
              ${MOTIVOS_SANCION.map(t => `<option value="${esc(t)}"${x.motivo === t ? ' selected' : ''}>${esc(t)}</option>`).join('')}
            </select></td>
            <td><select data-path="sanciones.${i}.puesto">
              <option value="">—</option>
              ${POSICIONES.map(pp => `<option value="${esc(pp.nombre)}"${x.puesto === pp.nombre ? ' selected' : ''}>${esc(pp.nombre)}</option>`).join('')}
            </select></td>
            <td class="num"><input class="num" type="number" data-path="sanciones.${i}.dias" value="${esc(x.dias)}" style="width:60px" title="Días de suspensión, si corresponde"></td>
            <td><input data-path="sanciones.${i}.aplicadaPor" value="${esc(x.aplicadaPor)}" placeholder="Quién la aplicó"></td>
            <td><select data-path="sanciones.${i}.notificada" data-calc="1">
              <option value=""${!x.notificada ? ' selected' : ''}>—</option>
              <option value="si"${x.notificada === 'si' ? ' selected' : ''}>Sí, firmada</option>
              <option value="sinFirma"${x.notificada === 'sinFirma' ? ' selected' : ''}>Notificada sin firma</option>
              <option value="no"${x.notificada === 'no' ? ' selected' : ''}>No</option>
            </select></td>
            <td><textarea data-path="sanciones.${i}.observaciones" style="min-height:56px" placeholder="Qué pasó y qué se le dijo">${esc(x.observaciones)}</textarea></td>
            <td class="num"><button class="mini" data-accion="borrar-item" data-arr="sanciones" data-idx="${i}">✕</button></td>
          </tr>`).join('') : '<tr><td colspan="10" class="vacio">Sin sanciones registradas en el período.</td></tr>'}
          </tbody>
        </table></div>
        <div class="acciones"><button class="b sec" data-accion="agregar-sancion">+ Registrar sanción</button></div>

        ${ss.length ? `<div class="kpis" style="margin-top:18px">
          ${kpi('Total del período', ss.length)}
          ${TIPOS_SANCION.map(t => conteo(t) ? kpi(t, conteo(t)) : '').join('')}
          ${kpi('Sin notificar', ss.filter(x => x.notificada === 'no' || !x.notificada).length, 'revisar la notificación',
                ss.filter(x => x.notificada === 'no' || !x.notificada).length ? 'aviso' : 'ok')}
        </div>` : ''}
      </section>`;
  }

  /* --------------------------- 6. Sucesión -------------------------- */
  function panelSucesion(v, c) {
    const items = c.sucesion.lista;
    const nivel = it => (it.criticidad >= 2.5 ? 3 : it.criticidad >= 1.5 ? 2 : 1);
    const nivelEsc = it => (it.escasez >= 2.5 ? 3 : it.escasez >= 1.5 ? 2 : 1);

    const celda = (crit, esc_) => {
      const dentro = items.filter(it => nivel(it) === crit && nivelEsc(it) === esc_);
      const n = Math.min(3, Math.max(1, Math.round((crit + esc_) / 2)));
      return `<div class="celda n${n}">${dentro.map(it =>
        `<div>${esc(it.posicion)} <span class="chip ${it.riesgo === 'alto' ? 'rojo' : it.riesgo === 'medio' ? 'ambar' : 'verde'}">${it.candidatosTotal} cand.</span></div>`
      ).join('') || ''}</div>`;
    };

    return `
      <section class="tarjeta">
        <h2>6. Posiciones críticas y plan de sucesión</h2>
        <p class="ayuda">Criticidad y escasez en escala 1 a 3, como en el toolkit de sucesión. Una posición se considera crítica con criticidad ≥ 2,5, o ≥ 2 combinada con escasez alta.</p>
        <div class="tabla-scroll"><table>
          <thead><tr><th>Posición</th><th>Titular</th><th class="num">Criticidad</th><th class="num">Escasez</th><th>Se requiere</th><th>Candidatos</th><th></th></tr></thead>
          <tbody>
          ${items.length ? items.map((it, i) => `<tr>
            <td><select data-path="sucesion.${i}.posicion" data-calc="1">
              ${POSICIONES.map(p => `<option value="${esc(p.nombre)}"${it.posicion === p.nombre ? ' selected' : ''}>${esc(p.nombre)}</option>`).join('')}
            </select></td>
            <td><input data-path="sucesion.${i}.incumbent" value="${esc(it.incumbent)}"></td>
            <td class="num"><select data-path="sucesion.${i}.criticidad" data-calc="1">
              ${ESCALA_CRITICIDAD.map(x => `<option value="${x.valor}"${Number(it.criticidad) === x.valor ? ' selected' : ''}>${x.valor} · ${esc(x.nombre)}</option>`).join('')}
            </select></td>
            <td class="num"><select data-path="sucesion.${i}.escasez" data-calc="1">
              ${ESCALA_ESCASEZ.map(x => `<option value="${x.valor}"${Number(it.escasez) === x.valor ? ' selected' : ''}>${x.valor} · ${esc(x.nombre)}</option>`).join('')}
            </select></td>
            <td><select data-path="sucesion.${i}.disponibilidad" data-calc="1">
              ${DISPONIBILIDAD_ROL.map(x => `<option value="${x.id}"${it.disponibilidad === x.id ? ' selected' : ''}>${esc(x.nombre)}</option>`).join('')}
            </select></td>
            <td>
              ${(it.candidatos || []).map((cd, j) => `<div style="display:flex;gap:6px;margin-bottom:4px">
                <input data-path="sucesion.${i}.candidatos.${j}.nombre" value="${esc(cd.nombre)}" placeholder="Nombre">
                <select data-path="sucesion.${i}.candidatos.${j}.readiness" data-calc="1" style="max-width:190px">
                  ${READINESS.map(r => `<option value="${r.id}"${cd.readiness === r.id ? ' selected' : ''}>${esc(r.nombre)}</option>`).join('')}
                </select>
                <button class="mini" data-accion="borrar-candidato" data-idx="${i}" data-jdx="${j}">✕</button>
              </div>`).join('')}
              <button class="mini" data-accion="agregar-candidato" data-idx="${i}" style="color:var(--azul);border-color:var(--azul)">+ candidato</button>
            </td>
            <td class="num"><button class="mini" data-accion="borrar-item" data-arr="sucesion" data-idx="${i}">✕</button></td>
          </tr>`).join('') : '<tr><td colspan="7" class="vacio">Sin posiciones cargadas.</td></tr>'}
          </tbody>
        </table></div>
        <div class="acciones"><button class="b sec" data-accion="agregar-sucesion">+ Agregar posición crítica</button></div>

        <div class="kpis" style="margin-top:18px">
          ${kpi('Posiciones críticas', c.sucesion.posicionesCriticas)}
          ${kpi('Con plan de sucesión', `${c.sucesion.criticasConPlan} / ${c.sucesion.posicionesCriticas}`, '', c.sucesion.criticasConPlan < c.sucesion.posicionesCriticas ? 'alerta' : 'ok')}
          ${kpi('Candidatos por posición crítica', fmtNum(c.sucesion.promedioCandidatos, 1))}
          ${kpi('Listos en menos de 1 año', c.sucesion.candidatosListos)}
        </div>

        ${items.length ? `
        <h3 style="font-size:14px;margin:22px 0 0">Mapa de calor · criticidad × escasez</h3>
        <div class="heat">
          <div></div><div class="cab">Escasez baja</div><div class="cab">Escasez media</div><div class="cab">Escasez alta</div>
          <div class="eje">Criticidad alta</div>${celda(3, 1)}${celda(3, 2)}${celda(3, 3)}
          <div class="eje">Criticidad media</div>${celda(2, 1)}${celda(2, 2)}${celda(2, 3)}
          <div class="eje">Criticidad baja</div>${celda(1, 1)}${celda(1, 2)}${celda(1, 3)}
        </div>` : ''}
      </section>`;
  }

  /* ---------------------- 7. Dotación vs. venta --------------------- */
  function panelDotacion(v, s, c) {
    const d = c.dotacion, p = Store.get().config.parametros;
    return `
      <section class="tarjeta">
        <h2>7. Dotación óptima según venta</h2>
        <p class="ayuda">
          Modelo del tablero de dotación: costo laboral real ÷ venta neta comparado contra el benchmark de ${fmtPct(p.benchmarkCostoVenta, 0)}.
          La dotación óptima surge de repartir el presupuesto teórico (venta × benchmark) entre el costo promedio por empleado.
          ${s.tipo === 'staff' ? 'Esta sucursal está marcada como <strong>staff</strong>: se mide contra la venta de la red, no contra venta propia.' : ''}
        </p>
        <div class="grid c4">
          ${campo('Venta neta del período', 'comercial.venta', { tipo: 'number', calc: true })}
          ${campo('Venta de la red (para staff)', 'comercial.ventaRed', { tipo: 'number', calc: true })}
          ${campo('Tickets del período', 'comercial.tickets', { tipo: 'number', calc: true })}
          ${campo('Horas trabajadas', 'comercial.horasTrabajadas', { tipo: 'number', calc: true })}
        </div>

        <div class="kpis" style="margin-top:18px">
          ${kpi('Costo laboral real', d.costoReal ? dinero(d.costoReal) : '—', `factor de cargas ${p.factorCargas}`)}
          ${kpi('% costo / venta', fmtPct(d.pctCostoVenta), `benchmark ${fmtPct(d.benchmark, 0)}`,
                d.pctCostoVenta !== null && d.pctCostoVenta > d.benchmark ? 'alerta' : 'ok')}
          ${kpi('Dotación actual', c.matriz.total.heads || '—')}
          ${kpi('Dotación óptima', d.dotacionOptima === null ? '—' : d.dotacionOptima,
                d.diferencia === null ? '' : `diferencia ${d.diferencia > 0 ? '+' : ''}${d.diferencia}`)}
          ${d.ahorro === null || d.ahorro === undefined ? '' :
            kpi(d.ahorro >= 0 ? 'Inversión requerida' : 'Ahorro potencial', dinero(Math.abs(d.ahorro)), '',
                d.ahorro >= 0 ? 'aviso' : 'ok')}
        </div>

        <div class="aviso-caja ${d.semaforo.clave === 'reducir' ? '' : 'info'}">
          Lectura del modelo: ${chipSemaforo(d.semaforo)}
          ${c.productividad ? `<br>Productividad: <strong>${fmtNum(c.productividad.ticketsHora)}</strong> tickets/hora contra un objetivo de ${c.productividad.objetivo}
            (cumplimiento ${fmtPct(c.productividad.cumplimiento)}). Por encima del 100% la tienda vende más de lo que su dotación sostiene.` : ''}
        </div>
      </section>`;
  }

  /* ----------------------- 8. Reporte y envío ----------------------- */
  function panelReporte(v, s, config, c) {
    const faltantes = Reporte.detectarFaltantes(v, s, c);
    const plan = v.diagnostico.plan || [];
    return `
      <section class="tarjeta">
        <h2>8. Diagnóstico y plan de seguimiento</h2>
        <p class="ayuda">Si dejás vacíos los hallazgos, el reporte usa el diagnóstico automático que figura abajo.</p>
        <div class="grid c2">
          ${campo('Hallazgos sobre ausentismo y horas extras', 'diagnostico.hallazgos', { tipo: 'textarea', alto: 150 })}
          ${campo('Impacto en el costo laboral de la tienda', 'diagnostico.impacto', { tipo: 'textarea', alto: 150 })}
        </div>

        ${c.hallazgosAuto.length ? `<div class="aviso-caja">
          <strong>Diagnóstico automático a partir de los datos cargados:</strong>
          <ul>${c.hallazgosAuto.map(h => `<li>${esc(h)}</li>`).join('')}</ul>
        </div>` : ''}

      </section>

      <section class="tarjeta">
        <h2>Plan de acción</h2>
        <p class="ayuda">
          Lo que queda comprometido al cerrar la visita. Cada acción indica a cargo de quién queda:
          en el reporte se separan las del Gerente de Tienda de las de RRHH, para que cada uno vea lo suyo.
        </p>
        <div class="tabla-scroll"><table>
          <thead><tr>
            <th>Acción</th><th>A cargo de</th><th>Responsable</th><th>Plazo</th>
            <th>Prioridad</th><th>Estado</th><th></th>
          </tr></thead>
          <tbody>
          ${plan.length ? plan.map((x, i) => `<tr>
            <td><textarea data-path="diagnostico.plan.${i}.compromiso" data-calc="1" style="min-height:56px" placeholder="Qué hay que hacer">${esc(x.compromiso)}</textarea></td>
            <td><select data-path="diagnostico.plan.${i}.aCargo" data-calc="1">
              <option value="tienda"${x.aCargo === 'tienda' ? ' selected' : ''}>Gerente de Tienda</option>
              <option value="rrhh"${x.aCargo === 'rrhh' ? ' selected' : ''}>RRHH</option>
              <option value="operaciones"${x.aCargo === 'operaciones' ? ' selected' : ''}>Operaciones</option>
              <option value="otro"${x.aCargo === 'otro' ? ' selected' : ''}>Otro</option>
            </select></td>
            <td><input data-path="diagnostico.plan.${i}.responsable" value="${esc(x.responsable)}" placeholder="Nombre"></td>
            <td><input type="date" data-path="diagnostico.plan.${i}.plazo" data-calc="1" value="${esc(x.plazo)}"></td>
            <td><select data-path="diagnostico.plan.${i}.prioridad" data-calc="1">
              ${['Alta', 'Media', 'Baja'].map(pr => `<option value="${pr}"${x.prioridad === pr ? ' selected' : ''}>${pr}</option>`).join('')}
            </select></td>
            <td><select data-path="diagnostico.plan.${i}.estado" data-calc="1">
              ${['Pendiente', 'En curso', 'Cumplido'].map(e2 => `<option value="${e2}"${x.estado === e2 ? ' selected' : ''}>${e2}</option>`).join('')}
            </select></td>
            <td class="num"><button class="mini" data-accion="borrar-item" data-arr="diagnostico.plan" data-idx="${i}">✕</button></td>
          </tr>`).join('') : '<tr><td colspan="7" class="vacio">Sin acciones cargadas.</td></tr>'}
          </tbody>
        </table></div>
        <div class="acciones">
          <button class="b sec" data-accion="agregar-compromiso">+ Agregar acción</button>
          ${pendientesAnteriores(v).length
            ? `<button class="b sec" data-accion="traer-pendientes" data-id="${v.id}">Traer ${pendientesAnteriores(v).length} pendiente${pendientesAnteriores(v).length === 1 ? '' : 's'} de la visita anterior</button>`
            : ''}
        </div>

        ${plan.length ? `<div class="kpis" style="margin-top:18px">
          ${kpi('A cargo del Gerente de Tienda', plan.filter(x => x.aCargo === 'tienda').length)}
          ${kpi('A cargo de RRHH', plan.filter(x => x.aCargo === 'rrhh').length)}
          ${kpi('Vencidas', plan.filter(x => x.estado !== 'Cumplido' && x.plazo && x.plazo < hoyISO()).length, 'con plazo pasado',
                plan.filter(x => x.estado !== 'Cumplido' && x.plazo && x.plazo < hoyISO()).length ? 'alerta' : 'ok')}
          ${kpi('Cumplidas', `${plan.filter(x => x.estado === 'Cumplido').length} / ${plan.length}`)}
        </div>` : ''}
      </section>

      <section class="tarjeta">
        <h2>Cierre de visita y envío al Gerente de Operaciones</h2>
        <p class="ayuda">
          Destinatario: <strong>${esc(config.gerenteOperaciones.nombre || 'sin cargar')}</strong>
          &lt;${esc(config.gerenteOperaciones.email || 'sin email')}&gt;
          ${(() => {
            const cc = Reporte.copias(s, config);
            return cc.length ? ` · con copia a ${esc(cc.join(', '))}` : '';
          })()}
          ${!s.emailGerente ? '<br><span class="chip ambar">falta el email del Gerente de Tienda</span> Cargalo en Sucursales para que reciba copia.' : ''}
          · vía ${config.webhook ? '<span class="chip verde">envío automático</span>' : '<span class="chip azul">cliente de correo</span>'}
        </p>

        ${faltantes.length ? `<div class="aviso-caja">
          <strong>Datos pendientes de carga.</strong> El reporte se envía igual, con estos puntos marcados como <code>[PENDIENTE]</code>:
          <ul>${faltantes.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
        </div>` : '<div class="aviso-caja info">Relevamiento completo: no quedan campos pendientes.</div>'}

        ${v.envio.enviado ? `<div class="aviso-caja info">
          Último envío: ${new Date(v.envio.fecha).toLocaleString('es-AR')} a ${esc(v.envio.destinatario)} (${esc(v.envio.via)}).
          ${v.envio.historial.length > 1 ? `Total de envíos: ${v.envio.historial.length}.` : ''}
        </div>` : ''}

        <div class="acciones">
          <button class="b" data-accion="enviar-reporte" data-id="${v.id}">Enviar al Gerente de Operaciones</button>
          <button class="b sec" data-accion="copiar-reporte" data-id="${v.id}">Copiar reporte</button>
          <button class="b sec" data-accion="descargar-reporte" data-id="${v.id}">Descargar .txt</button>
          <button class="b sec" data-accion="imprimir">Imprimir / PDF</button>
        </div>
      </section>

      <section class="tarjeta">
        <h2>Vista previa del reporte</h2>
        <pre class="reporte" id="vista-reporte">${esc(Reporte.texto(v, s, config))}</pre>
      </section>`;
  }

  /* ============================= RUTEO ============================= */
  function render() {
    const ruta = (location.hash || '#/red').replace(/^#\/?/, '').split('/');
    const e = Store.get();
    let html = '';

    if (ruta[0] === 'sucursales')      { vistaActual = vistaSucursales; html = vistaSucursales(); }
    else if (ruta[0] === 'config')     { vistaActual = vistaConfig;     html = vistaConfig(); }
    else if (ruta[0] === 'visita' && ruta[1]) {
      const id = ruta[1], tab = ruta[2] || 'minutas';
      vistaActual = () => vistaVisita(id, tab);
      html = vistaVisita(id, tab);
    } else { vistaActual = vistaRed; html = vistaRed(); }

    $('#contenido').innerHTML = html;

    document.querySelectorAll('nav.tabs.principal a').forEach(a => {
      const activo = (location.hash || '#/red').startsWith(a.getAttribute('href'));
      a.classList.toggle('activo', activo);
    });

    const sel = $('#selector-sucursal');
    if (sel) {
      sel.innerHTML = '<option value="">Ir a una sucursal…</option>' +
        e.sucursales.map(s => `<option value="${s.id}">${esc(Store.etiquetaSucursal(s))}</option>`).join('');
    }
  }

  /* Mantiene viva la vista previa del reporte sin re-renderizar toda la vista
     (evita perder el foco mientras se escribe el diagnóstico). */
  function actualizarVistaPrevia() {
    const pre = document.getElementById('vista-reporte');
    if (!pre || !contexto || !contexto.sucursalId) return;
    const s = Store.sucursal(contexto.sucursalId);
    pre.textContent = Reporte.texto(contexto, s, Store.get().config);
  }

  function refrescar() { if (vistaActual) { const y = window.scrollY; $('#contenido').innerHTML = vistaActual(); window.scrollTo(0, y); } }

  /* ============================ EVENTOS ============================ */
  function conectar() {
    const cont = document.body;

    // Escritura de campos: guarda siempre; recalcula al salir del campo.
    cont.addEventListener('input', ev => {
      const el = ev.target.closest('[data-path]');
      if (!el || !contexto) return;
      setPath(contexto, el.dataset.path, el.value);
      guardarDiferido();
    });

    cont.addEventListener('change', ev => {
      const el = ev.target.closest('[data-path]');
      if (!el || !contexto) return;
      setPath(contexto, el.dataset.path, el.value);
      Store.save();
      if (el.dataset.calc) refrescar(); else actualizarVistaPrevia();
    });

    cont.addEventListener('click', async ev => {
      const btn = ev.target.closest('[data-accion]');
      if (!btn) return;
      const a = btn.dataset.accion;
      const e = Store.get();

      /* --- sucursales --- */
      if (a === 'agregar-sucursal') { Store.agregarSucursal(); refrescar(); }

      if (a === 'borrar-sucursal') {
        const suc = Store.sucursal(btn.dataset.id);
        const n = Store.visitasDe(suc.id).length;
        const ok = await confirmar(
          `Eliminar ${Store.etiquetaSucursal(suc)}`,
          n ? `Se borrarán también sus ${n} visita${n === 1 ? '' : 's'} y todo lo cargado en ellas.`
            : 'La sucursal se quita del tablero.',
          'Eliminar sucursal');
        if (ok) { Store.eliminarSucursal(suc.id); refrescar(); avisar('Sucursal eliminada.'); }
      }

      /* --- visitas --- */
      if (a === 'nueva-visita') {
        const v = Store.crearVisita(btn.dataset.id);
        location.hash = `#/visita/${v.id}/minutas`;
      }

      if (a === 'nueva-visita-selector') {
        const sel = $('#selector-sucursal');
        if (!sel.value) return avisar('Elegí primero una sucursal en el selector.', 'error');
        const v = Store.crearVisita(sel.value);
        location.hash = `#/visita/${v.id}/minutas`;
      }

      if (a === 'borrar-visita') {
        const vi = Store.visita(btn.dataset.id);
        const su = vi ? Store.sucursal(vi.sucursalId) : null;
        const ok = await confirmar(
          'Eliminar visita',
          vi ? `Visita a ${Store.etiquetaSucursal(su)} del ${fmtFecha(vi.fecha)}. Se borran las minutas, la matriz de FTE y todo lo cargado.`
             : 'Se borran todos los datos de la visita.',
          'Eliminar visita');
        if (ok) {
          Store.eliminarVisita(btn.dataset.id);
          if ((location.hash || '').includes(btn.dataset.id)) location.hash = '#/red'; else refrescar();
          avisar('Visita eliminada.');
        }
      }

      /* --- filas de tablas --- */
      if (a === 'agregar-movimiento') {
        contexto.movimientos.push({ tipo: 'baja', nombre: '', fecha: '', puesto: '', categoria: '', motivo: '', causa: '' });
        Store.save(); refrescar();
      }
      if (a === 'agregar-sancion') {
        contexto.sanciones.push({ nombre: '', fecha: '', tipo: '', motivo: '', puesto: '', observaciones: '' });
        Store.save(); refrescar();
      }
      if (a === 'agregar-sucesion') {
        contexto.sucesion.push({ posicion: POSICIONES[0].nombre, incumbent: '', criticidad: 3, escasez: 2, disponibilidad: '1a2', candidatos: [] });
        Store.save(); refrescar();
      }
      if (a === 'agregar-compromiso') {
        contexto.diagnostico.plan.push({ compromiso: '', aCargo: 'tienda', responsable: '',
                                         plazo: '', prioridad: 'Media', estado: 'Pendiente' });
        Store.save(); refrescar();
      }
      if (a === 'traer-pendientes') {
        const vi = Store.visita(btn.dataset.id);
        const traidas = pendientesAnteriores(vi);
        traidas.forEach(x => vi.diagnostico.plan.push(
          Object.assign({}, x, { estado: x.estado === 'Cumplido' ? 'Pendiente' : x.estado })));
        Store.save(); refrescar();
        avisar(`${traidas.length} acción${traidas.length === 1 ? '' : 'es'} traída${traidas.length === 1 ? '' : 's'} de la visita anterior.`);
      }
      if (a === 'agregar-candidato') {
        contexto.sucesion[+btn.dataset.idx].candidatos.push({ nombre: '', readiness: '1a2' });
        Store.save(); refrescar();
      }
      if (a === 'borrar-candidato') {
        contexto.sucesion[+btn.dataset.idx].candidatos.splice(+btn.dataset.jdx, 1);
        Store.save(); refrescar();
      }
      if (a === 'borrar-item') {
        const arr = getPath(contexto, btn.dataset.arr);
        arr.splice(+btn.dataset.idx, 1);
        Store.save(); refrescar();
      }

      /* --- reporte --- */
      if (a === 'enviar-reporte' || a === 'copiar-reporte' || a === 'descargar-reporte') {
        const v = Store.visita(btn.dataset.id);
        const s = Store.sucursal(v.sucursalId);
        const texto = Reporte.texto(v, s, e.config);

        if (a === 'copiar-reporte') {
          try {
            await navigator.clipboard.writeText(texto);
            btn.textContent = '✓ Copiado';
            setTimeout(() => { btn.textContent = 'Copiar reporte'; }, 1800);
          } catch (err) {
            const pre = $('#vista-reporte');
            if (pre) { const r = document.createRange(); r.selectNode(pre); getSelection().removeAllRanges(); getSelection().addRange(r); }
            avisar('No se pudo copiar solo. El reporte quedó seleccionado: copialo con Ctrl+C.', 'error');
          }
        }

        if (a === 'descargar-reporte') {
          await guardarArchivo(`visita-${s.codigo}-${v.fecha}.txt`, texto, 'text/plain');
        }

        if (a === 'enviar-reporte') {
          btn.disabled = true;
          const original = btn.textContent;
          btn.textContent = 'Enviando…';
          try {
            const r = await Reporte.enviar(v, s, e.config);
            refrescar();
            avisar(r.via === 'webhook' ? `Reporte enviado a ${r.destino}.` : `Se abrió tu cliente de correo con el reporte para ${r.destino}.`);
          } catch (err) {
            avisar('No se pudo enviar: ' + err.message, 'error');
            btn.disabled = false; btn.textContent = original;
          }
        }
      }

      if (a === 'imprimir') window.print();

      /* --- respaldos --- */
      if (a === 'ejemplo') {
        const ok = await confirmar('Cargar datos de ejemplo',
          'Se reemplaza todo el contenido actual por dos sucursales con una visita completa. Si ya cargaste información real, exportá antes un respaldo.',
          'Cargar ejemplo');
        if (ok) { Store.cargarEjemplo(); location.hash = '#/red'; render(); avisar('Datos de ejemplo cargados.'); }
      }
      if (a === 'exportar') Store.exportar();
      if (a === 'importar') $('#archivo-import').click();
      if (a === 'reiniciar') {
        const ok = await confirmar('Borrar todo',
          'Se eliminan todas las sucursales y visitas guardadas en este navegador. No se puede deshacer.',
          'Borrar todo');
        if (ok) { Store.reiniciar(); location.hash = '#/red'; render(); avisar('Tablero vacío.'); }
      }
    });

    cont.addEventListener('change', ev => {
      if (ev.target.id === 'archivo-import') {
        const f = ev.target.files[0];
        if (!f) return;
        const lector = new FileReader();
        lector.onload = () => {
          try { Store.importar(lector.result); location.hash = '#/red'; render(); avisar('Respaldo importado.'); }
          catch (err) { avisar('El archivo no tiene un formato válido: ' + err.message, 'error'); }
        };
        lector.readAsText(f);
      }
      if (ev.target.id === 'selector-sucursal' && ev.target.value) {
        const v = Store.ultimaVisita(ev.target.value);
        const idSuc = ev.target.value;
        ev.target.value = '';
        if (v) { location.hash = `#/visita/${v.id}/minutas`; return; }
        confirmar('Sin visitas registradas',
          `${Store.etiquetaSucursal(Store.sucursal(idSuc))} todavía no tiene visitas. ¿Registrar una ahora?`,
          'Registrar visita').then(ok => {
            if (!ok) return;
            const nueva = Store.crearVisita(idSuc);
            location.hash = `#/visita/${nueva.id}/minutas`;
          });
      }
    });

    window.addEventListener('hashchange', render);
  }

  function iniciar() {
    Store.init();
    conectar();
    render();
  }

  return { iniciar, render, refrescar };
})();

document.addEventListener('DOMContentLoaded', App.iniciar);
