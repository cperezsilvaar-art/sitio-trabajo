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
      codigo: '', rvd: '', nombre: '', tipo: 'venta', marca: '',
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
    if (!String(e.config.coordinador || '').trim()) e.config.coordinador = base.config.coordinador;
    if (!String(e.config.area || '').trim()) e.config.area = base.config.area;
    e.config.gerenteOperaciones = Object.assign({}, base.config.gerenteOperaciones, e.config.gerenteOperaciones || {});
    e.config.parametros = Object.assign({}, PARAMETROS_DEFECTO, e.config.parametros || {});
    e.sucursales = Array.isArray(e.sucursales) ? e.sucursales : base.sucursales;
    if (!Array.isArray(e.config.gerentesOperaciones) || !e.config.gerentesOperaciones.length) {
      e.config.gerentesOperaciones = GERENTES_OPERACIONES_AREA3.map(g => Object.assign({}, g));
    }
    e.sucursales = e.sucursales.map(s => sucursalNueva(s));
    e.sucursales.forEach(s => {
      if (!s.id) s.id = uid();
      if (!Array.isArray(s.colaboradores)) s.colaboradores = [];
      s.colaboradores.forEach(c => {
        if (!c.id) c.id = uid();
        if (!Array.isArray(c.historial)) c.historial = [];
        if (c.activo === undefined) c.activo = true;
      });
    });
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

        if (!existente) { e.sucursales.push(sucursalNueva(fila)); nuevas++; return; }

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

    /* ------------------------- colaboradores ---------------------- */
    agregarColaborador(sucursalId, datos) {
      const s = this.sucursal(sucursalId);
      if (!s) return null;
      const c = Object.assign({
        id: uid(), nombre: '', posicion: '', fechaIngreso: '', activo: true,
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
