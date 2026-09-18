/*
 * reporte.js — Los dos documentos que salen del panel, y su envío.
 *
 *   textoVisita()   Qué pasó el día de la visita: minutas, sanciones, talento,
 *                   diagnóstico y plan de acción. Se manda al cerrar la visita.
 *
 *   textoMensual()  Los números del mes de la sucursal: dotación y FTE, costo
 *                   laboral, ausentismo, horas extras, rotación y dotación vs.
 *                   venta. Consolida todas las visitas del período y se manda
 *                   al cerrar el mes.
 *
 * Los campos sin cargar se marcan como [PENDIENTE] en lugar de omitirse, para
 * que el Gerente de Operaciones vea qué información falta relevar.
 */

const PENDIENTE = '[PENDIENTE]';

const ETIQUETA_NOTIFICADA = {
  si: 'notificada y firmada',
  sinFirma: 'notificada sin firma',
  no: 'sin notificar'
};

const ETIQUETA_A_CARGO = {
  tienda: 'Gerente de Tienda',
  rrhh: 'RRHH',
  operaciones: 'Operaciones',
  otro: 'Otro'
};

const fmtNum = (n, d = 2) => {
  if (n === null || n === undefined || n === '' || isNaN(n)) return PENDIENTE;
  // El "+ 0" convierte el -0 que deja el redondeo en 0, para no mostrar "-0,00".
  const v = Number(Number(n).toFixed(d)) + 0;
  return v.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
};

const fmtMoneda = (n, moneda = '$') =>
  (n === null || n === undefined || n === '' || isNaN(n))
    ? PENDIENTE
    : moneda + ' ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtPct = (n, d = 2) =>
  (n === null || n === undefined || isNaN(n))
    ? PENDIENTE
    : (n * 100).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';

const oPendiente = t => (t && String(t).trim()) ? String(t).trim() : PENDIENTE;

const fmtFecha = f => {
  if (!f) return PENDIENTE;
  const [a, m, d] = String(f).split('-');
  return d ? `${d}/${m}/${a}` : f;
};

