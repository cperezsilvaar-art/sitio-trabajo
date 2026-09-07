/*
 * talento.js — Evaluación de desempeño y potencial, matriz 9-box y talent card.
 *
 * Los colaboradores cuelgan de la SUCURSAL, no de la visita: la evaluación es
 * un estado vigente que se ajusta cuando el gerente aporta información nueva,
 * y cada cambio queda en el historial con su fecha. Así la persona se mueve de
 * cuadrante sin perder de dónde venía.
 */

/* ------------------------------ Escalas ------------------------------ */
const ESCALA_DESEMPENO = [
  { valor: 1, nombre: 'Por debajo',  ayuda: 'No alcanza lo esperado para su posición.' },
  { valor: 2, nombre: 'Esperado',    ayuda: 'Cumple con lo que la posición requiere.' },
  { valor: 3, nombre: 'Supera',      ayuda: 'Consistentemente por encima de lo esperado.' }
];

const ESCALA_POTENCIAL = [
  { valor: 1, nombre: 'En su nivel', ayuda: 'Aporta donde está; no se proyecta un salto de nivel.' },
  { valor: 2, nombre: 'Puede crecer',ayuda: 'Puede asumir una posición de mayor alcance.' },
  { valor: 3, nombre: 'Alto',        ayuda: 'Puede crecer más de un nivel o cambiar de función.' }
];

/* --------------------------- Los nueve cuadrantes --------------------- *
 * Clave: `${potencial}${desempeno}`                                       */
const NINE_BOX = {
  '31': { nombre: 'Enigma',              tono: 'amarillo',
          lectura: 'Potencial visible sin resultados todavía.',
          accion: 'Entender qué lo frena: encuadre en el puesto, claridad de expectativas o acompañamiento. Definir un plazo para ver movimiento.' },
  '32': { nombre: 'Promesa',             tono: 'verde',
          lectura: 'Buen desempeño y potencial alto.',
          accion: 'Darle proyectos que estiren su alcance y un referente que lo acompañe. Candidato natural a sucesión.' },
  '33': { nombre: 'Estrella',            tono: 'verde',
          lectura: 'Supera lo esperado y puede crecer.',
          accion: 'Plan de sucesión concreto y conversación de carrera. Es el perfil más caro de perder: revisar retención.' },
  '21': { nombre: 'Inconsistente',       tono: 'amarillo',
          lectura: 'Puede crecer, pero hoy no rinde.',
          accion: 'Feedback específico sobre las brechas y un plan con seguimiento a 60 o 90 días.' },
  '22': { nombre: 'Profesional sólido',  tono: 'azul',
          lectura: 'Cumple y puede asumir algo más.',
          accion: 'Formación puntual y exposición a tareas de la posición siguiente.' },
  '23': { nombre: 'Alto desempeño',      tono: 'verde',
          lectura: 'Rinde muy bien en su nivel actual.',
          accion: 'Reconocer el aporte y explorar hasta dónde quiere llegar antes de asumir que quiere crecer.' },
  '11': { nombre: 'Riesgo',              tono: 'rojo',
          lectura: 'No alcanza lo esperado y no se proyecta crecimiento.',
          accion: 'Plan de mejora con objetivos medibles y plazo. Si no hay cambio, evaluar reubicación o desvinculación.' },
  '12': { nombre: 'Eficaz',              tono: 'azul',
          lectura: 'Hace lo que la posición pide.',
          accion: 'Sostener el desempeño y cuidar la motivación. No forzar un crecimiento que no busca.' },
  '13': { nombre: 'Especialista',        tono: 'azul',
          lectura: 'Muy bueno en lo suyo, sin proyección de nivel.',
          accion: 'Referente técnico del equipo: aprovecharlo para formar a otros. Riesgo alto si se va.' }
};

const cuadranteDe = (potencial, desempeno) =>
  NINE_BOX[String(potencial) + String(desempeno)] || null;

