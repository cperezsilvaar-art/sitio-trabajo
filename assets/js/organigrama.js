/* ============== organigrama.js — la cadena de mando de una tienda ==============
 *
 * El cuadro que había agrupaba por posición: una fila de Seniors, una fila de
 * APV, una fila de DT. Eso contesta «cuánta gente de cada puesto tengo», que ya
 * lo contesta la tira de arriba, y **no contesta quién responde a quién**, que
 * es lo que se mira con el Gerente de Operaciones enfrente.
 *
 * Acá vive solamente **dónde cae cada persona**. El dibujo es de `app.js`: dos
 * cosas distintas, y la de acá se puede probar sin navegador.
 *
 * **Las reglas son por posición y no por una jerarquía cargada a mano.** El
 * panel no guarda quién le reporta a quién —la nómina no lo trae— así que la
 * estructura se deduce del puesto, que es el dato que sí está y que se corrige
 * en un solo lugar: la ficha de la persona. Mover a alguien en el cuadro es
 * cambiarle el puesto en Nómina, nunca arrastrar una tarjeta: un organigrama
 * que se edita por arrastre guarda una segunda verdad al lado de la nómina, y
 * el día que difieren no hay forma de saber cuál vale.
 *
 * **Nadie se cae del cuadro.** Una posición que estas reglas no conocen no
 * desaparece: sale en `sinUbicar` y la pantalla la nombra, como el grupo «Sin
 * especialidad» del laboratorio. Perder a una persona del organigrama es peor
 * que mostrarla en el lugar equivocado, porque lo segundo se ve.
 */

/* El laboratorio no entra: es otra unidad de negocio y tiene su propio cuadro.
   Y los flotantes del área no son una tienda, así que tampoco tienen cadena de
   mando propia. */

/** Los cargos que van al costado del gerente y no abajo de nadie. */
const CARGOS_ASISTENTE_GERENTE = ['LIMPIEZA'];

/**
 * Las ramas que cuelgan del gerente, en orden, con qué posición las arma.
 *
 * `niveles` es la cadena de abajo del gerente: el primero responde al gerente,
 * el segundo al primero. Perfumería es **una rama aparte y no un nivel abajo
 * del Senior**: la Asesora de Dermo no le responde al APV Senior, le responde
 * al Gerente de Tienda.
 */
const RAMAS_ORGANIGRAMA = [
  { id: 'piso',       titulo: 'Piso de venta', niveles: ['Senior', 'APV'] },
  { id: 'perfumeria', titulo: 'Perfumería',    niveles: ['Asesora de Dermo', 'Asesora de Belleza'] }
];

/** La rama de la farmacia, que va al costado del gerente y no abajo. */
const RAMA_FARMACIA = { id: 'farmacia', titulo: 'Farmacia', niveles: ['DT', 'Farmacéutico'] };

const POSICIONES_UBICADAS = ['Gerente de Tienda', 'Otros']
  .concat(RAMA_FARMACIA.niveles)
  .concat(RAMAS_ORGANIGRAMA.reduce((a, r) => a.concat(r.niveles), []));

const _nodoPersona = c => ({ tipo: 'persona', id: c.id, persona: c, nombre: c.nombre || '' });

/**
 * ¿Son la misma persona escrita de dos formas?
 *
 * La ficha de la tienda guarda «Marta Inés Pérez» y el padrón
 * «PEREZ, MARTA INES»: el mismo nombre, con la coma y el orden al revés. Se comparan **las palabras**, sin acentos ni orden, y hacen falta al
 * menos dos iguales: con una sola, cualquier «María» sería cualquier otra.
 */
function _mismasPalabras(a, b) {
  const palabras = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().split(/[^A-Z]+/).filter(x => x.length > 2);
  const A = palabras(a), B = palabras(b);
  if (A.length < 2 || B.length < 2) return false;
  const comunes = A.filter(x => B.indexOf(x) >= 0).length;
  return comunes >= 2 && comunes >= Math.min(A.length, B.length) - 1;
}

