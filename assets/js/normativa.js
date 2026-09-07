/*
 * normativa.js — Base de reglas laborales y motor de alertas.
 *
 * Fuentes:
 *   LCT — Ley 20.744, texto ordenado por Decreto 390/1976, con las reformas
 *         de las leyes 26.390, 26.844, 27.073, 27.322, 27.323, 27.426,
 *         27.555, 27.742 y 27.802.
 *   CCT — Convenio Colectivo de Trabajo 414/05 (ADEF y cámaras de farmacias),
 *         con los acuerdos 389/2009 y 1209/2010.
 *
 * ALCANCE. Esto es una ayuda de relevamiento, no asesoramiento legal. Marca
 * temas que la norma regula para que el coordinador los verifique; no
 * interpreta hechos ni reemplaza la consulta con Legales. Cuando el convenio
 * mejora la ley, se aplica la norma más favorable al trabajador (LCT art. 9).
 */

/* ------------------------------------------------------------------ *
 * 1. Ámbito del CCT 414/05 — art. 3 y 4                                *
 * ------------------------------------------------------------------ */
const JURISDICCIONES_CCT414 = [
  'Ciudad Autónoma de Buenos Aires',
  'San Martín', 'Tres de Febrero', 'Morón', 'Ituzaingó', 'Hurlingham',
  'Merlo', 'San Justo', 'La Matanza', 'Lanús', 'Avellaneda', 'San Isidro',
  'San Fernando', 'Vicente López', 'Lomas de Zamora', 'Escobar', 'Pilar',
  'Tigre', 'San Miguel', 'Malvinas Argentinas', 'José C. Paz', 'Moreno'
];

/* ------------------------------------------------------------------ *
 * 2. Encuadre de las posiciones de tienda en las categorías del CCT    *
 *    Propuesta por defecto; se ajusta desde Configuración.             *
 * ------------------------------------------------------------------ */
const CATEGORIAS_CCT = [
  { id: 'inicialA',      nombre: 'Categoría Inicial "A"',              art: 'art. 5' },
  { id: 'inicialB',      nombre: 'Categoría Inicial "B"',              art: 'art. 5' },
  { id: 'cajero',        nombre: 'Cajero',                             art: 'art. 6 inc. a' },
  { id: 'perfumeria',    nombre: 'Personal de Perfumería',             art: 'art. 6 inc. b' },
  { id: 'administrativo',nombre: 'Personal Administrativo',            art: 'art. 6 inc. c' },
  { id: 'empleado',      nombre: 'Empleado de Farmacia',               art: 'art. 7' },
  { id: 'especializado', nombre: 'Empleado Especializado de Farmacia', art: 'art. 8' },
  { id: 'farmaceutico',  nombre: 'Farmacéutico',                       art: 'art. 9' },
  { id: 'farmaceuticoDT',nombre: 'Farmacéutico con Dirección Técnica', art: 'art. 9 y 18 inc. b' },
  { id: 'fueraConvenio', nombre: 'Fuera de convenio',                  art: '—' }
];

const MAPEO_CATEGORIAS_DEFECTO = {
  'Gerente de Tienda': 'fueraConvenio',
  'Senior':            'especializado',
  'APV':               'empleado',
  'Farmacéutico':      'farmaceutico',
  'DT':                'farmaceuticoDT',
  'Asesora de Dermo':  'perfumeria'
};

/* ------------------------------------------------------------------ *
 * 3. Escalas y tablas del convenio                                     *
 * ------------------------------------------------------------------ */

/* Escalafón por antigüedad — CCT art. 13 */
const ESCALAFON_ANTIGUEDAD = [
  { anios: 25, pct: 0.50 },
  { anios: 20, pct: 0.40 },
  { anios: 15, pct: 0.35 },
  { anios: 10, pct: 0.30 },
  { anios: 5,  pct: 0.20 },
  { anios: 2,  pct: 0.10 },
  { anios: 1,  pct: 0.05 }
];

function escalafonPorAntiguedad(anios) {
  const tramo = ESCALAFON_ANTIGUEDAD.find(t => anios >= t.anios);
  return tramo ? tramo.pct : 0;
}

/* Vacaciones: el convenio mejora la ley, así que rige el convenio (LCT art. 9) */
const VACACIONES = [
  { hasta: 5,        lct: 14, cct: 17 },
  { hasta: 10,       lct: 21, cct: 26 },
  { hasta: 20,       lct: 28, cct: 35 },
  { hasta: Infinity, lct: 35, cct: 44 }
];

function vacacionesQueCorresponden(aniosAntiguedad) {
  const t = VACACIONES.find(v => aniosAntiguedad <= v.hasta) || VACACIONES[VACACIONES.length - 1];
  return { lct: t.lct, cct: t.cct, aplicable: Math.max(t.lct, t.cct) };
}

/* Licencias especiales — CCT art. 25 comparado con LCT art. 158 */
const LICENCIAS_ESPECIALES = [
  { id: 'matrimonio',    nombre: 'Matrimonio',                     lct: 10, cct: 15,
    nota: 'CCT art. 25 inc. a: 15 días corridos con un año de antigüedad, 12 días si es menor. Puede acumularse a la licencia anual.' },
  { id: 'nacimiento',    nombre: 'Nacimiento o adopción de hijo',  lct: 2,  cct: 2,
    nota: 'CCT art. 25 inc. b: 2 días hábiles (la LCT los cuenta corridos, el convenio hábiles).' },
  { id: 'fallecHijo',    nombre: 'Fallecimiento de hijo, cónyuge o padres', lct: 3, cct: 4,
    nota: 'CCT art. 25 inc. d: 4 días hábiles; 6 si el familiar residía a más de 500 km.' },
  { id: 'fallecHermano', nombre: 'Fallecimiento de hermano',       lct: 1,  cct: 4,
    nota: 'El convenio equipara hermanos, abuelos, padres políticos e hijos políticos a 4 días hábiles.' },
  { id: 'examen',        nombre: 'Examen',                         lct: 2,  cct: 2,
    nota: 'Máximo 10 días corridos por año calendario (LCT art. 158 inc. e y CCT art. 25 inc. e).' },
  { id: 'enfFamiliar',   nombre: 'Enfermedad de familiar',         lct: 0,  cct: 6,
    nota: 'CCT art. 25 inc. c: 6 días hábiles por año por hijo, 4 por padres o cónyuge. La LCT no prevé esta licencia.' },
  { id: 'donacion',      nombre: 'Donación de sangre',             lct: 0,  cct: 1,
    nota: 'CCT art. 25 inc. f: 1 día por donación, acreditando el hecho.' },
  { id: 'mudanza',       nombre: 'Mudanza',                        lct: 0,  cct: 1,
    nota: 'CCT art. 25 inc. g: 1 día hábil por mudanza, probando el hecho.' }
];

/* Delegados según dotación — CCT art. 42 */
function delegadosQueCorresponden(dotacion) {
  if (dotacion < 5) return 0;
  if (dotacion <= 15) return 1;
  if (dotacion <= 40) return 2;
  if (dotacion <= 80) return 3;
  return 4;
}

/* Enfermedad inculpable — LCT art. 208 */
function mesesLicenciaEnfermedad(aniosAntiguedad, cargasFamilia) {
  if (cargasFamilia) return aniosAntiguedad < 5 ? 6 : 12;
  return aniosAntiguedad < 5 ? 3 : 6;
}

/* Preaviso a cargo del empleador — LCT art. 231 */
function mesesPreaviso(aniosAntiguedad) {
  return aniosAntiguedad <= 5 ? 1 : 2;
}

/* ------------------------------------------------------------------ *
 * 4. Catálogo de normas                                                *
 *    severidad: 'critica' | 'alta' | 'media' | 'info'                  *
 * ------------------------------------------------------------------ */
