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
#   --compartir    la copia que se le pasa a alguien de otra empresa: arriba
#                  de `--demo`, cambia las doce sucursales por cuatro
#                  inventadas y le saca el nombre de la cadena, del área y del
#                  coordinador.
#
# `--compartir` existe porque las otras dos barren **personas** y dejan las
# tiendas enteras —código, RVD, dirección, CUIT, razón social—, que es dato de
# la compañía: en la página del propio coordinador eso es lo que la hace
# servible, y en una copia que sale para afuera no tiene por qué viajar.
compartir = '--compartir' in sys.argv
demo = '--demo' in sys.argv or compartir
sin_plantel = '--sin-plantel' in sys.argv or demo
if sin_plantel:
    scripts = [x for x in scripts if 'plantel-area3' not in x]
if compartir:
    scripts = ['assets/js/sucursales-demo.js' if 'sucursales-area3' in x else x
               for x in scripts]


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


# Lo que se reemplaza en `--compartir`, de lo más específico a lo más general:
# el orden importa, porque la última regla es una palabra que aparece adentro
# de las anteriores.
#
# Va acá y no editando los comentarios del repositorio: un comentario que dice
# «el laboratorio de Olivos está cargado como APV» es la razón por la que ese
# código existe y tiene que seguir diciendo la verdad para quien lo lee. Lo que
# cambia no es el código: es que esta copia sale para afuera. Es la misma
# división que ya hace `sin_personas()`.
MARCA_AFUERA = [
    # El prompt del asistente nombra a las tres cosas en una sola oración.
    ("'Sos el asistente de Christian Pérez, Coordinador de RRHH del Área 3 de Farmatodo Argentina.'",
     "'Sos el asistente del Coordinador de RRHH del área.'"),
    ("coordinador: 'Christian Pérez'", "coordinador: ''"),
    ('Christian Pérez', 'el coordinador de RRHH'),
    ('Christian', 'el coordinador'),
    # Las tiendas que los comentarios y los placeholders nombran de ejemplo.
    # En mayúsculas y cortadas por el ancho de la línea: así las escriben el
    # padrón y los comentarios que explican cómo se empareja cada tienda.
    ('San Martín Center', 'Sucursal Sur'), ('Martín Center', 'Martín Sur'),
    ('SM CENTER', 'SUC SUR'), ('OLIVOS', 'NORTE'), ('DEVOTO', 'SUR'),
    ('Ana de Botánico', 'Marta de Centro'),
    ('Botánico', 'Centro'), ('BOTANICO', 'CENTRO'),
    ('Olivos', 'Norte'), ('Devoto', 'Sur'), ('Rivadavia', 'Oeste'),
    ('FTD ARG', 'SUC'),
    ('Iron Lynx', 'otra razón social'),
    # La marca. `farmatodo` en minúscula son las claves del almacenamiento y el
    # nombre del archivo de respaldo, y se reemplazan igual para que sigan
    # coincidiendo entre sí.
    ('Farmatodo Argentina', 'la cadena'),
    ('FARMATODO', 'LA CADENA'), ('Farmatodo', 'la cadena'), ('farmatodo', 'panel'),
    ('Área 3', 'Área 1'), ('ÁREA 3', 'ÁREA 1'), ('AREA 3', 'AREA 1'),
]


# Lo único que lleva la marca adentro y **no** se puede tocar: la clave con la
# que `nomina.js` reconoce la columna «Fecha de Ingreso Farmatodo» del Excel.
# Es un identificador de JavaScript, así que reemplazarla no cambia un texto:
# deja la página sin compilar. Lo agarró el chequeo del archivo armado.
INTOCABLES = ['FECHADEINGRESOFARMATODOINGRESOAFTD']


def sin_marca(texto):
    """Saca el nombre de la cadena, del área y del coordinador."""
    for i, x in enumerate(INTOCABLES):
        texto = texto.replace(x, f'\0{i}\0')
    for viejo, nuevo in MARCA_AFUERA:
        texto = texto.replace(viejo, nuevo)
    for i, x in enumerate(INTOCABLES):
        texto = texto.replace(f'\0{i}\0', x)
    return texto


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
if compartir:
    # Los dos carteles —el de la portada y el de arriba del Panel— dicen otra
    # cosa en una copia que no es la demostración del coordinador.
    js = 'const COPIA_PARA_COMPARTIR = true;\n' + js

cuerpo = html.split('<body>', 1)[1].split('</body>', 1)[0]
cuerpo = re.sub(r'\s*<script src="[^"]+"></script>', '', cuerpo).strip()

if compartir:
    # Último, cuando ya están adentro el plantel de ejemplo y los dos carteles:
    # el barrido corría antes de las inyecciones y el plantel de ejemplo —que
    # vive en la primera tienda del área— se llevaba su nombre a la copia.
    css, js, cuerpo = sin_marca(css), sin_marca(js), sin_marca(cuerpo)

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