/** La vacante es un nodo más: lo que la define es que ahí no hay nadie. */
const _nodoVacante = v => ({ tipo: 'vacante', id: v.id, vacante: v,
                             nombre: v.cargo || v.posicion || '' });

/** Dónde cuenta esta persona en el cuadro. */
function posicionEnElArbol(colaborador) {
  const c = colaborador || {};
  const pos = String(c.posicion || '').trim();
  if (!pos) return 'Sin posición';
  return pos;
}

/** La posición de una vacante sale de su cargo, como en el resto del panel. */
function posicionDeVacante(vacante) {
  const v = vacante || {};
  if (v.posicion) return v.posicion;
  const cn = typeof CARGOS_NOMINA !== 'undefined'
    ? CARGOS_NOMINA.find(x => x.cargo === v.cargo) : null;
  return (cn && cn.posicion) || 'Sin posición';
}

/**
 * El árbol de una tienda.
 *
 * Devuelve la raíz —el Gerente de Tienda—, lo que va **al costado** (la
 * farmacia y el asistente del gerente), las ramas de abajo y lo que las reglas
 * no supieron ubicar.
 *
 * El plantel es el de hoy: quien está de baja no está en el cuadro, que es la
 * misma regla de `sigueEnElPlantel()` para todo lo que describe el presente.
 */
