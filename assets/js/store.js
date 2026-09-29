/*
 * store.js — Estado de la aplicación y persistencia.
 *
 * Todo vive en el navegador (localStorage). No hay servidor: los datos de
 * personal no salen del equipo salvo que se exporten o se envíe un reporte.
 * Para trabajar en varios equipos, usar Exportar / Importar respaldo.
 */

const CLAVE_ALMACEN = 'farmatodo.rrhh.operativo.v1';

/* Resguardos automáticos. Viven en una clave aparte para que “Borrar todo”,
   “Cargar datos de ejemplo” o una importación equivocada no se los lleven
   puestos: son justamente la red que atrapa esos tres errores. Guardan el
   mismo texto que el almacén —cifrado si hay clave puesta—, así que no
   aflojan la privacidad de lo que resguardan. */
const CLAVE_RESGUARDOS = 'farmatodo.rrhh.operativo.resguardos';
const CLAVE_ILEGIBLE = 'farmatodo.rrhh.operativo.ilegible';
const MAX_RESGUARDOS = 4;

/**
 * Entrega un archivo al usuario.
 *
 * Abierto como archivo local o publicado en un servidor propio, alcanza con un
 * enlace de descarga. Dentro de una página publicada en claude.ai el visor no
 * permite descargas directas, así que hay que pedirlas por la capacidad
 * `downloads`, que muestra una confirmación antes de guardar.
 *
 * @returns {Promise<boolean>} true si el archivo se entregó.
 */
