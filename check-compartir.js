#!/usr/bin/env node
/*
 * check-compartir.js — que la copia que sale para afuera no lleve nada de la
 * empresa adentro.
 *
 * `check-publicacion.js` cuida **las personas** y se sigue corriendo: esto lo
 * llama y le suma lo otro. Lo otro es el padrón de sucursales, que en la página
 * del propio coordinador viaja a propósito —código, RVD, dirección, CUIT,
 * razón social: es lo que hace que la página sirva para mostrarla— y en una
 * copia para alguien de otra empresa no tiene por qué estar.
 *
 * Las dos fuentes de lo prohibido son los archivos de datos del repositorio,
 * no una lista escrita a mano: si mañana entra una tienda nueva, el chequeo la
 * busca sin que nadie se acuerde de agregarla. Es lo mismo que
 * `MAPA_CARGOS` derivándose de `CARGOS_NOMINA`.
 *
 *   node check-compartir.js [archivo.html]
 *
 * Sin argumento arma la versión `--compartir` en un temporal y la revisa.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');

const raiz = __dirname;
const sinTildes = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = s => sinTildes(s).toLowerCase();

/* La marca, el área y el coordinador. Van con borde de palabra y sin tildes,
   porque lo que se busca puede estar escrito de cualquiera de las dos formas
   en un comentario. */
const PALABRAS_DE_LA_EMPRESA = [
  'farmatodo', 'ftd arg', 'christian perez', 'paez marquez', 'estudioeka'
];

/* Campos del padrón de sucursales que identifican a la empresa. El nombre y el
   código de cada tienda van aparte porque alguno puede ser una palabra común
   —«Mark»— y se buscan con borde de palabra. */
const CAMPOS_DE_TIENDA = ['razonSocial', 'cuit', 'direccion', 'emailContactoAdmin'];

function loDeLaEmpresa() {
  const txt = fs.readFileSync(path.join(raiz, 'assets/js/sucursales-area3.js'), 'utf8');
  const exactos = new Set(), palabras = new Set(PALABRAS_DE_LA_EMPRESA);
  CAMPOS_DE_TIENDA.forEach(campo => {
    const re = new RegExp(campo + ":\\s*'([^']+)'", 'g');
    let m; while ((m = re.exec(txt))) if (m[1].trim().length > 5) exactos.add(m[1].trim());
  });
  ['codigo', 'nombre'].forEach(campo => {
    const re = new RegExp(campo + ":\\s*'([^']+)'", 'g');
    let m; while ((m = re.exec(txt))) if (m[1].trim().length > 3) palabras.add(m[1].trim());
  });
  return { exactos, palabras };
}

function revisar(html) {
  const fallas = [];
  const { exactos, palabras } = loDeLaEmpresa();
  const plano = norm(html);

  exactos.forEach(x => {
    if (plano.includes(norm(x))) fallas.push(`dato de una sucursal: «${x}»`);
  });
  palabras.forEach(x => {
    const re = new RegExp('\\b' + norm(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
    if (re.test(plano)) fallas.push(`nombre de la empresa o de una tienda: «${x}»`);
  });

  /* Un CUIT de empresa empieza en 30 o 33, así que el patrón de CUIL de
     `check-publicacion.js` no lo agarra: acá sí, porque una copia que sale
     para afuera no lleva ningún CUIT. */
  [...new Set(html.match(/\b3[0345]\d{9}\b/g) || [])]
    .forEach(c => fallas.push(`parece un CUIT: ${c}`));

  return fallas;
}

const dado = process.argv[2];
let archivo = dado;
if (!archivo) {
  archivo = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'comp-')), 'panel.html');
  execFileSync('python3', [path.join(raiz, 'build-pagina-unica.py'), '--compartir', archivo],
               { cwd: raiz, stdio: 'ignore' });
}

/* Las personas las sigue cuidando el chequeo de siempre: una copia que sale
   para afuera tiene que pasar los dos, y tener dos listas de nombres sería la
   garantía de que un día difieran. */
let personas = 0;
try {
  execFileSync('node', [path.join(raiz, 'check-publicacion.js'), archivo],
               { cwd: raiz, stdio: 'inherit' });
} catch (e) { personas = 1; }

const fallas = revisar(fs.readFileSync(archivo, 'utf8'));
if (fallas.length) {
  console.error(`\n✗ ${fallas.length} cosa${fallas.length === 1 ? '' : 's'} de la empresa en la copia:\n`);
  fallas.forEach(f => console.error('  · ' + f));
  console.error('\nSe barre en `sin_marca()` de build-pagina-unica.py, no editando el comentario.');
}
if (fallas.length || personas) process.exit(1);
console.log('✓ la copia no lleva nada de la empresa: ni marca, ni sucursales, ni CUIT');
