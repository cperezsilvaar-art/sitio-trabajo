/*
 * asistente.js — El asistente del coordinador, conectado a Claude.
 *
 * La agenda sola ya servía para no olvidarse de nada. Lo que no hacía era
 * contestar: “¿qué tengo que mirar hoy?”, “¿cuánta gente me queda en Rivadavia
 * si se va la DT?”, “armame el mail para Operaciones”. Para eso hace falta que
 * alguien lea el tablero, y ese alguien es Claude.
 *
 * Dos condiciones que mandan sobre todo lo demás:
 *
 * 1. El panel tiene que abrir desde file:// y sin conexión. El asistente es un
 *    agregado: si no está, la agenda funciona igual. `disponible()` devuelve
 *    false y la pantalla lo dice, sin romperse ni ofrecer un botón muerto.
 *
 * 2. Lo que se manda es un resumen, no el padrón. Van números por sucursal y lo
 *    que el coordinador ya escribió en su agenda; nunca CUIL, DNI, teléfono,
 *    domicilio, mail, banco ni CBU. Los nombres van solo donde hacen falta para
 *    entender de quién se habla: quién se fue, quién reclamó, quién no cubre
 *    turno.
 */

const Asistente = (() => {
  let sample = null;          // la función que pregunta, o null si no hay visor
  let resuelto = false;       // ya se intentó resolverla
  let turnos = [];            // la conversación, que el modelo no recuerda solo

  /**
   * Resuelve la capacidad una sola vez. Puede tardar: el visor contesta después
   * del primer render, así que la pantalla se dibuja sin esperar a esto.
   */
  async function iniciar() {
    if (resuelto) return sample;
    resuelto = true;
    try {
      if (typeof window !== 'undefined' && window.claude && window.claude.use) {
        sample = await window.claude.use('sample');
      }
    } catch (err) {
      sample = null;
    }
    return sample;
  }

  const disponible = () => !!sample;

  /* ---------------------- los conectores del visor ---------------------- *
     El calendario de Google, con las credenciales de quien abre la página: el
     código nunca ve un token. Vale lo mismo que para `sample`: si no está, la
     pantalla lo dice y el resto sigue andando. */

  const CALENDARIO = 'Google Calendar';
  let mcp = null, mcpResuelto = false;
  let servidores = null;              // lo que el visor dice que hay conectado

  async function iniciarConectores() {
    if (mcpResuelto) return mcp;
    mcpResuelto = true;
    try {
      if (typeof window !== 'undefined' && window.claude && window.claude.use) {
        mcp = await window.claude.use('mcp');
      }
    } catch (err) { mcp = null; }
    if (mcp) {
      try { servidores = (await mcp.listTools()).servers || []; }
      catch (err) { servidores = []; }
    }
    return mcp;
  }

  /** Cómo está el calendario para este visor, sin llamar a nada. */
  function estadoCalendario() {
    if (!mcp) return { hay: false, motivo: 'sin-visor' };
    const s = (servidores || []).find(x => x.server === CALENDARIO);
    if (!s) return { hay: false, motivo: 'server_not_connected' };
    if (s.authStatus === 'needs_reauth') return { hay: false, motivo: 'needs_reauth' };
    if (!s.tools.length) return { hay: false, motivo: 'selection_required' };
    return { hay: true, motivo: '' };
  }

  /**
   * Los eventos de un día. Se pide con el rango en hora local porque el
   * conector resuelve las fechas sin zona con la del calendario, y el
   * coordinador trabaja en Buenos Aires, no en UTC.
   */
  async function eventosDelDia(fechaISO) {
    if (!mcp) throw Object.assign(new Error('Sin visor'), { code: 'capability_disabled' });
    const dia = fechaISO || _hoy();
    const desde = new Date(dia + 'T00:00:00');
    const hasta = new Date(dia + 'T23:59:59');
    const r = await mcp.callTool(CALENDARIO, 'list_events', {
      startTime: desde.toISOString(),
      endTime: hasta.toISOString(),
      orderBy: 'startTime',
      pageSize: 20
    }, { cache: { staleTime: 60000 } });

    const p = r.payload || {};
    const eventos = (p.events || []).map(ev => ({
      titulo: ev.summary || '(sin título)',
      desde: (ev.start || {}).dateTime || (ev.start || {}).date || '',
      hasta: (ev.end || {}).dateTime || (ev.end || {}).date || '',
      todoElDia: !(ev.start || {}).dateTime,
      tipo: ev.eventType || 'DEFAULT',
      estado: ev.status || ''
    })).filter(x => x.estado !== 'cancelled');
    return { eventos, cache: r.cache || null };
  }

  /** La hora de un evento, para mostrar y para contarle al modelo. */
  function horaDe(ev) {
    if (ev.todoElDia) return 'todo el día';
    const d = new Date(ev.desde);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  /**
   * Qué hacer con cada error del conector. No hay un cartel único: cada código
   * tiene un arreglo distinto, y esconderlos atrás de “algo falló” deja al
   * coordinador sin saber que le alcanzaba con reconectar.
   */
  function explicarError(err) {
    const c = (err && err.code) || 'upstream_error';
    switch (c) {
      case 'needs_reauth':
        return { texto: 'Se venció el acceso al calendario. Reconectalo en claude.ai → Configuración → Conectores.', reintentar: false };
      case 'server_not_connected':
        return { texto: 'No tenés el calendario conectado. Se agrega en claude.ai → Configuración → Conectores.', reintentar: false };
      case 'selection_required':
        return { texto: 'Tenés más de un calendario con ese nombre y todavía no elegiste cuál.', reintentar: false };
      case 'server_unavailable':
        return { texto: 'Google no contestó. Probá de nuevo en un momento.', reintentar: true };
      case 'blocked_by_policy':
      case 'approval_required':
        return { texto: 'La política de tu organización no permite esta consulta.', reintentar: false };
      case 'not_granted':
      case 'capability_disabled':
      case 'capability_removed':
        return { texto: 'Esta versión del panel no puede leer el calendario.', reintentar: false };
      case 'tool_error':
        return { texto: 'El calendario rechazó la consulta: ' + ((err && err.message) || ''), reintentar: false };
      case 'cancelled':
        return { texto: 'Consulta cortada.', reintentar: false };
      default:
        return { texto: 'No se pudo leer el calendario.', reintentar: false };
    }
  }

  const historial = () => turnos.slice();
  const limpiar = () => { turnos = []; };

  /* ------------------------- lo que sabe el panel ------------------------ */

  const _f = (n, d) => (typeof fmtNum === 'function' ? fmtNum(n, d) : String(n));
  /* `hoyISO` vive adentro del módulo de la interfaz y no llega hasta acá. Igual
     que allá, la fecha es la de acá y no la de UTC. */
  const _hoy = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };

  /**
   * Radiografía del área en texto plano. Se arma en cada pregunta porque el
   * tablero cambia mientras se conversa, y porque el modelo no recuerda nada:
   * lo que no va en este bloque, no existe para él.
   */
  function contexto() {
    const e = Store.get();
    const hoy = _hoy();
    const L = [];

    L.push(`Hoy es ${hoy}.`);
    L.push(`Área: ${e.config.area || 'Área 3'}. Coordinador de RRHH: ${e.config.coordinador || '—'}.`);

    const d = Store.dotacionDelArea();
    L.push('');
    L.push('DOTACIÓN');
    L.push(`- ${d.tiendas} tiendas · ${d.personas} personas de piso · ${_f(d.fte, 1)} FTE · ${d.parciales} de media jornada.`);
    L.push(`- Fuera del piso: ${d.noPresenciales} con bloqueo de título o no presenciales, ${d.flotantes} flotantes del área, ${d.sinActividad} sin actividad, ${d.bajas} dados de baja.`);
    if (d.sucursalesSinPlantel.length) {
      L.push(`- Sin plantel cargado: ${d.sucursalesSinPlantel.join(', ')}.`);
    }
    e.sucursales.forEach(s => {
      const x = d.porSucursal[s.id];
      if (!x || (!x.personas && !x.noPresenciales.length)) return;
      const extra = [];
      if (x.parciales) extra.push(`${x.parciales} media jornada`);
      if (x.noPresenciales.length) extra.push(`${x.noPresenciales.length} con bloqueo (${x.noPresenciales.map(y => y.nombre).join('; ')})`);
      if (x.sinActividad.length) extra.push(`${x.sinActividad.length} sin actividad`);
      L.push(`  · ${s.nombre || s.codigo}: ${x.personas} personas, ${_f(x.fte, 1)} FTE${extra.length ? ' — ' + extra.join(', ') : ''}.`);
    });

    /* Las visitas: hace cuánto que no se pisa cada tienda es la pregunta que
       más veces se hace en voz alta durante la semana. */
    L.push('');
    L.push('VISITAS');
    const sinVisita = [];
    e.sucursales.forEach(s => {
      const v = Store.ultimaVisita(s.id);
      if (!v) { if (s.tipo !== 'staff') sinVisita.push(s.nombre || s.codigo); return; }
      const chk = evaluarChecklist((v.checklist || {}).checks).total;
      L.push(`  · ${s.nombre || s.codigo}: última el ${v.fecha}` +
             (chk.pct === null ? ', check list sin evaluar' : `, check list ${_f(chk.pct * 100, 0)}%`) +
             (v.envio.enviado ? '' : ', reporte sin enviar') + '.');
    });
    if (sinVisita.length) L.push(`  · Sin visita registrada: ${sinVisita.join(', ')}.`);

    const reclamos = e.reclamos.filter(r => !(ESTADOS_RECLAMO_POR_ID[r.estado] || {}).cerrado);
    if (reclamos.length) {
      L.push('');
      L.push(`RECLAMOS ABIERTOS (${reclamos.length})`);
      reclamos.slice(0, 20).forEach(r => {
        const s = Store.sucursal(r.sucursalId);
        L.push(`  · ${r.colaborador || 'sin nombre'} (${s ? s.nombre || s.codigo : '—'}): ` +
               `${(TIPOS_RECLAMO_POR_ID[r.tipo] || {}).nombre || r.tipo}, planteado el ${r.fecha || '—'}, ` +
               `estado ${(ESTADOS_RECLAMO_POR_ID[r.estado] || {}).nombre || r.estado}.`);
      });
    }

    const movs = Store.movimientos().filter(x => x.mov.estado === 'pendiente' || x.mov.estado === 'autorizada');
    if (movs.length) {
      L.push('');
      L.push('CESIONES Y MODIFICACIONES SIN CERRAR');
      movs.forEach(({ colaborador: c, mov: m }) => {
        const h = Store.sucursal(m.haciaSucursalId);
        L.push(`  · ${c.nombre}: ${m.tipo}${h ? ' hacia ' + (h.nombre || h.codigo) : ''}, ` +
               `vigencia ${m.vigencia || 'sin fecha'}, ${m.estado}.`);
      });
    }

    const bajas = Store.bajas();
    if (bajas.length) {
      L.push('');
      L.push(`BAJAS REGISTRADAS (${bajas.length})`);
      bajas.slice(0, 15).forEach(b => {
        L.push(`  · ${b.colaborador.nombre} (${b.sucursal.nombre || b.sucursal.codigo}): ` +
               `${b.baja.fecha}, ${b.baja.grupo || '—'} / ${b.baja.motivo || '—'}.`);
      });
    }

    const r = repartirAgenda(e.agenda, hoy);
    L.push('');
    L.push('MI AGENDA');
    const linea = x => `  · [${x.item.id}] ${x.item.titulo}` +
      (x.estado.texto ? ` — ${x.estado.texto}` : '') +
      (x.item.estado === 'esperando' ? ' (esperando respuesta)' : '');
    if (r.vencidas.length) { L.push(' Vencidas:'); r.vencidas.forEach(x => L.push(linea(x))); }
    if (r.urgentes.length) { L.push(' Hoy y mañana:'); r.urgentes.forEach(x => L.push(linea(x))); }
    if (r.semana.length) { L.push(' Esta semana:'); r.semana.forEach(x => L.push(linea(x))); }
    if (r.adelante.length) { L.push(' Más adelante:'); r.adelante.forEach(x => L.push(linea(x))); }
    if (r.sinFecha.length) { L.push(' Sin fecha:'); r.sinFecha.forEach(x => L.push(linea(x))); }
    if (!r.abiertas.length) L.push('  (no hay nada abierto)');

    return L.join('\n');
  }

  const INSTRUCCIONES = [
    'Sos el asistente de Christian Pérez, Coordinador de RRHH del Área 3 de Farmatodo Argentina.',
    'Trabajás sobre su panel: sucursales, dotación en FTE, visitas con check list, reclamos, bajas y su agenda.',
    '',
    'Cómo contestar:',
    '- En castellano rioplatense, de vos. Sin jerga de RRHH que un gerente de tienda no usaría.',
    '- Breve y concreto. Si alcanza con dos renglones, dos renglones.',
    '- Los números salen del panel, que te va abajo. Si algo no está ahí, decí que no lo tenés en vez de inventarlo.',
    '- Números en formato argentino: coma decimal.',
    '- El marco normativo es el CCT 414/05 (ADEF), farmacias de CABA y conurbano.',
    '',
    'Qué tener presente:',
    '- La dotación se cuenta en FTE: jornada completa 1, tiempo parcial 0,5.',
    '- Quien tiene bloqueo de título o figura como no presencial no cubre turno: nunca lo cuentes en la dotación de piso.',
    '- Los flotantes del área no son de ninguna tienda: suman al área.',
    '- En una cesión, del 1 al 15 el costo del mes lo absorbe la tienda de destino; del 16 en adelante, la de origen.',
    '',
    'Tenés herramientas para escribirle en la agenda —anotar y marcar hecho— y para',
    'mirar su calendario de Google. Las de la agenda, solo cuando te lo pida, y después',
    'decile en una línea qué anotaste. La del calendario, cada vez que la pregunta tenga',
    'que ver con el día o con el tiempo que le queda libre.'
  ].join('\n');

  /* ------------------ lo que el asistente puede hacer ------------------- */

  function herramientas(alCambiar) {
    return [
      {
        name: 'anotar_en_agenda',
        description: 'Anota algo en la agenda del coordinador. El texto se escribe como se diría ' +
                     'en voz alta y el panel le saca la fecha: "llamar a Ana de Botánico el jueves".',
        inputSchema: {
          type: 'object',
          properties: { texto: { type: 'string', description: 'Qué anotar, con la fecha adentro si la tiene.' } },
          required: ['texto']
        },
        execute: ({ texto }) => {
          const i = Store.anotarTexto(String(texto || '').trim());
          if (alCambiar) alCambiar();
          return { anotado: i.titulo, fechas: (i.hitos || []).map(h => h.fecha) };
        }
      },
      {
        name: 'ver_agenda_del_dia',
        description: 'Trae las reuniones del calendario de Google de un día. Usala cuando la ' +
                     'pregunta tenga que ver con el día, con reuniones o con cuánto tiempo hay.',
        inputSchema: {
          type: 'object',
          properties: { fecha: { type: 'string', description: 'El día en formato AAAA-MM-DD. Si falta, hoy.' } }
        },
        execute: async ({ fecha }) => {
          const { eventos } = await eventosDelDia(fecha || _hoy());
          if (!eventos.length) return { dia: fecha || _hoy(), eventos: [] };
          return {
            dia: fecha || _hoy(),
            eventos: eventos.map(x => ({ hora: horaDe(x), titulo: x.titulo }))
          };
        }
      },
      {
        name: 'marcar_hecho',
        description: 'Marca como hecho un ítem de la agenda. El id figura entre corchetes en la lista.',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string', description: 'El id del ítem, tal cual aparece entre corchetes.' } },
          required: ['id']
        },
        execute: ({ id }) => {
          const i = Store.item(String(id || '').trim());
          if (!i) throw new Error('No encontré ese ítem en la agenda.');
          Store.marcarHecho(i.id);
          if (alCambiar) alCambiar();
          return { hecho: i.titulo };
        }
      }
    ];
  }

  /**
   * Una pregunta. El contexto viaja pegado al último turno y no queda en el
   * historial: si se guardara, cada pregunta arrastraría la foto del tablero de
   * cuando se hizo, y a la tercera ya estaría contestando con datos viejos.
   *
   * @param {string} texto lo que escribió el coordinador
   * @param {object} opciones { onText, signal, alCambiar }
   * @returns {Promise<string>} la respuesta completa
   */
  async function preguntar(texto, opciones) {
    const o = opciones || {};
    if (!sample) throw new Error('El asistente no está disponible en esta versión del panel.');

    const pregunta = String(texto || '').trim();
    if (!pregunta) throw new Error('Escribí la pregunta.');

    const conDatos = turnos.length
      ? pregunta
      : INSTRUCCIONES + '\n\n' + pregunta;

    const envio = turnos.concat([{
      role: 'user',
      content: conDatos + '\n\n--- ESTADO DEL PANEL ---\n' + contexto()
    }]);

    const res = await sample(envio, {
      onText: o.onText,
      signal: o.signal,
      tools: herramientas(o.alCambiar),
      modelTier: 'default'
    });

    /* Al historial va la pregunta pelada: el estado se vuelve a mandar en la
       siguiente, ya actualizado. */
    turnos.push({ role: 'user', content: conDatos });
    turnos.push({ role: 'assistant', content: res.text });
    if (turnos.length > 20) turnos = turnos.slice(-20);
    return res.text;
  }

  /* Preguntas de arranque: la pantalla en blanco es el peor comienzo, y estas
     son las que el coordinador hace de verdad un lunes a la mañana. */
  const SUGERENCIAS = [
    '¿Qué tengo que mirar hoy?',
    '¿Qué sucursales hace más tiempo que no visito?',
    'Resumime los reclamos abiertos',
    'Armame el mail para el Gerente de Operaciones con el estado del área'
  ];

  return {
    iniciar, disponible, preguntar, contexto, historial, limpiar, SUGERENCIAS,
    iniciarConectores, estadoCalendario, eventosDelDia, horaDe, explicarError
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = { Asistente };
