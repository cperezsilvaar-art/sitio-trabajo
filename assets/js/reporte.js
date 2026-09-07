/*
 * reporte.js — Armado del reporte de visita y envío al Gerente de Operaciones.
 *
 * El reporte respeta el formato acordado:
 *   1. Minuta de reuniones
 *   2. Matriz de FTE Real y Costo Laboral
 *   3. Diagnóstico y acciones recomendadas
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

  /** Reporte completo en texto plano (el que viaja en el cuerpo del email). */
  function texto(visita, sucursal, config) {
    const c = calcular(visita, sucursal, config);
    const moneda = c.par.moneda || '$';
    const L = [];
    const barra = '='.repeat(60);

    L.push(barra);
    L.push('REPORTE DE VISITA A SUCURSAL - FARMATODO');
    // Si el área ya se llama "Área 3", no repetir la palabra en la etiqueta
    if (config.area) L.push('Área: ' + String(config.area).replace(/^\s*[áa]rea\s+/i, ''));
    L.push('Sucursal: ' + Store.etiquetaSucursal(sucursal) +
           (sucursal.marca ? ` · ${sucursal.marca}` : '') +
           (sucursal.localidad ? ` · ${sucursal.localidad}` : ''));
    if (sucursal.gerenteOperaciones) L.push('Gerente de Operaciones: ' + sucursal.gerenteOperaciones);
    L.push('Fecha de Visita: ' + fmtFecha(visita.fecha));
    L.push('Período analizado: ' + oPendiente(visita.periodo));
    L.push('Coordinador de RRHH: ' + oPendiente(visita.coordinador || config.coordinador));
    L.push('Gerente de Tienda: ' + oPendiente(sucursal.gerente));
    L.push(barra);
    L.push('');

    /* 1. Minutas */
    L.push('1. MINUTA DE REUNIONES');
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

    /* 2. Matriz FTE */
    L.push('2. MATRIZ DE FTE REAL Y COSTO LABORAL');
    L.push('   "Mes compl." son las personas que cubrieron los ' + c.par.diasMes + ' días. Quien ingresó o egresó');
    L.push('   durante el mes no figura ahí: sus días efectivos están sumados en "Días Vínc.".');
    L.push(tablaFteTexto(c.matriz, moneda));
    L.push('');
    L.push(`   FTE Real total: ${fmtNum(c.matriz.total.fteReal)} sobre una dotación equivalente de ` +
           `${fmtNum(c.matriz.total.fteVinculo)} personas (${c.matriz.total.heads} de mes completo más los días de ingresos y egresos).`);
    L.push(`   Brecha de cobertura: ${fmtNum(c.matriz.total.brechaFte)} FTE por ausencias, neto de horas extras.`);
    L.push(`   Costo laboral total: ${fmtMoneda(c.matriz.total.costoTotal || null, moneda)} · ` +
           `Costo promedio por FTE: ${c.matriz.total.costoPorFte === null ? PENDIENTE : fmtMoneda(c.matriz.total.costoPorFte, moneda)}`);
    L.push(`   Cargas sociales aplicadas con factor ${fmtNum(c.par.factorCargas)} sobre los brutos.`);
    L.push('');

    /* 3. Indicadores */
    L.push('3. INDICADORES DE PERSONAL DEL PERÍODO');
    L.push(`- Ausentismo total: ${fmtPct(c.ausentismo.pctTotal)} (${c.ausentismo.totalDias} días sobre ${c.ausentismo.diasDisponibles} de vínculo).`);
    if (c.ausentismo.sinApertura) {
      L.push('  * Sin apertura por concepto: el dato surge de la columna “Días ausentes” de la matriz de FTE.');
    } else {
      c.ausentismo.grupos.forEach(g => {
        L.push(`  * ${g.nombre}: ${g.dias} días (${fmtPct(g.pct)})`);
      });
      L.push(`  * Días gestionables por la tienda: ${c.ausentismo.diasGestionables} (${fmtPct(c.ausentismo.pctGestionable)})`);
    }
    L.push(`- Horas extras: ${fmtNum(c.matriz.total.horasExtras, 0)} hs, equivalentes a ${fmtNum(c.matriz.total.horasExtras / c.par.horasMes)} FTE ` +
           `(${fmtPct(c.matriz.total.ratioExtras)} de las horas teóricas).`);
    L.push(`- Rotación del mes: ${fmtPct(c.rotacion.mensual)} · Proyección anual: ${fmtPct(c.rotacion.proyeccionAnual, 1)}`);
    L.push(`  * Dotación anterior ${c.rotacion.anterior} → nueva dotación ${c.rotacion.nueva} ` +
           `(altas ${c.rotacion.altasExt + c.rotacion.altasInt} / bajas ${c.rotacion.bajas})`);
    if (c.bajas.total) {
      L.push('  * Bajas por categoría: ' + c.bajas.grupos.map(g => `${g.nombre} ${g.casos}`).join(' · '));
    }
    L.push(`- Sanciones disciplinarias del período: ${visita.sanciones.length}`);
    visita.sanciones.forEach(sc => {
      const dias = num(sc.dias) ? `, ${num(sc.dias)} día${num(sc.dias) === 1 ? '' : 's'}` : '';
      L.push(`  * ${oPendiente(sc.nombre)} (${oPendiente(sc.puesto)}) — ${oPendiente(sc.tipo)}${dias}`);
      L.push(`    Motivo: ${oPendiente(sc.motivo)}${sc.fecha ? ` · Fecha: ${fmtFecha(sc.fecha)}` : ''}`);
      L.push(`    Aplicada por: ${oPendiente(sc.aplicadaPor)} · Notificación: ${ETIQUETA_NOTIFICADA[sc.notificada] || PENDIENTE}`);
      if (String(sc.observaciones || '').trim()) L.push(`    Detalle: ${String(sc.observaciones).trim()}`);
    });
    const sinNotificar = visita.sanciones.filter(sc => !sc.notificada || sc.notificada === 'no').length;
    if (sinNotificar) L.push(`  * ${sinNotificar} sanción/es sin constancia de notificación.`);
    L.push('');

    /* 4. Dotación óptima */
    L.push('4. DOTACIÓN vs. VENTA');
    if (c.dotacion.tipo === 'staff') {
      L.push(`- Sucursal de estructura/soporte. Costo laboral sobre venta de la red: ${fmtPct(c.dotacion.pctCostoVenta)} ` +
             `(benchmark ${fmtPct(c.dotacion.benchmark, 0)}).`);
      L.push(`- Lectura: ${c.dotacion.semaforo.icono} ${c.dotacion.semaforo.texto}`);
    } else {
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
    }
    if (c.productividad) {
      L.push(`- Productividad: ${fmtNum(c.productividad.ticketsHora)} tickets/hora sobre un objetivo de ${c.productividad.objetivo} ` +
             `(cumplimiento ${fmtPct(c.productividad.cumplimiento)}).`);
    }
    L.push('');

    let seccion = 4;

    /* Talento: matriz de desempeño y potencial del plantel */
    if (c.talento.evaluados.length) {
      const t9 = c.talento;
      seccion++;
      L.push(seccion + '. DESEMPEÑO Y POTENCIAL DEL PLANTEL');
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
        if (fila.length) {
          L.push(`  * ${etiqueta} — ${fila.join(' · ')}`);
        }
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
          const nivel = (NIVELES_ESTUDIO.find(n => n.id === x.estudia) || {}).nombre || '';
          L.push(`  * ${oPendiente(x.nombre)}: ${nivel}${x.carrera ? ' — ' + x.carrera : ''}` +
                 `${x.interesDesarrollo ? ` · quiere desarrollarse en: ${x.interesDesarrollo}` : ''}`);
        });
      }
      L.push('');
    }

    /* Sucesión de posiciones críticas */
    if (visita.sucesion.length) {
      seccion++;
      L.push(seccion + '. SUCESIÓN Y TALENTO CRÍTICO');
      L.push(`- Posiciones críticas identificadas: ${c.sucesion.posicionesCriticas} · con plan de sucesión: ${c.sucesion.criticasConPlan}`);
      L.push(`- Candidatos listos en menos de 1 año: ${c.sucesion.candidatosListos}`);
      c.sucesion.lista.forEach(i => {
        const cands = i.candidatos.length
          ? i.candidatos.map(x => `${x.nombre} (${(READINESS.find(r => r.id === x.readiness) || {}).nombre || '—'})`).join('; ')
          : 'sin candidatos identificados';
        L.push(`  * ${i.posicion} — titular ${oPendiente(i.incumbent)} — criticidad ${i.criticidad}/3, escasez ${i.escasez}/3 → ${cands}`);
      });
      L.push('');
    }

    /* 6. Diagnóstico */
    seccion++;
    L.push(seccion + '. DIAGNÓSTICO Y ACCIONES RECOMENDADAS');
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

    /* Plan de acción, separado según a cargo de quién queda cada punto */
    seccion++;
    L.push(seccion + '. PLAN DE ACCIÓN');
    const plan = visita.diagnostico.plan || [];
    if (!plan.length) {
      L.push('   ' + PENDIENTE);
    } else {
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
    L.push('');

    /* Datos faltantes */
    const faltantes = detectarFaltantes(visita, sucursal, c);
    if (faltantes.length) {
      L.push('DATOS PENDIENTES DE CARGA');
      faltantes.forEach(f => L.push('  - ' + f));
      L.push('');
    }

    L.push(barra);
    L.push('Reporte generado desde el Tablero de Gestión Operativa de RRHH.');
    L.push(barra);

    return L.join('\n');
  }

  function bloque(txt, sangria) {
    const t = String(txt || '').trim();
    if (!t) return sangria + PENDIENTE;
    return t.split('\n').map(l => sangria + l.trim()).join('\n');
  }

  /** Lista los campos que quedaron sin cargar, para pedirlos explícitamente. */
  function detectarFaltantes(visita, sucursal, c) {
    const f = [];
    if (!sucursal.nombre) f.push('Nombre real de la sucursal (hoy figura como ' + sucursal.codigo + ').');
    if (!sucursal.gerente) f.push('Nombre del Gerente de Tienda.');
    if (!String(visita.minutaGerente.puntos || '').trim()) f.push('Puntos tratados en la reunión con el Gerente de Tienda.');
    if (!String(visita.minutaColaborador.nombre || '').trim()) f.push('Colaborador entrevistado.');
    if (!c.matriz.total.heads) f.push('Headcount base por posición.');
    if (!c.matriz.total.costoTotal) f.push('Costos laborales (sueldos brutos, horas extras, bonos).');
    if (!c.ausentismo.totalDias) f.push('Días de ausentismo del período.');
    if (c.ausentismo.sinApertura) f.push('Apertura del ausentismo por concepto (hoy solo está el total de la matriz de FTE).');
    if (c.ausentismo.diasDetallados && Math.abs(c.ausentismo.diasDetallados - c.matriz.total.diasAusentes) > 0.5) {
      f.push(`Revisar ausentismo: el detalle por concepto suma ${c.ausentismo.diasDetallados} días, ` +
             `pero la matriz de FTE tiene cargados ${c.matriz.total.diasAusentes}. ` +
             `El FTE Real se calcula con el dato de la matriz.`);
    }
    if (!num(visita.comercial.venta) && sucursal.tipo === 'venta') f.push('Venta neta del período (necesaria para el análisis de dotación óptima).');
    if (!num(visita.rotacion.dotacionAnterior)) f.push('Dotación del mes anterior (para el cálculo de rotación).');
    if (!(visita.diagnostico.plan || []).length) f.push('Plan de acción con responsables y plazos.');
    if (!(sucursal.colaboradores || []).length) f.push('Plantel de la sucursal, para poder evaluar desempeño y potencial.');
    else if (c.talento.sinEvaluar.length) {
      f.push(`Evaluación de desempeño y potencial de ${c.talento.sinEvaluar.length} colaborador/es: ` +
             c.talento.sinEvaluar.map(x => x.nombre || 'sin nombre').join(', ') + '.');
    }
    if (!sucursal.emailGerente) f.push('Email del Gerente de Tienda, para que reciba copia del reporte.');
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

  function asunto(visita, sucursal, config) {
    const area = config && config.area ? config.area + ' · ' : '';
    return `Visita RRHH · ${area}${Store.etiquetaSucursal(sucursal)} · ${fmtFecha(visita.fecha)}`;
  }

  /**
   * Envía el reporte. Dos vías:
   *  - webhook: si hay un endpoint configurado (Zapier, Make, Google Apps
   *    Script, etc.) se hace un POST y el envío es automático.
   *  - mailto:  abre el cliente de correo con todo pre-cargado; el coordinador
   *    solo confirma el envío.
   * En ambos casos se deja registro en el historial de la visita.
   */
  async function enviar(visita, sucursal, config, opciones) {
    opciones = opciones || {};
    const cuerpo = texto(visita, sucursal, config);
    const asu = asunto(visita, sucursal, config);
    const dest = destinatario(sucursal, config);
    const destino = dest.email;

    if (!destino) {
      throw new Error(sucursal.gerenteOperaciones
        ? `Falta el email de ${sucursal.gerenteOperaciones} en Configuración.`
        : 'Falta cargar el email del Gerente de Operaciones en Configuración.');
    }

    let via = 'mailto';
    if (config.webhook && String(config.webhook).trim() && !opciones.forzarMailto) {
      const c = calcular(visita, sucursal, config);
      const payload = {
        para: destino,
        cc: copias(sucursal, config),
        asunto: asu,
        cuerpo,
        area: config.area || '',
        sucursal: { codigo: sucursal.codigo, nombre: sucursal.nombre, tipo: sucursal.tipo },
        visita: { id: visita.id, fecha: visita.fecha, periodo: visita.periodo, coordinador: visita.coordinador },
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
      };
      // El cuerpo es JSON, pero se declara text/plain a propósito: así el
      // navegador lo trata como "simple request" y no dispara el preflight
      // OPTIONS, que Google Apps Script no sabe responder.
      const resp = await fetch(String(config.webhook).trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) throw new Error('El endpoint de envío respondió ' + resp.status + '.');
      via = 'webhook';
    } else {
      const cc = copias(sucursal, config).join(',');
      const url = 'mailto:' + encodeURIComponent(destino) +
        '?subject=' + encodeURIComponent(asu) +
        (cc ? '&cc=' + encodeURIComponent(cc) : '') +
        '&body=' + encodeURIComponent(cuerpo);
      // Algunos clientes de correo truncan URLs muy largas; si pasa, el
      // coordinador tiene el botón "Copiar reporte" como respaldo.
      window.location.href = url;
    }

    const sello = new Date().toISOString();
    visita.envio.enviado = true;
    visita.envio.fecha = sello;
    visita.envio.destinatario = destino;
    visita.envio.via = via;
    visita.envio.copias = copias(sucursal, config);
    visita.envio.historial.push({ fecha: sello, destinatario: destino, copias: visita.envio.copias, via });
    Store.save();
    return { via, destino, largo: cuerpo.length };
  }

  return { calcular, texto, asunto, enviar, detectarFaltantes, tablaFteTexto, copias, destinatario };
})();