async function guardarArchivo(nombre, contenido, mime) {
  if (typeof window !== 'undefined' && window.claude && typeof window.claude.use === 'function') {
    let descargas = null;
    try { descargas = await window.claude.use('downloads'); } catch (err) { descargas = null; }
    if (descargas) {
      try {
        await descargas.save({ filename: nombre, data: contenido });
        return true;
      } catch (err) {
        if (err && err.code === 'declined') return false;          // el usuario canceló
        if (err && (err.code === 'unavailable' || err.code === 'not_granted' ||
                    err.code === 'capability_disabled' || err.code === 'capability_removed')) {
          // sin capacidad de descarga: se intenta el enlace común más abajo
        } else {
          alert('No se pudo guardar el archivo: ' + ((err && err.message) || 'error desconocido'));
          return false;
        }
      }
    }
  }

  const blob = new Blob([contenido], { type: (mime || 'text/plain') + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

const Store = (() => {
  let estado = null;
  let cifrador = null;          // null = guardar en claro
  let colaDeGuardado = Promise.resolve();
  /* Un guardado que falla en silencio es la peor forma de perder trabajo: se
     sigue usando el panel una hora y recién al recargar aparece el vacío. */
  let falloAlGuardar = '';
  const suscriptores = [];

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  /* Ficha de sucursal con todos sus campos, para que el padrón y las altas
     manuales produzcan el mismo objeto. */
  function sucursalNueva(datos) {
    return Object.assign({
      id: uid(),
      codigo: '', rvd: '', nombre: '', tipo: 'venta',
      marca: MARCA_AREA, operador: '', supervisor: '',
      razonSocial: '', cuit: '', direccion: '', localidad: '', horario: '', art: '',
      gerenteOperaciones: '',
      gerente: '', emailGerente: '',      // el gerente recibe copia del reporte
      directorTecnico: '',
      contactoAdmin: '', emailContactoAdmin: '', referenteRRHH: '',
      colaboradores: [],                  // plantel con su evaluación e historial
      dotacionNominal: null,
      minimoTurno: null,                  // con cuánta gente abre en condiciones
      notas: ''
    }, datos || {});
  }

  /**
   * Si el vínculo empezó o terminó dentro del período, cuántos días alcanzó a
   * durar. La escala es la del modelo de FTE: un mes son `diasMes` días, así
   * que entrar el 16 de un mes de 30 son 15 días, e irse el 25 son 25.
   *
   * @returns {{tipo:'estable'|'alta'|'baja', dias:number}}
   */
  function movimientoDelMes(colaborador, periodo, diasMes) {
    const c = colaborador || {};
    const dm = diasMes || PARAMETROS_DEFECTO.diasMes;
    const diaDe = f => {
      const t = String(f || '');
      return t.slice(0, 7) === periodo ? Math.min(dm, Math.max(1, Number(t.slice(8, 10)))) : 0;
    };
    const salida = diaDe((c.baja || {}).fecha);
    if (salida) return { tipo: 'baja', dias: salida };
    const entrada = diaDe(c.fechaIngreso) || diaDe(c.fechaIngresoFTD);
    if (entrada) return { tipo: 'alta', dias: dm - entrada + 1 };
    return { tipo: 'estable', dias: dm };
  }

  function estadoInicial() {
    const sucursales = SUCURSALES_AREA3.map(x => sucursalNueva(x));
    return {
      version: 1,
      config: {
        coordinador: 'Christian Pérez',
        area: 'Área 3',
        gerenteOperaciones: { nombre: '', email: '' },
        gerentesOperaciones: GERENTES_OPERACIONES_AREA3.map(g => Object.assign({}, g)),
        copias: '',
        webhook: '',
        ultimoRespaldo: '',
        parametros: Object.assign({}, PARAMETROS_DEFECTO)
      },
      sucursales,
      visitas: [],
      informes: [],                       // envíos de la estadística mensual
      reclamos: [],                       // lo que plantea la gente en las visitas
      diarios: [],                        // reporte de operación de cada día
      agenda: []                          // lo que el coordinador lleva pendiente
    };
  }

  function visitaNueva(sucursalId) {
    const hoy = new Date();
    const periodo = hoy.toISOString().slice(0, 7);
    return {
      id: uid(),
      sucursalId,
      fecha: hoy.toISOString().slice(0, 10),
      periodo,
      coordinador: estado.config.coordinador || '',
      recorrida: { checks: {}, notas: {} },   // { checks: {piso_clima:'ok'}, notas: {...} }
      /* El check list corporativo de RRHH Operaciones: 30 puntos con criterio
         de aprobación. Es el instrumento formal; la recorrida de arriba es la
         mirada del HRBP, que no lo reemplaza. */
      checklist: {
        supervisor: '', cargoSupervisor: '',
        checks: {}, obs: {}, consideraciones: {},
        relevantes: '', compromisos: ''
      },
      minutaGerente: { participante: '', puntos: '', acuerdos: '' },
      minutaColaborador: { nombre: '', posicion: '', feedback: '' },
      posiciones: POSICIONES.map(p => ({
        rol: p.nombre, heads: '', headsAltas: '', diasAltas: '', diasBajas: '', diasAusentes: '',
        horasExtras: '', sueldoBruto: '', costoHE: '', bonos: '', cargasManual: ''
      })),
      ausentismo: { detalle: {} },
      rotacion: { dotacionAnterior: '', altasExternas: '', altasInternas: '', bajasExternas: '', bajasInternas: '' },
      movimientos: [],
      sanciones: [],
      sucesion: [],
      comercial: { venta: '', ventaRed: '', tickets: '', horasTrabajadas: '' },
      diagnostico: { hallazgos: '', impacto: '', plan: [] },
      envio: { enviado: false, fecha: null, destinatario: null, via: null, historial: [] },
      /* El informe del check list se manda aparte del reporte de la visita:
         son documentos distintos y con destinatarios distintos. */
      envioChecklist: { enviado: false, fecha: null, destinatario: null, via: null, historial: [] },
      creada: hoy.toISOString()
    };
  }

  /* Migración defensiva: completa claves que falten en respaldos viejos. */
  function normalizar(e) {
    const base = estadoInicial();
    if (!e || typeof e !== 'object') return base;
    e.version = 1;
    e.config = Object.assign({}, base.config, e.config || {});
    if (!String(e.config.coordinador || '').trim()) e.config.coordinador = base.config.coordinador;
    if (!String(e.config.area || '').trim()) e.config.area = base.config.area;
    e.config.gerenteOperaciones = Object.assign({}, base.config.gerenteOperaciones, e.config.gerenteOperaciones || {});
    e.config.parametros = Object.assign({}, PARAMETROS_DEFECTO, e.config.parametros || {});
    e.sucursales = Array.isArray(e.sucursales) ? e.sucursales : base.sucursales;
    if (!Array.isArray(e.config.gerentesOperaciones) || !e.config.gerentesOperaciones.length) {
      e.config.gerentesOperaciones = GERENTES_OPERACIONES_AREA3.map(g => Object.assign({}, g));
    }
    /* Corrección de campos que se cargaron mal la primera vez: el área tiene un
       solo Gerente de Operaciones, todas las tiendas operan bajo la marca
       Farmatodo, y los dos nombres que traía la tercera columna del padrón no
       son referentes de ninguna sucursal. */
    if (e.config.gerentesOperaciones.every(g => NOMBRES_A_LIMPIAR.includes(g.nombre) && !String(g.email || '').trim())) {
      e.config.gerentesOperaciones = GERENTES_OPERACIONES_AREA3.map(g => Object.assign({}, g));
    }
    if (!String((e.config.gerenteOperaciones || {}).email || '').trim()) {
      e.config.gerenteOperaciones = Object.assign({}, GERENTES_OPERACIONES_AREA3[0]);
    }

    e.sucursales = e.sucursales.map(s => sucursalNueva(s));
    e.sucursales.forEach(s => {
      if (NOMBRES_A_LIMPIAR.includes(s.gerenteOperaciones)) {
        s.gerenteOperaciones = GERENTES_OPERACIONES_AREA3[0].nombre;
      }
      if (NOMBRES_A_LIMPIAR.includes(s.supervisor)) s.supervisor = '';
      if (s.marca && s.marca !== MARCA_AREA) {
        if (!s.operador) s.operador = s.marca;
        s.marca = MARCA_AREA;
      }
    });
    e.sucursales.forEach(s => {
      if (!s.id) s.id = uid();
      if (!Array.isArray(s.colaboradores)) s.colaboradores = [];
      s.colaboradores.forEach(c => {
        if (!c.id) c.id = uid();
        if (!Array.isArray(c.historial)) c.historial = [];
        if (c.activo === undefined) c.activo = true;
        if (!c.novedades || typeof c.novedades !== 'object') c.novedades = {};
        if (!c.talles || typeof c.talles !== 'object') c.talles = {};
        /* Licencias especiales del art. 25 y sanciones, en la ficha de la
           persona: los topes son por año y por persona, no por período. */
        if (!Array.isArray(c.licencias)) c.licencias = [];
        if (!Array.isArray(c.sanciones)) c.sanciones = [];
        /* Los casos cuelgan de la persona, como la baja, los movimientos y las
           ausencias: si la trasladan de tienda el seguimiento la acompaña. */
        if (!Array.isArray(c.casos)) c.casos = [];
        /* Traspasos de sucursal y modificaciones de puesto. Viven en la ficha
           de la persona y no en la sucursal, así el historial la acompaña
           cuando se muda de tienda. */
        if (!Array.isArray(c.movimientos)) c.movimientos = [];
        /* Ausencias con certificado: desde cuándo, hasta cuándo, y qué pasa
           cuando esa fecha llega. Nada que ver con las novedades del mes. */
        if (!Array.isArray(c.ausencias)) c.ausencias = [];
        /* Entrenamientos al rol de Senior. También cuelgan de la persona: la
           propuesta la hizo un gerente en una tienda, pero la trazabilidad
           tiene que seguirla si la trasladan a otra. */
        if (!Array.isArray(c.entrenamientos)) c.entrenamientos = [];
        /* Las bajas que se cargaron antes de que la baja fuera un proceso: se
           les abre el check list vacío y quedan sin cerrar, que es la verdad
           —nadie registró esos trámites— y no un cierre inventado. */
        if (c.baja && typeof c.baja === 'object') {
          if (!c.baja.tramites || typeof c.baja.tramites !== 'object') c.baja.tramites = {};
          if (c.baja.cerradaEl === undefined) c.baja.cerradaEl = '';
        }
        /* La nómina no trae cargas de familia y los plazos del art. 208 se
           duplican con ellas: se carga a mano y por eso arranca sin definir. */
        if (c.cargasFamilia === undefined) c.cargasFamilia = null;
        ['legajo', 'cuil', 'sector', 'dni', 'nroPersonal', 'sexo', 'estatus', 'jefe',
         'cargo', 'nivelCargo', 'categoriaConvenio', 'unidadNegocio',
         'razonSocialContrato', 'direccionArea', 'fechaNacimiento', 'fechaIngresoFTD',
         'email', 'emailCorporativo', 'telefono', 'domicilio', 'localidad',
         'obraSocial', 'estadoCivil', 'nacionalidad', 'banco', 'cbu']
          .forEach(k => { if (c[k] === undefined) c[k] = ''; });
      });
    });
    e.visitas = Array.isArray(e.visitas) ? e.visitas : [];
    e.reclamos = Array.isArray(e.reclamos) ? e.reclamos : [];
    e.reclamos.forEach(r => {
      if (!r.id) r.id = uid();
      if (!Array.isArray(r.historial)) r.historial = [];
      if (!r.estado) r.estado = 'abierto';
    });
    /* La cartelera fue el primer intento de esto y guardaba en `avisos`. Lo que
       había cargado se conserva como apuntes pendientes. */
    if (Array.isArray(e.avisos) && e.avisos.length && !Array.isArray(e.agenda)) {
      e.agenda = e.avisos.map(a => ({
        id: a.id || uid(),
        titulo: a.titulo || '',
        detalle: a.cuerpo || '',
        tema: a.categoria || 'otros',
        estado: 'pendiente',
        quien: a.fuente || '',
        sucursalId: '',
        fecha: a.fecha || new Date().toISOString().slice(0, 10),
        hitos: Array.isArray(a.hitos) ? a.hitos : [],
        avisarEnTienda: true,
        fijado: !!a.fijado,
        creado: a.creado || new Date().toISOString()
      }));
    }
    delete e.avisos;

    e.agenda = Array.isArray(e.agenda) ? e.agenda : [];
    e.agenda.forEach(i => {
      if (!i.id) i.id = uid();
      if (!Array.isArray(i.hitos)) i.hitos = [];
      if (!i.tema) i.tema = 'otros';
      if (!i.estado) i.estado = 'pendiente';
      ['titulo', 'detalle', 'quien', 'sucursalId', 'liquidacion']
        .forEach(k => { if (i[k] === undefined) i[k] = ''; });
    });
    e.diarios = Array.isArray(e.diarios) ? e.diarios : [];
    e.diarios.forEach(d => {
      if (!d.sucursales || typeof d.sucursales !== 'object') d.sucursales = {};
      if (!d.venta || typeof d.venta !== 'object') d.venta = {};
      Object.keys(d.sucursales).forEach(k => {
        const x = d.sucursales[k];
        if (!Array.isArray(x.ausentes)) x.ausentes = [];
        if (!Array.isArray(x.novedades)) x.novedades = [];
      });
    });
    e.informes = Array.isArray(e.informes) ? e.informes : [];
    e.informes.forEach(i => {
      if (!i.id) i.id = uid();
      if (!Array.isArray(i.historial)) i.historial = [];
    });
    e.visitas.forEach(v => {
      /* Si se agregaron posiciones al catálogo, la matriz suma esas filas sin
         perder lo cargado en las que ya estaban. */
      v.posiciones = Array.isArray(v.posiciones) ? v.posiciones : [];
      v.posiciones = POSICIONES.map(p =>
        v.posiciones.find(f => f.rol === p.nombre) || {
          rol: p.nombre, heads: '', headsAltas: '', diasAltas: '', diasBajas: '', diasAusentes: '',
          horasExtras: '', sueldoBruto: '', costoHE: '', bonos: '', cargasManual: ''
        })
        /* Las filas de un catálogo viejo que ya no existe se conservan al final
           si tienen algo cargado, para no borrar trabajo en silencio. */
        .concat(v.posiciones.filter(f =>
          !POSICIONES.some(p => p.nombre === f.rol) &&
          Object.keys(f).some(k => k !== 'rol' && String(f[k] || '').trim())));

      v.recorrida = Object.assign({ checks: {}, notas: {} }, v.recorrida || {});
      v.envioChecklist = Object.assign(
        { enviado: false, fecha: null, destinatario: null, via: null, historial: [] },
        v.envioChecklist || {});
      if (!Array.isArray(v.envioChecklist.historial)) v.envioChecklist.historial = [];
      v.checklist = Object.assign({
        supervisor: '', cargoSupervisor: '', checks: {}, obs: {},
        consideraciones: {}, relevantes: '', compromisos: ''
      }, v.checklist || {});
      ['checks', 'obs', 'consideraciones'].forEach(k => {
        if (!v.checklist[k] || typeof v.checklist[k] !== 'object') v.checklist[k] = {};
      });
      if (!v.recorrida.checks || typeof v.recorrida.checks !== 'object') v.recorrida.checks = {};
      if (!v.recorrida.notas || typeof v.recorrida.notas !== 'object') v.recorrida.notas = {};
      v.minutaGerente = Object.assign({ participante: '', puntos: '', acuerdos: '' }, v.minutaGerente || {});
      v.minutaColaborador = Object.assign({ nombre: '', posicion: '', feedback: '' }, v.minutaColaborador || {});
      v.ausentismo = Object.assign({ detalle: {} }, v.ausentismo || {});
      v.rotacion = Object.assign({ dotacionAnterior: '', altasExternas: '', altasInternas: '', bajasExternas: '', bajasInternas: '' }, v.rotacion || {});
      v.comercial = Object.assign({ venta: '', ventaRed: '', tickets: '', horasTrabajadas: '' }, v.comercial || {});
      v.diagnostico = Object.assign({ hallazgos: '', impacto: '', plan: [] }, v.diagnostico || {});
      v.envio = Object.assign({ enviado: false, fecha: null, destinatario: null, via: null, historial: [] }, v.envio || {});
      ['posiciones', 'movimientos', 'sanciones', 'sucesion'].forEach(k => {
        if (!Array.isArray(v[k])) v[k] = [];
      });
      // Los planes anteriores no distinguían a cargo de quién estaba cada acción
      v.diagnostico.plan.forEach(x => {
        if (!x.aCargo) x.aCargo = 'tienda';
        if (!x.prioridad) x.prioridad = 'Media';
      });
    });
    return e;
  }

  /**
   * Carga el estado. Con cifrador, descifra lo guardado; sin él, lee en claro.
   * @throws si hay contenido cifrado que no se puede descifrar, para no pisar
   *         datos que todavía se pueden recuperar con la clave correcta.
   */
  let arrancoSinNada = false;

  async function cargar(cif) {
    cifrador = cif || null;
    let crudo = null;
    try {
      crudo = localStorage.getItem(CLAVE_ALMACEN);
    } catch (err) {
      console.warn('No se pudo leer el almacenamiento local.', err);
    }
    /* Nunca se guardó nada en este navegador. No es lo mismo que un tablero
       vaciado a propósito —ése sí tiene algo guardado, aunque esté vacío— y la
       diferencia importa: en el primer caso corresponde reponer el plantel
       solo, y en el segundo sería devolverle al usuario lo que acaba de
       borrar. */
    if (!crudo) { arrancoSinNada = true; estado = estadoInicial(); return estado; }

    let leido = false;
    try {
      const plano = cifrador ? await cifrador.descifrar(crudo) : crudo;
      estado = normalizar(JSON.parse(plano));
      leido = true;
    } catch (err) {
      if (!cifrador) {
        /* Arrancar vacío acá significa que el primer guardado pisa para siempre
           lo que había. Se lo aparta antes, aunque no se entienda: un texto
           roto todavía se puede mirar a mano, un texto pisado no. */
        try { localStorage.setItem(CLAVE_ILEGIBLE, crudo); } catch (e2) { /* no entró */ }
        console.warn('El contenido guardado no se pudo leer, se inicia vacío.', err);
        estado = estadoInicial();
        return estado;
      }
    }

    /* La copia del día va acá afuera a propósito. Adentro del try, cualquier
       error suyo se leía como “no se pudo leer lo guardado” y el tablero
       arrancaba vacío: el resguardo tirando abajo justo lo que protege. */
    if (leido) {
      try { resguardarPorDia(); } catch (err) { console.warn('No se pudo guardar la copia del día.', err); }
      return estado;
    }

    /* Con cifrador y sin poder descifrar hay dos casos. Puede ser contenido en
       claro de antes de poner la clave, que corresponde migrar; o contenido
       cifrado ilegible, que no hay que pisar. Se distinguen por la forma: solo
       se acepta como claro lo que tiene la estructura del tablero. */
    try {
      const obj = JSON.parse(crudo);
      if (obj && Array.isArray(obj.sucursales)) {
        estado = normalizar(obj);
        guardar();                 // de acá en más queda cifrado
        return estado;
      }
    } catch (e) { /* ni cifrado legible ni claro válido */ }

    throw new Error('No se pudo descifrar el contenido guardado.');
  }

  /**
   * Persiste el estado. El cifrado es asíncrono, así que las escrituras se
   * encadenan: siempre gana la última y nunca se cruzan entre sí.
   */
  function guardar() {
    const instantanea = JSON.stringify(estado);
    colaDeGuardado = colaDeGuardado.then(async () => {
      let aGuardar;
      try {
        aGuardar = cifrador ? await cifrador.cifrar(instantanea) : instantanea;
      } catch (err) {
        falloAlGuardar = 'No se pudo cifrar el contenido para guardarlo.';
        console.error(falloAlGuardar, err);
        return;
      }
      try {
        localStorage.setItem(CLAVE_ALMACEN, aGuardar);
        falloAlGuardar = '';
        return;
      } catch (err) {
        /* Lo más probable es que no entre porque las copias llenaron el
           almacenamiento. Vale más lo que se está guardando ahora que una copia
           vieja, así que se sueltan y se reintenta. */
        console.warn('No entró en el almacenamiento local, se liberan copias.', err);
      }
      try { localStorage.removeItem(CLAVE_RESGUARDOS); } catch (e) { /* nada que hacer */ }
      try {
        localStorage.setItem(CLAVE_ALMACEN, aGuardar);
        falloAlGuardar = '';
      } catch (err) {
        falloAlGuardar = 'El navegador no está guardando los cambios: no hay lugar o el sitio ' +
                         'tiene bloqueado el almacenamiento. Exportá un respaldo antes de cerrar.';
        console.error(falloAlGuardar, err);
      }
    });
    suscriptores.forEach(fn => fn(estado));
  }

  /* ---------------------- resguardos automáticos ---------------------- */

  function leerResguardos() {
    try {
      const crudo = localStorage.getItem(CLAVE_RESGUARDOS);
      const lista = crudo ? JSON.parse(crudo) : [];
      return Array.isArray(lista) ? lista : [];
    } catch (err) {
      return [];
    }
  }

  function escribirResguardos(lista) {
    /* Si no entra, se va soltando del más viejo antes que perder el más nuevo:
       vale más un resguardo de hoy que cuatro de la semana pasada. */
    let x = lista.slice();
    while (x.length) {
      try {
        localStorage.setItem(CLAVE_RESGUARDOS, JSON.stringify(x));
        return true;
      } catch (err) {
        x.shift();
      }
    }
    try { localStorage.removeItem(CLAVE_RESGUARDOS); } catch (err) { /* nada que hacer */ }
    return false;
  }

  /**
   * Copia a un costado lo que hay guardado en este momento. Se llama antes de
   * cada operación que reemplaza todo el contenido y una vez por día al abrir.
   *
   * @param {string} motivo texto que después se muestra en Configuración.
   * @returns {boolean} true si quedó un resguardo nuevo.
   */
  /**
   * Buscar a quién pertenece una fila pegada, con las reglas que costó afinar.
   * Lo usan los dos importadores de ausencias —el del formulario de recepción y
   * el parte de ausentes que mandan los gerentes—, porque el emparejamiento es
   * lo mismo y tenerlo dos veces garantiza que un día difieran.
   *
   * La fila necesita `cuil` (el número, sea CUIL o DNI), `nombre` y `tienda`.
   * Devuelve `{ g, via, propia, conflicto }`.
   */
  /**
   * Registra en `c.ausencias` las licencias que la liquidación pagó ese mes.
   *
   * Sin esto el libro solo llenaba `c.novedades`, y el ausentismo por sucursal
   * —que se calcula sobre `c.ausencias`— se quedaba en cero aunque el mes
   * tuviera 166 días de licencia. El coordinador cargaba el cierre y no se
   * movía nada: es la misma pantalla mirando otra caja.
   *
   * **El libro dice cuántos días, no cuáles.** La duración está medida —la
   * liquidación la pagó— pero las fechas no, así que la licencia se ubica al
   * principio del mes y queda marcada con `fechasSupuestas` para siempre. Es
   * el mismo trato que `diasSupuestos` le da al certificado sin duración: lo
   * que se supone se marca y no se muestra solo.
   *
   * **No pisa lo que ya estaba.** Si la persona ya tiene una licencia de ese
   * motivo que toca el mes —cargada del formulario de recepción o del parte de
   * los gerentes—, esa es la buena: tiene fechas de verdad. La del libro no
   * entra y los días no se cuentan dos veces.
   */
  function registrarLicenciasDelLibro(c, periodo, nov, diferencias) {
    if (!Array.isArray(c.ausencias)) c.ausencias = [];
    const ini = periodo + '-01';
    const finMes = new Date(+periodo.slice(0, 4), +periodo.slice(5, 7), 0)
      .toISOString().slice(0, 10);
    let puestas = 0;

    Object.keys(MOTIVO_DE_NOVEDAD).forEach(campo => {
      const dias = numeroNovedad(nov[campo]);
      if (dias <= 0) return;
      const motivo = MOTIVO_DE_NOVEDAD[campo];

      /* Ya hay una licencia de ese motivo que pisa el mes. Las fechas de esa
         son las buenas —las del libro serían inventadas— pero **los días los
         manda la liquidación**: es lo que efectivamente se pagó. */
      const suyas = c.ausencias.filter(a => a.motivo === motivo && a.desde
        && a.desde <= finMes && (a.hasta || finMes) >= ini);
      if (suyas.length) {
        /* Los días que la licencia pisa del mes, a secas. No con
           `diasDeAusenciaEntre()`, que devuelve cero para lo que no es
           ausentismo: comparar así daba «la maternidad pagó 17 y hay 0
           registrados» sobre una licencia que estaba perfectamente cargada. */
        const enElMes = a => {
          const d1 = a.desde > ini ? a.desde : ini;
          const d2 = (a.hasta && a.hasta < finMes) ? a.hasta : finMes;
          return d2 < d1 ? 0 : Math.round((new Date(d2) - new Date(d1)) / 86400000) + 1;
        };
        const registrados = suyas.reduce((n, a) => n + enElMes(a), 0);
        const pagados = Math.round(dias);
        if (registrados === pagados) return;

        /* **Se corrige hacia arriba y no hacia abajo.** Que la liquidación
           pagara menos días que los del certificado es un problema de la
           liquidación, no del registro, y recortar la licencia borraría
           justamente la prueba. Se nombra y se deja como está. */
        if (pagados < registrados) {
          if (diferencias) diferencias.push({ nombre: c.nombre, concepto: campo,
                                              pagados, registrados, ajustada: false });
          return;
        }

        /* Cuál se extiende: la última, y con preferencia la que tenía la
           duración **supuesta**. El supuesto es el eslabón débil —un
           certificado sin duración que se tomó como un día— y la liquidación
           es el dato que lo reemplaza. */
        const orden = suyas.slice().sort((x, y) => String(x.desde).localeCompare(String(y.desde)));
        const elegida = orden.filter(a => a.diasSupuestos).pop() || orden[orden.length - 1];

        const fin = new Date((elegida.hasta || elegida.desde) + 'T00:00:00');
        fin.setDate(fin.getDate() + (pagados - registrados));
        const nuevoHasta = fin.toISOString().slice(0, 10);
        const antes = elegida.hasta || elegida.desde;
        elegida.hasta = nuevoHasta > finMes ? finMes : nuevoHasta;
        /* Ya no es un supuesto: la liquidación dice cuántos días pagó. */
        elegida.diasSupuestos = false;
        elegida.origenDias = 'liquidacion';
        elegida.ajustadaPorLiquidacion = periodo;
        elegida.hastaAnterior = antes;
        elegida.reincorporado = true;

        if (diferencias) diferencias.push({ nombre: c.nombre, concepto: campo,
                                            pagados, registrados, ajustada: true,
                                            desde: elegida.desde, hasta: elegida.hasta });
        return;
      }

      const fin = new Date(ini + 'T00:00:00');
      fin.setDate(fin.getDate() + Math.round(dias) - 1);
      const hasta = fin.toISOString().slice(0, 10);

      c.ausencias.push({
        id: uid(),
        desde: ini,
        hasta: hasta > finMes ? finMes : hasta,
        motivo,
        concepto: campo,
        diagnostico: '', certificado: '', notas: '',
        /* La liquidación ya la pagó: es una ausencia cerrada, no una abierta
           que el Panel tenga que anunciar como «falta hoy». */
        reincorporado: true,
        fechaReincorporacion: '',
        origen: 'liquidacion',
        periodoLiquidacion: periodo,
        /* Quién cuenta para el ausentismo lo decide `cuentaComoAusentismo()` y
           nadie más: sin esto la maternidad, el matrimonio, el nacimiento y el
           fallecimiento entrarían como ausentismo por la puerta de atrás. */
        cuentaAusentismo: cuentaComoAusentismo(campo),
        fechasSupuestas: true,
        diasSupuestos: false,
        registradaEl: new Date().toISOString()
      });
      puestas++;
    });
    return puestas;
  }

  function buscadorDePadron(estado) {
    const gente = [];
    (estado.sucursales || []).forEach(s =>
      (s.colaboradores || []).forEach(c => gente.push({ c, s })));

    const soloDigitos = x => String(x == null ? '' : x).replace(/\D/g, '');
    const porCuil = {}, porDni = {};
    gente.forEach(g => {
      const cu = soloDigitos(g.c.cuil);
      if (cu.length === 11) porCuil[cu] = g;
      const dn = soloDigitos(g.c.dni);
      if (dn.length >= 7 && dn.length <= 8) porDni[dn] = g;
    });
    const tokens = x => new Set(String(x || '').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toUpperCase()
      .split(/[^A-Z]+/).filter(w => w.length > 2));
    const clave = x => String(x || '').trim().toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const misTiendas = new Set();
    (estado.sucursales || []).forEach(su => {
      if (clave(su.codigo)) misTiendas.add(clave(su.codigo));
      if (clave(su.nombre)) misTiendas.add(clave(su.nombre));
    });

    return function (f) {
      /* 1. por número —CUIL, y si no, DNI—. 2. por nombre, y solo si no hay
         ambigüedad y la fila es de una tienda del área. */
      const doc = documentoDelFormulario(f.cuil);
      let g = null, via = '';
      if (doc.cuil && porCuil[doc.cuil]) { g = porCuil[doc.cuil]; via = 'cuil'; }
      if (!g && doc.dni && porDni[doc.dni]) { g = porDni[doc.dni]; via = 'dni'; }

      const t = tokens(f.nombre);
      const cand = gente.filter(x => {
        const k = tokens(x.c.nombre);
        let n = 0; t.forEach(w => { if (k.has(w)) n++; });
        return n >= 2;
      });
      const propia = misTiendas.has(clave(f.tienda));

      /* El número manda sobre el nombre: el nombre viene escrito a mano y
         «diaz cyntia» no tiene por qué encontrar a «DIAZ, CYNTHIA». Lo único
         que no se resuelve solo es cuando los dos apuntan, cada uno sin ninguna
         duda, a personas distintas —«Luis Toro» con el número de Juan Gabriel
         Luna—: ahí es un error de carga, y adivinar cuál de los dos vale le
         cuelga la licencia a alguien que no faltó. Un nombre ambiguo, en
         cambio, no contradice nada: pierde contra el número y la fila entra. */
      if (g && cand.length === 1 && cand[0].c.id !== g.c.id) {
        return { g: null, via: '', propia,
                 conflicto: String(f.nombre || '').trim() + ' → ' + g.c.nombre };
      }
      if (!g && cand.length === 1 && propia) { g = cand[0]; via = 'nombre'; }
      return { g, via, propia, conflicto: '' };
    };
  }

  function resguardar(motivo) {
    let crudo = null;
    try { crudo = localStorage.getItem(CLAVE_ALMACEN); } catch (err) { crudo = null; }
    if (!crudo || crudo.length < 200) return false;      // tablero vacío: nada que resguardar

    const lista = leerResguardos();
    if (lista.length && lista[lista.length - 1].datos === crudo) return false;   // sin cambios

    lista.push({
      id: uid(),
      fecha: new Date().toISOString(),
      motivo: motivo || 'Copia del día',
      cifrado: !!cifrador,
      tam: crudo.length,
      datos: crudo
    });
    while (lista.length > MAX_RESGUARDOS) lista.shift();
    return escribirResguardos(lista);
  }

  /* Un resguardo por día alcanza para que un error de hoy no borre lo de ayer,
     sin llenar el almacenamiento con copias de cada apertura. */
  function resguardarPorDia() {
    const hoy = new Date().toISOString().slice(0, 10);
    const lista = leerResguardos();
    const ultimo = lista.length ? lista[lista.length - 1] : null;
    if (ultimo && String(ultimo.fecha).slice(0, 10) === hoy) return false;
    return resguardar('Copia del día');
  }

  return {
    uid,
    init: cargar,
    cifrado: () => !!cifrador,
    /** Texto del último guardado que falló, o '' si todo se está guardando. */
    falloAlGuardar: () => falloAlGuardar,
    get: () => estado,
    save: guardar,

    /** ¿Este navegador nunca guardó nada? Es el arranque en frío. */
    arrancoEnFrio: () => arrancoSinNada,
    onChange: fn => suscriptores.push(fn),

    /* ------------------------- sucursales ------------------------- */
    sucursal(id) { return this.get().sucursales.find(s => s.id === id) || null; },

    /* El código entre paréntesis solo cuando dice algo. «Botánico (BOTANICO)»
       escribe el mismo nombre dos veces en cada fila de las listas; «San
       Martín Center (SM CENTER)» sí avisa cómo se lo llama en el RVD y en la
       nómina, que es distinto. */
    etiquetaSucursal(s) {
      if (!s) return '—';
      const nombre = (s.nombre || '').trim();
      if (!nombre) return s.codigo;
      const plano = x => String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toUpperCase().replace(/\s+/g, ' ').trim();
      return plano(nombre) === plano(s.codigo) ? nombre : `${nombre} (${s.codigo})`;
    },

    agregarSucursal() {
      const e = this.get();
      const usados = e.sucursales
        .map(s => parseInt((s.codigo.match(/^sucursal(\d+)$/) || [])[1], 10))
        .filter(n => !isNaN(n));
      const n = usados.length ? Math.max(...usados) + 1 : 1;
      const s = sucursalNueva({ codigo: 'sucursal' + n });
      e.sucursales.push(s);
      guardar();
      return s;
    },

    eliminarSucursal(id) {
      const e = this.get();
      e.sucursales = e.sucursales.filter(s => s.id !== id);
      e.visitas = e.visitas.filter(v => v.sucursalId !== id);
      guardar();
    },

    /**
     * Incorpora el padrón del Área 3. No pisa lo ya cargado: en las sucursales
     * que ya existen solo completa los campos vacíos.
     */
    cargarPadronArea3() {
      const e = this.get();
      const clave = x => String(x || '').trim().toUpperCase();
      let nuevas = 0, completadas = 0;

      SUCURSALES_AREA3.forEach(fila => {
        const existente = e.sucursales.find(s =>
          clave(s.codigo) === clave(fila.codigo) ||
          (s.nombre && clave(s.nombre) === clave(fila.nombre)));

        if (!existente) {
          const nueva = sucursalNueva(fila);
          e.sucursales.push(nueva);
          nuevas++;
          return;
        }

        let toco = false;
        Object.keys(fila).forEach(k => {
          if (k === 'id') return;
          if (!String(existente[k] ?? '').trim() && String(fila[k] ?? '').trim()) {
            existente[k] = fila[k];
            toco = true;
          }
        });
        if (toco) completadas++;
      });

      guardar();
      return { nuevas, completadas };
    },

    /* --------------------- informe mensual ------------------------ *
       Solo guarda el registro del envío: el contenido se recalcula siempre
       desde las visitas del período, así nunca queda desfasado. */
    informeDe(sucursalId, periodo) {
      return this.get().informes.find(i => i.sucursalId === sucursalId && i.periodo === periodo) || null;
    },

    asegurarInforme(sucursalId, periodo) {
      const e = this.get();
      let i = this.informeDe(sucursalId, periodo);
      if (!i) {
        i = { id: uid(), sucursalId, periodo, enviado: false, fecha: null,
              destinatario: null, via: null, copias: [], historial: [] };
        e.informes.push(i);
        guardar();
      }
      return i;
    },

    /** Períodos con algo cargado —visitas o novedades—, del más reciente al más viejo. */
    periodosDe(sucursalId) {
      const set = {};
      this.get().visitas.forEach(v => {
        if (v.sucursalId === sucursalId && v.periodo) set[v.periodo] = true;
      });
      const s = this.sucursal(sucursalId);
      (s ? s.colaboradores || [] : []).forEach(c =>
        Object.keys(c.novedades || {}).forEach(p => { set[p] = true; }));
      return Object.keys(set).sort().reverse();
    },

    /* ------------------------- colaboradores ---------------------- */
    agregarColaborador(sucursalId, datos) {
      const s = this.sucursal(sucursalId);
      if (!s) return null;
      const c = Object.assign({
        id: uid(), nombre: '', posicion: '', fechaIngreso: '', activo: true,
        legajo: '', cuil: '', sector: '',
        /* Datos que llegan de la nómina */
        dni: '', nroPersonal: '', sexo: '', estatus: '',
        cargo: '', nivelCargo: '', categoriaConvenio: '',
        /* A quién le reporta. La nómina no lo trae: se carga al dar de alta a
           mano y se puede corregir en la ficha. */
        jefe: '',
        unidadNegocio: '', razonSocialContrato: '', direccionArea: '',
        fechaNacimiento: '', fechaIngresoFTD: '',
        email: '', emailCorporativo: '', telefono: '',
        domicilio: '', localidad: '', obraSocial: '',
        estadoCivil: '', nacionalidad: '',
        /* Datos bancarios: solo se muestran plegados en la ficha. */
        banco: '', cbu: '',
        /* Ropa de trabajo: la nómina no la trae, se carga a mano */
        talles: {},
        novedades: {},                    // { '2026-08': { he50, enfermedad, … } }
        licencias: [],                    // art. 25, con su tope anual
        sanciones: [],                    // el legajo disciplinario de la persona
        movimientos: [],                  // traspasos de sucursal y modificaciones de puesto
        ausencias: [],                    // las que tienen certificado, con desde y hasta
        entrenamientos: [],               // la ruta al rol de Senior, con sus evaluaciones
        cargasFamilia: null,              // null = sin definir; duplica los plazos del art. 208
        desempeno: null, potencial: null, fechaEvaluacion: '', evaluadoCon: '',
        estudia: '', carrera: '', avanceEstudio: '', formacionPrevia: '',
        interesDesarrollo: '', aspiracion: '', movilidad: '',
        fortalezas: '', aDesarrollar: '', riesgoSalida: '', notas: '',
        historial: []
      }, datos || {});
      s.colaboradores.push(c);
      guardar();
      return c;
    },

    /* ------------------- ficha del colaborador ------------------- *
       Licencias especiales y sanciones viven en la persona y no en la visita
       ni en el período: el tope de días de estudio es anual y por persona, y
       una sanción del año pasado sigue contando para la progresividad. */
    /* Busca en toda el área. Distinto de colaborador(sucursalId, colabId), que
       pide saber en qué tienda está: la ficha se abre desde el organigrama y
       desde la visita, y ahí solo se tiene el id de la persona. */
    colaboradorPorId(id) {
      let hallado = null;
      this.get().sucursales.forEach(s =>
        (s.colaboradores || []).forEach(c => { if (c.id === id) hallado = c; }));
      return hallado;
    },

    agregarLicencia(colaboradorId, datos) {
      const c = this.colaboradorPorId(colaboradorId);
      if (!c) return null;
      const l = Object.assign({
        id: uid(),
        tipo: LICENCIAS_CCT[0].id,
        desde: new Date().toISOString().slice(0, 10),
        hasta: '',
        dias: '',
        motivo: '',
        comprobante: false,
        nota: ''
      }, datos || {});
      c.licencias.push(l);
      guardar();
      return l;
    },

    quitarLicencia(colaboradorId, licenciaId) {
      const c = this.colaboradorPorId(colaboradorId);
      if (!c) return;
      c.licencias = c.licencias.filter(l => l.id !== licenciaId);
      guardar();
    },

    /* --------------------------- casos ---------------------------- */

    abrirCaso(colaboradorId, datos) {
      const c = this.colaboradorPorId(colaboradorId);
      if (!c) return null;
      if (!Array.isArray(c.casos)) c.casos = [];
      const k = casoNuevo(datos);
      c.casos.push(k);
      guardar();
      return k;
    },

    /**
     * Cambia lo que se edita de un caso. **Cerrar deja la fecha**: un caso sin
     * fecha de cierre no se puede contar ni auditar, y «cuándo se resolvió» es
     * la mitad de la información de un caso resuelto.
     */
    editarCaso(colaboradorId, casoId, cambios) {
      const c = this.colaboradorPorId(colaboradorId);
      const k = c && (c.casos || []).find(x => x.id === casoId);
      if (!k) return null;
      Object.assign(k, cambios || {});
      if (k.estado === 'cerrado' && !k.cerradoEl) k.cerradoEl = _diaHoy();
      if (k.estado !== 'cerrado') k.cerradoEl = '';
      guardar();
      return k;
    },

    /* Cada movimiento del caso queda con su fecha. Es lo que después permite
       reconstruir qué se hizo y cuándo, que es justo lo que no se acuerda nadie
       tres meses más tarde. */
    agregarHitoCaso(colaboradorId, casoId, hito) {
      const c = this.colaboradorPorId(colaboradorId);
      const k = c && (c.casos || []).find(x => x.id === casoId);
      if (!k) return null;
      if (!Array.isArray(k.hitos)) k.hitos = [];
      k.hitos.push({
        id: uid(),
        fecha: (hito && hito.fecha) || _diaHoy(),
        que: (hito && hito.que) || '',
        quien: (hito && hito.quien) || ''
      });
      k.hitos.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
      guardar();
      return k;
    },

    quitarHitoCaso(colaboradorId, casoId, hitoId) {
      const c = this.colaboradorPorId(colaboradorId);
      const k = c && (c.casos || []).find(x => x.id === casoId);
      if (!k) return null;
      k.hitos = (k.hitos || []).filter(x => x.id !== hitoId);
      guardar();
      return k;
    },

    borrarCaso(colaboradorId, casoId) {
      const c = this.colaboradorPorId(colaboradorId);
      if (!c) return false;
      c.casos = (c.casos || []).filter(x => x.id !== casoId);
      guardar();
      return true;
    },

    agregarSancionColaborador(colaboradorId, datos) {
      const c = this.colaboradorPorId(colaboradorId);
      if (!c) return null;
      const x = Object.assign({
        id: uid(),
        fecha: new Date().toISOString().slice(0, 10),
        tipo: 'Apercibimiento',
        motivo: '',
        dias: '',
        notificada: false,
        nota: ''
      }, datos || {});
      c.sanciones.push(x);
      guardar();
      return x;
    },

    quitarSancionColaborador(colaboradorId, sancionId) {
      const c = this.colaboradorPorId(colaboradorId);
      if (!c) return;
      c.sanciones = c.sanciones.filter(x => x.id !== sancionId);
      guardar();
    },

    /**
     * Sanciones que se cargaron en la estadística mensual a nombre de esta
     * persona. Se muestran en su ficha para que el legajo esté completo, pero
     * se editan donde se cargaron: duplicarlas sería peor que no tenerlas.
     */
    sancionesDeEstadistica(nombre) {
      const clave = x => String(x || '').toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z]/g, '');
      const k = clave(nombre);
      if (!k) return [];
      const out = [];
      this.get().visitas.forEach(v =>
        (v.sanciones || []).forEach(x => {
          if (clave(x.nombre) === k) out.push(Object.assign({ periodo: v.periodo, visitaId: v.id }, x));
        }));
      return out.sort((a, b) => String(b.fecha || b.periodo || '').localeCompare(String(a.fecha || a.periodo || '')));
    },

    /* ---------------------------- agenda ---------------------------- *
       Lo que el coordinador lleva: lo suyo, lo que espera de otros, y lo que
       le informaron y no se puede olvidar. Vive en la raíz porque no pertenece
       a una sucursal ni a un período: algo que vence el 14 sigue venciendo el
       14 aunque el mes ya haya cerrado. */
    agregarItem(datos) {
      const e = this.get();
      const i = Object.assign({
        id: uid(),
        titulo: '',
        detalle: '',
        tema: 'otros',
        estado: 'pendiente',
        quien: '',                // con quién es: Compensaciones, un gerente…
        sucursalId: '',
        fecha: new Date().toISOString().slice(0, 10),
        hitos: [],
        avisarEnTienda: false,    // solo esto viaja al reporte diario
        /* Período de liquidación al que hay que pasar esto, '2026-09'. Vacío
           es lo normal: la mayoría de lo que se anota no toca un recibo. */
        liquidacion: '',
        fijado: false,
        creado: new Date().toISOString()
      }, datos || {});
      e.agenda.unshift(i);
      guardar();
      return i;
    },

    item(id) { return this.get().agenda.find(i => i.id === id) || null; },

    eliminarItem(id) {
      const e = this.get();
      e.agenda = e.agenda.filter(i => i.id !== id);
      guardar();
    },

    /**
     * Anota una línea escrita como uno la diría: "llamar a Ana el jueves".
     * Saca la fecha, el tema y si es algo propio o algo que se está esperando.
     */
    anotar(linea, fechaRef) {
      const texto = String(linea || '').trim();
      if (!texto) return null;
      const ref = fechaRef || new Date().toISOString().slice(0, 10);
      return this.agregarItem({
        titulo: texto.slice(0, 140),
        tema: temaDeTexto(texto),
        estado: estadoDeTexto(texto),
        fecha: ref,
        liquidacion: liquidacionDeTexto(texto, ref, this.diaCierreNovedades()),
        hitos: fechasDeTexto(texto, ref)
      });
    },

    /**
     * Anota algo largo pegado tal como llegó —un mensaje de Compensaciones,
     * una minuta—: separa el título del cuerpo y saca todas las fechas.
     */
    anotarTexto(texto, fechaRef) {
      const crudo = String(texto || '').trim();
      if (!crudo) return null;
      const ref = fechaRef || new Date().toISOString().slice(0, 10);
      const titulo = tituloDeTexto(crudo);

      /* Si la primera línea se usó de título, no se repite en el cuerpo. */
      const lineas = crudo.split('\n');
      const iTitulo = lineas.findIndex(l => tituloDeTexto(l) === titulo && titulo);
      const detalle = (iTitulo >= 0 ? lineas.slice(iTitulo + 1) : lineas).join('\n').trim();

      return this.agregarItem({
        titulo: titulo || 'Apunte sin título',
        detalle,
        tema: temaDeTexto(crudo),
        estado: estadoDeTexto(crudo),
        fecha: ref,
        liquidacion: liquidacionDeTexto(crudo, ref, this.diaCierreNovedades()),
        hitos: fechasDeTexto(crudo, ref)
      });
    },

    /** El día de corte configurado, para no repetir el Object.assign en cada uso. */
    diaCierreNovedades() {
      const p = this.get().config.parametros || {};
      return Number(p.diaCierreNovedades) || CIERRE_NOVEDADES_POR_DEFECTO;
    },

    /**
     * Marca —o desmarca— un apunte como novedad a pasar a la liquidación.
     * Se desmarca con la misma acción: un falso positivo del detector que no se
     * pueda sacar ensucia el parte del cierre, que es justo lo que este bloque
     * viene a evitar.
     */
    marcarParaLiquidacion(itemId, periodo) {
      const i = this.item(itemId);
      if (!i) return null;
      i.liquidacion = periodo === undefined
        ? (i.liquidacion ? '' : periodoDeLiquidacion(i.fecha, this.diaCierreNovedades()))
        : (periodo || '');
      guardar();
      return i;
    },

    /** Marca hecho o vuelve a abrir, dejando la fecha de cierre. */
    marcarHecho(id, hecho) {
      const i = this.item(id);
      if (!i) return null;
      i.estado = hecho ? 'hecho' : 'pendiente';
      i.fechaHecho = hecho ? new Date().toISOString().slice(0, 10) : '';
      guardar();
      return i;
    },

    /** Lo que hay que llevar a la tienda: va en el informe del check list. */
    itemsParaTienda(hoyISO) {
      return this.get().agenda.filter(i => i.avisarEnTienda &&
        !(ESTADOS_AGENDA_POR_ID[i.estado] || {}).cerrado);
    },

    /* ------------------------ reporte diario ------------------------ *
       Un registro por día, con la carga de cada sucursal adentro. Se guarda
       por fecha y no por sucursal porque la pregunta del día es del área
       entera: cómo abrió la zona, no cómo abrió una tienda. */
    diarioDe(fecha) {
      return this.get().diarios.find(d => d.fecha === fecha) || null;
    },

    asegurarDiario(fecha) {
      const e = this.get();
      let d = e.diarios.find(x => x.fecha === fecha);
      if (!d) {
        d = { id: uid(), fecha, sucursales: {}, venta: {}, notas: '', creado: new Date().toISOString() };
        e.diarios.push(d);
        e.diarios.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
        guardar();
      }
      return d;
    },

    /** Carga de una sucursal dentro de un día, creándola si hace falta. */
    diarioSucursal(fecha, sucursalId) {
      const d = this.asegurarDiario(fecha);
      if (!d.sucursales[sucursalId]) {
        d.sucursales[sucursalId] = {
          planificados: '', presentes: '', minimo: '',
          horasOrdinarias: '', horasExtras: '', motivoExtras: '',
          ausentes: [], novedades: [], nota: ''
        };
        guardar();
      }
      return d.sucursales[sucursalId];
    },

    eliminarDiario(fecha) {
      const e = this.get();
      e.diarios = e.diarios.filter(d => d.fecha !== fecha);
      guardar();
    },

    /** Fechas cargadas, de la más nueva a la más vieja. */
    fechasDiarias() {
      return this.get().diarios.map(d => d.fecha)
        .sort((a, b) => String(b).localeCompare(String(a)));
    },

    /**
     * Prellena la dotación planificada del día con la del padrón del período,
     * para no tipear doce veces un número que el panel ya tiene. Solo completa
     * lo que está vacío: nunca pisa lo que se cargó a mano.
     */
    prellenarDiario(fecha) {
      const e = this.get();
      const d = this.asegurarDiario(fecha);
      const periodo = String(fecha).slice(0, 7);
      let completadas = 0;

      e.sucursales.forEach(s => {
        const padron = this.dotacionDelPadron(s.id, periodo);
        /* El padrón del período existe recién cuando se importaron las
           novedades de liquidación. Hasta entonces vale el plantel cargado. */
        const heads = (padron && padron.personas)
          ? padron.personas
          : (s.colaboradores || [])
              .filter(c => c.activo !== false && !esNoPresencial(c).noPresencial).length;
        if (!heads) return;
        const x = this.diarioSucursal(fecha, s.id);
        let toco = false;
        if (String(x.planificados || '').trim() === '') { x.planificados = heads; toco = true; }
        /* El mínimo NO se estima: depende de cada tienda —su horario, su
           mostrador, su recetario— y una fracción del plantel daba coberturas
           del 150% que no querían decir nada. Se toma el que el coordinador
           definió una vez para esa sucursal. */
        if (String(x.minimo || '').trim() === '' && s.minimoTurno) {
          x.minimo = s.minimoTurno;
          toco = true;
        }
        if (toco) completadas++;
      });
      guardar();
      return { completadas, total: e.sucursales.length };
    },

    /**
     * Importa el Reporte Diario de Ventas. Cruza cada fila contra el padrón y
     * devuelve lo que no pudo ubicar, en lugar de descartarlo en silencio.
     */
    importarRDV(fecha, texto) {
      const e = this.get();
      const area = String(e.config.area || '').replace(/[^0-9]/g, '');
      const r = interpretarRDV(texto, area || null);
      if (r.error) return { error: r.error, cargadas: 0, sinUbicar: [] };

      const d = this.asegurarDiario(fecha);
      const sinUbicar = [];
      let cargadas = 0;

      r.filas.forEach(f => {
        const s = sucursalDeRDV(f, e.sucursales);
        if (!s) { sinUbicar.push(f.tienda); return; }
        d.venta[s.id] = {
          tienda: f.tienda, ayer: f.ayer, semana: f.semana, mes: f.mes,
          requerido: f.requerido, index: f.index, metaHoy: f.metaHoy,
          transAyer: f.transAyer, transMes: f.transMes
        };
        cargadas++;
      });

      guardar();
      return { error: null, cargadas, sinUbicar, leidas: r.filas.length };
    },

    /* -------------------------- reclamos -------------------------- *
       Se abren en una visita pero no le pertenecen: viven hasta que se
       resuelven. Por eso están en la raíz del estado y no adentro de la
       visita donde se plantearon. */
    agregarReclamo(datos) {
      const e = this.get();
      const r = Object.assign({
        id: uid(),
        sucursalId: '', colaborador: '', colaboradorId: '',
        tipo: TIPOS_RECLAMO[0].id,
        periodoAfectado: '',
        detalle: '',
        monto: '',
        estado: 'abierto',
        fecha: new Date().toISOString().slice(0, 10),
        origenVisitaId: '',
        aCargo: 'rrhh',
        compromisoFecha: '',
        respuesta: '',
        fechaRespuesta: '',
        fechaCierre: '',
        historial: []
      }, datos || {});
      e.reclamos.push(r);
      guardar();
      return r;
    },

    reclamo(id) { return this.get().reclamos.find(r => r.id === id) || null; },

    eliminarReclamo(id) {
      const e = this.get();
      e.reclamos = e.reclamos.filter(r => r.id !== id);
      guardar();
    },

    /** Reclamos de una sucursal, los más nuevos primero. */
    reclamosDe(sucursalId, soloAbiertos) {
      return this.get().reclamos
        .filter(r => r.sucursalId === sucursalId)
        .filter(r => !soloAbiertos || !(ESTADOS_RECLAMO_POR_ID[r.estado] || {}).cerrado)
        .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
    },

    /**
     * Cambia el estado dejando rastro. Cerrar un reclamo sella la fecha, que es
     * lo que después permite saber cuánto se tardó en responder.
     */
    cambiarEstadoReclamo(id, estado, nota) {
      const r = this.reclamo(id);
      if (!r || r.estado === estado) return r;
      const hoy = new Date().toISOString().slice(0, 10);
      r.historial.push({ fecha: hoy, desde: r.estado, hasta: estado, nota: nota || '' });
      r.estado = estado;
      const cerrado = (ESTADOS_RECLAMO_POR_ID[estado] || {}).cerrado;
      r.fechaCierre = cerrado ? (r.fechaCierre || hoy) : '';
      guardar();
      return r;
    },

    /* ---------------------- padrón de personas -------------------- *
       La nómina llega entera, con todas las sucursales juntas, así que el
       importador reparte por la columna TIENDA. A quien no cae en ninguna
       sucursal conocida se le arma una: los flotantes del área son personas
       reales que hay que poder ver. */
    /**
     * Repone el plantel del área desde el archivo del proyecto. Pasa por el
     * mismo importador que la nómina pegada, así que no duplica a nadie: a
     * quien ya está cargado le completa lo que falte y lo mueve si cambió de
     * tienda.
     *
     * Trae lo operativo, no la identidad: el CUIL, el DNI, el teléfono, el
     * domicilio y los mails entran solamente al pegar la nómina.
     */
    cargarPlantelArea3() {
      const filas = PLANTEL_AREA3.map(x => ({
        cuil: '',
        apellido: x.ap || '',
        nombre: x.no || '',
        nombreCompleto: [x.no, x.ap].filter(Boolean).join(' '),
        sexo: x.sx || '',
        tienda: x.t || '',
        categoriaConvenio: x.cat || '',
        cargo: x.cargo || '',
        nivelCargo: x.niv || '',
        fechaIngreso: x.ing || '',
        fechaIngresoFTD: x.ftd || '',
        estatus: x.est || '',
        unidadNegocio: x.uni || '',
        posicion: posicionDeCargo(x.cargo || ''),
        jornada: x.j || 1
      }));
      return this.importarNomina(filas);
    },

    /* ---------- Las ausencias del formulario de recepción ----------
     *
     * Los gerentes cargan las ausencias en un formulario de Google y la
     * planilla de respuestas se pega acá. Cada respuesta es un evento: que la
     * persona faltó. **Cuántos días faltó es otro dato**, y más de la mitad de
     * las respuestas no lo trae: el certificado se carga en un campo de texto
     * libre y mucha gente escribe solo la patología.
     *
     * El que no la trae se toma como un día (`DIAS_SIN_DURACION`) y queda
     * marcado con `diasSupuestos`, así el porcentaje siempre puede decir qué
     * parte de los días se midió y qué parte se supuso.
     *
     * Empareja por **número** —CUIL o DNI, lo que la respuesta traiga—, que es
     * lo único unívoco. El nombre es el respaldo y solo vale si no hay
     * ambigüedad: el formulario lo escribe a mano y aparece «luciana
     * ortellano» y «luiciana ortellano» para la misma persona.
     *
     * La planilla trae las respuestas de **todas las áreas**, y ahí el nombre
     * deja de alcanzar: «Martinez Maria Eugenia» de Walker no es «PEREZ, MARIA
     * EUGENIA» de Scalabrini, pero comparten dos palabras. Por eso una fila
     * cuya tienda no es del área **solo entra si el número coincide**. Eso
     * conserva a quien se mudó al área —Airoldi, Briceño, Díaz, Miglio traen su
     * CUIL— y descarta al homónimo.
     */
    importarAusenciasFormulario(filas) {
      const e = this.get();
      const buscar = buscadorDePadron(e);

      const out = { cargadas: 0, repetidas: 0, completadas: 0, sinDuracion: 0,
                    sinPersona: [], porCuil: 0, porDni: 0, porNombre: 0,
                    tipoDesconocido: 0, apercibimientos: 0,
                    otrasAreas: 0, enConflicto: [] };

      filas.forEach(f => {
        const tipo = motivoDeFormulario(f.tipo);
        if (!tipo) { out.tipoDesconocido++; return; }
        if (!tipo.motivo) { out.apercibimientos++; return; }

        const m = buscar(f);
        if (m.via === 'cuil') out.porCuil++;
        if (m.via === 'dni') out.porDni++;
        if (m.via === 'nombre') out.porNombre++;
        if (m.conflicto) { out.enConflicto.push(m.conflicto); return; }
        if (!m.g) {
          if (m.propia) out.sinPersona.push(String(f.nombre || '').trim());
          else out.otrasAreas++;
          return;
        }
        const g = m.g;

        const anio = /^\d{4}/.test(String(f.marca)) ? +String(f.marca).slice(0, 4)
                   : new Date().getFullYear();
        const leido = tipo.clave === 'certificado'
          ? leerCertificado(f.detalle, anio)
          : { dias: null, desde: null, patologia: '' };

        /* Sin fecha en el texto se usa el día en que se cargó la respuesta: es
           el mismo día o el siguiente, y es mejor que no ubicarla en el
           tiempo. Queda marcado en `fechaAproximada`. */
        const desde = leido.desde || (String(f.marca || '').slice(0, 10) || '');
        if (!desde) return;
        /* El certificado que no dice cuánto dura se toma como un día. Es una
           decisión del coordinador, no una lectura del papel, y por eso queda
           marcada: `diasSupuestos` acompaña a la ausencia para siempre. */
        const dias = leido.dias || DIAS_SIN_DURACION;
        const hasta = _diaMas(desde, dias - 1);

        /* La planilla es un **registro de lo que ya pasó** —arranca en marzo de
           2025— y no una carga en vivo. Una licencia cuyo certificado terminó
           antes de hoy está terminada: la persona volvió hace meses. Sin esto
           las 125 entraban como abiertas y el panel anunciaba 125 ausentes,
           cada una «vencida hace 400 días».
           No se inventa la fecha de reincorporación: `diasDeAusencia()` con
           `reincorporado` y sin fecha se queda con `hasta`, que es exactamente
           lo que dice el papel, así que el ausentismo no cambia. La que sigue
           abierta hoy entra abierta y aparece en el Panel, que es su lugar. */
        const cerrada = !!hasta && hasta < _diaHoy();

        /* La misma persona, el mismo día y el mismo motivo es la misma
           ausencia: el formulario se completa dos veces seguido. Si la que ya
           estaba quedó sin duración —se importó antes de tomar el supuesto—
           se le completa ahora en vez de dejarla a medias. */
        if (!Array.isArray(g.c.ausencias)) g.c.ausencias = [];
        const ya = g.c.ausencias.find(a => a.desde === desde && a.motivo === tipo.motivo);
        if (ya) {
          if (!ya.hasta) {
            ya.hasta = hasta;
            ya.diasSupuestos = !leido.dias;
            if (cerrada) ya.reincorporado = true;
            out.completadas++;
          } else {
            out.repetidas++;
          }
          return;
        }

        g.c.ausencias.push({
          id: uid(), motivo: tipo.motivo, desde, hasta,
          diagnostico: leido.patologia || '',
          /* Vino con el certificado adjunto: el formulario lo pide. */
          certificado: tipo.clave === 'certificado' ? 'si' : '',
          notas: '', reincorporado: cerrada, fechaReincorporacion: '',
          origen: 'formulario',
          fechaAproximada: !leido.desde,
          /* El papel no decía cuántos días: se tomó uno. */
          diasSupuestos: !leido.dias,
          cuentaAusentismo: tipo.ausentismo,
          registradaEl: new Date().toISOString()
        });
        out.cargadas++;
        if (!leido.dias) out.sinDuracion++;
      });

      guardar();
      return out;
    },

    /**
     * El parte de ausentes de cada tienda: quién no está hoy y **hasta cuándo**.
     *
     * A diferencia del formulario de recepción, que es el registro de lo que fue
     * pasando, acá el gerente escribe la fecha de fin. Por eso **nada de lo que
     * entra por acá lleva supuesto**: `diasSupuestos` queda en falso y el
     * ausentismo que sale de estas filas está medido.
     *
     * Actualiza en vez de duplicar: si la persona ya tiene una ausencia abierta
     * del mismo motivo que se solapa con la que viene, se le corrige el `hasta`.
     * Es lo que pasa todos los meses —el gerente manda el parte otra vez con el
     * certificado renovado— y cargarla dos veces contaría los días dos veces.
     */
    importarParteDeAusentes(filas) {
      const e = this.get();
      const buscar = buscadorDePadron(e);
      const hoy = _diaHoy();
      const out = { cargadas: 0, extendidas: 0, repetidas: 0, sinFecha: 0,
                    sinPersona: [], otrasAreas: 0, enConflicto: [],
                    porCuil: 0, porDni: 0, porNombre: 0, abiertas: 0 };

      filas.forEach(f => {
        const desde = fechaDelParte(f.desde);
        if (!desde) { out.sinFecha++; return; }
        const hasta = fechaDelParte(f.hasta);
        /* Sin fecha de fin la ausencia entra igual, abierta: el gerente puede no
           saber cuándo vuelve —una ART recién abierta no tiene alta—. Queda como
           `sinAlta` y el panel la pone arriba de todo pidiendo el dato. */
        if (!hasta) out.abiertas++;

        const m = buscar(f);
        if (m.via === 'cuil') out.porCuil++;
        if (m.via === 'dni') out.porDni++;
        if (m.via === 'nombre') out.porNombre++;
        if (m.conflicto) { out.enConflicto.push(m.conflicto); return; }
        if (!m.g) {
          if (m.propia) out.sinPersona.push(String(f.nombre || '').trim());
          else out.otrasAreas++;
          return;
        }

        const motivo = motivoDelParte(f.motivo);
        const c = m.g.c;
        if (!Array.isArray(c.ausencias)) c.ausencias = [];

        /* La misma licencia que ya estaba: mismo motivo y fechas que se tocan.
           Se le corrige el hasta en vez de sumar una segunda. */
        const ya = c.ausencias.find(a => a.motivo === motivo && !a.reincorporado &&
          a.desde && a.desde <= (hasta || desde) && (!a.hasta || a.hasta >= desde));
        if (ya) {
          if (hasta && ya.hasta !== hasta) { ya.hasta = hasta; ya.diasSupuestos = false; out.extendidas++; }
          else out.repetidas++;
          return;
        }

        c.ausencias.push({
          id: uid(), motivo, desde, hasta: hasta || '',
          diagnostico: '',
          certificado: /^(s|si|sí|x|ok|1|true)$/i.test(String(f.certificado || '').trim()) ? 'si' : '',
          notas: String(f.notas || '').trim(),
          reincorporado: !!hasta && hasta < hoy,
          fechaReincorporacion: '',
          origen: 'parte',
          /* El gerente escribió la fecha de fin: no hay nada supuesto. */
          diasSupuestos: false,
          fechaAproximada: false,
          cuentaAusentismo: motivo !== 'vacaciones',
          registradaEl: new Date().toISOString()
        });
        out.cargadas++;
      });

      guardar();
      return out;
    },

    importarNomina(filas) {
      const e = this.get();
      const clave = t => String(t || '').trim().toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      const buscarSucursal = nombre => {
        const k = clave(nombre);
        if (!k) return null;
        return e.sucursales.find(s =>
          clave(s.codigo) === k || clave(s.nombre) === k ||
          clave(s.codigo).replace(/\s/g, '') === k.replace(/\s/g, '')) || null;
      };

      let nuevos = 0, actualizados = 0, movidos = 0;
      const sucursalesNuevas = [];
      const sinTienda = [];
      const discrepancias = [];
      /* Para poder decir después quién estaba cargado y no vino en la planilla:
         casi siempre es alguien que se fue y quedó figurando en el piso. */
      const tocadas = {};
      const vistos = {};

      (filas || []).forEach(f => {
        let s = buscarSucursal(f.tienda);
        if (!s) {
          if (!f.tienda) { sinTienda.push(nombreDeNomina(f)); return; }
          /* Tiendas que no están en el padrón del área: el grupo de flotantes,
             o una sucursal de otra área donde hay gente asignada. Se crean como
             estructura para que la persona no desaparezca. Los flotantes no son
             una tienda —no abren ni tienen cobertura propia— y por eso quedan
             como staff; una sucursal ajena sí es una tienda. */
          const flotante = /FLOTANTE/i.test(f.tienda);
          s = sucursalNueva({
            codigo: f.tienda.toUpperCase(),
            nombre: f.tienda.replace(/\b\w/g, c => c.toUpperCase()),
            tipo: flotante ? 'staff' : 'venta',
            notas: flotante
              ? 'Gente del área que cubre donde hace falta: no es una tienda, no tiene cobertura propia.'
              : 'Creada al importar la nómina: no figura en el padrón del Área 3.'
          });
          e.sucursales.push(s);
          sucursalesNuevas.push(s.nombre);
        }

        /* Encontrar a la persona que ya está cargada es lo delicado: los dos
           archivos que llegan de Nómina difieren en el CUIL de varias personas
           —dígitos de más, un 2 por un 3—, así que el CUIL no alcanza. Se busca
           en tres pasadas, de la más segura a la menos, y la última se informa
           para que el coordinador la revise.

           Fundir dos personas distintas es peor que dejar una duplicada, así
           que la tercera pasada exige coincidencia de apellido, primer nombre
           y sucursal. */
        const nombre = nombreDeNomina(f);
        const letras = t => clave(t).replace(/[^A-Z]/g, '');
        const partes = t => clave(t).replace(/,/g, ' ').split(/\s+/).filter(Boolean);
        const pf = partes(nombre);

        let c = null, anterior = null, porNombre = false;
        const buscar = criterio => {
          e.sucursales.forEach(x => {
            if (c) return;
            const hallado = (x.colaboradores || []).find(y => criterio(y, x));
            if (hallado) { c = hallado; anterior = x; }
          });
        };

        buscar(y => y.cuil && y.cuil === f.cuil);
        if (!c) buscar(y => y.nombre && letras(y.nombre) === letras(nombre));
        if (!c && pf.length >= 2) {
          buscar((y, x) => {
            if (x.id !== s.id || !y.nombre) return false;
            const py = partes(y.nombre);
            return py.length >= 2 && py[0] === pf[0] && py[1] === pf[1];
          });
          if (c) porNombre = true;
        }
        /* Que dos archivos traigan CUIL distintos para la misma persona es un
           dato para corregir en el origen, así que se informan todos: los que
           se resolvieron por nombre exacto y los que hubo que unificar. */
        if (c && f.cuil && c.cuil && c.cuil !== f.cuil) {
          discrepancias.push({ nombre, guardado: c.cuil, entrante: f.cuil, porNombre });
        }

        if (c && anterior && anterior.id !== s.id) {
          anterior.colaboradores = anterior.colaboradores.filter(y => y.id !== c.id);
          s.colaboradores.push(c);
          movidos++;
        }

        if (!c) {
          c = this.agregarColaborador(s.id, { cuil: f.cuil });
          nuevos++;
        } else {
          actualizados++;
        }

        c.nombre = nombre || c.nombre;
        /* Si el CUIL guardado tiene una cantidad de dígitos rara y el que llega
           tiene once, gana el que llega. */
        if (f.cuil && !f.cuilDudoso && c.cuil !== f.cuil &&
            (!c.cuil || c.cuil.length !== 11)) c.cuil = f.cuil;
        c.nroPersonal = f.nroPersonal || c.nroPersonal;
        if (f.posicion) c.posicion = f.posicion;
        if (f.jornada) c.jornada = f.jornada;

        /* Las fechas de ingreso también difieren entre archivos. Gana la más
           vieja: la antigüedad reconocida no se pierde porque una planilla
           traiga la fecha del último movimiento. */
        const masVieja = (a, b) => (a && b) ? (a < b ? a : b) : (a || b);
        CAMPOS_NOMINA.forEach(k => {
          if (!f[k]) return;
          c[k] = (k === 'fechaIngreso' || k === 'fechaIngresoFTD')
            ? masVieja(c[k], f[k])
            : f[k];
        });
        /* Estar en la nómina es estar en el plantel. El honorario y el que está
           con licencia sin goce siguen siendo gente de la tienda: lo que los
           distingue es el estatus, que se muestra, no que desaparezcan. */
        c.activo = true;
        tocadas[s.id] = true;
        vistos[c.id] = true;
      });

      /* Solo se mira en las tiendas que la planilla trae: si se pegó una parte,
         el resto del área no tiene por qué aparecer como faltante. */
      const noFiguran = [];
      e.sucursales.forEach(s => {
        if (!tocadas[s.id]) return;
        (s.colaboradores || []).forEach(c => {
          if (vistos[c.id] || c.activo === false) return;
          noFiguran.push({ id: c.id, nombre: c.nombre, sucursal: s.nombre || s.codigo });
        });
      });

      guardar();
      return { nuevos, actualizados, movidos, sucursalesNuevas, sinTienda, discrepancias, noFiguran,
               total: (filas || []).length };
    },

    /* ------------------ novedades de liquidación ------------------ *
       Una tanda por sucursal y por mes. La persona se identifica por CUIL;
       si no lo trae, por nombre normalizado. Nunca duplica: si ya está,
       actualiza sus novedades del período y respeta lo cargado a mano
       (posición, evaluación, talent card). */
    /**
     * Importa el libro de novedades **entero**, repartiendo por la columna
     * TIENDA de cada fila.
     *
     * El libro es de toda la empresa —533 filas de cinco áreas— y antes había
     * que abrirlo, separar la hoja de cada tienda y pegar catorce veces. Peor
     * que el trabajo: el importador por tienda **crea** a quien no encuentra,
     * así que una pegada en la sucursal equivocada metía 141 personas donde no
     * van y no había forma de darse cuenta hasta el cierre.
     *
     * Acá no se crea a nadie. La fila que no cae en una persona del padrón se
     * devuelve con nombre y tienda, que es la lista que el coordinador
     * necesita: casi siempre es alguien que se fue o que todavía no pegó la
     * nómina del mes.
     */
    /**
     * Los días que una persona estuvo vinculada dentro del período.
     *
     * Es `movimientoDelMes()`, que es privada del módulo, abierta para que
     * `cierreDelMes()` —que vive en `convenio.js`— use **la misma cuenta** que
     * la matriz de FTE en vez de escribir una parecida. Dos formas de contar
     * los días de un alta terminan difiriendo el día que se toca una.
     */
    diasDeVinculo(colaborador, periodo, diasMes) {
      return movimientoDelMes(colaborador, periodo, diasMes);
    },

    importarLibroDeNovedades(periodo, filas) {
      const e = this.get();
      resguardar('Antes de importar el libro de novedades');
      const buscar = buscadorDePadron(e);
      const norm = t => String(t || '').toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '');

      /* Cada tienda por su nombre y por su código: el libro escribe «SM
         CENTER» donde el panel dice «San Martín Center». */
      const porClave = {};
      (e.sucursales || []).forEach(s => {
        [s.nombre, s.codigo, s.rvd].forEach(x => { if (x) porClave[norm(x)] = s; });
      });

      let actualizados = 0, registradas = 0;
      const sinPersona = [], otrasAreas = [], sinTienda = [], enConflicto = [], diferencias = [];
      const porTienda = {};

      (filas || []).forEach(f => {
        const s = porClave[norm(f.tienda)] || null;
        /* Una fila de otra área se cuenta y se saltea: es ruido esperable del
           libro entero, no un problema que el coordinador tenga que resolver. */
        if (!s) {
          (f.area && norm(f.area) !== norm(e.config.area) ? otrasAreas : sinTienda)
            .push({ nombre: nombreDePlanilla(f), tienda: f.tienda || '', area: f.area || '' });
          return;
        }

        const r = buscar({ cuil: f.cuil, nombre: nombreDePlanilla(f), tienda: f.tienda });
        /* El número y el nombre apuntan cada uno sin dudas a personas
           distintas: es un error de carga del libro y no se adivina cuál vale.
           Es la misma regla de los otros dos importadores. */
        if (r.conflicto) { enConflicto.push(r.conflicto); return; }
        if (!r.g) {
          sinPersona.push({ nombre: nombreDePlanilla(f), tienda: s.nombre || s.codigo });
          return;
        }
        const c = r.g.c;
        if (f.legajo) c.legajo = f.legajo;

        const nov = {};
        CAMPOS_NOVEDAD.forEach(k => { nov[k] = numeroNovedad(f[k]); });
        if (String(f.obs || '').trim()) nov.obs = String(f.obs).trim();
        if (!c.novedades) c.novedades = {};
        c.novedades[periodo] = nov;

        actualizados++;
        registradas += registrarLicenciasDelLibro(c, periodo, nov, diferencias);
        const k = s.nombre || s.codigo;
        porTienda[k] = (porTienda[k] || 0) + 1;
      });

      guardar();
      return { periodo, actualizados, registradas, porTienda, sinPersona, sinTienda, enConflicto, diferencias,
               otrasAreas: otrasAreas.length, leidas: (filas || []).length };
    },

    importarNovedades(sucursalId, periodo, filas) {
      const e = this.get();
      const s = this.sucursal(sucursalId);
      if (!s) return null;
      const clave = t => String(t || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');

      let nuevos = 0, actualizados = 0;
      const sinPosicion = [];

      const enOtraTienda = [];

      (filas || []).forEach(f => {
        const nombre = nombreDePlanilla(f);
        let c = f.cuil ? s.colaboradores.find(x => x.cuil === f.cuil) : null;
        if (!c) c = s.colaboradores.find(x => clave(x.nombre) === clave(nombre));

        /* Antes de crear a nadie, buscarla en **toda el área**. Buscar solo
           dentro de la tienda era la fábrica de duplicados del panel: la hoja
           del libro dice dónde trabajó ese mes y el padrón dice dónde está
           cargada, y cuando difieren —un traspaso que todavía no se aplicó—
           se creaba una segunda persona con el mismo nombre. Se usa la que ya
           existe y **no se la muda**: dónde está cargada lo decide el
           traspaso, no la planilla del mes. */
        if (!c) {
          let otra = null, suTienda = null;
          e.sucursales.forEach(x => {
            if (otra || x.id === s.id) return;
            const h = (x.colaboradores || []).find(y =>
              (f.cuil && y.cuil === f.cuil) || (y.nombre && clave(y.nombre) === clave(nombre)));
            if (h) { otra = h; suTienda = x; }
          });
          if (otra) {
            c = otra;
            enOtraTienda.push({ nombre: otra.nombre, tienda: suTienda.nombre || suTienda.codigo });
          }
        }

        if (!c) {
          c = this.agregarColaborador(sucursalId, { nombre, cuil: f.cuil });
          nuevos++;
        } else {
          actualizados++;
          if (!c.nombre) c.nombre = nombre;
          if (!c.cuil && f.cuil) c.cuil = f.cuil;
        }
        if (f.legajo) c.legajo = f.legajo;
        if (f.sector) c.sector = f.sector;
        c.activo = true;

        const nov = {};
        CAMPOS_NOVEDAD.forEach(k => { nov[k] = numeroNovedad(f[k]); });
        if (String(f.obs || '').trim()) nov.obs = String(f.obs).trim();
        c.novedades[periodo] = nov;

        if (!c.posicion) sinPosicion.push(c.nombre);
      });

      /* Quien estaba en el plantel y no vino en la planilla del mes queda
         marcado para revisar: puede ser una baja, o una hoja incompleta. */
      const vistos = (filas || []).map(f => f.cuil).filter(Boolean);
      const ausentesDelPadron = s.colaboradores
        .filter(c => c.activo !== false && c.cuil && vistos.indexOf(c.cuil) < 0)
        .map(c => c.nombre);

      guardar();
      return { nuevos, actualizados, sinPosicion, ausentesDelPadron, enOtraTienda,
               total: (filas || []).length };
    },

    /**
     * Dotación del mes agrupada por posición, a partir del plantel y de las
     * novedades importadas. Es lo que llena la matriz de FTE sin recargar nada.
     */
    /**
     * Dotación de una sucursal tal como está cargado el plantel, sin depender
     * de que se hayan importado las novedades del mes. Es la respuesta a “¿con
     * cuánta gente cuento?”, que es lo primero que pregunta Operaciones.
     *
     * Suma en FTE, no en cabezas: dos personas de tiempo parcial son un FTE.
     * Quien tiene bloqueo de título o figura como no presencial queda aparte,
     * porque presta la habilitación pero no cubre turno.
     */
    dotacionPlantel(sucursalId) {
      const s = this.sucursal(sucursalId);
      if (!s) return null;
      const r = {
        personas: 0, fte: 0, parciales: 0,
        noPresenciales: [], fteNoPresencial: 0,
        sinActividad: [],                  // licencia sin goce: vuelve, pero hoy no está
        bajas: [],                         // se fue: ya no es de la tienda
        porUnidad: {}, porPosicion: {}
      };
      (s.colaboradores || []).forEach(c => {
        const j = jornadaDeVinculo(c);
        const np = esNoPresencial(c);
        if (np.noPresencial) {
          r.noPresenciales.push({ id: c.id, nombre: c.nombre, cargo: c.cargo, motivo: np.motivo, fte: j.fte });
          r.fteNoPresencial += j.fte;
          return;
        }
        /* Una baja y una licencia sin goce vacían el puesto igual, pero no son
           lo mismo: de la licencia se vuelve. Van separadas porque la baja se
           corrige desde el listado y la licencia se espera. */
        if (c.activo === false) {
          r.bajas.push({ id: c.id, nombre: c.nombre, cargo: c.cargo,
                         fecha: (c.baja || {}).fecha || '', motivo: (c.baja || {}).motivo || '' });
          return;
        }
        if (/SINGOCE/.test(String(c.estatus || '')
              .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, ''))) {
          r.sinActividad.push({ id: c.id, nombre: c.nombre, motivo: 'Licencia sin goce de sueldo' });
          return;
        }
        r.personas++;
        r.fte += j.fte;
        if (j.parcial) r.parciales++;
        const u = c.unidadNegocio || 'Sin unidad';
        r.porUnidad[u] = (r.porUnidad[u] || 0) + j.fte;
        const pos = c.posicion || 'sinPosicion';
        r.porPosicion[pos] = (r.porPosicion[pos] || 0) + j.fte;
      });
      return r;
    },

    /** La misma cuenta para toda el área, separando lo que no es una tienda. */
    dotacionDelArea() {
      const e = this.get();
      const t = {
        tiendas: 0, personas: 0, fte: 0, parciales: 0,
        noPresenciales: 0, fteNoPresencial: 0, sinActividad: 0, bajas: 0,
        flotantes: 0, fteFlotante: 0,
        sucursalesSinPlantel: [], porSucursal: {}
      };
      e.sucursales.forEach(s => {
        const d = this.dotacionPlantel(s.id);
        t.porSucursal[s.id] = d;
        t.noPresenciales += d.noPresenciales.length;
        t.fteNoPresencial += d.fteNoPresencial;
        t.sinActividad += d.sinActividad.length;
        t.bajas += d.bajas.length;
        /* Lo que la nómina llama “flotantes” no es una tienda: es gente del
           área que cubre donde hace falta. Suma al área, no a una sucursal. */
        if (s.tipo === 'staff') {
          t.flotantes += d.personas;
          t.fteFlotante += d.fte;
          return;
        }
        t.tiendas++;
        t.personas += d.personas;
        t.fte += d.fte;
        t.parciales += d.parciales;
        if (!d.personas && !d.noPresenciales.length) t.sucursalesSinPlantel.push(s.nombre || s.codigo);
      });
      return t;
    },

    dotacionDelPadron(sucursalId, periodo) {
      const s = this.sucursal(sucursalId);
      if (!s) return null;
      const porPosicion = {};
      const sinPosicion = [];
      let personas = 0;
      const detalle = {};
      /* El bloqueo de título y los no presenciales cuentan para el costo pero
         no para la cobertura: no cubren un turno ni reemplazan una ausencia. */
      const noPresenciales = [];
      const altas = [], bajas = [];
      const diasMes = (this.get().config.parametros || PARAMETROS_DEFECTO).diasMes ||
                      PARAMETROS_DEFECTO.diasMes;

      (s.colaboradores || []).forEach(c => {
        const nov = (c.novedades || {})[periodo];
        if (!nov) return;

        const np = esNoPresencial(c);
        if (np.noPresencial) {
          noPresenciales.push({ nombre: c.nombre, motivo: np.motivo, cargo: c.cargo });
          return;
        }
        personas++;

        const porCod = ausenciasPorCodigo(nov);
        Object.keys(porCod).forEach(cod => { detalle[cod] = (detalle[cod] || 0) + porCod[cod]; });

        if (!c.posicion) { sinPosicion.push(c.nombre); return; }
        const p = porPosicion[c.posicion] || (porPosicion[c.posicion] =
          { heads: 0, headsAltas: 0, diasAltas: 0, diasBajas: 0, diasAusentes: 0, horasExtras: 0 });

        /* Quien entró o se fue durante el mes no tuvo vínculo los 30 días: va
           con los días que alcanzó a trabajar, no como dotación estable. Ponerlo
           en las dos partes es el error que infla el FTE, y hasta ahora el
           prellenado lo inducía. */
        const mov = movimientoDelMes(c, periodo, diasMes);
        if (mov.tipo === 'alta') { p.diasAltas += mov.dias; p.headsAltas++; altas.push({ nombre: c.nombre, dias: mov.dias }); }
        else if (mov.tipo === 'baja') { p.diasBajas += mov.dias; bajas.push({ nombre: c.nombre, dias: mov.dias }); }
        else p.heads++;

        p.horasExtras += numeroNovedad(nov.he50) + numeroNovedad(nov.he100);
        p.diasAusentes += MAPA_AUSENCIAS.reduce((a, m) => a + numeroNovedad(nov[m.campo]), 0);
      });

      return { porPosicion, sinPosicion, personas, noPresenciales, detalle, periodo, altas, bajas,
               /* Lo que hay que mirar cuando la pregunta es el costo. */
               personasConNoPresenciales: personas + noPresenciales.length };
    },

    /** Vuelca esa dotación en la matriz de FTE y en el ausentismo de la visita. */
    aplicarPadronAVisita(visitaId) {
      const v = this.visita(visitaId);
      if (!v) return null;
      const d = this.dotacionDelPadron(v.sucursalId, v.periodo);
      if (!d || !d.personas) return null;

      v.posiciones.forEach(fila => {
        const p = d.porPosicion[fila.rol];
        fila.heads = p ? p.heads : '';
        fila.headsAltas = p && p.headsAltas ? p.headsAltas : '';
        fila.diasAltas = p && p.diasAltas ? p.diasAltas : '';
        fila.diasBajas = p && p.diasBajas ? p.diasBajas : '';
        fila.diasAusentes = p && p.diasAusentes ? p.diasAusentes : '';
        fila.horasExtras = p && p.horasExtras ? p.horasExtras : '';
      });
      v.ausentismo.detalle = Object.assign({}, v.ausentismo.detalle, d.detalle);

      guardar();
      return d;
    },

    /**
     * Personas cargadas dos veces: el mismo CUIL, el mismo DNI o el mismo
     * nombre en dos fichas distintas.
     *
     * Existe porque el panel las fabricaba: hasta que se arregló, pegar la
     * hoja de novedades de una tienda creaba una ficha nueva para quien
     * estuviera cargado en otra —el caso de cualquiera con un traspaso sin
     * aplicar—. Detectarlas no alcanza: hay que poder unirlas sin perder lo
     * que cada ficha juntó.
     */
    duplicados() {
      const e = this.get();
      const gente = [];
      e.sucursales.forEach(s => (s.colaboradores || []).forEach(c => gente.push({ c, s })));
      const norm = x => String(x || '').toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z]/g, '');
      const dig = x => String(x == null ? '' : x).replace(/\D/g, '');

      const grupos = {};
      gente.forEach(g => {
        /* La clave más fuerte que tenga: el número identifica mejor que el
           nombre, que se escribe a mano y se repite entre hermanos. */
        const cu = dig(g.c.cuil), dn = dig(g.c.dni);
        const k = cu.length === 11 ? 'cuil:' + cu
                : dn.length >= 7 ? 'dni:' + dn
                : 'nombre:' + norm(g.c.nombre);
        if (!k || k === 'nombre:') return;
        (grupos[k] = grupos[k] || []).push(g);
      });

      /* Y una segunda pasada por nombre, para los que quedaron con números
         distintos: dos fichas con el mismo nombre en el área son una sola
         persona salvo homonimia, y esa el coordinador la ve en la lista. */
      const porNombre = {};
      gente.forEach(g => {
        const k = norm(g.c.nombre);
        if (k) (porNombre[k] = porNombre[k] || []).push(g);
      });

      const vistos = {};
      const salida = [];
      const agregar = lista => {
        if (lista.length < 2) return;
        const ids = lista.map(x => x.c.id).sort().join('|');
        if (vistos[ids]) return;
        vistos[ids] = true;
        salida.push({
          nombre: lista[0].c.nombre,
          fichas: lista.map(x => ({
            id: x.c.id, sucursal: x.s.nombre || x.s.codigo, sucursalId: x.s.id,
            cuil: x.c.cuil || '', activo: x.c.activo !== false,
            /* Con qué se quedó cada ficha: es lo que decide cuál conviene
               conservar y qué habría que mover. */
            ausencias: (x.c.ausencias || []).length,
            novedades: Object.keys(x.c.novedades || {}).length,
            movimientos: (x.c.movimientos || []).length,
            evaluada: !!(x.c.desempeno && x.c.potencial)
          }))
        });
      };
      Object.keys(grupos).forEach(k => agregar(grupos[k]));
      Object.keys(porNombre).forEach(k => agregar(porNombre[k]));
      return salida;
    },

    /**
     * Une dos fichas de la misma persona en una.
     *
     * Lo que se junta se junta —ausencias, novedades, movimientos, licencias,
     * casos, entrenamientos, sanciones— y lo que es un dato único se completa
     * solo donde falta: la ficha que se conserva no pierde nada y la otra no
     * deja nada atrás. Las ausencias se deduplican por motivo y fecha, que es
     * lo que se repite cuando la misma licencia entró por las dos fichas.
     */
    unirColaboradores(idQueda, idSeVa) {
      if (idQueda === idSeVa) return null;
      const a = this.colaboradorPorId(idQueda), b = this.colaboradorPorId(idSeVa);
      if (!a || !b) return null;
      resguardar('Antes de unir dos fichas');

      ['ausencias', 'movimientos', 'licencias', 'casos', 'entrenamientos', 'sanciones'].forEach(k => {
        if (!Array.isArray(b[k]) || !b[k].length) return;
        if (!Array.isArray(a[k])) a[k] = [];
        b[k].forEach(x => {
          const igual = k === 'ausencias'
            ? a[k].some(y => y.motivo === x.motivo && y.desde === x.desde && y.hasta === x.hasta)
            : a[k].some(y => y.id && y.id === x.id);
          if (!igual) a[k].push(x);
        });
      });

      a.novedades = Object.assign({}, b.novedades || {}, a.novedades || {});
      if (!a.baja && b.baja) a.baja = b.baja;
      /* Los campos sueltos: se completan donde la ficha que queda está vacía,
         nunca se pisan. */
      Object.keys(b).forEach(k => {
        if (['id', 'ausencias', 'movimientos', 'licencias', 'casos', 'entrenamientos',
             'sanciones', 'novedades', 'baja'].indexOf(k) >= 0) return;
        const v = b[k];
        if (v === '' || v === null || v === undefined) return;
        if (a[k] === '' || a[k] === null || a[k] === undefined) a[k] = v;
      });

      const s = this.sucursalDe(idSeVa);
      if (s) s.colaboradores = s.colaboradores.filter(x => x.id !== idSeVa);
      guardar();
      return a;
    },

    /* ------------------- curso de ADEF (art. 8) -------------------- */

    /**
     * Anota en qué anda con el curso de ADEF.
     *
     * Vive en `c.adef` y no en cuatro campos sueltos porque es una sola
     * respuesta con su fecha y su nota, y porque así acompaña a la persona
     * cuando la trasladan, igual que `c.baja`, `c.ausencias` o
     * `c.entrenamientos`.
     *
     * Un estado vacío **borra el relevamiento** en vez de guardar una respuesta
     * en blanco: volver a «sin relevar» es una respuesta válida cuando algo se
     * marcó por error, y dejar un objeto vacío lo contaría como relevado.
     */
    marcarAdef(colabId, datos) {
      const c = this.colaboradorPorId(colabId);
      if (!c) return null;
      const d = Object.assign({}, c.adef || {}, datos || {});
      if (!d.estado) { delete c.adef; guardar(); return null; }
      d.relevadoEl = d.relevadoEl || new Date().toISOString().slice(0, 10);
      c.adef = d;
      guardar();
      return d;
    },

    /* ------------------------ ausencias --------------------------- */

    /**
     * Anota una ausencia con certificado. La fecha de alta puede faltar —el
     * certificado a veces no la trae— y en ese caso el panel avisa igual,
     * porque una ausencia sin fecha de vuelta es la que más se olvida.
     */
    agregarAusencia(colabId, datos) {
      const c = this.colaboradorPorId(colabId);
      if (!c) return null;
      if (!Array.isArray(c.ausencias)) c.ausencias = [];
      const a = Object.assign({
        id: uid(),
        desde: '', hasta: '', motivo: 'enfermedad',
        diagnostico: '', certificado: '', notas: '',
        reincorporado: false, fechaReincorporacion: '',
        registradaEl: new Date().toISOString()
      }, datos || {});
      c.ausencias.push(a);
      guardar();
      return a;
    },

    ausencia(colabId, ausenciaId) {
      const c = this.colaboradorPorId(colabId);
      return c ? ((c.ausencias || []).find(a => a.id === ausenciaId) || null) : null;
    },

    /** Marca la vuelta. Si no se aclara el día, se toma el alta del certificado. */
    reincorporar(colabId, ausenciaId, fecha) {
      const a = this.ausencia(colabId, ausenciaId);
      if (!a) return null;
      a.reincorporado = true;
      a.fechaReincorporacion = fecha || a.hasta || new Date().toISOString().slice(0, 10);
      guardar();
      return a;
    },

    /** Extiende el certificado. La ausencia sigue siendo la misma: el vínculo
        con el art. 208 se cuenta desde el primer día, no desde el último parte. */
    extenderAusencia(colabId, ausenciaId, hasta) {
      const a = this.ausencia(colabId, ausenciaId);
      if (!a) return null;
      a.hasta = hasta;
      a.reincorporado = false;
      guardar();
      return a;
    },

    quitarAusencia(colabId, ausenciaId) {
      const c = this.colaboradorPorId(colabId);
      if (!c) return;
      c.ausencias = (c.ausencias || []).filter(a => a.id !== ausenciaId);
      guardar();
    },

    /* ------------------ entrenamientos a Senior ------------------- *
       Lo que se guarda es la trazabilidad: quién lo propuso y cuándo, cuándo
       arrancó, hasta cuándo se estima, y cada evaluación con el nivel de
       competencia que se le reconoció. Nada se pisa: una evaluación nueva se
       suma, no reemplaza a la anterior. */

    proponerEntrenamiento(colabId, datos) {
      const c = this.colaboradorPorId(colabId);
      if (!c) return null;
      if (!Array.isArray(c.entrenamientos)) c.entrenamientos = [];
      const hoy = new Date().toISOString().slice(0, 10);
      const ent = Object.assign({
        id: uid(),
        rol: 'APV Senior',
        estado: 'propuesto',
        propuestoPor: '',
        fechaPropuesta: hoy,
        /* La tienda donde lo propusieron. Se guarda como dato del
           entrenamiento porque la persona puede mudarse antes de cerrarlo y
           entonces la ficha ya no dice dónde empezó esto. */
        sucursalIdPropuesta: (this.sucursalDe(colabId) || {}).id || '',
        fechaInicio: '',
        finTentativo: '',
        motivo: '',
        fechaCierre: '',
        resultado: '',
        notaCierre: '',
        evaluaciones: [],
        registradoEl: new Date().toISOString()
      }, datos || {});
      c.entrenamientos.push(ent);
      guardar();
      return ent;
    },

    entrenamiento(colabId, entId) {
      const c = this.colaboradorPorId(colabId);
      return c ? ((c.entrenamientos || []).find(x => x.id === entId) || null) : null;
    },

    /** Busca el entrenamiento en toda el área: la pantalla lo abre por su id. */
    entrenamientoPorId(entId) {
      let hallado = null;
      this.get().sucursales.forEach(s =>
        (s.colaboradores || []).forEach(c =>
          (c.entrenamientos || []).forEach(x => {
            if (x.id === entId) hallado = { colaborador: c, sucursal: s, entrenamiento: x };
          })));
      return hallado;
    },

    actualizarEntrenamiento(colabId, entId, datos) {
      const ent = this.entrenamiento(colabId, entId);
      if (!ent) return null;
      Object.assign(ent, datos || {});
      guardar();
      return ent;
    },

    /**
     * Arranca el entrenamiento. Si no se aclara hasta cuándo, propone tres
     * meses: es el plazo con el que se viene trabajando y una fecha tentativa
     * puesta es lo que después hace que el panel avise; sin ella el
     * entrenamiento se estira sin que nadie lo note.
     */
    iniciarEntrenamiento(colabId, entId, fechaInicio, finTentativo) {
      const ent = this.entrenamiento(colabId, entId);
      if (!ent) return null;
      ent.estado = 'entrenamiento';
      ent.fechaInicio = fechaInicio || ent.fechaInicio || new Date().toISOString().slice(0, 10);
      ent.finTentativo = finTentativo || ent.finTentativo ||
        _sumarMeses(ent.fechaInicio, MESES_ENTRENAMIENTO);
      guardar();
      return ent;
    },

    cerrarEntrenamiento(colabId, entId, datos) {
      const ent = this.entrenamiento(colabId, entId);
      if (!ent) return null;
      ent.estado = 'cerrado';
      ent.resultado = (datos && datos.resultado) || 'efectivo';
      ent.fechaCierre = (datos && datos.fecha) || new Date().toISOString().slice(0, 10);
      ent.notaCierre = (datos && datos.nota) || ent.notaCierre || '';
      guardar();
      return ent;
    },

    /** Vuelve a abrir un entrenamiento cerrado por error. */
    reabrirEntrenamiento(colabId, entId) {
      const ent = this.entrenamiento(colabId, entId);
      if (!ent) return null;
      ent.estado = ent.fechaInicio ? 'entrenamiento' : 'propuesto';
      ent.resultado = '';
      ent.fechaCierre = '';
      guardar();
      return ent;
    },

    agregarEvaluacionEntrenamiento(colabId, entId, datos) {
      const ent = this.entrenamiento(colabId, entId);
      if (!ent) return null;
      if (!Array.isArray(ent.evaluaciones)) ent.evaluaciones = [];
      const ev = Object.assign({
        id: uid(),
        fecha: new Date().toISOString().slice(0, 10),
        instancia: 'mensual',
        evaluadaCon: '',            // el gerente con quien se hizo la conversación
        niveles: {},                // { competenciaId: nivel alcanzado }
        comoLeFue: '',
        proximoPaso: ''
      }, datos || {});
      ent.evaluaciones.push(ev);
      guardar();
      return ev;
    },

    quitarEvaluacionEntrenamiento(colabId, entId, evId) {
      const ent = this.entrenamiento(colabId, entId);
      if (!ent) return;
      ent.evaluaciones = (ent.evaluaciones || []).filter(x => x.id !== evId);
      guardar();
    },

    quitarEntrenamiento(colabId, entId) {
      const c = this.colaboradorPorId(colabId);
      if (!c) return;
      c.entrenamientos = (c.entrenamientos || []).filter(x => x.id !== entId);
      guardar();
    },

    /* ------------------- bajas y movimientos ---------------------- */

    /**
     * Registra la baja de una persona. No la borra: la saca del piso y la deja
     * en el listado de bajas con su motivo, que es lo que después alimenta la
     * rotación del mes y la conversación con Operaciones.
     */
    registrarBaja(colabId, datos) {
      const c = this.colaboradorPorId(colabId);
      if (!c) return null;
      c.baja = {
        fecha: (datos && datos.fecha) || new Date().toISOString().slice(0, 10),
        grupo: (datos && datos.grupo) || '',
        motivo: (datos && datos.motivo) || '',
        observaciones: (datos && datos.observaciones) || '',
        /* Los trámites arrancan con la baja y no antes: son lo que hay que
           hacer a partir de que la persona se va. Se guardan como objeto y no
           como lista de los hechos para poder anotar la fecha y una nota en
           cada uno. */
        tramites: {},
        cerradaEl: '',
        registradaEl: new Date().toISOString()
      };
      c.activo = false;
      guardar();
      return c.baja;
    },

    /* ------------------- los trámites de la baja ------------------ *
       La persona deja de venir el día de la baja, pero el proceso sigue
       abierto hasta que están los cinco. El que se olvida aparece semanas
       después: alguien que conserva accesos, un recibo liquidado de más. */

    marcarTramiteBaja(colabId, tramiteId, hecho) {
      const c = this.colaboradorPorId(colabId);
      if (!c || !c.baja) return null;
      if (!c.baja.tramites || typeof c.baja.tramites !== 'object') c.baja.tramites = {};
      const t = c.baja.tramites;
      if (hecho === false || (hecho === undefined && t[tramiteId] && t[tramiteId].hecho)) {
        /* Se destilda pero queda la nota: si alguien escribió «lo pidió Ana el
           martes», esa frase sigue valiendo aunque el trámite se reabra. */
        t[tramiteId] = Object.assign({}, t[tramiteId], { hecho: false, fecha: '' });
      } else {
        t[tramiteId] = Object.assign({ nota: '' }, t[tramiteId], {
          hecho: true, fecha: new Date().toISOString().slice(0, 10)
        });
      }
      guardar();
      return t[tramiteId];
    },

    anotarTramiteBaja(colabId, tramiteId, nota) {
      const c = this.colaboradorPorId(colabId);
      if (!c || !c.baja) return null;
      if (!c.baja.tramites || typeof c.baja.tramites !== 'object') c.baja.tramites = {};
      const t = c.baja.tramites;
      t[tramiteId] = Object.assign({ hecho: false, fecha: '' }, t[tramiteId], { nota });
      guardar();
      return t[tramiteId];
    },

    /** Cierra el proceso. Que falte algún trámite lo decide y lo avisa la
        pantalla: acá no se bloquea, porque a veces un trámite no aplica. */
    cerrarProcesoBaja(colabId, fecha) {
      const c = this.colaboradorPorId(colabId);
      if (!c || !c.baja) return null;
      c.baja.cerradaEl = fecha || new Date().toISOString().slice(0, 10);
      guardar();
      return c.baja;
    },

    reabrirProcesoBaja(colabId) {
      const c = this.colaboradorPorId(colabId);
      if (!c || !c.baja) return null;
      c.baja.cerradaEl = '';
      guardar();
      return c.baja;
    },

    /** Deshace una baja cargada por error: vuelve al plantel de su sucursal. */
    revertirBaja(colabId) {
      const c = this.colaboradorPorId(colabId);
      if (!c) return;
      delete c.baja;
      c.activo = true;
      guardar();
    },

    /** Todas las bajas del área, de la más reciente a la más vieja. */
    bajas() {
      const out = [];
      this.get().sucursales.forEach(s => {
        (s.colaboradores || []).forEach(c => {
          if (c.baja) out.push({ colaborador: c, sucursal: s, baja: c.baja });
        });
      });
      return out.sort((a, b) => String(b.baja.fecha || '').localeCompare(String(a.baja.fecha || '')));
    },

    /**
     * Anota un traspaso de sucursal o una modificación de puesto. Queda
     * pendiente: recién al autorizarlo se toca el plantel.
     */
    registrarMovimiento(colabId, datos) {
      const c = this.colaboradorPorId(colabId);
      if (!c) return null;
      const s = this.sucursalDe(colabId);
      /* Las fichas cargadas antes de que existieran los movimientos no traen el
         arreglo: se crea al vuelo en vez de fallar. */
      if (!Array.isArray(c.movimientos)) c.movimientos = [];
      const m = Object.assign({
        id: uid(),
        tipo: 'traspaso',
        fecha: new Date().toISOString().slice(0, 10),
        vigencia: '',
        desdeSucursalId: s ? s.id : '',
        haciaSucursalId: '',
        /* Si el traspaso lleva cesión de contrato. Es una pregunta del alta y
           no algo que el panel deduzca solo: la razón social de las dos
           tiendas lo sugiere, pero quien sabe si hay que instrumentarla es el
           coordinador. `null` es «todavía no se contestó». */
        conCesion: null,
        cargoAnterior: c.cargo || '',
        cargoNuevo: '',
        jornadaAnterior: jornadaDeVinculo(c).fte,
        jornadaNueva: '',
        observaciones: '',
        estado: 'pendiente',
        autorizadoEl: '', aplicadoEl: ''
      }, datos || {});
      c.movimientos.push(m);
      guardar();
      return m;
    },

    /**
     * Autoriza el movimiento y, si ya está vigente, lo aplica. Lo que vence más
     * adelante queda autorizado y se aplica el día que corresponde, para que el
     * plantel de hoy no muestre a alguien en una tienda a la que todavía no fue.
     */
    autorizarMovimiento(colabId, movId) {
      const m = this.movimiento(colabId, movId);
      if (!m || m.estado === 'anulada') return null;
      m.estado = 'autorizada';
      m.autorizadoEl = new Date().toISOString();
      guardar();
      if (!m.vigencia || m.vigencia <= new Date().toISOString().slice(0, 10)) {
        this.aplicarMovimiento(colabId, movId);
      }
      return m;
    },

    /** Vuelca el movimiento sobre la ficha: mueve de tienda o cambia el puesto. */
    aplicarMovimiento(colabId, movId) {
      const m = this.movimiento(colabId, movId);
      const c = this.colaboradorPorId(colabId);
      if (!m || !c || m.estado === 'aplicada' || m.estado === 'anulada') return null;

      if (esTraspaso(m.tipo) && m.haciaSucursalId) {
        const origen = this.sucursalDe(colabId);
        const destino = this.sucursal(m.haciaSucursalId);
        if (origen && destino && origen.id !== destino.id) {
          origen.colaboradores = origen.colaboradores.filter(x => x.id !== c.id);
          destino.colaboradores.push(c);
        }
      } else if (m.tipo === 'modificacion') {
        if (m.cargoNuevo) {
          c.cargo = m.cargoNuevo;
          c.posicion = posicionDeCargo(m.cargoNuevo) || c.posicion;
        }
        if (m.jornadaNueva) c.jornada = Number(m.jornadaNueva);
      }
      m.estado = 'aplicada';
      m.aplicadoEl = new Date().toISOString();
      guardar();
      return m;
    },

    anularMovimiento(colabId, movId) {
      const m = this.movimiento(colabId, movId);
      if (!m) return;
      /* Un movimiento ya aplicado no se deshace desde acá: habría que mover a
         la persona de vuelta y eso se registra como un movimiento nuevo. */
      if (m.estado === 'aplicada') return;
      m.estado = 'anulada';
      guardar();
    },

    movimiento(colabId, movId) {
      const c = this.colaboradorPorId(colabId);
      return c ? ((c.movimientos || []).find(m => m.id === movId) || null) : null;
    },

    /**
     * Aplica lo que quedó autorizado con vigencia futura y ya llegó su día. Se
     * corre al abrir el panel: si no, alguien autorizado en agosto para empezar
     * en diciembre seguiría figurando en la tienda vieja para siempre.
     */
    aplicarMovimientosVencidos() {
      const hoy = new Date().toISOString().slice(0, 10);
      const aplicados = [];
      this.movimientos().forEach(({ colaborador: c, mov: m }) => {
        if (m.estado === 'autorizada' && m.vigencia && m.vigencia <= hoy) {
          this.aplicarMovimiento(c.id, m.id);
          aplicados.push({ nombre: c.nombre, tipo: m.tipo, vigencia: m.vigencia });
        }
      });
      return aplicados;
    },

    /** Todos los movimientos del área, del más reciente al más viejo. */
    movimientos() {
      const out = [];
      this.get().sucursales.forEach(s => {
        (s.colaboradores || []).forEach(c => {
          (c.movimientos || []).forEach(m => out.push({ colaborador: c, sucursal: s, mov: m }));
        });
      });
      return out.sort((a, b) =>
        String(b.mov.vigencia || b.mov.fecha || '').localeCompare(String(a.mov.vigencia || a.mov.fecha || '')));
    },

    /** La sucursal donde está cargada una persona. */
    sucursalDe(colabId) {
      return this.get().sucursales.find(s =>
        (s.colaboradores || []).some(c => c.id === colabId)) || null;
    },

    colaborador(sucursalId, colabId) {
      const s = this.sucursal(sucursalId);
      return s ? (s.colaboradores.find(c => c.id === colabId) || null) : null;
    },

    eliminarColaborador(sucursalId, colabId) {
      const s = this.sucursal(sucursalId);
      if (!s) return;
      s.colaboradores = s.colaboradores.filter(c => c.id !== colabId);
      guardar();
    },

    /* --------------------------- visitas -------------------------- */
    visita(id) { return this.get().visitas.find(v => v.id === id) || null; },

    visitasDe(sucursalId) {
      return this.get().visitas
        .filter(v => v.sucursalId === sucursalId)
        .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    },

    ultimaVisita(sucursalId) { return this.visitasDe(sucursalId)[0] || null; },

    crearVisita(sucursalId) {
      const e = this.get();
      const v = visitaNueva(sucursalId);
      e.visitas.push(v);
      guardar();
      return v;
    },

    eliminarVisita(id) {
      const e = this.get();
      e.visitas = e.visitas.filter(v => v.id !== id);
      guardar();
    },

    /* ------------------------- respaldos -------------------------- */
    async exportar() {
      const ok = await guardarArchivo(
        `rrhh-farmatodo-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(this.get(), null, 2),
        'application/json'
      );
      if (ok) {
        this.get().config.ultimoRespaldo = new Date().toISOString();
        guardar();
      }
      return ok;
    },

    /** Días desde el último respaldo exportado, o null si nunca se exportó. */
    diasSinRespaldo() {
      const t = this.get().config.ultimoRespaldo;
      if (!t) return null;
      const ms = Date.now() - new Date(t).getTime();
      return Math.floor(ms / 86400000);
    },

    importar(texto) {
      const datos = JSON.parse(texto);
      resguardar('Antes de importar un respaldo');
      estado = normalizar(datos);
      guardar();
      return estado;
    },

    reiniciar() {
      resguardar('Antes de borrar todo');
      estado = estadoInicial();
      guardar();
    },

    /* -------------------- resguardos automáticos ------------------- */

    /** Copias guardadas, de la más nueva a la más vieja. */
    resguardos() {
      return leerResguardos()
        .map(r => ({ id: r.id, fecha: r.fecha, motivo: r.motivo, cifrado: !!r.cifrado, tam: r.tam }))
        .reverse();
    },

    /** Fuerza una copia ahora, aunque ya haya una de hoy. */
    resguardarAhora(motivo) { return resguardar(motivo || 'Copia a mano'); },

    /**
     * Vuelve al contenido de una copia. Antes de pisar el estado actual deja
     * una copia de él, así restaurar tampoco es un camino de ida.
     * @throws si la copia está cifrada con otra clave o no se entiende.
     */
    async restaurarResguardo(id) {
      const r = leerResguardos().find(x => x.id === id);
      if (!r) throw new Error('No se encontró esa copia.');
      let plano;
      try {
        plano = r.cifrado ? await cifrador.descifrar(r.datos) : r.datos;
      } catch (err) {
        throw new Error('La copia está cifrada con otra clave y no se puede abrir.');
      }
      const datos = JSON.parse(plano);
      resguardar('Antes de restaurar una copia');
      estado = normalizar(datos);
      guardar();
      return estado;
    },

    eliminarResguardo(id) {
      escribirResguardos(leerResguardos().filter(x => x.id !== id));
    },

    /** Texto que no se pudo leer al abrir y quedó apartado, si lo hay. */
    contenidoIlegible() {
      try { return localStorage.getItem(CLAVE_ILEGIBLE) || ''; } catch (err) { return ''; }
    },

    descartarIlegible() {
      try { localStorage.removeItem(CLAVE_ILEGIBLE); } catch (err) { /* nada que hacer */ }
    },

    /** Qué tiene adentro lo apartado, si resulta que se puede leer después de todo. */
    censoIlegible() {
      const t = this.contenidoIlegible();
      if (!t) return null;
      try { return this.censo(JSON.parse(t)); } catch (err) { return null; }
    },

    /**
     * Devuelve al tablero el contenido que quedó apartado. Tiene sentido cuando
     * lo que falló fue la lectura y no el contenido: ahí adentro está el trabajo
     * de verdad, y descartarlo sería perderlo por segunda vez.
     */
    recuperarIlegible() {
      const t = this.contenidoIlegible();
      if (!t) throw new Error('No hay contenido apartado.');
      const datos = JSON.parse(t);
      if (!datos || !Array.isArray(datos.sucursales)) {
        throw new Error('Lo apartado no tiene la forma del tablero.');
      }
      resguardar('Antes de recuperar el contenido apartado');
      estado = normalizar(datos);
      guardar();
      this.descartarIlegible();
      return estado;
    },

    /* --------------------- qué hay guardado ----------------------- */

    /**
     * Cuenta lo que tiene adentro un estado ya parseado. Sirve para mirar una
     * copia sin restaurarla y para describir lo que hay guardado ahora.
     */
    censo(e) {
      const est = e || this.get() || {};
      const sucs = Array.isArray(est.sucursales) ? est.sucursales : [];
      return {
        sucursales: sucs.length,
        conNombre: sucs.filter(x => String(x.nombre || '').trim()).length,
        conRazonSocial: sucs.filter(x => String(x.razonSocial || '').trim()).length,
        colaboradores: sucs.reduce((n, x) => n + ((x.colaboradores || []).length), 0),
        visitas: (est.visitas || []).length,
        reclamos: (est.reclamos || []).length,
        agenda: (est.agenda || []).length,
        diarios: (est.diarios || []).length
      };
    },

    /**
     * Radiografía del almacenamiento de este navegador, sin tocar nada. Es lo
     * primero que hay que mirar cuando alguien dice que se le borró todo:
     * distingue “el navegador quedó vacío” de “el contenido está pero no se
     * está leyendo”.
     */
    estadoDelAlmacen() {
      const leer = k => {
        try { return localStorage.getItem(k); } catch (err) { return null; }
      };
      const principal = leer(CLAVE_ALMACEN);
      const parece = t => {
        if (!t) return 'vacío';
        try {
          const o = JSON.parse(t);
          return (o && Array.isArray(o.sucursales)) ? 'en claro' : 'ilegible';
        } catch (err) { return 'cifrado o ilegible'; }
      };
      let claves = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.indexOf('farmatodo.') === 0) {
            claves.push({ clave: k, tam: (localStorage.getItem(k) || '').length });
          }
        }
      } catch (err) { /* algunos navegadores lo bloquean */ }
      return {
        clave: CLAVE_ALMACEN,
        hay: !!principal,
        tam: principal ? principal.length : 0,
        forma: parece(principal),
        cifradoActivo: !!cifrador,
        resguardos: leerResguardos().length,
        ilegible: (leer(CLAVE_ILEGIBLE) || '').length,
        claves,
        censo: this.censo()
      };
    },

    /** Qué tiene adentro una copia, sin restaurarla. */
    async censoResguardo(id) {
      const r = leerResguardos().find(x => x.id === id);
      if (!r) return null;
      try {
        const plano = r.cifrado ? await cifrador.descifrar(r.datos) : r.datos;
        return this.censo(JSON.parse(plano));
      } catch (err) {
        return null;                       // cifrada con otra clave
      }
    },

    /* Datos de ejemplo para recorrer el tablero antes de cargar información
       real. Reemplaza todo el contenido, así nunca se mezcla con datos de
       verdad; “Borrar todo” lo deja limpio de nuevo. */
    cargarEjemplo() {
      resguardar('Antes de cargar datos de ejemplo');
      const e = estadoInicial();
      e.config.coordinador = estadoInicial().config.coordinador;
      e.config.gerenteOperaciones = { nombre: 'Gerencia de Operaciones', email: '' };

      const demo = [
        { nombre: 'Sucursal de ejemplo A', gerente: 'Gerente de Tienda 1',
          pos: [[1,0,0,0,0,2800000,0,0],[2,0,0,0,0,3600000,0,0],[6,18,0,22,86,8400000,310000,0],
                [1,0,0,0,0,3100000,0,0],[1,0,0,0,0,2600000,0,0],[1,0,0,9,0,1900000,0,0]],
          aus: { '085': 14, '071': 9, '081': 5, '086': 3 },
          rot: ['12','1','0','1','0'], venta: '395000000', tickets: '38000', horas: '5600' },
        { nombre: 'Sucursal de ejemplo B', gerente: 'Gerente de Tienda 2',
          pos: [[1,0,0,0,0,2800000,0,0],[1,0,0,0,0,1800000,0,0],[4,0,0,6,22,5600000,80000,0],
                [1,0,0,0,0,3100000,0,0],[1,0,0,0,0,2600000,0,0],[0,0,0,0,0,0,0,0]],
          aus: { '085': 6 },
          rot: ['8','0','0','0','0'], venta: '205000000', tickets: '26000', horas: '3900' }
      ];

      const campos = ['heads', 'headsAltas', 'diasAltas', 'diasBajas', 'diasAusentes', 'horasExtras',
                      'sueldoBruto', 'costoHE', 'bonos'];
      const rotCampos = ['dotacionAnterior', 'altasExternas', 'altasInternas', 'bajasExternas', 'bajasInternas'];

      estado = e;
      // Las de ejemplo se agregan aparte, para no confundirse nunca con las
      // sucursales reales del padrón ni pisar sus datos.
      demo.forEach(d => {
        const suc = sucursalNueva({
          codigo: 'EJEMPLO', nombre: d.nombre, gerente: d.gerente,
          marca: 'Farmatodo', localidad: 'CABA',
          notas: 'Sucursal de ejemplo. Se elimina desde esta misma tabla o con “Borrar todo”.'
        });
        e.sucursales.push(suc);
        const v = visitaNueva(suc.id);
        v.coordinador = e.config.coordinador;
        v.minutaGerente = {
          participante: d.gerente,
          puntos: 'Cobertura de francos en fin de semana.\nQuiebres recurrentes en dermo.\nSeguimiento de llegadas tarde en el turno mañana.',
          acuerdos: 'Rearmar la grilla horaria antes del día 15.\nEntrevista individual con los dos casos de ausentismo reiterado.'
        };
        v.minutaColaborador = {
          nombre: 'Colaborador entrevistado', posicion: 'APV',
          feedback: 'Buen clima de equipo. Pide previsibilidad en la asignación de francos y más apoyo en las horas pico.'
        };
        d.pos.forEach((fila, j) => campos.forEach((c, k) => { v.posiciones[j][c] = fila[k] ? String(fila[k]) : ''; }));
        v.ausentismo.detalle = d.aus;
        rotCampos.forEach((c, k) => { v.rotacion[c] = d.rot[k]; });
        v.comercial.venta = d.venta;
        v.comercial.tickets = d.tickets;
        v.comercial.horasTrabajadas = d.horas;
        e.visitas.push(v);
      });

      // Plantel de ejemplo en la primera sucursal, con la matriz ya poblada
      const sucEjemplo = e.sucursales.find(x => x.nombre === 'Sucursal de ejemplo A');
      const plantel = [
        ['Ana López',        'Gerente de Tienda', '2019-03-04', 3, 3, 'universitario', 'Lic. en Administración', 'Dirección de varias tiendas', 'bajo'],
        ['Marta Díaz',       'Senior',            '2021-06-14', 3, 3, 'terciario',     'Tecnicatura en Comercialización', 'Gerencia de tienda', 'medio'],
        ['Pablo Ruiz',       'Senior',            '2020-01-20', 2, 2, 'noEstudia',     '', 'Seguir en el rol, sumar formación', 'bajo'],
        ['Sofía Medina',     'APV',               '2023-09-01', 3, 2, 'universitario', 'Farmacia, 2º año', 'Pasar a Farmacéutica', 'medio'],
        ['Julián Ferrer',    'APV',               '2022-04-11', 2, 3, 'curso',         'Atención al cliente', 'Coordinación de turno', 'bajo'],
        ['Carla Bustos',     'APV',               '2024-02-05', 1, 2, '',              '', 'Todavía no lo definió', 'alto'],
        ['Diego Arce',       'APV',               '2018-08-19', 3, 1, 'noEstudia',     '', 'Referente técnico del equipo', 'alto'],
        ['Lucía Ponce',      'Farmacéutico',      '2021-11-02', 3, 2, 'posgrado',      'Especialización en Farmacia Clínica', 'Dirección Técnica', 'medio'],
        ['Ramiro Vega',      'DT',                '2017-05-30', 2, 1, 'noEstudia',     '', 'Se siente cómodo donde está', 'bajo'],
        ['Valentina Soto',   'Asesora de Dermo',  '2023-03-13', 1, 1, '',              '', '', 'medio']
      ];
      plantel.forEach(([nombre, posicion, ingreso, des, pot, estudia, carrera, interes, riesgo]) => {
        const c = {
          id: uid(), nombre, posicion, fechaIngreso: ingreso, activo: true,
          desempeno: des, potencial: pot,
          fechaEvaluacion: e.visitas[0] ? e.visitas[0].fecha : '', evaluadoCon: 'Gerente de Tienda 1',
          estudia, carrera, avanceEstudio: '', formacionPrevia: '',
          interesDesarrollo: interes, aspiracion: '', movilidad: '',
          fortalezas: '', aDesarrollar: '', riesgoSalida: riesgo, notas: '',
          historial: [{ fecha: ingreso, desempeno: des, potencial: pot, desde: null,
                        evaluadoCon: 'Gerente de Tienda 1', motivo: 'Evaluación inicial' }]
        };
        sucEjemplo.colaboradores.push(c);
      });

      // Un plan de seguimiento cargado en la primera visita, para ver el reporte completo
      e.visitas[0].diagnostico.plan.push(
        { compromiso: 'Rearmar la grilla horaria para reducir horas extras', responsable: 'Gerente de Tienda', plazo: '', estado: 'Pendiente' },
        { compromiso: 'Entrevistas individuales por ausentismo reiterado', responsable: 'Coordinador de RRHH', plazo: '', estado: 'En curso' }
      );
      e.visitas[0].sucesion.push(
        { posicion: 'Gerente de Tienda', incumbent: 'Gerente de Tienda 1', criticidad: 3, escasez: 3, disponibilidad: '1a2',
          candidatos: [{ nombre: 'Senior de la tienda', readiness: '1a2' }] },
        { posicion: 'Farmacéutico', incumbent: 'Farmacéutico 1', criticidad: 3, escasez: 3, disponibilidad: 'lt1', candidatos: [] }
      );
      e.visitas[0].sanciones.push(
        { nombre: 'Colaborador A', fecha: '', tipo: 'Suspensión', motivo: 'Llegadas tarde', puesto: 'APV', observaciones: '' }
      );
      guardar();
    }
  };
})();
