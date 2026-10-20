/*
 * sucursales-demo.js — Cuatro sucursales inventadas, para la copia que se
 * comparte con alguien de afuera.
 *
 * Es a `sucursales-area3.js` lo que `plantel-demo.js` es al plantel: declara
 * los mismos nombres y la build de `--compartir` lo pone en su lugar, así el
 * resto del panel no se entera.
 *
 * `--demo` y `--sin-plantel` alcanzaban para **las personas**: vacían el
 * plantel y barren los referentes, y dejan las tiendas enteras —código, RVD,
 * dirección, CUIT, razón social, horario— porque la página publicada es del
 * propio coordinador y eso es lo que la hace servible para mostrarla. Una
 * copia que se le pasa a alguien de otra empresa es otra cosa: ahí el padrón
 * de sucursales **también** es dato de la compañía y no viaja.
 *
 * Nada de acá existe: las direcciones son las dos que en Argentina se usan
 * justamente para decir «esto es un ejemplo», y la razón social y el CUIT
 * quedan vacíos porque inventar un CUIT es inventar una empresa que puede
 * existir. Quien reciba la copia carga los suyos en la ficha de cada tienda.
 */

const GERENTES_OPERACIONES_AREA3 = [
  { nombre: 'Gerencia de Operaciones', email: '' }
];

/* Sin datos guardados no hay nada que limpiar: la lista existe para corregir
   lo que un padrón viejo dejó escrito, y una copia nueva arranca vacía. */
const NOMBRES_A_LIMPIAR = [];

const SUCURSALES_AREA3 = [
  {
    codigo: 'CENTRO', rvd: '001', nombre: 'Sucursal Centro',
    marca: 'Mi cadena', operador: 'Mi cadena',
    razonSocial: '', cuit: '',
    direccion: 'Calle Falsa 123', localidad: 'Ciudad',
    horario: 'Lunes a domingo + feriados: 08:00 a 22:00',
    art: '', gerenteOperaciones: 'Gerencia de Operaciones',
    gerente: '', directorTecnico: '',
    contactoAdmin: '', emailContactoAdmin: '', referenteRRHH: '',
    minimoTurno: 4
  },
  {
    codigo: 'NORTE', rvd: '002', nombre: 'Sucursal Norte',
    marca: 'Mi cadena', operador: 'Mi cadena',
    razonSocial: '', cuit: '',
    direccion: 'Av. Siempre Viva 742', localidad: 'Ciudad',
    horario: 'Lunes a sábado: 08:00 a 21:00 · Domingo y feriados: 10:00 a 18:00',
    art: '', gerenteOperaciones: 'Gerencia de Operaciones',
    gerente: '', directorTecnico: '',
    contactoAdmin: '', emailContactoAdmin: '', referenteRRHH: '',
    minimoTurno: 3
  },
  {
    codigo: 'SUR', rvd: '003', nombre: 'Sucursal Sur',
    marca: 'Mi cadena', operador: 'Mi cadena',
    razonSocial: '', cuit: '',
    direccion: 'Calle Falsa 456', localidad: 'Ciudad',
    horario: 'Lunes a sábado: 09:00 a 21:00',
    art: '', gerenteOperaciones: 'Gerencia de Operaciones',
    gerente: '', directorTecnico: '',
    contactoAdmin: '', emailContactoAdmin: '', referenteRRHH: '',
    minimoTurno: 3
  },
  {
    codigo: 'OESTE', rvd: '004', nombre: 'Sucursal Oeste',
    marca: 'Mi cadena', operador: 'Mi cadena',
    razonSocial: '', cuit: '',
    direccion: 'Av. Siempre Viva 1200', localidad: 'Ciudad',
    horario: 'Lunes a domingo: 09:00 a 20:00',
    art: '', gerenteOperaciones: 'Gerencia de Operaciones',
    gerente: '', directorTecnico: '',
    contactoAdmin: '', emailContactoAdmin: '', referenteRRHH: '',
    minimoTurno: 2
  }
];

const MARCA_AREA = 'Mi cadena';
const OPERADORES = ['Mi cadena'];
const ARTS = [];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SUCURSALES_AREA3, GERENTES_OPERACIONES_AREA3, NOMBRES_A_LIMPIAR,
                     MARCA_AREA, OPERADORES, ARTS };
}
