/*
 * nomina.js — Lectura del padrón de colaboradores del área.
 *
 * Es el listado maestro: una fila por persona, con su cargo, su tienda, sus
 * fechas y sus datos de contacto. Es lo que le faltaba al panel para saber
 * quién es quién: el libro de novedades trae los movimientos del mes pero no
 * el puesto, y la dotación por posición sale justamente de acá.
 *
 * Lo que la nómina no trae son los talles de la ropa de trabajo. Esos campos
 * quedan vacíos en el perfil, para completarlos a mano.
 */

/* Encabezados de la nómina. La comparación es sin acentos, sin espacios y en
   mayúsculas, así que aguanta las variantes de tipeo entre versiones. */
const COLUMNAS_NOMINA = {
  CUIL: 'cuil',
  DNI: 'dni',
  APELLIDO: 'apellido',
  NOMBRE: 'nombre',
  NOMBREYAPELLIDO: 'nombreCompleto',
  SEXO: 'sexo',
  ESTATUS: 'estatus',
  UNIDADDENEGOCIO: 'unidadNegocio',
  AREA: 'area',
  RAZONSOCIALCONTRATADOA: 'razonSocialContrato',
  TIENDADONDEESTA: 'tienda',
  NOMBREDESUCURSAL: 'tienda',          // así la llama la nómina de septiembre
  CATEGORIACONVENIO: 'categoriaConvenio',
  CARGO: 'cargo',
  NIVELDECARGO: 'nivelCargo',
  FECHADENACIMIENTO: 'fechaNacimiento',
  FECHADEINGRESO: 'fechaIngreso',
  FECHADEINGRESOAFTD: 'fechaIngresoFTD',
  FECHADEINGRESOFARMATODOINGRESOAFTD: 'fechaIngresoFTD',
  DIRECCION: 'direccionArea',          // el nivel de la organización, no el domicilio
  VP: 'direccionArea',
  ESTADOCIVIL: 'estadoCivil',
  NACIONALIDAD: 'nacionalidad',
  BANCO: 'banco',
  CBU: 'cbu',
  MAILCOORPORATIVOOPERSONAL: 'email',
  MAILCORPORATIVO: 'emailCorporativo',
  TELEFONO: 'telefono',
  DOMICILIOACTUALIZADO: 'domicilio',
  LOCALIDADYCP: 'localidad',
  OBRASOCIALPREPAGA: 'obraSocial',
  /* El listado corto del área usa otros nombres para lo mismo. */
  COLABORADOR: 'nombreCompleto',
  TIENDA: 'tienda',
  FICHA: 'legajo',
  RAZONSOCIAL: 'razonSocialContrato',
  FECHAINICIO: 'fechaIngreso',
  FECHADEINICIO: 'fechaIngreso'
};

/* "Sin tienda" es como el listado corto llama a los flotantes del área, que en
   la nómina completa figuran con su nombre. Es la misma gente. */
const TIENDA_FLOTANTES = 'FLOTANTES ÁREA 3';
const ALIAS_TIENDA = { SINTIENDA: TIENDA_FLOTANTES, FLOTANTES: TIENDA_FLOTANTES };

/* Campos de texto que se copian tal cual al perfil. */
const CAMPOS_NOMINA = ['dni', 'legajo', 'sexo', 'estatus', 'unidadNegocio', 'razonSocialContrato',
                       'direccionArea', 'categoriaConvenio', 'cargo', 'nivelCargo',
                       'fechaNacimiento', 'fechaIngreso', 'fechaIngresoFTD',
                       'email', 'emailCorporativo', 'telefono', 'domicilio', 'localidad',
                       'obraSocial', 'estadoCivil', 'nacionalidad', 'banco', 'cbu'];

/* Los datos bancarios entran porque la nómina los trae y el coordinador los
   pidió, pero se muestran plegados y se avisa que el respaldo que se exporta
   desde Configuración no está cifrado. */
const CAMPOS_SENSIBLES = ['banco', 'cbu'];

/* La planilla usa estos marcadores de Excel para "sin dato". */
const VACIOS_EXCEL = ['#N/A', '#REF!', '#VALUE!', '#¡REF!', '#N/D', 'NULL'];

/* Un aviso con 139 nombres adentro esconde a los otros avisos, que son los que
   hay que leer. Se muestran los primeros y se dice cuántos faltan. */
