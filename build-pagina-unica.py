#!/usr/bin/env python3
"""
Arma la versión de archivo único que se publica como página, a partir de los
mismos fuentes del repositorio.

El orden de los scripts se lee de index.html: no hay una lista paralela que
mantener, así que agregar un archivo al HTML alcanza para que entre acá.
"""
import re, sys, pathlib

raiz = pathlib.Path(__file__).resolve().parent
html = (raiz / 'index.html').read_text(encoding='utf-8')

# CSS y JS en el orden en que los declara el HTML
hojas   = re.findall(r'<link[^>]+href="([^"]+\.css)"', html)
scripts = re.findall(r'<script src="([^"]+\.js)"></script>', html)
if not scripts:
    sys.exit('No se encontró ningún <script src> en index.html')

# El plantel del área lleva nombre, tienda y cargo de gente real. Va en la
# versión que se abre desde el equipo; las otras dos son para publicar:
#
#   --sin-plantel  el padrón queda vacío.
#   --demo         en su lugar van las cinco personas inventadas de
#                  `plantel-demo.js`.
#
# `--demo` existe porque una página publicada sin nadie adentro abre en cero y
# parece rota: no se entiende qué hace el panel hasta que alguien carga gente,
# y en la página publicada no hay gente que cargar. Las dos barren igual los
# nombres de los referentes de las sucursales.
demo = '--demo' in sys.argv
sin_plantel = '--sin-plantel' in sys.argv or demo
if sin_plantel:
    scripts = [x for x in scripts if 'plantel-area3' not in x]


def sin_personas(texto):
    """Saca del padrón de sucursales los nombres de personas.

    `--sin-plantel` sacaba el plantel y dejaba pasar esto, que también es gente
    real: los doce gerentes, los doce directores técnicos, los contactos
    administrativos con su mail y los referentes de RRHH. Viajaron a la página
    publicada durante meses sin que nadie lo notara, porque el archivo se llama
    "sucursales" y uno lo lee como datos de las tiendas.

    Las tiendas sí quedan —código, dirección, CUIT, razón social, horario—: eso
    es dato de la empresa y es lo que hace que la página sirva para mostrarla.
    """
    # El comentario de cabecera también nombra a una persona, y un comentario
    # viaja al bundle igual que el código. Se va entero: es documentación para
    # quien edita el archivo, no hace falta en la página publicada. Vaciar
    # campos y dejar el nombre tres líneas más arriba sería peor que no hacer
    # nada, porque parecería resuelto.
    texto = re.sub(r'\A\s*/\*.*?\*/\s*', '', texto, count=1, flags=re.S)
    texto = re.sub(
        r"\b(gerente|directorTecnico|contactoAdmin|emailContactoAdmin|"
        r"referenteRRHH|gerenteOperaciones):\s*'[^']*'",
        r"\1: ''", texto)
    texto = re.sub(r"\{\s*nombre:\s*'[^']*',\s*email:\s*'[^']*'\s*\}",
                   "{ nombre: 'Gerencia de Operaciones', email: '' }", texto)
    # Los dos nombres que el padrón traía mal cargados. Vaciar la lista sólo
    # desactiva una corrección de datos ya guardados, que en una página recién
    # abierta no tiene nada que corregir.
    return re.sub(r"const NOMBRES_A_LIMPIAR = \[[^\]]*\]",
                  "const NOMBRES_A_LIMPIAR = []", texto)


def fuente(ruta):
    texto = (raiz / ruta).read_text(encoding='utf-8')
    return sin_personas(texto) if sin_plantel and 'sucursales-area3' in ruta else texto


css = '\n'.join((raiz / h).read_text(encoding='utf-8') for h in hojas)
js  = '\n'.join(fuente(s) for s in scripts)
if demo:
    # `plantel-demo.js` declara el mismo `PLANTEL_AREA3`, así que entra en el
    # lugar que dejó vacío el archivo real y el resto del panel no se entera.
    #
    # `PAGINA_DE_DEMOSTRACION` es lo único que el panel sí necesita saber: sin
    # eso, la página publicada abre con cinco personas inventadas y parece que
    # el padrón de verdad se perdió. Con eso lo dice en un cartel.
    js = ('const PAGINA_DE_DEMOSTRACION = true;\n'
          + (raiz / 'assets/js/plantel-demo.js').read_text(encoding='utf-8') + '\n' + js)
elif sin_plantel:
    js = 'const PLANTEL_AREA3 = [];\n' + js
if sin_plantel:
    # `LABORATORIO_AREA3` y `NO_PRESENCIALES_AREA3` también viven en ese archivo
    # y también son nombres de
    # personas. Sin esta línea la página publicada rompe con un ReferenceError
    # en vez de abrir vacía, que es peor que la fuga que vinimos a evitar.
    js = ('const LABORATORIO_AREA3 = [];\n'
          'const NO_PRESENCIALES_AREA3 = [];\n') + js

cuerpo = html.split('<body>', 1)[1].split('</body>', 1)[0]
cuerpo = re.sub(r'\s*<script src="[^"]+"></script>', '', cuerpo).strip()

salida = f"""<title>Panel de Control de RRHH</title>
<style>
{css}
</style>

{cuerpo}

<script>
{js}
</script>
"""

args = [x for x in sys.argv[1:] if not x.startswith('--')]
destino = pathlib.Path(args[0]) if args else raiz / 'tablero-visitas-rrhh.html'
destino.write_text(salida, encoding='utf-8')
print(f'{destino}  ·  {len(salida)/1024:.0f} KB')
print('  hojas de estilo:', ', '.join(hojas))
print('  scripts:', ', '.join(scripts))
