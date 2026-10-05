#!/usr/bin/env python3
"""
build-anexo.py — arma `anexo-gerentes.html`, la página que usan los gerentes.

Existe por una sola razón: **que no haya una segunda lista de motivos**. El
anexo tiene que ser un archivo solo —se publica o se manda por mail, y abre sin
conexión— así que no puede cargar `reclamos.js` con un `<script src>`. La
alternativa sería copiar los quince tipos de reclamo adentro de la página, y el
día que se agregue uno al panel las dos listas dirían cosas distintas sin que
nada falle. Es el mismo problema que `MAPA_CARGOS` resolvió derivándose de
`CARGOS_NOMINA`.

Así que la plantilla deja huecos marcados y este script los llena leyendo:

  - las tiendas, de `assets/js/sucursales-area3.js` (solo el nombre: ni
    referentes, ni mails, ni direcciones);
  - los motivos de reclamo, de `assets/js/reclamos.js` (`TIPOS_RECLAMO`, con su
    grupo, salteando «Otro» porque un desplegable que empieza por «Otro» se
    contesta con «Otro»);

El anexo es **solo para reclamos de sueldo** y para avisar que llegó una carta
documento. La rama de «una situación que necesita seguimiento» se eliminó a
pedido del coordinador, así que ya no se leen los `TIPOS_CASO`.

**Nunca inyecta nombres de personas.** Lo verifica `check-anexo.js`.

Uso:
    python3 build-anexo.py [destino] [--tel 5491122334455] [--mail rrhh@...]

`--tel` es el WhatsApp al que se manda y `--mail` la casilla. Sin ellos la
página sale igual y muestra solo «Copiar el texto», que es una salida completa:
el gerente pega el mensaje donde quiera.
"""

import pathlib
import re
import sys

raiz = pathlib.Path(__file__).resolve().parent


def argumento(nombre, defecto=''):
    """El valor de `--nombre v`, o el defecto si no vino."""
    args = sys.argv[1:]
    if nombre in args:
        i = args.index(nombre)
        if i + 1 < len(args):
            return args[i + 1]
    return defecto


def fuente(ruta):
    return (raiz / ruta).read_text(encoding='utf-8')


def bloque(texto, nombre):
    """El cuerpo de `const NOMBRE = [ ... ];` tal como está escrito.

    Se corta por el `];` que arranca al principio de una línea: los corchetes
    de adentro de cada fila no cuentan porque van indentados.
    """
    m = re.search(r'^const ' + nombre + r'\s*=\s*\[(.*?)^\];', texto, re.S | re.M)
    if not m:
        raise SystemExit(f'No encontré {nombre}. ¿Se renombró o cambió de archivo?')
    return m.group(1)


def campos(cuerpo, *claves):
    """Una tupla por fila con el valor de cada clave pedida, o '' si no está."""
    filas = []
    for fila in re.findall(r'\{(.*?)\}', cuerpo, re.S):
        valores = []
        for clave in claves:
            m = re.search(clave + r"\s*:\s*'((?:[^'\\]|\\.)*)'", fila, re.S)
            valores.append(m.group(1).replace("\\'", "'") if m else '')
        if any(valores):
            filas.append(tuple(valores))
    return filas


def js(valor):
    """Un literal de JavaScript, con las comillas simples escapadas."""
    if isinstance(valor, str):
        return "'" + valor.replace('\\', '\\\\').replace("'", "\\'") + "'"
    if isinstance(valor, (list, tuple)):
        return '[' + ', '.join(js(x) for x in valor) + ']'
    if isinstance(valor, dict):
        return '{ ' + ', '.join(f'{k}: {js(v)}' for k, v in valor.items()) + ' }'
    raise TypeError(valor)


# --- Las tiendas. Solo el nombre: es lo que el gerente tiene que reconocer. ---
sucursales = campos(bloque(fuente('assets/js/sucursales-area3.js'), 'SUCURSALES_AREA3'),
                    'nombre', 'codigo')
# Los flotantes del área no son una tienda y ningún gerente carga por ellos.
tiendas = sorted(n for n, _c in sucursales if n and 'FLOTANTE' not in n.upper())
if len(tiendas) < 5:
    raise SystemExit(f'Salieron {len(tiendas)} tiendas: algo cambió en el padrón.')

# --- Los motivos de reclamo, con su grupo, menos «Otro». ---
reclamos = campos(bloque(fuente('assets/js/reclamos.js'), 'TIPOS_RECLAMO'),
                  'id', 'nombre', 'grupo')
motivos_reclamo = [{'grupo': g, 'nombre': n} for i, n, g in reclamos if i != 'otro']
if len(motivos_reclamo) < 8:
    raise SystemExit(f'Salieron {len(motivos_reclamo)} motivos: algo cambió en TIPOS_RECLAMO.')

tel = re.sub(r'\D', '', argumento('--tel'))
mail = argumento('--mail').strip()

pagina = fuente('anexo-gerentes.plantilla.html')
for marca, valor in [
    ('TIENDAS', js(tiendas)),
    ('MOTIVOS_RECLAMO', js(motivos_reclamo)),
    ('TEL_RRHH', js(tel)),
    ('MAIL_RRHH', js(mail)),
]:
    nuevo, n = re.subn(r'/\*\{' + marca + r'\}\*/.*?/\*\{/' + marca + r'\}\*/',
                       lambda _m, v=valor: v, pagina, flags=re.S)
    if n != 1:
        raise SystemExit(f'El hueco {marca} aparece {n} veces en la plantilla.')
    pagina = nuevo

# La plantilla es el fuente; lo generado se avisa arriba para que nadie lo edite.
pagina = pagina.replace(
    '<!doctype html>',
    '<!doctype html>\n<!-- GENERADO por build-anexo.py desde '
    'anexo-gerentes.plantilla.html. No editar a mano. -->', 1)

destino = raiz / 'anexo-gerentes.html'
for a in sys.argv[1:]:
    if not a.startswith('--') and not a.isdigit() and a != tel and a != mail:
        if a.endswith('.html'):
            destino = pathlib.Path(a)
        break
destino.write_text(pagina, encoding='utf-8')

print(f'{destino}  ·  {len(pagina) / 1024:.0f} KB')
print(f'  tiendas: {len(tiendas)}')
print(f'  motivos de reclamo: {len(motivos_reclamo)}')
print(f"  WhatsApp: {tel or '— sin número, solo copiar —'}")
print(f"  mail: {mail or '— sin casilla, solo copiar —'}")
