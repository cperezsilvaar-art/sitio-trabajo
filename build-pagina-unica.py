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

css = '\n'.join((raiz / h).read_text(encoding='utf-8') for h in hojas)
js  = '\n'.join((raiz / s).read_text(encoding='utf-8') for s in scripts)

cuerpo = html.split('<body>', 1)[1].split('</body>', 1)[0]
cuerpo = re.sub(r'\s*<script src="[^"]+"></script>', '', cuerpo).strip()

salida = f"""<title>Tablero de Visitas RRHH</title>
<style>
{css}
</style>

{cuerpo}

<script>
{js}
</script>
"""

destino = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else raiz / 'tablero-visitas-rrhh.html'
destino.write_text(salida, encoding='utf-8')
print(f'{destino}  ·  {len(salida)/1024:.0f} KB')
print('  hojas de estilo:', ', '.join(hojas))
print('  scripts:', ', '.join(scripts))
