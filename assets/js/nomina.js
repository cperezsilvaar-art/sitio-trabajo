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
  CATEGORIACONVENIO: 'categoriaConvenio',
  CARGO: 'cargo',
  NIVELDECARGO: 'nivelCargo',
  FECHADENACIMIENTO: 'fechaNacimiento',
  FECHADEINGRESO: 'fechaIngreso',
  FECHADEINGRESOAFTD: 'fechaIngresoFTD',
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
                       'categoriaConvenio', 'cargo', 'nivelCargo', 'fechaNacimiento',
                       'fechaIngreso', 'fechaIngresoFTD', 'email', 'emailCorporativo',
                       'telefono', 'domicilio', 'localidad', 'obraSocial'];

/* La planilla usa estos marcadores de Excel para "sin dato". */
const VACIOS_EXCEL = ['#N/A', '#REF!', '#VALUE!', '#¡REF!', '#N/D', 'NULL'];

const _normNom = t => String(t == null ? '' : t)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toUpperCase().replace(/[^A-Z0-9]/g, '');

function textoNomina(v) {
  const t = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  return VACIOS_EXCEL.indexOf(t.toUpperCase()) >= 0 ? '' : t;
}

/** Fecha a ISO. Acepta 1978-04-26, 26/04/1978 y el "1978-04-26 00:00:00" de Excel. */
function fechaNomina(v) {
  const t = textoNomina(v);
  if (!t) return '';
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
  const texto = String(crudo || '').replace(/\r/g, '');
  const lineas = texto.split('\n').filter(l => l.trim());
  if (lineas.length < 2) return { filas: [], avisos: ['No hay filas para leer.'] };

  const sep = lineas[0].includes('\t') ? '\t' : (lineas[0].includes(';') ? ';' : ',');
  const partir = l => l.split(sep).map(x => x.trim().replace(/^"|"$/g, ''));

  const iEnc = lineas.findIndex(l => {
    const c = partir(l).map(_normNom);
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

  const filas = [];
  const avisos = [];
  const sinCargo = [];
  const cuilDudoso = [];
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

    fila.cuilDudoso = cuil.length !== 11;
    if (fila.cuilDudoso) cuilDudoso.push(`${textoNomina(c[col.apellido])} (${cuil})`);
    fila.apellido = t('apellido');
    fila.nombre = t('nombre');
    fila.nombreCompleto = t('nombreCompleto');
    const tienda = t('tienda');
    fila.tienda = ALIAS_TIENDA[_normNom(tienda)] || tienda;
    fila.posicion = posicionDeCargo(fila.cargo);
    /* En la nómina completa el número de personal está a la izquierda del CUIL,
       con el encabezado roto. En el listado corto esa columna no existe: ahí lo
       que va a la izquierda es el encabezado, así que solo se toma si es un
       número y no hay una columna FICHA que ya ocupe ese lugar. */
    const izquierda = col.cuil > 0 ? textoNomina(c[col.cuil - 1]) : '';
    fila.nroPersonal = (col.legajo === undefined && /^\d+$/.test(izquierda)) ? izquierda : '';

    if (fila.cargo && !fila.posicion) sinCargo.push(fila.cargo);
    filas.push(fila);
  });

  if (sinCuil) avisos.push(`${sinCuil} fila${sinCuil === 1 ? '' : 's'} sin CUIL reconocible que quedaron afuera.`);
  if (cuilDudoso.length) {
    avisos.push('CUIL con una cantidad de dígitos rara, se importaron igual pero conviene corregirlos en la nómina: ' +
                cuilDudoso.join(', ') + '.');
  }
  if (sinCargo.length) {
    const únicos = sinCargo.filter((x, i) => sinCargo.indexOf(x) === i);
    avisos.push('Cargos que no se reconocen y quedan sin posición asignada: ' + únicos.join(', ') + '.');
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