const NORMAS = [
  /* --- Encuadre y fuentes --- */
  { id: 'lct9',   fuente: 'LCT art. 9',    tema: 'Encuadre', severidad: 'info',
    titulo: 'Norma más favorable',
    regla: 'Ante duda sobre la aplicación de normas legales o convencionales prevalece la más favorable al trabajador, agrupando por instituciones.' },
  { id: 'lct12',  fuente: 'LCT art. 12',   tema: 'Encuadre', severidad: 'alta',
    titulo: 'Irrenunciabilidad',
    regla: 'Es nula toda convención que suprima o reduzca derechos de la ley, los estatutos o el convenio, al celebrar, ejecutar o extinguir el contrato.' },
  { id: 'cct3',   fuente: 'CCT 414/05 art. 3 y 4 · LCT art. 16', tema: 'Encuadre', severidad: 'alta',
    titulo: 'Ámbito territorial del convenio',
    regla: 'El CCT 414/05 rige en CABA y en los partidos bonaerenses que enumera. Los convenios colectivos no admiten aplicación extensiva ni analógica.' },
  { id: 'cct10',  fuente: 'CCT 414/05 art. 10 · LCT art. 78', tema: 'Categorías', severidad: 'alta',
    titulo: 'Reemplazos y cobertura de vacantes',
    regla: 'Quien reemplaza en una categoría superior cobra la retribución de esa categoría. Si el reemplazo supera 3 meses continuos o 4 discontinuos en el año aniversario, queda definitivamente en la categoría superior, salvo que reemplace por enfermedad o maternidad. Ante una vacante tiene prioridad el personal del establecimiento que reúna las condiciones técnicas.' },
  { id: 'cct13',  fuente: 'CCT 414/05 art. 13', tema: 'Remuneración', severidad: 'media',
    titulo: 'Escalafón por antigüedad',
    regla: 'Sobre el sueldo: 5% al año, 10% a los 2, 20% a los 5, 30% a los 10, 35% a los 15, 40% a los 20 y 50% a los 25 años.' },
  { id: 'cct12',  fuente: 'CCT 414/05 art. 12 y 22', tema: 'Remuneración', severidad: 'media',
    titulo: 'Escala salarial básica',
    regla: 'Los básicos del texto original son de 2005 y están superados por las paritarias posteriores. Lo que sigue vigente es la obligación de mantener la diferencia porcentual entre categorías ante cualquier aumento general.' },
  { id: 'cct18',  fuente: 'CCT 414/05 art. 18', tema: 'Remuneración', severidad: 'media',
    titulo: 'Adicionales del convenio',
    regla: 'Farmacéutico 58% sobre el básico de Inicial "A"; Dirección Técnica con bloqueo de título 88% sobre Inicial "A" más 10% sobre el básico de Farmacéutico; auxiliar con bloqueo 20% y sin bloqueo 17%; auxiliar de farmacia 20%; título secundario 5%; cajero 10%; administrativo y perfumería con más de 5 años 10%; idioma 10%; uso de bicicleta o ciclomotor 15%.' },
  { id: 'cct19',  fuente: 'CCT 414/05 art. 19 · LCT art. 131', tema: 'Remuneración', severidad: 'critica',
    titulo: 'Falla de caja',
    regla: 'El cajero percibe un adicional del 10% del básico destinado a cubrir los faltantes. La LCT prohíbe deducir, retener o compensar sumas del salario, y prohíbe imponer multas al trabajador.' },

  /* --- Jornada --- */
  { id: 'cct14',  fuente: 'CCT 414/05 art. 14', tema: 'Jornada', severidad: 'alta',
    titulo: 'Jornada máxima',
    regla: 'La jornada no puede exceder 8 horas diarias ni 45 semanales. No se incluyen las pausas de almuerzo o cena.' },
  { id: 'cct14pt',fuente: 'CCT 414/05 art. 14 · LCT art. 92 ter', tema: 'Jornada', severidad: 'alta',
    titulo: 'Jornada a tiempo parcial',
    regla: 'Es tiempo parcial la jornada inferior a dos tercios de la habitual. No puede cumplir horas extraordinarias ni modificarse el horario acordado. La remuneración no puede ser inferior a la proporcional del trabajador a tiempo completo de la misma categoría.' },
  { id: 'cct15',  fuente: 'CCT 414/05 art. 15 · LCT art. 200', tema: 'Jornada', severidad: 'alta',
    titulo: 'Jornada insalubre',
    regla: 'Tareas de laboratorio con sustancias tóxicas sin tecnología adecuada: 6 horas diarias o 33 semanales, abonadas como 8 diarias o 45 semanales. La insalubridad la declara la autoridad de aplicación.' },
  { id: 'cct16',  fuente: 'CCT 414/05 art. 16', tema: 'Jornada', severidad: 'alta',
    titulo: 'Jornada nocturna',
    regla: 'La jornada nocturna no puede exceder 7 horas diarias ni 42 semanales, entre las 21 y las 6 del día siguiente. No puede emplearse a menores en trabajo nocturno.' },
  { id: 'cct17',  fuente: 'CCT 414/05 art. 17', tema: 'Jornada', severidad: 'alta',
    titulo: 'Turno nocturno voluntario y obligatorio',
    regla: 'En el turno nocturno voluntario, el personal devenga un recargo del 100% sobre el básico. En el turno nocturno obligatorio dispuesto por la autoridad sanitaria no corresponde ese recargo. En horario mixto se paga el 100% por las horas nocturnas.' },
  { id: 'lct197', fuente: 'LCT art. 197', tema: 'Jornada', severidad: 'alta',
    titulo: 'Descanso entre jornadas',
    regla: 'Entre el cese de una jornada y el comienzo de la otra debe mediar una pausa no inferior a 12 horas.' },
  { id: 'lct201', fuente: 'LCT art. 201 · CCT 414/05 art. 23', tema: 'Jornada', severidad: 'alta',
    titulo: 'Recargo por horas suplementarias',
    regla: 'Recargo del 50% sobre el salario habitual en días comunes y del 100% los sábados después de las 13, domingos y feriados. Corresponde medie o no autorización administrativa.' },
  { id: 'lct203', fuente: 'LCT art. 203', tema: 'Jornada', severidad: 'media',
    titulo: 'Las horas extras no son obligatorias',
    regla: 'El trabajador no está obligado a prestar servicios en horas suplementarias, salvo peligro o accidente ocurrido o inminente, fuerza mayor o exigencias excepcionales.' },
  { id: 'lct204', fuente: 'LCT art. 204 y 207', tema: 'Jornada', severidad: 'alta',
    titulo: 'Descanso semanal',
    regla: 'Prohibida la ocupación desde las 13 del sábado hasta las 24 del domingo, salvo excepción, en cuyo caso corresponde descanso compensatorio. Si se omite otorgarlo, el trabajador puede tomarlo avisando con 24 horas y el empleador paga el salario con 100% de recargo.' },
  { id: 'lct197b',fuente: 'LCT art. 197 bis', tema: 'Jornada', severidad: 'media',
    titulo: 'Banco de horas y compensación',
    regla: 'El régimen de compensación de horas extras debe formalizarse por escrito, dejar constancia de su carácter voluntario, fijar límites y establecer un método de control verificable por ambas partes, respetando los descansos mínimos.' },

  /* --- Vacaciones y licencias --- */
  { id: 'cct24',  fuente: 'CCT 414/05 art. 24 · LCT art. 150', tema: 'Vacaciones', severidad: 'alta',
    titulo: 'Licencia anual ordinaria',
    regla: 'El convenio mejora la ley: 17 días hasta 5 años de antigüedad, 26 de 5 a 10, 35 de 10 a 20 y 44 más de 20. Debe comunicarse con 60 días de anticipación.' },
  { id: 'cct24f', fuente: 'CCT 414/05 art. 24', tema: 'Vacaciones', severidad: 'media',
    titulo: 'Fraccionamiento de vacaciones',
    regla: 'No se fracciona para quien tiene 17 días o menos. Con más de 17 días deben otorgarse 17 continuos y el resto en tramos no inferiores a 7 días corridos, máximo 3 módulos, con conformidad previa y por escrito del trabajador, que debe comunicarlo a ADEF.' },
  { id: 'lct154', fuente: 'LCT art. 154', tema: 'Vacaciones', severidad: 'media',
    titulo: 'Época de otorgamiento',
    regla: 'Las vacaciones se conceden entre el 1 de octubre y el 30 de abril. Cuando no se otorgan a todos a la vez, cada trabajador debe gozarlas al menos una vez cada tres años en temporada de verano.' },
  { id: 'lct157', fuente: 'LCT art. 157', tema: 'Vacaciones', severidad: 'alta',
    titulo: 'Omisión de comunicar las vacaciones',
    regla: 'Si el empleador no comunicó la fecha de inicio, el trabajador puede tomarlas por sí, con notificación fehaciente, de modo que concluyan antes del 31 de mayo.' },
  { id: 'lct162', fuente: 'LCT art. 162 y 156', tema: 'Vacaciones', severidad: 'alta',
    titulo: 'Las vacaciones no se compensan en dinero',
    regla: 'No son compensables en dinero, salvo la indemnización proporcional que corresponde al extinguirse el contrato.' },
  { id: 'cct25',  fuente: 'CCT 414/05 art. 25 · LCT art. 158', tema: 'Licencias', severidad: 'media',
    titulo: 'Licencias especiales pagas',
    regla: 'Matrimonio 15 días corridos (12 con menos de un año); nacimiento o adopción 2 días hábiles; enfermedad de familiares 6 días hábiles al año por hijo y 4 por padres o cónyuge; fallecimiento 4 días hábiles y 6 si residía a más de 500 km; examen 2 días corridos hasta 10 al año; donación de sangre 1 día; mudanza 1 día hábil.' },
  { id: 'cct43',  fuente: 'CCT 414/05 art. 25 inc. h y art. 43', tema: 'Licencias', severidad: 'media',
    titulo: 'Licencias y permisos gremiales',
    regla: 'Capacitación sindical: 21 días corridos anuales pagos para delegados o miembros de comisión directiva convocados por ADEF, no simultáneos entre empleados del mismo establecimiento, fraccionables hasta 3 veces, avisando con 10 días hábiles. Permisos gremiales: hasta 40 horas mensuales pagas, en no más de 8 oportunidades, con preaviso de 48 horas.' },

  /* --- Salud, enfermedad y accidentes --- */
  { id: 'lct208', fuente: 'LCT art. 208', tema: 'Enfermedad', severidad: 'alta',
    titulo: 'Licencia paga por enfermedad inculpable',
    regla: 'Se conserva la remuneración 3 meses con antigüedad menor a 5 años y 6 meses si es mayor. Con cargas de familia, 6 y 12 meses respectivamente. La recidiva de enfermedad crónica no cuenta como nueva salvo que pasen 2 años.' },
  { id: 'lct209', fuente: 'LCT art. 209', tema: 'Enfermedad', severidad: 'media',
    titulo: 'Aviso de la enfermedad',
    regla: 'El trabajador debe avisar en el transcurso de la primera jornada en que no puede concurrir, indicando dónde se encuentra, salvo fuerza mayor.' },
  { id: 'lct210', fuente: 'LCT art. 210', tema: 'Enfermedad', severidad: 'media',
    titulo: 'Certificados médicos y control',
    regla: 'El certificado debe contener diagnóstico, tratamiento y días de reposo, y estar firmado digitalmente por profesional habilitado. El trabajador está obligado a someterse al control del médico designado por el empleador. Ante discrepancia insalvable puede recurrirse a junta médica.' },
  { id: 'lct211', fuente: 'LCT art. 211 y 213', tema: 'Enfermedad', severidad: 'critica',
    titulo: 'Conservación del empleo y despido durante la licencia',
    regla: 'Agotados los plazos pagos, el empleador debe conservar el puesto un año más. Si despide durante las interrupciones pagas, debe los salarios hasta el vencimiento del plazo o el alta, además de las indemnizaciones.' },
  { id: 'lct212', fuente: 'LCT art. 212', tema: 'Enfermedad', severidad: 'alta',
    titulo: 'Reincorporación con capacidad disminuida',
    regla: 'Si queda una disminución definitiva, el empleador debe asignar otras tareas sin reducir la remuneración. Si no puede por causa no imputable, indemniza según el art. 247; si pudiendo no lo hace, según el art. 245. La incapacidad absoluta se indemniza según el art. 245.' },
  { id: 'lct75',  fuente: 'LCT art. 75', tema: 'Seguridad', severidad: 'alta',
    titulo: 'Deber de seguridad',
    regla: 'El empleador debe tutelar la integridad psicofísica y la dignidad del trabajador y observar las normas de higiene y seguridad. El trabajador puede rehusar la prestación, sin pérdida de remuneración, ante peligro inminente de daño.' },
  { id: 'cct37',  fuente: 'CCT 414/05 art. 36 y 37', tema: 'Seguridad', severidad: 'media',
    titulo: 'Indumentaria y condiciones del establecimiento',
    regla: 'Anualmente y de una sola vez: 2 guardapolvos o chaquetillas para atención al público y administración; para laboratorio o depósito además delantal, guantes, mascarillas y anteojos cuando la tarea lo requiera. El empleador debe conservar en buen estado el edificio y proveer servicios sanitarios y vestuarios.' },

  /* --- Maternidad, matrimonio y familia --- */
  { id: 'lct177', fuente: 'LCT art. 177 · CCT 414/05 art. 27', tema: 'Maternidad', severidad: 'critica',
    titulo: 'Licencia por maternidad y estabilidad',
    regla: 'Prohibido el trabajo 45 días antes y 45 después del parto; puede reducirse el tramo previo hasta un mínimo de 10 días acumulando el resto al posterior. El convenio permite ampliar el período total hasta 100 días corridos. Desde la notificación del embarazo la trabajadora tiene estabilidad como derecho adquirido.' },
  { id: 'lct178', fuente: 'LCT art. 178', tema: 'Maternidad', severidad: 'critica',
    titulo: 'Presunción de despido por embarazo',
    regla: 'Se presume que el despido obedece a maternidad o embarazo si se dispone dentro de los 7 meses y medio anteriores o posteriores al parto, habiendo notificado y acreditado el embarazo. Da lugar a la indemnización del art. 182, equivalente a un año de remuneraciones.' },
  { id: 'lct179', fuente: 'LCT art. 179 · CCT 414/05 art. 27', tema: 'Maternidad', severidad: 'alta',
    titulo: 'Descansos por lactancia',
    regla: 'Dos descansos de media hora por jornada durante un año posterior al nacimiento, o más si hay indicación médica. El convenio permite acumularlos al inicio o al final de la jornada. Con el número mínimo de trabajadoras que fije la reglamentación, deben habilitarse salas maternales.' },
  { id: 'lct183', fuente: 'LCT art. 183 y 185 · CCT 414/05 art. 27', tema: 'Maternidad', severidad: 'media',
    titulo: 'Estado de excedencia',
    regla: 'Al terminar la licencia puede optar por continuar, rescindir con la compensación del 25%, o quedar en excedencia entre 3 y 6 meses. Requiere un año de antigüedad. Si no se reincorpora ni comunica dentro de las 48 horas previas, se entiende que optó por la compensación.' },
  { id: 'lct181', fuente: 'LCT art. 180, 181 y 182', tema: 'Matrimonio', severidad: 'critica',
    titulo: 'Despido por causa de matrimonio',
    regla: 'Se presume que el despido responde al matrimonio si se dispone sin causa dentro de los 3 meses anteriores o 6 posteriores, habiendo mediado notificación fehaciente. La indemnización es de un año de remuneraciones y se acumula a la del art. 245.' },
  { id: 'cct26',  fuente: 'CCT 414/05 art. 26', tema: 'Jornada', severidad: 'media',
    titulo: 'Descanso en jornada continua',
    regla: 'La trabajadora que cumple jornada continua tiene un descanso de 30 minutos en medio de la jornada, sin disminución de la retribución. Para mujeres el horario nocturno se considera desde las 21.' },

  /* --- Menores --- */
  { id: 'lct189', fuente: 'LCT art. 189 (Ley 26.390)', tema: 'Menores', severidad: 'critica',
    titulo: 'Edad mínima de admisión al empleo',
    regla: 'Prohibido ocupar personas menores de 16 años en cualquier actividad. Las referencias del convenio a mayores de 14 años quedaron desplazadas por la Ley 26.390.' },
  { id: 'lct190', fuente: 'LCT art. 190 · CCT 414/05 art. 28 a 34', tema: 'Menores', severidad: 'critica',
    titulo: 'Jornada y trabajo nocturno de menores',
    regla: 'De 16 a 18 años: hasta 6 horas diarias y 36 semanales por ley, y 33 semanales por convenio, que es lo más favorable. Prohibido el trabajo nocturno. El convenio además prohíbe ocuparlos los sábados después de las 13, domingos y feriados, salvo turno obligatorio. Vacaciones mínimas de 17 días corridos.' },

  /* --- Disciplina y facultades del empleador --- */
  { id: 'lct67',  fuente: 'LCT art. 67', tema: 'Disciplina', severidad: 'alta',
    titulo: 'Proporcionalidad de la sanción',
    regla: 'La medida disciplinaria debe ser proporcionada a la falta demostrada. El trabajador tiene 30 días corridos desde la notificación para cuestionarla; vencido el plazo se tiene por consentida.' },
  { id: 'lct69',  fuente: 'LCT art. 69', tema: 'Disciplina', severidad: 'alta',
    titulo: 'La sanción no puede modificar el contrato',
    regla: 'No pueden aplicarse sanciones disciplinarias que constituyan una modificación del contrato de trabajo, como cambiar la categoría, el horario o el lugar de prestación.' },
  { id: 'lct218', fuente: 'LCT art. 218 y 219', tema: 'Disciplina', severidad: 'alta',
    titulo: 'Requisitos de validez de la suspensión',
    regla: 'Toda suspensión debe fundarse en justa causa, tener plazo fijo y notificarse por escrito. Sin esos tres requisitos el trabajador puede impugnarla y reclamar los salarios del período.' },
  { id: 'lct220', fuente: 'LCT art. 220 y 222', tema: 'Disciplina', severidad: 'critica',
    titulo: 'Plazos máximos de suspensión',
    regla: 'Las suspensiones disciplinarias o por falta de trabajo no pueden exceder 30 días en un año contado desde la primera. Excedidos los plazos, o 90 días en un año por cualquier causa, el trabajador puede considerarse despedido.' },
  { id: 'lct66',  fuente: 'LCT art. 66', tema: 'Condiciones', severidad: 'alta',
    titulo: 'Cambios en las condiciones de trabajo',
    regla: 'El empleador puede modificar formas y modalidades siempre que no altere modalidades esenciales del contrato ni cause perjuicio material. Si lo hace, el trabajador, previa intimación desoída, puede considerarse despedido sin causa.' },
  { id: 'lct70',  fuente: 'LCT art. 70, 71 y 72', tema: 'Dignidad', severidad: 'alta',
    titulo: 'Controles personales',
    regla: 'Los controles destinados a proteger los bienes del empleador deben salvaguardar la dignidad, practicarse con discreción y por medios de selección automática aplicados a todo el personal. Los controles del personal femenino quedan reservados a personas de su mismo sexo. Los controles deben ser conocidos por el trabajador.' },
  { id: 'lct73',  fuente: 'LCT art. 73', tema: 'Dignidad', severidad: 'critica',
    titulo: 'Prohibición de indagar sobre opiniones personales',
    regla: 'El empleador no puede realizar encuestas, averiguaciones ni indagar sobre opiniones políticas, religiosas, sindicales, culturales o de preferencia sexual, ni al contratar, ni durante la relación, ni con vista a su disolución.' },
  { id: 'lct17',  fuente: 'LCT art. 17, 17 bis y 81 · CCT 414/05 art. 21', tema: 'Dignidad', severidad: 'critica',
    titulo: 'No discriminación e igualdad de trato',
    regla: 'Prohibida toda discriminación por sexo, raza, nacionalidad, religión, política, gremio o edad. El empleador debe dispensar igual trato en identidad de situaciones; el trato diferente solo se justifica por mayor eficacia, laboriosidad o contracción a las tareas.' },
  { id: 'lct245b',fuente: 'LCT art. 245 bis', tema: 'Dignidad', severidad: 'critica',
    titulo: 'Despido discriminatorio',
    regla: 'El despido originado en raza, etnia, religión, nacionalidad, ideología, opinión política o gremial, sexo o género, orientación sexual, posición económica, caracteres físicos o discapacidad genera una indemnización agravada del 50% de la del art. 245, que los jueces pueden elevar hasta el 100%.' },

  /* --- Remuneración y pago --- */
  { id: 'lct124', fuente: 'LCT art. 124 y 125', tema: 'Remuneración', severidad: 'alta',
    titulo: 'Forma de pago',
    regla: 'Las remuneraciones se pagan únicamente mediante acreditación en cuenta sueldo a nombre del trabajador, sin límite de extracciones ni costo alguno para él.' },
  { id: 'lct128', fuente: 'LCT art. 126, 128 y 137', tema: 'Remuneración', severidad: 'alta',
    titulo: 'Plazos de pago',
    regla: 'Vencido el período, el pago debe hacerse dentro de 4 días hábiles para la remuneración mensual o quincenal y 3 para la semanal. La mora se produce por el solo vencimiento del plazo.' },
  { id: 'lct131', fuente: 'LCT art. 131 y 133', tema: 'Remuneración', severidad: 'critica',
    titulo: 'Prohibición de deducciones y multas',
    regla: 'No puede deducirse, retenerse ni compensarse suma alguna que rebaje la remuneración, ni imponerse multas. Las deducciones permitidas no pueden superar en conjunto el 20% del monto en dinero que el trabajador deba percibir.' },
  { id: 'lct140', fuente: 'LCT art. 138, 140 y 145 · CCT 414/05 art. 11', tema: 'Remuneración', severidad: 'media',
    titulo: 'Recibos de sueldo',
    regla: 'El recibo debe discriminar básicos, escalafón, adicionales, horas suplementarias y nocturnas, deducciones y neto, con fecha de ingreso y categoría. No puede contener renuncias ni usarse para instrumentar la extinción o alterar la calificación profesional.' },
  { id: 'lct122', fuente: 'LCT art. 121, 122 y 123', tema: 'Remuneración', severidad: 'media',
    titulo: 'Sueldo anual complementario',
    regla: 'Se abona en dos cuotas, con vencimiento el 30 de junio y el 18 de diciembre, calculadas sobre el 50% de la mayor remuneración mensual devengada en cada semestre.' },
  { id: 'cct39',  fuente: 'CCT 414/05 art. 39', tema: 'Beneficios', severidad: 'info',
    titulo: 'Venta de mercadería al personal',
    regla: 'El empleador está obligado a vender al personal, para uso propio y de familiares directos a cargo, al precio de costo de compra a droguería.' },
  { id: 'cct41',  fuente: 'CCT 414/05 art. 41', tema: 'Feriados', severidad: 'info',
    titulo: 'Día del Empleado de Farmacia',
    regla: 'El 13 de abril es feriado para la actividad, con la LCT aplicable a todos sus efectos. Los recargos por feriados nacionales se pagan cuando la farmacia está de turno obligatorio.' },
  { id: 'cct46',  fuente: 'CCT 414/05 art. 46 y 47 · LCT art. 132 inc. c', tema: 'Remuneración', severidad: 'info',
    titulo: 'Retenciones con destino sindical',
    regla: 'Aporte solidario del 2% mensual sobre las remuneraciones de afiliados y no afiliados, más 1% en junio y diciembre con destino a asistencia social, depositados a la orden de ADEF. Los aportes por servicios sociales requieren consentimiento explícito del empleado.' },

  /* --- Representación gremial --- */
  { id: 'cct42',  fuente: 'CCT 414/05 art. 42 y 44', tema: 'Gremial', severidad: 'media',
    titulo: 'Representación gremial en el establecimiento',
    regla: 'Con 5 empleados corresponde 1 representante; de 16 a 40, dos; de 41 a 80, tres; más de 80, cuatro. El empleador debe instalar una cartelera sindical en lugar visible.' },
  { id: 'lct217', fuente: 'LCT art. 217', tema: 'Gremial', severidad: 'alta',
    titulo: 'Tutela sindical',
    regla: 'Quienes desempeñan cargos gremiales tienen reserva del empleo y no pueden ser despedidos durante los plazos que fija la ley sindical, contados desde la cesación de sus funciones.' },

  /* --- Contratación y extinción --- */
  { id: 'lct92b', fuente: 'LCT art. 92 bis', tema: 'Contratación', severidad: 'alta',
    titulo: 'Período de prueba',
    regla: 'Seis meses, ampliables por convenio hasta 8 meses en empresas de 6 a 100 trabajadores y hasta un año en las de hasta 5. No puede usarse dos veces con el mismo trabajador. Es abusivo contratar sucesivamente a distintos trabajadores para un mismo puesto permanente. Debe registrarse desde el inicio de la relación.' },
  { id: 'lct90',  fuente: 'LCT art. 90 y 92', tema: 'Contratación', severidad: 'alta',
    titulo: 'Indeterminación del plazo',
    regla: 'El contrato se presume por tiempo indeterminado. La prueba de que es a plazo está a cargo del empleador. Los contratos a plazo sucesivos que excedan las exigencias de la tarea lo convierten en indeterminado.' },
  { id: 'lct231', fuente: 'LCT art. 231, 232 y 233', tema: 'Extinción', severidad: 'alta',
    titulo: 'Preaviso',
    regla: 'El trabajador preavisa con 15 días. El empleador con 1 mes hasta 5 años de antigüedad y 2 meses si es mayor. En período de prueba no se requiere preaviso. Omitido, corresponde la indemnización sustitutiva más la integración del mes de despido.' },
  { id: 'lct240', fuente: 'LCT art. 240', tema: 'Extinción', severidad: 'alta',
    titulo: 'Forma de la renuncia',
    regla: 'La renuncia solo es válida por despacho telegráfico, físico o digital, cursado por el trabajador, o ante la autoridad administrativa del trabajo. Una renuncia firmada en la tienda no cumple la forma.' },
  { id: 'lct241', fuente: 'LCT art. 241', tema: 'Extinción', severidad: 'alta',
    titulo: 'Extinción por mutuo acuerdo',
    regla: 'Debe formalizarse por escritura pública o ante la autoridad judicial o administrativa del trabajo. Es nulo el acto celebrado sin la presencia personal del trabajador.' },
  { id: 'lct242', fuente: 'LCT art. 242 y 243', tema: 'Extinción', severidad: 'critica',
    titulo: 'Despido con justa causa',
    regla: 'Requiere injuria que por su gravedad no consienta la prosecución de la relación. Debe comunicarse por escrito con expresión suficientemente clara de los motivos, y la causal no puede modificarse después.' },
  { id: 'lct244', fuente: 'LCT art. 244', tema: 'Extinción', severidad: 'critica',
    titulo: 'Abandono de trabajo',
    regla: 'Solo se configura previa constitución en mora, mediante intimación fehaciente a reintegrarse por el plazo que impongan las circunstancias. Sin intimación previa no hay abandono.' },
  { id: 'lct245', fuente: 'LCT art. 245', tema: 'Extinción', severidad: 'alta',
    titulo: 'Indemnización por antigüedad',
    regla: 'Un mes de sueldo por año de servicio o fracción mayor de 3 meses, sobre la mejor remuneración mensual, normal y habitual del último año. Se excluyen conceptos de pago no mensual como aguinaldo y vacaciones. Los conceptos variables se promedian en los últimos 6 meses.' },
  { id: 'lct80',  fuente: 'LCT art. 80 · CCT 414/05 art. 40', tema: 'Extinción', severidad: 'alta',
    titulo: 'Certificados de trabajo',
    regla: 'Dentro de los 45 días hábiles de extinguido el contrato deben entregarse los certificados con los datos de la relación, la función, las capacitaciones y la constancia de aportes. El convenio obliga además a otorgarlos cada vez que el trabajador los requiera durante la relación.' },
  { id: 'lct52',  fuente: 'LCT art. 52 y 55', tema: 'Registración', severidad: 'critica',
    titulo: 'Registración del trabajador',
    regla: 'Los empleadores deben registrar a los trabajadores ante ARCA. La falta de registración constituye presunción a favor de las manifestaciones del trabajador sobre lo que debió constar en el registro.' },
  { id: 'lct57',  fuente: 'LCT art. 57 y 58', tema: 'Comunicaciones', severidad: 'alta',
    titulo: 'Silencio ante una intimación',
    regla: 'El silencio del empleador ante una intimación fehaciente del trabajador constituye presunción en su contra. El plazo razonable nunca es inferior a 2 días hábiles. No se admiten presunciones de renuncia derivadas del silencio del trabajador.' },
  { id: 'lct252', fuente: 'LCT art. 252', tema: 'Extinción', severidad: 'media',
    titulo: 'Intimación a jubilarse',
    regla: 'Recién a partir de los 70 años y reuniendo los requisitos de la PBU el empleador puede intimar a iniciar los trámites, manteniendo la relación hasta que se obtenga el beneficio y por un máximo de un año.' },
  { id: 'lct256', fuente: 'LCT art. 256', tema: 'Comunicaciones', severidad: 'info',
    titulo: 'Prescripción',
    regla: 'Las acciones por créditos laborales prescriben a los 2 años. Es norma de orden público y el plazo no puede modificarse por convenciones individuales ni colectivas.' }
];