function listaCorta(nombres, tope) {
  const n = tope || 8;
  if (nombres.length <= n) return nombres.join(', ');
  return nombres.slice(0, n).join(', ') + ` y ${nombres.length - n} más`;
}

const _normNom = t => String(t == null ? '' : t)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toUpperCase().replace(/[^A-Z0-9]/g, '');

function textoNomina(v) {
  const t = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  return VACIOS_EXCEL.indexOf(t.toUpperCase()) >= 0 ? '' : t;
}

/**
 * CBU tal como sale de la planilla.
 *
 * Un CBU son 22 dígitos y Excel los trata como número: si la celda no está
 * formateada como texto, guarda 7.00276300040573e+19 y se pierden los últimos
 * siete dígitos para siempre. Eso no se puede reconstruir, así que se marca
 * como dudoso en vez de guardar un número que parece válido y no lo es.
 */
function cbuNomina(v) {
  const t = textoNomina(v);
  if (!t) return { valor: '', dudoso: false, motivo: '' };
  if (/e\+/i.test(t)) {
    return { valor: t, dudoso: true,
      motivo: 'Excel lo guardó como número y le comió dígitos. Formateá la columna como texto y volvé a exportar.' };
  }
  const digitos = t.replace(/\D/g, '');
  if (digitos.length !== 22) {
    return { valor: t, dudoso: true, motivo: `Tiene ${digitos.length} dígitos y un CBU tiene 22.` };
  }
  return { valor: digitos, dudoso: false, motivo: '' };
}

/**
 * Fecha a ISO. Acepta 1978-04-26, 26/04/1978, el "1978-04-26 00:00:00" de Excel
 * y el número de serie que aparece cuando la columna se pegó sin formato de
 * fecha (Excel cuenta días desde el 30/12/1899).
 */
