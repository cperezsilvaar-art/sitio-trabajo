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
  const suscriptores = [];

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  function estadoInicial() {
    const sucursales = [];
    for (let i = 1; i <= 10; i++) {
      sucursales.push({
        id: uid(),
        codigo: 'sucursal' + i,
        nombre: '',          // el coordinador reemplaza el código por el nombre real
        tipo: 'venta',
        gerente: '',
        direccion: '',
        dotacionNominal: null,
        notas: ''
      });
    }
    return {
      version: 1,
      config: {
        coordinador: '',
        gerenteOperaciones: { nombre: '', email: '' },
        copias: '',
        webhook: '',
        parametros: Object.assign({}, PARAMETROS_DEFECTO)
      },
      sucursales,
      visitas: []
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
    e.config.gerenteOperaciones = Object.assign({}, base.config.gerenteOperaciones, e.config.gerenteOperaciones || {});
    e.config.parametros = Object.assign({}, PARAMETROS_DEFECTO, e.config.parametros || {});
    e.sucursales = Array.isArray(e.sucursales) ? e.sucursales : base.sucursales;
    e.sucursales.forEach(s => { if (!s.id) s.id = uid(); });
    e.visitas = Array.isArray(e.visitas) ? e.visitas : [];
    e.visitas.forEach(v => {
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
    });
    return e;
  }

  function cargar() {
    try {
      const crudo = localStorage.getItem(CLAVE_ALMACEN);
      estado = crudo ? normalizar(JSON.parse(crudo)) : estadoInicial();
    } catch (err) {
      console.warn('No se pudo leer el almacenamiento local, se inicia vacío.', err);
      estado = estadoInicial();
    }
    return estado;
  }

  function guardar() {
    try {
      localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(estado));
    } catch (err) {
      console.warn('No se pudo guardar en el almacenamiento local.', err);
    }
    suscriptores.forEach(fn => fn(estado));
  }

  return {
    uid,
    init: cargar,
    get: () => estado || cargar(),
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
      const s = { id: uid(), codigo: 'sucursal' + n, nombre: '', tipo: 'venta', gerente: '', direccion: '', dotacionNominal: null, notas: '' };
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
      e.config.coordinador = 'Coordinador de RRHH';
      e.config.gerenteOperaciones = { nombre: 'Gerencia de Operaciones', email: '' };

      const demo = [
        { i: 0, nombre: 'Centro — ejemplo', gerente: 'Gerente de Tienda 1',
          pos: [[1,0,0,0,0,2800000,0,0],[2,0,0,0,0,3600000,0,0],[6,18,0,22,86,8400000,310000,0],
                [1,0,0,0,0,3100000,0,0],[1,0,0,0,0,2600000,0,0],[1,0,0,9,0,1900000,0,0]],
          aus: { '085': 14, '071': 9, '081': 5, '086': 3 },
          rot: ['12','1','0','1','0'], venta: '268000000', tickets: '41000', horas: '5600' },
        { i: 1, nombre: 'Norte — ejemplo', gerente: 'Gerente de Tienda 2',
          pos: [[1,0,0,0,0,2800000,0,0],[1,0,0,0,0,1800000,0,0],[4,0,0,6,22,5600000,80000,0],
                [1,0,0,0,0,3100000,0,0],[1,0,0,0,0,2600000,0,0],[0,0,0,0,0,0,0,0]],
          aus: { '085': 6 },
          rot: ['8','0','0','0','0'], venta: '142000000', tickets: '19000', horas: '3900' }
      ];

      const campos = ['heads', 'diasAltas', 'diasBajas', 'diasAusentes', 'horasExtras',
                      'sueldoBruto', 'costoHE', 'bonos'];
      const rotCampos = ['dotacionAnterior', 'altasExternas', 'altasInternas', 'bajasExternas', 'bajasInternas'];

      estado = e;
      demo.forEach(d => {
        const suc = e.sucursales[d.i];
        suc.nombre = d.nombre;
        suc.gerente = d.gerente;
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
