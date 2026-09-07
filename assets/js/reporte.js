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
    const base = { matriz, ausentismo, rotacion, bajas, sucesion, dotacion, productividad, hallazgosAuto, par };
    base.normativa = evaluarVisita(visita, sucursal, config, base);

    return base;
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
    L.push('Sucursal: ' + Store.etiquetaSucursal(sucursal));
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
    L.push(`- Sanciones registradas: ${visita.sanciones.length}`);
    visita.sanciones.forEach(s => {
      L.push(`  * ${oPendiente(s.nombre)} — ${oPendiente(s.tipo)} — ${oPendiente(s.motivo)} (${oPendiente(s.puesto)})`);
    });
    L.push('');

    /* 4. Dotación óptima */
    L.push('4. DOTACIÓN vs. VENTA');
    if (c.dotacion.tipo === 'staff') {
      L.push(`- Sucursal de estructura/soporte. Costo laboral sobre venta de la red: ${fmtPct(c.dotacion.pctCostoVenta)} ` +
             `(benchmark ${fmtPct(c.dotacion.benchmark, 0)}).`);
      L.push(`- Lectura: ${c.dotacion.semaforo.icono} ${c.dotacion.semaforo.texto}`);
    } else {
      L.push(`- Venta neta del período: ${fmtMoneda(num(visita.comercial.venta) || null, moneda)}`);
      L.push(`- Costo laboral / venta: ${fmtPct(c.dotacion.pctCostoVenta)} (benchmark ${fmtPct(c.dotacion.benchmark, 0)})`);
      L.push(`- Dotación actual: ${c.matriz.total.heads} · Dotación óptima según venta: ${c.dotacion.dotacionOptima === null ? PENDIENTE : c.dotacion.dotacionOptima}` +
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

    /* 5. Sucesión */
    if (visita.sucesion.length) {
      L.push('5. SUCESIÓN Y TALENTO CRÍTICO');
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

    /* Alertas normativas */
    let seccion = visita.sucesion.length ? 6 : 5;
    const acc = c.normativa.alertas.filter(a => a.severidad === 'critica' || a.severidad === 'alta');
    if (acc.length) {
      L.push(`${seccion}. ALERTAS NORMATIVAS`);
      L.push(`   ${c.normativa.conteo.critica} crítica(s) y ${c.normativa.conteo.alta} de prioridad alta, ` +
             `sobre Ley 20.744 y CCT 414/05.`);
      L.push('');
      acc.forEach(a => {
        L.push(`- [${ETIQUETA_SEVERIDAD[a.severidad].toUpperCase()}] ${a.fuente} — ${a.titulo}`);
        L.push(bloque(a.mensaje, '     '));
        if (a.colaborador) L.push(`     Colaborador: ${a.colaborador}`);
        L.push(`     Detectado en: ${a.origen}`);
      });
      const otras = c.normativa.alertas.length - acc.length;
      if (otras > 0) L.push(`   (${otras} alerta(s) adicionales de menor prioridad quedan registradas en el tablero.)`);
      L.push('');
      L.push('   Estas alertas señalan temas que la norma regula; no constituyen asesoramiento legal.');
      L.push('   Los casos concretos se definen con Legales o Relaciones Laborales.');
      L.push('');
      seccion++;
    }

    /* Diagnóstico */
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
    L.push('- Plan de Seguimiento de RRHH:');
    if ((visita.diagnostico.plan || []).length) {
      visita.diagnostico.plan.forEach((p, i) => {
        L.push(`      ${i + 1}. ${oPendiente(p.compromiso)}`);
        L.push(`         Responsable: ${oPendiente(p.responsable)} · Plazo: ${fmtFecha(p.plazo)} · Estado: ${oPendiente(p.estado)}`);
      });
    } else {
      L.push('      ' + PENDIENTE);
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
    if (!sucursal.jurisdiccion) f.push('Jurisdicción de la sucursal (define si le aplica el CCT 414/05).');
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
    if (!(visita.diagnostico.plan || []).length) f.push('Plan de seguimiento con responsables y plazos.');
    return f;
  }

  /* ---------------------- Envío al Gerente de Operaciones ---------------------- */

  function asunto(visita, sucursal) {
    return `Visita RRHH · ${Store.etiquetaSucursal(sucursal)} · ${fmtFecha(visita.fecha)}`;
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
    const asu = asunto(visita, sucursal);
    const destino = (config.gerenteOperaciones && config.gerenteOperaciones.email || '').trim();

    if (!destino) {
      throw new Error('Falta cargar el email del Gerente de Operaciones en Configuración.');
    }

    let via = 'mailto';
    if (config.webhook && String(config.webhook).trim() && !opciones.forzarMailto) {
      const c = calcular(visita, sucursal, config);
      const payload = {
        para: destino,
        cc: (config.copias || '').split(',').map(s => s.trim()).filter(Boolean),
        asunto: asu,
        cuerpo,
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
          diferenciaDotacion: c.dotacion.diferencia,
          alertasCriticas: c.normativa.conteo.critica,
          alertasAltas: c.normativa.conteo.alta
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
      const cc = (config.copias || '').trim();
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
    visita.envio.historial.push({ fecha: sello, destinatario: destino, via });
    Store.save();
    return { via, destino, largo: cuerpo.length };
  }

  return { calcular, texto, asunto, enviar, detectarFaltantes, tablaFteTexto };
})();
