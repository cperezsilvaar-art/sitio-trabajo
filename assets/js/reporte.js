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

    /* 1. Recorrida */
    const rec = evaluarRecorrida(visita.recorrida);
    if (rec.hechos || rec.sinHacer.length) {
      L.push(++n + '. RECORRIDA DE LA SUCURSAL');
      L.push(`- Puntos cubiertos: ${rec.hechos} de ${rec.aplican} que aplicaban (${fmtPct(rec.pct, 0)}).`);
      rec.bloques.forEach(b => {
        const conNota = b.items.filter(i => (visita.recorrida.notas || {})[i.id]);
        if (!b.hechos && !conNota.length) return;
        L.push(`  * ${b.nombre}: ${b.hechos}/${b.aplican}`);
        conNota.forEach(i => L.push(`    - ${i.texto}: ${visita.recorrida.notas[i.id]}`));
      });
      if (rec.sinHacer.length) {
        L.push('- Puntos que no se pudieron cubrir en esta visita:');
        rec.sinHacer.forEach(i => L.push(`  * ${i.texto}`));
      }
      if (rec.clavesPendientes.length) {
        L.push(`- Quedaron ${rec.clavesPendientes.length} punto/s clave sin cubrir.`);
      }
      L.push('');
    }

    /* 2. Reclamos */
    if (typeof Store !== 'undefined' && typeof resumirReclamos === 'function') {
      const abiertos = Store.reclamosDe(sucursal.id, true);
      const nuevos = Store.reclamosDe(sucursal.id).filter(x => x.origenVisitaId === visita.id);
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
        const previos = abiertos.filter(x => x.origenVisitaId !== visita.id);
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
    const rec = evaluarRecorrida(visita.recorrida);
    if (rec.clavesPendientes.length) {
      f.push(`Puntos clave de la recorrida sin cubrir: ${rec.clavesPendientes.map(x => x.texto).join('; ')}.`);
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
  async function despachar({ sucursal, config, asunto, cuerpo, payloadExtra, opciones }) {
    opciones = opciones || {};
    const dest = destinatario(sucursal, config);
    const destino = dest.email;

    if (!destino) {
      throw new Error(sucursal.gerenteOperaciones
        ? `Falta el email de ${sucursal.gerenteOperaciones} en Configuración.`
        : 'Falta cargar el email del Gerente de Operaciones en Configuración.');
    }

    const cc = copias(sucursal, config);

    if (config.webhook && String(config.webhook).trim() && !opciones.forzarMailto) {
      const payload = Object.assign({
        para: destino, cc, asunto, cuerpo,
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

  return {
    calcular, datosMensuales,
    textoVisita, textoMensual,
    asuntoVisita, asuntoMensual,
    enviarVisita, enviarMensual,
    faltantesVisita, faltantesMensuales,
    tablaFteTexto, copias, destinatario
  };
})();