const Reporte = (() => {

  /** Reúne todos los cálculos de una visita en un solo objeto. */
  function calcular(visita, sucursal, config) {
    const par = config.parametros;
    const matriz = calcularMatriz(visita.posiciones, par);
    const ausentismo = calcularAusentismo(visita.ausentismo.detalle, matriz.total.diasTrabajados, matriz.total.diasAusentes);
    const rotacion = calcularRotacion(visita.rotacion);
    const bajas = agruparBajas(visita.movimientos);
    const sucesion = evaluarSucesion(visita.sucesion);
    const dotacion = calcularDotacionOptima({
      tipo: sucursal.tipo,
      empleados: matriz.total.heads,
      costoLaboralReal: matriz.total.costoTotal,
      venta: visita.comercial.venta,
      ventaRed: visita.comercial.ventaRed
    }, par);
    const productividad = calcularProductividad({
      tickets: visita.comercial.tickets,
      horasTrabajadas: visita.comercial.horasTrabajadas
    }, par);
    const hallazgosAuto = generarHallazgos(visita, par);
    const talento = distribucion9Box(sucursal.colaboradores);

    return { matriz, ausentismo, rotacion, bajas, sucesion, dotacion, productividad, hallazgosAuto, talento, par };
  }

  /** Tabla de FTE en texto plano, alineada en columnas. */
  function tablaFteTexto(matriz, moneda) {
    const cols = [
      ['Posición', 20], ['Mes compl.', 11], ['Días Aus.', 10], ['Hs. Extras', 11],
      ['Días Vínc.', 11], ['FTE Real', 9], ['Costo Total', 16], ['Costo / FTE', 16]
    ];
    const linea = c => c.map(([t, w]) => String(t).padEnd(w)).join(' ');
    const sep = '-'.repeat(cols.reduce((s, c) => s + c[1] + 1, 0));

    const fila = f => linea([
      [f.rol, 20],
      [f.heads || 0, 11],
      [fmtNum(f.diasAusentes, 0), 10],
      [fmtNum(f.horasExtras, 0), 11],
      [fmtNum(f.diasTrabajados, 0), 11],
      [fmtNum(f.fteReal), 9],
      [fmtMoneda(f.costoTotal || null, moneda), 16],
      [f.costoPorFte === null ? PENDIENTE : fmtMoneda(f.costoPorFte, moneda), 16]
    ]);

    return [linea(cols), sep, ...matriz.filas.map(fila), sep, fila(matriz.total)].join('\n');
  }

  /* ===================================================================== *
   * Dos documentos distintos, con públicos y ritmos distintos:            *
   *                                                                       *
   *   - El REPORTE DE VISITA cuenta qué pasó el día que se fue a la        *
   *     tienda: lo que se habló, lo que se acordó, lo que hay que hacer.   *
   *     Se manda al cerrar la visita.                                      *
   *                                                                       *
   *   - El INFORME MENSUAL son los números de la sucursal en el mes: FTE,  *
   *     costo, ausentismo, rotación, horas extras, dotación vs. venta.     *
   *     Se manda al cerrar el período y consolida todas las visitas.       *
   *                                                                       *
   * Mezclarlos obligaba a leer treinta líneas de tabla para llegar a un    *
   * acuerdo con el gerente, y a esperar la visita para tener el número.    *
   * ===================================================================== */

  /* ------------------------------ encabezados --------------------------- */

  function encabezado(titulo, sucursal, config, lineas) {
    const barra = '='.repeat(60);
    const L = [barra, titulo];
    // Si el área ya se llama "Área 3", no repetir la palabra en la etiqueta
    if (config.area) L.push('Área: ' + String(config.area).replace(/^\s*[áa]rea\s+/i, ''));
    L.push('Sucursal: ' + Store.etiquetaSucursal(sucursal) +
           (sucursal.marca ? ` · ${sucursal.marca}` : '') +
           (sucursal.localidad ? ` · ${sucursal.localidad}` : ''));
    if (sucursal.gerenteOperaciones) L.push('Gerente de Operaciones: ' + sucursal.gerenteOperaciones);
    lineas.forEach(x => L.push(x));
    L.push('Gerente de Tienda: ' + oPendiente(sucursal.gerente));
    L.push(barra);
    L.push('');
    return L;
  }

  const pie = () => {
    const barra = '='.repeat(60);
    return [barra, 'Generado desde el Panel de Control de RRHH.', barra];
  };

  /* =============== DOCUMENTO 1: REPORTE DE LA VISITA ==================== */

  /**
   * Lo que pasó en la tienda ese día. Sin tablas de costos: el gerente y el
   * Gerente de Operaciones tienen que poder leerlo entero y quedarse con los
   * compromisos.
   */
  function textoVisita(visita, sucursal, config) {
    const c = calcular(visita, sucursal, config);
    const L = encabezado('REPORTE DE VISITA A SUCURSAL - FARMATODO', sucursal, config, [
      'Fecha de Visita: ' + fmtFecha(visita.fecha),
      'Período de referencia: ' + oPendiente(visita.periodo),
      'Coordinador de RRHH: ' + oPendiente(visita.coordinador || config.coordinador)
    ]);

    let n = 0;

    /* 1. Check list corporativo. Va primero porque es el instrumento formal:
       lo que se manda y lo que se compara entre tiendas. */
    const cl = visita.checklist || { checks: {} };
    const chk = evaluarChecklist(cl.checks);
    if (chk.total.aplicables || chk.total.noAplica) {
      L.push(++n + '. CHECK LIST DE RRHH OPERACIONES');
      L.push(`- Cumplimiento: ${fmtPct(chk.total.pct, 1)} — ${chk.total.aprobados} aprobados ` +
             `de ${chk.total.aplicables} aplicables.`);
      if (chk.total.noAplica) L.push(`  ${chk.total.noAplica} punto/s marcados "no aplica", fuera del cálculo.`);
      if (chk.total.sinEvaluar) L.push(`  ${chk.total.sinEvaluar} de ${chk.total.total} puntos quedaron sin evaluar.`);
      if (cl.supervisor) {
        L.push(`- Acompañó la visita: ${cl.supervisor}${cl.cargoSupervisor ? ' (' + cl.cargoSupervisor + ')' : ''}.`);
      }
      L.push('- Por categoría:');
      chk.porCategoria.forEach(c => {
        L.push(`  * ${c.nombre}: ${c.pct === null ? 'sin evaluar'
          : `${c.aprobados}/${c.aplicables} (${fmtPct(c.pct, 0)})`}`);
      });
      if (chk.subMasAfectada) {
        L.push(`- Lo más flojo: ${chk.subMasAfectada.nombre} (${fmtPct(chk.subMasAfectada.pct, 0)}).`);
      }
      if (chk.noAprobados.length) {
        L.push('- Puntos no aprobados:');
        chk.noAprobados.forEach(p => {
          const obs = (cl.obs || {})[p.id];
          L.push(`  * [${p.n}] ${p.titulo}${obs ? ' — ' + obs : ''}`);
        });
      }
      if (String(cl.relevantes || '').trim()) {
        L.push('- Puntos relevantes de la visita:');
        String(cl.relevantes).split('\n').filter(x => x.trim()).forEach(x => L.push('  * ' + x.trim()));
      }
      if (String(cl.compromisos || '').trim()) {
        L.push('- Compromisos que asume el supervisor:');
        String(cl.compromisos).split('\n').filter(x => x.trim()).forEach(x => L.push('  * ' + x.trim()));
      }
      L.push('');
    }

    /* 2. Reclamos */
    if (typeof Store !== 'undefined' && typeof resumirReclamos === 'function') {
      const abiertos = Store.reclamosDe(sucursal.id, true);
      /* «Planteado en esta visita» se decide por la fecha, no por desde qué
         pantalla se cargó: los reclamos ya no se dan de alta adentro de la
         visita. `origenVisitaId` sigue valiendo para los que se guardaron
         cuando sí se hacía. */
      const deLaVisita = x => x.origenVisitaId === visita.id ||
                              (!x.origenVisitaId && x.fecha && x.fecha === visita.fecha);
      const nuevos = Store.reclamosDe(sucursal.id).filter(deLaVisita);
      if (abiertos.length || nuevos.length) {
        L.push(++n + '. RECLAMOS DE LOS COLABORADORES');
        if (nuevos.length) {
          L.push(`- Planteados en esta visita: ${nuevos.length}`);
          nuevos.forEach(x => {
            L.push(`  * ${oPendiente(x.colaborador)} — ${(TIPOS_RECLAMO_POR_ID[x.tipo] || {}).nombre || x.tipo}` +
                   `${x.periodoAfectado ? ` · período ${x.periodoAfectado}` : ''}` +
                   `${num(x.monto) ? ` · ${fmtMoneda(num(x.monto), (config.parametros || {}).moneda)}` : ''}`);
            if (String(x.detalle || '').trim()) L.push(`    ${String(x.detalle).trim()}`);
          });
        }
        const previos = abiertos.filter(x => !deLaVisita(x));
        if (previos.length) {
          L.push(`- Abiertos de visitas anteriores: ${previos.length}`);
          previos.forEach(x => {
            const d = diasDeReclamo(x);
            L.push(`  * ${oPendiente(x.colaborador)} — ${(TIPOS_RECLAMO_POR_ID[x.tipo] || {}).nombre || x.tipo}` +
                   ` · ${(ESTADOS_RECLAMO_POR_ID[x.estado] || {}).nombre || x.estado}` +
                   `${d === null ? '' : ` · hace ${d} día${d === 1 ? '' : 's'}`}`);
          });
          const criticos = previos.filter(x => semaforoReclamo(x).clave === 'critico');
          if (criticos.length) {
            L.push(`  * ${criticos.length} lleva${criticos.length === 1 ? '' : 'n'} más de 15 días sin cerrarse.`);
          }
        }
        L.push('');
      }
    }

    /* 3. Minutas */
    L.push(++n + '. MINUTA DE REUNIONES');
    L.push('- Reunión Gerente de Tienda:');
    L.push('  * Participante: ' + oPendiente(visita.minutaGerente.participante || sucursal.gerente));
    L.push('  * Puntos Tratados:');
    L.push(bloque(visita.minutaGerente.puntos, '      '));
    L.push('  * Acuerdos y Compromisos:');
    L.push(bloque(visita.minutaGerente.acuerdos, '      '));
    L.push('- Reunión Colaborador:');
    L.push('  * Colaborador (Nombre y Posición): ' +
      oPendiente([visita.minutaColaborador.nombre, visita.minutaColaborador.posicion].filter(Boolean).join(' — ')));
    L.push('  * Feedback y Temas de Clima Laboral:');
    L.push(bloque(visita.minutaColaborador.feedback, '      '));
    L.push('');

    /* 2. Sanciones */
    if (visita.sanciones.length) {
      L.push(++n + '. SANCIONES DISCIPLINARIAS REGISTRADAS');
      seccionSanciones(visita, L);
      L.push('');
    }

    /* 3. Talento */
    if (c.talento.evaluados.length) {
      L.push(++n + '. DESEMPEÑO Y POTENCIAL DEL PLANTEL');
      seccionTalento(c, L);
      L.push('');
    }

    /* 4. Sucesión */
    if (visita.sucesion.length) {
      L.push(++n + '. SUCESIÓN Y TALENTO CRÍTICO');
      seccionSucesion(visita, c, L);
      L.push('');
    }

    /* 5. Diagnóstico */
    L.push(++n + '. DIAGNÓSTICO Y ACCIONES RECOMENDADAS');
    L.push('- Hallazgos sobre ausentismo y desviación de horas extras:');
    const hallazgos = String(visita.diagnostico.hallazgos || '').trim();
    if (hallazgos) {
      L.push(bloque(hallazgos, '      '));
    } else if (c.hallazgosAuto.length) {
      c.hallazgosAuto.forEach(h => L.push('      · ' + h));
    } else {
      L.push('      ' + PENDIENTE);
    }
    L.push('- Evaluación del impacto en el costo laboral de la tienda:');
    L.push(bloque(visita.diagnostico.impacto, '      '));
    L.push('');

    /* 6. Plan de acción */
    L.push(++n + '. PLAN DE ACCIÓN');
    seccionPlan(visita, L);
    L.push('');

    L.push('El detalle de dotación, costo laboral, ausentismo y rotación del período');
    L.push('va en la estadística mensual de la sucursal, que se manda por separado.');
    L.push('');

    const faltantes = faltantesVisita(visita, sucursal, c);
    if (faltantes.length) {
      L.push('DATOS PENDIENTES DE CARGA');
      faltantes.forEach(f => L.push('  - ' + f));
      L.push('');
    }

    return L.concat(pie()).join('\n');
  }

  /* ============== DOCUMENTO 2: INFORME MENSUAL DE LA SUCURSAL =========== */

  /**
   * Reúne el mes de una sucursal. Los números salen de la visita del período
   * que tenga la matriz cargada; si hubo más de una, de la última.
   *
   * Si el mes todavía no tiene visita, la estadística se arma igual y marca todo
   * como pendiente, que deja a la vista qué falta relevar.
   */
  function datosMensuales(sucursalId, periodo, config) {
    const e = Store.get();
    const sucursal = Store.sucursal(sucursalId);
    const visitas = e.visitas
      .filter(v => v.sucursalId === sucursalId && v.periodo === periodo)
      .sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')));

    const conMatriz = visitas.filter(v =>
      calcularMatriz(v.posiciones, config.parametros).total.heads > 0);
    const base = conMatriz.length ? conMatriz[conMatriz.length - 1]
               : (visitas.length ? visitas[visitas.length - 1] : visitaEnBlanco(sucursalId, periodo));

    const sanciones = [];
    visitas.forEach(v => (v.sanciones || []).forEach(x => sanciones.push({ sancion: x, visita: v })));

    return {
      sucursal, periodo, visitas, base, sanciones,
      sinVisita: !visitas.length,
      calculo: calcular(base, sucursal, config)
    };
  }

  /** Visita vacía, solo para poder calcular un mes que todavía no tuvo una. */
  function visitaEnBlanco(sucursalId, periodo) {
    return {
      id: null, sucursalId, fecha: '', periodo, coordinador: '',
      minutaGerente: { participante: '', puntos: '', acuerdos: '' },
      minutaColaborador: { nombre: '', posicion: '', feedback: '' },
      posiciones: POSICIONES.map(p => ({
        rol: p.nombre, heads: '', diasAltas: '', diasBajas: '', diasAusentes: '',
        horasExtras: '', sueldoBruto: '', costoHE: '', bonos: '', cargasManual: ''
      })),
      ausentismo: { detalle: {} },
      rotacion: { dotacionAnterior: '', altasExternas: '', altasInternas: '', bajasExternas: '', bajasInternas: '' },
      movimientos: [], sanciones: [], sucesion: [],
      comercial: { venta: '', ventaRed: '', tickets: '', horasTrabajadas: '' },
      diagnostico: { hallazgos: '', impacto: '', plan: [] },
      envio: { enviado: false, fecha: null, destinatario: null, via: null, historial: [] }
    };
  }

  /** La estadística con los números del mes. */
  function textoMensual(sucursalId, periodo, config) {
    const d = datosMensuales(sucursalId, periodo, config);
    const c = d.calculo;
    const v = d.base;
    const moneda = c.par.moneda || '$';

    const L = encabezado('ESTADÍSTICA MENSUAL DE SUCURSAL - FARMATODO', d.sucursal, config, [
      'Período: ' + oPendiente(periodo),
      'Coordinador de RRHH: ' + oPendiente(config.coordinador),
      'Visitas del período: ' + (d.visitas.length
        ? d.visitas.map(x => fmtFecha(x.fecha)).join(' · ')
        : 'ninguna registrada')
    ]);

    if (d.sinVisita) {
      L.push('AVISO: el período todavía no tiene una visita cargada. Los indicadores');
      L.push('figuran como pendientes hasta que se releve la sucursal.');
      L.push('');
    } else if (d.visitas.length > 1) {
      L.push(`El mes tuvo ${d.visitas.length} visitas. Los indicadores toman la matriz cargada`);
      L.push(`en la del ${fmtFecha(v.fecha)}, que es la más completa del período.`);
      L.push('');
    }

    /* Lo primero que se lee. Un Gerente de Operaciones no decide sobre una
       tabla de FTE: decide sobre cobertura, costo y qué hacer este mes. Las
       tablas siguen abajo para el que quiera el detalle. */
    L.push('LO QUE HAY QUE MIRAR DE ESTE MES');
    resumenOperaciones(d, config).forEach(x => L.push('  ' + x));
    L.push('');

    let n = 0;

    /* 1. Dotación y FTE */
    L.push(++n + '. DOTACIÓN Y FTE REAL');
    L.push('   "Mes compl." son las personas que cubrieron los ' + c.par.diasMes + ' días. Quien ingresó o egresó');
    L.push('   durante el mes no figura ahí: sus días efectivos están sumados en "Días Vínc.".');
    L.push(tablaFteTexto(c.matriz, moneda));
    L.push('');
    L.push(`   FTE Real total: ${fmtNum(c.matriz.total.fteReal)} sobre una dotación equivalente de ` +
           `${fmtNum(c.matriz.total.fteVinculo)} personas (${c.matriz.total.heads} de mes completo más los días de ingresos y egresos).`);
    L.push(`   Brecha de cobertura: ${fmtNum(c.matriz.total.brechaFte)} FTE por ausencias, neto de horas extras.`);
    L.push('');
    L.push('   Cómo se lee:');
    lecturaFte(c, c.par).forEach(x => L.push('   · ' + x));
    L.push('');

    /* 2. Costo laboral */
    L.push(++n + '. COSTO LABORAL');
    L.push(`- Costo laboral total del período: ${fmtMoneda(c.matriz.total.costoTotal || null, moneda)}`);
    L.push(`- Costo promedio por FTE: ${c.matriz.total.costoPorFte === null ? PENDIENTE : fmtMoneda(c.matriz.total.costoPorFte, moneda)}`);
    L.push(`- Cargas sociales aplicadas con factor ${fmtNum(c.par.factorCargas)} sobre los brutos.`);
    L.push('');

    /* 3. Ausentismo */
    L.push(++n + '. AUSENTISMO');
    seccionAusentismo(c, L);
    L.push('');

    /* 4. Horas extras */
    L.push(++n + '. HORAS EXTRAS');
    L.push(`- ${fmtNum(c.matriz.total.horasExtras, 0)} hs en el período, equivalentes a ` +
           `${fmtNum(c.matriz.total.horasExtras / c.par.horasMes)} FTE ` +
           `(${fmtPct(c.matriz.total.ratioExtras)} de las horas teóricas).`);
    if (c.matriz.total.ratioExtras !== null && c.matriz.total.ratioExtras > c.par.umbralHorasExtras) {
      L.push(`- Por encima del umbral del ${fmtPct(c.par.umbralHorasExtras, 0)}: conviene revisar si` +
             ' cubren ausencias, francos o una dotación corta.');
    }
    L.push('');

    /* 5. Rotación */
    L.push(++n + '. ROTACIÓN Y BAJAS');
    L.push(`- Rotación del mes: ${fmtPct(c.rotacion.mensual)} · Proyección anual: ${fmtPct(c.rotacion.proyeccionAnual, 1)}`);
    L.push(`- Dotación anterior ${c.rotacion.anterior} → nueva dotación ${c.rotacion.nueva} ` +
           `(altas ${c.rotacion.altasExt + c.rotacion.altasInt} / bajas ${c.rotacion.bajas})`);
    if (c.bajas.total) {
      L.push('- Bajas por categoría: ' + c.bajas.grupos.map(g => `${g.nombre} ${g.casos}`).join(' · '));
      (v.movimientos || []).filter(m => m.tipo === 'baja').forEach(m => {
        L.push(`  * ${oPendiente(m.nombre)} (${oPendiente(m.puesto)}) — ${oPendiente(m.motivo)}` +
               `${m.fecha ? ` · ${fmtFecha(m.fecha)}` : ''}`);
      });
    }
    L.push('');

    /* 6. Dotación vs. venta */
    L.push(++n + '. DOTACIÓN vs. VENTA');
    seccionDotacion(c, v, moneda, L);
    L.push('');

    /* 7. Disciplina del período */
    L.push(++n + '. DISCIPLINA DEL PERÍODO');
    if (!d.sanciones.length) {
      L.push('- Sin sanciones registradas en el período.');
    } else {
      L.push(`- Sanciones aplicadas: ${d.sanciones.length}`);
      const porTipo = {};
      d.sanciones.forEach(x => {
        const t = x.sancion.tipo || 'Sin tipificar';
        porTipo[t] = (porTipo[t] || 0) + 1;
      });
      L.push('  * Por tipo: ' + Object.keys(porTipo).map(t => `${t} ${porTipo[t]}`).join(' · '));
      const sinNotificar = d.sanciones.filter(x => !x.sancion.notificada || x.sancion.notificada === 'no').length;
      if (sinNotificar) L.push(`  * ${sinNotificar} sin constancia de notificación.`);
      L.push('  El detalle de cada sanción está en el reporte de la visita en que se registró.');
    }
    L.push('');

    /* 8. Lectura del mes */
    L.push(++n + '. LECTURA DEL MES');
    if (c.hallazgosAuto.length) {
      c.hallazgosAuto.forEach(h => L.push('- ' + h));
    } else {
      L.push('- Sin desvíos automáticos detectados sobre los umbrales configurados.');
    }
    L.push('');

    const faltantes = faltantesMensuales(d);
    if (faltantes.length) {
      L.push('DATOS PENDIENTES DE CARGA');
      faltantes.forEach(f => L.push('  - ' + f));
      L.push('');
    }

    return L.concat(pie()).join('\n');
  }

  /**
   * El resumen de arriba de todo, en el idioma de la operación.
   *
   * No repite los números: dice qué significan y qué decisión habilitan. Si una
   * línea no tiene una acción atrás, no va.
   */
  function resumenOperaciones(d, config) {
    const c = d.calculo;
    const t = c.matriz.total;
    const p = c.par;
    const moneda = p.moneda || '$';
    const L = [];

    if (!t.diasTrabajados) {
      return ['- Todavía no hay dotación cargada para el período: no se puede leer nada.'];
    }

    /* 1. Cobertura */
    const brecha = t.brechaFte;
    L.push(`- COBERTURA. La tienda tiene ${t.heads} personas de mes completo y funcionó con ` +
           `${fmtNum(t.fteReal, 1)} puestos reales.` +
           (brecha <= -0.3
             ? ` Trabajó con ${fmtNum(Math.abs(brecha), 1)} puestos menos de los asignados.`
             : brecha >= 0.3
               ? ` Cubrió ${fmtNum(brecha, 1)} puestos de más con horas extras, que sale más caro que la dotación.`
               : ' La cobertura real fue la prevista.'));

    /* 2. Costo sobre la venta: el número que mira la dirección */
    if (c.dotacion.pctCostoVenta !== null && c.dotacion.tipo !== 'staff') {
      const b = c.dotacion.banda;
      L.push(`- COSTO. El costo laboral fue el ${fmtPct(c.dotacion.pctCostoVenta)} de la venta ` +
             `(objetivo ${fmtPct(c.dotacion.benchmark, 0)}, techo ${fmtPct(c.dotacion.alerta, 0)}): ${b.texto.toLowerCase()}.` +
             (c.dotacion.diferencia !== null && c.dotacion.diferencia !== 0
               ? ` Según la venta del mes, la dotación óptima serían ${c.dotacion.dotacionOptima} personas ` +
                 `(${c.dotacion.diferencia > 0 ? '+' : ''}${c.dotacion.diferencia} respecto de las actuales).`
               : ''));
    } else {
      L.push('- COSTO. Falta la venta neta del período: sin ese dato no se puede medir el costo laboral.');
    }

    /* 3. Ausentismo, separando lo que se puede bajar */
    if (c.ausentismo.pctTotal !== null) {
      const evit = c.ausentismo.diasGestionables;
      L.push(`- AUSENTISMO. ${fmtPct(c.ausentismo.pctTotal)} del tiempo de vínculo ` +
             `(${c.ausentismo.totalDias} días).` +
             (evit
               ? ` De esos, ${evit} días eran evitables: es la parte sobre la que la tienda puede trabajar.`
               : ' Ninguno de esos días era evitable: son licencias y enfermedad comprobada, se planifican.'));
    }

    /* 4. Horas extras, con la lectura de para qué se hicieron */
    if (t.horasExtras) {
      L.push(`- HORAS EXTRAS. ${fmtNum(t.horasExtras, 0)} horas, ` +
             `${fmtPct(t.ratioExtras)} de las teóricas, equivalentes a ${fmtNum(t.horasExtras / p.horasMes, 1)} puestos.` +
             (t.ratioExtras !== null && t.ratioExtras > p.umbralHorasExtras
               ? ' Por encima del umbral: conviene ver si cubren ausencias o una dotación corta.'
               : ''));
    }

    /* 5. Rotación, solo si hubo movimiento */
    if (c.rotacion.bajas) {
      L.push(`- ROTACIÓN. ${c.rotacion.bajas} baja${c.rotacion.bajas === 1 ? '' : 's'} en el mes, ` +
             `${fmtPct(c.rotacion.proyeccionAnual, 1)} anualizado.` +
             (c.bajas.total ? ' ' + c.bajas.grupos.filter(g => g.casos).map(g => `${g.nombre} ${g.casos}`).join(' · ') + '.' : ''));
    }

    /* 6. Lo que hay que decidir */
    const decisiones = [];
    if (brecha <= -0.5) decisiones.push('cubrir la brecha de dotación');
    if (t.ratioExtras !== null && t.ratioExtras > p.umbralHorasExtras) decisiones.push('bajar las horas extras');
    if (c.ausentismo.pctTotal !== null && c.ausentismo.pctTotal > p.umbralAusentismo) decisiones.push('trabajar el ausentismo evitable');
    if (c.dotacion.pctCostoVenta !== null && c.dotacion.pctCostoVenta >= p.alertaCostoVenta) decisiones.push('revisar la estructura contra la venta');
    if (decisiones.length) {
      L.push('- A DECIDIR: ' + decisiones.join(', ') + '.');
    }

    return L;
  }

  /* --------------------------- secciones sueltas ------------------------ */

  function seccionSanciones(visita, L) {
    visita.sanciones.forEach(sc => {
      const dias = num(sc.dias) ? `, ${num(sc.dias)} día${num(sc.dias) === 1 ? '' : 's'}` : '';
      L.push(`- ${oPendiente(sc.nombre)} (${oPendiente(sc.puesto)}) — ${oPendiente(sc.tipo)}${dias}`);
      L.push(`  * Motivo: ${oPendiente(sc.motivo)}${sc.fecha ? ` · Fecha: ${fmtFecha(sc.fecha)}` : ''}`);
      L.push(`  * Aplicada por: ${oPendiente(sc.aplicadaPor)} · Notificación: ${ETIQUETA_NOTIFICADA[sc.notificada] || PENDIENTE}`);
      if (String(sc.observaciones || '').trim()) L.push(`    Detalle: ${String(sc.observaciones).trim()}`);
    });
    const sinNotificar = visita.sanciones.filter(sc => !sc.notificada || sc.notificada === 'no').length;
    if (sinNotificar) L.push(`- ${sinNotificar} sanción/es sin constancia de notificación.`);
  }

  function seccionTalento(c, L) {
    const t9 = c.talento;
    L.push(`- Evaluados junto con el Gerente de Tienda: ${t9.evaluados.length} de ${t9.activos.length} colaboradores.`);
    if (t9.sinEvaluar.length) {
      L.push(`- Sin evaluar: ${t9.sinEvaluar.map(x => oPendiente(x.nombre)).join(', ')}.`);
    }
    L.push('- Ubicación en la matriz 9-box:');
    [['3', 'Potencial alto'], ['2', 'Puede crecer'], ['1', 'En su nivel']].forEach(([pot, etiqueta]) => {
      const fila = ['3', '2', '1'].map(des => {
        const gente = t9.celdas[pot + des] || [];
        if (!gente.length) return null;
        const q = NINE_BOX[pot + des];
        return `${q.nombre}: ${gente.map(x => oPendiente(x.nombre)).join(', ')}`;
      }).filter(Boolean);
      if (fila.length) L.push(`  * ${etiqueta} — ${fila.join(' · ')}`);
    });
    if (t9.listosParaCrecer.length) {
      L.push(`- Listos para asumir más: ${t9.listosParaCrecer.map(x => `${oPendiente(x.nombre)} (${oPendiente(x.posicion)})`).join(', ')}.`);
    }
    if (t9.enRiesgo.length) {
      L.push(`- Con plan de mejora pendiente: ${t9.enRiesgo.map(x => oPendiente(x.nombre)).join(', ')}.`);
    }
    if (t9.riesgoDeSalida.length) {
      L.push(`- Riesgo de salida alto: ${t9.riesgoDeSalida.map(x => `${oPendiente(x.nombre)} (${oPendiente(x.posicion)})`).join(', ')}.`);
    }
    if (t9.estudiando.length) {
      L.push(`- Con formación en curso: ${t9.estudiando.length} colaborador${t9.estudiando.length === 1 ? '' : 'es'}.`);
      t9.estudiando.forEach(x => {
        const nivel = (NIVELES_ESTUDIO.find(nn => nn.id === x.estudia) || {}).nombre || '';
        L.push(`  * ${oPendiente(x.nombre)}: ${nivel}${x.carrera ? ' — ' + x.carrera : ''}` +
               `${x.interesDesarrollo ? ` · quiere desarrollarse en: ${x.interesDesarrollo}` : ''}`);
      });
    }
  }

  function seccionSucesion(visita, c, L) {
    L.push(`- Posiciones críticas identificadas: ${c.sucesion.posicionesCriticas} · con plan de sucesión: ${c.sucesion.criticasConPlan}`);
    L.push(`- Candidatos listos en menos de 1 año: ${c.sucesion.candidatosListos}`);
    c.sucesion.lista.forEach(i => {
      const cands = i.candidatos.length
        ? i.candidatos.map(x => `${x.nombre} (${(READINESS.find(r => r.id === x.readiness) || {}).nombre || '—'})`).join('; ')
        : 'sin candidatos identificados';
      L.push(`  * ${i.posicion} — titular ${oPendiente(i.incumbent)} — criticidad ${i.criticidad}/3, escasez ${i.escasez}/3 → ${cands}`);
    });
  }

  function seccionAusentismo(c, L) {
    L.push(`- Ausentismo total: ${fmtPct(c.ausentismo.pctTotal)} (${c.ausentismo.totalDias} días sobre ${c.ausentismo.diasDisponibles} de vínculo).`);
    if (c.ausentismo.sinApertura) {
      L.push('  * Sin apertura por concepto: el dato surge de la columna “Días ausentes” de la matriz de FTE.');
    } else {
      c.ausentismo.grupos.forEach(g => L.push(`  * ${g.nombre}: ${g.dias} días (${fmtPct(g.pct)})`));
      L.push(`  * Evitables, sobre los que la tienda puede trabajar: ${c.ausentismo.diasGestionables} ` +
             `días (${fmtPct(c.ausentismo.pctGestionable)}).`);
      if (c.ausentismo.diasInactivos) {
        L.push(`  * Sin goce de haberes de la empresa: ${c.ausentismo.diasInactivos} días ` +
               `(${fmtPct(c.ausentismo.pctInactivo)}); los paga un tercero o no se pagan.`);
      }
    }
    L.push(`- Impacto en el FTE: ${fmtNum(c.ausentismo.totalDias / c.par.diasMes)} FTE perdidos por ausencia.`);
  }

  function seccionDotacion(c, visita, moneda, L) {
    if (c.dotacion.tipo === 'staff') {
      L.push(`- Sucursal de estructura/soporte. Costo laboral sobre venta de la red: ${fmtPct(c.dotacion.pctCostoVenta)} ` +
             `(benchmark ${fmtPct(c.dotacion.benchmark, 0)}).`);
      L.push(`- Lectura: ${c.dotacion.semaforo.icono} ${c.dotacion.semaforo.texto}`);
      return;
    }
    L.push(`- Venta neta del período: ${fmtMoneda(num(visita.comercial.venta) || null, moneda)}`);
    L.push(`- Costo laboral / venta: ${fmtPct(c.dotacion.pctCostoVenta)} ` +
           `(objetivo ${fmtPct(c.dotacion.benchmark, 0)} · techo de alerta ${fmtPct(c.dotacion.alerta, 0)})`);
    L.push(`  ${c.dotacion.banda.icono} ${c.dotacion.banda.texto}. ${c.dotacion.banda.lectura}`);
    L.push(`- Dotación actual: ${c.matriz.total.heads} · Dotación óptima según venta: ${c.dotacion.dotacionOptima === null ? PENDIENTE : c.dotacion.dotacionOptima}` +
           (c.dotacion.dotacionMaxima === null || c.dotacion.dotacionMaxima === undefined ? '' : ` · Máxima antes del techo: ${c.dotacion.dotacionMaxima}`) +
           (c.dotacion.diferencia === null ? '' : ` · Diferencia: ${c.dotacion.diferencia > 0 ? '+' : ''}${c.dotacion.diferencia}`));
    if (c.dotacion.ahorro !== null) {
      L.push(`- ${c.dotacion.ahorro >= 0 ? 'Inversión requerida' : 'Ahorro potencial'}: ${fmtMoneda(Math.abs(c.dotacion.ahorro), moneda)}`);
    }
    L.push(`- Lectura: ${c.dotacion.semaforo.icono} ${c.dotacion.semaforo.texto}`);
    if (c.productividad) {
      L.push(`- Productividad: ${fmtNum(c.productividad.ticketsHora)} tickets/hora sobre un objetivo de ${c.productividad.objetivo} ` +
             `(cumplimiento ${fmtPct(c.productividad.cumplimiento)}).`);
    }
  }

  function seccionPlan(visita, L) {
    const plan = visita.diagnostico.plan || [];
    if (!plan.length) { L.push('   ' + PENDIENTE); return; }

    const bloques = [
      ['tienda',      'A cargo del Gerente de Tienda'],
      ['rrhh',        'A cargo de RRHH'],
      ['operaciones', 'A cargo de Operaciones'],
      ['otro',        'Otras acciones']
    ];
    bloques.forEach(([clave, titulo]) => {
      const items = plan.filter(x => (x.aCargo || 'tienda') === clave);
      if (!items.length) return;
      L.push('');
      L.push(`   ${titulo}:`);
      items.forEach((x, i) => {
        L.push(`   ${i + 1}. ${oPendiente(x.compromiso)}`);
        L.push(`      Responsable: ${oPendiente(x.responsable)} · Plazo: ${fmtFecha(x.plazo)} · ` +
               `Prioridad: ${oPendiente(x.prioridad)} · Estado: ${oPendiente(x.estado)}`);
      });
    });
    const hoy = new Date().toISOString().slice(0, 10);
    const vencidas = plan.filter(x => x.estado !== 'Cumplido' && x.plazo && x.plazo < hoy);
    if (vencidas.length) {
      L.push('');
      L.push(`   ${vencidas.length} acción/es con el plazo vencido: ` +
             vencidas.map(x => oPendiente(x.compromiso)).join(' · '));
    }
  }

  function bloque(txt, sangria) {
    const t = String(txt || '').trim();
    if (!t) return sangria + PENDIENTE;
    return t.split('\n').map(l => sangria + l.trim()).join('\n');
  }

  /* Lo que quedó sin cargar. Se separa por documento: al reporte de la visita
     le falta lo cualitativo, a la estadística mensual le faltan números. */

  function faltantesVisita(visita, sucursal, c) {
    const f = [];
    if (!sucursal.nombre) f.push('Nombre real de la sucursal (hoy figura como ' + sucursal.codigo + ').');
    if (!sucursal.gerente) f.push('Nombre del Gerente de Tienda.');
    if (!String(visita.minutaGerente.puntos || '').trim()) f.push('Puntos tratados en la reunión con el Gerente de Tienda.');
    if (!String(visita.minutaGerente.acuerdos || '').trim()) f.push('Acuerdos y compromisos de la reunión con el Gerente de Tienda.');
    if (!String(visita.minutaColaborador.nombre || '').trim()) f.push('Colaborador entrevistado.');
    const chk = evaluarChecklist((visita.checklist || {}).checks);
    if (chk.total.sinEvaluar) {
      f.push(`${chk.total.sinEvaluar} punto/s del check list sin evaluar.`);
    }
    if (typeof Store !== 'undefined') {
      const sinRespuesta = Store.reclamosDe(sucursal.id, true)
        .filter(x => !String(x.respuesta || '').trim());
      if (sinRespuesta.length) {
        f.push(`Respuesta a ${sinRespuesta.length} reclamo/s todavía sin contestar: ` +
               sinRespuesta.map(x => x.colaborador || 'sin nombre').join(', ') + '.');
      }
    }
    if (!(visita.diagnostico.plan || []).length) f.push('Plan de acción con responsables y plazos.');
    if (!(sucursal.colaboradores || []).length) f.push('Plantel de la sucursal, para poder evaluar desempeño y potencial.');
    else if (c.talento.sinEvaluar.length) {
      f.push(`Evaluación de desempeño y potencial de ${c.talento.sinEvaluar.length} colaborador/es: ` +
             c.talento.sinEvaluar.map(x => x.nombre || 'sin nombre').join(', ') + '.');
    }
    if (!sucursal.emailGerente) f.push('Email del Gerente de Tienda, para que reciba copia.');
    return f;
  }

  function faltantesMensuales(d) {
    const c = d.calculo, v = d.base, s = d.sucursal;
    const f = [];
    if (d.sinVisita) f.push('El período no tiene ninguna visita cargada: los indicadores salen en blanco.');
    if (!c.matriz.total.heads) f.push('Headcount base por posición.');
    if (!c.matriz.total.costoTotal) f.push('Costos laborales (sueldos brutos, horas extras, bonos).');
    if (!c.ausentismo.totalDias) f.push('Días de ausentismo del período.');
    if (c.ausentismo.sinApertura) f.push('Apertura del ausentismo por concepto (hoy solo está el total de la matriz de FTE).');
    if (c.ausentismo.diasDetallados && Math.abs(c.ausentismo.diasDetallados - c.matriz.total.diasAusentes) > 0.5) {
      f.push(`Revisar ausentismo: el detalle por concepto suma ${c.ausentismo.diasDetallados} días, ` +
             `pero la matriz de FTE tiene cargados ${c.matriz.total.diasAusentes}. ` +
             `El FTE Real se calcula con el dato de la matriz.`);
    }
    if (!num(v.comercial.venta) && s.tipo === 'venta') f.push('Venta neta del período (necesaria para el análisis de dotación óptima).');
    if (!num(v.rotacion.dotacionAnterior)) f.push('Dotación del mes anterior (para el cálculo de rotación).');
    return f;
  }

  /* ---------------------- Envío al Gerente de Operaciones ---------------------- */

  /**
   * Destinatario del reporte: el Gerente de Operaciones asignado a la sucursal.
   * Si la sucursal no tiene uno, o no tiene email cargado, cae en el de
   * Configuración, que sigue siendo el destinatario por defecto del área.
   */
  function destinatario(sucursal, config) {
    const lista = config.gerentesOperaciones || [];
    const propio = lista.find(g => g.nombre === sucursal.gerenteOperaciones);
    if (propio && String(propio.email || '').trim()) {
      return { nombre: propio.nombre, email: propio.email.trim() };
    }
    const gral = config.gerenteOperaciones || {};
    return {
      nombre: (propio && propio.nombre) || gral.nombre || '',
      email: String(gral.email || '').trim()
    };
  }

  /** Copias del reporte: las fijas de Configuración más el Gerente de Tienda. */
  function copias(sucursal, config) {
    const fijas = String(config.copias || '').split(',').map(x => x.trim()).filter(Boolean);
    const gerente = String(sucursal.emailGerente || '').trim();
    if (gerente && !fijas.some(x => x.toLowerCase() === gerente.toLowerCase())) fijas.push(gerente);
    return fijas;
  }

  function asuntoVisita(visita, sucursal, config) {
    const area = config && config.area ? config.area + ' · ' : '';
    return `Visita RRHH · ${area}${Store.etiquetaSucursal(sucursal)} · ${fmtFecha(visita.fecha)}`;
  }

  function asuntoMensual(sucursal, periodo, config) {
    const area = config && config.area ? config.area + ' · ' : '';
    return `Estadística mensual RRHH · ${area}${Store.etiquetaSucursal(sucursal)} · ${periodo || ''}`;
  }

  /**
   * Envío, común a los dos documentos. Dos vías:
   *  - webhook: si hay un endpoint configurado (Zapier, Make, Google Apps
   *    Script, etc.) se hace un POST y el envío es automático.
   *  - mailto:  abre el cliente de correo con todo pre-cargado; el coordinador
   *    solo confirma el envío.
   */
  async function despachar({ sucursal, config, asunto, cuerpo, payloadExtra, opciones, paraExtra }) {
    opciones = opciones || {};
    const dest = destinatario(sucursal, config);

    /* Algunos documentos van dirigidos a más de una persona, no con copia: el
       informe del check list se le manda al Gerente de Operaciones y al de la
       tienda, porque los dos tienen que hacer algo con él. */
    const para = [dest.email].concat(paraExtra || [])
      .map(x => String(x || '').trim()).filter(Boolean)
      .filter((x, i, xs) => xs.findIndex(y => y.toLowerCase() === x.toLowerCase()) === i);
    const destino = para.join(',');

    if (!destino) {
      throw new Error(sucursal.gerenteOperaciones
        ? `Falta el email de ${sucursal.gerenteOperaciones} en Configuración.`
        : 'Falta cargar el email del Gerente de Operaciones en Configuración.');
    }

    /* Quien ya está entre los destinatarios no se repite en copia. */
    const cc = copias(sucursal, config)
      .filter(x => !para.some(y => y.toLowerCase() === x.toLowerCase()));

    if (config.webhook && String(config.webhook).trim() && !opciones.forzarMailto) {
      const payload = Object.assign({
        para: destino, destinatarios: para, cc, asunto, cuerpo,
        area: config.area || '',
        sucursal: { codigo: sucursal.codigo, nombre: sucursal.nombre, tipo: sucursal.tipo }
      }, payloadExtra || {});
      // El cuerpo es JSON, pero se declara text/plain a propósito: así el
      // navegador lo trata como "simple request" y no dispara el preflight
      // OPTIONS, que Google Apps Script no sabe responder.
      const resp = await fetch(String(config.webhook).trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) throw new Error('El endpoint de envío respondió ' + resp.status + '.');
      return { via: 'webhook', destino, copias: cc, largo: cuerpo.length };
    }

    const url = 'mailto:' + encodeURIComponent(destino) +
      '?subject=' + encodeURIComponent(asunto) +
      (cc.length ? '&cc=' + encodeURIComponent(cc.join(',')) : '') +
      '&body=' + encodeURIComponent(cuerpo);
    // Algunos clientes de correo truncan URLs muy largas; si pasa, el
    // coordinador tiene el botón "Copiar" como respaldo.
    window.location.href = url;
    return { via: 'mailto', destino, copias: cc, largo: cuerpo.length };
  }

  function sellar(registro, r) {
    const sello = new Date().toISOString();
    registro.enviado = true;
    registro.fecha = sello;
    registro.destinatario = r.destino;
    registro.via = r.via;
    registro.copias = r.copias;
    if (!Array.isArray(registro.historial)) registro.historial = [];
    registro.historial.push({ fecha: sello, destinatario: r.destino, copias: r.copias, via: r.via });
    Store.save();
  }

  /* ============= INFORME DEL CHECK LIST DE RRHH OPERACIONES =============
   *
   * Documento propio, no un recorte del reporte de la visita: va dirigido al
   * Gerente de Operaciones y al de la tienda, y lo que a ellos les sirve es el
   * puntaje, qué quedó no aprobado y qué se comprometió el supervisor. La
   * lectura de talento y el plan de acción viven en el reporte de la visita.
   */
  function textoChecklist(visita, sucursal, config) {
    const cl = visita.checklist || { checks: {} };
    const r = evaluarChecklist(cl.checks);
    const barra = '='.repeat(60);

    const L = [barra, 'INFORME DEL CHECK LIST DE RRHH OPERACIONES'];
    if (config.area) L.push('Área: ' + String(config.area).replace(/^\s*[áa]rea\s+/i, ''));
    L.push('Farmacia: ' + Store.etiquetaSucursal(sucursal) +
           (sucursal.localidad ? ' · ' + sucursal.localidad : ''));
    L.push('Fecha de la visita: ' + fmtFecha(visita.fecha));
    L.push('Coordinador de RRHH: ' + oPendiente(visita.coordinador || config.coordinador));
    L.push('Gerente de Tienda: ' + oPendiente(sucursal.gerente));
    L.push('Acompañó la visita: ' + oPendiente(cl.supervisor) +
           (cl.cargoSupervisor ? ` (${cl.cargoSupervisor})` : ''));
    L.push(barra);
    L.push('');

    /* Lo que el coordinador marcó como «hay que avisarlo en la tienda» viaja
       acá. Antes iba en el reporte diario de presentismo, que se eliminó junto
       con la carga manual del día; este informe es el que efectivamente se
       lleva a la tienda, así que es donde corresponde. */
    (() => {
      if (typeof repartirAgenda !== 'function') return;
      const rep = repartirAgenda(Store.itemsParaTienda(), visita.fecha);
      const porDecir = rep.vencidas.concat(rep.urgentes,
        rep.semana.filter(x => x.estado.dias <= 3), rep.sinFecha);
      if (!porDecir.length) return;
      L.push('PARA AVISAR EN LA TIENDA');
      porDecir.forEach(x => {
        L.push(`   - ${x.estado.texto.toUpperCase()}. ${x.item.titulo}`);
        if (x.estado.proximo && x.estado.proximo.contexto) {
          L.push(`     ${x.estado.proximo.contexto}`);
        }
      });
      L.push('');
    })();

    if (!r.total.aplicables && !r.total.noAplica) {
      L.push('El check list todavía no tiene ningún punto evaluado.');
      L.push('');
      L.push(...pie());
      return L.join('\n');
    }

    L.push('RESULTADO');
    L.push(`  Cumplimiento: ${fmtPct(r.total.pct, 1)}`);
    L.push(`  Aprobados: ${r.total.aprobados} · No aprobados: ${r.total.noAprobados} · ` +
           `No aplica: ${r.total.noAplica}`);
    L.push(`  Puntos aplicables: ${r.total.aplicables} de ${r.total.total}.`);
    if (r.total.sinEvaluar) {
      L.push(`  AVISO: ${r.total.sinEvaluar} punto/s quedaron sin evaluar y no entran en el cálculo.`);
    }
    L.push('  Los puntos marcados "no aplica" se excluyen del puntaje obtenido y del total');
    L.push('  posible, para no penalizar lo que no corresponde a esta farmacia.');
    L.push('');

    L.push('CUMPLIMIENTO POR CATEGORÍA');
    r.porCategoria.forEach(c => {
      L.push(`  ${c.nombre}: ${c.pct === null ? 'sin evaluar'
        : `${c.aprobados}/${c.aplicables} (${fmtPct(c.pct, 0)})`}`);
      c.subs.forEach(sub => {
        if (!sub.aplicables) return;
        L.push(`     · ${sub.nombre}: ${sub.aprobados}/${sub.aplicables} (${fmtPct(sub.pct, 0)})`);
      });
    });
    L.push('');

    if (r.subMasAfectada) {
      L.push(`Lo más afectado: ${r.subMasAfectada.nombre} (${fmtPct(r.subMasAfectada.pct, 0)}).`);
      if (r.subMasPositiva && r.subMasPositiva.id !== r.subMasAfectada.id) {
        L.push(`Lo más firme: ${r.subMasPositiva.nombre} (${fmtPct(r.subMasPositiva.pct, 0)}).`);
      }
      L.push('');
    }

    if (r.noAprobados.length) {
      L.push('PUNTOS NO APROBADOS');
      r.noAprobados.forEach(p => {
        L.push(`  [${p.n}] ${p.titulo}  —  ${p.subNombre}`);
        const obs = (cl.obs || {})[p.id];
        if (obs) L.push(`        Observación: ${obs}`);
        const otras = (cl.consideraciones || {})[p.id];
        if (otras) L.push(`        Otras consideraciones: ${otras}`);
        L.push(`        Criterio: ${p.criterio}`);
      });
      L.push('');
    }

    /* Lo aprobado con observación también se informa: es lo que está por
       pasarse de la raya y conviene mirar antes de la próxima visita. */
    const conObs = CHECKLIST_PUNTOS.filter(p =>
      cl.checks[p.id] === 'aprobado' && String((cl.obs || {})[p.id] || '').trim());
    if (conObs.length) {
      L.push('APROBADOS CON OBSERVACIÓN');
      conObs.forEach(p => L.push(`  [${p.n}] ${p.titulo}: ${cl.obs[p.id]}`));
      L.push('');
    }

    if (r.total.noAplica) {
      const na = CHECKLIST_PUNTOS.filter(p => cl.checks[p.id] === 'noAplica');
      L.push('PUNTOS QUE NO APLICAN A ESTA FARMACIA');
      na.forEach(p => L.push(`  [${p.n}] ${p.titulo}` +
        ((cl.obs || {})[p.id] ? ` — ${cl.obs[p.id]}` : '')));
      L.push('');
    }

    if (String(cl.relevantes || '').trim()) {
      L.push('PUNTOS RELEVANTES DE LA VISITA');
      String(cl.relevantes).split('\n').filter(x => x.trim()).forEach(x => L.push('  - ' + x.trim()));
      L.push('');
    }

    if (String(cl.compromisos || '').trim()) {
      L.push('COMPROMISOS QUE ASUME EL SUPERVISOR');
      String(cl.compromisos).split('\n').filter(x => x.trim()).forEach(x => L.push('  - ' + x.trim()));
      L.push('');
    }

    if (r.sinEvaluar.length && r.sinEvaluar.length <= 12) {
      L.push('PUNTOS SIN EVALUAR');
      r.sinEvaluar.forEach(p => L.push(`  [${p.n}] ${p.titulo}`));
      L.push('');
    }

    L.push(...pie());
    return L.join('\n');
  }

  function asuntoChecklist(visita, sucursal, config) {
    const cl = visita.checklist || { checks: {} };
    const r = evaluarChecklist(cl.checks);
    const area = config && config.area ? config.area + ' · ' : '';
    const pct = r.total.pct === null ? 'sin evaluar' : fmtPct(r.total.pct, 1);
    return `Check list RRHH · ${area}${Store.etiquetaSucursal(sucursal)} · ${fmtFecha(visita.fecha)} · ${pct}`;
  }

  /**
   * Manda el informe del check list. A diferencia del reporte de la visita, el
   * Gerente de Tienda va como destinatario y no en copia: el resultado es suyo
   * tanto como del Gerente de Operaciones.
   */
  async function enviarChecklist(visita, sucursal, config, opciones) {
    const cl = visita.checklist || { checks: {} };
    const r = evaluarChecklist(cl.checks);
    const res = await despachar({
      sucursal, config, opciones,
      paraExtra: [sucursal.emailGerente],
      asunto: asuntoChecklist(visita, sucursal, config),
      cuerpo: textoChecklist(visita, sucursal, config),
      payloadExtra: {
        tipo: 'checklist',
        visita: { id: visita.id, fecha: visita.fecha, periodo: visita.periodo },
        supervisor: cl.supervisor || '',
        metricas: {
          cumplimiento: r.total.pct,
          aprobados: r.total.aprobados,
          noAprobados: r.total.noAprobados,
          noAplica: r.total.noAplica,
          sinEvaluar: r.total.sinEvaluar,
          porCategoria: r.porCategoria.map(c => ({ nombre: c.nombre, pct: c.pct }))
        }
      }
    });
    sellar(visita.envioChecklist, res);
    return res;
  }

  /** Manda el reporte de la visita y lo deja registrado en la visita. */
  async function enviarVisita(visita, sucursal, config, opciones) {
    const c = calcular(visita, sucursal, config);
    const r = await despachar({
      sucursal, config, opciones,
      asunto: asuntoVisita(visita, sucursal, config),
      cuerpo: textoVisita(visita, sucursal, config),
      payloadExtra: {
        tipo: 'visita',
        visita: { id: visita.id, fecha: visita.fecha, periodo: visita.periodo, coordinador: visita.coordinador },
        acuerdos: (visita.diagnostico.plan || []).length,
        sanciones: visita.sanciones.length,
        evaluados: c.talento.evaluados.length
      }
    });
    sellar(visita.envio, r);
    return r;
  }

  /** Manda la estadística mensual y la deja registrada en el período. */
  async function enviarMensual(sucursalId, periodo, config, opciones) {
    const d = datosMensuales(sucursalId, periodo, config);
    const c = d.calculo;
    const r = await despachar({
      sucursal: d.sucursal, config, opciones,
      asunto: asuntoMensual(d.sucursal, periodo, config),
      cuerpo: textoMensual(sucursalId, periodo, config),
      payloadExtra: {
        tipo: 'mensual',
        periodo,
        visitas: d.visitas.map(v => v.fecha),
        metricas: {
          headcount: c.matriz.total.heads,
          fteReal: redondear(c.matriz.total.fteReal, 2),
          costoLaboralTotal: redondear(c.matriz.total.costoTotal, 2),
          costoPorFte: c.matriz.total.costoPorFte === null ? null : redondear(c.matriz.total.costoPorFte, 2),
          ausentismoPct: c.ausentismo.pctTotal,
          horasExtras: c.matriz.total.horasExtras,
          rotacionMensual: c.rotacion.mensual,
          dotacionOptima: c.dotacion.dotacionOptima,
          diferenciaDotacion: c.dotacion.diferencia
        }
      }
    });
    sellar(Store.asegurarInforme(sucursalId, periodo), r);
    return r;
  }

  /* ===================== DOCUMENTO DEL DÍA =====================
   *
   * Lo que se manda a Operaciones a la mañana. No es un informe: es lo que
   * hay que decidir antes de que abran las tiendas. Cinco bloques fijos, en
   * el orden en que se leen cuando hay diez minutos.
   */
  /**
   * La venta del día, aparte del presentismo.
   *
   * Van separados porque son dos preguntas distintas y el que las recibe hace
   * cosas distintas con cada una: el presentismo se resuelve moviendo gente
   * antes de la apertura, la venta se lee para saber cuánto pesó el hueco. El
   * único cruce que sobrevive es la venta por persona presente, que es el que
   * contesta si la dotación alcanzó para el volumen que hubo.
   */
  function textoVentasDia(fecha, config) {
    const e = Store.get();
    const cfg = config || e.config;
    const dia = Store.diarioDe(fecha);
    const calc = calcularDiario(dia, e.sucursales, cfg.parametros);
    const moneda = cfg.parametros.moneda || '$';
    const barra = '='.repeat(60);
    const v = calc.venta;

    const L = [barra, 'VENTA DEL DÍA - FARMATODO'];
    if (cfg.area) L.push('Área: ' + String(cfg.area).replace(/^\s*[áa]rea\s+/i, ''));
    L.push('Día reportado: ' + fmtFecha(fecha));
    L.push(barra);
    L.push('');

    if (!v.conDato) {
      L.push('Todavía no se importó el RDV de este día.');
      L.push('');
      L.push(...pie());
      return L.join('\n');
    }

    const pct = x => x === null ? '—' : (x >= 0 ? '+' : '') + fmtPct(x, 1);
    const plata = n => moneda + ' ' + fmtNum(n, 0);

    L.push('1. EL DÍA');
    L.push(`   Venta: ${plata(v.ayer)} en ${v.conDato} sucursal${v.conDato === 1 ? '' : 'es'} con dato.`);
    if (v.metaHoy) L.push(`   Meta del día: ${plata(v.metaHoy)} · Índice: ${pct(v.indexDia)}`);
    if (v.requerido) L.push(`   Mes contra lo requerido: ${pct(v.indexMes)}`);
    if (v.transacciones) L.push(`   Transacciones: ${fmtNum(v.transacciones, 0)}`);
    if (v.presentes && v.ayerConPresentismo) {
      L.push(`   Venta por persona presente: ${plata(v.ayerConPresentismo / v.presentes)} ` +
             `(${v.presentes} personas con turno en ${v.tiendasConAmbos} tienda` +
             `${v.tiendasConAmbos === 1 ? '' : 's'}, descontando a quien está de licencia).`);
    }
    L.push('');

    L.push('2. POR SUCURSAL');
    const nom = s => (s.nombre && s.nombre.trim()) ? s.nombre.trim() : s.codigo;
    const cab = ['Sucursal', 'Venta', 'Meta', 'Índ. día', 'Índ. mes', 'Tickets', 'x presente'];
    const anchos = [22, 12, 12, 9, 9, 8, 12];
    const fila = cs => '   ' + cs.map((c, i) =>
      i === 0 ? String(c).slice(0, anchos[i]).padEnd(anchos[i])
              : String(c).padStart(anchos[i])).join(' ');
    L.push(fila(cab));
    L.push('   ' + '-'.repeat(anchos.reduce((a, b) => a + b + 1, -1)));
    calc.filasVenta.forEach(f => {
      const idxDia = f.venta.metaHoy ? f.venta.ayer / f.venta.metaHoy - 1 : null;
      L.push(fila([
        nom(f.sucursal), plata(f.venta.ayer),
        f.venta.metaHoy ? plata(f.venta.metaHoy) : '—',
        pct(idxDia), pct(f.venta.index === undefined ? null : f.venta.index),
        f.venta.transAyer ? fmtNum(f.venta.transAyer, 0) : '—',
        f.k && f.k.presentes && f.venta.ayer ? plata(f.venta.ayer / f.k.presentes) : '—'
      ]));
    });
    L.push('');
    L.push('   La venta no mueve ningún indicador de RRHH: está para leer la cobertura');
    L.push('   contra el volumen que efectivamente hubo que atender.');
    L.push('');
    L.push(...pie());
    return L.join('\n');
  }

  /* ========== DOCUMENTO: NOVEDADES PARA LA LIQUIDACIÓN ==========
     El único documento que sale de la agenda. No va a Operaciones sino a
     Nómina, y se manda una vez por mes: es la lista de lo que apareció
     durante el mes y tiene que entrar en el recibo.

     Va agrupado por sucursal porque así lo procesa Nómina —una hoja por
     tienda— y porque es como el coordinador lo revisa antes de mandarlo:
     tienda por tienda, para ver si no se olvidó de ninguna. */
  function textoNovedadesLiquidacion(periodo, config) {
    const e = Store.get();
    const cfg = config || e.config;
    const items = novedadesDeLiquidacion(e.agenda, periodo);
    const barra = '='.repeat(60);

    const L = [barra, 'NOVEDADES PARA LA LIQUIDACIÓN'];
    if (cfg.area) L.push('Área: ' + String(cfg.area).replace(/^\s*[áa]rea\s+/i, ''));
    L.push('Período: ' + nombreDePeriodo(periodo));
    if (cfg.coordinador) L.push('Informa: ' + cfg.coordinador);
    L.push(barra);
    L.push('');

    if (!items.length) {
      L.push('Sin novedades anotadas para este período.');
      L.push('');
      L.push(...pie());
      return L.join('\n');
    }

    /* Sin sucursal van juntas al final: son las del área o las que se anotaron
       sin decir de qué tienda, y esconderlas entre las demás hace que se pasen
       por alto justo cuando se está revisando tienda por tienda. */
    const porSucursal = {};
    const sueltas = [];
    items.forEach(i => {
      const s = i.sucursalId ? Store.sucursal(i.sucursalId) : null;
      if (!s) { sueltas.push(i); return; }
      const k = s.nombre || s.codigo;
      (porSucursal[k] = porSucursal[k] || []).push(i);
    });

    const linea = i => {
      const cerrada = (ESTADOS_AGENDA_POR_ID[i.estado] || {}).cerrado;
      const partes = ['   ' + (cerrada ? '[x]' : '[ ]') + ' ' + i.titulo];
      if (i.quien) partes.push('       Con: ' + i.quien);
      if (i.detalle) {
        i.detalle.split('\n').map(x => x.trim()).filter(Boolean)
          .forEach(x => partes.push('       ' + x));
      }
      return partes.join('\n');
    };

    Object.keys(porSucursal).sort().forEach(nombre => {
      L.push(nombre.toUpperCase());
      porSucursal[nombre].forEach(i => L.push(linea(i)));
      L.push('');
    });
    if (sueltas.length) {
      L.push('SIN SUCURSAL ASIGNADA');
      sueltas.forEach(i => L.push(linea(i)));
      L.push('');
    }

    L.push(`Total: ${items.length} novedad${items.length === 1 ? '' : 'es'}.`);
    L.push('');
    L.push(...pie());
    return L.join('\n');
  }

  function asuntoNovedadesLiquidacion(periodo, config) {
    const cfg = config || Store.get().config;
    const area = cfg.area ? ` ${cfg.area}` : '';
    return `Novedades de liquidación${area} - ${nombreDePeriodo(periodo)}`;
  }

  return {
    calcular, datosMensuales,
    textoVentasDia,
    textoNovedadesLiquidacion, asuntoNovedadesLiquidacion,
    textoVisita, textoMensual, textoChecklist,
    asuntoVisita, asuntoMensual, asuntoChecklist,
    enviarVisita, enviarMensual, enviarChecklist,
    faltantesVisita, faltantesMensuales,
    tablaFteTexto, copias, destinatario, resumenOperaciones, lecturaFte
  };
})();