function arbolDeTienda(sucursal, hoy) {
  const s = sucursal || {};
  /* El día se recibe, y si no viene se usa el de hoy: `hoyISO()` vive adentro
     de `app.js` y desde acá no se ve. Una fecha vacía dejaría a
     `sigueEnElPlantel()` decidiendo contra nada. */
  const dia = hoy || new Date().toISOString().slice(0, 10);

  const gente = (s.colaboradores || []).filter(c => {
    if (typeof sigueEnElPlantel === 'function' && !sigueEnElPlantel(c, dia)) return false;
    /* El laboratorio tiene su propio cuadro: mezclarlos hace leer veintiséis
       personas donde el mostrador tiene ocho. */
    if (typeof esDeLaboratorio === 'function' && esDeLaboratorio(c).laboratorio) return false;
    return true;
  });

  const vacantes = (s.vacantes || []).filter(v => !v.cubiertaEl);

  /* **Quién es el gerente, cuando la nómina no lo dice.** En seis tiendas del
     área no hay nadie con el cargo de Gerente de Tienda y el cuadro quedaba
     sin cabeza, aunque la ficha de la tienda nombra a su gerente: es gente
     cargada como APV Senior que de hecho conduce la tienda. Se la pone arriba
     y **se dice de dónde salió**, que es la misma regla que el aviso de la
     razón social: nombrar y ofrecer corregir, no pisar en silencio. El arreglo
     de verdad es el cargo, y se hace en su ficha. */
  const conCargoDeGerente = gente.filter(c => posicionEnElArbol(c) === 'Gerente de Tienda');
  const candidato = conCargoDeGerente.length
    ? null
    : gente.find(c => _mismasPalabras(c.nombre, s.gerente)) || null;
  /* **Al Director Técnico no se lo saca de la farmacia ni para hacerlo
     gerente.** En una de las tiendas del área la misma persona figura en la
     ficha como gerente y como DT, y subirla a la cima dejaba a esa tienda sin
     la rama de la habilitación, que es justo lo que no puede faltar. Se queda
     donde está y la pantalla dice que además conduce la tienda. */
  const enLaFarmacia = c => RAMA_FARMACIA.niveles.indexOf(posicionEnElArbol(c)) >= 0;
  const deLaFicha = candidato && !enLaFarmacia(candidato) ? candidato : null;
  const gerenteEnFarmacia = candidato && enLaFarmacia(candidato) ? candidato : null;

  const porPos = {};
  gente.forEach(c => {
    if (deLaFicha && c.id === deLaFicha.id) return;
    const k = posicionEnElArbol(c);
    (porPos[k] || (porPos[k] = [])).push(_nodoPersona(c));
  });
  vacantes.forEach(v => {
    const k = posicionDeVacante(v);
    (porPos[k] || (porPos[k] = [])).push(_nodoVacante(v));
  });

  /* Orden adentro de cada nivel: primero quien tiene jornada completa y después
     por nombre, y las vacantes al final — el hueco se lee después de la gente
     que sí está. */
  const orden = (a, b) => {
    if (a.tipo !== b.tipo) return a.tipo === 'vacante' ? 1 : -1;
    return String(a.nombre).localeCompare(String(b.nombre), 'es');
  };
  const tomar = pos => (porPos[pos] || []).slice().sort(orden);

  /* El asistente del gerente: la persona de limpieza va al costado y no abajo
     del Senior, porque no es del piso de venta. Lo que no es limpieza pero cae
     en «Otros» también va acá, con su cargo escrito: es gente de la tienda que
     no está en la cadena del mostrador. */
  const otros = tomar('Otros');
  const esAsistente = n => n.tipo === 'persona' &&
    CARGOS_ASISTENTE_GERENTE.some(x => String(n.persona.cargo || '').toUpperCase().indexOf(x) >= 0);

  const raiz = deLaFicha ? [_nodoPersona(deLaFicha)] : tomar('Gerente de Tienda');

  const nivelesDe = lista => lista
    .map(pos => ({ posicion: pos, nodos: tomar(pos) }))
    .filter(n => n.nodos.length);

  const ramas = RAMAS_ORGANIGRAMA
    .map(r => Object.assign({}, r, { niveles: nivelesDe(r.niveles) }))
    .filter(r => r.niveles.length);

  const laterales = [];
  const farmacia = nivelesDe(RAMA_FARMACIA.niveles);
  if (farmacia.length) {
    laterales.push(Object.assign({}, RAMA_FARMACIA, {
      niveles: farmacia, lado: 'der',
      ayuda: 'La habilitación de la farmacia. Responde al Gerente de Tienda y no al revés.'
    }));
  }
  if (otros.length) {
    laterales.push({
      id: 'asistente', titulo: 'Asistente del gerente', lado: 'izq',
      niveles: [{ posicion: 'Otros', nodos: otros }],
      ayuda: otros.every(esAsistente)
        ? 'Limpieza: no cubre turno del mostrador y no cuelga del piso de venta.'
        : 'Gente de la tienda que no está en la cadena del mostrador.'
    });
  }

  const sinUbicar = Object.keys(porPos)
    .filter(k => POSICIONES_UBICADAS.indexOf(k) < 0)
    .map(k => ({ posicion: k, nodos: tomar(k) }));

  const contar = n => n.reduce((a, x) => a + (x.tipo === 'persona' ? 1 : 0), 0);
  const deNiveles = ns => ns.reduce((a, n) => a + contar(n.nodos), 0);

  return {
    sucursal: s,
    raiz,
    /* De dónde salió la cabeza del cuadro: `'cargo'` es lo normal —alguien con
       el cargo de Gerente de Tienda—, `'ficha'` es el nombre que guarda la
       ficha de la tienda y `''` es que no hay ninguno de los dos. */
    raizSegun: deLaFicha ? 'ficha' : (raiz.length ? 'cargo' : ''),
    /* Quien conduce la tienda y además es su Director Técnico: se nombra, y
       se lo sigue dibujando en la rama de la farmacia. */
    gerenteEnFarmacia: gerenteEnFarmacia
      ? { nombre: gerenteEnFarmacia.nombre, cargo: gerenteEnFarmacia.cargo || '' } : null,
    laterales,
    ramas,
    sinUbicar,
    /* Cuánta gente quedó dibujada, para poder decirlo al pie: un cuadro que
       muestra 9 de 11 personas sin avisar es un cuadro que miente. */
    personas: contar(raiz) + laterales.reduce((a, l) => a + deNiveles(l.niveles), 0)
      + ramas.reduce((a, r) => a + deNiveles(r.niveles), 0)
      + sinUbicar.reduce((a, n) => a + contar(n.nodos), 0),
    plantel: gente.length,
    vacantes: vacantes.length
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    arbolDeTienda, posicionEnElArbol, posicionDeVacante,
    RAMAS_ORGANIGRAMA, RAMA_FARMACIA, CARGOS_ASISTENTE_GERENTE, POSICIONES_UBICADAS
  };
}
