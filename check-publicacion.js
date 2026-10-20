#!/usr/bin/env node
/*
 * check-publicacion.js — que no viaje ningún nombre de persona a la página.
 *
 * `--sin-plantel` y `--demo` vacían `PLANTEL_AREA3` y barren los referentes de
 * `sucursales-area3.js`, y eso alcanzaba para los **datos**. No alcanzaba para
 * los **comentarios**: un comentario viaja al HTML armado igual que el código,
 * y en `store.js` había cinco personas del padrón escritas con nombre y
 * apellido dentro de ejemplos —«el número de fulano con el nombre de
 * mengano»—. Viajaron a la página publicada hasta que alguien las buscó a
 * mano, que es exactamente lo que este chequeo viene a dejar de depender.
 *
 *   node check-publicacion.js [archivo.html]
 *
 * Sin argumento arma la versión `--sin-plantel` en un temporal y la revisa.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');

const raiz = __dirname;

/* Mayúsculas y minúsculas aparte: el padrón escribe «PEREZ, MARIA» y los
   comentarios escriben «Perez» o «perez maria». */
const sinTildes = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = s => sinTildes(s).toLowerCase();

/* Palabras que son apellido de alguien del padrón **y** palabra común del
   castellano. Es la misma excepción que `APELLIDOS_QUE_SON_PALABRAS` en
   `check-anexo.js`, y por el mismo motivo: un falso positivo repetido enseña a
   ignorar el chequeo, que es la peor forma de romperlo. Corta a propósito. */
const APELLIDOS_QUE_SON_PALABRAS = new Set([
  'sueldo', 'flores', 'campos', 'leon', 'cruz', 'rey', 'mayo', 'prado', 'rosa',
  'salinas', 'luna', 'paz', 'vega', 'rios', 'nieve', 'bello', 'santos', 'olivo',
  'blanco', 'moreno', 'castillo', 'villa', 'barrios', 'puente', 'mar', 'solar'
]);

function nombresDelPadron() {
  const fuentes = ['assets/js/plantel-area3.js', 'assets/js/sucursales-area3.js'];
  const completos = new Set(), apellidos = new Set();
  fuentes.forEach(f => {
    const txt = fs.readFileSync(path.join(raiz, f), 'utf8');
    const agregar = n => {
      const t = String(n || '').trim();
      if (t.length < 4) return;
      completos.add(t);
      const ape = t.split(',')[0].trim();
      if (ape.length > 3 && !APELLIDOS_QUE_SON_PALABRAS.has(norm(ape))) apellidos.add(ape);
    };
    (txt.match(/\bn:\s*'([^']+)'/g) || []).forEach(m => agregar(m.replace(/^.*?'/, '').slice(0, -1)));
    ['gerente', 'directorTecnico', 'contactoAdmin', 'referenteRRHH', 'gerenteOperaciones']
      .forEach(campo => {
        const re = new RegExp(campo + ":\\s*'([^']+)'", 'g');
        let m; while ((m = re.exec(txt))) agregar(m[1]);
      });
    let m; const re = /nombre:\s*'([^']+)',\s*email:/g;
    while ((m = re.exec(txt))) agregar(m[1]);
  });
  return { completos, apellidos };
}

function revisar(html) {
  const fallas = [];
  const { completos, apellidos } = nombresDelPadron();
  const plano = norm(html);

  completos.forEach(n => {
    if (plano.includes(norm(n))) fallas.push(`nombre completo del padrón: «${n}»`);
  });
  apellidos.forEach(a => {
    /* El apellido solo se marca con borde de palabra, como las palabras de los
       reclamos: «Paz» adentro de «capaz» no es nadie. */
    if (new RegExp('\\b' + norm(a).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(plano)) {
      fallas.push(`apellido del padrón: «${a}»`);
    }
  });

  /* La señal fuerte, que no depende de que la persona esté en la semilla: el
     padrón escribe «APELLIDO, NOMBRE» y así se copia a un comentario. */
  const comaMayus = html.match(/\b[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ]{2,}(?: [A-ZÁÉÍÓÚÑ]{2,})*, [A-ZÁÉÍÓÚÑ]{3,}/g) || [];
  /* Lo que el patrón agarra y **no** es un nombre: pares de siglas y de
     rótulos que el código escribe en mayúsculas separados por coma. La lista
     es explícita y corta a propósito, como `APELLIDOS_QUE_SON_PALABRAS`: lo que
     aparezca nuevo tiene que mirarlo una persona, que es para lo que está el
     chequeo. Los ejemplos de la interfaz van con nombres inventados —«PEREZ,
     MARTA» no es nadie del padrón— y por eso están acá. */
  const ejemplos = new Set([
    'APELLIDO, NOMBRE', 'APELLIDO, NOMBRES', 'APELLIDO, CARGO', 'CUIL, APELLIDO',
    'CUIL, DNI', 'CUIT, ART', 'ART, ANSES', 'CCT, CATEGORIAS', 'DOT, ORG',
    'OPERADORES, ARTS',
    'ESTÁ DECIDIDO, FALTA',
    'PEREZ, MARTA', 'PEREZ, MARIA'
  ]);
  [...new Set(comaMayus)].forEach(x => {
    if (!ejemplos.has(x)) fallas.push(`se parece a un nombre del padrón: «${x}»`);
  });

  /* Y los números que identifican a una persona, que nunca pueden estar. */
  const cuiles = [...new Set(html.match(/\b2[0347]\d{9}\b/g) || [])];
  cuiles.forEach(c => fallas.push(`parece un CUIL: ${c}`));

  return fallas;
}

const dado = process.argv[2];
let archivo = dado;
if (!archivo) {
  archivo = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pub-')), 'panel.html');
  execFileSync('python3', [path.join(raiz, 'build-pagina-unica.py'), '--sin-plantel', archivo],
               { cwd: raiz, stdio: 'ignore' });
}
const html = fs.readFileSync(archivo, 'utf8');
const fallas = revisar(html);

if (fallas.length) {
  console.error(`✗ ${fallas.length} cosa${fallas.length === 1 ? '' : 's'} que no puede${
    fallas.length === 1 ? '' : 'n'} viajar a la página publicada:\n`);
  fallas.forEach(f => console.error('  · ' + f));
  console.error('\nSi es un ejemplo de un comentario, cambiá el nombre por uno inventado.');
  process.exit(1);
}
console.log('✓ la página publicada no lleva ningún nombre de persona ni ningún CUIL');
