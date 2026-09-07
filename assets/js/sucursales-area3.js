/*
 * sucursales-area3.js — Padrón de las sucursales del Área 3.
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
  { nombre: 'Reinaldo Contreras', email: '' },
  { nombre: 'Mariano Murta',      email: '' }
];

const SUCURSALES_AREA3 = [
  {
    codigo: 'BOTANICO', rvd: '008', nombre: 'Botánico', marca: 'Farmatodo',
    razonSocial: 'FARMATODO ARGENTINA S.A.', cuit: '30716227339',
    direccion: 'Av. Santa Fe 3601, C1425GY', localidad: 'CABA',
    horario: 'Lunes a domingo + feriados: 08:00 a 24:00',
    art: 'PARANA ART', gerenteOperaciones: 'Reinaldo Contreras',
    gerente: 'Ana Antury', directorTecnico: 'Yessica Santos',
    contactoAdmin: 'Camila Mendoza', emailContactoAdmin: 'cm@estudioeka.com.ar',
    referenteRRHH: 'Yael Peluso'
  },
  {
    codigo: 'DEVOTO', rvd: '019', nombre: 'Devoto', marca: 'Farmatodo',
    razonSocial: 'MA TECH S.R.L.', cuit: '30711817685',
    direccion: 'José Pedro Varela 4720', localidad: 'CABA',
    horario: 'Lunes a domingo + feriados: 08:00 a 21:00',
    art: 'ANDINA ART', gerenteOperaciones: 'Mariano Murta',
    gerente: 'Omar Gomez', directorTecnico: 'Gonzalo Abad',
    contactoAdmin: '', emailContactoAdmin: '', referenteRRHH: '',
    notas: 'El padrón trae dos domicilios distintos: "Av. de Mayo" y "José Pedro Varela 4720". Confirmar cuál corresponde.'
  },
  {
    codigo: 'LA NOBLEZA', rvd: '024', nombre: 'La Nobleza', marca: 'La Sante',
    razonSocial: 'FARMACIA LA NOBLEZA SCS', cuit: '30684783684',
    direccion: 'Av. San Martín 420 (loc. 16)', localidad: 'San Martín',
    horario: 'Lunes a domingo + feriados: 08:00 a 21:00',
    art: 'ANDINA ART', gerenteOperaciones: 'Mariano Murta',
    gerente: 'Lorena Arrieta', directorTecnico: 'Christian Mancuso',
    contactoAdmin: '', emailContactoAdmin: '', referenteRRHH: '',
    notas: 'En el RVD figura como "25 DE MAYO (NOBLEZA)".'
  },
  {
    codigo: 'MARK', rvd: '006', nombre: 'Mark', marca: 'Farmatodo',
    razonSocial: 'FARMACIA MARK S.C.S.', cuit: '30711024499',
    direccion: 'Vicente F. López 1076, B1640 Martínez', localidad: 'San Isidro',
    horario: 'Lunes a domingo + feriados: 08:00 a 22:00',
    art: 'PARANA ART', gerenteOperaciones: 'Mariano Murta',
    gerente: 'Deildre María Barroso', directorTecnico: 'Deildre María Barroso',
    contactoAdmin: 'Rocio Pacci', emailContactoAdmin: 'rp@estudioeka.com.ar',
    referenteRRHH: 'Amanda Luz Barassi',
    notas: 'La misma persona figura como gerente y como director técnico. Verificar.'
  },
  {
    codigo: 'OLIVOS', rvd: '017', nombre: 'Olivos', marca: 'Vassallo',
    razonSocial: 'FARMACIA VASSALLO OLIVOS SCS', cuit: '33663846839',
    direccion: 'Ricardo Gutiérrez 1202', localidad: 'San Isidro',
    horario: 'Lunes a sábado: 08:00 a 21:00 · Domingo y feriados: 10:00 a 18:00',
    art: 'PARANA ART', gerenteOperaciones: 'Mariano Murta',
    gerente: 'Cristian Diaz', directorTecnico: 'Bialostocky, Noemí B.',
    contactoAdmin: '', emailContactoAdmin: '', referenteRRHH: 'Amanda Luz Barassi'
  },
  {
    codigo: 'OLLEROS', rvd: '022', nombre: 'Olleros', marca: 'Farmatodo',
    razonSocial: 'FARMACIA BARCELONA S.R.L.', cuit: '30710793472',
    direccion: 'Av. Cabildo 701', localidad: 'CABA',
    horario: 'Lunes a domingo + feriados: 08:00 a 22:00',
    art: 'PARANA ART', gerenteOperaciones: 'Reinaldo Contreras',
    gerente: 'Wilson Trejo', directorTecnico: 'Natalia Fiore',
    contactoAdmin: 'Antonella Diaz', emailContactoAdmin: 'add@estudioeka.com.ar',
    referenteRRHH: ''
  },
  {
    codigo: 'PARQUE CHACABUCO', rvd: '009', nombre: 'Parque Chacabuco', marca: 'Independiente',
    razonSocial: 'FARMATODO ARGENTINA S.A.', cuit: '30716227339',
    direccion: 'Emilio Mitre 1404', localidad: 'CABA',
    horario: 'Lunes a viernes: 10:00 a 18:00 · Sábado: 10:00 a 18:00',
    art: 'PARANA ART', gerenteOperaciones: 'Reinaldo Contreras',
    gerente: 'Helen Afanador Villasmil', directorTecnico: '',
    contactoAdmin: '', emailContactoAdmin: '', referenteRRHH: '',
    notas: 'En el RVD del 06-09 esta tienda figura en el Área 2, no en la 3. Confirmar a qué área corresponde.'
  },
  {
    codigo: 'RIVADAVIA', rvd: '027', nombre: 'Rivadavia', marca: 'Farmatodo',
    razonSocial: 'FARMACIA RIVADAVIA 5892 SCS', cuit: '30642901997',
    direccion: 'Av. Rivadavia 5892', localidad: 'CABA',
    horario: 'Lunes a domingo + feriados: 08:00 a 21:00',
    art: 'PARANA ART', gerenteOperaciones: 'Reinaldo Contreras',
    gerente: 'Gustavo Enriquez', directorTecnico: 'Gabriela Crisci',
    contactoAdmin: '', emailContactoAdmin: '', referenteRRHH: ''
  },
  {
    codigo: 'SCALABRINI', rvd: '029', nombre: 'Scalabrini', marca: 'Farmatodo',
    razonSocial: 'IRON LYNX SAS', cuit: '30716704366',
    direccion: 'Scalabrini Ortiz 361', localidad: 'CABA',
    horario: 'Lunes a domingo + feriados: 08:00 a 24:00',
    art: 'PARANA ART', gerenteOperaciones: 'Reinaldo Contreras',
    gerente: 'Horacio Martinez', directorTecnico: 'Laura Kaplan',
    contactoAdmin: '', emailContactoAdmin: '', referenteRRHH: ''
  },
  {
    codigo: 'SM CENTER', rvd: '025', nombre: 'San Martín Center', marca: 'La Sante',
    razonSocial: 'FARMACIA SAN MARTIN CENTER', cuit: '30662516224',
    direccion: 'San Lorenzo 3773, San Martín', localidad: 'San Martín',
    horario: 'Lunes a domingo + feriados: 08:00 a 21:00',
    art: 'PARANA ART', gerenteOperaciones: 'Mariano Murta',
    gerente: 'Mariela Gonzalez', directorTecnico: 'Marcelo Vasallo',
    contactoAdmin: '', emailContactoAdmin: '', referenteRRHH: '',
    notas: 'En el RVD figura como "SAN MARTIN".'
  },
  {
    codigo: 'VILLA DEL PARQUE', rvd: '015', nombre: 'Villa del Parque', marca: 'Vassallo',
    razonSocial: 'FARMACIA VASSALLO VILLA DEL PARQUE SRL', cuit: '30709040800',
    direccion: 'Cuenca 2719', localidad: 'CABA',
    horario: 'Lunes a sábado: 08:00 a 21:00 · Domingo y feriados: 10:00 a 18:00',
    art: 'PARANA ART', gerenteOperaciones: 'Reinaldo Contreras',
    gerente: 'Mónica Noemí Salvatierra', directorTecnico: 'Andrea Verónica Trinidad Ibarra',
    contactoAdmin: '', emailContactoAdmin: '', referenteRRHH: 'Yael Peluso',
    notas: 'En el RVD figura como "VILLA DEL PARQUE II".'
  },
  {
    codigo: 'VILLA DEVOTO', rvd: '010', nombre: 'Villa Devoto', marca: 'Independiente',
    razonSocial: 'FARMATODO ARGENTINA S.A.', cuit: '30716227339',
    direccion: 'Habana 3806, C1419', localidad: 'CABA',
    horario: 'Lunes a viernes: 10:00 a 18:00 · Sábado: 10:00 a 18:00',
    art: 'PARANA ART', gerenteOperaciones: 'Reinaldo Contreras',
    gerente: 'Helen Afanador Villasmil', directorTecnico: 'Nadia Roldan',
    contactoAdmin: '', emailContactoAdmin: '', referenteRRHH: ''
  }
];

const MARCAS = ['Farmatodo', 'La Sante', 'Vassallo', 'Independiente'];
const ARTS = ['PARANA ART', 'ANDINA ART'];
