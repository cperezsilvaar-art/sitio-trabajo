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

# `--sin-plantel` deja el padrón vacío. Existe para cuando `plantel-area3.js`
# lleva gente real, que no corresponde que viaje a una página publicada. Hoy ese
# archivo tiene cinco personas inventadas y la página se publica con ellas, que
# es lo que permite mostrar el panel funcionando. Si alguna vez vuelve el plantel
# real, publicar sin este flag pasa a ser una fuga de datos.
if '--sin-plantel' in sys.argv:
    scripts = [x for x in scripts if 'plantel-area3' not in x]

css = '\n'.join((raiz / h).read_text(encoding='utf-8') for h in hojas)
js  = '\n'.join((raiz / s).read_text(encoding='utf-8') for s in scripts)
if '--sin-plantel' in sys.argv:
    js = 'const PLANTEL_AREA3 = [];\n' + js

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
