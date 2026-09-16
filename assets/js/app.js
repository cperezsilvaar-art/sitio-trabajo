/*
 * app.js — Interfaz y ruteo del tablero.
 *
 * Ruteo por hash:
 *   #/red                      panel consolidado de la red
 *   #/nomina                   el padrón entero, con buscador e importación
 *   #/sucursal/<id>            la tienda: ficha editable, organigrama y visitas
 *   #/config                   sucursales del área, parámetros y destinatarios
 *   #/visita/<id>/<pestaña>    ficha de una visita
 */

const App = (() => {
  let contexto = null;          // objeto que editan los campos con data-path
  let visitaEnCurso = null;     // visita abierta, para fechar las evaluaciones
  let vistaActual = null;       // función de re-render de la vista en curso
  let temporizador = null;

  /* --------------------------- utilidades --------------------------- */
  const $ = sel => document.querySelector(sel);
  const valorDe = sel => { const el = $(sel); return el ? el.value.trim() : ''; };
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
    return `<label class="campo"${o.titulo ? ` title="${esc(o.titulo)}"` : ''}>` +
           `<span>${esc(etiqueta)}</span>${control}</label>`;
  }

  /* La fecha de acá, no la de UTC. Con toISOString, a partir de las 21:00 de
     Buenos Aires el panel pasaba a creer que era el día siguiente: la agenda
     adelantaba los vencimientos y el reporte del día se cargaba en la fecha
     equivocada justo a la hora en que se cierra la jornada. */
  const hoyISO = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };

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
    const fteVinculo = sum('matriz.total.fteVinculo');
    const fte = sum('matriz.total.fteReal');
    const costo = sum('matriz.total.costoTotal');
    const diasAus = sum('ausentismo.totalDias');
    const diasBase = sum('matriz.total.diasTrabajados');
    const he = sum('matriz.total.horasExtras');
    const ventaRed = conDatos.reduce((a, f) => a + num(f.v.comercial.venta), 0);
    const pctAus = diasBase > 0 ? diasAus / diasBase : null;
    const dot = Store.dotacionDelArea();
    const visitadas = filas.filter(f => f.v).length;
    const enviadas = filas.filter(f => f.v && f.v.envio.enviado).length;

    const html = `
      <h1 class="titulo">${esc(e.config.area || 'Panel de la red')}</h1>
      <p class="subtitulo">Consolidado de la última visita registrada en cada sucursal${e.config.coordinador ? ` · ${esc(e.config.coordinador)}` : ''}.</p>

      ${(() => {
        /* Los certificados que vencen van en la portada porque la decisión es
           de mañana a la mañana: o la persona vuelve, o hay que cubrir el
           turno. Enterarse tarde es enterarse cuando la tienda ya abrió. */
        const al = alertasDeAusencias(e, hoyISO());
        if (!al.length) return '';
        return `<div class="aviso-caja">
          <strong>Certificados que vencen</strong>
          <ul>${al.slice(0, 6).map(x => `<li>
            <strong>${esc(x.nombre)}</strong> (${esc(x.sucursal)}) — ${esc(x.estado.texto)}.
          </li>`).join('')}</ul>
          <a href="#/diario">Resolverlas en Presentismo</a>
        </div>`;
      })()}

      ${Store.falloAlGuardar() ? `<div class="aviso-caja">
        <strong>Ojo: lo que cargues no se está guardando.</strong>
        ${esc(Store.falloAlGuardar())}
      </div>` : ''}

      ${(() => {
        /* El tablero sin plantel y con copias guardadas es, casi siempre, algo
           que se borró. Ofrecer la copia acá evita que se rehaga a mano un
           trabajo que está a un clic. */
        if (dot.personas || dot.flotantes) return '';
        const copias = Store.resguardos();
        if (!copias.length) return '';
        return `<div class="aviso-caja" id="rescate-copias">
          <strong>El tablero no tiene plantel cargado y hay ${copias.length}
          copia${copias.length === 1 ? '' : 's'} guardada${copias.length === 1 ? '' : 's'} en este navegador.</strong>
          <div data-rescate="${copias[0].id}">Viendo qué tiene adentro la más reciente…</div>
        </div>`;
      })()}


      <div class="kpis">
        ${kpi('Sucursales a cargo', dot.tiendas, `${visitadas} con visita registrada`)}
        ${kpi('Dotación de piso', dot.personas ? fmtNum(dot.fte, 1) + ' FTE' : '—',
              dot.personas ? `${dot.personas} personas${dot.parciales ? ` · ${dot.parciales} de tiempo parcial` : ''}` : 'sin plantel cargado')}
        ${kpi('No fijos en tienda', (dot.noPresenciales + dot.flotantes) || '—',
              dot.noPresenciales + dot.flotantes
                ? `${dot.noPresenciales} con bloqueo · ${dot.flotantes} flotantes`
                : '')}
        ${kpi('FTE del mes cerrado', fte ? fmtNum(fte) : '—',
              fteVinculo ? `brecha ${fmtNum(fte - fteVinculo)} FTE` : 'se calcula con la estadística del mes',
              fte && fte < fteVinculo - 0.5 ? 'aviso' : '')}
        ${kpi('Costo laboral', costo ? dinero(costo) : '—', fte ? `${dinero(costo / fte)} por FTE` : '')}
        ${kpi('Ausentismo', pctAus === null ? '—' : fmtPct(pctAus), `${diasAus} días`, pctAus !== null && pctAus > e.config.parametros.umbralAusentismo ? 'alerta' : 'ok')}
        ${kpi('Horas extras', he ? fmtNum(he, 0) + ' hs' : '—', he ? `${fmtNum(he / e.config.parametros.horasMes)} FTE equivalentes` : '')}
        ${(() => {
          const pct = costo && ventaRed ? costo / ventaRed : null;
          const banda = evaluarCostoVenta(pct, e.config.parametros);
          return kpi('Costo / venta de la red', pct === null ? '—' : fmtPct(pct),
                     pct === null ? 'sin ventas cargadas' : `${banda.icono} ${banda.texto}`,
                     { eficiente: 'ok', atencion: 'aviso', alerta: 'alerta', sd: '' }[banda.zona]);
        })()}
        ${kpi('Venta neta', ventaRed ? dinero(ventaRed) : '—', costo ? `costo laboral ${dinero(costo)}` : '')}
        
        ${kpi('Reportes enviados', `${enviadas} / ${visitadas}`, 'al Gerente de Operaciones', enviadas < visitadas ? 'aviso' : 'ok')}
      </div>

      <section class="tarjeta">
        <h2>Sucursales</h2>
        <p class="ayuda">Una tarjeta por tienda. Arriba lo que hay hoy —gente y FTE—, abajo lo del
          último mes cerrado. Tocá el nombre para entrar a la sucursal.</p>
        <div class="tarjetas-suc">
          ${e.sucursales.map(({ id }) => {
            const f = filas.find(x => x.s.id === id);
            const s = f.s, v = f.v, c = f.c;
            const d = dot.porSucursal[s.id];
            const cerrado = c && c.matriz.total.fteReal;
            return `<article class="suc-card${d.personas ? '' : ' vacia'}">
              <header>
                <div>
                  <a href="#/sucursal/${s.id}">${esc(s.nombre || s.codigo)}</a>
                  <span>${s.gerente ? esc(s.gerente) : 'sin gerente cargado'}</span>
                </div>
                <span class="suc-tipo" title="${s.tipo === 'staff' ? 'No es una tienda: gente del área' : 'Tienda'}">${
                  s.tipo === 'staff' ? '🏢' : '🏪'}</span>
              </header>

              <div class="suc-hoy">
                <div class="suc-fte">
                  <strong>${d.personas ? fmtNum(d.fte, 1) : '—'}</strong>
                  <span>FTE de piso</span>
                </div>
                <ul>
                  <li><b>${d.personas || '—'}</b> personas</li>
                  ${d.parciales ? `<li><b>${d.parciales}</b> media jornada</li>` : ''}
                  ${d.noPresenciales.length ? `<li class="ojo"><b>${d.noPresenciales.length}</b> con bloqueo</li>` : ''}
                  ${d.bajas.length ? `<li class="ojo"><a href="#/movimientos/bajas"><b>${d.bajas.length}</b> baja${d.bajas.length === 1 ? '' : 's'}</a></li>` : ''}
                </ul>
              </div>

              <div class="suc-mes">
                ${cerrado ? `
                  <div><span>FTE real</span><b>${fmtNum(c.matriz.total.fteReal)}</b></div>
                  <div><span>Ausentismo</span><b>${c.ausentismo.pctTotal === null ? '—' : fmtPct(c.ausentismo.pctTotal)}</b></div>
                  <div><span>Hs. extras</span><b>${c.matriz.total.horasExtras ? fmtNum(c.matriz.total.horasExtras, 0) : '—'}</b></div>
                  <div><span>Costo / FTE</span><b>${c.matriz.total.costoPorFte ? dinero(c.matriz.total.costoPorFte) : '—'}</b></div>
                ` : '<p class="suc-sinmes">Sin mes cerrado todavía.</p>'}
              </div>

              <footer>
                <span>${v ? `Visita del ${fmtFecha(v.fecha)}` : '<span class="chip">sin visita</span>'}</span>
                <span>
                  ${c ? chipSemaforo(c.dotacion.semaforo) : ''}
                  ${v && v.envio.enviado ? '<span class="chip verde">enviado</span>' : ''}
                  ${v
                    ? `<a class="b sec mini" href="#/visita/${v.id}/checklist" style="text-decoration:none">Abrir visita</a>`
                    : `<button class="b sec mini" data-accion="nueva-visita" data-id="${s.id}">Visitar</button>`}
                </span>
              </footer>
            </article>`;
          }).join('')}
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
              <a class="chip azul" href="#/visita/${v.id}/checklist" style="text-decoration:none">Abrir</a>
              <button class="mini" data-accion="borrar-visita" data-id="${v.id}">Borrar</button>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </section>`;
  }

  /* ========================= VISTA: VISITAS ======================== *
     El ritmo semanal, separado del mensual. Acá se decide a dónde ir hoy:
     las sucursales ordenadas por cuánto hace que no se las visita. */
  function vistaVisitas() {
    const e = Store.get();
    contexto = e;
    const hoy = hoyISO();
    const dias = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

    const filas = e.sucursales.map(s => {
      const vs = Store.visitasDe(s.id);
      const ult = vs[0] || null;
      const desde = ult && ult.fecha ? dias(ult.fecha, hoy) : null;
      const r = ult ? evaluarChecklist(ult.checklist.checks).total : null;
      const pend = vs.reduce((a2, v) => a2 + (v.diagnostico.plan || [])
        .filter(x => x.estado !== 'Cumplido').length, 0);
      return { s, ult, desde, r, pend, visitas: vs.length };
    }).sort((a, b) => {
      if (a.desde === null) return -1;          // sin visitar, primero
      if (b.desde === null) return 1;
      return b.desde - a.desde;
    });

    const estaSemana = e.visitas.filter(v => v.fecha && dias(v.fecha, hoy) <= 7 && v.fecha <= hoy);
    const sinVisitar = filas.filter(f => f.desde === null).length;
    const atrasadas = filas.filter(f => f.desde !== null && f.desde > 7).length;

    const semaforo = d => d === null ? '<span class="chip rojo">nunca</span>'
      : d <= 7  ? `<span class="chip verde">hace ${d} día${d === 1 ? '' : 's'}</span>`
      : d <= 14 ? `<span class="chip ambar">hace ${d} días</span>`
      : `<span class="chip rojo">hace ${d} días</span>`;

    return `
      <h1 class="titulo">Visitas a sucursales</h1>
      <p class="subtitulo">
        El trabajo de todas las semanas. Los números del mes están en <em>Estadística mensual</em>.
      </p>

      <section class="tarjeta">
        <h2>Registrar una visita</h2>
        <p class="ayuda">Elegí la sucursal a la que vas y se abre el check list.</p>
        <div class="acciones" style="margin-top:6px">
          <select id="visita-sucursal" style="max-width:340px">
            <option value="">Elegí la sucursal…</option>
            ${filas.map(f => `<option value="${f.s.id}">${esc(Store.etiquetaSucursal(f.s))}${
              f.desde === null ? ' — sin visitar' : ` — hace ${f.desde} días`}</option>`).join('')}
          </select>
          <button class="b grande" data-accion="nueva-visita-desde-selector">+ Registrar visita</button>
        </div>
      </section>

      <div class="kpis">
        ${kpi('Visitas en los últimos 7 días', estaSemana.length,
              `${e.sucursales.length} sucursales en el área`,
              estaSemana.length ? 'ok' : 'aviso')}
        ${kpi('Sin visitar nunca', sinVisitar, sinVisitar ? 'empezar por acá' : 'todas visitadas',
              sinVisitar ? 'alerta' : 'ok')}
        ${kpi('Con más de una semana', atrasadas, atrasadas ? 'se pasaron del ritmo semanal' : 'al día',
              atrasadas ? 'aviso' : 'ok')}
        ${kpi('Compromisos abiertos', filas.reduce((a, f) => a + f.pend, 0), 'en toda el área')}
      </div>

      <section class="tarjeta">
        <h2>A quién le toca</h2>
        <p class="ayuda">Ordenadas por cuánto hace que no se las visita.</p>
        <div class="tabla-scroll"><table>
          <thead><tr>
            <th>Sucursal</th><th>Última visita</th><th>Check list</th>
            <th class="num">Compromisos abiertos</th><th class="num">Visitas</th><th></th>
          </tr></thead>
          <tbody>
            ${filas.map(f => `<tr>
              <td><a href="#/sucursal/${f.s.id}" style="font-weight:700;color:var(--azul)">${esc(Store.etiquetaSucursal(f.s))}</a>
                ${f.s.gerente ? `<div style="font-size:12px;color:var(--texto-suave)">${esc(f.s.gerente)}</div>` : ''}</td>
              <td>${f.ult ? `${fmtFecha(f.ult.fecha)} · ${semaforo(f.desde)}` : semaforo(null)}</td>
              <td>${f.r && f.r.pct !== null
                    ? `${fmtPct(f.r.pct, 0)}${f.r.noAprobados ? ` <span class="chip ambar">${f.r.noAprobados} no aprobados</span>` : ''}`
                    : '—'}</td>
              <td class="num">${f.pend || '—'}</td>
              <td class="num">${f.visitas || '—'}</td>
              <td class="num" style="white-space:nowrap">
                <button class="b sec" data-accion="nueva-visita" data-id="${f.s.id}">Visitar</button>
                ${f.ult ? `<a class="mini" href="#/visita/${f.ult.id}/checklist" style="text-decoration:none;display:inline-block;margin-left:6px">Última</a>` : ''}
              </td>
            </tr>`).join('')}
          </tbody>
        </table></div>
      </section>

      <section class="tarjeta">
        <h2>Últimas visitas registradas</h2>
        ${e.visitas.length ? `<div class="tabla-scroll"><table>
          <thead><tr><th>Fecha</th><th>Sucursal</th><th>Check list</th><th class="num">Compromisos</th><th>Reporte</th><th></th></tr></thead>
          <tbody>${e.visitas.slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).slice(0, 15).map(v => {
            const su = Store.sucursal(v.sucursalId);
            const rr = evaluarChecklist(v.checklist.checks).total;
            const plan = (v.diagnostico.plan || []).length;
            return `<tr>
              <td><strong>${fmtFecha(v.fecha)}</strong></td>
              <td>${su ? esc(Store.etiquetaSucursal(su)) : '—'}</td>
              <td>${rr.pct === null ? '—' : fmtPct(rr.pct, 0)}</td>
              <td class="num">${plan || '—'}</td>
              <td>${v.envio.enviado ? '<span class="chip verde">enviado</span>' : '<span class="chip ambar">pendiente</span>'}</td>
              <td class="num"><a class="mini" href="#/visita/${v.id}/checklist" style="text-decoration:none;display:inline-block">Abrir</a></td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>` : '<p class="vacio">Todavía no registraste ninguna visita.</p>'}
      </section>`;
  }

  /* ======================== VISTA: RECLAMOS ======================== *
     Lo que la gente plantea en las visitas y hay que responder. Un reclamo
     salarial sin respuesta no se apaga solo. */
  let reclamoFiltro = 'abiertos';
  let reclamoAbierto = null;
  let reclamoSuc = '';        // '' = toda el área; si no, el id de una sucursal

  /* =========================== VISTA: MI AGENDA ===========================
     Lo que el coordinador lleva: lo suyo, lo que espera de otros y lo que le
     informaron. Se anota escribiendo la línea como uno la diría —"llamar a Ana
     el jueves"— porque si hubiera que elegir la fecha en un calendario, no se
     anotaría. */
  let itemAbierto = null;
  let verHechas = false;
  let licenciaAnio = null;   // año que se está mirando en la ficha de licencias
  let bancoVisible = null;   // ficha cuyo bloque bancario está desplegado

  /* ========================== VISTA: NÓMINA =========================
     El padrón entero en una lista, flotantes incluidos. Es la pantalla que se
     abre cuando alguien pregunta por una persona y hay que encontrarla ya: por
     eso el buscador está arriba de todo y filtra mientras se escribe. */
  let nominaFiltro = '';
  let nominaOrden = 'nombre';
  let nominaEstado = 'todos';   // todos | activos | bajas

  const _norm = t => String(t == null ? '' : t)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  function vistaNomina() {
    const e = Store.get();
    contexto = e;
    visitaEnCurso = null;

    /* Una fila por persona de toda el área. El orden por defecto es
       alfabético porque es como se la busca cuando ya se sabe el nombre. */
    const gente = [];
    e.sucursales.forEach(s => {
      (s.colaboradores || []).forEach(c => gente.push({ c, s }));
    });

    /* La baja no sale del listado: al mes siguiente se la sigue buscando por
       nombre —para la liquidación, para un certificado, para saber cuándo se
       fue—. Se muestra con su fecha y se puede aislar con el desplegable. */
    const activos = gente.filter(({ c }) => c.activo !== false).length;
    const porEstado = nominaEstado === 'activos' ? gente.filter(({ c }) => c.activo !== false)
                    : nominaEstado === 'bajas'   ? gente.filter(({ c }) => c.activo === false)
                    : gente;

    const q = _norm(nominaFiltro).trim();
    const filtrada = !q ? porEstado : porEstado.filter(({ c, s }) => _norm([
      c.nombre, c.cargo, c.nivelCargo, c.categoriaConvenio, c.posicion,
      s.nombre, s.codigo, c.dni, c.cuil, c.nroPersonal, c.legajo
    ].join(' ')).indexOf(q) >= 0);

    const orden = {
      nombre:    (a, b2) => _norm(a.c.nombre).localeCompare(_norm(b2.c.nombre)),
      sucursal:  (a, b2) => _norm(a.s.nombre || a.s.codigo).localeCompare(_norm(b2.s.nombre || b2.s.codigo)) ||
                            _norm(a.c.nombre).localeCompare(_norm(b2.c.nombre)),
      antiguedad:(a, b2) => String(a.c.fechaIngreso || '9999').localeCompare(String(b2.c.fechaIngreso || '9999')),
      puesto:    (a, b2) => _norm(a.c.cargo).localeCompare(_norm(b2.c.cargo)) ||
                            _norm(a.c.nombre).localeCompare(_norm(b2.c.nombre)),
      /* Las bajas más recientes primero: es el orden en que se las revisa. */
      baja:      (a, b2) => String(fechaBaja(b2.c) || '').localeCompare(String(fechaBaja(a.c) || '')) ||
                            _norm(a.c.nombre).localeCompare(_norm(b2.c.nombre))
    }[nominaOrden] || ((a, b2) => 0);
    filtrada.sort(orden);

    const dot = Store.dotacionDelArea();

    return `
      <h1 class="titulo">Nómina del ${esc(e.config.area || 'área')}</h1>
      <p class="subtitulo">
        Todo el personal, flotantes incluidos. Escribí en el buscador para filtrar por nombre,
        sucursal, puesto o documento; tocá una fila para abrir la ficha completa.
      </p>

      <section class="tarjeta">
        <div class="acciones" style="align-items:flex-end;margin-top:0">
          <label class="campo" style="flex:1 1 380px">
            <span>Buscar</span>
            <input id="buscar-nomina" autocomplete="off" value="${esc(nominaFiltro)}"
              placeholder="Apellido, sucursal, puesto, DNI…">
          </label>
          <label class="campo" style="max-width:170px">
            <span>Mostrar</span>
            <select id="estado-nomina">
              ${[['todos', 'Activos y bajas'], ['activos', 'Solo activos'],
                 ['bajas', 'Solo bajas']].map(([v, t]) =>
                `<option value="${v}"${nominaEstado === v ? ' selected' : ''}>${t}</option>`).join('')}
            </select>
          </label>
          <label class="campo" style="max-width:190px">
            <span>Ordenar por</span>
            <select id="orden-nomina">
              ${[['nombre', 'Apellido y nombre'], ['sucursal', 'Sucursal'],
                 ['puesto', 'Puesto'], ['antiguedad', 'Antigüedad'],
                 ['baja', 'Fecha de baja']].map(([v, t]) =>
                `<option value="${v}"${nominaOrden === v ? ' selected' : ''}>${t}</option>`).join('')}
            </select>
          </label>
          ${nominaFiltro || nominaEstado !== 'todos'
            ? '<button class="b sec" data-accion="limpiar-nomina">Limpiar</button>' : ''}
        </div>
        <p class="ayuda">
          ${filtrada.length === gente.length
            ? `${gente.length} personas en la nómina · ${activos} activas · ${gente.length - activos} de baja · ${dot.personas} en el piso de una tienda · ${dot.flotantes} flotantes · ${dot.noPresenciales} con bloqueo.`
            : `${filtrada.length} de ${gente.length} personas${nominaEstado === 'activos' ? ' (solo activas)' : nominaEstado === 'bajas' ? ' (solo bajas)' : ''}.`}
        </p>
      </section>

      ${filtrada.length ? `<div class="lista-nomina">
        ${filtrada.map(({ c, s }) => filaNomina(c, s)).join('')}
      </div>` : `<section class="tarjeta"><p class="vacio">
        ${gente.length
          ? `Nadie coincide con “${esc(nominaFiltro)}”. Probá con menos letras o con el apellido solo.`
          : 'Todavía no hay nadie cargado. Pegá la nómina acá abajo y el padrón se arma solo.'}
      </p></section>`}

      <section class="tarjeta">
        <h2>Nómina del área</h2>
        <p class="ayuda">
          El padrón de personas, con todas las sucursales juntas. Pegá la planilla completa
          —desde la fila de encabezados— y cada persona se reparte a su tienda con su cargo,
          sus fechas y sus datos de contacto. Es lo que llena la dotación por posición.
        </p>
        <textarea id="pegar-nomina" style="min-height:110px"
          placeholder="CUIL  DNI  Apellido  Nombre  Sexo  ESTATUS  …  TIENDA DONDE ESTÁ  CARGO  …"></textarea>
        <div class="acciones">
          <button class="b" data-accion="importar-nomina">Importar la nómina</button>
          ${PLANTEL_AREA3.length
            ? `<button class="b sec" data-accion="cargar-plantel">Cargar el plantel del área (${PLANTEL_AREA3.length})</button>`
            : ''}
        </div>
        ${PLANTEL_AREA3.length ? `<p class="ayuda">“Cargar el plantel del área” repone las ${PLANTEL_AREA3.length} personas de la nómina de
          septiembre de 2026 con su tienda, su cargo, su categoría, su jornada y sus fechas de
          ingreso, sin tener que pegar nada. No trae el CUIL, el DNI, el teléfono, el domicilio
          ni los mails: eso vive solo en tu navegador y entra al pegar la planilla. Los dos
          caminos se complementan y ninguno duplica a nadie.</p>` : ''}
        <div id="resultado-nomina"></div>

        ${(() => {
          const con = e.sucursales.filter(x => (x.colaboradores || []).length);
          if (!con.length) return '';
          const activos = x => (x.colaboradores || []).filter(c => c.activo !== false);
          const total = con.reduce((a, x) => a + activos(x).length, 0);
          const noPres = con.reduce((a, x) => a + activos(x).filter(c => esNoPresencial(c).noPresencial).length, 0);
          const sinPos = con.reduce((a, x) => a + activos(x).filter(c => !c.posicion).length, 0);
          return `<div class="aviso-caja info" style="margin-top:12px">
            <strong>${total - noPres} persona${total - noPres === 1 ? '' : 's'} en el piso</strong>
            en ${con.length} sucursal${con.length === 1 ? '' : 'es'}.
            ${noPres ? `Otras ${noPres} están en la nómina con bloqueo de título o como no
              presenciales: cuestan, pero no cubren turno.` : ''}
            ${sinPos ? `${sinPos} sin posición asignada.` : 'Todas con posición asignada.'}
          </div>
          ${(() => {
            const sinCargo = con.reduce((a, x) =>
              a + activos(x).filter(c => !String(c.cargo || '').trim()).length, 0);
            if (!sinCargo) return '';
            return `<div class="aviso-caja">
              <strong>${sinCargo} persona${sinCargo === 1 ? '' : 's'} sin puesto cargado.</strong>
              El listado corto del área trae el nombre y la tienda, pero no el cargo: sin eso
              el organigrama no puede ordenar a nadie por posición. Pegá acá abajo la nómina
              completa —la que tiene las columnas CARGO y NIVEL DE CARGO— y se completa sola.
            </div>`;
          })()}`;
        })()}
      </section>`;
  }

  const fechaBaja = c => (c.baja && c.baja.fecha) || '';

  /* Una línea por persona: lo que se necesita para reconocerla sin abrirla. */
  function filaNomina(c, s) {
    const anios = antiguedadAnios(c.fechaIngreso);
    const np = esNoPresencial(c);
    const jor = jornadaDeVinculo(c);
    const abierta = perfilAbierto === c.id;
    const sexo = { M: 'M', F: 'F', MASCULINO: 'M', FEMENINO: 'F' }[String(c.sexo || '').toUpperCase()] || '';

    return `<article class="nom-fila${abierta ? ' abierta' : ''}${c.activo === false ? ' de-baja' : ''}">
      <button class="nom-cab" data-accion="ver-perfil" data-id="${c.id}"
        title="Ver la ficha de ${esc(c.nombre)}">
        <span class="nom-nombre">${esc(c.nombre || 'Sin nombre')}
          ${sexo ? `<em class="nom-sexo">${sexo}</em>` : ''}
          ${c.activo === false
            ? `<span class="chip rojo">Baja${fechaBaja(c) ? ' ' + fmtFecha(fechaBaja(c)) : ''}</span>`
            : ''}
          ${np.noPresencial ? `<span class="chip ambar">${esc(np.motivo)}</span>` : ''}
          ${jor.parcial ? '<span class="chip azul">½ jornada</span>' : ''}
        </span>
        <span class="nom-puesto">${esc(c.cargo || c.posicion || 'sin puesto cargado')}</span>
        <span class="nom-suc">${esc(s.nombre || s.codigo)}</span>
        <span class="nom-ingreso">${c.fechaIngreso ? fmtFecha(c.fechaIngreso) : '—'}</span>
        <span class="nom-ant">${anios === null ? '—' : fmtNum(anios, 1) + ' años'}</span>
      </button>
      ${abierta ? perfilColaborador(s, c) : ''}
    </article>`;
  }

  /* ========================= VISTA: ASISTENTE =======================
     Arriba la conversación con Claude, abajo la agenda de siempre. El orden no
     es casual: la pregunta “¿qué tengo que mirar hoy?” se contesta mirando el
     tablero entero, y la agenda es una parte de la respuesta, no toda. */
  let chatMsgs = [];          // { rol, texto } de esta sesión, para dibujar
  let chatPensando = false;
  let chatAbortar = null;

  function vistaAsistente() {
    return panelAsistente() + vistaAgenda({ sinTitulo: true });
  }

  let diaEventos = null;      // { eventos } | { error } | null mientras se busca

  function panelAsistente() {
    const listo = Asistente.disponible();
    return `
      <h1 class="titulo">Asistente</h1>
      <p class="subtitulo">
        Preguntale por el área y te contesta con los números del panel. Abajo, tu agenda.
      </p>

      ${tiraDelDia()}

      <section class="tarjeta" id="asistente">
        ${listo ? '' : `<div class="aviso-caja info" id="asistente-espera">
          <strong>Buscando el asistente…</strong> Necesita el visor de claude.ai: abierto como
          archivo en tu computadora, esta parte no funciona y la agenda de abajo sí.
        </div>`}

        <div class="chat" id="chat-hilo">
          ${chatMsgs.length ? chatMsgs.map(m => `<div class="chat-msg ${m.rol}">
              <span class="chat-quien">${m.rol === 'yo' ? 'Vos' : 'Asistente'}</span>
              <div class="chat-texto">${esc(m.texto)}</div>
            </div>`).join('')
            : `<div class="chat-vacio">
                <p>Empezá por acá:</p>
                <div class="chat-sugerencias">
                  ${Asistente.SUGERENCIAS.map(x =>
                    `<button class="b sec mini" data-accion="chat-sugerencia" data-q="${esc(x)}">${esc(x)}</button>`).join('')}
                </div>
              </div>`}
          ${chatPensando ? `<div class="chat-msg asistente pensando">
            <span class="chat-quien">Asistente</span>
            <div class="chat-texto" id="chat-parcial">Pensando…</div>
          </div>` : ''}
        </div>

        <div class="acciones" style="align-items:flex-end">
          <label class="campo" style="flex:1 1 460px">
            <span>Preguntá</span>
            <input id="chat-entrada" autocomplete="off" ${listo ? '' : 'disabled'}
              placeholder="¿Con cuánta gente me quedo en Rivadavia si se va la DT?">
          </label>
          ${chatPensando
            ? '<button class="b sec" data-accion="chat-cortar">Cortar</button>'
            : `<button class="b" data-accion="chat-enviar" ${listo ? '' : 'disabled'}>Preguntar</button>`}
          ${chatMsgs.length ? '<button class="b sec" data-accion="chat-limpiar">Empezar de nuevo</button>' : ''}
        </div>
        <p class="ayuda">
          Ve los números del área, las visitas, los reclamos, las bajas y esta agenda. No le
          llegan CUIL, DNI, teléfonos, domicilios, mails ni datos bancarios. Puede anotarte
          cosas en la agenda si se lo pedís.
        </p>
      </section>`;
  }

  /* Las reuniones de hoy, del calendario de Google. Cada error tiene su propio
     texto: esconderlos atrás de un “algo falló” deja al coordinador sin saber
     que le alcanzaba con reconectar. */
  function tiraDelDia() {
    const est = Asistente.estadoCalendario();
    if (!est.hay) {
      if (est.motivo === 'sin-visor') return '';
      const t = Asistente.explicarError({ code: est.motivo });
      return `<div class="aviso-caja info"><strong>Tu día:</strong> ${esc(t.texto)}</div>`;
    }
    if (diaEventos === null) {
      return '<div class="aviso-caja info"><strong>Tu día:</strong> buscando tus reuniones…</div>';
    }
    if (diaEventos.error) {
      const t = Asistente.explicarError(diaEventos.error);
      return `<div class="aviso-caja"><strong>Tu día:</strong> ${esc(t.texto)}
        ${t.reintentar ? '<div class="acciones"><button class="b sec mini" data-accion="reintentar-dia">Probar de nuevo</button></div>' : ''}
      </div>`;
    }
    if (!diaEventos.eventos.length) {
      return '<div class="aviso-caja info"><strong>Tu día:</strong> no tenés reuniones agendadas para hoy.</div>';
    }
    return `<div class="aviso-caja info">
      <strong>Tu día:</strong> ${diaEventos.eventos.length} ${diaEventos.eventos.length === 1 ? 'reunión' : 'reuniones'} en el calendario.
      <ul>${diaEventos.eventos.map(x =>
        `<li><strong>${esc(Asistente.horaDe(x))}</strong> · ${esc(x.titulo)}</li>`).join('')}</ul>
    </div>`;
  }

  function vistaAgenda(opciones) {
    const e = Store.get();
    contexto = e;
    visitaEnCurso = null;

    const hoy = hoyISO();
    const r = repartirAgenda(e.agenda, hoy);

    const cajon = (titulo, lista, nota) => !lista.length ? '' : `
      <section class="tarjeta">
        <div class="cabecera-suc"><h2>${esc(titulo)}</h2>
          <span class="chip">${lista.length}</span></div>
        ${nota ? `<p class="ayuda">${esc(nota)}</p>` : ''}
        ${lista.map(x => fichaItem(x, hoy, e)).join('')}
      </section>`;

    return `
      ${(opciones || {}).sinTitulo ? '<h2 class="titulo-seccion">Mi agenda</h2>' : `
        <h1 class="titulo">Mi agenda</h1>
        <p class="subtitulo">
          Lo que llevás: lo tuyo, lo que estás esperando que te respondan y lo que te
          informaron. Escribilo como lo dirías y el panel le saca la fecha.
        </p>`}

      <section class="tarjeta">
        <div class="acciones" style="align-items:flex-end">
          <label class="campo" style="flex:1 1 420px">
            <span>Anotar</span>
            <input id="anotar-agenda" autocomplete="off"
              placeholder="Llamar a Ana de Botánico el jueves">
          </label>
          <button class="b" data-accion="anotar">Anotar</button>
          <button class="b sec" data-accion="pegar-largo">Pegar algo largo</button>
        </div>
        <p class="ayuda">
          Entiende <em>hoy</em>, <em>mañana</em>, <em>el jueves</em>, <em>en 2 semanas</em>,
          <em>17/09</em> y <em>14 de octubre</em>. Si decís que ya lo pediste, queda como
          <em>esperando</em>.
        </p>
        <div id="caja-largo" hidden>
          <textarea id="pegar-agenda" style="min-height:120px"
            placeholder="Pegá el mensaje o la minuta tal como te llegó."></textarea>
          <div class="acciones">
            <button class="b" data-accion="anotar-largo">Anotar lo pegado</button>
          </div>
        </div>
      </section>

      <div class="kpis">
        ${kpi('Vencidas', r.vencidas.length,
              r.vencidas.length ? 'se te pasaron' : 'ninguna atrasada',
              r.vencidas.length ? 'alerta' : 'ok')}
        ${kpi('Hoy y mañana', r.urgentes.length, r.urgentes.length ? 'para resolver ya' : 'nada inmediato',
              r.urgentes.length ? 'aviso' : 'ok')}
        ${kpi('Esta semana', r.semana.length, 'en los próximos 7 días')}
        ${kpi('Esperando respuesta', r.esperando.length,
              r.esperando.length ? 'la pelota está del otro lado' : 'nada delegado')}
        ${kpi('Abiertas', r.abiertas.length, `${r.hechas.length} cerradas`)}
      </div>

      ${cajon('Vencidas', r.vencidas, 'Ya pasó la fecha y siguen abiertas.')}
      ${cajon('Hoy y mañana', r.urgentes)}
      ${cajon('Esta semana', r.semana)}
      ${cajon('Más adelante', r.adelante)}
      ${cajon('Sin fecha', r.sinFecha, 'No vencen, pero tampoco se van solas.')}

      <section class="tarjeta">
        <div class="cabecera-suc">
          <h2>Hechas</h2>
          <button class="b sec mini" data-accion="ver-hechas">${verHechas ? 'Ocultar' : `Ver las ${r.hechas.length}`}</button>
        </div>
        ${verHechas
          ? (r.hechas.length ? r.hechas.map(x => fichaItem(x, hoy, e)).join('')
                             : '<p class="vacio">Todavía no cerraste nada.</p>')
          : '<p class="ayuda">El historial de lo que ya resolviste.</p>'}
      </section>`;
  }

  /** Una línea de la agenda, plegada hasta que se la abre. */
  function fichaItem(x, hoy, e) {
    const i = x.item, est = x.estado;
    const tema = TEMAS_AGENDA_POR_ID[i.tema] || TEMAS_AGENDA_POR_ID.otros;
    const abierto = itemAbierto === i.id;
    const cerrado = (ESTADOS_AGENDA_POR_ID[i.estado] || {}).cerrado;
    const chip = { vencido: 'rojo', urgente: 'ambar', semana: 'azul',
                   adelante: '', sinFecha: '', hecho: 'verde' }[est.clase];
    const suc = i.sucursalId ? Store.sucursal(i.sucursalId) : null;

    const cabecera = `<div class="aviso-fila ${abierto ? 'abierto' : ''}${cerrado ? ' hecho' : ''}">
      <button class="marcar" data-accion="marcar-hecho" data-id="${i.id}"
        title="${cerrado ? 'Volver a abrir' : 'Marcar como hecha'}">${cerrado ? '✓' : '○'}</button>
      <span class="aviso-icono">${tema.icono}</span>
      <span class="aviso-titulo" data-accion="abrir-item" data-id="${i.id}">${esc(i.titulo || 'Sin título')}</span>
      ${i.estado === 'esperando' ? '<span class="chip ambar">⏳ esperando</span>' : ''}
      ${est.clase !== 'sinFecha' && est.clase !== 'hecho' ? `<span class="chip ${chip}">${esc(est.texto)}</span>` : ''}
      <span class="aviso-meta">${esc(tema.nombre)}${i.quien ? ' · ' + esc(i.quien) : ''}${suc ? ' · ' + esc(suc.nombre || suc.codigo) : ''}</span>
    </div>`;

    if (!abierto) return cabecera;

    const hitos = (i.hitos || []).slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
    return cabecera + `<div class="aviso-cuerpo">
      <label class="campo"><span>Qué es</span>
        <input data-item="${i.id}|titulo" value="${esc(i.titulo || '')}"></label>

      <div class="grid c4">
        <label class="campo"><span>Estado</span>
          <select data-item="${i.id}|estado">
            ${ESTADOS_AGENDA.map(x2 => `<option value="${x2.id}"${i.estado === x2.id ? ' selected' : ''}>${x2.icono} ${esc(x2.nombre)}</option>`).join('')}
          </select></label>
        <label class="campo"><span>Tema</span>
          <select data-item="${i.id}|tema">
            ${TEMAS_AGENDA.map(t => `<option value="${t.id}"${i.tema === t.id ? ' selected' : ''}>${t.icono} ${esc(t.nombre)}</option>`).join('')}
          </select></label>
        <label class="campo" title="Con quién es: Compensaciones, un gerente, un colaborador…">
          <span>Con quién</span>
          <input data-item="${i.id}|quien" value="${esc(i.quien || '')}" placeholder="Compensaciones"></label>
        <label class="campo"><span>Sucursal</span>
          <select data-item="${i.id}|sucursalId">
            <option value="">— ninguna en particular —</option>
            ${e.sucursales.map(su => `<option value="${su.id}"${i.sucursalId === su.id ? ' selected' : ''}>${esc(su.nombre || su.codigo)}</option>`).join('')}
          </select></label>
      </div>

      <label class="campo"><span>Detalle</span>
        <textarea data-item="${i.id}|detalle" style="min-height:90px"
          placeholder="Lo que haga falta recordar: el mensaje original, con quién hablaste, qué quedó.">${esc(i.detalle || '')}</textarea></label>

      <h3>Fechas</h3>
      ${hitos.length ? hitos.map((h, n) => `<div class="linea-item">
        <input type="date" data-hito="${i.id}|${n}|fecha" value="${esc(h.fecha)}">
        <input data-hito="${i.id}|${n}|que" value="${esc(h.que)}" class="nombre-item" placeholder="Qué pasa ese día">
        ${h.contexto ? `<span class="ayuda" style="flex:1 1 100%;margin:0">${esc(h.contexto)}</span>` : ''}
        <button class="b peligro mini" data-accion="quitar-hito" data-id="${i.id}" data-i="${n}">Quitar</button>
      </div>`).join('') : '<p class="vacio">Sin fecha: no vence, pero queda en la lista.</p>'}
      <div class="acciones">
        <button class="b sec mini" data-accion="agregar-hito" data-id="${i.id}">+ Agregar fecha</button>
        <button class="b sec mini" data-accion="releer-fechas" data-id="${i.id}">Leer las fechas del texto</button>
      </div>

      <label class="marca-check"
        title="Lo que marques acá sale en el informe del check list cuando falten tres días o menos">
        <input type="checkbox" data-item-check="${i.id}|avisarEnTienda"${i.avisarEnTienda ? ' checked' : ''}>
        Hay que avisarlo en la tienda
      </label>

      <div class="acciones" style="margin-top:16px">
        <button class="b sec" data-accion="copiar-item" data-id="${i.id}">Copiar para mandar</button>
        <button class="b peligro" data-accion="borrar-item" data-id="${i.id}">Borrar</button>
      </div>
    </div>`;
  }

  /* ======================= VISTA: REPORTE DIARIO =======================
     La estadística mensual mide el mes que cerró; esto mide el día que pasó,
     que es la única escala donde todavía se puede hacer algo. Se carga a la
     mañana con el dato de ayer y se manda antes de que abran las tiendas. */
  let diarioFecha = null;      // día que se está mirando

  const ayerISO = () => new Date(Date.now() - 864e5).toISOString().slice(0, 10);

  let ausenciaAbierta = null;   // el formulario de alta desplegado

  /* ------------------ Ausencias con certificado --------------------
     Lo que sí se puede llevar día a día sin reloj de fichadas: quién está
     ausente, desde cuándo, y hasta cuándo dice el certificado. La fecha de
     alta es lo que más se olvida, y es la que decide si mañana hay que
     esperar a alguien o llamarlo. */
  function panelAusenciasLargas() {
    const e = Store.get();
    const hoy = hoyISO();
    const alertas = alertasDeAusencias(e, hoy);
    const enCurso = ausentesHoy(e, hoy);

    return `
      ${alertas.length ? `<div class="aviso-caja">
        <strong>Certificados que vencen</strong>
        <ul>${alertas.slice(0, 8).map(x => `<li>
          <strong>${esc(x.nombre)}</strong> (${esc(x.sucursal)}) — ${esc(x.estado.texto)}.
          <button class="mini" data-accion="abrir-ausencia" data-id="${x.colaboradorId}"
            data-suc="${x.sucursalId}">Resolver</button>
        </li>`).join('')}</ul>
      </div>` : ''}

      <section class="tarjeta">
        <div class="cabecera-suc">
          <h2>Ausencias del área</h2>
          <span class="chip${enCurso.length ? ' ambar' : ''}">${enCurso.length} en curso</span>
          ${(() => {
            const sinPapel = enCurso.filter(x => !tieneCertificado(x.ausencia)).length;
            return sinPapel ? `<span class="chip rojo">${sinPapel} sin justificar</span>` : '';
          })()}
        </div>
        <p class="ayuda">
          Elegí a la persona y el panel completa su sucursal, su antigüedad y lo que le
          corresponde por ley. Si todavía no trajo el certificado, guardala igual: queda
          <strong>pendiente de justificar</strong> hasta que lo presente.
        </p>

        <div class="acciones" style="align-items:flex-end">
          <label class="campo" style="flex:1 1 320px">
            <span>Colaborador</span>
            <select id="aus-colab">
              <option value="">— elegir —</option>
              ${e.sucursales.map(s => {
                const act = (s.colaboradores || []).filter(c => c.activo !== false);
                if (!act.length) return '';
                return `<optgroup label="${esc(s.nombre || s.codigo)}">${
                  act.map(c => `<option value="${c.id}"${c.id === ausenciaAbierta ? ' selected' : ''}>${esc(c.nombre)}</option>`).join('')}</optgroup>`;
              }).join('')}
            </select>
          </label>
          <button class="b" data-accion="nueva-ausencia">+ Registrar ausencia</button>
        </div>

        ${ausenciaAbierta ? formularioAusencia(ausenciaAbierta) : ''}

        ${enCurso.length ? `<div class="tabla-scroll" style="margin-top:14px"><table>
          <thead><tr><th>Persona</th><th>Sucursal</th><th>Licencia</th><th>Desde</th>
            <th>Hasta</th><th>Certificado</th><th>Situación</th><th>Reserva del puesto</th><th></th></tr></thead>
          <tbody>${enCurso.map(x => {
            const c = Store.colaboradorPorId(x.colaboradorId);
            const s = Store.sucursal(x.sucursalId);
            const est = estadoDeAusencia(x.ausencia, hoy);
            const cob = cobertura(x.ausencia, c, antiguedadAnios(c.fechaIngreso));
            return `<tr>
              <td><button class="mini" data-accion="abrir-ausencia" data-id="${c.id}" data-suc="${s.id}"
                style="color:var(--azul);border-color:var(--azul);white-space:nowrap">${esc(c.nombre)}</button></td>
              <td>${esc(s.nombre || s.codigo)}</td>
              <td class="tipo">${esc((MOTIVOS_AUSENCIA_LARGA.find(m => m.id === x.ausencia.motivo) || {}).nombre || '—')}</td>
              <td class="tipo">${fmtFecha(x.ausencia.desde)}</td>
              <td class="tipo">${x.ausencia.hasta ? fmtFecha(x.ausencia.hasta) : '<span class="chip ambar">sin alta</span>'}</td>
              <td class="tipo">
                <label class="marca-check" style="margin:0;font-size:12.5px">
                  <input type="checkbox" data-aus-certificado="${c.id}|${x.ausencia.id}"${tieneCertificado(x.ausencia) ? ' checked' : ''}>
                  ${tieneCertificado(x.ausencia) ? 'presentado' : 'no lo trajo'}
                </label>
              </td>
              <td><span class="chip ${est.tono}">${esc(est.texto)}</span></td>
              <td class="tipo">${cob.aplica
                ? `hasta el ${fmtFecha(cob.finReserva)}`
                : '<span class="ayuda">otro régimen</span>'}</td>
              <td class="tipo">
                <button class="mini" data-accion="reincorporar" data-id="${c.id}" data-aus="${x.ausencia.id}">Se reincorporó</button>
              </td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>` : '<p class="vacio">Nadie con ausencia abierta.</p>'}
      </section>`;
  }

  /* El formulario trae solo lo que el panel ya sabe de la persona: desde
     cuándo trabaja y si tiene cargas de familia. Con eso se resuelve la
     pregunta que aparece cuando la ausencia se estira. */
  function formularioAusencia(colabId) {
    const c = Store.colaboradorPorId(colabId);
    if (!c) return '';
    const s = Store.sucursalDe(colabId);
    const anios = antiguedadAnios(c.fechaIngreso);
    const p = plazosEnfermedad(anios, tieneCargasFamilia(c));
    const propias = (c.ausencias || []).slice().reverse();

    return `<div class="aviso-caja info" style="margin-top:14px">
      <strong>${esc(c.nombre)}</strong>${c.cargo ? ` · ${esc(c.cargo)}` : ''}

      <div class="grid c4" style="margin-top:12px">
        ${dato('Sucursal', s ? (s.nombre || s.codigo) : 'sin sucursal')}
        ${dato('Ingreso', c.fechaIngreso ? `${fmtFecha(c.fechaIngreso)}${anios !== null ? ` · ${fmtNum(anios, 1)} años` : ''}` : 'sin fecha de ingreso')}
        <label class="campo"><span>Cargas de familia</span>
          <select data-colab-campo="${c.id}|cargasFamilia">
            <option value=""${!c.cargasFamilia ? ' selected' : ''}>— sin definir —</option>
            <option value="si"${tieneCargasFamilia(c) ? ' selected' : ''}>Sí</option>
            <option value="no"${c.cargasFamilia === 'no' || c.cargasFamilia === false ? ' selected' : ''}>No</option>
          </select></label>
        ${dato('Licencia paga (art. 208)', `${p.mesesPagos} meses`)}
        ${dato('Reserva del puesto (art. 211)', `${p.reservaMeses} meses más`)}
      </div>
      <p class="ayuda">
        Por ${esc(p.tramo)} y ${tieneCargasFamilia(c) ? 'con' : 'sin'} cargas de familia: <strong>${p.mesesPagos} meses con sueldo</strong> y después
        <strong>${p.reservaMeses} meses de puesto reservado sin goce</strong>.
        Es una orientación sobre la ley general, no un dictamen: recidivas, ART y maternidad
        van por otro lado.
      </p>

      <div class="grid c4" style="margin-top:10px">
        <label class="campo"><span>Tipo de licencia</span>
          <select id="aus-motivo">
            ${MOTIVOS_AUSENCIA_LARGA.map(m => `<option value="${m.id}">${esc(m.nombre)}</option>`).join('')}
          </select></label>
        <label class="campo"><span>Desde</span>
          <input type="date" id="aus-desde" value="${hoyISO()}"></label>
        <label class="campo"><span>Hasta (según el certificado)</span>
          <input type="date" id="aus-hasta"></label>
        <label class="campo"><span>Diagnóstico o nota</span>
          <input id="aus-nota" placeholder="Lo que dice el certificado"></label>
      </div>
      <label class="marca-check">
        <input type="checkbox" id="aus-certificado">
        Ya trajo el certificado
      </label>
      <p class="ayuda" style="margin-top:4px">
        Sin esa marca la ausencia queda <strong>pendiente de justificar</strong> y aparece
        primera en los avisos, hasta que la persona presente el papel.
      </p>
      <div class="acciones">
        <button class="b" data-accion="guardar-ausencia" data-id="${c.id}">Guardar la ausencia</button>
        <button class="b sec" data-accion="cerrar-ausencia">Cancelar</button>
      </div>

      ${propias.length ? `<h4 style="margin-top:16px">Ausencias anteriores</h4>
        <ul>${propias.map(a => {
          const est = estadoDeAusencia(a, hoyISO());
          return `<li>${fmtFecha(a.desde)} → ${a.hasta ? fmtFecha(a.hasta) : 'sin alta'}
            · ${esc((MOTIVOS_AUSENCIA_LARGA.find(m => m.id === a.motivo) || {}).nombre || '')}
            · <span class="chip ${est.tono}">${esc(est.texto)}</span>
            <button class="mini" data-accion="quitar-ausencia" data-id="${c.id}" data-aus="${a.id}">Quitar</button></li>`;
        }).join('')}</ul>` : ''}
    </div>`;
  }

  function vistaDiario() {
    const e = Store.get();
    contexto = e;
    visitaEnCurso = null;

    return `
      <h1 class="titulo">Presentismo del día</h1>
      <p class="subtitulo">
        Quién no está hoy, desde cuándo y hasta cuándo. Se anota una vez, con la fecha del
        certificado, y el panel avisa cuando se acerca el alta. Mientras no haya certificado,
        la falta queda <strong>pendiente de justificar</strong>.
      </p>

      ${panelAusenciasLargas()}`;
  }

  /* ====================== VISTA: VENTAS DEL DÍA ======================
     La venta salió de la pantalla de presentismo a pedido del coordinador: son
     dos preguntas distintas y mezclarlas hacía que el reporte que va a
     Operaciones tuviera que explicar las dos. Acá el número de la operación se
     mira contra la gente que efectivamente estuvo, que es el único cruce que
     interesa. */
  function vistaOperacion() {
    const e = Store.get();
    contexto = e;
    visitaEnCurso = null;

    const fechas = Store.fechasDiarias();
    if (!diarioFecha) diarioFecha = fechas[0] || ayerISO();
    const dia = Store.diarioDe(diarioFecha);
    const calc = calcularDiario(dia, e.sucursales, e.config.parametros);
    const v = calc.venta;
    const t = calc.total;

    const opcionesFecha = Array.from(new Set(fechas.concat([diarioFecha])))
      .sort((a, b) => String(b).localeCompare(String(a)));

    return `
      <h1 class="titulo">Ventas del día</h1>
      <p class="subtitulo">
        El volumen que hubo que atender. No mueve ningún indicador de RRHH: está para leer
        la cobertura contra la venta, porque el mismo hueco de personal pesa distinto en un
        día flojo que en uno de promoción. La gente con turno sale del padrón, descontando a
        quien tiene una licencia abierta en <a href="#/diario">Presentismo</a>.
      </p>

      <section class="tarjeta">
        <div class="acciones" style="align-items:flex-end;flex-wrap:wrap;margin-top:0">
          <label class="campo" style="max-width:200px">
            <span>Día reportado</span>
            <input type="date" id="diario-fecha" value="${esc(diarioFecha)}">
          </label>
          ${opcionesFecha.length > 1 ? `<label class="campo" style="max-width:220px">
            <span>Días cargados</span>
            <select id="diario-historico">
              ${opcionesFecha.map(f => `<option value="${esc(f)}"${f === diarioFecha ? ' selected' : ''}>${fmtFecha(f)}</option>`).join('')}
            </select>
          </label>` : ''}
        </div>
      </section>

      ${v.conDato ? `<div class="kpis">
        ${kpi('Venta del día', dinero(v.ayer),
              `${v.conDato} sucursal${v.conDato === 1 ? '' : 'es'} con dato`)}
        ${kpi('Índice del día', v.indexDia === null ? '—'
                : (v.indexDia >= 0 ? '+' : '') + fmtPct(v.indexDia, 1),
              v.metaHoy ? `meta ${dinero(v.metaHoy)}` : 'sin meta cargada',
              v.indexDia === null ? '' : v.indexDia >= 0 ? 'ok' : 'alerta')}
        ${kpi('Índice del mes', v.indexMes === null ? '—'
                : (v.indexMes >= 0 ? '+' : '') + fmtPct(v.indexMes, 1),
              v.requerido ? `requerido ${dinero(v.requerido)}` : 'sin requerido cargado',
              v.indexMes === null ? '' : v.indexMes >= 0 ? 'ok' : 'alerta')}
        ${kpi('Venta por persona presente',
              v.presentes && v.ayerConPresentismo ? dinero(v.ayerConPresentismo / v.presentes) : '—',
              v.presentes
                ? `${v.presentes} personas con turno en ${v.tiendasConAmbos} tienda${v.tiendasConAmbos === 1 ? '' : 's'}, descontando licencias`
                : 'sin plantel cargado no se puede cruzar')}
      </div>` : ''}

      <section class="tarjeta">
        <h2>Reporte Diario de Ventas (RDV)</h2>
        <p class="ayuda">
          Pegá la hoja <strong>RDV Operaciones</strong> del reporte de ventas del día:
          abrila en Excel, seleccioná desde la fila de encabezados —la que dice
          <em>Área … Tienda … Ayer … Mes</em>— hasta la última tienda, copiá y pegá.
          Solo se toman las filas del ${esc(e.config.area || 'área')}.
        </p>
        <textarea id="pegar-rdv" style="min-height:100px"
          placeholder="Área  #Global  #País  Ciudad  #Ciudad  Formato  Capa  Tienda  Ayer  Semana  Mes  Requerido  Index  …"></textarea>
        <div class="acciones">
          <button class="b" data-accion="importar-rdv">Importar la venta del ${fmtFecha(diarioFecha)}</button>
        </div>
        <div id="resultado-rdv"></div>
        ${calc.venta.conDato ? `<div class="tabla-scroll" style="margin-top:16px"><table>
          <thead><tr><th>Sucursal</th>
            <th class="num">Venta de ayer</th>
            <th class="num" title="Objetivo de venta para ese día">Meta del día</th>
            <th class="num" title="Venta de ayer contra la meta de ese día">Índice del día</th>
            <th class="num" title="Acumulado del mes contra lo requerido">Índice del mes</th>
            <th class="num" title="Transacciones del día">Tickets</th>
            <th class="num" title="Venta del día dividida por la gente que efectivamente estuvo">Venta por persona presente</th>
          </tr></thead>
          <tbody>
            ${calc.filasVenta.map(f => {
              const chipIdx = v => (v === null || v === undefined) ? '—'
                : `<span class="chip ${v >= 0 ? 'verde' : 'rojo'}">${v >= 0 ? '+' : ''}${fmtPct(v, 1)}</span>`;
              const idxDia = f.venta.metaHoy ? f.venta.ayer / f.venta.metaHoy - 1 : null;
              return `<tr>
              <td><strong>${esc(Store.etiquetaSucursal(f.sucursal))}</strong></td>
              <td class="num">${dinero(f.venta.ayer)}</td>
              <td class="num">${f.venta.metaHoy ? dinero(f.venta.metaHoy) : '—'}</td>
              <td class="num">${chipIdx(idxDia)}</td>
              <td class="num">${chipIdx(f.venta.index)}</td>
              <td class="num">${f.venta.transAyer ? fmtNum(f.venta.transAyer, 0) : '—'}</td>
              <td class="num">${f.k && f.k.presentes && f.venta.ayer ? dinero(f.venta.ayer / f.k.presentes) : '<em style="opacity:.6">sin presentismo</em>'}</td>
            </tr>`; }).join('')}
          </tbody>
        </table></div>` : ''}
      </section>


      ${v.conDato ? `<section class="tarjeta">
        <h2>Resumen para copiar</h2>
        <p class="ayuda">
          Solo la venta del día. Lo de presentismo se copia desde su propia pantalla.
        </p>
        <div class="acciones" style="margin-top:0">
          <button class="b" data-accion="copiar-ventas">Copiar el resumen</button>
          <button class="b sec" data-accion="descargar-ventas">Descargar .txt</button>
        </div>
        <pre class="reporte" id="vista-ventas" style="margin-top:14px">${esc(Reporte.textoVentasDia(diarioFecha, e.config))}</pre>
      </section>` : ''}`;
  }

  /* ===================== VISTA: CESIONES Y BAJAS ====================
     Dos listas que el coordinador necesita mirar completas y no tienda por
     tienda: a quién está moviendo y a quién perdió. */
  let movTab = 'cesiones';
  let bajaAbierta = null;     // fila del listado de bajas con la ficha desplegada

  function vistaMovimientos(tab) {
    const e = Store.get();
    contexto = e;
    visitaEnCurso = null;
    movTab = tab === 'bajas' ? 'bajas' : 'cesiones';

    const movs = Store.movimientos().filter(x => x.mov.estado !== 'anulada');
    const bajas = Store.bajas();
    const pendientes = movs.filter(x => x.mov.estado === 'pendiente');
    const porAplicar = movs.filter(x => x.mov.estado === 'autorizada');
    const anio = hoyISO().slice(0, 4);
    const bajasDelAnio = bajas.filter(x => String(x.baja.fecha || '').slice(0, 4) === anio);

    return `
      <h1 class="titulo">Cesiones y bajas</h1>
      <p class="subtitulo">Lo que le pasa a la gente además de trabajar: quién se mueve de tienda,
        a quién le cambia el puesto y quién se fue.</p>

      <div class="kpis">
        ${kpi('Pendientes de autorizar', pendientes.length || '—',
              pendientes.length ? 'esperando tu visto bueno' : 'nada esperando', pendientes.length ? 'aviso' : 'ok')}
        ${kpi('Autorizadas sin aplicar', porAplicar.length || '—',
              porAplicar.length ? 'con vigencia más adelante' : 'todo aplicado')}
        ${kpi('Movimientos registrados', movs.length || '—', 'cesiones y modificaciones')}
        ${kpi(`Bajas ${anio}`, bajasDelAnio.length || '—',
              bajas.length > bajasDelAnio.length ? `${bajas.length} en total` : 'en el listado')}
      </div>

      <nav class="tabs">
        <a href="#/movimientos/cesiones" class="${movTab === 'cesiones' ? 'activo' : ''}">Cesiones y modificaciones</a>
        <a href="#/movimientos/bajas" class="${movTab === 'bajas' ? 'activo' : ''}">Listado de bajas</a>
      </nav>

      ${movTab === 'cesiones' ? panelCesiones(movs) : panelBajas(bajas)}`;
  }

  function panelCesiones(movs) {
    if (!movs.length) {
      return `<section class="tarjeta"><p class="vacio">Todavía no registraste ninguna cesión ni
        modificación. Se cargan desde la ficha de cada persona, en la sucursal.</p></section>`;
    }
    return `<section class="tarjeta">
      <h2>Cesiones y modificaciones</h2>
      <p class="ayuda">La cesión mueve a la persona de tienda cuando se autoriza. Del 1 al 15 el
        costo del mes lo absorbe la tienda de destino; del 16 en adelante, la de origen.</p>
      <div class="tabla-scroll"><table>
        <thead><tr>
          <th>Persona</th><th>Qué</th><th>Detalle</th><th>Vigencia</th><th>Estado</th><th></th>
        </tr></thead>
        <tbody>${movs.map(({ colaborador: c, sucursal: s, mov: m }) => {
          const est = ESTADOS_MOVIMIENTO[m.estado] || ESTADOS_MOVIMIENTO.pendiente;
          return `<tr>
            <td><a href="#/sucursal/${s.id}" style="font-weight:700;color:var(--azul)">${esc(c.nombre)}</a>
              <br><span style="font-size:12px;color:var(--texto-suave)">${esc(c.cargo || c.posicion || '')}</span></td>
            <td class="tipo">${esc((TIPOS_MOVIMIENTO.find(t => t.id === m.tipo) || {}).nombre || m.tipo)}</td>
            <td>${esc(detalleMovimiento(m))}</td>
            <td class="tipo">${m.vigencia ? fmtFecha(m.vigencia) : '—'}</td>
            <td><span class="chip ${est.chip}">${esc(est.nombre)}</span></td>
            <td class="tipo">
              ${m.estado === 'pendiente' ? `<button class="mini" data-accion="autorizar-mov" data-id="${c.id}" data-mov="${m.id}">Autorizar</button>
                <button class="mini" data-accion="anular-mov" data-id="${c.id}" data-mov="${m.id}">Anular</button>` : ''}
              ${m.estado === 'autorizada' ? `<button class="mini" data-accion="aplicar-mov" data-id="${c.id}" data-mov="${m.id}">Aplicar ahora</button>` : ''}
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </section>`;
  }

  function panelBajas(bajas) {
    if (!bajas.length) {
      return `<section class="tarjeta"><p class="vacio">No hay bajas registradas. Se cargan desde
        la ficha de cada persona, con el botón <strong>Baja</strong>.</p></section>`;
    }
    /* El motivo agrupado es lo que después se lleva a la estadística del mes. */
    const porGrupo = {};
    bajas.forEach(x => { const g = x.baja.grupo || 'Sin clasificar'; porGrupo[g] = (porGrupo[g] || 0) + 1; });

    return `<section class="tarjeta">
      <h2>Listado de bajas</h2>
      <p class="ayuda">${Object.keys(porGrupo).map(g => `${esc(g)}: ${porGrupo[g]}`).join(' · ')}.
        Quien está acá no cuenta en la dotación de piso de ninguna tienda.</p>
      <div class="tabla-scroll"><table>
        <thead><tr>
          <th>Baja</th><th>Persona</th><th>Sucursal</th><th>Puesto</th>
          <th>Tipo</th><th>Motivo</th><th class="num">Antigüedad</th><th></th>
        </tr></thead>
        <tbody>${bajas.map(({ colaborador: c, sucursal: s, baja: b }) => {
          const anios = antiguedadAnios(c.fechaIngreso);
          return `<tr>
            <td class="tipo"><strong>${fmtFecha(b.fecha)}</strong></td>
            <td><button class="mini" data-accion="ver-baja" data-id="${c.id}"
                  style="color:var(--azul);border-color:var(--azul)">${esc(c.nombre)}</button></td>
            <td>${esc(s.nombre || s.codigo)}</td>
            <td class="tipo">${esc(c.cargo || c.posicion || '—')}</td>
            <td class="tipo">${esc(b.grupo || '—')}</td>
            <td>${esc(b.motivo || '—')}</td>
            <td class="num">${anios === null ? '—' : fmtNum(anios, 1) + ' años'}</td>
            <td class="tipo"><button class="mini" data-accion="revertir-baja" data-id="${c.id}">Deshacer</button></td>
          </tr>
          ${bajaAbierta === c.id ? `<tr class="ficha-fila"><td colspan="8">${detalleBaja(c, s, b)}</td></tr>` : ''}`;
        }).join('')}</tbody>
      </table></div>
    </section>`;
  }

  /* La ficha completa de quien se fue: es la que se mira cuando alguien
     pregunta por una liquidación final o por qué se fue. */
  function detalleBaja(c, s, b) {
    const anios = antiguedadAnios(c.fechaIngreso);
    const jor = jornadaDeVinculo(c);
    return `<div class="talent-card">
      <div class="tc-cab">
        <div><strong>${esc(c.nombre)}</strong>
          <span>${esc(c.cargo || 'sin cargo')}${c.categoriaConvenio ? ` · ${esc(c.categoriaConvenio)}` : ''}</span></div>
        <span class="chip ambar">baja el ${fmtFecha(b.fecha)}</span>
      </div>
      <div class="grid c4">
        ${dato('Sucursal', s.nombre || s.codigo)}
        ${dato('N° de personal', c.nroPersonal)}
        ${dato('CUIL', c.cuil)}
        ${dato('DNI', c.dni)}
        ${dato('Ingreso', c.fechaIngreso ? fmtFecha(c.fechaIngreso) : '')}
        ${dato('Ingreso a Farmatodo', c.fechaIngresoFTD ? fmtFecha(c.fechaIngresoFTD) : '')}
        ${dato('Antigüedad al irse', anios === null ? '' : `${fmtNum(anios, 1)} años`)}
        ${dato('Jornada', jor.texto)}
        ${dato('Razón social del contrato', c.razonSocialContrato)}
        ${dato('Tipo de baja', b.grupo)}
        ${dato('Motivo', b.motivo)}
        ${dato('Vacaciones del año (art. 24)', `${vacacionesDe(anios).dias} días corridos`)}
      </div>
      ${b.observaciones ? `<p class="ayuda"><strong>Observaciones:</strong> ${esc(b.observaciones)}</p>` : ''}
      ${(c.sanciones || []).length ? `<p class="ayuda"><strong>Sanciones:</strong> ${
        c.sanciones.map(x => `${esc(x.tipo || '')} ${x.fecha ? fmtFecha(x.fecha) : ''}`).join(' · ')}</p>` : ''}
      ${(c.movimientos || []).filter(m => m.estado === 'aplicada').length
        ? `<p class="ayuda"><strong>Movimientos:</strong> ${
            c.movimientos.filter(m => m.estado === 'aplicada')
              .map(m => `${m.vigencia ? fmtFecha(m.vigencia) : ''} ${detalleMovimiento(m)}`).join(' · ')}</p>` : ''}
    </div>`;
  }

  function vistaReclamos() {
    const e = Store.get();
    contexto = e;
    visitaEnCurso = null;

    const cerrado = r => (ESTADOS_RECLAMO_POR_ID[r.estado] || {}).cerrado;
    /* Una sucursal que ya no existe deja el filtro pegado y la pantalla vacía
       sin decir por qué. */
    if (reclamoSuc && !Store.sucursal(reclamoSuc)) reclamoSuc = '';
    const sucFiltro = reclamoSuc ? Store.sucursal(reclamoSuc) : null;

    const area = e.reclamos.slice().sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
    /* Los KPIs y los patrones se leen sobre lo que se está mirando: si se filtró
       una tienda, «4 abiertos» tiene que ser el de esa tienda. */
    const todos = sucFiltro ? area.filter(r => r.sucursalId === reclamoSuc) : area;
    const res = resumirReclamos(todos);
    const patrones = patronesDeReclamos(todos, e.sucursales);

    const lista = reclamoFiltro === 'abiertos' ? todos.filter(r => !cerrado(r))
                : reclamoFiltro === 'cerrados' ? todos.filter(cerrado)
                : todos;

    return `
      <h1 class="titulo">Reclamos de los colaboradores</h1>
      <p class="subtitulo">
        Lo que te plantean cuando vas a la tienda: diferencias de liquidación, categoría,
        adicionales. Es el único lugar donde viven: se registran acá, se siguen acá y
        desde la visita se llega con un clic.
      </p>

      <section class="tarjeta">
        <div class="acciones" style="align-items:flex-end;margin-top:0">
          <label class="campo" style="max-width:300px">
            <span>Sucursal</span>
            <select id="reclamo-filtro-suc">
              <option value="">Toda el ${esc(e.config.area || 'área')}</option>
              ${e.sucursales.map(x => `<option value="${x.id}"${x.id === reclamoSuc ? ' selected' : ''}>${esc(Store.etiquetaSucursal(x))}</option>`).join('')}
            </select>
          </label>
          ${sucFiltro ? `<button class="b sec" data-accion="reclamos-toda-el-area">Ver toda el área</button>` : ''}
        </div>
        ${sucFiltro ? `<p class="ayuda">
          Mostrando solo ${esc(sucFiltro.nombre || sucFiltro.codigo)}. Los indicadores de acá
          abajo son de esa tienda.
        </p>` : ''}
      </section>

      <div class="kpis">
        ${kpi('Abiertos', res.abiertos.length,
              res.total ? `${res.cerrados.length} cerrados en total` : 'sin reclamos registrados',
              res.abiertos.length ? 'aviso' : 'ok')}
        ${kpi('Con más de 15 días', res.criticos.length,
              res.criticos.length ? 'sin respuesta hace demasiado' : 'ninguno se pasó',
              res.criticos.length ? 'alerta' : 'ok')}
        ${kpi('Sin respuesta escrita', res.sinRespuesta.length,
              res.sinRespuesta.length ? 'todavía no se les contestó' : 'todos con respuesta',
              res.sinRespuesta.length ? 'aviso' : 'ok')}
        ${kpi('Demora promedio', res.demoraPromedio === null ? '—' : fmtNum(res.demoraPromedio, 0) + ' días',
              res.demoraPromedio === null ? 'sin reclamos cerrados' : `${res.resueltosAFavor} terminaron en ajuste`)}
      </div>

      ${res.criticos.length ? `<div class="aviso-caja">
        <strong>${res.criticos.length} reclamo${res.criticos.length === 1 ? '' : 's'} lleva${res.criticos.length === 1 ? '' : 'n'} más de 15 días sin cerrar.</strong>
        Lo que rompe la confianza no suele ser el "no": es el silencio.
        <ul>${res.criticos.slice(0, 6).map(r => {
          const su = Store.sucursal(r.sucursalId);
          return `<li>${esc(r.colaborador || 'sin nombre')} · ${esc((TIPOS_RECLAMO_POR_ID[r.tipo] || {}).nombre || r.tipo)}
            · ${su ? esc(su.nombre || su.codigo) : '—'} · ${esc(semaforoReclamo(r).texto)}</li>`;
        }).join('')}</ul>
      </div>` : ''}

      ${patrones.length ? `<div class="aviso-caja info">
        <strong>Se repite el mismo reclamo en la misma sucursal.</strong>
        Dos personas con el mismo concepto no son dos reclamos: son un error de proceso.
        <ul>${patrones.slice(0, 5).map(x => `<li><strong>${esc(x.sucursal)}</strong> · ${esc(x.tipo)}:
          ${x.casos} casos${x.personas.length ? ` (${esc(x.personas.slice(0, 4).join(', '))})` : ''}</li>`).join('')}</ul>
      </div>` : ''}

      <section class="tarjeta">
        <h2>Registrar un reclamo</h2>
        <p class="ayuda">
          Cargalo en el momento, aunque sea con dos datos. Lo que no se anota en la tienda se pierde.
        </p>
        <div class="grid c3">
          <label class="campo"><span>Sucursal</span>
            <select id="reclamo-sucursal">
              ${e.sucursales.map(x => `<option value="${x.id}"${x.id === reclamoSuc ? ' selected' : ''}>${esc(Store.etiquetaSucursal(x))}</option>`).join('')}
            </select></label>
          <label class="campo"><span>Colaborador</span>
            <input id="reclamo-colaborador" placeholder="Apellido y nombre" list="plantel-area"></label>
          <label class="campo"><span>Tipo</span>
            <select id="reclamo-tipo">
              ${TIPOS_RECLAMO.map(t => `<option value="${t.id}">${esc(t.nombre)}</option>`).join('')}
            </select></label>
        </div>
        <datalist id="plantel-area">
          ${(sucFiltro ? (sucFiltro.colaboradores || [])
                       : e.sucursales.reduce((a, x) => a.concat(x.colaboradores || []), []))
            .map(c => `<option value="${esc(c.nombre)}"></option>`).join('')}
        </datalist>
        <div class="acciones">
          <button class="b" data-accion="agregar-reclamo">+ Registrar</button>
        </div>
      </section>

      <section class="tarjeta">
        <h2>${lista.length} reclamo${lista.length === 1 ? '' : 's'}</h2>
        <div class="acciones" style="margin:0 0 14px">
          ${[['abiertos', 'Abiertos'], ['cerrados', 'Cerrados'], ['todos', 'Todos']].map(([k, t]) =>
            `<button class="b ${reclamoFiltro === k ? '' : 'sec'}" data-accion="filtro-reclamos" data-f="${k}">${t}</button>`).join('')}
        </div>
        ${lista.length ? `<div class="tabla-scroll"><table>
          <thead><tr>
            <th>Colaborador</th>${sucFiltro ? '' : '<th>Sucursal</th>'}<th>Tipo</th><th>Planteado</th>
            <th>Estado</th><th>A cargo</th><th class="num">Monto</th><th></th>
          </tr></thead>
          <tbody>
            ${lista.map(r => {
              const su = Store.sucursal(r.sucursalId);
              const sem = semaforoReclamo(r);
              const abierto = reclamoAbierto === r.id;
              return `<tr>
                <td><strong>${esc(r.colaborador || 'Sin nombre')}</strong></td>
                ${sucFiltro ? '' : `<td>${su ? esc(su.nombre || su.codigo) : '—'}</td>`}
                <td>${esc((TIPOS_RECLAMO_POR_ID[r.tipo] || {}).nombre || r.tipo)}</td>
                <td>${r.fecha ? fmtFecha(r.fecha) : '—'}<br>
                  <span class="chip ${sem.tono}">${esc(sem.texto)}</span></td>
                <td>${esc((ESTADOS_RECLAMO_POR_ID[r.estado] || {}).nombre || r.estado)}
                  ${!cerrado(r) && !String(r.respuesta || '').trim() ? '<br><span class="chip ambar">sin respuesta</span>' : ''}</td>
                <td>${esc((A_CARGO_RECLAMO.find(x => x.id === r.aCargo) || {}).nombre || '—')}</td>
                <td class="num">${r.monto ? dinero(r.monto) : '—'}</td>
                <td class="num" style="white-space:nowrap">
                  <button class="mini" data-accion="abrir-reclamo" data-id="${r.id}"
                          style="color:var(--azul);border-color:var(--azul)">${abierto ? 'Cerrar' : 'Ver'}</button>
                  <button class="mini" data-accion="borrar-reclamo" data-id="${r.id}">✕</button>
                </td>
              </tr>
              ${abierto ? fichaReclamo(r, sucFiltro ? 7 : 8) : ''}`;
            }).join('')}
          </tbody>
        </table></div>` : `<p class="vacio">${reclamoFiltro === 'abiertos' ? 'No hay reclamos abiertos.' : 'No hay reclamos para mostrar.'}</p>`}
      </section>`;
  }

  /** Ficha de un reclamo: todo lo que hay que registrar para poder responderlo. */
  function fichaReclamo(r, columnas) {
    const e = Store.get();
    const i = e.reclamos.indexOf(r);
    const ruta = c => `reclamos.${i}.${c}`;
    const sem = semaforoReclamo(r);
    const su = Store.sucursal(r.sucursalId);

    return `<tr class="ficha-fila"><td colspan="${columnas || 8}"><div class="talent-card">
      <div class="tc-cab">
        <div><strong>${esc(r.colaborador || 'Sin nombre')}</strong>
          <span>${esc((TIPOS_RECLAMO_POR_ID[r.tipo] || {}).nombre || r.tipo)}
            ${su ? ` · ${esc(su.nombre || su.codigo)}` : ''}</span></div>
        <span class="chip ${sem.tono}">${esc(sem.texto)}</span>
      </div>

      <div class="grid c3">
        ${campo('Colaborador', ruta('colaborador'), { calc: true })}
        ${campo('Sucursal', ruta('sucursalId'), { tipo: 'select', calc: true,
          opciones: e.sucursales.map(x => ({ valor: x.id, texto: Store.etiquetaSucursal(x) })) })}
        ${campo('Tipo de reclamo', ruta('tipo'), { tipo: 'select', calc: true,
          opciones: TIPOS_RECLAMO.map(t => ({ valor: t.id, texto: t.nombre })) })}
        ${campo('Cuándo lo planteó', ruta('fecha'), { tipo: 'date', calc: true })}
        ${campo('Período reclamado', ruta('periodoAfectado'), { tipo: 'month', placeholder: 'Mes de la liquidación' })}
        ${campo('Monto estimado', ruta('monto'), { tipo: 'number', calc: true })}
      </div>

      <h4>Qué dijo</h4>
      ${campo('', ruta('detalle'), { tipo: 'textarea', alto: 70,
        placeholder: 'Con sus palabras: qué reclama y por qué. Cuanto más textual, más fácil verificarlo después.' })}

      <h4>Seguimiento</h4>
      <div class="grid c3">
        <label class="campo"><span>Estado</span>
          <select data-reclamo-estado="${r.id}">
            ${ESTADOS_RECLAMO.map(x => `<option value="${x.id}"${r.estado === x.id ? ' selected' : ''}>${esc(x.nombre)}</option>`).join('')}
          </select></label>
        ${campo('A cargo de', ruta('aCargo'), { tipo: 'select', calc: true,
          opciones: A_CARGO_RECLAMO.map(x => ({ valor: x.id, texto: x.nombre })) })}
        ${campo('Comprometí respuesta para', ruta('compromisoFecha'), { tipo: 'date', calc: true })}
      </div>

      <h4>Respuesta que se le dio</h4>
      ${campo('', ruta('respuesta'), { tipo: 'textarea', alto: 70, calc: true,
        placeholder: 'Qué se le contestó y cuándo. Aunque la respuesta sea que no procede: eso también hay que decirlo.' })}
      <div class="grid c2" style="margin-top:12px">
        ${campo('Fecha de la respuesta', ruta('fechaRespuesta'), { tipo: 'date', calc: true })}
        ${campo('Fecha de cierre', ruta('fechaCierre'), { tipo: 'date', calc: true })}
      </div>

      ${r.historial.length ? `<h4>Historial</h4>
        <div class="tabla-scroll"><table>
          <thead><tr><th>Fecha</th><th>De</th><th>A</th><th>Nota</th></tr></thead>
          <tbody>${r.historial.slice().reverse().map(h => `<tr>
            <td>${fmtFecha(h.fecha)}</td>
            <td>${esc((ESTADOS_RECLAMO_POR_ID[h.desde] || {}).nombre || h.desde)}</td>
            <td>${esc((ESTADOS_RECLAMO_POR_ID[h.hasta] || {}).nombre || h.hasta)}</td>
            <td>${esc(h.nota || '')}</td>
          </tr>`).join('')}</tbody>
        </table></div>` : ''}
    </div></td></tr>`;
  }

  /* ====================== VISTA: UNA SUCURSAL ====================== *
     Todo lo que hay de una tienda en una sola pantalla: la ficha, el estado
     del mes, el organigrama y el plantel. Es la vista de "entro a la sucursal
     y veo de qué se trata" antes de ir a visitarla. */
  let perfilAbierto = null;
  let formMovimiento = null;   // { colabId, tipo } del formulario de baja o movimiento abierto

  function vistaSucursal(id) {
    const e = Store.get();
    contexto = e;
    const s = Store.sucursal(id);
    if (!s) return `<h1 class="titulo">Sucursal</h1>
      <section class="tarjeta"><p class="vacio">Esa sucursal ya no existe.</p></section>`;

    /* El bloqueo de título y los no presenciales se cuentan aparte: están en la
       nómina y cuestan, pero no cubren un turno. Sumarlos a la dotación hace
       ver una tienda completa donde falta gente para atender. */
    const activos = (s.colaboradores || []).filter(c => c.activo !== false);
    const noPresenciales = activos.filter(c => esNoPresencial(c).noPresencial);
    const plantel = activos.filter(c => !esNoPresencial(c).noPresencial);
    const visitas = Store.visitasDe(s.id);
    const ultima = visitas[0] || null;
    const periodo = (ultima && ultima.periodo) || hoyISO().slice(0, 7);
    const calc = ultima ? Reporte.calcular(ultima, s, e.config) : null;
    const nov = Store.dotacionDelPadron(s.id, periodo);
    const dp = Store.dotacionPlantel(s.id);
    const t9 = distribucion9Box(s.colaboradores);

    const porPosicion = {};
    plantel.forEach(c => {
      const k = c.posicion || 'Sin posición';
      (porPosicion[k] || (porPosicion[k] = [])).push(c);
    });

    return `
      <h1 class="titulo">${esc(s.nombre || s.codigo)}</h1>
      <p class="subtitulo">
        ${esc(s.marca || MARCA_AREA)}${s.localidad ? ' · ' + esc(s.localidad) : ''}
        ${s.direccion ? ' · ' + esc(s.direccion) : ''}
        ${s.rvd ? ` · <span class="chip azul">RVD ${esc(s.rvd)}</span>` : ''}
      </p>

      <div class="kpis">
        ${(() => {
          const sinPos = plantel.filter(c => !c.posicion).length;
          return kpi('Dotación de piso', dp.personas ? fmtNum(dp.fte, 1) + ' FTE' : '—',
            !dp.personas ? 'sin plantel cargado'
              : `${dp.personas} persona${dp.personas === 1 ? '' : 's'}${dp.parciales ? ` · ${dp.parciales} de media jornada` : ''}`,
            sinPos ? 'aviso' : '');
        })()}
        ${kpi('No cubren turno', (dp.noPresenciales.length + dp.sinActividad.length) || '—',
              dp.noPresenciales.length || dp.sinActividad.length
                ? [dp.noPresenciales.length ? `${dp.noPresenciales.length} con bloqueo` : '',
                   dp.sinActividad.length ? `${dp.sinActividad.length} sin actividad` : ''].filter(Boolean).join(' · ')
                : 'toda la nómina está en el piso',
              (dp.noPresenciales.length + dp.sinActividad.length) ? 'aviso' : 'ok')}
        ${kpi('Bajas registradas', dp.bajas.length || '—',
              dp.bajas.length ? 'ya no cuentan en la dotación' : 'ninguna')}
        ${kpi('FTE del mes cerrado', calc && calc.matriz.total.fteReal ? fmtNum(calc.matriz.total.fteReal) : '—',
              ultima ? `visita del ${fmtFecha(ultima.fecha)}` : 'se calcula con la estadística del mes')}
        ${kpi('Ausentismo', calc && calc.ausentismo.pctTotal !== null ? fmtPct(calc.ausentismo.pctTotal) : '—',
              calc ? `${calc.ausentismo.totalDias} días · ${calc.ausentismo.diasGestionables} evitables` : '',
              calc && calc.ausentismo.pctTotal > e.config.parametros.umbralAusentismo ? 'alerta' : 'ok')}
        ${kpi('Horas extras', nov && nov.personas
                ? fmtNum(Object.keys(nov.porPosicion).reduce((a, k) => a + nov.porPosicion[k].horasExtras, 0), 1) + ' h'
                : (calc && calc.matriz.total.horasExtras ? fmtNum(calc.matriz.total.horasExtras, 0) + ' h' : '—'),
              nov && nov.personas ? `novedades de ${esc(periodo)}` : 'según la matriz de FTE')}
        ${(() => {
          const ab = Store.reclamosDe(s.id, true);
          const cr = ab.filter(x => semaforoReclamo(x).clave === 'critico').length;
          /* El número lleva a la pantalla de Reclamos filtrada por esta tienda:
             es el único lugar donde se trabajan, y desde acá se llega en un
             clic sin tener que buscarla en el desplegable. */
          return kpi('Reclamos abiertos',
            `<a href="#/reclamos/${s.id}" style="color:inherit;text-decoration:none">${ab.length}</a>`,
            cr ? `${cr} con más de 15 días · <a href="#/reclamos/${s.id}">verlos</a>`
               : (ab.length ? `en seguimiento · <a href="#/reclamos/${s.id}">verlos</a>`
                            : `ninguno pendiente · <a href="#/reclamos/${s.id}">anotar uno</a>`),
            cr ? 'alerta' : ab.length ? 'aviso' : 'ok');
        })()}
        ${kpi('Evaluados', t9.evaluados.length ? `${t9.evaluados.length} / ${t9.activos.length}` : '—',
              t9.sinEvaluar.length ? `${t9.sinEvaluar.length} sin evaluar` : 'plantel completo',
              t9.sinEvaluar.length ? 'aviso' : 'ok')}
      </div>

      <div class="acciones" style="margin-bottom:18px">
        <button class="b grande" data-accion="nueva-visita" data-id="${s.id}">+ Registrar visita</button>
        ${ultima ? `<a class="b sec" href="#/visita/${ultima.id}/checklist" style="text-decoration:none">Abrir la última visita${
          ultima.fecha ? ` (${fmtFecha(ultima.fecha)})` : ''}</a>` : ''}
        <a class="b sec" href="#/estadistica" style="text-decoration:none">Estadística mensual</a>
      </div>

      ${(() => {
        /* La ficha de la tienda se edita acá y no en otra pantalla. Estaba de
           las dos formas: de solo lectura en esta página y editable dentro de
           una fila desplegable de la tabla de Sucursales. Eran los mismos
           campos dos veces, y para cambiar un mail había que acordarse de en
           cuál de las dos estaba el formulario. */
        const i = e.sucursales.indexOf(s);
        const gops = e.config.gerentesOperaciones || [];
        const editando = fichaSucursal === s.id;
        return `<section class="tarjeta">
          <div class="cabecera-suc">
            <h2>Referentes y datos de la tienda</h2>
            <button class="b sec" data-accion="ficha-sucursal" data-id="${s.id}">${editando ? 'Listo' : 'Editar'}</button>
          </div>

          ${editando ? `
            <h4>Identificación</h4>
            <div class="grid c3">
              ${campo('Nombre de la tienda', `sucursales.${i}.nombre`, { calc: true })}
              ${campo('Código interno', `sucursales.${i}.codigo`)}
              ${campo('Código en el RVD', `sucursales.${i}.rvd`, { placeholder: 'ej. 008' })}
              ${campo('Tipo', `sucursales.${i}.tipo`, { tipo: 'select', calc: true, opciones: [
                { valor: 'venta', texto: '🏪 Tienda' }, { valor: 'staff', texto: '🏢 Staff del área' }] })}
              ${campo('Grupo operador', `sucursales.${i}.operador`, { tipo: 'select', calc: true,
                opciones: [{ valor: '', texto: '—' }].concat(OPERADORES.map(m => ({ valor: m, texto: m }))) })}
              ${campo('Razón social', `sucursales.${i}.razonSocial`)}
              ${campo('CUIT', `sucursales.${i}.cuit`)}
              ${campo('ART', `sucursales.${i}.art`, { tipo: 'select',
                opciones: [{ valor: '', texto: '—' }].concat(ARTS.map(x => ({ valor: x, texto: x }))) })}
            </div>

            <h4>Ubicación y horario</h4>
            <div class="grid c2">
              ${campo('Dirección', `sucursales.${i}.direccion`)}
              ${campo('Localidad o partido', `sucursales.${i}.localidad`)}
            </div>
            <div style="margin-top:12px">${campo('Horario de atención', `sucursales.${i}.horario`, { tipo: 'textarea', alto: 60 })}</div>

            <h4>Referentes</h4>
            <div class="grid c3">
              ${campo('Gerente de Tienda', `sucursales.${i}.gerente`, { calc: true })}
              ${campo('Email del gerente', `sucursales.${i}.emailGerente`, { tipo: 'email', calc: true,
                placeholder: 'recibe copia del reporte' })}
              ${campo('Gerente de Operaciones', `sucursales.${i}.gerenteOperaciones`, { tipo: 'select', calc: true,
                opciones: [{ valor: '', texto: '—' }].concat(gops.map(g => ({ valor: g.nombre, texto: g.nombre }))) })}
              ${campo('Director Técnico', `sucursales.${i}.directorTecnico`)}
              ${campo('Contacto administrativo', `sucursales.${i}.contactoAdmin`)}
              ${campo('Email del contacto', `sucursales.${i}.emailContactoAdmin`, { tipo: 'email' })}
              ${campo('Referente de RRHH', `sucursales.${i}.referenteRRHH`)}
            </div>

            <h4>Notas</h4>
            ${campo('', `sucursales.${i}.notas`, { tipo: 'textarea', alto: 70,
              placeholder: 'Lo que quieras recordar de esta sucursal' })}
          ` : `
            <div class="grid c3">
              ${dato('Gerente de Tienda', s.gerente)}
              ${dato('Director Técnico', s.directorTecnico)}
              ${dato('Gerente de Operaciones', s.gerenteOperaciones)}
              ${dato('Horario', s.horario)}
              ${dato('Razón social', s.razonSocial)}
              ${dato('CUIT', s.cuit)}
              ${dato('ART', s.art)}
              ${dato('Referente de RRHH', s.referenteRRHH)}
              ${dato('Email del gerente', s.emailGerente)}
              ${dato('Dirección', s.direccion)}
              ${dato('Localidad', s.localidad)}
              ${dato('Código en el RVD', s.rvd)}
            </div>
            ${s.notas ? `<div class="aviso-caja info" style="margin-top:14px">${esc(s.notas)}</div>` : ''}
          `}
        </section>`;
      })()}

      <section class="tarjeta">
        <h2>Organigrama</h2>
        <p class="ayuda">
          El plantel que está en el piso, ordenado por posición. Las tarjetas se abren para ver
          el perfil completo.
        </p>

        ${(() => {
          /* El listado corto del área trae nombre y tienda pero no el cargo, así
             que esa gente queda sin puesto. Decirlo acá evita que se lea como
             un error del panel: falta un archivo, no falla una cuenta. */
          const sinCargo = plantel.filter(c => !String(c.cargo || '').trim());
          if (!sinCargo.length) return '';
          return `<div class="aviso-caja">
            <strong>${sinCargo.length} de ${plantel.length} personas no tienen el puesto cargado.</strong>
            Vinieron de un listado que trae el nombre y la tienda pero no el cargo.
            Importá la nómina completa desde <a href="#/nomina">Nómina</a> y se
            completan solas: no se duplica a nadie ni se pierde lo que ya cargaste a mano.
          </div>`;
        })()}
        ${(() => {
          /* Olivos tiene la tienda y el laboratorio en la misma dirección. Son
             dos operaciones distintas y la dotación de piso no es la suma:
             mostrarlo evita leer 26 personas donde el mostrador tiene 13. */
          const u = Object.keys(dp.porUnidad);
          if (u.length < 2) return '';
          return `<div class="aviso-caja info">
            <strong>Acá conviven ${u.length} unidades de negocio.</strong>
            ${u.map(k => `${esc(k)}: ${fmtNum(dp.porUnidad[k], 1)} FTE`).join(' · ')}.
            La dotación de piso de la tienda es la de farmacia; el resto opera aparte.
          </div>`;
        })()}
        ${plantel.length ? organigrama(s, porPosicion) : '<p class="vacio">Todavía no hay plantel cargado. Importá la nómina desde Configuración.</p>'}

        ${noPresenciales.length ? `<h3 style="margin-top:22px">Fuera de la dotación de piso</h3>
          <p class="ayuda">
            Prestan la habilitación profesional que la farmacia necesita para abrir, pero no
            cubren un turno ni reemplazan una ausencia. Están en la nómina y cuestan; no cuentan
            para la cobertura.
          </p>
          <div class="org-grupo">
            ${noPresenciales.map(c => `<button class="org-persona no-presencial${perfilAbierto === c.id ? ' abierta' : ''}"
              data-accion="ver-perfil" data-id="${c.id}" title="Ver el perfil de ${esc(c.nombre)}">
              <strong>${esc(c.nombre)}</strong>
              <span>${esc(c.cargo || c.posicion || '')}</span>
              ${c.categoriaConvenio ? `<span class="cat">${esc(c.categoriaConvenio)}</span>` : ''}
              <span class="chip ambar">${esc(esNoPresencial(c).motivo)}</span>
            </button>`).join('')}
          </div>` : ''}

        ${dp.bajas.length ? `<h3 style="margin-top:22px">Bajas registradas</h3>
          <p class="ayuda">Ya salieron de la dotación y del FTE de la tienda. Si cargaste alguna
            por error, se deshace acá mismo. El detalle completo está en
            <a href="#/movimientos/bajas">Cesiones y bajas</a>.</p>
          <div class="tabla-scroll"><table>
            <thead><tr><th>Baja</th><th>Persona</th><th>Puesto</th><th>Motivo</th><th></th></tr></thead>
            <tbody>${dp.bajas.map(x => `<tr>
              <td class="tipo">${x.fecha ? fmtFecha(x.fecha) : '—'}</td>
              <td><strong>${esc(x.nombre)}</strong></td>
              <td class="tipo">${esc(x.cargo || '—')}</td>
              <td>${esc(x.motivo || '—')}</td>
              <td class="tipo"><button class="mini" data-accion="revertir-baja" data-id="${x.id}">Deshacer la baja</button></td>
            </tr>`).join('')}</tbody>
          </table></div>` : ''}

        ${dp.sinActividad.length ? `<h3 style="margin-top:22px">Sin actividad este mes</h3>
          <p class="ayuda">Siguen en la nómina y vuelven, pero mientras dure esto no hay con
            quién contar en el piso.</p>
          <ul>${dp.sinActividad.map(x => `<li><strong>${esc(x.nombre)}</strong> · ${esc(x.motivo)}</li>`).join('')}</ul>` : ''}
      </section>

      ${perfilAbierto ? perfilColaborador(s, activos.find(c => c.id === perfilAbierto)) : ''}

      <section class="tarjeta">
        <h2>Visitas registradas</h2>
        ${visitas.length ? `<div class="tabla-scroll"><table>
          <thead><tr><th>Fecha</th><th>Período</th><th class="num">FTE</th><th class="num">Ausentismo</th><th>Reporte</th><th></th></tr></thead>
          <tbody>${visitas.map(v => {
            const c = Reporte.calcular(v, s, e.config);
            return `<tr>
              <td><strong>${fmtFecha(v.fecha)}</strong></td>
              <td>${esc(v.periodo || '—')}</td>
              <td class="num">${c.matriz.total.fteReal ? fmtNum(c.matriz.total.fteReal) : '—'}</td>
              <td class="num">${c.ausentismo.pctTotal === null ? '—' : fmtPct(c.ausentismo.pctTotal)}</td>
              <td>${v.envio.enviado ? '<span class="chip verde">enviado</span>' : '<span class="chip ambar">pendiente</span>'}</td>
              <td class="num"><a class="b sec mini" href="#/visita/${v.id}/checklist" style="text-decoration:none">Abrir</a></td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>` : '<p class="vacio">Sin visitas registradas todavía.</p>'}
      </section>`;
  }

  /**
   * Perfil de una persona. Lo que llega de la nómina se muestra como dato;
   * lo que solo puede saber RRHH —los talles de la ropa de trabajo, las notas—
   * es editable.
   */
  function perfilColaborador(s, c) {
    if (!c) return '';
    const i = s.colaboradores.indexOf(c);
    const ruta = campo => `sucursales.${Store.get().sucursales.indexOf(s)}.colaboradores.${i}.${campo}`;
    const anios = antiguedadAnios(c.fechaIngreso);
    const edad = antiguedadAnios(c.fechaNacimiento);
    const q = c.desempeno && c.potencial ? NINE_BOX[`${c.potencial}${c.desempeno}`] : null;

    /* Los períodos con novedades cargadas, del más reciente al más viejo. */
    const periodos = Object.keys(c.novedades || {}).sort().reverse();

    return `
      <section class="tarjeta" id="perfil-colaborador">
        <div class="tc-cab">
          <div>
            <strong style="font-size:17px">${esc(c.nombre || 'Sin nombre')}</strong>
            <span>${esc(c.cargo || c.posicion || 'sin cargo')}${c.nivelCargo && c.nivelCargo !== c.cargo ? ` · ${esc(c.nivelCargo)}` : ''}
              ${c.categoriaConvenio ? ` · convenio ${esc(c.categoriaConvenio)}` : ''}</span>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            ${esNoPresencial(c).noPresencial
              ? `<span class="chip ambar" title="No cubre turno: no cuenta para la dotación de piso">${esc(esNoPresencial(c).motivo)}</span>` : ''}
            ${q ? `<span class="chip azul">${esc(q.nombre)}</span>` : ''}
            ${c.estatus && c.estatus.toUpperCase() !== 'INDETERMINADO' ? `<span class="chip ambar">${esc(c.estatus)}</span>` : ''}
            <button class="mini" data-accion="cerrar-perfil">Cerrar</button>
          </div>
        </div>

        <h4>Identificación</h4>
        <div class="grid c4">
          ${dato('N° de personal', c.nroPersonal)}
          ${dato('Legajo de tienda', c.legajo)}
          ${dato('CUIL', c.cuil)}
          ${dato('DNI', c.dni)}
          ${dato('Sexo', c.sexo)}
          ${dato('Fecha de nacimiento', c.fechaNacimiento ? `${fmtFecha(c.fechaNacimiento)}${edad !== null ? ` · ${Math.floor(edad)} años` : ''}` : '')}
          ${dato('Nacionalidad', c.nacionalidad)}
          ${dato('Estado civil', c.estadoCivil)}
          ${dato('Obra social / prepaga', c.obraSocial)}
          ${dato('Estatus', c.estatus)}
        </div>

        ${fichaConvenio(c, anios)}

        <h4>Vínculo</h4>
        <div class="grid c4">
          ${dato('Ingreso', c.fechaIngreso ? `${fmtFecha(c.fechaIngreso)}${anios !== null ? ` · ${fmtNum(anios, 1)} años` : ''}` : '')}
          ${dato('Ingreso a Farmatodo', c.fechaIngresoFTD ? fmtFecha(c.fechaIngresoFTD) : '')}
          ${dato('Razón social del contrato', c.razonSocialContrato)}
          ${dato('Unidad de negocio', c.unidadNegocio)}
          ${dato('Dirección', c.direccionArea)}
        </div>

        <h4>Contacto</h4>
        <div class="grid c3">
          ${dato('Teléfono', c.telefono)}
          ${dato('Mail corporativo', c.emailCorporativo)}
          ${dato('Mail personal', c.email)}
          ${dato('Domicilio', c.domicilio)}
          ${dato('Localidad y CP', c.localidad)}
        </div>

        ${(c.banco || c.cbu) ? `<h4>Datos bancarios
          <button class="b sec mini" data-accion="ver-banco" data-id="${c.id}" style="margin-left:8px">
            ${bancoVisible === c.id ? 'Ocultar' : 'Mostrar'}</button></h4>
        ${bancoVisible === c.id
          ? `<div class="grid c3">
              ${dato('Banco', c.banco)}
              ${dato('CBU', c.cbu)}
            </div>
            ${c.cbu && !/^\d{22}$/.test(c.cbu) ? `<div class="aviso-caja">
              <strong>Este CBU no sirve como está.</strong>
              ${/e\+/i.test(c.cbu)
                ? 'Excel lo guardó como número y le comió los últimos dígitos: eso no se puede reconstruir.'
                : `Tiene ${String(c.cbu).replace(/\D/g, '').length} dígitos y un CBU tiene 22.`}
              Formateá la columna como texto en la nómina y volvé a importar.
            </div>` : ''}
            <p class="ayuda">El respaldo que se exporta desde Configuración no está cifrado:
              si lo mandás por mail o lo dejás en un pendrive, esto viaja adentro.</p>`
          : '<p class="ayuda">Cargados desde la nómina. Se muestran solo cuando hacen falta.</p>'}` : ''}

        <h4>Ropa de trabajo</h4>
        <p class="ayuda" style="margin:-2px 0 10px">
          La nómina no trae los talles: se cargan acá y quedan guardados.
        </p>
        <div class="grid c4">
          ${TALLES.map(t => campo(t.nombre, ruta('talles.' + t.id), { placeholder: 'S, M, L, 42…' })).join('')}
        </div>

        <h4>Puesto</h4>
        <div class="grid c3">
          <label class="campo"><span>Posición en el panel</span>
            <select data-colab-campo="${c.id}|posicion">
              <option value="">— sin asignar —</option>
              ${POSICIONES.map(pp => `<option value="${esc(pp.nombre)}"${c.posicion === pp.nombre ? ' selected' : ''}>${esc(pp.nombre)}</option>`).join('')}
            </select></label>
          <label class="campo"><span>Desempeño</span>
            <select data-colab-eval="${c.id}|desempeno">
              <option value="">— sin evaluar —</option>
              ${ESCALA_DESEMPENO.map(x => `<option value="${x.valor}"${Number(c.desempeno) === x.valor ? ' selected' : ''}>${x.valor} · ${esc(x.nombre)}</option>`).join('')}
            </select></label>
          <label class="campo"><span>Potencial</span>
            <select data-colab-eval="${c.id}|potencial">
              <option value="">— sin evaluar —</option>
              ${ESCALA_POTENCIAL.map(x => `<option value="${x.valor}"${Number(c.potencial) === x.valor ? ' selected' : ''}>${x.valor} · ${esc(x.nombre)}</option>`).join('')}
            </select></label>
        </div>
        <p class="ayuda" style="margin-top:8px">
          La evaluación se hace junto con el Gerente de Tienda durante la visita, en la solapa
          <em>Talento y 9-box</em>, donde además se puede mover a la persona de cuadrante arrastrándola.
          Lo que cargues acá queda igual y se refleja en el 9-box.
        </p>

        ${fichaMovimientos(c, s)}

        ${talentCard(c, s, { sinCabecera: true })}

        ${fichaLicencias(c)}
        ${fichaSanciones(c)}
        ${fichaAusenciasRegistradas(c)}
        ${fichaAusencias(c, periodos)}
      </section>`;
  }

  /* -------- Baja, cesión de contrato y modificación de puesto --------
     Las tres cosas que le pasan a una persona además de trabajar. Se cargan
     acá, en su ficha, y se leen juntas en “Cesiones y bajas”. */
  function fichaMovimientos(c, s) {
    const movs = (c.movimientos || []).slice().reverse();
    const abierto = formMovimiento && formMovimiento.colabId === c.id ? formMovimiento : null;

    return `<h4>Baja y movimientos</h4>
      ${c.baja ? `<div class="aviso-caja">
        <strong>Baja el ${fmtFecha(c.baja.fecha)}.</strong>
        ${esc(c.baja.grupo || '')}${c.baja.motivo ? ' · ' + esc(c.baja.motivo) : ''}.
        ${c.baja.observaciones ? esc(c.baja.observaciones) : ''}
        <div class="acciones">
          <button class="b sec" data-accion="revertir-baja" data-id="${c.id}">Deshacer la baja</button>
        </div>
      </div>` : `<div class="acciones" style="margin-top:0">
        <button class="b sec" data-accion="form-mov" data-id="${c.id}" data-tipo="baja">Baja</button>
        <button class="b sec" data-accion="form-mov" data-id="${c.id}" data-tipo="cesion">Cesión de contrato</button>
        <button class="b sec" data-accion="form-mov" data-id="${c.id}" data-tipo="modificacion">Modificación</button>
      </div>`}

      ${abierto ? formularioMovimiento(c, s, abierto.tipo) : ''}

      ${movs.length ? `<div class="tabla-scroll" style="margin-top:14px"><table>
        <thead><tr><th>Vigencia</th><th>Qué</th><th>Detalle</th><th>Estado</th><th></th></tr></thead>
        <tbody>${movs.map(m => {
          const est = ESTADOS_MOVIMIENTO[m.estado] || ESTADOS_MOVIMIENTO.pendiente;
          return `<tr>
            <td class="tipo">${m.vigencia ? fmtFecha(m.vigencia) : fmtFecha(m.fecha)}</td>
            <td class="tipo">${esc((TIPOS_MOVIMIENTO.find(t => t.id === m.tipo) || {}).nombre || m.tipo)}</td>
            <td>${esc(detalleMovimiento(m))}</td>
            <td><span class="chip ${est.chip}">${esc(est.nombre)}</span></td>
            <td class="tipo">
              ${m.estado === 'pendiente' ? `<button class="mini" data-accion="autorizar-mov" data-id="${c.id}" data-mov="${m.id}">Autorizar</button>
                <button class="mini" data-accion="anular-mov" data-id="${c.id}" data-mov="${m.id}">Anular</button>` : ''}
              ${m.estado === 'autorizada' ? `<button class="mini" data-accion="aplicar-mov" data-id="${c.id}" data-mov="${m.id}">Aplicar ahora</button>` : ''}
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>` : ''}`;
  }

  /** Una línea que diga qué cambia, para leer la tabla sin abrir nada. */
  function detalleMovimiento(m) {
    if (m.tipo === 'cesion') {
      const d = Store.sucursal(m.desdeSucursalId), h = Store.sucursal(m.haciaSucursalId);
      const costo = tiendaQueAbsorbeElCosto(m.vigencia);
      return `${d ? (d.nombre || d.codigo) : '—'} → ${h ? (h.nombre || h.codigo) : '—'}` +
             (costo ? ` · el costo del mes lo absorbe la tienda de ${costo}` : '') +
             (m.observaciones ? ` · ${m.observaciones}` : '');
    }
    const partes = [];
    if (m.cargoNuevo) partes.push(`${m.cargoAnterior || 'sin cargo'} → ${m.cargoNuevo}`);
    if (m.jornadaNueva && Number(m.jornadaNueva) !== Number(m.jornadaAnterior)) {
      partes.push(`jornada ${m.jornadaAnterior === 0.5 ? 'parcial' : 'completa'} → ${Number(m.jornadaNueva) === 0.5 ? 'parcial' : 'completa'}`);
    }
    if (m.observaciones) partes.push(m.observaciones);
    return partes.join(' · ') || '—';
  }

  function formularioMovimiento(c, s, tipo) {
    const hoy = hoyISO();
    if (tipo === 'baja') {
      return `<div class="aviso-caja info" style="margin-top:12px">
        <strong>Baja de ${esc(c.nombre)}</strong>
        <div class="grid c3" style="margin-top:10px">
          <label class="campo"><span>Fecha de la baja</span>
            <input type="date" id="mov-fecha" value="${hoy}"></label>
          <label class="campo"><span>Tipo</span>
            <select id="mov-grupo">
              ${MOTIVOS_BAJA.map(g => `<option value="${esc(g.nombre)}">${esc(g.nombre)}</option>`).join('')}
            </select></label>
          <label class="campo"><span>Motivo</span>
            <select id="mov-motivo">
              ${MOTIVOS_BAJA.map(g => `<optgroup label="${esc(g.nombre)}">${
                g.motivos.map(x => `<option value="${esc(x)}" data-grupo="${esc(g.nombre)}">${esc(x)}</option>`).join('')
              }</optgroup>`).join('')}
            </select></label>
        </div>
        <label class="campo"><span>Observaciones</span>
          <textarea id="mov-obs" style="min-height:60px" placeholder="Lo que haga falta dejar dicho"></textarea></label>
        <div class="acciones">
          <button class="b" data-accion="guardar-baja" data-id="${c.id}">Registrar la baja</button>
          <button class="b sec" data-accion="cerrar-form-mov">Cancelar</button>
        </div>
      </div>`;
    }

    if (tipo === 'cesion') {
      const otras = Store.get().sucursales.filter(x => x.id !== s.id);
      return `<div class="aviso-caja info" style="margin-top:12px">
        <strong>Cesión de contrato de ${esc(c.nombre)}</strong>
        <div class="grid c3" style="margin-top:10px">
          ${dato('Sucursal actual', s.nombre || s.codigo)}
          <label class="campo"><span>Nueva sucursal destino</span>
            <select id="mov-destino">
              <option value="">— elegir —</option>
              ${otras.map(x => `<option value="${x.id}">${esc(x.nombre || x.codigo)}</option>`).join('')}
            </select></label>
          <label class="campo"><span>Vigencia</span>
            <input type="date" id="mov-vigencia" value="${hoy}"></label>
        </div>
        <label class="campo"><span>Observaciones</span>
          <textarea id="mov-obs" style="min-height:60px"
            placeholder="Nota del empleado, conformidad del gerente que lo recibe, lo que corresponda"></textarea></label>
        <p class="ayuda">Del 1 al 15 el costo del mes lo absorbe la tienda de destino; del 16 en
          adelante, la de origen. Al autorizarla la persona pasa al plantel de la tienda nueva;
          si la vigencia es futura, queda autorizada y se aplica ese día.</p>
        <div class="acciones">
          <button class="b" data-accion="guardar-mov" data-id="${c.id}" data-tipo="cesion">Registrar la cesión</button>
          <button class="b sec" data-accion="cerrar-form-mov">Cancelar</button>
        </div>
      </div>`;
    }

    const jor = jornadaDeVinculo(c);
    return `<div class="aviso-caja info" style="margin-top:12px">
      <strong>Modificación de ${esc(c.nombre)}</strong>
      <div class="grid c3" style="margin-top:10px">
        ${dato('Cargo actual', c.cargo || 'sin cargo')}
        <label class="campo"><span>Cargo nuevo</span>
          <input id="mov-cargo" placeholder="Dejalo vacío si no cambia"></label>
        <label class="campo"><span>Jornada nueva</span>
          <select id="mov-jornada">
            <option value="1"${jor.fte === 1 ? ' selected' : ''}>Completa · 1 FTE</option>
            <option value="0.5"${jor.fte === 0.5 ? ' selected' : ''}>Parcial · 0,5 FTE</option>
          </select></label>
        <label class="campo"><span>Vigencia</span>
          <input type="date" id="mov-vigencia" value="${hoy}"></label>
      </div>
      <label class="campo"><span>Observaciones</span>
        <textarea id="mov-obs" style="min-height:60px"
          placeholder="Evaluación del líder que lo recibe, apto médico, lo que avale el cambio"></textarea></label>
      <p class="ayuda">La modificación de haberes se carga en RyR Online antes del 20 de cada mes
        para que rija desde el mes siguiente. Esto es el registro del área, no reemplaza esa carga.</p>
      <div class="acciones">
        <button class="b" data-accion="guardar-mov" data-id="${c.id}" data-tipo="modificacion">Registrar la modificación</button>
        <button class="b sec" data-accion="cerrar-form-mov">Cancelar</button>
      </div>
    </div>`;
  }

  /* ------------------ Encuadre en el convenio 414/05 ------------------ */
  function fichaConvenio(c, anios) {
    const cat = categoriaCct(c.categoriaConvenio || c.cargo);
    const jor = jornadaDeVinculo(c);
    const esc2 = escalafonDe(anios);
    const vac = vacacionesDe(anios);
    const faltaNomina = !String(c.cargo || '').trim() && !String(c.categoriaConvenio || '').trim();

    return `<h4>Puesto y encuadre</h4>
      ${faltaNomina ? `<div class="aviso-caja">
        <strong>No tiene cargado el puesto.</strong> Esta persona vino de un listado que no trae
        el cargo. Importá la nómina completa desde <a href="#/nomina">Nómina</a> y se
        completan el cargo, el nivel y la categoría del convenio.
      </div>` : ''}
      <div class="grid c4">
        ${dato('Cargo', c.cargo)}
        ${dato('Nivel de cargo', c.nivelCargo)}
        ${dato('Categoría de la nómina', c.categoriaConvenio)}
        <label class="campo"><span>Jornada</span>
          <select data-colab-campo="${c.id}|jornada">
            ${[['1', 'Completa · 1 FTE'], ['0.5', 'Parcial · 0,5 FTE']].map(([v, t]) =>
              `<option value="${v}"${String(jor.fte) === v ? ' selected' : ''}>${t}</option>`).join('')}
          </select></label>
        ${dato('Categoría del convenio', cat ? `${cat.nombre} (art. ${cat.articulo || '—'})` : '')}
        ${dato('Antigüedad', anios ? `${fmtNum(anios, 1)} años` : '')}
        ${dato('Escalafón por antigüedad (art. 13)', esc2.pct ? fmtPct(esc2.pct, 0) : 'todavía sin escalafón')}
        ${dato('Vacaciones al año (art. 24)', `${vac.dias} días corridos`)}
      </div>
      <p class="ayuda">${jor.parcial
        ? 'Cuenta medio FTE en la dotación: dos personas de media jornada cubren un puesto.'
        : 'Cuenta un FTE en la dotación de la tienda.'} Sale del cargo de la nómina; si está mal, corregilo acá.</p>
      ${cat && cat.detalle ? `<p class="ayuda">${esc(CCT.nombre)} · ${esc(cat.detalle)}</p>` : ''}
      ${esc2.proximo ? `<p class="ayuda">Pasa al ${fmtPct(esc2.proximo.pct, 0)} de escalafón
        ${esc2.faltanAnios === 0 ? 'este año' : `en ${esc2.faltanAnios} año${esc2.faltanAnios === 1 ? '' : 's'}`}.
        ${vac.proximo ? `Las vacaciones suben a ${vac.proximo.dias} días
          ${vac.faltanAnios <= 0 ? 'este año' : `en ${vac.faltanAnios} año${vac.faltanAnios === 1 ? '' : 's'}`}.` : ''}</p>` : ''}`;
  }

  /* ----------------- Licencias especiales y sus topes -----------------
     La razón de esta ficha: la licencia por estudio son dos días por examen
     hasta diez al año. Sin registro de lo que se fue tomando, nadie sabe
     cuánto le queda, y la pregunta aparece en el mostrador. */
  function fichaLicencias(c) {
    const anio = licenciaAnio || String(new Date().getFullYear());
    const saldo = saldoLicencias(c, anio);
    const alertas = alertasLicencias(c, anio);
    const propias = (c.licencias || [])
      .filter(l => String(l.desde || '').slice(0, 4) === anio)
      .sort((a, b) => String(b.desde).localeCompare(String(a.desde)));

    /* Los años con algo cargado, más el corriente. */
    const anios = Array.from(new Set(
      (c.licencias || []).map(l => String(l.desde || '').slice(0, 4))
        .concat(Object.keys(c.novedades || {}).map(p => p.slice(0, 4)))
        .concat([String(new Date().getFullYear())])
    )).filter(Boolean).sort().reverse();

    return `<h4>Licencias especiales del art. 25 · año
        <select id="licencia-anio" style="width:auto;display:inline-block;margin-left:6px">
          ${anios.map(a => `<option value="${a}"${a === anio ? ' selected' : ''}>${a}</option>`).join('')}
        </select></h4>

      ${alertas.length ? `<div class="aviso-caja${alertas.some(a => a.nivel === 'alerta') ? '' : ' info'}">
        <ul>${alertas.map(a => `<li>${esc(a.texto)}</li>`).join('')}</ul>
      </div>` : ''}

      <div class="tabla-scroll"><table>
        <thead><tr>
          <th>Licencia</th><th>Art.</th>
          <th class="num" title="Días que trajo el libro de novedades de liquidación">De liquidación</th>
          <th class="num" title="Días cargados a mano en esta ficha">A mano</th>
          <th class="num">Usados</th><th class="num">Tope del año</th><th class="num">Le quedan</th>
        </tr></thead>
        <tbody>
          ${saldo.map(x => `<tr${x.excedido ? ' class="fila-alerta"' : ''}>
            <td><strong>${esc(x.licencia.nombre)}</strong>
              ${x.licencia.porEvento ? `<br><span class="nota" style="font-size:11.5px;color:var(--texto-suave)">${x.licencia.porEvento} ${esc(x.licencia.unidad)} por vez</span>` : ''}</td>
            <td>${esc(x.licencia.articulo)}</td>
            <td class="num">${x.deLiquidacion || '—'}${x.periodos.length ? `<br><span class="nota" style="font-size:11px;color:var(--texto-suave)">${esc(x.periodos.join(' · '))}</span>` : ''}</td>
            <td class="num">${x.aMano || '—'}</td>
            <td class="num"><strong>${x.usados || '—'}</strong></td>
            <td class="num">${x.tope === null ? 'por evento' : x.tope}</td>
            <td class="num">${x.tope === null ? '—'
              : `<span class="chip ${x.restante === 0 ? 'rojo' : x.restante <= 2 ? 'ambar' : 'verde'}">${x.restante}</span>`}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>

      <p class="ayuda">
        Lo que trae la liquidación se cuenta solo. Cargá a mano únicamente lo que la
        liquidación todavía no muestra: una licencia de este mes se liquida el mes que
        viene, y la pregunta del colaborador es hoy.
      </p>

      ${propias.length ? `<div class="tabla-scroll"><table>
        <thead><tr><th>Desde</th><th>Licencia</th><th class="num">Días</th><th>Motivo</th><th class="num">Comprobante</th><th></th></tr></thead>
        <tbody>${propias.map(l => `<tr>
          <td><input type="date" data-lic="${c.id}|${l.id}|desde" value="${esc(l.desde || '')}"></td>
          <td><select data-lic="${c.id}|${l.id}|tipo">
            ${LICENCIAS_CCT.map(x => `<option value="${x.id}"${l.tipo === x.id ? ' selected' : ''}>${esc(x.nombre)}</option>`).join('')}
          </select></td>
          <td class="num"><input class="num" type="number" min="0" step="1" style="width:70px"
            data-lic="${c.id}|${l.id}|dias" value="${esc(l.dias ?? '')}"></td>
          <td><input data-lic="${c.id}|${l.id}|motivo" value="${esc(l.motivo || '')}"
            placeholder="${esc((LICENCIAS_CCT_POR_ID[l.tipo] || {}).comprobante || 'Detalle')}"></td>
          <td class="num"><input type="checkbox" data-lic-check="${c.id}|${l.id}|comprobante"${l.comprobante ? ' checked' : ''}></td>
          <td class="num"><button class="b peligro mini" data-accion="quitar-licencia" data-id="${c.id}" data-lic="${l.id}">Quitar</button></td>
        </tr>`).join('')}</tbody>
      </table></div>` : ''}

      <div class="acciones">
        <button class="b sec mini" data-accion="agregar-licencia" data-id="${c.id}">+ Registrar una licencia</button>
      </div>`;
  }

  /* --------------------- Sanciones disciplinarias --------------------- */
  function fichaSanciones(c) {
    const propias = (c.sanciones || [])
      .slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    const deEstadistica = Store.sancionesDeEstadistica(c.nombre);
    const ultimos12 = propias.filter(x => {
      const d = (new Date() - new Date(x.fecha)) / 864e5;
      return d >= 0 && d <= 365;
    });

    return `<h4>Sanciones disciplinarias</h4>
      ${ultimos12.length >= 2 ? `<div class="aviso-caja">
        <strong>${ultimos12.length} sanciones en los últimos 12 meses.</strong>
        La progresividad se mide sobre este período: revisá que la graduación tenga
        secuencia antes de aplicar una nueva.
      </div>` : ''}

      ${propias.length ? `<div class="tabla-scroll"><table>
        <thead><tr><th>Fecha</th><th>Tipo</th><th>Motivo</th><th class="num">Días</th><th class="num">Notificada</th><th>Nota</th><th></th></tr></thead>
        <tbody>${propias.map(x => `<tr>
          <td><input type="date" data-san="${c.id}|${x.id}|fecha" value="${esc(x.fecha || '')}"></td>
          <td><select data-san="${c.id}|${x.id}|tipo">
            ${TIPOS_SANCION.map(t => `<option value="${esc(t)}"${x.tipo === t ? ' selected' : ''}>${esc(t)}</option>`).join('')}
          </select></td>
          <td><select data-san="${c.id}|${x.id}|motivo">
            <option value="">—</option>
            ${MOTIVOS_SANCION.map(m => `<option value="${esc(m)}"${x.motivo === m ? ' selected' : ''}>${esc(m)}</option>`).join('')}
          </select></td>
          <td class="num"><input class="num" type="number" min="0" step="1" style="width:60px"
            data-san="${c.id}|${x.id}|dias" value="${esc(x.dias ?? '')}"
            title="Días de suspensión, si corresponde"></td>
          <td class="num"><input type="checkbox" data-san-check="${c.id}|${x.id}|notificada"${x.notificada ? ' checked' : ''}></td>
          <td><input data-san="${c.id}|${x.id}|nota" value="${esc(x.nota || '')}" placeholder="Qué pasó"></td>
          <td class="num"><button class="b peligro mini" data-accion="quitar-sancion-colab" data-id="${c.id}" data-san="${x.id}">Quitar</button></td>
        </tr>`).join('')}</tbody>
      </table></div>` : '<p class="vacio">Sin sanciones registradas.</p>'}

      <div class="acciones">
        <button class="b sec mini" data-accion="agregar-sancion-colab" data-id="${c.id}">+ Registrar una sanción</button>
      </div>

      ${deEstadistica.length ? `<div class="aviso-caja info" style="margin-top:12px">
        <strong>Además figura en la estadística mensual:</strong>
        <ul>${deEstadistica.map(x => `<li>${esc(x.periodo || '')} · ${esc(x.tipo || '')}
          ${x.motivo ? '· ' + esc(x.motivo) : ''}</li>`).join('')}</ul>
        Eso se carga y se corrige en la estadística del período; acá se muestra
        para que el legajo esté completo.
      </div>` : ''}`;
  }

  /* --------- Lo que se cargó en Presentismo, en la ficha ----------
     Las ausencias viven en `c.ausencias`, o sea que ya cuelgan de la persona:
     lo que faltaba era mostrárselas acá. Es el historial que se mira cuando
     alguien pregunta «¿cuánto faltó este año?», y el que acompaña a la persona
     si se muda de tienda. */
  function fichaAusenciasRegistradas(c) {
    const hoy = hoyISO();
    const todas = (c.ausencias || []).slice()
      .sort((a, b) => String(b.desde || '').localeCompare(String(a.desde || '')));

    if (!todas.length) {
      return `<h4>Licencias y ausencias registradas</h4>
        <p class="vacio">No tiene ninguna cargada.
          <a href="#/diario/${c.id}">Registrar una</a>.</p>`;
    }

    const r = ausenciasPorMes(c, hoy);
    const nombreMotivo = id => (MOTIVOS_AUSENCIA_LARGA.find(m => m.id === id) || {}).nombre || id;
    /* Solo las columnas que esta persona usó: una tabla con seis licencias en
       cero no dice nada que el «—» no diga mejor. */
    const motivos = MOTIVOS_AUSENCIA_LARGA.filter(m => r.porMotivo[m.id]);

    return `<h4>Licencias y ausencias registradas
        <span class="chip${r.abiertas ? ' ambar' : ''}">${r.total} día${r.total === 1 ? '' : 's'} en total</span>
        ${r.sinJustificar ? `<span class="chip rojo">${r.sinJustificar} sin justificar</span>` : ''}</h4>

      <div class="tabla-scroll"><table>
        <thead><tr><th>Mes</th>${motivos.map(m => `<th class="num">${esc(m.nombre)}</th>`).join('')}
          <th class="num">Días</th></tr></thead>
        <tbody>${r.periodos.map(per => `<tr>
          <td><strong>${esc(per)}</strong></td>
          ${motivos.map(m => `<td class="num">${r.porMes[per].motivos[m.id] || '—'}</td>`).join('')}
          <td class="num"><strong>${r.porMes[per].total}</strong></td>
        </tr>`).join('')}</tbody>
        <tfoot><tr class="total"><td><strong>Total</strong></td>
          ${motivos.map(m => `<td class="num">${r.porMotivo[m.id] || '—'}</td>`).join('')}
          <td class="num"><strong>${r.total}</strong></td></tr></tfoot>
      </table></div>

      <div class="tabla-scroll" style="margin-top:12px"><table>
        <thead><tr><th>Licencia</th><th>Desde</th><th>Hasta</th><th class="num">Días</th>
          <th>Certificado</th><th>Situación</th></tr></thead>
        <tbody>${todas.map(a => {
          const est = estadoDeAusencia(a, hoy);
          return `<tr${a.reincorporado ? ' class="inactivo"' : ''}>
            <td><strong>${esc(nombreMotivo(a.motivo))}</strong>
              ${a.diagnostico ? `<div style="font-size:11.5px;color:var(--texto-suave)">${esc(a.diagnostico)}</div>` : ''}</td>
            <td class="tipo">${a.desde ? fmtFecha(a.desde) : '—'}</td>
            <td class="tipo">${a.hasta ? fmtFecha(a.hasta) : '—'}</td>
            <td class="num">${diasDeAusencia(a, hoy) || '—'}</td>
            <td class="tipo">${tieneCertificado(a)
              ? '<span class="chip verde">presentado</span>'
              : '<span class="chip rojo">no lo trajo</span>'}</td>
            <td><span class="chip ${est.tono}">${esc(est.texto)}</span></td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>

      <p class="ayuda">
        Sale de lo que cargás en <a href="#/diario/${c.id}">Presentismo</a>. Los días se
        reparten por mes: una licencia del 25 de agosto al 5 de septiembre son días de los
        dos meses, no del primero. Lo que todavía no pasó no se cuenta: un certificado
        hasta el 20 no son días de ausencia el 16.
      </p>`;
  }

  /* ------------- Historial de ausencias mes a mes ------------- */
  function fichaAusencias(c, periodos) {
    if (!periodos.length) {
      return `<h4>Ausencias mes a mes</h4>
        <p class="vacio">Todavía no se importaron novedades de liquidación de esta persona.</p>`;
    }
    const col = [
      ['enfermedad', 'Enfermedad'], ['vacaciones', 'Vacaciones'],
      ['noJustificada', 'Sin aviso'], ['examen', 'Examen'],
      ['fallecimiento', 'Fallec.'], ['mudanza', 'Mudanza'], ['gremio', 'Gremial']
    ];
    const tot = {};
    col.forEach(([k]) => { tot[k] = periodos.reduce((s, p) => s + (+c.novedades[p][k] || 0), 0); });
    const totHe = periodos.reduce((s, p) => s + (+c.novedades[p].he50 || 0) + (+c.novedades[p].he100 || 0), 0);

    return `<h4>Ausencias mes a mes</h4>
      <div class="tabla-scroll"><table>
        <thead><tr><th>Período</th>${col.map(([, t]) => `<th class="num">${t}</th>`).join('')}
          <th class="num">Total</th><th class="num">Hs. extras</th><th>Observaciones</th></tr></thead>
        <tbody>${periodos.map(pp => {
          const n = c.novedades[pp];
          const total = col.reduce((s, [k]) => s + (+n[k] || 0), 0);
          return `<tr>
            <td><strong>${esc(pp)}</strong></td>
            ${col.map(([k]) => `<td class="num">${(+n[k] || 0) || '—'}</td>`).join('')}
            <td class="num"><strong>${total || '—'}</strong></td>
            <td class="num">${fmtNum((+n.he50 || 0) + (+n.he100 || 0), 1)}</td>
            <td>${esc(n.obs || '')}</td>
          </tr>`;
        }).join('')}</tbody>
        <tfoot><tr class="total"><td><strong>Total</strong></td>
          ${col.map(([k]) => `<td class="num">${tot[k] || '—'}</td>`).join('')}
          <td class="num"><strong>${col.reduce((s, [k]) => s + tot[k], 0) || '—'}</strong></td>
          <td class="num">${fmtNum(totHe, 1)}</td><td></td></tr></tfoot>
      </table></div>
      <p class="ayuda">
        Sale del libro de novedades de liquidación que se importa en la estadística
        mensual. Examen, fallecimiento, mudanza y gremial alimentan además el contador
        de topes del convenio de acá arriba.
      </p>`;
  }

  const dato = (etiqueta, valor) => `<div class="campo-lectura">
    <span>${esc(etiqueta)}</span><strong>${valor ? esc(valor) : '—'}</strong></div>`;

  /** Organigrama simple: el gerente arriba, y debajo cada posición en su nivel. */
  function organigrama(s, porPosicion) {
    const niveles = [1, 2, 3];
    const posicionesDe = n => POSICIONES.filter(p => p.nivel === n && porPosicion[p.nombre]);
    const sueltos = Object.keys(porPosicion).filter(k => !POSICIONES.some(p => p.nombre === k));

    const especial = c => c.estatus && c.estatus.toUpperCase() !== 'INDETERMINADO';
    const tarjeta = c => `<button class="org-persona${perfilAbierto === c.id ? ' abierta' : ''}"
        data-accion="ver-perfil" data-id="${c.id}" title="Ver el perfil de ${esc(c.nombre)}">
      <strong>${esc(c.nombre || 'Sin nombre')}</strong>
      <span>${c.cargo ? esc(c.cargo) : (c.posicion ? esc(c.posicion) : '<em>sin puesto cargado</em>')}</span>
      ${c.categoriaConvenio ? `<span class="cat">${esc(c.categoriaConvenio)}</span>` : ''}
      ${jornadaDeVinculo(c).parcial ? '<span class="chip azul" style="margin-top:4px">media jornada · 0,5 FTE</span>' : ''}
      ${especial(c) ? `<span class="chip ambar" style="margin-top:4px">${esc(c.estatus)}</span>`
                    : (c.fechaIngreso ? `<span>desde ${fmtFecha(c.fechaIngreso)}</span>` : '')}
    </button>`;

    /* El título del grupo cuenta cabezas y FTE: con tiempo parcial no son lo
       mismo, y la que decide la cobertura es la segunda. */
    const grupo = (nombre, gente) => `<div class="org-grupo">
      <h4>${esc(nombre)} <span class="chip">${gente.length}</span>${(() => {
        const f = gente.reduce((a, c) => a + jornadaDeVinculo(c).fte, 0);
        return f === gente.length ? '' : ` <span class="chip azul">${fmtNum(f, 1)} FTE</span>`;
      })()}</h4>
      <div class="org-fila">${gente.map(tarjeta).join('')}</div>
    </div>`;

    return `<div class="organigrama">
      ${niveles.map(n => {
        const pos = posicionesDe(n);
        if (!pos.length) return '';
        return `<div class="org-nivel${n === 1 ? ' cima' : ''}">
          ${pos.map(p => grupo(p.nombre, porPosicion[p.nombre])).join('')}
        </div>`;
      }).join('')}
      ${sueltos.map(k => `<div class="org-nivel">${grupo(k, porPosicion[k])}</div>`).join('')}
    </div>`;
  }

  /* ===================== VISTA: INFORME MENSUAL ==================== *
     La estadística del mes es de la sucursal, no de una visita: consolida todas
     las visitas del período. Por eso vive acá y no adentro de una visita. */
  let estadSuc = null;
  let estadPeriodo = null;

  const PESTANAS_ESTAD = [
    ['resumen',    'Resumen del mes'],
    ['minutas',    'Minutas'],
    ['fte',        'FTE y Costo'],
    ['ausentismo', 'Ausentismo'],
    ['rotacion',   'Rotación y Bajas'],
    ['sanciones',  'Sanciones'],
    ['dotacion',   'Dotación vs. Venta'],
    ['reporte',    'Reporte y Envío']
  ];

  function vistaEstadistica(pestana) {
    const e = Store.get();
    contexto = e;
    visitaEnCurso = null;
    pestana = pestana || 'resumen';

    if (!estadSuc && e.sucursales.length) estadSuc = e.sucursales[0].id;
    const s = estadSuc ? Store.sucursal(estadSuc) : null;
    if (!s) {
      return `<h1 class="titulo">Estadística mensual</h1>
        <section class="tarjeta"><p class="vacio">Cargá primero una sucursal.</p></section>`;
    }

    /* El período es un mes libre: se puede mirar uno que todavía no tenga nada
       cargado. Los períodos con datos solo alimentan las sugerencias. */
    const periodos = Store.periodosDe(s.id);
    if (!estadPeriodo) estadPeriodo = periodos[0] || new Date().toISOString().slice(0, 7);

    const d = Reporte.datosMensuales(s.id, estadPeriodo, e.config);
    const c = d.calculo;
    const faltantes = Reporte.faltantesMensuales(d);
    const registro = Store.informeDe(s.id, estadPeriodo);
    const dest = Reporte.destinatario(s, e.config);
    const cc = Reporte.copias(s, e.config);

    /* Todas las solapas menos el resumen editan el registro del período. Si el
       mes todavía no tiene ninguno no hay dónde escribir, así que se ofrece
       crearlo en lugar de mostrar campos que no guardan nada. */
    const v = d.sinVisita ? null : d.base;
    if (v) { contexto = v; visitaEnCurso = v; }

    const cabecera = `
      <h1 class="titulo">Estadística mensual</h1>
      <p class="subtitulo">
        Los números del mes de la sucursal. Lo de todas las semanas está en <em>Visitas</em>.
      </p>

      <section class="tarjeta">
        <div class="grid c3">
          <label class="campo"><span>Sucursal</span>
            <select id="estad-sucursal">
              ${e.sucursales.map(x => `<option value="${x.id}"${x.id === s.id ? ' selected' : ''}>${esc(Store.etiquetaSucursal(x))}</option>`).join('')}
            </select></label>
          <label class="campo"><span>Período</span>
            <input type="month" id="estad-periodo" value="${esc(estadPeriodo)}" list="periodos-cargados">
            <datalist id="periodos-cargados">
              ${periodos.map(x => `<option value="${esc(x)}"></option>`).join('')}
            </datalist></label>
          <div style="display:flex;align-items:flex-end">
            <p class="ayuda" style="margin:0">
              ${d.visitas.length
                ? `${d.visitas.length} visita${d.visitas.length === 1 ? '' : 's'} en el período: ${d.visitas.map(x => fmtFecha(x.fecha)).join(', ')}.`
                : 'El período todavía no tiene visitas cargadas.'}
            </p>
          </div>
        </div>
      </section>

      <nav class="tabs" style="border-radius:10px;border:1px solid var(--borde);margin-bottom:18px">
        ${PESTANAS_ESTAD.map(([k, t]) => `<a href="#/estadistica/${k}" class="${k === pestana ? 'activo' : ''}">${t}</a>`).join('')}
      </nav>`;

    if (pestana !== 'resumen' && !v) {
      return cabecera + `<section class="tarjeta">
        <div class="aviso-caja">
          <strong>${esc(estadPeriodo)} no tiene todavía un registro donde guardar estos datos.</strong>
          La estadística se apoya en el relevamiento del período; creá uno y quedan
          todas las solapas disponibles.
          <div class="acciones" style="margin-top:10px">
            <button class="b" data-accion="crear-registro-periodo">Crear el registro de ${esc(estadPeriodo)}</button>
          </div>
        </div>
      </section>`;
    }

    const cuerpo = {
      resumen:    () => estadResumen(s, e, d, c, faltantes, registro, dest, cc),
      minutas:    () => panelMinutas(v, s),
      fte:        () => panelFte(v, c),
      ausentismo: () => panelAusentismo(v, c),
      rotacion:   () => panelRotacion(v, c),
      sanciones:  () => panelSanciones(v),
      dotacion:   () => panelDotacion(v, s, c),
      reporte:    () => panelReporte(v, s, e.config, c)
    }[pestana] || (() => estadResumen(s, e, d, c, faltantes, registro, dest, cc));

    return cabecera + cuerpo();
  }

  /** Solapa de resumen: los indicadores del mes y el envío de la estadística. */
  function estadResumen(s, e, d, c, faltantes, registro, dest, cc) {
    return `
      <section class="tarjeta">
        <div class="kpis">
          ${kpi('FTE Real', c.matriz.total.fteReal ? fmtNum(c.matriz.total.fteReal) : '—',
                c.matriz.total.heads ? `${c.matriz.total.heads} de mes completo` : 'sin dotación cargada')}
          ${kpi('Costo / FTE', c.matriz.total.costoPorFte ? dinero(c.matriz.total.costoPorFte) : '—',
                c.matriz.total.costoTotal ? `total ${dinero(c.matriz.total.costoTotal)}` : '')}
          ${kpi('Ausentismo', c.ausentismo.pctTotal === null ? '—' : fmtPct(c.ausentismo.pctTotal),
                `${c.ausentismo.totalDias} días`,
                c.ausentismo.pctTotal !== null && c.ausentismo.pctTotal > e.config.parametros.umbralAusentismo ? 'alerta' : 'ok')}
          ${kpi('Horas extras', c.matriz.total.horasExtras ? fmtNum(c.matriz.total.horasExtras, 0) + ' h' : '—',
                c.matriz.total.ratioExtras === null ? 'sin horas teóricas para comparar' : fmtPct(c.matriz.total.ratioExtras) + ' de las teóricas',
                c.matriz.total.ratioExtras !== null && c.matriz.total.ratioExtras > e.config.parametros.umbralHorasExtras ? 'alerta' : 'ok')}
          ${kpi('Rotación anualizada', c.rotacion.proyeccionAnual === null ? '—' : fmtPct(c.rotacion.proyeccionAnual, 1),
                `${c.rotacion.bajas} bajas en el mes`)}
        </div>

        ${d.sinVisita ? `<div class="aviso-caja">
          <strong>El período no tiene ninguna visita cargada.</strong> La estadística se arma igual,
          con los indicadores marcados como pendientes.
          ${e.sucursales.length ? `<br><button class="b sec" data-accion="nueva-visita" data-id="${s.id}" style="margin-top:10px">Registrar una visita</button>` : ''}
        </div>` : ''}

        ${faltantes.length ? `<div class="aviso-caja">
          <strong>Datos pendientes de carga.</strong> La estadística se manda igual, con estos puntos marcados como <code>[PENDIENTE]</code>:
          <ul>${faltantes.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
        </div>` : '<div class="aviso-caja info">Período completo: no quedan datos pendientes.</div>'}

        <p class="ayuda">
          Destinatario: <strong>${esc(dest.nombre || 'sin cargar')}</strong> &lt;${esc(dest.email || 'sin email')}&gt;
          ${cc.length ? ` · con copia a ${esc(cc.join(', '))}` : ''}
          · vía ${e.config.webhook ? '<span class="chip verde">envío automático</span>' : '<span class="chip azul">cliente de correo</span>'}
        </p>

        ${registro && registro.enviado ? `<div class="aviso-caja info">
          Último envío de este período: ${new Date(registro.fecha).toLocaleString('es-AR')}
          a ${esc(registro.destinatario)} (${esc(registro.via)}).
          ${registro.historial.length > 1 ? `Total de envíos: ${registro.historial.length}.` : ''}
        </div>` : ''}

        <div class="acciones">
          <button class="b" data-accion="enviar-estadistica">Enviar la estadística</button>
          <button class="b sec" data-accion="copiar-estadistica">Copiar</button>
          <button class="b sec" data-accion="descargar-estadistica">Descargar .txt</button>
          <button class="b sec" data-accion="imprimir">Imprimir / PDF</button>
        </div>
      </section>

      <section class="tarjeta">
        <h2>Novedades de liquidación</h2>
        <p class="ayuda">
          Pegá acá la hoja de <strong>${esc(s.nombre || s.codigo)}</strong> del libro de novedades
          del mes: abrila en Excel, seleccioná desde la fila de encabezados hasta la última persona,
          copiá y pegá. Carga el plantel, las horas extras y los días de ausencia por concepto.
        </p>
        <textarea id="pegar-novedades" style="min-height:110px"
          placeholder="MES  TIENDA  LEGAJO  CUIL  APELLIDO  NOMBRE  HORAS NOCTURNAS  …"></textarea>
        <div class="acciones">
          <button class="b" data-accion="importar-novedades">Importar en ${esc(estadPeriodo)}</button>
        </div>
        <div id="resultado-novedades"></div>

        ${(() => {
          const d = Store.dotacionDelPadron(s.id, estadPeriodo);
          if (!d || !d.personas) return '';
          const roles = Object.keys(d.porPosicion);
          return `<div class="tabla-scroll" style="margin-top:16px"><table>
            <thead><tr><th>Posición</th><th class="num">Personas</th>
              <th class="num">Hs. extras</th><th class="num">Días de ausencia</th></tr></thead>
            <tbody>
              ${roles.length ? roles.map(r => `<tr>
                <td><strong>${esc(r)}</strong></td>
                <td class="num">${d.porPosicion[r].heads}</td>
                <td class="num">${fmtNum(d.porPosicion[r].horasExtras, 1)}</td>
                <td class="num">${fmtNum(d.porPosicion[r].diasAusentes, 0)}</td>
              </tr>`).join('')
              : '<tr><td colspan="4" class="vacio">Todavía nadie tiene posición asignada.</td></tr>'}
              ${d.sinPosicion.length ? `<tr><td><em>Sin posición</em></td>
                <td class="num">${d.sinPosicion.length}</td><td class="num">—</td><td class="num">—</td></tr>` : ''}
              ${d.noPresenciales.length ? `<tr><td><em>Bloqueo de título / no presencial</em></td>
                <td class="num">${d.noPresenciales.length}</td><td class="num">—</td><td class="num">—</td></tr>` : ''}
            </tbody>
          </table></div>
          ${d.noPresenciales.length ? `<div class="aviso-caja info">
            <strong>${d.noPresenciales.length} persona${d.noPresenciales.length === 1 ? '' : 's'} fuera de la dotación de piso.</strong>
            Prestan la habilitación profesional pero no cubren turno, así que no entran en la
            matriz de FTE ni en la cobertura. Si querés su costo en el mes, cargalo a mano en la
            fila que corresponda.
            <br>${d.noPresenciales.map(x => `${esc(x.nombre)} (${esc(x.motivo.toLowerCase())})`).join(' · ')}
          </div>` : ''}
          ${d.sinPosicion.length ? `<div class="aviso-caja">
            <strong>${d.sinPosicion.length} persona${d.sinPosicion.length === 1 ? '' : 's'} sin posición asignada.</strong>
            La planilla de liquidación no trae el puesto: asignalo una vez en el perfil
            de cada persona —desde el organigrama de la sucursal— y queda para todos los meses.
            <br>${esc(d.sinPosicion.slice(0, 12).join(' · '))}${d.sinPosicion.length > 12 ? ' …' : ''}
          </div>` : ''}`;
        })()}
      </section>

      <section class="tarjeta">
        <h2>Vista previa de la estadística</h2>
        <pre class="reporte" id="vista-estadistica">${esc(Reporte.textoMensual(s.id, estadPeriodo, e.config))}</pre>
      </section>`;
  }

  /* ======================== VISTA: SUCURSALES ======================= */
  let fichaSucursal = null;   // id de la sucursal con la ficha desplegada

  /* ==================== Sucursales, en Configuración ==================
     La solapa *Sucursales* se eliminó: era una tercera lista de las mismas
     doce tiendas —las otras dos son las tarjetas del panel y la tabla de
     Visitas— y lo único propio que tenía, la ficha editable, estaba escondida
     dentro de una fila desplegable mientras la misma ficha se leía en la
     página de la tienda. Ahora cada tienda se edita en su página, y acá queda
     solo lo que es alta y baja del área. */
  function panelSucursalesConfig() {
    const e = Store.get();
    const dot = Store.dotacionDelArea();

    return `
      <section class="tarjeta">
        <h2>Sucursales del área</h2>
        <p class="ayuda">
          Alta y baja de tiendas. Los datos de cada una —razón social, CUIT, ART, referentes,
          horario— se editan en su propia página, con el botón <em>Editar</em>.
        </p>

        <div class="tabla-scroll"><table>
          <thead><tr>
            <th>Sucursal</th><th>Localidad</th><th>Tipo</th><th>Gerente de Tienda</th>
            <th class="num">Plantel</th><th></th>
          </tr></thead>
          <tbody>
            ${e.sucursales.map(x => {
              const d = dot.porSucursal[x.id] || { personas: 0 };
              return `<tr>
                <td><a href="#/sucursal/${x.id}" style="font-weight:700;color:var(--azul)">${esc(x.nombre || x.codigo)}</a>
                  ${x.rvd ? `<div style="font-size:11px;color:var(--texto-suave);margin-top:2px">RVD ${esc(x.rvd)}</div>` : ''}</td>
                <td>${esc(x.localidad || '—')}</td>
                <td class="tipo">${x.tipo === 'staff' ? '🏢 Staff' : '🏪 Tienda'}</td>
                <td>${esc(x.gerente || '—')}
                  ${x.emailGerente ? '' : '<span class="chip ambar">sin mail</span>'}</td>
                <td class="num">${d.personas || '—'}</td>
                <td class="num" style="white-space:nowrap">
                  <a class="mini" href="#/sucursal/${x.id}" style="color:var(--azul);border-color:var(--azul);text-decoration:none;display:inline-block">Abrir</a>
                  <button class="mini" data-accion="borrar-sucursal" data-id="${x.id}">✕</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table></div>

        <div class="acciones">
          <button class="b" data-accion="agregar-sucursal">+ Agregar sucursal</button>
          <button class="b sec" data-accion="cargar-padron">Cargar padrón del Área 3</button>
        </div>

        ${e.sucursales.some(x => x.notas) ? `<h4>Puntos a confirmar</h4>
          <ul style="margin:0;padding-left:20px;font-size:13.5px;line-height:1.7">
            ${e.sucursales.filter(x => x.notas).map(x =>
              `<li><strong>${esc(x.nombre || x.codigo)}:</strong> ${esc(x.notas)}</li>`).join('')}
          </ul>` : ''}
      </section>`;
  }

  /* ========================== VISTA: CONFIG ========================= */
  function vistaConfig() {
    const e = Store.get();
    contexto = e.config;
    return `
      <h1 class="titulo">Configuración</h1>
      <p class="subtitulo">Sucursales del área, destinatarios de los reportes y parámetros de cálculo.</p>

      ${panelSucursalesConfig()}

      <section class="tarjeta">
        <h2>Coordinación y destinatarios</h2>
        <p class="ayuda">El reporte de cada visita se envía al Gerente de Operaciones apenas se cierra la visita.</p>
        <div class="grid c2">
          ${campo('Coordinador de RRHH', 'coordinador', { calc: true, placeholder: 'Tu nombre' })}
          ${campo('Área a cargo', 'area', { calc: true, placeholder: 'ej. Área 3' })}
          ${campo('Gerente de Operaciones por defecto', 'gerenteOperaciones.nombre')}
          ${campo('Su email', 'gerenteOperaciones.email', { tipo: 'email', placeholder: 'nombre@empresa.com' })}
          ${campo('Copias (separadas por coma)', 'copias', { placeholder: 'rrhh@empresa.com, gerencia@empresa.com' })}
        </div>
        <div class="grid" style="margin-top:14px">
          ${campo('Endpoint de envío automático (opcional)', 'webhook', { placeholder: 'https://hook.make.com/... o URL de Google Apps Script' })}
        </div>
        <h3 style="font-size:14px;margin:22px 0 8px">Gerentes de Operaciones del área</h3>
        <p class="ayuda">Toda el Área 3 reporta al mismo. Si en algún momento el área se divide, se agregan acá y se asigna cada sucursal al suyo desde su ficha.</p>
        <div class="tabla-scroll"><table>
          <thead><tr><th>Nombre</th><th>Email</th><th class="num">Sucursales</th><th></th></tr></thead>
          <tbody>
          ${(e.config.gerentesOperaciones || []).map((g, i) => `<tr>
            <td><input data-path="gerentesOperaciones.${i}.nombre" data-calc="1" value="${esc(g.nombre)}"></td>
            <td><input type="email" data-path="gerentesOperaciones.${i}.email" data-calc="1" value="${esc(g.email)}" placeholder="nombre@empresa.com"></td>
            <td class="num">${e.sucursales.filter(s => s.gerenteOperaciones === g.nombre).length}</td>
            <td class="num"><button class="mini" data-accion="borrar-item" data-arr="gerentesOperaciones" data-idx="${i}">✕</button></td>
          </tr>`).join('')}
          </tbody>
        </table></div>
        <div class="acciones"><button class="b sec" data-accion="agregar-gop">+ Agregar gerente</button></div>

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
          ${campo('Objetivo costo/venta', 'parametros.benchmarkCostoVenta', { tipo: 'number', step: '0.01', calc: true })}
          ${campo('Techo de alerta costo/venta', 'parametros.alertaCostoVenta', { tipo: 'number', step: '0.01', calc: true })}
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
        ${(() => {
          const conBanco = e.sucursales.reduce((n, s) =>
            n + (s.colaboradores || []).filter(c => c.cbu || c.banco).length, 0);
          return conBanco ? `<div class="aviso-caja">
            <strong>El respaldo no está cifrado.</strong> Adentro viajan los datos personales del
            padrón, incluidos el banco y el CBU de ${conBanco} persona${conBanco === 1 ? '' : 's'}.
            Guardalo donde guardarías la nómina, no en un mail ni en un pendrive compartido.
          </div>` : '';
        })()}
        ${(() => {
          const dias = Store.diasSinRespaldo();
          if (dias === null) {
            return `<div class="aviso-caja">
              <strong>Todavía no exportaste ningún respaldo.</strong> El archivo .json es lo único
              que queda si este navegador borra los datos del sitio. Exportalo hoy y guardalo
              donde guardás la nómina.
            </div>`;
          }
          if (dias >= 7) {
            return `<div class="aviso-caja">
              <strong>Último respaldo: hace ${dias} día${dias === 1 ? '' : 's'}.</strong>
              Todo lo cargado desde entonces existe únicamente en este navegador.
            </div>`;
          }
          return `<p class="ayuda">Último respaldo exportado hace ${dias === 0 ? 'menos de un día' : dias + ' día' + (dias === 1 ? '' : 's')}.</p>`;
        })()}
        <div class="acciones">
          <button class="b sec" data-accion="ejemplo">Cargar datos de ejemplo</button>
          <button class="b sec" data-accion="exportar">Exportar respaldo (.json)</button>
          <button class="b sec" data-accion="importar">Importar respaldo</button>
          <button class="b peligro" data-accion="reiniciar">Borrar todo</button>
          <input type="file" id="archivo-import" accept="application/json" hidden>
        </div>
      </section>

      ${panelResguardos()}`;
  }

  /* Las copias se listan con hora porque en un mismo día puede haber varias:
     la del día y las que dispara cada acción que reemplaza todo. */
  const fechaHoraLegible = iso => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso || '');
    return d.toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  /* Copias que el tablero se saca solo. Están para el día en que algo borra
     todo: “Borrar todo”, los datos de ejemplo, una importación equivocada o
     el navegador limpiando el sitio. */
  function panelResguardos() {
    const lista = Store.resguardos();
    const ilegible = Store.contenidoIlegible();
    const est = Store.estadoDelAlmacen();
    const c = est.censo;
    return `
      <section class="tarjeta">
        <h2>Qué hay guardado en este navegador</h2>
        <p class="ayuda">Lo que el panel encuentra ahora mismo, sin tocar nada. Si acá figura
          contenido y en las pantallas no aparece, el problema es de lectura, no de borrado.</p>
        <div class="tabla-scroll"><table>
          <tbody>
            <tr><th>Contenido guardado</th><td>${est.hay
              ? `sí · ${fmtNum(Math.max(1, Math.round(est.tam / 1024)), 0)} KB · ${esc(est.forma)}`
              : '<strong>no hay nada guardado en este navegador</strong>'}</td></tr>
            <tr><th>Clave de acceso</th><td>${est.cifradoActivo ? 'puesta (el contenido se guarda cifrado)' : 'sin clave'}</td></tr>
            <tr><th>Sucursales</th><td>${fmtNum(c.sucursales, 0)} · ${fmtNum(c.conNombre, 0)} con nombre · ${fmtNum(c.conRazonSocial, 0)} con razón social</td></tr>
            <tr><th>Personas en el plantel</th><td>${fmtNum(c.colaboradores, 0)}</td></tr>
            <tr><th>Visitas · reclamos · agenda · días</th><td>${fmtNum(c.visitas, 0)} · ${fmtNum(c.reclamos, 0)} · ${fmtNum(c.agenda, 0)} · ${fmtNum(c.diarios, 0)}</td></tr>
            <tr><th>Copias automáticas</th><td>${fmtNum(est.resguardos, 0)}</td></tr>
            ${est.ilegible ? `<tr><th>Contenido apartado</th><td>${fmtNum(Math.max(1, Math.round(est.ilegible / 1024)), 0)} KB que no se pudieron leer</td></tr>` : ''}
            <tr><th>Direcciones del navegador en uso</th><td class="tipo">${est.claves.length
              ? est.claves.map(k => `${esc(k.clave)} (${fmtNum(Math.max(1, Math.round(k.tam / 1024)), 0)} KB)`).join('<br>')
              : 'ninguna'}</td></tr>
          </tbody>
        </table></div>
      </section>

      <section class="tarjeta">
        <h2>Copias automáticas de este navegador</h2>
        <p class="ayuda">El tablero se guarda una copia por día al abrir, y otra antes de cada
          acción que reemplaza todo el contenido. Se conservan las cuatro últimas. Viven en este
          mismo navegador: sirven contra un borrado por error, no contra perder el equipo. Para
          eso está el respaldo .json de arriba.</p>
        ${(() => {
          if (!ilegible) return '';
          const c = Store.censoIlegible();
          return `<div class="aviso-caja">
            <strong>Hay contenido que no se pudo leer al abrir.</strong> Quedó apartado sin pisarse
            (${fmtNum(Math.max(1, Math.round(ilegible.length / 1024)), 0)} KB).
            ${c ? `Se puede abrir y tiene <strong>${fmtNum(c.colaboradores, 0)} personas</strong> en
              ${fmtNum(c.sucursales, 0)} sucursales: es trabajo tuyo y conviene recuperarlo.`
                : 'Suele ser contenido cifrado abierto sin la clave: si tenías clave puesta, ponela y volvé a entrar antes de tocar nada.'}
            <div class="acciones">
              ${c ? '<button class="b" data-accion="recuperar-ilegible">Recuperar ese contenido</button>' : ''}
              <button class="b sec" data-accion="descartar-ilegible">Descartar ese contenido</button>
            </div>
          </div>`;
        })()}
        ${lista.length ? `<div class="tabla-scroll"><table>
          <thead><tr><th>Cuándo</th><th>Motivo</th><th class="num">Tamaño</th><th>Qué tiene adentro</th><th></th></tr></thead>
          <tbody>
            ${lista.map(r => `<tr>
              <td class="tipo">${esc(fechaHoraLegible(r.fecha))}</td>
              <td>${esc(r.motivo)}${r.cifrado ? ' <span class="chip azul">cifrada</span>' : ''}</td>
              <td class="num">${fmtNum(Math.max(1, Math.round(r.tam / 1024)), 0)} KB</td>
              <td class="tipo" data-censo="${r.id}">…</td>
              <td class="tipo">
                <button class="mini" data-accion="restaurar-resguardo" data-id="${r.id}">Restaurar</button>
                <button class="mini" data-accion="borrar-resguardo" data-id="${r.id}">Borrar</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table></div>` : `<p class="vacio">Todavía no hay copias. Se crea la primera cuando el tablero tenga datos cargados.</p>`}
        <div class="acciones">
          <button class="b sec" data-accion="resguardar">Sacar una copia ahora</button>
        </div>
      </section>`;
  }

  /* ========================== VISTA: VISITA ========================= */
  /* La visita es lo de todas las semanas: recorrer la tienda y mirar a la
     gente. Los números del período viven en Estadística mensual. */
  const PESTANAS = [
    ['checklist', 'Check list RRHH'],
    ['talento',   'Talento y 9-box']
  ];

  function vistaVisita(id, pestana) {
    const e = Store.get();
    const v = Store.visita(id);
    if (!v) return `<p class="vacio">La visita no existe o fue eliminada.</p>`;
    const s = Store.sucursal(v.sucursalId);
    contexto = v;
    visitaEnCurso = v;
    const c = Reporte.calcular(v, s, e.config);

    const cuerpo = {
      checklist: () => panelChecklist(v, s),
      /* La sucesión es una conversación sobre gente, no un número del mes
         cerrado: se hace mirando el 9-box con el Gerente de Tienda. */
      talento:   () => panelTalento(v, s) + panelSucesion(v, c)
    }[pestana] || (() => panelChecklist(v, s));

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
        ${kpi('Horas extras', c.matriz.total.horasExtras ? fmtNum(c.matriz.total.horasExtras, 0) + ' hs' : '—',
              c.matriz.total.ratioExtras === null ? 'sin horas teóricas para comparar' : fmtPct(c.matriz.total.ratioExtras) + ' de las teóricas',
              c.matriz.total.ratioExtras !== null && c.matriz.total.ratioExtras > e.config.parametros.umbralHorasExtras ? 'alerta' : 'ok')}
        ${kpi('Rotación anualizada', c.rotacion.proyeccionAnual === null ? '—' : fmtPct(c.rotacion.proyeccionAnual, 1), `${c.rotacion.bajas} bajas en el mes`)}
      </div>

      <nav class="tabs" style="border-radius:10px;border:1px solid var(--borde);margin-bottom:18px">
        ${PESTANAS.map(([k, t]) => `<a href="#/visita/${v.id}/${k}" class="${k === pestana ? 'activo' : ''}">${t}</a>`).join('')}
      </nav>

      ${cuerpo()}`;
  }

  /* ------------------- 0. Check list de RRHH Operaciones -------------------
     El instrumento corporativo. Cada punto trae su criterio de aprobación a la
     vista al marcar: sin eso, dos personas evalúan distinto la misma tienda. */
  let checkAbierto = null;   // punto con el criterio y las observaciones desplegados

  function panelChecklist(v, s) {
    const pendientes = pendientesAnteriores(v);
    const cl = v.checklist;
    const r = evaluarChecklist(cl.checks);
    const t = r.total;
    const pct = t.pct === null ? null : t.pct;

    const chipEstado = e => (ESTADOS_CHECKLIST_POR_ID[e] || {}).chip || '';

    const fila = (p) => {
      const est = cl.checks[p.id] || '';
      const abierto = checkAbierto === p.id;
      const obs = cl.obs[p.id] || '';
      return `<div class="check-punto ${est ? 'marcado' : ''}">
        <div class="check-cab">
          <span class="check-n">${p.n}</span>
          <button class="check-titulo" data-accion="abrir-check" data-id="${p.id}"
            title="Ver el criterio de aprobación">${esc(p.titulo)}</button>
          <div class="check-estados">
            ${ESTADOS_CHECKLIST.filter(e => e.id).map(e =>
              `<button class="check-op ${est === e.id ? 'activo ' + e.chip : ''}"
                data-accion="marcar-check" data-id="${p.id}" data-e="${e.id}">${esc(e.nombre)}</button>`).join('')}
          </div>
          ${obs ? '<span class="chip" title="Tiene observación">✎</span>' : ''}
        </div>
        ${abierto ? `<div class="check-detalle">
          <p>${esc(p.detalle)}</p>
          <p class="criterio"><strong>Criterio de aprobación:</strong> ${esc(p.criterio)}</p>
          ${p.nota ? `<p class="ayuda">${esc(p.nota)}</p>` : ''}
          <label class="campo"><span>Observación</span>
            <input data-cl="${p.id}|obs" value="${esc(obs)}"
              placeholder="Qué se vio, con qué evidencia."></label>
          <label class="campo"><span>Otras consideraciones</span>
            <input data-cl="${p.id}|consideraciones" value="${esc(cl.consideraciones[p.id] || '')}"
              placeholder="Lo que haya que aclarar del punto."></label>
        </div>` : ''}
      </div>`;
    };

    return `
      ${pendientes.length ? `<div class="aviso-caja">
        <strong>Antes de arrancar: quedaron ${pendientes.length} compromiso${pendientes.length === 1 ? '' : 's'} de la visita anterior.</strong>
        <ul>${pendientes.slice(0, 6).map(x => `<li>${esc(x.compromiso || 'sin descripción')}
          ${x.responsable ? `— ${esc(x.responsable)}` : ''}${x.plazo ? ` · plazo ${fmtFecha(x.plazo)}` : ''}</li>`).join('')}</ul>
      </div>` : ''}

      <section class="tarjeta">
        <h2>Puntaje de la visita</h2>
        <p class="ayuda">
          El porcentaje se calcula solo sobre los puntos aprobados o no aprobados.
          Lo marcado <em>No aplica</em> sale del numerador y del denominador, para no
          castigar a la tienda por algo que no le corresponde.
        </p>
        <div class="kpis">
          ${kpi('Cumplimiento', pct === null ? '—' : fmtPct(pct, 1),
                `${t.aprobados} de ${t.aplicables} aplicables`,
                pct === null ? '' : pct >= 0.9 ? 'ok' : pct >= 0.75 ? 'aviso' : 'alerta')}
          ${kpi('No aprobados', t.noAprobados, t.noAprobados ? 'a corregir' : 'ninguno', t.noAprobados ? 'alerta' : 'ok')}
          ${kpi('No aplica', t.noAplica, 'fuera del cálculo')}
          ${kpi('Sin evaluar', t.sinEvaluar, t.sinEvaluar ? `de ${t.total} puntos` : 'checklist completo',
                t.sinEvaluar ? 'aviso' : 'ok')}
        </div>

        ${r.categoriaMasAfectada && r.total.aplicables ? `<div class="aviso-caja${
          r.categoriaMasAfectada.pct < 0.9 ? '' : ' info'}">
          <strong>Lo más flojo:</strong> ${esc(r.subMasAfectada.nombre)}
          (${fmtPct(r.subMasAfectada.pct, 0)}), dentro de ${esc(r.categoriaMasAfectada.nombre)}.
          ${r.subMasPositiva && r.subMasPositiva.id !== r.subMasAfectada.id
            ? `Lo más firme: ${esc(r.subMasPositiva.nombre)} (${fmtPct(r.subMasPositiva.pct, 0)}).` : ''}
        </div>` : ''}

        <div class="tabla-scroll"><table>
          <thead><tr><th>Categoría</th><th class="num">Aplicables</th><th class="num">Aprobados</th>
            <th class="num">No aprobados</th><th class="num">Cumplimiento</th></tr></thead>
          <tbody>
            ${r.porCategoria.map(c => `<tr>
              <td><strong>${esc(c.nombre)}</strong></td>
              <td class="num">${c.aplicables || '—'}</td>
              <td class="num">${c.aprobados || '—'}</td>
              <td class="num">${c.noAprobados || '—'}</td>
              <td class="num">${c.pct === null ? '—'
                : `<span class="chip ${c.pct >= 0.9 ? 'verde' : c.pct >= 0.75 ? 'ambar' : 'rojo'}">${fmtPct(c.pct, 0)}</span>`}</td>
            </tr>`).join('')}
          </tbody>
        </table></div>
      </section>

      <section class="tarjeta">
        <h2>Quién acompañó la visita</h2>
        <div class="grid c3">
          <label class="campo"><span>Supervisor que acompañó</span>
            <input data-cl="_|supervisor" value="${esc(cl.supervisor || '')}"
              placeholder="Nombre y apellido"></label>
          <label class="campo"><span>Cargo del supervisor</span>
            <input data-cl="_|cargoSupervisor" value="${esc(cl.cargoSupervisor || '')}"
              placeholder="Gerente de Tienda, Senior…"></label>
        </div>
      </section>

      ${CHECKLIST_RRHH.map(c => `<section class="tarjeta">
        <div class="cabecera-suc">
          <h2>${esc(c.nombre)}</h2>
          ${(() => {
            const rc = r.porCategoria.find(x => x.id === c.id);
            return rc.pct === null ? '<span class="chip">sin evaluar</span>'
              : `<span class="chip ${rc.pct >= 0.9 ? 'verde' : rc.pct >= 0.75 ? 'ambar' : 'rojo'}">${fmtPct(rc.pct, 0)}</span>`;
          })()}
        </div>
        ${c.subs.map(sub => `<h3>${esc(sub.nombre)}</h3>
          ${sub.puntos.map(fila).join('')}`).join('')}
      </section>`).join('')}

      <section class="tarjeta">
        <h2>Cierre y compromisos</h2>
        <p class="ayuda">
          Lo que pide el check list al final: qué hay que contar de la visita y qué se
          compromete a mejorar el supervisor. Los compromisos con plazo van al plan de
          acción, en la solapa de la estadística.
        </p>
        <label class="campo"><span>Puntos relevantes de la visita</span>
          <textarea data-cl="_|relevantes" style="min-height:90px"
            placeholder="Lo que hay que contar, más allá del puntaje.">${esc(cl.relevantes || '')}</textarea></label>
        <label class="campo"><span>Compromisos que asume el supervisor</span>
          <textarea data-cl="_|compromisos" style="min-height:90px"
            placeholder="Sobre las oportunidades detectadas en la visita.">${esc(cl.compromisos || '')}</textarea></label>
      </section>

      <section class="tarjeta">
        <h2>Generar el informe</h2>
        <p class="ayuda">
          ${(() => {
            const d = Reporte.destinatario(s, Store.get().config);
            const partes = [];
            partes.push(`<strong>${esc(d.nombre || 'Gerente de Operaciones sin cargar')}</strong> &lt;${esc(d.email || 'sin email')}&gt;`);
            partes.push(s.emailGerente
              ? `<strong>${esc(s.gerente || 'Gerente de Tienda')}</strong> &lt;${esc(s.emailGerente)}&gt;`
              : '<span class="chip ambar">falta el email del Gerente de Tienda</span>');
            return 'Va a ' + partes.join(' y a ') + '.';
          })()}
          ${(() => {
            const cc = Reporte.copias(s, Store.get().config)
              .filter(x => x.toLowerCase() !== String(s.emailGerente || '').toLowerCase());
            return cc.length ? ` Con copia a ${esc(cc.join(', '))}.` : '';
          })()}
          · vía ${Store.get().config.webhook
            ? '<span class="chip verde">envío automático</span>'
            : '<span class="chip azul">cliente de correo</span>'}
        </p>

        ${t.sinEvaluar ? `<div class="aviso-caja">
          <strong>Quedan ${t.sinEvaluar} de ${t.total} puntos sin evaluar.</strong>
          El informe se puede mandar igual —van listados al final— pero el porcentaje
          se calcula solo sobre lo que marcaste.
        </div>` : ''}

        ${!s.emailGerente ? `<div class="aviso-caja">
          <strong>Falta el email del Gerente de Tienda.</strong> Sin eso el informe le llega
          solo al Gerente de Operaciones. Cargalo en <a href="#/sucursal/${s.id}">la ficha de la tienda</a>.
        </div>` : ''}

        ${v.envioChecklist && v.envioChecklist.enviado ? `<div class="aviso-caja info">
          Último envío: ${new Date(v.envioChecklist.fecha).toLocaleString('es-AR')}
          a ${esc(v.envioChecklist.destinatario)} (${esc(v.envioChecklist.via)}).
          ${v.envioChecklist.historial.length > 1 ? `Total de envíos: ${v.envioChecklist.historial.length}.` : ''}
        </div>` : ''}

        <div class="acciones">
          <button class="b grande" data-accion="enviar-checklist" data-id="${v.id}">Generar informe y enviar</button>
          <button class="b sec" data-accion="copiar-checklist" data-id="${v.id}">Copiar</button>
          <button class="b sec" data-accion="descargar-checklist" data-id="${v.id}">Descargar .txt</button>
          <button class="b sec" data-accion="imprimir">Imprimir / PDF</button>
        </div>
      </section>

      <section class="tarjeta">
        <h2>Vista previa del informe</h2>
        <pre class="reporte" id="vista-checklist">${esc(Reporte.textoChecklist(v, s, Store.get().config))}</pre>
      </section>

      ${r.noAprobados.length ? `<section class="tarjeta">
        <h2>Lo que quedó no aprobado</h2>
        <div class="tabla-scroll"><table>
          <thead><tr><th class="num">N°</th><th>Punto</th><th>Sección</th><th>Observación</th></tr></thead>
          <tbody>${r.noAprobados.map(p => `<tr>
            <td class="num">${p.n}</td>
            <td><strong>${esc(p.titulo)}</strong></td>
            <td>${esc(p.subNombre)}</td>
            <td>${esc(cl.obs[p.id] || '')}</td>
          </tr>`).join('')}</tbody>
        </table></div>
      </section>` : ''}

      ${bloqueReclamos(v, s)}`;
  }

  /* -------------------------- 0. Recorrida -------------------------- *
     El check de la visita. Va primero porque es lo que se hace primero: si
     arrancás por la oficina del gerente, el resto de la visita ya es la
     versión que te quieren mostrar. */

  /**
   * Los reclamos de la tienda, al pie del check list.
   *
   * Acá va el recordatorio, no el formulario. El alta y el seguimiento viven en
   * `#/reclamos` y en ningún otro lado: tener el mismo alta en dos pantallas
   * obligaba a acordarse de cuál de las dos estaba más completa, y la respuesta
   * siempre era la otra. Lo que sí hace falta durante la visita es saber qué
   * quedó abierto —es lo primero que la gente pregunta— y poder ir a anotarlo
   * en un clic.
   */
  function bloqueReclamos(v, s) {
    const abiertos = Store.reclamosDe(s.id, true);
    const criticos = abiertos.filter(x => semaforoReclamo(x).clave === 'critico');

    return `
      <section class="tarjeta">
        <div class="cabecera-suc">
          <h2>Reclamos de la gente</h2>
          ${abiertos.length
            ? `<span class="chip ${criticos.length ? 'rojo' : 'ambar'}">${abiertos.length} abierto${abiertos.length === 1 ? '' : 's'}</span>`
            : '<span class="chip verde">ninguno abierto</span>'}
        </div>
        <p class="ayuda">
          ${abiertos.length
            ? 'Lo que quedó sin respuesta en esta tienda. Es lo primero que te van a preguntar.'
            : 'No hay nada pendiente de respuesta en esta tienda.'}
          Se registran y se siguen en <em>Reclamos</em>, que es donde viven.
        </p>

        ${abiertos.length ? `<ul style="font-size:13.5px;line-height:1.8;margin:0 0 4px;padding-left:20px">
          ${abiertos.map(x => {
            const sem = semaforoReclamo(x);
            return `<li>${esc(x.colaborador || 'sin nombre')} — ${esc((TIPOS_RECLAMO_POR_ID[x.tipo] || {}).nombre || x.tipo)}
              · ${esc((ESTADOS_RECLAMO_POR_ID[x.estado] || {}).nombre || x.estado)}
              · <span class="chip ${sem.tono}">${esc(sem.texto)}</span></li>`;
          }).join('')}
        </ul>` : ''}

        <div class="acciones">
          <a class="b" href="#/reclamos/${s.id}">${abiertos.length ? 'Ver y anotar reclamos de esta tienda' : 'Anotar un reclamo de esta tienda'}</a>
        </div>
      </section>`;
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
  /* Al lado del número de días, a cuánto FTE equivalen. Es la traducción que
     el coordinador hace de cabeza y donde se le escapa el doble conteo: 15 días
     de ingreso son medio puesto, no uno más. */
  const equivFte = (dias, p) => {
    const d = num(dias);
    if (!d) return '';
    return `<br><small style="font-weight:400;color:var(--texto-suave)">${fmtNum(d / p.diasMes)} FTE</small>`;
  };

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
        <td class="num">${inp(i, 'heads', 64, 'Solo las personas que estuvieron los ' + p.diasMes + ' días. Quien entró o se fue durante el mes NO va acá: va en Ingreso o Egreso con sus días.')}</td>
        <td class="num">${inp(i, 'headsAltas', 64, 'Cuántas personas ingresaron durante el mes')}</td>
        <td class="num fin-heads"><strong>${k.headsTotal || '—'}</strong></td>
        <td class="num">${fmtNum(k.diasEstables, 0)}</td>
        <td class="num">${inp(i, 'diasBajas', 64, 'Días que alcanzó a trabajar quien egresó durante el mes')}${equivFte(f.diasBajas, p)}</td>
        <td class="num">${inp(i, 'diasAltas', 64, 'Días que alcanzó a trabajar quien ingresó durante el mes')}${equivFte(f.diasAltas, p)}</td>
        <td class="num">${fmtNum(k.diasTrabajados, 0)}</td>
        <td class="num">${inp(i, 'horasExtras', 72)}</td>
        <td class="num">${inp(i, 'diasAusentes', 72, 'Días de ausencia y de vacaciones')}</td>
        <td class="num"><strong>${fmtNum(k.fteReal)}</strong></td>
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
        ${c.matriz.total.diasTrabajados ? `<div class="aviso-caja info">
          <strong>Cómo se lee esta tabla.</strong> Es la traducción del FTE al idioma con el que
          se conversa con el Gerente de Operaciones; el reporte mensual la lleva tal cual.
          <ul>${lecturaFte(c, p).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        </div>` : ''}
        ${avisoAltasBajas(v, c, p)}
        ${(() => {
          const d = Store.dotacionDelPadron(v.sucursalId, v.periodo);
          if (!d || !d.personas) return '';
          const conRol = Object.keys(d.porPosicion).length;
          return `<div class="aviso-caja info">
            <strong>Hay novedades de liquidación cargadas para ${esc(v.periodo)}:</strong>
            ${d.personas} persona${d.personas === 1 ? '' : 's'}${conRol ? ` en ${conRol} posicion${conRol === 1 ? '' : 'es'}` : ''}.
            ${d.sinPosicion.length ? `${d.sinPosicion.length} sin posición asignada, que quedarían afuera de la matriz.` : ''}
            <div class="acciones" style="margin-top:10px">
              <button class="b sec" data-accion="traer-padron" data-id="${v.id}">Traer la dotación del padrón</button>
            </div>
          </div>`;
        })()}
        <div class="tabla-scroll"><table class="matriz-td01">
          <thead>
            <tr>
              <th rowspan="2">Posición</th>
              <th class="num grupo-heads fin-heads" colspan="3">Heads</th>
              <th class="num grupo-ftu" colspan="7">F. T. U.</th>
            </tr>
            <tr>
              <th class="num grupo-heads" title="Personas con vínculo durante todo el mes">Todo el mes</th>
              <th class="num grupo-heads" title="Cuántas personas ingresaron durante el mes">Ingreso</th>
              <th class="num grupo-heads fin-heads" title="Dotación al cierre del mes: las que estuvieron todo el mes más las que ingresaron">Total</th>
              <th class="num grupo-ftu" title="Días de vínculo de la dotación estable: personas × ${p.diasMes}">Todo el mes</th>
              <th class="num grupo-ftu" title="Días que alcanzó a trabajar quien egresó durante el mes">Egreso</th>
              <th class="num grupo-ftu" title="Días que alcanzó a trabajar quien ingresó durante el mes">Ingreso</th>
              <th class="num grupo-ftu" title="Suma de los tres anteriores">Total días</th>
              <th class="num grupo-ftu">Hs. Extras</th>
              <th class="num grupo-ftu" title="Días de ausencia y de vacaciones">Ausent + Vaca</th>
              <th class="num grupo-ftu" title="FTE real: días de vínculo ÷ ${p.diasMes} − ausencias ÷ ${p.diasMes} + horas extras ÷ ${p.horasMes}">total</th>
            </tr>
          </thead>
          <tbody>${v.posiciones.map(filaDotacion).join('')}</tbody>
          <tfoot><tr class="total">
            <td>TOTAL</td>
            <td class="num">${t.heads || '—'}</td>
            <td class="num">${t.headsAltas || '—'}</td>
            <td class="num fin-heads">${t.headsTotal || '—'}</td>
            <td class="num">${fmtNum(t.diasEstables, 0)}</td>
            <td class="num">${fmtNum(t.diasBajas, 0)}</td>
            <td class="num">${fmtNum(t.diasAltas, 0)}</td>
            <td class="num">${fmtNum(t.diasTrabajados, 0)}</td>
            <td class="num">${fmtNum(t.horasExtras, 0)}</td>
            <td class="num">${fmtNum(t.diasAusentes, 0)}</td>
            <td class="num">${fmtNum(t.fteReal)}</td>
          </tr></tfoot>
        </table></div>
        <p class="ayuda">Personas equivalentes por vínculo: <strong>${fmtNum(t.diasTrabajados / p.diasMes)}</strong>${
          t.diasTrabajados ? ` · brecha de cobertura ${fmtNum(t.brechaFte)} FTE` : ''}.</p>

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
    const padron = Store.dotacionDelPadron(v.sucursalId, v.periodo);

    c.matriz.filas.forEach((f, idx) => {
      /* El negativo es siempre un parche de la misma equivocación: contar a la
         persona que se fue en "Todo el mes" y después restarle los días. */
      const campos = [['diasAltas', 'Ingresos'], ['diasBajas', 'Egresos'],
                      ['diasAusentes', 'Ausencias'], ['heads', 'Todo el mes']];
      campos.forEach(([k, etiqueta]) => {
        if (num(v.posiciones[idx][k]) < 0) {
          problemas.push(`<strong>${esc(f.rol)}</strong>: hay un número negativo en “${etiqueta}”. ` +
            'No hace falta restar nunca. Si alguien entró o se fue durante el mes, ' +
            `<strong>no lo cuentes en “Todo el mes”</strong>: poné solo los días que trabajó en Ingresos o Egresos, y esos días suman.`);
        }
      });

      /* Si el padrón dice cuántas personas hay en esa posición, contarlas de más
         en "Todo el mes" es justo lo que después se intenta arreglar restando. */
      if (padron && padron.personas) {
        const pp = padron.porPosicion[f.rol] || {};
        if (pp.heads !== undefined && f.heads > pp.heads) {
          problemas.push(`<strong>${esc(f.rol)}</strong>: cargaste ${f.heads} personas de mes completo pero el padrón ` +
            `de ${esc(v.periodo)} tiene ${pp.heads} con vínculo todo el mes. Si alguna entró o se fue, va en Ingresos o Egresos con sus días, no acá.`);
        }
      }
    });

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
    const movimientos = padron
      ? (padron.altas || []).map(x => `${x.nombre} entró y trabajó ${x.dias} días`)
          .concat((padron.bajas || []).map(x => `${x.nombre} se fue habiendo trabajado ${x.dias} días`))
      : [];

    if (!problemas.length && !movimientos.length) return '';
    return `${movimientos.length ? `<div class="aviso-caja info">
        <strong>Movimientos de ${esc(v.periodo)} según el padrón.</strong> Ya vienen cargados en
        Ingresos y Egresos con sus días; no los cuentes además en “Mes completo”.
        <ul>${movimientos.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      </div>` : ''}` +
      (problemas.length ? `<div class="aviso-caja"><strong>Revisá esta carga.</strong><ul>` +
        problemas.map(x => `<li>${x}</li>`).join('') + `</ul></div>` : '');
  }

  /* -------------------------- 3. Ausentismo ------------------------- */
  function panelAusentismo(v, c) {
    const base = c.matriz.total.diasTrabajados;
    return `
      <section class="tarjeta">
        <h2>3. Ausentismo por concepto</h2>
        <p class="ayuda">
          Días de ausencia del período, con la apertura del tablero de estadísticas.
          El corte es si la ausencia se podía evitar o no: lo <strong>controlable</strong> es sobre lo que
          la tienda y RRHH pueden trabajar; lo <strong>no controlable</strong> se planifica, no se gestiona.
          La base de cálculo son los ${fmtNum(base, 0)} días de vínculo que surgen de la matriz de FTE.
          Cargar acá el detalle no modifica el FTE: para eso está la columna “Días ausentes” de la matriz.
        </p>
        ${!base ? '<div class="aviso-caja">Cargá primero el headcount en la solapa <strong>FTE y Costo</strong> para poder calcular porcentajes.</div>' : ''}
        ${avisoDesvioAusentismo(c)}
        ${c.ausentismo.sinApertura ? `<div class="aviso-caja info">
          Todavía no hay apertura por concepto. Mientras tanto, el ausentismo del período se toma de los
          <strong>${fmtNum(c.ausentismo.diasMatriz, 0)}</strong> días cargados en la matriz de FTE.
          Al desagregarlos acá abajo vas a poder separar lo evitable de lo que no lo es.
        </div>` : ''}

        ${c.ausentismo.grupos.map(g => `
          <h3 style="font-size:14px;margin:18px 0 6px;color:var(--texto)">${esc(g.nombre)}
            <span class="chip">${g.dias} días · ${fmtPct(g.pct)}</span></h3>
          <p class="ayuda" style="margin:0 0 10px">${esc(g.ayuda)}</p>
          <div class="grid c4">
            ${g.conceptos.map(x => campo(
                `${x.nombre} (${x.cod})${x.inactivo ? ' ·' : ''}`,
                `ausentismo.detalle.${x.cod}`,
                { tipo: 'number', calc: true,
                  titulo: x.inactivo ? 'Días que el colaborador no percibe haberes de la empresa' : '' })).join('')}
          </div>`).join('')}
        <p class="ayuda" style="margin-top:6px">
          Los conceptos marcados con · son días que el colaborador no percibe de la empresa:
          los paga un tercero (ART, ANSES) o no se pagan. Es un dato de costo, aparte de si la
          ausencia se podía evitar.
        </p>

        <div class="kpis" style="margin-top:20px">
          ${kpi('Ausentismo total', fmtPct(c.ausentismo.pctTotal), `${c.ausentismo.totalDias} días`)}
          ${kpi('Días evitables', c.ausentismo.diasGestionables, fmtPct(c.ausentismo.pctGestionable) + ' de la base · sobre esto se puede trabajar', 'aviso')}
          ${kpi('Sin goce de haberes', c.ausentismo.diasInactivos, c.ausentismo.diasInactivos ? 'los paga un tercero o no se pagan' : 'ninguno')}
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

  /* --------------------- 6. Talento y matriz 9-box ------------------- */
  /* Los colaboradores viven en la sucursal, no en la visita: la evaluación es
     un estado vigente que se ajusta cuando el gerente aporta algo nuevo, y
     cada movimiento queda fechado en el historial. */

  let fichaAbierta = null;   // id del colaborador con la talent card desplegada

  function panelTalento(v, s) {
    const d = distribucion9Box(s.colaboradores);
    const equipo = s.colaboradores || [];

    const chip = c => {
      const q = cuadranteDe(c.potencial, c.desempeno);
      return `<div class="persona" draggable="true" data-colab="${c.id}" title="${esc(c.nombre)} — ${esc(c.posicion || 'sin posición')}${q ? ' · ' + esc(q.nombre) : ''}">
        ${esc(c.nombre || 'Sin nombre')}
        <span>${esc(c.posicion || '')}</span>
      </div>`;
    };

    const celda = (pot, des) => {
      const q = NINE_BOX[String(pot) + String(des)];
      const gente = d.celdas[String(pot) + String(des)] || [];
      return `<div class="caja tono-${q.tono}" data-pot="${pot}" data-des="${des}">
        <div class="caja-cab">${esc(q.nombre)} <span>${gente.length}</span></div>
        <div class="caja-gente">${gente.map(chip).join('')}</div>
      </div>`;
    };

    return `
      <section class="tarjeta">
        <h2>Evaluación de desempeño y potencial</h2>
        <p class="ayuda">
          Evaluación hecha en conjunto con el Gerente de Tienda. Vive en la sucursal, no en esta visita:
          cuando el gerente aporte algo nuevo, cambiás el valor acá o arrastrás a la persona en la matriz
          y el movimiento queda fechado en su historial.
        </p>
        <div class="tabla-scroll"><table>
          <thead><tr>
            <th>Colaborador</th><th>Posición</th><th>Ingreso</th><th class="num">Antig.</th>
            <th>Desempeño</th><th>Potencial</th><th>Cuadrante</th><th>Último movimiento</th><th></th>
          </tr></thead>
          <tbody>
          ${equipo.length ? equipo.map((c, i) => {
            const q = cuadranteDe(c.potencial, c.desempeno);
            const ant = antiguedadAnios(c.fechaIngreso);
            const ult = (c.historial || []).slice(-1)[0];
            return `<tr class="${c.activo === false ? 'inactivo' : ''}">
              <td><input data-colab-campo="${c.id}|nombre" value="${esc(c.nombre)}" placeholder="Apellido y nombre"></td>
              <td><select data-colab-campo="${c.id}|posicion">
                <option value="">—</option>
                ${POSICIONES.map(pp => `<option value="${esc(pp.nombre)}"${c.posicion === pp.nombre ? ' selected' : ''}>${esc(pp.nombre)}</option>`).join('')}
              </select></td>
              <td><input type="date" data-colab-campo="${c.id}|fechaIngreso" value="${esc(c.fechaIngreso)}"></td>
              <td class="num">${ant === null ? '—' : fmtNum(ant, 1)}</td>
              <td><select data-colab-eval="${c.id}|desempeno">
                <option value="">— sin evaluar —</option>
                ${ESCALA_DESEMPENO.map(x => `<option value="${x.valor}"${Number(c.desempeno) === x.valor ? ' selected' : ''}>${x.valor} · ${esc(x.nombre)}</option>`).join('')}
              </select></td>
              <td><select data-colab-eval="${c.id}|potencial">
                <option value="">— sin evaluar —</option>
                ${ESCALA_POTENCIAL.map(x => `<option value="${x.valor}"${Number(c.potencial) === x.valor ? ' selected' : ''}>${x.valor} · ${esc(x.nombre)}</option>`).join('')}
              </select></td>
              <td>${q ? `<span class="chip ${{verde:'verde',amarillo:'ambar',rojo:'rojo',azul:'azul'}[q.tono]}">${esc(q.nombre)}</span>` : '<span class="chip">sin ubicar</span>'}</td>
              <td style="font-size:12px;color:var(--texto-suave)">${ult ? `${fmtFecha(ult.fecha)}${ult.desde ? ` · desde ${ult.desde.desempeno || '—'}/${ult.desde.potencial || '—'}` : ''}` : '—'}</td>
              <td class="num" style="white-space:nowrap">
                <button class="mini" data-accion="ficha" data-id="${c.id}" style="color:var(--azul);border-color:var(--azul)">${fichaAbierta === c.id ? 'Cerrar' : 'Ficha'}</button>
                <button class="mini" data-accion="borrar-colaborador" data-id="${c.id}">✕</button>
              </td>
            </tr>
            ${fichaAbierta === c.id ? `<tr class="ficha-fila"><td colspan="9">${talentCard(c, s)}</td></tr>` : ''}`;
          }).join('') : '<tr><td colspan="9" class="vacio">Sin colaboradores cargados. Agregá el plantel de la sucursal para poder evaluarlo.</td></tr>'}
          </tbody>
        </table></div>
        <div class="acciones">
          <button class="b sec" data-accion="agregar-colaborador">+ Agregar colaborador</button>
          ${d.sinEvaluar.length ? `<span class="chip ambar">${d.sinEvaluar.length} sin evaluar</span>` : ''}
        </div>
      </section>

      <section class="tarjeta">
        <h2>Matriz 9-box</h2>
        <p class="ayuda">
          Arrastrá a una persona de un cuadrante a otro para reubicarla; el cambio queda registrado con la fecha
          de esta visita y el nombre del gerente con quien lo evaluaste.
        </p>

        <div class="ninebox">
          <div class="esquina"></div>
          <div class="rot-cab">Por debajo</div>
          <div class="rot-cab">Esperado</div>
          <div class="rot-cab">Supera</div>

          <div class="eje-y">Potencial</div>

          <div class="eje-lbl">Alto</div>${celda(3, 1)}${celda(3, 2)}${celda(3, 3)}
          <div class="eje-lbl">Puede crecer</div>${celda(2, 1)}${celda(2, 2)}${celda(2, 3)}
          <div class="eje-lbl">En su nivel</div>${celda(1, 1)}${celda(1, 2)}${celda(1, 3)}

          <div class="eje-x">Desempeño</div>
        </div>

        ${d.sinEvaluar.length ? `<div class="aviso-caja">
          Sin ubicar en la matriz: ${d.sinEvaluar.map(c => esc(c.nombre || 'sin nombre')).join(', ')}.
        </div>` : ''}

        <div class="kpis" style="margin-top:18px">
          ${kpi('Plantel evaluado', `${d.evaluados.length} / ${d.activos.length}`)}
          ${kpi('Listos para crecer', d.listosParaCrecer.length, 'desempeño y potencial ≥ 2', d.listosParaCrecer.length ? 'ok' : '')}
          ${kpi('A trabajar', d.aTrabajar.length, d.aTrabajar.map(c => c.nombre).join(', ').slice(0, 60), d.aTrabajar.length ? 'aviso' : '')}
          ${kpi('En riesgo', d.enRiesgo.length, d.enRiesgo.map(c => c.nombre).join(', ').slice(0, 60), d.enRiesgo.length ? 'alerta' : 'ok')}
          ${kpi('Riesgo de salida alto', d.riesgoDeSalida.length, d.riesgoDeSalida.map(c => c.nombre).join(', ').slice(0, 60), d.riesgoDeSalida.length ? 'alerta' : 'ok')}
          ${kpi('Estudiando', d.estudiando.length, 'con formación en curso')}
        </div>
      </section>

      ${equipo.some(c => c.desempeno && c.potencial) ? `
      <section class="tarjeta">
        <h2>Qué hacer con cada cuadrante</h2>
        <div class="grid c2">
          ${Object.keys(NINE_BOX).filter(k => (d.celdas[k] || []).length).map(k => {
            const q = NINE_BOX[k];
            return `<div class="alerta tono-borde-${q.tono}">
              <div class="alerta-cab">
                <span class="chip ${{verde:'verde',amarillo:'ambar',rojo:'rojo',azul:'azul'}[q.tono]}">${esc(q.nombre)}</span>
                <span class="alerta-titulo">${d.celdas[k].map(c => esc(c.nombre)).join(', ')}</span>
              </div>
              <p class="alerta-msg">${esc(q.lectura)}</p>
              <p class="alerta-regla">${esc(q.accion)}</p>
            </div>`;
          }).join('')}
        </div>
      </section>` : ''}`;
  }

  /* ---------------------------- Talent card --------------------------- */
  function talentCard(c, s, opciones) {
    const q = cuadranteDe(c.potencial, c.desempeno);
    const ant = antiguedadAnios(c.fechaIngreso);
    const campoC = (etiqueta, campo, opciones) => {
      const o = opciones || {};
      const val = esc(c[campo] ?? '');
      let control;
      if (o.tipo === 'textarea') control = `<textarea data-colab-campo="${c.id}|${campo}" style="min-height:70px" placeholder="${esc(o.placeholder || '')}">${val}</textarea>`;
      else if (o.tipo === 'select') control = `<select data-colab-campo="${c.id}|${campo}">${o.opciones.map(x =>
        `<option value="${esc(x.id)}"${c[campo] === x.id ? ' selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select>`;
      else control = `<input type="${o.tipo || 'text'}" data-colab-campo="${c.id}|${campo}" value="${val}" placeholder="${esc(o.placeholder || '')}">`;
      return `<label class="campo"><span>${esc(etiqueta)}</span>${control}</label>`;
    };

    /* Dentro del perfil el encabezado ya está arriba: no se repite. */
    const cab = (opciones || {}).sinCabecera ? '' : `
      <div class="tc-cab">
        <div>
          <strong>${esc(c.nombre || 'Sin nombre')}</strong>
          <span>${esc(c.posicion || 'sin posición')}${ant === null ? '' : ` · ${fmtNum(ant, 1)} años en la empresa`}</span>
        </div>
        ${q ? `<span class="chip ${{verde:'verde',amarillo:'ambar',rojo:'rojo',azul:'azul'}[q.tono]}">${esc(q.nombre)}</span>` : ''}
      </div>`;

    return `<div class="talent-card"${(opciones || {}).sinCabecera ? ' style="padding:0"' : ''}>
      ${cab}
      <h4>Formación</h4>
      <div class="grid c3">
        ${campoC('¿Estudia?', 'estudia', { tipo: 'select', opciones: NIVELES_ESTUDIO })}
        ${campoC('Carrera o curso', 'carrera', { placeholder: 'ej. Farmacia' })}
        ${campoC('Avance', 'avanceEstudio', { placeholder: 'ej. 2º año, 40%' })}
        ${campoC('Formación previa', 'formacionPrevia', { placeholder: 'Títulos, cursos anteriores' })}
      </div>

      <h4>Desarrollo</h4>
      <div class="grid c3">
        ${campoC('¿Dónde quiere desarrollarse?', 'interesDesarrollo', { placeholder: 'Lo que dijo el colaborador' })}
        ${campoC('Próxima posición que aspira', 'aspiracion', { placeholder: 'ej. Senior, Farmacéutica' })}
        ${campoC('Movilidad', 'movilidad', { tipo: 'select', opciones: MOVILIDAD })}
      </div>

      <h4>Lectura del desempeño</h4>
      <div class="grid c2">
        ${campoC('Fortalezas', 'fortalezas', { tipo: 'textarea', placeholder: 'En qué se destaca' })}
        ${campoC('A desarrollar', 'aDesarrollar', { tipo: 'textarea', placeholder: 'Qué necesita para el próximo paso' })}
      </div>
      <div class="grid c2" style="margin-top:12px">
        ${campoC('Riesgo de salida', 'riesgoSalida', { tipo: 'select', opciones: RIESGO_SALIDA })}
        ${campoC('Notas', 'notas', { placeholder: 'Lo que quieras recordar de esta persona' })}
      </div>

      ${q ? `<div class="aviso-caja info" style="margin-top:16px">
        <strong>${esc(q.nombre)}.</strong> ${esc(q.lectura)} ${esc(q.accion)}
      </div>` : ''}

      ${(c.historial || []).length ? `
        <h4>Historial de evaluaciones</h4>
        <div class="tabla-scroll"><table>
          <thead><tr><th>Fecha</th><th>Desempeño</th><th>Potencial</th><th>Cuadrante</th><th>Evaluado con</th><th>Motivo</th></tr></thead>
          <tbody>${c.historial.slice().reverse().map(h => {
            const hq = cuadranteDe(h.potencial, h.desempeno);
            return `<tr>
              <td>${fmtFecha(h.fecha)}</td>
              <td>${(ESCALA_DESEMPENO.find(x => x.valor === h.desempeno) || {}).nombre || '—'}</td>
              <td>${(ESCALA_POTENCIAL.find(x => x.valor === h.potencial) || {}).nombre || '—'}</td>
              <td>${hq ? esc(hq.nombre) : '—'}</td>
              <td>${esc(h.evaluadoCon || '—')}</td>
              <td>${esc(h.motivo || '—')}</td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>` : ''}
    </div>`;
  }

  /* --------------------------- 7. Sucesión -------------------------- */
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
        <h2>Posiciones críticas y plan de sucesión</h2>
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

  /* Medidor del costo laboral sobre la venta contra la banda de referencia.
     Un valor y dos umbrales: indicador de estado, no gráfico. */
  function medidorCostoVenta(d, p) {
    if (d.pctCostoVenta === null) return '';
    const tope = Math.max(0.20, d.pctCostoVenta * 1.25);
    const x = v => Math.min(100, (v / tope) * 100);
    const clase = { eficiente: 'verde', atencion: 'ambar', alerta: 'rojo', sd: '' }[d.banda.zona];

    return `<div class="medidor">
      <div class="valor">
        <strong>${fmtPct(d.pctCostoVenta)}</strong>
        <span class="chip ${clase}">${d.banda.icono} ${esc(d.banda.texto)}</span>
        <em>del costo laboral sobre la venta neta</em>
      </div>
      <div class="pista">
        <div class="zona z1" style="width:${x(p.benchmarkCostoVenta)}%"></div>
        <div class="zona z2" style="width:${x(p.alertaCostoVenta) - x(p.benchmarkCostoVenta)}%"></div>
        <div class="zona z3" style="width:${100 - x(p.alertaCostoVenta)}%"></div>
        <div class="umbral" style="left:${x(p.benchmarkCostoVenta)}%"></div>
        <div class="umbral" style="left:${x(p.alertaCostoVenta)}%"></div>
        <div class="marca" style="left:${x(d.pctCostoVenta)}%" title="Esta sucursal: ${fmtPct(d.pctCostoVenta)}"></div>
      </div>
      <div class="escala">
        <span style="left:${x(p.benchmarkCostoVenta)}%"><b>${fmtPct(p.benchmarkCostoVenta, 0)}</b>objetivo</span>
        <span style="left:${x(p.alertaCostoVenta)}%"><b>${fmtPct(p.alertaCostoVenta, 0)}</b>techo de alerta</span>
      </div>
      <p style="font-size:13px;margin:6px 0 0">${esc(d.banda.lectura)}</p>
    </div>`;
  }

  /* ---------------------- 7. Dotación vs. venta --------------------- */
  function panelDotacion(v, s, c) {
    const d = c.dotacion, p = Store.get().config.parametros;
    return `
      <section class="tarjeta">
        <h2>6. Dotación óptima según venta</h2>
        <p class="ayuda">
          El costo laboral sobre la venta se lee contra dos umbrales: hasta ${fmtPct(p.benchmarkCostoVenta, 0)} es el objetivo,
          y ${fmtPct(p.alertaCostoVenta, 0)} es el techo de alerta de la actividad.
          La dotación óptima reparte el presupuesto del objetivo (venta × ${fmtPct(p.benchmarkCostoVenta, 0)}) entre el costo promedio por empleado;
          la dotación máxima es la que la venta sostiene antes de tocar el techo.
          ${s.tipo === 'staff' ? 'Esta sucursal está marcada como <strong>staff</strong>: se mide contra la venta de la red, no contra venta propia.' : ''}
        </p>
        <div class="grid c4">
          ${campo('Venta neta del período', 'comercial.venta', { tipo: 'number', calc: true })}
          ${campo('Venta de la red (para staff)', 'comercial.ventaRed', { tipo: 'number', calc: true })}
          ${campo('Tickets del período', 'comercial.tickets', { tipo: 'number', calc: true })}
          ${campo('Horas trabajadas', 'comercial.horasTrabajadas', { tipo: 'number', calc: true })}
        </div>

        ${d.tipo === 'venta' ? medidorCostoVenta(d, p) : ''}

        <div class="kpis" style="margin-top:18px">
          ${kpi('Costo laboral real', d.costoReal ? dinero(d.costoReal) : '—', `factor de cargas ${fmtNum(p.factorCargas)}`)}
          ${kpi('Dotación actual', c.matriz.total.heads || '—')}
          ${kpi('Dotación óptima', d.dotacionOptima === null ? '—' : d.dotacionOptima,
                d.diferencia === null ? '' : `diferencia ${d.diferencia > 0 ? '+' : ''}${d.diferencia}`)}
          ${d.dotacionMaxima === null || d.dotacionMaxima === undefined ? '' :
            kpi('Dotación máxima', d.dotacionMaxima, `antes del techo del ${fmtPct(p.alertaCostoVenta, 0)}`,
                c.matriz.total.heads > d.dotacionMaxima ? 'alerta' : '')}
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
    const faltantes = Reporte.faltantesVisita(v, s, c);
    const plan = v.diagnostico.plan || [];
    return `
      <section class="tarjeta">
        <h2>7. Diagnóstico y plan de seguimiento</h2>
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
          ${(() => {
            const d = Reporte.destinatario(s, config);
            return `Destinatario: <strong>${esc(d.nombre || 'sin cargar')}</strong> &lt;${esc(d.email || 'sin email')}&gt;`;
          })()}
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
        <pre class="reporte" id="vista-reporte">${esc(Reporte.textoVisita(v, s, config))}</pre>
      </section>`;
  }

  /* ============================= RUTEO ============================= */
  function render() {
    const ruta = (location.hash || '#/red').replace(/^#\/?/, '').split('/');
    const e = Store.get();
    let html = '';

    if (ruta[0] === 'nomina')        { vistaActual = vistaNomina;    html = vistaNomina(); }
    else if (ruta[0] === 'agenda' || ruta[0] === 'asistente') {
      vistaActual = vistaAsistente; html = vistaAsistente();
    }
    else if (ruta[0] === 'diario' || ruta[0] === 'presentismo') {
      /* `#/diario/<colaborador>` abre el alta con esa persona ya elegida: es
         como se llega desde su ficha, sin tener que buscarla en el
         desplegable de 139 nombres. */
      if (ruta[1] && Store.colaboradorPorId(ruta[1])) ausenciaAbierta = ruta[1];
      vistaActual = vistaDiario;    html = vistaDiario();
    }
    else if (ruta[0] === 'operacion' || ruta[0] === 'ventas') {
      vistaActual = vistaOperacion; html = vistaOperacion();
    }
    else if (ruta[0] === 'visitas')  { vistaActual = vistaVisitas;   html = vistaVisitas(); }
    else if (ruta[0] === 'reclamos') {
      /* `#/reclamos/<sucursal>` es como se llega desde la visita y desde la
         ficha de la tienda: la pantalla es la misma, filtrada. */
      if (ruta[1] !== undefined) reclamoSuc = ruta[1] || '';
      vistaActual = vistaReclamos;  html = vistaReclamos();
    }
    else if (ruta[0] === 'movimientos') {
      const tab = ruta[1] || 'cesiones';
      vistaActual = () => vistaMovimientos(tab);
      html = vistaMovimientos(tab);
    }
    else if (ruta[0] === 'sucursal' && ruta[1]) {
      const id = ruta[1];
      vistaActual = () => vistaSucursal(id);
      html = vistaSucursal(id);
    }
    else if (ruta[0] === 'estadistica') {
      const tab = ruta[1] || 'resumen';
      vistaActual = () => vistaEstadistica(tab);
      html = vistaEstadistica(tab);
    }
    else if (ruta[0] === 'sucursales') {
      /* La solapa se eliminó, pero la ruta sigue viva: había enlaces guardados
         y el panel ya es la lista de sucursales que servía para trabajar. */
      location.replace(location.href.split('#')[0] + '#/red');
      vistaActual = vistaRed; html = vistaRed();
    }
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
    completarCensoResguardos();
  }

  /* Mantiene viva la vista previa del reporte sin re-renderizar toda la vista
     (evita perder el foco mientras se escribe el diagnóstico). */
  function actualizarVistaPrevia() {
    const pre = document.getElementById('vista-reporte');
    if (!pre || !contexto || !contexto.sucursalId) return;
    const s = Store.sucursal(contexto.sucursalId);
    pre.textContent = Reporte.textoVisita(contexto, s, Store.get().config);
  }

  /**
   * Manda la pregunta y va escribiendo la respuesta a medida que llega. El
   * parcial se pinta tocando un solo nodo: re-renderizar la vista en cada
   * fragmento borraría lo que el coordinador esté escribiendo en la agenda.
   */
  async function cargarDiaDelCalendario() {
    diaEventos = null;
    refrescar();
    try {
      const { eventos } = await Asistente.eventosDelDia();
      diaEventos = { eventos };
    } catch (err) {
      diaEventos = { error: err };
    }
    refrescar();
  }

  async function preguntarAlAsistente(texto) {
    const q = String(texto || '').trim();
    if (!q || chatPensando) return;
    if (!Asistente.disponible()) return avisar('El asistente no está disponible acá.', 'error');

    chatMsgs.push({ rol: 'yo', texto: q });
    chatPensando = true;
    chatAbortar = new AbortController();
    refrescar();
    const hilo = $('#chat-hilo');
    if (hilo) hilo.scrollTop = hilo.scrollHeight;

    try {
      const res = await Asistente.preguntar(q, {
        signal: chatAbortar.signal,
        onText: ({ text }) => {
          const el = $('#chat-parcial');
          if (el) { el.textContent = text; }
          const h = $('#chat-hilo');
          if (h) h.scrollTop = h.scrollHeight;
        },
        alCambiar: () => { /* la vista se refresca al terminar, con la agenda ya tocada */ }
      });
      chatMsgs.push({ rol: 'asistente', texto: res });
    } catch (err) {
      const codigo = err && err.code;
      chatMsgs.push({ rol: 'asistente', texto:
        codigo === 'cancelled'   ? 'Cortado.'
      : codigo === 'rate_limited' ? 'Llegaste al límite por ahora. Probá de nuevo en un rato.'
      : codigo === 'not_granted'  ? 'No diste permiso para consultar a Claude desde esta página.'
      : 'No se pudo contestar: ' + ((err && err.message) || 'error desconocido') });
    } finally {
      chatPensando = false;
      chatAbortar = null;
      refrescar();
      const h = $('#chat-hilo');
      if (h) h.scrollTop = h.scrollHeight;
    }
  }

  function refrescar() {
    if (!vistaActual) return;
    const y = window.scrollY;
    $('#contenido').innerHTML = vistaActual();
    window.scrollTo(0, y);
    completarCensoResguardos();
  }

  /* Abrir cada copia es descifrarla: se hace después de pintar la pantalla para
     no demorar el resto de Configuración. */
  function completarCensoResguardos() {
    document.querySelectorAll('[data-censo]').forEach(async td => {
      const c = await Store.censoResguardo(td.dataset.censo);
      td.textContent = c
        ? `${fmtNum(c.sucursales, 0)} sucursales · ${fmtNum(c.colaboradores, 0)} personas · ${fmtNum(c.visitas, 0)} visitas`
        : 'no se puede abrir con esta clave';
    });

    document.querySelectorAll('[data-rescate]').forEach(async div => {
      const id = div.dataset.rescate;
      const c = await Store.censoResguardo(id);
      if (!c || !c.colaboradores) {
        div.innerHTML = 'La más reciente tampoco tiene plantel. Mirá el resto en ' +
                        '<a href="#/config">Configuración</a>.';
        return;
      }
      div.innerHTML = `La más reciente tiene <strong>${fmtNum(c.colaboradores, 0)} personas</strong> en
        ${fmtNum(c.sucursales, 0)} sucursales.
        <div class="acciones">
          <button class="b" data-accion="restaurar-resguardo" data-id="${id}">Restaurar esa copia</button>
          <a class="b sec" href="#/config" style="text-decoration:none">Ver todas las copias</a>
        </div>`;
    });
  }

  /* ============================ EVENTOS ============================ */
  function conectar() {
    const cont = document.body;

    /* Campos de la talent card: colaborador identificado por id, no por índice,
       para que reordenar la tabla no pise datos de otra persona. */
    /* La talent card se edita desde la visita y también desde la pantalla de la
       sucursal, donde no hay visita en curso: se busca por id en todo el padrón. */
    function colaboradorDe(ref) {
      const [id] = String(ref).split('|');
      const suc = visitaEnCurso ? Store.sucursal(visitaEnCurso.sucursalId) : null;
      const propio = suc ? suc.colaboradores.find(c => c.id === id) : null;
      if (propio) return propio;
      let hallado = null;
      Store.get().sucursales.forEach(x =>
        (x.colaboradores || []).forEach(c => { if (c.id === id) hallado = c; }));
      return hallado;
    }

    /** Sucursal a la que pertenece un colaborador. */
    function sucursalDeColaborador(id) {
      return Store.get().sucursales.find(x =>
        (x.colaboradores || []).some(c => c.id === id)) || null;
    }

    cont.addEventListener('input', ev => {
      if (ev.target.id !== 'buscar-nomina') return;
      nominaFiltro = ev.target.value;
      const pos = ev.target.selectionStart;
      refrescar();
      /* Re-renderizar la lista rehace el input: hay que devolverle el foco y el
         cursor donde estaba, o se escribe una letra y se pierde el teclado. */
      const nuevo = $('#buscar-nomina');
      if (nuevo) { nuevo.focus(); nuevo.setSelectionRange(pos, pos); }
    });

    cont.addEventListener('keydown', ev => {
      if (ev.target.id === 'chat-entrada' && ev.key === 'Enter') {
        ev.preventDefault();
        preguntarAlAsistente(ev.target.value);
      }
    });

    cont.addEventListener('input', ev => {
      const el = ev.target.closest('[data-colab-campo]');
      if (!el) return;
      const c = colaboradorDe(el.dataset.colabCampo);
      if (!c) return;
      c[el.dataset.colabCampo.split('|')[1]] = el.value;
      guardarDiferido();
    });

    cont.addEventListener('change', ev => {
      const campo = ev.target.closest('[data-colab-campo]');
      if (campo) {
        const c = colaboradorDe(campo.dataset.colabCampo);
        if (c) { c[campo.dataset.colabCampo.split('|')[1]] = campo.value; Store.save(); refrescar(); }
        return;
      }
      const evalu = ev.target.closest('[data-colab-eval]');
      if (evalu) {
        const [id, cual] = evalu.dataset.colabEval.split('|');
        const c = colaboradorDe(id);
        if (!c) return;
        const s = visitaEnCurso ? Store.sucursal(visitaEnCurso.sucursalId) : sucursalDeColaborador(id);
        registrarEvaluacion(c,
          cual === 'desempeno' ? evalu.value : c.desempeno,
          cual === 'potencial' ? evalu.value : c.potencial,
          visitaEnCurso
            ? { fecha: visitaEnCurso.fecha,
                evaluadoCon: visitaEnCurso.minutaGerente.participante || (s ? s.gerente : '') || '',
                motivo: 'Ajuste en la visita' }
            : { fecha: hoyISO(),
                evaluadoCon: (s ? s.gerente : '') || '',
                motivo: 'Ajuste desde el perfil' });
        Store.save(); refrescar();
      }
    });

    /* Check list: el punto y el campo viajan en data-cl porque las claves son
       ids de punto y setPath partiría por el punto de la ruta. */
    cont.addEventListener('input', ev => {
      const el = ev.target.closest('[data-cl]');
      if (!el || !visitaEnCurso) return;
      const [id, campo] = el.dataset.cl.split('|');
      const cl = visitaEnCurso.checklist;
      if (id === '_') cl[campo] = el.value;
      else (cl[campo] || (cl[campo] = {}))[id] = el.value;
      guardarDiferido();
    });

    /* Licencias y sanciones de la ficha: la persona y el registro se ubican por
       id porque la lista se reordena sola por fecha. */
    function registroDe(ref, coleccion) {
      const [colabId, regId, campo] = String(ref).split('|');
      const c = Store.colaboradorPorId(colabId);
      if (!c) return null;
      const reg = (c[coleccion] || []).find(x => x.id === regId);
      return reg ? { reg, campo } : null;
    }

    cont.addEventListener('input', ev => {
      const el = ev.target.closest('[data-lic], [data-san]');
      if (!el) return;
      const r = el.dataset.lic
        ? registroDe(el.dataset.lic, 'licencias')
        : registroDe(el.dataset.san, 'sanciones');
      if (!r) return;
      r.reg[r.campo] = el.value;
      guardarDiferido();
    });

    cont.addEventListener('change', ev => {
      const chk = ev.target.closest('[data-lic-check], [data-san-check]');
      if (chk) {
        const r = chk.dataset.licCheck
          ? registroDe(chk.dataset.licCheck, 'licencias')
          : registroDe(chk.dataset.sanCheck, 'sanciones');
        if (r) { r.reg[r.campo] = chk.checked; Store.save(); }
        return;
      }
      if (ev.target.id === 'licencia-anio') {
        licenciaAnio = ev.target.value;
        refrescar();
        return;
      }
      const el = ev.target.closest('[data-lic], [data-san]');
      if (!el) return;
      Store.save();
      /* Los días, el tipo y la fecha cambian el saldo contra el tope: se
         redibuja para que el contador diga la verdad. */
      refrescar();
    });

    /* Agenda: el apunte se ubica por id, no por índice, para que reordenar la
       lista —que se reordena sola por fecha— no pise otro apunte. */
    cont.addEventListener('input', ev => {
      const el = ev.target.closest('[data-item], [data-hito]');
      if (!el) return;
      if (el.dataset.item) {
        const [id, campo] = el.dataset.item.split('|');
        const it = Store.item(id);
        if (it) it[campo] = el.value;
      } else {
        const [id, i, campo] = el.dataset.hito.split('|');
        const it = Store.item(id);
        if (it && it.hitos[Number(i)]) it.hitos[Number(i)][campo] = el.value;
      }
      guardarDiferido();
    });

    cont.addEventListener('change', ev => {
      const chk = ev.target.closest('[data-item-check]');
      if (chk) {
        const [id, campo] = chk.dataset.itemCheck.split('|');
        const it = Store.item(id);
        if (it) { it[campo] = chk.checked; Store.save(); }
        return;
      }
      const el = ev.target.closest('[data-item], [data-hito]');
      if (!el) return;
      Store.save();
      /* El estado, el tema y las fechas cambian el cajón donde cae el apunte:
         se redibuja. El título y el detalle no, para no perder el foco. */
      if (el.dataset.hito || /\|(estado|tema|sucursalId)$/.test(el.dataset.item || '')) refrescar();
    });

    /* Enter en el campo de alta rápida: anotar sin sacar la mano del teclado. */
    cont.addEventListener('keydown', ev => {
      if (ev.target.id === 'anotar-agenda' && ev.key === 'Enter') {
        ev.preventDefault();
        const b = document.querySelector('[data-accion="anotar"]');
        if (b) b.click();
      }
    });

    cont.addEventListener('change', ev => {
      const cert = ev.target.closest('[data-aus-certificado]');
      if (cert) {
        const [colabId, ausId] = cert.dataset.ausCertificado.split('|');
        const a = Store.ausencia(colabId, ausId);
        if (a) { a.certificado = cert.checked; Store.save(); }
        refrescar();
        avisar(cert.checked ? 'Certificado presentado.' : 'Vuelve a quedar pendiente de justificar.');
        return;
      }
      if (ev.target.id === 'diario-fecha' || ev.target.id === 'diario-historico') {
        diarioFecha = ev.target.value || ayerISO();
        refrescar();
      }
    });

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

      if (a === 'ficha-sucursal') {
        fichaSucursal = fichaSucursal === btn.dataset.id ? null : btn.dataset.id;
        refrescar();
      }

      if (a === 'cargar-plantel') {
        const r = Store.cargarPlantelArea3();
        refrescar();
        const caja = $('#resultado-nomina');
        if (caja) {
          caja.innerHTML = `<div class="aviso-caja info">
            <strong>${r.nuevos} persona${r.nuevos === 1 ? '' : 's'} cargada${r.nuevos === 1 ? '' : 's'}</strong>${
              r.actualizados ? ` y ${r.actualizados} actualizada${r.actualizados === 1 ? '' : 's'}` : ''}.
            Falta completar CUIL, DNI, teléfono, domicilio y mails: eso entra pegando la planilla acá arriba.
          </div>`;
        }
        avisar(`Plantel del área cargado: ${r.nuevos + r.actualizados} personas.`);
      }

      if (a === 'cargar-padron') {
        const r = Store.cargarPadronArea3();
        refrescar();
        avisar(!r.nuevas && !r.completadas
          ? 'El padrón ya estaba cargado, no hubo cambios.'
          : `${r.nuevas} sucursal${r.nuevas === 1 ? '' : 'es'} agregada${r.nuevas === 1 ? '' : 's'}` +
            (r.completadas ? ` y ${r.completadas} completada${r.completadas === 1 ? '' : 's'}.` : '.'));
      }

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
        location.hash = `#/visita/${v.id}/checklist`;
      }

      if (a === 'nueva-visita-desde-selector') {
        const sel = $('#visita-sucursal');
        if (!sel || !sel.value) return avisar('Elegí primero a qué sucursal vas.', 'error');
        const v = Store.crearVisita(sel.value);
        location.hash = `#/visita/${v.id}/checklist`;
      }

      if (a === 'nueva-visita-selector') {
        const sel = $('#selector-sucursal');
        if (!sel.value) return avisar('Elegí primero una sucursal en el selector.', 'error');
        const v = Store.crearVisita(sel.value);
        location.hash = `#/visita/${v.id}/checklist`;
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
      if (a === 'agregar-colaborador') {
        Store.agregarColaborador(visitaEnCurso.sucursalId, {});
        refrescar();
      }
      if (a === 'ficha') {
        fichaAbierta = fichaAbierta === btn.dataset.id ? null : btn.dataset.id;
        refrescar();
      }
      if (a === 'borrar-colaborador') {
        const suc = Store.sucursal(visitaEnCurso.sucursalId);
        const c = suc.colaboradores.find(x => x.id === btn.dataset.id);
        const ok = await confirmar('Quitar del plantel',
          `${c && c.nombre ? c.nombre : 'El colaborador'} se elimina junto con su evaluación y su historial.`,
          'Quitar');
        if (ok) { Store.eliminarColaborador(suc.id, btn.dataset.id); refrescar(); avisar('Colaborador eliminado.'); }
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

      /* --- reclamos --- */
      if (a === 'agregar-reclamo') {
        const sucursalId = ($('#reclamo-sucursal') || {}).value;
        if (!sucursalId) return avisar('Elegí la sucursal.', 'error');
        const nombre = ($('#reclamo-colaborador') || {}).value || '';
        const tipo = ($('#reclamo-tipo') || {}).value || TIPOS_RECLAMO[0].id;
        if (!String(nombre).trim()) return avisar('Poné al menos el nombre de quien reclama.', 'error');

        const r = Store.agregarReclamo({
          sucursalId, colaborador: String(nombre).trim(), tipo, fecha: hoyISO()
        });
        reclamoAbierto = r.id;
        refrescar();
        avisar('Reclamo registrado. Completá el detalle para poder seguirlo.');
      }

      if (a === 'abrir-reclamo') {
        reclamoAbierto = reclamoAbierto === btn.dataset.id ? null : btn.dataset.id;
        refrescar();
      }

      if (a === 'filtro-reclamos') { reclamoFiltro = btn.dataset.f; refrescar(); }

      if (a === 'reclamos-toda-el-area') {
        reclamoSuc = '';
        location.hash = '#/reclamos';
        refrescar();
        return;
      }

      if (a === 'borrar-reclamo') {
        const r = Store.reclamo(btn.dataset.id);
        const ok = await confirmar('Borrar el reclamo',
          `Se borra lo registrado de ${r ? (r.colaborador || 'esa persona') : 'esa persona'} y su historial.`,
          'Borrar reclamo');
        if (ok) { Store.eliminarReclamo(btn.dataset.id); reclamoAbierto = null; refrescar(); avisar('Reclamo borrado.'); }
      }

      /* --- sucursal y perfil --- */
      /* --- ausencias con certificado --- */
      if (a === 'nueva-ausencia') {
        const id = ($('#aus-colab') || {}).value || '';
        if (!id) return avisar('Elegí a quién le vas a cargar la ausencia.', 'error');
        ausenciaAbierta = id;
        refrescar();
        return;
      }
      if (a === 'abrir-ausencia') {
        ausenciaAbierta = btn.dataset.id;
        if ((location.hash || '').indexOf('diario') < 0) location.hash = '#/diario';
        else refrescar();
        return;
      }
      if (a === 'cerrar-ausencia') { ausenciaAbierta = null; refrescar(); return; }

      if (a === 'guardar-ausencia') {
        const desde = valorDe('#aus-desde');
        if (!desde) return avisar('Poné el día en que empezó la ausencia.', 'error');
        const hasta = valorDe('#aus-hasta');
        if (hasta && hasta < desde) return avisar('El alta no puede ser anterior al inicio.', 'error');
        const cert = !!($('#aus-certificado') || {}).checked;
        Store.agregarAusencia(btn.dataset.id, {
          desde, hasta,
          motivo: valorDe('#aus-motivo') || 'enfermedad',
          diagnostico: valorDe('#aus-nota'),
          certificado: cert
        });
        ausenciaAbierta = null;
        refrescar();
        avisar(!cert
          ? 'Ausencia registrada, pendiente de justificar hasta que traiga el certificado.'
          : hasta
            ? `Ausencia registrada hasta el ${fmtFecha(hasta)}. Te aviso cuando se acerque.`
            : 'Ausencia registrada sin fecha de alta: va a quedar avisando hasta que la cargues.');
        return;
      }

      if (a === 'reincorporar') {
        Store.reincorporar(btn.dataset.id, btn.dataset.aus);
        refrescar();
        avisar('Marcada como reincorporada.');
        return;
      }
      if (a === 'quitar-ausencia') {
        const ok = await confirmar('Quitar la ausencia',
          'Se borra el registro con sus fechas. Si la persona volvió, mejor marcala como reincorporada: así queda el historial.',
          'Quitar');
        if (ok) { Store.quitarAusencia(btn.dataset.id, btn.dataset.aus); refrescar(); }
        return;
      }

      /* --- el asistente --- */
      if (a === 'chat-sugerencia') { preguntarAlAsistente(btn.dataset.q); return; }
      if (a === 'chat-enviar')     { preguntarAlAsistente(valorDe('#chat-entrada')); return; }
      if (a === 'chat-cortar')     { if (chatAbortar) chatAbortar.abort(); return; }
      if (a === 'chat-limpiar')    { chatMsgs = []; Asistente.limpiar(); refrescar(); return; }
      if (a === 'reintentar-dia')  { cargarDiaDelCalendario(); return; }

      /* --- baja, cesión de contrato y modificación --- */
      if (a === 'form-mov') {
        formMovimiento = (formMovimiento && formMovimiento.colabId === btn.dataset.id &&
                          formMovimiento.tipo === btn.dataset.tipo)
          ? null : { colabId: btn.dataset.id, tipo: btn.dataset.tipo };
        refrescar();
      }
      if (a === 'cerrar-form-mov') { formMovimiento = null; refrescar(); }

      if (a === 'guardar-baja') {
        const motivo = $('#mov-motivo');
        const elegido = motivo ? motivo.options[motivo.selectedIndex] : null;
        const r = Store.registrarBaja(btn.dataset.id, {
          fecha: valorDe('#mov-fecha'),
          grupo: elegido ? elegido.dataset.grupo : valorDe('#mov-grupo'),
          motivo: valorDe('#mov-motivo'),
          observaciones: valorDe('#mov-obs')
        });
        formMovimiento = null;
        refrescar();
        avisar(r ? `Baja registrada al ${fmtFecha(r.fecha)}. Queda en el listado de bajas.`
                 : 'No se encontró a esa persona.', r ? '' : 'error');
      }

      if (a === 'revertir-baja') {
        const ok = await confirmar('Deshacer la baja',
          'La persona vuelve al plantel de su sucursal y se borra el registro de la baja.',
          'Deshacer');
        if (ok) { Store.revertirBaja(btn.dataset.id); refrescar(); avisar('La persona volvió al plantel.'); }
      }

      if (a === 'guardar-mov') {
        const tipo = btn.dataset.tipo;
        if (tipo === 'cesion' && !valorDe('#mov-destino')) {
          avisar('Elegí la sucursal de destino.', 'error');
          return;
        }
        Store.registrarMovimiento(btn.dataset.id, tipo === 'cesion'
          ? { tipo, haciaSucursalId: valorDe('#mov-destino'),
              vigencia: valorDe('#mov-vigencia'), observaciones: valorDe('#mov-obs') }
          : { tipo, cargoNuevo: valorDe('#mov-cargo'), jornadaNueva: valorDe('#mov-jornada'),
              vigencia: valorDe('#mov-vigencia'), observaciones: valorDe('#mov-obs') });
        formMovimiento = null;
        refrescar();
        avisar('Queda pendiente de autorizar. Se ve en “Cesiones y bajas”.');
      }

      if (a === 'autorizar-mov') {
        const m = Store.autorizarMovimiento(btn.dataset.id, btn.dataset.mov);
        refrescar();
        avisar(!m ? 'No se pudo autorizar.'
          : m.estado === 'aplicada' ? 'Autorizada y aplicada.'
          : `Autorizada. Se aplica el ${fmtFecha(m.vigencia)}.`, m ? '' : 'error');
      }
      if (a === 'aplicar-mov') {
        Store.aplicarMovimiento(btn.dataset.id, btn.dataset.mov);
        refrescar();
        avisar('Aplicada.');
      }
      if (a === 'anular-mov') {
        Store.anularMovimiento(btn.dataset.id, btn.dataset.mov);
        refrescar();
        avisar('Anulada.');
      }

      if (a === 'limpiar-nomina') {
        nominaFiltro = '';
        nominaEstado = 'todos';
        refrescar();
        const el = $('#buscar-nomina');
        if (el) el.focus();
        return;
      }

      if (a === 'ver-baja') {
        bajaAbierta = bajaAbierta === btn.dataset.id ? null : btn.dataset.id;
        refrescar();
      }

      if (a === 'ver-perfil') {
        formMovimiento = null;
        perfilAbierto = perfilAbierto === btn.dataset.id ? null : btn.dataset.id;
        refrescar();
        if (perfilAbierto) {
          setTimeout(() => {
            const el = document.getElementById('perfil-colaborador');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 60);
        }
      }
      if (a === 'cerrar-perfil') { perfilAbierto = null; refrescar(); }

      /* --- check list de RRHH --- */
      if (a === 'enviar-checklist' || a === 'copiar-checklist' || a === 'descargar-checklist') {
        const vis = Store.visita(btn.dataset.id);
        const suc = Store.sucursal(vis.sucursalId);
        const texto = Reporte.textoChecklist(vis, suc, e.config);

        if (a === 'copiar-checklist') {
          try { await navigator.clipboard.writeText(texto); avisar('Informe copiado.'); }
          catch (_) { avisar('No se pudo copiar: seleccioná el texto de la vista previa.', 'error'); }
          return;
        }
        if (a === 'descargar-checklist') {
          guardarArchivo(`checklist-${suc.codigo || 'sucursal'}-${vis.fecha}.txt`, texto);
          return;
        }

        const chk = evaluarChecklist(vis.checklist.checks);
        if (!chk.total.aplicables && !chk.total.noAplica) {
          return avisar('Todavía no marcaste ningún punto del check list.', 'error');
        }
        const d = Reporte.destinatario(suc, e.config);
        const ok = await confirmar('Enviar el informe del check list',
          `Cumplimiento ${fmtPct(chk.total.pct, 1)} — ${chk.total.aprobados} aprobados de ` +
          `${chk.total.aplicables} aplicables.\n\n` +
          `Va a ${d.nombre || 'Gerente de Operaciones'} <${d.email || 'sin email'}>` +
          (suc.emailGerente ? ` y a ${suc.gerente || 'Gerente de Tienda'} <${suc.emailGerente}>` : '') +
          (chk.total.sinEvaluar ? `\n\nQuedan ${chk.total.sinEvaluar} puntos sin evaluar.` : ''),
          'Enviar');
        if (!ok) return;

        try {
          const res = await Reporte.enviarChecklist(vis, suc, e.config);
          refrescar();
          avisar(res.via === 'webhook'
            ? `Informe enviado a ${res.destino}.`
            : 'Se abrió tu cliente de correo con el informe cargado.');
        } catch (err) {
          avisar('No se pudo enviar: ' + err.message, 'error');
        }
      }

      if (a === 'abrir-check') {
        checkAbierto = checkAbierto === btn.dataset.id ? null : btn.dataset.id;
        refrescar();
      }

      if (a === 'marcar-check') {
        const cl = visitaEnCurso && visitaEnCurso.checklist;
        if (!cl) return;
        const id = btn.dataset.id;
        /* Volver a tocar el mismo estado lo desmarca: equivocarse no tiene que
           costar abrir un menú. */
        cl.checks[id] = cl.checks[id] === btn.dataset.e ? '' : btn.dataset.e;
        Store.save();
        refrescar();
      }

      if (a === 'ver-banco') {
        bancoVisible = bancoVisible === btn.dataset.id ? null : btn.dataset.id;
        refrescar();
      }

      /* --- ficha del colaborador: licencias y sanciones --- */
      if (a === 'agregar-licencia') {
        Store.agregarLicencia(btn.dataset.id, {
          desde: (licenciaAnio && licenciaAnio !== String(new Date().getFullYear()))
            ? `${licenciaAnio}-01-01` : hoyISO()
        });
        refrescar();
      }

      if (a === 'quitar-licencia') {
        Store.quitarLicencia(btn.dataset.id, btn.dataset.lic);
        refrescar();
      }

      if (a === 'agregar-sancion-colab') {
        Store.agregarSancionColaborador(btn.dataset.id);
        refrescar();
      }

      if (a === 'quitar-sancion-colab') {
        const c = Store.colaboradorPorId(btn.dataset.id);
        const ok = await confirmar('Quitar la sanción',
          `Se borra del legajo de ${c ? c.nombre : 'la persona'}. La progresividad se mide sobre lo que quede registrado.`,
          'Quitar');
        if (!ok) return;
        Store.quitarSancionColaborador(btn.dataset.id, btn.dataset.san);
        refrescar();
      }

      /* --- agenda --- */
      if (a === 'anotar') {
        const campo = $('#anotar-agenda');
        const linea = (campo || {}).value || '';
        if (!linea.trim()) return avisar('Escribí qué querés anotar.', 'error');
        const nuevo = Store.anotar(linea);
        if (campo) campo.value = '';
        refrescar();
        const f = nuevo.hitos[0];
        avisar(f ? `Anotado para el ${fmtFecha(f.fecha)}.` : 'Anotado, sin fecha.');
        const otro = $('#anotar-agenda');
        if (otro) otro.focus();
      }

      if (a === 'pegar-largo') {
        const caja = $('#caja-largo');
        if (caja) { caja.hidden = !caja.hidden; if (!caja.hidden) $('#pegar-agenda').focus(); }
      }

      if (a === 'anotar-largo') {
        const crudo = ($('#pegar-agenda') || {}).value || '';
        if (!crudo.trim()) return avisar('Pegá primero el texto.', 'error');
        const nuevo = Store.anotarTexto(crudo);
        itemAbierto = nuevo.id;
        refrescar();
        avisar(nuevo.hitos.length
          ? `Anotado con ${nuevo.hitos.length} fecha${nuevo.hitos.length === 1 ? '' : 's'}.`
          : 'Anotado. No se le encontraron fechas: agregalas a mano si tiene.');
      }

      if (a === 'abrir-item') {
        itemAbierto = itemAbierto === btn.dataset.id ? null : btn.dataset.id;
        refrescar();
      }

      if (a === 'marcar-hecho') {
        const i = Store.item(btn.dataset.id);
        const cerrado = (ESTADOS_AGENDA_POR_ID[i.estado] || {}).cerrado;
        Store.marcarHecho(i.id, !cerrado);
        refrescar();
        avisar(cerrado ? 'Vuelta a abrir.' : 'Hecha.');
      }

      if (a === 'ver-hechas') { verHechas = !verHechas; refrescar(); }

      if (a === 'agregar-hito') {
        const i = Store.item(btn.dataset.id);
        i.hitos.push({ fecha: hoyISO(), que: 'Hacer', contexto: '' });
        Store.save();
        refrescar();
      }

      if (a === 'quitar-hito') {
        const i = Store.item(btn.dataset.id);
        i.hitos.splice(Number(btn.dataset.i), 1);
        Store.save();
        refrescar();
      }

      /* Si se corrige el texto, las fechas hay que volver a sacarlas: no se
         recalculan solas para no pisar las que se editaron a mano. */
      if (a === 'releer-fechas') {
        const i = Store.item(btn.dataset.id);
        const halladas = fechasDeTexto(`${i.titulo}\n${i.detalle}`, i.fecha);
        if (!halladas.length) return avisar('No se encontró ninguna fecha en el texto.', 'error');
        const ok = await confirmar('Leer las fechas del texto',
          `Se encontraron ${halladas.length}: ${halladas.map(h => fmtFecha(h.fecha)).join(', ')}. ` +
          'Reemplazan a las que están cargadas ahora.', 'Reemplazar');
        if (!ok) return;
        i.hitos = halladas;
        Store.save();
        refrescar();
        avisar(`${halladas.length} fecha${halladas.length === 1 ? '' : 's'} cargada${halladas.length === 1 ? '' : 's'}.`);
      }

      if (a === 'copiar-item') {
        const texto = textoParaTiendas(Store.item(btn.dataset.id), hoyISO());
        try { await navigator.clipboard.writeText(texto); avisar('Copiado, listo para reenviar.'); }
        catch (_) { avisar('No se pudo copiar. Seleccioná el texto a mano.', 'error'); }
      }

      if (a === 'borrar-item') {
        const i = Store.item(btn.dataset.id);
        const ok = await confirmar('Borrar de la agenda', `Se borra “${i.titulo}” y sus fechas.`, 'Borrar');
        if (!ok) return;
        Store.eliminarItem(i.id);
        itemAbierto = null;
        refrescar();
        avisar('Borrado.');
      }


      if (a === 'importar-rdv') {
        const crudo = ($('#pegar-rdv') || {}).value || '';
        if (!crudo.trim()) return avisar('Pegá primero la hoja del RDV.', 'error');

        const r = Store.importarRDV(diarioFecha, crudo);
        if (r.error) return avisar(r.error, 'error');
        refrescar();

        const caja = $('#resultado-rdv');
        if (caja) {
          caja.innerHTML = `<div class="aviso-caja info" style="margin-top:12px">
            <strong>${r.cargadas} tienda${r.cargadas === 1 ? '' : 's'} del área</strong>
            cargada${r.cargadas === 1 ? '' : 's'} en el ${fmtFecha(diarioFecha)}.
            ${r.sinUbicar.length ? `<br>No se pudieron ubicar en el padrón:
              <strong>${esc(r.sinUbicar.join(', '))}</strong>.
              Revisá que el nombre de la tienda coincida con el del panel.` : ''}
          </div>`;
        }
        avisar(r.cargadas ? `Venta importada en ${r.cargadas} sucursal${r.cargadas === 1 ? '' : 'es'}.`
                          : 'No se pudo cruzar ninguna tienda con el padrón.',
               r.cargadas ? '' : 'error');
      }

      if (a === 'copiar-ventas') {
        const texto = Reporte.textoVentasDia(diarioFecha, Store.get().config);
        try { await navigator.clipboard.writeText(texto); avisar('Resumen copiado.'); }
        catch (_) { avisar('No se pudo copiar: seleccioná el texto de la vista previa.', 'error'); }
      }

      if (a === 'descargar-ventas') {
        guardarArchivo(`ventas-${diarioFecha}.txt`,
                       Reporte.textoVentasDia(diarioFecha, Store.get().config));
      }

      /* --- nómina del área --- */
      if (a === 'importar-nomina') {
        const crudo = ($('#pegar-nomina') || {}).value || '';
        if (!crudo.trim()) return avisar('Pegá primero la nómina.', 'error');

        const leido = interpretarNomina(crudo);
        if (!leido.filas.length) {
          /* El motivo puede ser largo —explica qué seleccionar— así que va en la
             caja de resultado y no en el aviso flotante, que se va solo. */
          const caja0 = $('#resultado-nomina');
          if (caja0) {
            caja0.innerHTML = `<div class="aviso-caja" style="margin-top:12px">
              <strong>No se importó nada.</strong> ${esc(leido.avisos[0] || 'No se pudo leer la nómina.')}
            </div>`;
          }
          return avisar('No se pudo leer la nómina. Mirá el detalle debajo del campo.', 'error');
        }

        /* Que la planilla se lea no quiere decir que sirva: sin sucursal en las
           filas no se guarda nadie, y hasta ahora eso se descubría después. */
        const conTienda = leido.filas.filter(f => String(f.tienda || '').trim()).length;
        if (!conTienda) {
          const caja0 = $('#resultado-nomina');
          if (caja0) {
            caja0.innerHTML = `<div class="aviso-caja" style="margin-top:12px">
              <strong>Se leyeron ${leido.filas.length} personas pero ninguna trae sucursal.</strong>
              Sin eso no hay dónde ubicarlas y no se guardaría nada. Volvé a copiar desde la
              columna CUIL hasta la última de la derecha, con la fila de encabezados incluida.
            </div>`;
          }
          return avisar('Ninguna fila trae sucursal: no se importó nada.', 'error');
        }

        const res = resumirNomina(leido.filas);
        const tiendas = Object.keys(res.porTienda).length;
        const ok = await confirmar(
          `Importar ${res.personas} persona${res.personas === 1 ? '' : 's'}`,
          `Se reparten en ${tiendas} tienda${tiendas === 1 ? '' : 's'} según su columna TIENDA. ` +
          'A quien ya esté cargado se le actualizan los datos y la posición; las evaluaciones, ' +
          'la talent card y los talles no se tocan.',
          'Importar nómina');
        if (!ok) return;

        const r = Store.importarNomina(leido.filas);
        refrescar();
        const caja = $('#resultado-nomina');
        if (caja) {
          caja.innerHTML = `<div class="aviso-caja info" style="margin-top:12px">
            <strong>${r.total} persona${r.total === 1 ? '' : 's'}</strong>:
            ${r.nuevos} nueva${r.nuevos === 1 ? '' : 's'}, ${r.actualizados} actualizada${r.actualizados === 1 ? '' : 's'}${r.movidos ? `, ${r.movidos} que cambiaron de tienda` : ''}.
            ${r.sucursalesNuevas.length ? `<br>Se crearon estas tiendas porque no estaban en el padrón:
              <strong>${esc(r.sucursalesNuevas.join(', '))}</strong>.` : ''}
            ${r.sinTienda.length ? `<br><strong>${r.sinTienda.length} sin sucursal en la planilla, quedaron afuera:</strong>
              ${esc(r.sinTienda.slice(0, 8).join(', '))}${r.sinTienda.length > 8 ? ` y ${r.sinTienda.length - 8} más` : ''}.` : ''}
            ${r.discrepancias.length ? `<br><strong>${r.discrepancias.length} persona${r.discrepancias.length === 1 ? ' llega' : 's llegan'} con un CUIL
              distinto del que ya estaba guardado.</strong> Se mantiene el guardado; conviene ver cuál es el correcto
              y corregirlo en el archivo de origen, porque con el CUIL mal esa persona no cruza con el resto de las planillas.
              <ul>${r.discrepancias.map(x => `<li>${esc(x.nombre)}: <code>${esc(x.guardado)}</code> vs <code>${esc(x.entrante)}</code>${x.porNombre ? ' — se reconoció por el nombre' : ''}</li>`).join('')}</ul>` : ''}
            ${(r.noFiguran || []).length ? `<br><strong>${r.noFiguran.length} persona${r.noFiguran.length === 1 ? ' estaba' : 's estaban'} cargada${r.noFiguran.length === 1 ? '' : 's'} y ${r.noFiguran.length === 1 ? 'no vino' : 'no vinieron'} en esta planilla.</strong>
              Siguen contando en la dotación hasta que las des de baja. Casi siempre es gente que se fue:
              revisalas y, si corresponde, cargales la baja desde su ficha.
              <ul>${r.noFiguran.map(x => `<li>${esc(x.nombre)} — ${esc(x.sucursal)}</li>`).join('')}</ul>` : ''}
            ${leido.avisos.length ? `<ul>${leido.avisos.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
          </div>`;
        }
        avisar(`Nómina importada: ${r.total} persona${r.total === 1 ? '' : 's'}.`);
      }

      /* --- novedades de liquidación --- */
      if (a === 'importar-novedades') {
        const crudo = ($('#pegar-novedades') || {}).value || '';
        if (!crudo.trim()) return avisar('Pegá primero la hoja del libro de novedades.', 'error');

        const leido = interpretarNovedades(crudo);
        if (!leido.filas.length) {
          return avisar(leido.avisos[0] || 'No se pudo leer la planilla.', 'error');
        }

        const suc = Store.sucursal(estadSuc);
        const resumen = resumirNovedades(leido.filas);
        const ok = await confirmar(
          `Importar ${resumen.personas} persona${resumen.personas === 1 ? '' : 's'}`,
          `Se cargan en ${Store.etiquetaSucursal(suc)}, período ${estadPeriodo}: ` +
          `${fmtNum(resumen.horasExtras, 1)} horas extras y ${fmtNum(resumen.diasAusencia, 0)} días de ausencia. ` +
          (leido.tienda ? `La planilla dice tienda “${leido.tienda}”. ` : '') +
          'Si ya habías importado este mes, se reemplazan sus novedades.',
          'Importar');
        if (!ok) return;

        const r = Store.importarNovedades(suc.id, estadPeriodo, leido.filas);
        refrescar();

        const caja = $('#resultado-novedades');
        if (caja) {
          caja.innerHTML = `<div class="aviso-caja info" style="margin-top:12px">
            <strong>${r.total} persona${r.total === 1 ? '' : 's'} importada${r.total === 1 ? '' : 's'}</strong>
            — ${r.nuevos} nueva${r.nuevos === 1 ? '' : 's'} en el plantel,
            ${r.actualizados} que ya estaban.
            ${leido.avisos.length ? `<ul>${leido.avisos.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
            ${r.ausentesDelPadron.length ? `<br><strong>No vinieron en esta hoja</strong> y siguen activos en el plantel:
              ${esc(r.ausentesDelPadron.slice(0, 10).join(' · '))}${r.ausentesDelPadron.length > 10 ? ' …' : ''}.
              Revisá si son bajas.` : ''}
          </div>`;
        }
        avisar(`${r.total} persona${r.total === 1 ? '' : 's'} cargada${r.total === 1 ? '' : 's'} en ${estadPeriodo}.`);
      }

      if (a === 'crear-registro-periodo') {
        const v = Store.crearVisita(estadSuc);
        /* Se fecha al último día del mes: es el registro del período, no una
           visita del día de hoy. */
        const [anio, mes] = estadPeriodo.split('-').map(Number);
        v.fecha = new Date(anio, mes, 0).toISOString().slice(0, 10);
        v.periodo = estadPeriodo;
        Store.save();
        refrescar();
        avisar(`Registro de ${estadPeriodo} creado.`);
      }

      /* --- estadística mensual --- */
      if (a === 'enviar-estadistica' || a === 'copiar-estadistica' || a === 'descargar-estadistica') {
        const suc = Store.sucursal(estadSuc);
        const texto = Reporte.textoMensual(suc.id, estadPeriodo, e.config);

        if (a === 'copiar-estadistica') {
          try {
            await navigator.clipboard.writeText(texto);
            btn.textContent = '\u2713 Copiado';
            setTimeout(() => { btn.textContent = 'Copiar'; }, 1800);
          } catch (err) {
            const pre = $('#vista-estadistica');
            if (pre) { const r = document.createRange(); r.selectNode(pre); getSelection().removeAllRanges(); getSelection().addRange(r); }
            avisar('No se pudo copiar solo. La estadística quedó seleccionada: copialo con Ctrl+C.', 'error');
          }
        }

        if (a === 'descargar-estadistica') {
          await guardarArchivo(`estadistica-${suc.codigo}-${estadPeriodo}.txt`, texto, 'text/plain');
        }

        if (a === 'enviar-estadistica') {
          const ok = await confirmar(
            'Enviar la estadística',
            `Se manda la estadística de ${Store.etiquetaSucursal(suc)} del período ${estadPeriodo} ` +
            `a ${Reporte.destinatario(suc, e.config).nombre || 'el Gerente de Operaciones'}.`,
            'Enviar estadística');
          if (!ok) return;
          try {
            const r = await Reporte.enviarMensual(suc.id, estadPeriodo, e.config);
            refrescar();
            avisar(r.via === 'webhook'
              ? `Estadística enviada a ${r.destino}.`
              : 'Se abrió tu cliente de correo con la estadística cargada. Revisalo y mandalo.');
          } catch (err) {
            avisar(err.message, 'error');
          }
        }
      }

      if (a === 'traer-padron') {
        const v = Store.visita(btn.dataset.id);
        const d = Store.dotacionDelPadron(v.sucursalId, v.periodo);
        const ok = await confirmar(
          'Traer la dotación del padrón',
          `Se pisan las columnas de mes completo, ausencias y horas extras de la matriz con lo que ` +
          `figura en las novedades de ${esc(v.periodo)} (${d.personas} persona${d.personas === 1 ? '' : 's'}), ` +
          'y se completa el ausentismo por concepto. Los sueldos y las altas y bajas no se tocan.',
          'Traer del padrón');
        if (!ok) return;
        const r = Store.aplicarPadronAVisita(v.id);
        refrescar();
        avisar(r
          ? `Matriz cargada con ${r.personas} persona${r.personas === 1 ? '' : 's'}.` +
            (r.sinPosicion.length ? ` ${r.sinPosicion.length} quedaron afuera por no tener posición.` : '')
          : 'No hay novedades cargadas para ese período.', r ? '' : 'error');
      }

      /* --- reporte --- */
      if (a === 'enviar-reporte' || a === 'copiar-reporte' || a === 'descargar-reporte') {
        const v = Store.visita(btn.dataset.id);
        const s = Store.sucursal(v.sucursalId);
        const texto = Reporte.textoVisita(v, s, e.config);

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
            const r = await Reporte.enviarVisita(v, s, e.config);
            refrescar();
            avisar(r.via === 'webhook' ? `Reporte enviado a ${r.destino}.` : `Se abrió tu cliente de correo con el reporte para ${r.destino}.`);
          } catch (err) {
            avisar('No se pudo enviar: ' + err.message, 'error');
            btn.disabled = false; btn.textContent = original;
          }
        }
      }

      if (a === 'imprimir') window.print();

      if (a === 'bloquear') location.reload();

      /* --- respaldos --- */
      if (a === 'ejemplo') {
        const ok = await confirmar('Cargar datos de ejemplo',
          'Se reemplaza todo el contenido actual por dos sucursales con una visita completa. Si ya cargaste información real, exportá antes un respaldo.',
          'Cargar ejemplo');
        if (ok) { Store.cargarEjemplo(); location.hash = '#/red'; render(); avisar('Datos de ejemplo cargados.'); }
      }
      if (a === 'exportar') { if (await Store.exportar()) refrescar(); }
      if (a === 'importar') $('#archivo-import').click();
      if (a === 'reiniciar') {
        const ok = await confirmar('Borrar todo',
          'Se eliminan todas las sucursales y visitas guardadas en este navegador. No se puede deshacer.',
          'Borrar todo');
        if (ok) { Store.reiniciar(); location.hash = '#/red'; render(); avisar('Tablero vacío. Quedó una copia en Configuración por si fue sin querer.'); }
      }

      if (a === 'resguardar') {
        avisar(Store.resguardarAhora('Copia a mano')
          ? 'Copia guardada en este navegador.'
          : 'No hizo falta: la última copia ya tiene este mismo contenido.');
        refrescar();
      }
      if (a === 'restaurar-resguardo') {
        const ok = await confirmar('Restaurar la copia',
          'Se reemplaza todo el contenido actual por el de esa copia. Antes de hacerlo se guarda una copia de lo que hay ahora, así también se puede volver.',
          'Restaurar');
        if (ok) {
          try {
            await Store.restaurarResguardo(btn.dataset.id);
            location.hash = '#/red'; render();
            avisar('Contenido restaurado.');
          } catch (err) {
            avisar('No se pudo restaurar: ' + err.message, 'error');
          }
        }
      }
      if (a === 'borrar-resguardo') {
        const ok = await confirmar('Borrar la copia',
          'Se elimina esa copia. Las demás quedan como están.', 'Borrar');
        if (ok) { Store.eliminarResguardo(btn.dataset.id); refrescar(); }
      }
      if (a === 'recuperar-ilegible') {
        const ok = await confirmar('Recuperar el contenido apartado',
          'Se reemplaza lo que hay ahora por ese contenido. Antes se guarda una copia de lo actual, así también se puede volver.',
          'Recuperar');
        if (ok) {
          try {
            Store.recuperarIlegible();
            location.hash = '#/red'; render();
            avisar('Contenido recuperado.');
          } catch (err) { avisar('No se pudo recuperar: ' + err.message, 'error'); }
        }
      }
      if (a === 'descartar-ilegible') {
        const ok = await confirmar('Descartar el contenido apartado',
          'Se borra el texto que no se pudo leer al abrir. Si tenías clave puesta y todavía no la probaste, cancelá y probala primero.',
          'Descartar');
        if (ok) { Store.descartarIlegible(); refrescar(); }
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
      const rec = ev.target.closest('[data-reclamo-estado]');
      if (rec) {
        Store.cambiarEstadoReclamo(rec.dataset.reclamoEstado, rec.value);
        refrescar();
        return;
      }
      if (ev.target.id === 'reclamo-filtro-suc') {
        reclamoSuc = ev.target.value;
        reclamoAbierto = null;
        location.hash = reclamoSuc ? '#/reclamos/' + reclamoSuc : '#/reclamos';
        refrescar();
        return;
      }
      if (ev.target.id === 'orden-nomina') { nominaOrden = ev.target.value; refrescar(); return; }
      if (ev.target.id === 'estado-nomina') { nominaEstado = ev.target.value; refrescar(); return; }
      if (ev.target.id === 'estad-sucursal') {
        estadSuc = ev.target.value;
        estadPeriodo = null;   // se recalcula con los períodos de la nueva sucursal
        refrescar();
        return;
      }
      if (ev.target.id === 'estad-periodo') {
        estadPeriodo = ev.target.value || hoyISO().slice(0, 7);
        refrescar();
        return;
      }
      if (ev.target.id === 'selector-sucursal' && ev.target.value) {
        const v = Store.ultimaVisita(ev.target.value);
        const idSuc = ev.target.value;
        ev.target.value = '';
        if (v) { location.hash = `#/visita/${v.id}/checklist`; return; }
        confirmar('Sin visitas registradas',
          `${Store.etiquetaSucursal(Store.sucursal(idSuc))} todavía no tiene visitas. ¿Registrar una ahora?`,
          'Registrar visita').then(ok => {
            if (!ok) return;
            const nueva = Store.crearVisita(idSuc);
            location.hash = `#/visita/${nueva.id}/checklist`;
          });
      }
    });

    /* Arrastrar una persona entre cuadrantes de la matriz. */
    let arrastrando = null;
    cont.addEventListener('dragstart', ev => {
      const el = ev.target.closest('.persona');
      if (!el) return;
      arrastrando = el.dataset.colab;
      el.classList.add('arrastrando');
      ev.dataTransfer.effectAllowed = 'move';
      ev.dataTransfer.setData('text/plain', arrastrando);
    });
    cont.addEventListener('dragend', ev => {
      const el = ev.target.closest('.persona');
      if (el) el.classList.remove('arrastrando');
      document.querySelectorAll('.caja.encima').forEach(x => x.classList.remove('encima'));
      arrastrando = null;
    });
    cont.addEventListener('dragover', ev => {
      const caja = ev.target.closest('.caja');
      if (!caja || !arrastrando) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'move';
      caja.classList.add('encima');
    });
    cont.addEventListener('dragleave', ev => {
      const caja = ev.target.closest('.caja');
      if (caja) caja.classList.remove('encima');
    });
    cont.addEventListener('drop', ev => {
      const caja = ev.target.closest('.caja');
      const id = arrastrando || ev.dataTransfer.getData('text/plain');
      if (!caja || !id || !visitaEnCurso) return;
      ev.preventDefault();
      const suc = Store.sucursal(visitaEnCurso.sucursalId);
      const c = suc && suc.colaboradores.find(x => x.id === id);
      if (!c) return;
      const antes = cuadranteDe(c.potencial, c.desempeno);
      const cambio = registrarEvaluacion(c, caja.dataset.des, caja.dataset.pot, {
        fecha: visitaEnCurso.fecha,
        evaluadoCon: visitaEnCurso.minutaGerente.participante || suc.gerente || '',
        motivo: 'Reubicado en la matriz'
      });
      Store.save(); refrescar();
      if (cambio) {
        const ahora = cuadranteDe(c.potencial, c.desempeno);
        avisar(`${c.nombre || 'Colaborador'}: ${antes ? antes.nombre + ' → ' : ''}${ahora ? ahora.nombre : 'sin ubicar'}.`);
      }
    });

    window.addEventListener('hashchange', render);
  }

  async function iniciar() {
    const previa = (() => {
      // El área y el coordinador se muestran en la portada, así que se leen
      // antes de desbloquear. Si están cifrados, la portada va sin ellos.
      try {
        const crudo = localStorage.getItem(CLAVE_ALMACEN);
        return crudo ? (JSON.parse(crudo).config || {}) : {};
      } catch (e) { return {}; }
    })();

    let cif = null;
    try {
      cif = await Acceso.pedirAcceso(previa);
    } catch (err) {
      console.warn('No se pudo mostrar la portada de acceso.', err);
    }

    try {
      await Store.init(cif);
    } catch (err) {
      document.getElementById('contenido').innerHTML =
        `<section class="tarjeta"><h2>No se pudo abrir el contenido</h2>
         <p class="ayuda">${esc(err.message)} Volvé a cargar la página e ingresá la clave de nuevo.
         Si tenés un respaldo exportado, podés empezar de cero e importarlo.</p></section>`;
      return;
    }

    conectar();
    /* Lo autorizado con vigencia futura se vuelca el día que corresponde, no
       antes: si no, el plantel de hoy mostraría a alguien en una tienda a la
       que todavía no fue. */
    /* El visor contesta después del primer render: se pide y se refresca cuando
       llegue, en vez de hacer esperar a toda la página por esto. */
    Asistente.iniciar().then(ok => {
      if (ok && (location.hash || '').indexOf('asistente') >= 0) refrescar();
      if (ok) { const av = document.getElementById('asistente-espera'); if (av) av.remove(); }
    });
    Asistente.iniciarConectores().then(() => {
      if (Asistente.estadoCalendario().hay) cargarDiaDelCalendario();
      else refrescar();
    });

    const aplicados = Store.aplicarMovimientosVencidos();
    render();
    if (aplicados.length) {
      avisar(aplicados.length === 1
        ? `Se aplicó la ${aplicados[0].tipo === 'cesion' ? 'cesión' : 'modificación'} de ${aplicados[0].nombre}, vigente desde el ${fmtFecha(aplicados[0].vigencia)}.`
        : `Se aplicaron ${aplicados.length} movimientos que ya estaban vigentes. Los ves en “Cesiones y bajas”.`);
    }
    if (Store.cifrado()) {
      const btn = document.getElementById('btn-bloquear');
      if (btn) btn.hidden = false;
      avisar('Panel abierto. El contenido se guarda cifrado en esta computadora.');
    }
  }

  return { iniciar, render, refrescar };
})();

document.addEventListener('DOMContentLoaded', App.iniciar);