const NORMAS_POR_ID = NORMAS.reduce((m, n) => { m[n.id] = n; return m; }, {});
const TEMAS_NORMATIVA = Array.from(new Set(NORMAS.map(n => n.tema))).sort();

/* ------------------------------------------------------------------ *
 * 5. Situaciones que el coordinador releva en la visita                *
 *    Cada tipo define qué dato numérico pide y cómo se evalúa.         *
 * ------------------------------------------------------------------ */
const TIPOS_CASO = [
  { id: 'jornada',       nombre: 'Jornada de trabajo',                 campo: 'Horas por semana' },
  { id: 'jornadaDiaria', nombre: 'Jornada diaria extendida',           campo: 'Horas en el día' },
  { id: 'nocturno',      nombre: 'Trabajo nocturno',                   campo: 'Horas nocturnas por semana' },
  { id: 'descansoEntre', nombre: 'Descanso entre jornadas',            campo: 'Horas entre turno y turno' },
  { id: 'horasExtras',   nombre: 'Horas extras',                       campo: 'Horas extras en el mes' },
  { id: 'francos',       nombre: 'Descanso semanal o francos',         campo: 'Francos adeudados' },
  { id: 'vacaciones',    nombre: 'Vacaciones',                         campo: 'Días otorgados' },
  { id: 'enfermedad',    nombre: 'Enfermedad inculpable',              campo: 'Días de licencia acumulados' },
  { id: 'accidente',     nombre: 'Accidente de trabajo o ART',         campo: 'Días de licencia' },
  { id: 'maternidad',    nombre: 'Embarazo o maternidad',              campo: 'Días de licencia previstos' },
  { id: 'matrimonio',    nombre: 'Matrimonio',                         campo: 'Días de licencia otorgados' },
  { id: 'licenciaEsp',   nombre: 'Otra licencia especial',             campo: 'Días otorgados' },
  { id: 'suspension',    nombre: 'Suspensión',                         campo: 'Días de suspensión en el año' },
  { id: 'sancion',       nombre: 'Sanción disciplinaria',              campo: 'Días desde la notificación' },
  { id: 'reemplazo',     nombre: 'Reemplazo en categoría superior',    campo: 'Meses de reemplazo continuo' },
  { id: 'categoria',     nombre: 'Encuadre o categoría en discusión',  campo: '' },
  { id: 'periodoPrueba', nombre: 'Período de prueba',                  campo: 'Meses transcurridos' },
  { id: 'menor',         nombre: 'Trabajador menor de 18 años',        campo: 'Edad' },
  { id: 'remuneracion',  nombre: 'Reclamo salarial o de recibo',       campo: '' },
  { id: 'descuento',     nombre: 'Descuento sobre el sueldo',          campo: 'Porcentaje descontado' },
  { id: 'egreso',        nombre: 'Renuncia, despido o acuerdo',        campo: 'Días de preaviso otorgados' },
  { id: 'gremial',       nombre: 'Tema gremial o delegados',           campo: '' },
  { id: 'clima',         nombre: 'Clima, trato o conflicto',           campo: '' },
  { id: 'seguridad',     nombre: 'Higiene, seguridad o indumentaria',  campo: '' },
  { id: 'otro',          nombre: 'Otro',                               campo: '' }
];