function fechaNomina(v) {
  const t = textoNomina(v);
  if (!t) return '';
  if (/^\d{5}$/.test(t)) {
    const n = Number(t);
    if (n > 10000 && n < 60000) {
      return new Date(Date.UTC(1899, 11, 30) + n * 86400000).toISOString().slice(0, 10);
    }
  }
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    const a = m[3].length === 2 ? (Number(m[3]) > 40 ? '19' + m[3] : '20' + m[3]) : m[3];
    return `${a}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  }
  return '';
}

/** Posición del panel que le corresponde a un cargo de la nómina. */
function posicionDeCargo(cargo) {
  return MAPA_CARGOS[_normNom(cargo)] || '';
}

/** Apellido y nombre presentables, desde el "TODO EN MAYÚSCULAS" de la planilla. */
function nombreDeNomina(fila) {
  const limpiar = t => String(t || '').replace(/\s+/g, ' ').trim();
  const ap = limpiar(fila.apellido), no = limpiar(fila.nombre);
  if (ap || no) return [ap, no].filter(Boolean).join(', ');
  return limpiar(fila.nombreCompleto);
}

/**
 * Interpreta la nómina pegada desde Excel.
 *
 * La primera columna del archivo real viene con el encabezado roto (`#REF!`)
 * pero contiene el número de personal, así que se lee por posición: es la
 * columna anterior al CUIL.
 */
function interpretarNomina(crudo) {
  /* filasPegadas respeta las celdas entrecomilladas: los encabezados de la
     nómina traen saltos de línea adentro y partir por \n perdía en silencio
     todas las columnas que venían después. */
  const lineas = filasPegadas(crudo);
  if (lineas.length < 2) return { filas: [], avisos: ['No hay filas para leer.'] };

  const partir = f => f;

  const iEnc = lineas.findIndex(f => {
    const c = partir(f).map(_normNom);
    return c.includes('CUIL') &&
      (c.includes('APELLIDO') || c.includes('CARGO') || c.includes('COLABORADOR'));
  });
  if (iEnc < 0) {
    return { filas: [], avisos: ['No se encontró la fila de encabezados (CUIL, y APELLIDO, CARGO o COLABORADOR).'] };
  }

  const enc = partir(lineas[iEnc]).map(_normNom);
  const col = {};
  enc.forEach((e, i) => {
    const campo = COLUMNAS_NOMINA[e];
    if (campo && col[campo] === undefined) col[campo] = i;
  });
  if (col.cuil === undefined) return { filas: [], avisos: ['La nómina no trae la columna CUIL.'] };

  /* Sin la columna de sucursal no hay a dónde poner a nadie: la importación
     leería las 139 filas y no guardaría ninguna. Pasa cuando se selecciona
     media planilla, y antes fallaba en silencio. */
  if (col.tienda === undefined) {
    return { filas: [], avisos: [
      'No se encontró la columna de sucursal (NOMBRE DE SUCURSAL o TIENDA DONDE ESTÁ). ' +
      'Suele pasar cuando se copia solo una parte de la planilla: seleccioná desde la columna ' +
      'CUIL hasta la última de la derecha, incluyendo la fila de encabezados.'
    ] };
  }

  const filas = [];
  const avisos = [];
  const sinCargo = [];
  const cuilDudoso = [];
  const cbuDudoso = [];
  const sinIngresoFtd = [];
  let sinCuil = 0;

  lineas.slice(iEnc + 1).forEach(l => {
    const c = partir(l);
    const cuil = soloDigitos(c[col.cuil]);
    /* Un CUIL mal tipeado no puede costarle a alguien quedar afuera del padrón:
       se acepta con margen, se avisa, y esa persona se identifica por nombre. */
    if (cuil.length < 10 || cuil.length > 13) { if (c.some(x => x)) sinCuil++; return; }

    const t = k => col[k] === undefined ? '' : textoNomina(c[col[k]]);
    const fila = { cuil };
    CAMPOS_NOMINA.forEach(k => { fila[k] = t(k); });
    ['fechaNacimiento', 'fechaIngreso', 'fechaIngresoFTD'].forEach(k => { fila[k] = fechaNomina(fila[k]); });

    /* El CBU se valida aparte: guardar un número corrupto que parece un CBU es
       peor que no tenerlo, porque nadie lo vuelve a mirar. */
    const cbu = cbuNomina(fila.cbu);
    fila.cbu = cbu.valor;
    fila.cbuDudoso = cbu.dudoso;
    if (cbu.dudoso) cbuDudoso.push({ nombre: t('nombreCompleto') || t('apellido'), motivo: cbu.motivo });

    if (!fila.fechaIngresoFTD) sinIngresoFtd.push(t('nombreCompleto') || t('apellido'));

    fila.cuilDudoso = cuil.length !== 11;
    if (fila.cuilDudoso) cuilDudoso.push(`${textoNomina(c[col.apellido])} (${cuil})`);
    fila.apellido = t('apellido');
    fila.nombre = t('nombre');
    fila.nombreCompleto = t('nombreCompleto');
    const tienda = t('tienda');
    fila.tienda = ALIAS_TIENDA[_normNom(tienda)] || tienda;
    fila.posicion = posicionDeCargo(fila.cargo);
    /* La jornada no viene en una columna propia: sale de cómo está escrito el
       cargo. Se resuelve acá para que el panel sume dotación en FTE y no en
       cabezas. */
    fila.jornada = jornadaDeVinculo(fila).fte;
    /* En la nómina completa el número de personal está a la izquierda del CUIL,
       con el encabezado roto. En el listado corto esa columna no existe: ahí lo
       que va a la izquierda es el encabezado, así que solo se toma si es un
       número y no hay una columna FICHA que ya ocupe ese lugar. */
    const izquierda = col.cuil > 0 ? textoNomina(c[col.cuil - 1]) : '';
    fila.nroPersonal = (col.legajo === undefined && /^\d+$/.test(izquierda)) ? izquierda : '';

    if (fila.cargo && !fila.posicion) sinCargo.push(fila.cargo);
    filas.push(fila);
  });

  if (col.cargo === undefined) {
    avisos.push('La planilla no trae la columna CARGO: se importa igual, pero el organigrama ' +
                'no va a poder ordenar a nadie por puesto.');
  }
  if (sinCuil) avisos.push(`${sinCuil} fila${sinCuil === 1 ? '' : 's'} sin CUIL reconocible que quedaron afuera.`);
  cbuDudoso.forEach(x => avisos.push(`CBU de ${x.nombre}: ${x.motivo}`));
  if (sinIngresoFtd.length) {
    avisos.push('Sin fecha de ingreso a Farmatodo: ' + listaCorta(sinIngresoFtd) + '.');
  }
  if (cuilDudoso.length) {
    avisos.push('CUIL con una cantidad de dígitos rara, se importaron igual pero conviene corregirlos en la nómina: ' +
                cuilDudoso.join(', ') + '.');
  }
  if (sinCargo.length) {
    const únicos = sinCargo.filter((x, i) => sinCargo.indexOf(x) === i);
    avisos.push('Cargos que no se reconocen y quedan sin posición asignada: ' + listaCorta(únicos) + '.');
  }
  if (!filas.length) avisos.push('No se reconoció ninguna persona.');

  return { filas, avisos };
}

/** Resumen de una nómina leída: por tienda y por posición. */
function resumirNomina(filas) {
  const porTienda = {}, porPosicion = {};
  (filas || []).forEach(f => {
    const t = f.tienda || 'Sin tienda';
    porTienda[t] = (porTienda[t] || 0) + 1;
    const p = f.posicion || 'Sin posición';
    porPosicion[p] = (porPosicion[p] || 0) + 1;
  });
  return { personas: (filas || []).length, porTienda, porPosicion };
}

/* ------------------- Composición del plantel por tienda -------------------
 *
 * Tres preguntas que el coordinador contesta de memoria y mal: cuántas mujeres
 * y cuántos varones hay en cada tienda, cuánta antigüedad promedio tiene cada
 * una y qué edad promedio. Son las tres que arman la conversación de
 * capacidades con Operaciones —una tienda de gente nueva no se supervisa como
 * una de quince años de casa— y ninguna estaba en el panel.
 *
 * Cuenta **personas y no FTE**: dos de media jornada son dos mujeres, no una.
 * El FTE contesta «cuánto turno cubro» y esto contesta «quiénes son», que es
 * otra pregunta. Los de bloqueo de título sí entran: son parte del plantel
 * aunque no cubran piso.
 *
 * La edad sale de `fechaNacimiento`, que **no está en la semilla del
 * repositorio** por privacidad: aparece recién cuando se pega la nómina del
 * mes. Mientras no esté, la columna queda en `null` y la pantalla lo dice en
 * vez de mostrar un cero que parece un dato.
 */

/** Años cumplidos a una fecha, o null si no hay fecha de nacimiento. */
function edadAnios(fechaNacimiento, hoyISO) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fechaNacimiento || ''))) return null;
  const [a, m, d] = fechaNacimiento.split('-').map(Number);
  const h = hoyISO && /^\d{4}-\d{2}-\d{2}$/.test(hoyISO)
    ? hoyISO.split('-').map(Number)
    : (x => [x.getFullYear(), x.getMonth() + 1, x.getDate()])(new Date());
  let anios = h[0] - a;
  if (h[1] < m || (h[1] === m && h[2] < d)) anios--;
  return anios >= 0 && anios < 120 ? anios : null;
}

