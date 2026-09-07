/*
 * store.js — Estado de la aplicación y persistencia.
 *
 * Todo vive en el navegador (localStorage). No hay servidor: los datos de
 * personal no salen del equipo salvo que se exporten o se envíe un reporte.
 * Para trabajar en varios equipos, usar Exportar / Importar respaldo.
 */

const CLAVE_ALMACEN = 'farmatodo.rrhh.operativo.v1';

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
      dotacionNominal: null, notas: ''
    }, datos || {});
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
        parametros: Object.assign({}, PARAMETROS_DEFECTO)
      },
      sucursales,
      visitas: [],
      informes: []                        // envíos del informe mensual por sucursal
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
      recorrida: { checks: {}, notas: {} },   // { checks: {piso.clima:'ok'}, notas: {...} }
      minutaGerente: { participante: '', puntos: '', acuerdos: '' },
      minutaColaborador: { nombre: '', posicion: '', feedback: '' },
      posiciones: POSICIONES.map(p => ({
        rol: p.nombre, heads: '', diasAltas: '', diasBajas: '', diasAusentes: '',
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
       solo Gerente de Operaciones —Eduardo José Páez Márquez—, todas las
       tiendas operan bajo la marca Farmatodo, y los dos nombres que traía la
       tercera columna del padrón no son referentes de ninguna sucursal. */
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
        ['legajo', 'cuil', 'sector', 'dni', 'nroPersonal', 'sexo', 'estatus',
         'cargo', 'nivelCargo', 'categoriaConvenio', 'unidadNegocio',
         'razonSocialContrato', 'fechaNacimiento', 'fechaIngresoFTD', 'email',
         'emailCorporativo', 'telefono', 'domicilio', 'localidad', 'obraSocial']
          .forEach(k => { if (c[k] === undefined) c[k] = ''; });
      });
    });
    e.visitas = Array.isArray(e.visitas) ? e.visitas : [];
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
          rol: p.nombre, heads: '', diasAltas: '', diasBajas: '', diasAusentes: '',
          horasExtras: '', sueldoBruto: '', costoHE: '', bonos: '', cargasManual: ''
        })
        /* Las filas de un catálogo viejo que ya no existe se conservan al final
           si tienen algo cargado, para no borrar trabajo en silencio. */
        .concat(v.posiciones.filter(f =>
          !POSICIONES.some(p => p.nombre === f.rol) &&
          Object.keys(f).some(k => k !== 'rol' && String(f[k] || '').trim())));

      v.recorrida = Object.assign({ checks: {}, notas: {} }, v.recorrida || {});
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
  async function cargar(cif) {
    cifrador = cif || null;
    let crudo = null;
    try {
      crudo = localStorage.getItem(CLAVE_ALMACEN);
    } catch (err) {
      console.warn('No se pudo leer el almacenamiento local.', err);
    }
    if (!crudo) { estado = estadoInicial(); return estado; }

    try {
      const plano = cifrador ? await cifrador.descifrar(crudo) : crudo;
      estado = normalizar(JSON.parse(plano));
      return estado;
    } catch (err) {
      if (!cifrador) {
        console.warn('El contenido guardado no se pudo leer, se inicia vacío.', err);
        estado = estadoInicial();
        return estado;
      }
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
      try {
        const aGuardar = cifrador ? await cifrador.cifrar(instantanea) : instantanea;
        localStorage.setItem(CLAVE_ALMACEN, aGuardar);
      } catch (err) {
        console.warn('No se pudo guardar en el almacenamiento local.', err);
      }
    });
    suscriptores.forEach(fn => fn(estado));
  }

  return {
    uid,
    init: cargar,
    cifrado: () => !!cifrador,
    get: () => estado,
    save: guardar,
    onChange: fn => suscriptores.push(fn),

    /* ------------------------- sucursales ------------------------- */
    sucursal(id) { return this.get().sucursales.find(s => s.id === id) || null; },

    etiquetaSucursal(s) {
      if (!s) return '—';
      return s.nombre && s.nombre.trim() ? `${s.nombre.trim()} (${s.codigo})` : s.codigo;
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
        unidadNegocio: '', razonSocialContrato: '',
        fechaNacimiento: '', fechaIngresoFTD: '',
        email: '', emailCorporativo: '', telefono: '',
        domicilio: '', localidad: '', obraSocial: '',
        /* Ropa de trabajo: la nómina no la trae, se carga a mano */
        talles: {},
        novedades: {},                    // { '2026-08': { he50, enfermedad, … } }
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

    /* ---------------------- padrón de personas -------------------- *
       La nómina llega entera, con todas las sucursales juntas, así que el
       importador reparte por la columna TIENDA. A quien no cae en ninguna
       sucursal conocida se le arma una: los flotantes del área son personas
       reales que hay que poder ver. */
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

      (filas || []).forEach(f => {
        let s = buscarSucursal(f.tienda);
        if (!s) {
          if (!f.tienda) { sinTienda.push(nombreDeNomina(f)); return; }
          /* Tiendas que no están en el padrón del área: flotantes, o una
             sucursal de otra área donde hay gente asignada. Se crean como
             estructura para que la persona no desaparezca. */
          s = sucursalNueva({
            codigo: f.tienda.toUpperCase(),
            nombre: f.tienda.replace(/\b\w/g, c => c.toUpperCase()),
            tipo: 'staff',
            notas: 'Creada al importar la nómina: no figura en el padrón del Área 3.'
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
      });

      guardar();
      return { nuevos, actualizados, movidos, sucursalesNuevas, sinTienda, discrepancias,
               total: (filas || []).length };
    },

    /* ------------------ novedades de liquidación ------------------ *
       Una tanda por sucursal y por mes. La persona se identifica por CUIL;
       si no lo trae, por nombre normalizado. Nunca duplica: si ya está,
       actualiza sus novedades del período y respeta lo cargado a mano
       (posición, evaluación, talent card). */
    importarNovedades(sucursalId, periodo, filas) {
      const s = this.sucursal(sucursalId);
      if (!s) return null;
      const clave = t => String(t || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');

      let nuevos = 0, actualizados = 0;
      const sinPosicion = [];

      (filas || []).forEach(f => {
        const nombre = nombreDePlanilla(f);
        let c = f.cuil ? s.colaboradores.find(x => x.cuil === f.cuil) : null;
        if (!c) c = s.colaboradores.find(x => clave(x.nombre) === clave(nombre));

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
      return { nuevos, actualizados, sinPosicion, ausentesDelPadron,
               total: (filas || []).length };
    },

    /**
     * Dotación del mes agrupada por posición, a partir del plantel y de las
     * novedades importadas. Es lo que llena la matriz de FTE sin recargar nada.
     */
    dotacionDelPadron(sucursalId, periodo) {
      const s = this.sucursal(sucursalId);
      if (!s) return null;
      const porPosicion = {};
      const sinPosicion = [];
      let personas = 0;
      const detalle = {};

      (s.colaboradores || []).forEach(c => {
        const nov = (c.novedades || {})[periodo];
        if (!nov) return;
        personas++;

        const porCod = ausenciasPorCodigo(nov);
        Object.keys(porCod).forEach(cod => { detalle[cod] = (detalle[cod] || 0) + porCod[cod]; });

        if (!c.posicion) { sinPosicion.push(c.nombre); return; }
        const p = porPosicion[c.posicion] || (porPosicion[c.posicion] =
          { heads: 0, diasAusentes: 0, horasExtras: 0 });
        p.heads++;
        p.horasExtras += numeroNovedad(nov.he50) + numeroNovedad(nov.he100);
        p.diasAusentes += MAPA_AUSENCIAS.reduce((a, m) => a + numeroNovedad(nov[m.campo]), 0);
      });

      return { porPosicion, sinPosicion, personas, detalle, periodo };
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
        fila.diasAusentes = p && p.diasAusentes ? p.diasAusentes : '';
        fila.horasExtras = p && p.horasExtras ? p.horasExtras : '';
      });
      v.ausentismo.detalle = Object.assign({}, v.ausentismo.detalle, d.detalle);

      guardar();
      return d;
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
    exportar() {
      return guardarArchivo(
        `rrhh-farmatodo-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(this.get(), null, 2),
        'application/json'
      );
    },

    importar(texto) {
      const datos = JSON.parse(texto);
      estado = normalizar(datos);
      guardar();
      return estado;
    },

    reiniciar() {
      estado = estadoInicial();
      guardar();
    },

    /* Datos de ejemplo para recorrer el tablero antes de cargar información
       real. Reemplaza todo el contenido, así nunca se mezcla con datos de
       verdad; “Borrar todo” lo deja limpio de nuevo. */
    cargarEjemplo() {
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

      const campos = ['heads', 'diasAltas', 'diasBajas', 'diasAusentes', 'horasExtras',
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