const TIPOS_CASO_POR_ID = TIPOS_CASO.reduce((m, t) => { m[t.id] = t; return m; }, {});

/* Evaluadores por tipo. Reciben el caso y devuelven alertas.
   caso: { colaborador, posicion, tipo, valor, antiguedadAnios, cargasFamilia, notas } */
const EVALUADORES = {
  jornada(c, a) {
    if (c.valor > 45) a('cct14', 'critica', `${c.valor} horas semanales superan el máximo de 45 del convenio.`);
    else if (c.valor > 0 && c.valor < 30) a('cct14pt', 'media', `${c.valor} horas semanales quedan por debajo de dos tercios de la jornada: se encuadra como tiempo parcial, sin horas extras ni cambios de horario.`);
  },
  jornadaDiaria(c, a) {
    if (c.valor > 8) a('cct14', 'critica', `${c.valor} horas en el día superan el máximo de 8 diarias del convenio.`);
  },
  nocturno(c, a) {
    if (c.valor > 42) a('cct16', 'critica', `${c.valor} horas nocturnas semanales superan el máximo de 42.`);
    a('cct17', 'alta', 'Verificar si el turno es voluntario (recargo del 100% sobre el básico) u obligatorio dispuesto por la autoridad sanitaria (sin recargo).');
  },
  descansoEntre(c, a) {
    if (c.valor > 0 && c.valor < 12) a('lct197', 'critica', `Solo ${c.valor} horas entre jornadas; el mínimo legal es 12.`);
  },
  horasExtras(c, a) {
    a('lct201', 'alta', 'Verificar el recargo: 50% en días comunes y 100% los sábados después de las 13, domingos y feriados.');
    a('lct203', 'media', 'Las horas extras no son obligatorias para el trabajador salvo peligro, fuerza mayor o exigencia excepcional.');
    if (c.valor >= 30) a('cct14', 'alta', `${c.valor} horas extras en el mes. Revisar si el exceso encubre un déficit estructural de dotación.`);
  },
  francos(c, a) {
    a('lct204', 'alta', 'Si no se otorgó el descanso compensatorio, el trabajador puede tomarlo avisando con 24 horas y el franco se paga con 100% de recargo.');
  },
  vacaciones(c, a) {
    const v = vacacionesQueCorresponden(c.antiguedadAnios);
    if (c.valor > 0 && c.valor < v.aplicable) {
      a('cct24', 'critica', `Con ${c.antiguedadAnios} años de antigüedad corresponden ${v.aplicable} días por convenio (la ley fija ${v.lct}); se otorgaron ${c.valor}.`);
    } else if (c.valor > 0) {
      a('cct24', 'info', `Con ${c.antiguedadAnios} años corresponden ${v.aplicable} días. Los ${c.valor} otorgados cumplen.`);
    }
    a('cct24f', 'media', 'Si se fracciona: 17 días continuos como mínimo, tramos de al menos 7 días, hasta 3 módulos, con conformidad escrita del trabajador y aviso a ADEF.');
    a('cct24', 'media', 'Comunicar la fecha de inicio con 60 días de anticipación.');
  },
  enfermedad(c, a) {
    const meses = mesesLicenciaEnfermedad(c.antiguedadAnios, c.cargasFamilia);
    const tope = meses * 30;
    if (c.valor >= tope) {
      a('lct211', 'critica', `${c.valor} días acumulados alcanzan el tope de licencia paga (${meses} meses / ${tope} días). Vencido el plazo corre el año de conservación del empleo, sin obligación de pagar salarios.`);
    } else if (c.valor >= tope * 0.75) {
      a('lct208', 'alta', `${c.valor} días acumulados sobre un tope de ${tope}. Anticipar el vencimiento de la licencia paga.`);
    } else {
      a('lct208', 'info', `Corresponden ${meses} meses de licencia paga (${tope} días) según antigüedad y cargas de familia.`);
    }
    a('lct210', 'media', 'El certificado debe tener diagnóstico, tratamiento y días de reposo. El trabajador está obligado a aceptar el control médico del empleador.');
    a('lct211', 'alta', 'Mientras dure la licencia paga no corresponde despedir: además de las indemnizaciones se deberían los salarios hasta el alta o el vencimiento del plazo.');
  },
  accidente(c, a) {
    a('lct75', 'alta', 'Verificar la denuncia a la ART y las medidas de prevención sobre la causa del accidente.');
    a('lct212', 'alta', 'Si queda una disminución definitiva, hay que asignar tareas acordes sin reducir la remuneración.');
  },
  maternidad(c, a) {
    a('lct177', 'alta', 'Desde la notificación del embarazo la trabajadora tiene estabilidad como derecho adquirido. Licencia de 45 días antes y 45 después, reducible el tramo previo hasta 10 días; el convenio permite llegar a 100 días corridos.');
    a('lct178', 'critica', 'No disponer el despido dentro de los 7 meses y medio anteriores o posteriores al parto: se presume causado por la maternidad y la indemnización es de un año de remuneraciones.');
    a('lct179', 'alta', 'Al reintegrarse: dos descansos de media hora por lactancia durante un año, acumulables al inicio o al final de la jornada.');
    if (c.antiguedadAnios >= 1) a('lct183', 'media', 'Con un año de antigüedad puede optar por excedencia de 3 a 6 meses. Si no se reincorpora ni avisa 48 horas antes, se entiende que optó por la compensación del 25%.');
  },
  matrimonio(c, a) {
    const corresponde = c.antiguedadAnios >= 1 ? 15 : 12;
    if (c.valor > 0 && c.valor < corresponde) {
      a('cct25', 'alta', `Corresponden ${corresponde} días corridos por convenio (la ley fija 10); se otorgaron ${c.valor}.`);
    } else {
      a('cct25', 'info', `Corresponden ${corresponde} días corridos por convenio, acumulables a la licencia anual a pedido del trabajador.`);
    }
    a('lct181', 'critica', 'No disponer el despido sin causa dentro de los 3 meses anteriores ni los 6 posteriores al matrimonio notificado: la indemnización es de un año de remuneraciones y se acumula a la del art. 245.');
  },
  licenciaEsp(c, a) {
    a('cct25', 'media', 'Contrastar con la tabla del convenio, que mejora la ley en varios rubros: fallecimiento 4 días hábiles, enfermedad de familiares 6 días al año por hijo y 4 por padres o cónyuge, donación de sangre y mudanza 1 día.');
  },
  suspension(c, a) {
    a('lct218', 'alta', 'Verificar los tres requisitos: justa causa, plazo fijo y notificación por escrito. Sin alguno, el trabajador puede impugnarla y reclamar los salarios.');
    if (c.valor > 30) a('lct220', 'critica', `${c.valor} días de suspensión en el año superan el máximo de 30. El trabajador puede considerarse despedido.`);
    else if (c.valor >= 20) a('lct220', 'alta', `${c.valor} días acumulados sobre un máximo de 30 en el año.`);
    a('lct67', 'media', 'El trabajador tiene 30 días corridos desde la notificación para cuestionar la medida.');
  },
  sancion(c, a) {
    a('lct67', 'alta', 'La sanción debe ser proporcionada a la falta demostrada. El trabajador tiene 30 días corridos para cuestionarla.');
    a('lct69', 'alta', 'La sanción no puede consistir en un cambio de categoría, horario o lugar de trabajo: eso sería modificar el contrato.');
    if (c.valor > 0 && c.valor <= 30) a('lct67', 'info', `Pasaron ${c.valor} días desde la notificación: el plazo de impugnación sigue abierto.`);
  },
  reemplazo(c, a) {
    if (c.valor >= 3) {
      a('cct10', 'critica', `${c.valor} meses de reemplazo continuo. Superados los 3 meses continuos o 4 discontinuos en el año aniversario, queda definitivamente en la categoría superior, salvo que el reemplazo sea por enfermedad o maternidad del reemplazado.`);
    } else {
      a('cct10', 'alta', `${c.valor} meses de reemplazo. Debe cobrar la remuneración de la categoría superior desde el primer día, y a los 3 meses continuos la recategorización pasa a ser definitiva.`);
    }
  },
  categoria(c, a) {
    a('cct10', 'alta', 'Revisar el encuadre real contra las tareas efectivamente cumplidas y la prioridad del personal interno para cubrir vacantes.');
    a('cct13', 'media', 'Verificar que el escalafón por antigüedad esté aplicado sobre el básico de la categoría.');
    a('cct18', 'media', 'Verificar los adicionales que correspondan a la categoría y al título.');
  },
  periodoPrueba(c, a) {
    if (c.valor > 6) a('lct92b', 'critica', `${c.valor} meses superan los 6 del período de prueba legal. La ampliación por convenio solo procede en empresas de hasta 100 trabajadores.`);
    else a('lct92b', 'alta', `${c.valor} de 6 meses. No puede usarse el período de prueba dos veces con el mismo trabajador, y la registración debe existir desde el inicio de la relación.`);
  },
  menor(c, a) {
    if (c.valor > 0 && c.valor < 16) a('lct189', 'critica', `${c.valor} años: está prohibido ocupar personas menores de 16 años en cualquier actividad.`);
    a('lct190', 'critica', 'De 16 a 18 años: máximo 6 horas diarias y 33 semanales por convenio. Prohibido el trabajo nocturno, y los sábados después de las 13, domingos y feriados salvo turno obligatorio. Vacaciones mínimas de 17 días.');
  },
  remuneracion(c, a) {
    a('lct140', 'alta', 'El recibo debe discriminar básico, escalafón, adicionales, horas suplementarias y nocturnas, y no puede contener renuncias.');
    a('lct128', 'alta', 'El pago vence a los 4 días hábiles del cierre del período mensual o quincenal. La mora se produce por el solo vencimiento.');
    a('cct13', 'media', 'Verificar el escalafón por antigüedad y los adicionales del art. 18 del convenio.');
  },
  descuento(c, a) {
    a('lct131', 'critica', 'No puede deducirse, retenerse ni compensarse suma alguna que rebaje la remuneración, ni imponerse multas al trabajador.');
    if (c.valor > 20) a('lct131', 'critica', `Un descuento del ${c.valor}% supera el tope del 20% que fija el art. 133.`);
    a('cct19', 'alta', 'Si se trata de una falla de caja, el mecanismo previsto es el fondo compensador del 10% del art. 19, no el descuento del sueldo.');
  },
  egreso(c, a) {
    const meses = mesesPreaviso(c.antiguedadAnios);
    a('lct231', 'alta', `Con ${c.antiguedadAnios} años de antigüedad el preaviso a cargo del empleador es de ${meses} ${meses === 1 ? 'mes' : 'meses'}. Omitido, corresponde la indemnización sustitutiva más la integración del mes de despido.`);
    a('lct240', 'alta', 'Si es renuncia, solo vale por telegrama del trabajador o ante la autoridad administrativa. Una nota firmada en la tienda no cumple la forma.');
    a('lct241', 'alta', 'Si es acuerdo de partes, debe hacerse por escritura pública o ante la autoridad judicial o administrativa, con presencia personal del trabajador.');
    a('lct80', 'alta', 'Entregar los certificados de trabajo dentro de los 45 días hábiles de la extinción.');
  },
  gremial(c, a) {
    a('cct42', 'media', 'Verificar la cantidad de representantes que corresponde a la dotación y la cartelera sindical en lugar visible.');
    a('cct43', 'media', 'Permisos gremiales: hasta 40 horas mensuales pagas, en no más de 8 oportunidades, con preaviso de 48 horas.');
    a('lct217', 'alta', 'Quienes ocupan cargos gremiales tienen tutela: reserva del empleo y protección contra el despido.');
  },
  clima(c, a) {
    a('lct17', 'alta', 'Verificar que no haya trato desigual en identidad de situaciones ni discriminación de ningún tipo.');
    a('lct75', 'alta', 'El deber de seguridad alcanza la integridad psicofísica y la dignidad del trabajador.');
    a('lct73', 'media', 'No indagar sobre opiniones políticas, religiosas, sindicales, culturales ni de preferencia sexual.');
  },
  seguridad(c, a) {
    a('lct75', 'alta', 'Deber de seguridad: adoptar las medidas necesarias según el tipo de trabajo y cumplir las normas de higiene y seguridad.');
    a('cct37', 'media', 'Indumentaria anual y elementos de protección según la tarea; conservación del edificio, sanitarios y vestuarios.');
  },
  otro(c, a) {}
};

