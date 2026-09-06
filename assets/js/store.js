/*
 * store.js — Estado de la aplicación y persistencia.
 *
 * Todo vive en el navegador (localStorage). No hay servidor: los datos de
 * personal no salen del equipo salvo que se exporten o se envíe un reporte.
 * Para trabajar en varios equipos, usar Exportar / Importar respaldo.
 */

const CLAVE_ALMACEN = 'farmatodo.rrhh.operativo.v1';

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
      const blob = new Blob([JSON.stringify(this.get(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rrhh-farmatodo-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
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
    }
  };
})();