/* ------------------------------ Talent card --------------------------- */
const NIVELES_ESTUDIO = [
  { id: '',             nombre: 'Sin dato' },
  { id: 'noEstudia',    nombre: 'No estudia' },
  { id: 'secundario',   nombre: 'Secundario en curso' },
  { id: 'terciario',    nombre: 'Terciario en curso' },
  { id: 'universitario',nombre: 'Universitario en curso' },
  { id: 'posgrado',     nombre: 'Posgrado en curso' },
  { id: 'curso',        nombre: 'Curso o capacitación' }
];

const RIESGO_SALIDA = [
  { id: '',      nombre: 'Sin evaluar' },
  { id: 'bajo',  nombre: 'Bajo' },
  { id: 'medio', nombre: 'Medio' },
  { id: 'alto',  nombre: 'Alto' }
];

const MOVILIDAD = [
  { id: '',     nombre: 'Sin dato' },
  { id: 'si',   nombre: 'Sí, puede moverse de sucursal' },
  { id: 'no',   nombre: 'No, solo esta sucursal' },
  { id: 'zona', nombre: 'Solo dentro de la zona' }
];

/* ---------------------------- Utilidades ----------------------------- */

/** Antigüedad en años a partir de la fecha de ingreso. */
function antiguedadAnios(fechaIngreso) {
  if (!fechaIngreso) return null;
  const d = new Date(fechaIngreso + 'T00:00:00');
  if (isNaN(d)) return null;
  return (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
}

/**
 * Registra una evaluación. Solo agrega al historial si algo cambió, para que
 * el historial cuente movimientos y no reediciones.
 */
function registrarEvaluacion(colaborador, desempeno, potencial, contexto) {
  const d = Number(desempeno) || null;
  const pot = Number(potencial) || null;
  const previo = { desempeno: colaborador.desempeno || null, potencial: colaborador.potencial || null };
  const cambio = previo.desempeno !== d || previo.potencial !== pot;

  colaborador.desempeno = d;
  colaborador.potencial = pot;
  if (!Array.isArray(colaborador.historial)) colaborador.historial = [];

  if (cambio && (d || pot)) {
    colaborador.historial.push({
      fecha: (contexto && contexto.fecha) || new Date().toISOString().slice(0, 10),
      desempeno: d, potencial: pot,
      desde: previo.desempeno || previo.potencial ? previo : null,
      evaluadoCon: (contexto && contexto.evaluadoCon) || '',
      motivo: (contexto && contexto.motivo) || ''
    });
    colaborador.fechaEvaluacion = (contexto && contexto.fecha) || new Date().toISOString().slice(0, 10);
    colaborador.evaluadoCon = (contexto && contexto.evaluadoCon) || colaborador.evaluadoCon || '';
  }
  return cambio;
}

/** Distribución del plantel en la matriz, para el panel y el reporte. */
function distribucion9Box(colaboradores) {
  const activos = (colaboradores || []).filter(c => c.activo !== false);
  const evaluados = activos.filter(c => c.desempeno && c.potencial);

  const celdas = {};
  Object.keys(NINE_BOX).forEach(k => { celdas[k] = []; });
  evaluados.forEach(c => { celdas[String(c.potencial) + String(c.desempeno)].push(c); });

  // Todas las agrupaciones devuelven listas, para poder contarlas y nombrarlas
  const porTono = tono => evaluados.filter(c => (cuadranteDe(c.potencial, c.desempeno) || {}).tono === tono);

  return {
    activos, evaluados,
    sinEvaluar: activos.filter(c => !c.desempeno || !c.potencial),
    celdas,
    fortalezas: porTono('verde'),
    aTrabajar: porTono('amarillo'),
    enRiesgo: porTono('rojo'),
    listosParaCrecer: evaluados.filter(c => c.potencial >= 2 && c.desempeno >= 2),
    riesgoDeSalida: activos.filter(c => c.riesgoSalida === 'alto'),
    estudiando: activos.filter(c => c.estudia && c.estudia !== 'noEstudia')
  };
}