/* ------------------------------------------------------------------ *
 * 6. Detección de temas en texto libre                                 *
 *    Las minutas y el feedback se escanean por palabra clave. Esto     *
 *    señala qué norma mirar; no interpreta los hechos.                 *
 * ------------------------------------------------------------------ */
const normalizar = t => String(t || '')
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const PATRONES = [
  { re: /falla de caja|faltante de caja|diferencia de caja|arqueo/,            normas: ['cct19', 'lct131'], tema: 'Falla de caja' },
  { re: /descuent\w* (del|de) sueldo|se le descuenta|multa|descontar/,          normas: ['lct131'],          tema: 'Descuentos sobre el salario' },
  { re: /embaraz|gestante|maternidad|licencia por parto/,                       normas: ['lct177', 'lct178', 'lct183'], tema: 'Embarazo y maternidad' },
  { re: /lactancia|amamant/,                                                    normas: ['lct179'],          tema: 'Lactancia' },
  { re: /matrimonio|se casa|casamiento|boda/,                                   normas: ['cct25', 'lct181'], tema: 'Matrimonio' },
  { re: /renuncia|renuncio|renunciar/,                                          normas: ['lct240'],          tema: 'Renuncia' },
  { re: /abandono de (trabajo|puesto)|no vino mas|dejo de venir/,                normas: ['lct244'],          tema: 'Abandono de trabajo' },
  { re: /despid|desvincul|echar|cesantia/,                                      normas: ['lct242', 'lct231', 'lct245'], tema: 'Extinción del contrato' },
  { re: /acuerdo de partes|mutuo acuerdo|retiro voluntario/,                     normas: ['lct241'],          tema: 'Extinción por acuerdo' },
  { re: /suspensi|suspend/,                                                     normas: ['lct218', 'lct220'], tema: 'Suspensiones' },
  { re: /apercibimiento|llamado de atencion|sancion|acta de/,                    normas: ['lct67', 'lct69'],  tema: 'Medidas disciplinarias' },
  { re: /horas? extra|hs\.? extra|sobretiempo|se quedo hasta/,                   normas: ['lct201', 'lct203'],tema: 'Horas extras' },
  { re: /franco|descanso semanal|trabajo el domingo|domingo/,                    normas: ['lct204'],          tema: 'Descanso semanal' },
  { re: /feriado|13 de abril|dia del empleado/,                                  normas: ['cct41', 'lct204'], tema: 'Feriados' },
  { re: /nocturn|turno noche|de 21 a|madrugada/,                                 normas: ['cct16', 'cct17'],  tema: 'Trabajo nocturno' },
  { re: /vacacion|licencia anual/,                                              normas: ['cct24', 'lct154', 'lct157'], tema: 'Vacaciones' },
  { re: /carpeta medica|certificado medico|enfermo|enfermedad|reposo/,           normas: ['lct208', 'lct210', 'lct211'], tema: 'Enfermedad inculpable' },
  { re: /\bart\b|accidente|riesgos del trabajo|se lastimo|se cayo/,              normas: ['lct75', 'lct212'], tema: 'Accidentes y ART' },
  { re: /acoso|hostigamiento|maltrato|violencia laboral|gritos|humill/,          normas: ['lct75', 'lct17'],  tema: 'Trato y violencia laboral' },
  { re: /discrimin|preferencia sexual|orientacion sexual|por ser mujer|por su edad/, normas: ['lct17', 'lct245b'], tema: 'Discriminación' },
  { re: /camara|filmac|requisa|control de bolso|revisar el bolso|cacheo/,         normas: ['lct70'],           tema: 'Controles personales' },
  { re: /religion|politic|afiliacion sindical|milita/,                           normas: ['lct73'],           tema: 'Opiniones personales' },
  { re: /delegad|gremial|sindicato|adef|paro|asamblea/,                          normas: ['cct42', 'cct43', 'lct217'], tema: 'Actividad gremial' },
  { re: /recategoriz|cambio de categoria|esta cubriendo|hace de|reemplaz/,        normas: ['cct10'],           tema: 'Categorías y reemplazos' },
  { re: /menor de edad|tiene 17|tiene 16|es menor/,                              normas: ['lct189', 'lct190'],tema: 'Trabajo de menores' },
  { re: /guardapolvo|chaquetilla|ropa de trabajo|uniforme|calzado/,              normas: ['cct37'],           tema: 'Indumentaria' },
  { re: /recibo de sueldo|no le pagaron|pago fuera de termino|cobro tarde|deposito/, normas: ['lct124', 'lct128', 'lct140'], tema: 'Pago de haberes' },
  { re: /periodo de prueba/,                                                    normas: ['lct92b'],          tema: 'Período de prueba' },
  { re: /telegrama|carta documento|intimacion|intimo/,                           normas: ['lct57', 'lct243'], tema: 'Comunicaciones fehacientes' },
  { re: /jubila/,                                                               normas: ['lct252'],          tema: 'Jubilación' },
  { re: /cambio de horario|cambio de turno|traslado|lo mandamos a|cambiarle el/, normas: ['lct66'],           tema: 'Cambios en las condiciones' },
  { re: /tiempo parcial|part.?time|media jornada|reduccion de jornada/,           normas: ['cct14pt'],         tema: 'Jornada a tiempo parcial' },
  { re: /direccion tecnica|bloqueo de titulo|farmaceutico auxiliar/,              normas: ['cct18'],           tema: 'Adicionales del farmacéutico' },
  { re: /antiguedad|escalafon/,                                                 normas: ['cct13'],           tema: 'Antigüedad' },
  { re: /insalubr|toxic|laboratorio/,                                           normas: ['cct15'],           tema: 'Tareas insalubres' },
  { re: /sin registrar|en negro|no esta de alta|sin recibo/,                     normas: ['lct52'],           tema: 'Registración' },
  { re: /aguinaldo|sac\b/,                                                      normas: ['lct122'],          tema: 'Aguinaldo' },
  { re: /doce horas|entre turno|cerro y abrio|cierre y apertura/,                normas: ['lct197'],          tema: 'Descanso entre jornadas' }
];