const _promedio = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

/**
 * La composición de una lista de personas: sexo, antigüedad y edad.
 * `sinEdad` y `sinSexo` cuentan a quién le falta el dato, para que un promedio
 * sobre la mitad del plantel no se lea como si fuera sobre todos.
 */
function composicionDe(personas, hoyISO) {
  const gente = (personas || []).filter(c => c && c.activo !== false);
  const sx = c => String(c.sexo || '').trim().toUpperCase()[0] || '';
  const mujeres = gente.filter(c => sx(c) === 'F').length;
  const varones = gente.filter(c => sx(c) === 'M').length;

  const ants = gente.map(c => antiguedadAnios(c.fechaIngreso)).filter(x => x !== null);
  const edades = gente.map(c => edadAnios(c.fechaNacimiento, hoyISO)).filter(x => x !== null);

  return {
    personas: gente.length,
    mujeres, varones,
    sinSexo: gente.length - mujeres - varones,
    /* Sobre los que tienen sexo cargado, no sobre el total: si faltan diez
       fichas, el porcentaje sobre el total miente hacia abajo. */
    pctMujeres: (mujeres + varones) ? mujeres / (mujeres + varones) : null,
    antiguedad: _promedio(ants),
    sinAntiguedad: gente.length - ants.length,
    edad: _promedio(edades),
    sinEdad: gente.length - edades.length
  };
}

