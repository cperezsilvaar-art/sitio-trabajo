/*
 * sucursales-area3.js — Padrón de las sucursales del Área 3.
 *
 * Toda el área opera bajo la marca Farmatodo y reporta a un único Gerente de
 * Operaciones. Lo que el padrón original traía por tienda —La Sante, Vassallo,
 * Independiente— es el grupo que la opera.
 *
 * **Los nombres de personas de este archivo son inventados**, igual que los de
 * `plantel-area3.js`: gerentes, directores técnicos, contactos administrativos
 * y referentes de RRHH. Se cambiaron para poder mostrar el panel y publicarlo
 * sin exponer a nadie. Las tiendas sí son las reales —código, dirección, CUIT,
 * horario—, que es dato de la empresa y no de una persona. Los de verdad se
 * cargan en la ficha de cada tienda, en `#/sucursal/<id>`, y se quedan en el
 * navegador.
 *
 * Los códigos `rvd` son el "#País" del reporte diario de ventas: son los que
 * permiten cruzar este padrón con la venta de cada tienda sin depender del
 * nombre, que en el RVD aparece escrito distinto (SM CENTER es SAN MARTIN,
 * LA NOBLEZA es 25 DE MAYO (NOBLEZA), VILLA DEL PARQUE es VILLA DEL PARQUE II).
 *
 * Los nombres de las dos últimas columnas del padrón original están inferidos:
 * confirmarlos antes de darlos por buenos.
 */

const GERENTES_OPERACIONES_AREA3 = [
  { nombre: 'Rubén Etchegaray', email: 'gerencia.operaciones@ejemplo.com' }
];

/* Los nombres que el padrón traía en su tercera columna no son un referente de
   las sucursales: el Área 3 reporta a un único Gerente de Operaciones y el
   coordinador de RRHH es Christian Pérez. Se conservan solo para poder
   limpiarlos de los datos ya guardados, no se asignan a ninguna tienda. */
const NOMBRES_A_LIMPIAR = ['Alberto Sanguinetti', 'Esteban Roldán V.'];