/** Escanea texto libre y devuelve alertas de tipo "revisar". */
function escanearTexto(texto, origen) {
  const t = normalizar(texto);
  if (!t.trim()) return [];
  const vistas = new Set();
  const salida = [];
  PATRONES.forEach(p => {
    if (!p.re.test(t)) return;
    p.normas.forEach(id => {
      const clave = id + '|' + origen;
      if (vistas.has(clave)) return;
      vistas.add(clave);
      const n = NORMAS_POR_ID[id];
      if (!n) return;
      salida.push({
        normaId: id, fuente: n.fuente, titulo: n.titulo, regla: n.regla,
        severidad: 'media', origen,
        mensaje: `Se menciona ${p.tema.toLowerCase()} en ${origen}. Verificar contra ${n.fuente}.`
      });
    });
  });
  return salida;
}

/* ------------------------------------------------------------------ *
 * 7. Motor de alertas de la visita                                     *
 * ------------------------------------------------------------------ */

const ORDEN_SEVERIDAD = { critica: 0, alta: 1, media: 2, info: 3 };

const ETIQUETA_SEVERIDAD = {
  critica: 'Crítica',
  alta:    'Alta',
  media:   'Revisar',
  info:    'Referencia'
};

/** Evalúa un caso relevado y devuelve sus alertas. */
function evaluarCaso(caso) {
  const alertas = [];
  const agregar = (normaId, severidad, mensaje) => {
    const n = NORMAS_POR_ID[normaId];
    if (!n) return;
    alertas.push({
      normaId, fuente: n.fuente, titulo: n.titulo, regla: n.regla,
      severidad, mensaje,
      origen: `caso de ${caso.colaborador || 'colaborador sin nombre'}`,
      colaborador: caso.colaborador || '',
      casoId: caso.id
    });
  };

  const ctx = {
    ...caso,
    valor: num(caso.valor),
    antiguedadAnios: num(caso.antiguedadAnios),
    cargasFamilia: !!caso.cargasFamilia
  };

  const fn = EVALUADORES[caso.tipo];
  if (fn) fn(ctx, agregar);

  // Las notas del caso también se escanean
  escanearTexto(caso.notas, `notas del caso de ${caso.colaborador || 'un colaborador'}`)
    .forEach(x => alertas.push(Object.assign({ colaborador: caso.colaborador || '', casoId: caso.id }, x)));

  return alertas;
}