/** Una fila por tienda más el total del área, para el tablero del Panel. */
function composicionPorSucursal(estado, hoyISO) {
  const e = estado || {};
  const filas = (e.sucursales || []).map(s => Object.assign(
    { id: s.id, sucursal: s.nombre || s.codigo, staff: s.tipo === 'staff' },
    composicionDe(s.colaboradores, hoyISO)));
  const todas = (e.sucursales || []).flatMap(s => s.colaboradores || []);
  return { filas, total: composicionDe(todas, hoyISO) };
}

/* ===================================================================== *
 *  Documentos del legajo
 * ===================================================================== *
 *
 * El panel registra que el documento existe —tipo, cuándo se recibió, hasta
 * cuándo vale, dónde está el original y un enlace— y no el documento. El por
 * qué está escrito arriba de `TIPOS_DOCUMENTO`, en `catalogos.js`.
 *
 * Lo único que avisa es lo que **vence**. Un contrato firmado es un registro y
 * nada más; una constancia de alumno regular con fecha es trabajo que vuelve.
 */

/**
 * Qué le pasa a un documento hoy: `{ clase, texto, tono, dias }`.
 *
 * Un documento sin vencimiento no está incompleto: hay papeles que no vencen.
 * Devuelve `sinVencimiento` y no pide nada, igual que un contador en cero no
 * se muestra.
 */
function estadoDeDocumento(doc, hoyISO) {
  const d = doc || {};
  const hoy = hoyISO || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.venceEl || ''))) {
    return { clase: 'sinVencimiento', texto: 'No vence', tono: '', dias: null };
  }
  const dias = Math.round(
    (Date.parse(d.venceEl + 'T00:00:00Z') - Date.parse(hoy + 'T00:00:00Z')) / 86400000);
  if (dias < 0) {
    return { clase: 'vencido', tono: 'rojo', dias,
             texto: `Venció hace ${-dias} día${-dias === 1 ? '' : 's'}` };
  }
  if (dias === 0) return { clase: 'vencido', tono: 'rojo', dias, texto: 'Vence hoy' };
  if (dias <= DIAS_AVISO_DOCUMENTO) {
    return { clase: 'porVencer', tono: 'ambar', dias,
             texto: `Vence en ${dias} día${dias === 1 ? '' : 's'}` };
  }
  return { clase: 'vigente', tono: 'verde', dias, texto: `Vigente hasta el ${d.venceEl}` };
}

/**
 * Los documentos del área que piden algo: vencidos y por vencer.
 *
 * Solo mira el plantel activo. Perseguirle la constancia a alguien que ya se
 * fue es ruido, y el historial sigue en su ficha igual.
 */
function documentosQueVencen(estado, hoyISO) {
  const hoy = hoyISO || new Date().toISOString().slice(0, 10);
  const out = [];
  ((estado || {}).sucursales || []).forEach(s => (s.colaboradores || []).forEach(c => {
    if (!sigueEnElPlantel(c)) return;
    (c.documentos || []).forEach(doc => {
      const est = estadoDeDocumento(doc, hoy);
      if (est.clase !== 'vencido' && est.clase !== 'porVencer') return;
      out.push({
        colaboradorId: c.id, nombre: c.nombre,
        sucursalId: s.id, sucursal: s.nombre || s.codigo,
        doc, estado: est,
        tipo: (TIPOS_DOCUMENTO_POR_ID[doc.tipo] || {}).nombre || doc.tipo || 'Documento'
      });
    });
  }));
  /* Lo más vencido primero: es el orden en que hay que llamar. */
  return out.sort((a, b) => (a.estado.dias || 0) - (b.estado.dias || 0));
}

/**
 * El enlace, si se puede confiar en él.
 *
 * El campo lo escribe una persona y el valor termina en un `href`. Un
 * `javascript:` ahí es código corriendo adentro de la página que tiene el
 * padrón entero, así que se aceptan **solo `http` y `https`** y cualquier otra
 * cosa se muestra como texto. No es una precaución teórica: es el único lugar
 * del panel donde algo escrito a mano se convierte en un enlace.
 */
function enlaceSeguro(url) {
  const u = String(url == null ? '' : url).trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) return '';
  return u;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { edadAnios, composicionDe, composicionPorSucursal,
                     estadoDeDocumento, documentosQueVencen, enlaceSeguro };
}