const SUCURSALES_AREA3 = [
  {
    codigo: 'BOTANICO', rvd: '008', nombre: 'Botánico', marca: 'Farmatodo', operador: 'Farmatodo',
    razonSocial: 'FARMATODO ARGENTINA S.A.', cuit: '30716227339',
    direccion: 'Av. Santa Fe 3601, C1425GY', localidad: 'CABA',
    horario: 'Lunes a domingo + feriados: 08:00 a 24:00',
    art: 'PARANA ART', gerenteOperaciones: 'Rubén Etchegaray',
    gerente: 'Paula Iriarte', directorTecnico: 'Julieta Ramallo',
    contactoAdmin: 'Agustina Rivas', emailContactoAdmin: 'ar@estudiodemo.com.ar',
    referenteRRHH: 'Mercedes Ugarte'
  },
  {
    codigo: 'DEVOTO', rvd: '019', nombre: 'Devoto', marca: 'Farmatodo', operador: 'Farmatodo',
    razonSocial: 'MA TECH S.R.L.', cuit: '30711817685',
    direccion: 'José Pedro Varela 4720', localidad: 'CABA',
    horario: 'Lunes a domingo + feriados: 08:00 a 21:00',
    art: 'ANDINA ART', gerenteOperaciones: 'Rubén Etchegaray',
    gerente: 'Damián Ferreyra', directorTecnico: 'Hernán Loyola',
    contactoAdmin: '', emailContactoAdmin: '', referenteRRHH: '',
    notas: 'El padrón trae dos domicilios distintos: "Av. de Mayo" y "José Pedro Varela 4720". Confirmar cuál corresponde.'
  },
  {
    codigo: 'LA NOBLEZA', rvd: '024', nombre: 'La Nobleza', marca: 'Farmatodo', operador: 'La Sante',
    razonSocial: 'FARMACIA LA NOBLEZA SCS', cuit: '30684783684',
    direccion: 'Av. San Martín 420 (loc. 16)', localidad: 'San Martín',
    horario: 'Lunes a domingo + feriados: 08:00 a 21:00',
    art: 'ANDINA ART', gerenteOperaciones: 'Rubén Etchegaray',
    gerente: 'Silvina Ocampo R.', directorTecnico: 'Federico Aguirre',
    contactoAdmin: '', emailContactoAdmin: '', referenteRRHH: '',
    notas: 'En el RVD figura como "25 DE MAYO (NOBLEZA)".'
  },
  {
    codigo: 'MARK', rvd: '006', nombre: 'Mark', marca: 'Farmatodo', operador: 'Farmatodo',
    razonSocial: 'FARMACIA MARK S.C.S.', cuit: '30711024499',
    direccion: 'Vicente F. López 1076, B1640 Martínez', localidad: 'San Isidro',
    horario: 'Lunes a domingo + feriados: 08:00 a 22:00',
    art: 'PARANA ART', gerenteOperaciones: 'Rubén Etchegaray',
    gerente: 'Marisa Quiroga', directorTecnico: 'Marisa Quiroga',
    contactoAdmin: 'Micaela Duarte', emailContactoAdmin: 'md@estudiodemo.com.ar',
    referenteRRHH: 'Inés Carranza',
    notas: 'La misma persona figura como gerente y como director técnico. Verificar.'
  },
  {
    codigo: 'OLIVOS', rvd: '017', nombre: 'Olivos', marca: 'Farmatodo', operador: 'Vassallo',
    razonSocial: 'FARMACIA VASSALLO OLIVOS SCS', cuit: '33663846839',
    direccion: 'Ricardo Gutiérrez 1202', localidad: 'San Isidro',
    horario: 'Lunes a sábado: 08:00 a 21:00 · Domingo y feriados: 10:00 a 18:00',
    art: 'PARANA ART', gerenteOperaciones: 'Rubén Etchegaray',
    gerente: 'Nicolás Bengochea', directorTecnico: 'Noelia Bianchi',
    contactoAdmin: '', emailContactoAdmin: '', referenteRRHH: 'Inés Carranza'
  },
  {
    codigo: 'OLLEROS', rvd: '022', nombre: 'Olleros', marca: 'Farmatodo', operador: 'Farmatodo',
    razonSocial: 'FARMACIA BARCELONA S.R.L.', cuit: '30710793472',
    direccion: 'Av. Cabildo 701', localidad: 'CABA',
    horario: 'Lunes a domingo + feriados: 08:00 a 22:00',
    art: 'PARANA ART', gerenteOperaciones: 'Rubén Etchegaray',
    gerente: 'Tomás Alderete', directorTecnico: 'Lucía Stagnaro',
    contactoAdmin: 'Florencia Bazán', emailContactoAdmin: 'fb@estudiodemo.com.ar',
    referenteRRHH: ''
  },
  {
    codigo: 'PARQUE CHACABUCO', rvd: '009', nombre: 'Parque Chacabuco', marca: 'Farmatodo', operador: 'Independiente',
    razonSocial: 'FARMATODO ARGENTINA S.A.', cuit: '30716227339',
    direccion: 'Emilio Mitre 1404', localidad: 'CABA',
    horario: 'Lunes a viernes: 10:00 a 18:00 · Sábado: 10:00 a 18:00',
    art: 'PARANA ART', gerenteOperaciones: 'Rubén Etchegaray',
    gerente: 'Carla Vignoli', directorTecnico: '',
    contactoAdmin: '', emailContactoAdmin: '', referenteRRHH: '',
    notas: 'En el RVD del 06-09 esta tienda figura en el Área 2, no en la 3. Confirmar a qué área corresponde.'
  },
  {
    codigo: 'RIVADAVIA', rvd: '027', nombre: 'Rivadavia', marca: 'Farmatodo', operador: 'Farmatodo',
    razonSocial: 'FARMACIA RIVADAVIA 5892 SCS', cuit: '30642901997',
    direccion: 'Av. Rivadavia 5892', localidad: 'CABA',
    horario: 'Lunes a domingo + feriados: 08:00 a 21:00',
    art: 'PARANA ART', gerenteOperaciones: 'Rubén Etchegaray',
    gerente: 'Fabián Urquiza', directorTecnico: 'Mariana Toledo',
    contactoAdmin: '', emailContactoAdmin: '', referenteRRHH: ''
  },
  {
    codigo: 'SCALABRINI', rvd: '029', nombre: 'Scalabrini', marca: 'Farmatodo', operador: 'Farmatodo',
    razonSocial: 'IRON LYNX SAS', cuit: '30716704366',
    direccion: 'Scalabrini Ortiz 361', localidad: 'CABA',
    horario: 'Lunes a domingo + feriados: 08:00 a 24:00',
    art: 'PARANA ART', gerenteOperaciones: 'Rubén Etchegaray',
    gerente: 'Gustavo Peralta L.', directorTecnico: 'Sabrina Kuperman',
    contactoAdmin: '', emailContactoAdmin: '', referenteRRHH: ''
  },
  {
    codigo: 'SM CENTER', rvd: '025', nombre: 'San Martín Center', marca: 'Farmatodo', operador: 'La Sante',
    razonSocial: 'FARMACIA SAN MARTIN CENTER', cuit: '30662516224',
    direccion: 'San Lorenzo 3773, San Martín', localidad: 'San Martín',
    horario: 'Lunes a domingo + feriados: 08:00 a 21:00',
    art: 'PARANA ART', gerenteOperaciones: 'Rubén Etchegaray',
    gerente: 'Verónica Lastra', directorTecnico: 'Rodrigo Massa',
    contactoAdmin: '', emailContactoAdmin: '', referenteRRHH: '',
    notas: 'En el RVD figura como "SAN MARTIN".'
  },
  {
    codigo: 'VILLA DEL PARQUE', rvd: '015', nombre: 'Villa del Parque', marca: 'Farmatodo', operador: 'Vassallo',
    razonSocial: 'FARMACIA VASSALLO VILLA DEL PARQUE SRL', cuit: '30709040800',
    direccion: 'Cuenca 2719', localidad: 'CABA',
    horario: 'Lunes a sábado: 08:00 a 21:00 · Domingo y feriados: 10:00 a 18:00',
    art: 'PARANA ART', gerenteOperaciones: 'Rubén Etchegaray',
    gerente: 'Andrea Solís', directorTecnico: 'Patricia Olivera',
    contactoAdmin: '', emailContactoAdmin: '', referenteRRHH: 'Mercedes Ugarte',
    notas: 'En el RVD figura como "VILLA DEL PARQUE II".'
  },
  {
    codigo: 'VILLA DEVOTO', rvd: '010', nombre: 'Villa Devoto', marca: 'Farmatodo', operador: 'Independiente',
    razonSocial: 'FARMATODO ARGENTINA S.A.', cuit: '30716227339',
    direccion: 'Habana 3806, C1419', localidad: 'CABA',
    horario: 'Lunes a viernes: 10:00 a 18:00 · Sábado: 10:00 a 18:00',
    art: 'PARANA ART', gerenteOperaciones: 'Rubén Etchegaray',
    gerente: 'Carla Vignoli', directorTecnico: 'Belén Sarmiento',
    contactoAdmin: '', emailContactoAdmin: '', referenteRRHH: ''
  }
];

/* Todas las sucursales del área operan bajo la marca Farmatodo. Lo que el
   padrón trae por tienda (La Sante, Vassallo, Independiente) es el grupo que
   la opera, no la marca comercial. */
const MARCA_AREA = 'Farmatodo';
const OPERADORES = ['Farmatodo', 'La Sante', 'Vassallo', 'Independiente'];
const ARTS = ['PARANA ART', 'ANDINA ART'];