/**
 * Evalúa la visita completa: encuadre de la sucursal, datos numéricos de la
 * matriz, casos relevados y texto libre de las minutas.
 *
 * @param {object} v       visita
 * @param {object} s       sucursal
 * @param {object} config  configuración del tablero
 * @param {object} calc    resultado de Reporte.calcular
 */
function evaluarVisita(v, s, config, calc) {
  const alertas = [];
  const cfg = (config && config.normativa) || {};
  const push = (normaId, severidad, mensaje, origen, extra) => {
    const n = NORMAS_POR_ID[normaId];
    if (!n) return;
    alertas.push(Object.assign({
      normaId, fuente: n.fuente, titulo: n.titulo, regla: n.regla,
      severidad, mensaje, origen: origen || 'datos de la visita'
    }, extra || {}));
  };

  /* --- Ámbito del convenio --- */
  if (cfg.aplicaCCT414 !== false) {
    const j = (s.jurisdiccion || '').trim();
    if (!j) {
      push('cct3', 'alta', 'La sucursal no tiene jurisdicción cargada. Sin ese dato no se puede confirmar que el CCT 414/05 le sea aplicable.', 'ficha de la sucursal');
    } else if (!JURISDICCIONES_CCT414.some(x => normalizar(x) === normalizar(j))) {
      push('cct3', 'critica', `“${j}” no figura entre las jurisdicciones del art. 3 del CCT 414/05, y los convenios no admiten aplicación analógica. Verificar qué convenio corresponde antes de usar estas alertas.`, 'ficha de la sucursal');
    }
  }

  /* --- Horas extras de la matriz --- */
  const t = calc.matriz.total;
  if (t.horasExtras > 0) {
    push('lct201', 'alta',
      `La tienda registró ${t.horasExtras} horas extras en el período. Verificar el recargo del 50%, y del 100% en sábados después de las 13, domingos y feriados.`,
      'matriz de FTE');
  }
  calc.matriz.filas.forEach(f => {
    if (!f.heads) return;
    const horasSemana = f.horasExtras / f.heads / 4.33;   // 4,33 semanas por mes
    if (45 + horasSemana > 48) {
      const fmt = n => n.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      push('cct14', 'alta',
        `${f.rol}: las horas extras equivalen a ${fmt(horasSemana)} horas semanales promedio por persona. Sumadas a las 45 del convenio superan el tope legal de 48. El promedio esconde los casos individuales: revisar quién concentra el sobretiempo.`,
        'matriz de FTE');
    }
  });

  /* --- Vacaciones cargadas en el ausentismo --- */
  const diasVac = num((v.ausentismo && v.ausentismo.detalle || {})['071']);
  if (diasVac > 0) {
    push('cct24', 'media',
      `${diasVac} días de vacaciones en el período. El convenio otorga 17, 26, 35 o 44 días según antigüedad, por encima de la ley, y exige comunicar el inicio con 60 días.`,
      'ausentismo');
  }

  /* --- Suspensiones cargadas en el ausentismo --- */
  const diasSusp = num((v.ausentismo && v.ausentismo.detalle || {})['083']);
  if (diasSusp > 0) {
    push('lct218', 'alta',
      `${diasSusp} días de suspensión en el período. Cada una debe tener justa causa, plazo fijo y notificación por escrito.`,
      'ausentismo');
    if (diasSusp > 30) {
      push('lct220', 'critica',
        `${diasSusp} días superan el máximo de 30 en el año por causas disciplinarias o falta de trabajo.`,
        'ausentismo');
    }
  }

  /* --- Ausencias sin aviso --- */
  const sinAviso = num((v.ausentismo && v.ausentismo.detalle || {})['081']);
  if (sinAviso > 0) {
    push('lct244', 'alta',
      `${sinAviso} días de ausencia sin aviso. Si se evalúa abandono de trabajo, hace falta intimación fehaciente previa a reintegrarse: sin esa intimación no se configura.`,
      'ausentismo');
  }

  /* --- Sanciones --- */
  (v.sanciones || []).forEach(sc => {
    if (!sc.nombre && !sc.motivo) return;
    if (normalizar(sc.motivo).includes('falla de caja')) {
      push('cct19', 'critica',
        `Sanción a ${sc.nombre || 'un colaborador'} por falla de caja. El convenio prevé un fondo compensador del 10% del básico para cubrir faltantes, y la ley prohíbe descontarlos del sueldo o imponer multas.`,
        'sanciones', { colaborador: sc.nombre || '' });
    }
    if (normalizar(sc.tipo).includes('suspension')) {
      push('lct218', 'alta',
        `Suspensión a ${sc.nombre || 'un colaborador'}: verificar justa causa, plazo fijo y notificación por escrito.`,
        'sanciones', { colaborador: sc.nombre || '' });
    }
    push('lct67', 'media',
      `${sc.nombre || 'Colaborador'}: la sanción debe ser proporcionada a la falta y el trabajador tiene 30 días corridos para cuestionarla.`,
      'sanciones', { colaborador: sc.nombre || '' });
  });

  /* --- Movimientos de alta y baja --- */
  (v.movimientos || []).forEach(m => {
    if (m.tipo !== 'baja') return;
    const motivo = normalizar(m.motivo);
    if (motivo.includes('renuncia') || m.categoria === 'renuncias') {
      push('lct240', 'alta',
        `Baja de ${m.nombre || 'un colaborador'} por renuncia: solo es válida por telegrama del trabajador o ante la autoridad administrativa.`,
        'altas y bajas', { colaborador: m.nombre || '' });
    }
    if (motivo.includes('abandono')) {
      push('lct244', 'critica',
        `Baja de ${m.nombre || 'un colaborador'} por abandono: requiere intimación fehaciente previa a reintegrarse.`,
        'altas y bajas', { colaborador: m.nombre || '' });
    }
    if (m.categoria === 'despidos') {
      push('lct242', 'alta',
        `Despido de ${m.nombre || 'un colaborador'}: la causa debe comunicarse por escrito con expresión clara de los motivos y no puede modificarse después.`,
        'altas y bajas', { colaborador: m.nombre || '' });
    }
    if (motivo.includes('prueba')) {
      push('lct92b', 'media',
        `Baja de ${m.nombre || 'un colaborador'} en período de prueba: verificar que no se haya usado antes con la misma persona y que la registración exista desde el inicio.`,
        'altas y bajas', { colaborador: m.nombre || '' });
    }
    push('lct80', 'media',
      `Entregar a ${m.nombre || 'el colaborador'} los certificados de trabajo dentro de los 45 días hábiles de la extinción.`,
      'altas y bajas', { colaborador: m.nombre || '' });
  });

  /* --- Representación gremial según dotación --- */
  const dotacion = t.heads;
  if (dotacion >= 5) {
    const d = delegadosQueCorresponden(dotacion);
    push('cct42', 'media',
      `Con ${dotacion} empleados corresponden ${d} representante${d === 1 ? '' : 's'} gremial${d === 1 ? '' : 'es'} y cartelera sindical en lugar visible.`,
      'dotación');
  }

  /* --- Casos relevados --- */
  (v.casos || []).forEach(c => { evaluarCaso(c).forEach(x => alertas.push(x)); });

  /* --- Texto libre de las minutas --- */
  escanearTexto(v.minutaGerente && v.minutaGerente.puntos, 'la reunión con el Gerente de Tienda').forEach(x => alertas.push(x));
  escanearTexto(v.minutaGerente && v.minutaGerente.acuerdos, 'los acuerdos con el Gerente de Tienda').forEach(x => alertas.push(x));
  escanearTexto(v.minutaColaborador && v.minutaColaborador.feedback, 'la entrevista con el colaborador').forEach(x => {
    alertas.push(Object.assign({ colaborador: (v.minutaColaborador && v.minutaColaborador.nombre) || '' }, x));
  });
  escanearTexto(v.diagnostico && v.diagnostico.hallazgos, 'los hallazgos del diagnóstico').forEach(x => alertas.push(x));

  /* Deduplicación: misma norma, mismo origen y mismo colaborador */
  const vistas = new Set();
  const unicas = alertas.filter(a => {
    const k = [a.normaId, a.origen, a.colaborador || '', a.mensaje].join('|');
    if (vistas.has(k)) return false;
    vistas.add(k);
    return true;
  });

  unicas.sort((a, b) => (ORDEN_SEVERIDAD[a.severidad] - ORDEN_SEVERIDAD[b.severidad]) ||
                        a.fuente.localeCompare(b.fuente));

  return {
    alertas: unicas,
    conteo: {
      critica: unicas.filter(a => a.severidad === 'critica').length,
      alta:    unicas.filter(a => a.severidad === 'alta').length,
      media:   unicas.filter(a => a.severidad === 'media').length,
      info:    unicas.filter(a => a.severidad === 'info').length
    },
    accionables: unicas.filter(a => a.severidad === 'critica' || a.severidad === 'alta').length
  };
}

/** Búsqueda libre sobre el catálogo, para la consulta rápida. */
function buscarNormas(consulta) {
  const q = normalizar(consulta).trim();
  if (!q) return [];
  const terminos = q.split(/\s+/).filter(x => x.length > 2);
  const porPatron = escanearTexto(consulta, 'la consulta').map(a => NORMAS_POR_ID[a.normaId]).filter(Boolean);
  const porTexto = NORMAS.filter(n => {
    const heno = normalizar(n.titulo + ' ' + n.regla + ' ' + n.fuente + ' ' + n.tema);
    return terminos.length && terminos.every(t => heno.includes(t));
  });
  const vistas = new Set();
  return porPatron.concat(porTexto).filter(n => {
    if (vistas.has(n.id)) return false;
    vistas.add(n.id);
    return true;
  });
}
