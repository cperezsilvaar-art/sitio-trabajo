# Panel de Control de RRHH — Área 3, Farmatodo Argentina

Sitio estático en JavaScript sin build, sin dependencias externas y sin backend.
Tiene que abrir desde `file://` y funcionar sin conexión.

## Marco conceptual

Las decisiones de producto de este panel se apoyan en cuatro fuentes que el
usuario incorporó al proyecto. **Antes de agregar o cambiar un indicador, una
pantalla o un texto que va a leer un gerente, revisar `docs/marco-conceptual.md`**
y decir con cuál de estos criterios se alinea:

- **Ulrich, _The HR Value Proposition_** — el valor lo define quien recibe, no
  quien entrega. Todo entregable del panel se juzga por si le sirve al Gerente de
  Operaciones, al Gerente de Tienda o al colaborador; no por lo completo que sea.
- **Vosburgh, _La evolución de los RR.HH._** — RRHH como organización de
  consultoría interna. Lo transaccional se resuelve rápido para liberar tiempo a
  lo transformacional.
- **Deloitte, _2026 Global Human Capital Trends_** — orquestación en tiempo real
  por encima de la asignación fija de recursos.
- **McKinsey, _HR Monitor 2026_** — planificación de capacidades, no solo de
  headcount; compensación y equidad como principal driver de permanencia;
  frecuencia de feedback.

El marco normativo del área es el **CCT 414/05 (ADEF)**, farmacias de CABA y
conurbano. Lo que el panel guarda de él está en `assets/js/convenio.js` y
documentado en `docs/convenio-414.md`: categorías, escalafón por antigüedad,
vacaciones y los topes de licencias del art. 25. **El panel no liquida sueldos
ni guarda la escala salarial**, que la fijan las paritarias.

Quien tiene **bloqueo de título o figura como no presencial** presta la
habilitación profesional pero no cubre turno: `esNoPresencial()` lo separa de
toda cuenta operativa —dotación, cobertura, prellenado del día— y lo deja
visible aparte. Nunca contarlo en la dotación de piso. Lo mismo con los
**flotantes del área** (tienda `FLOTANTES ÁREA 3`, que se importa como `staff`):
suman al área, nunca a una sucursal.

**La dotación se cuenta en FTE, no en cabezas.** `jornadaDeVinculo()`, en
`convenio.js`, devuelve 1 para la jornada completa y 0,5 para el tiempo parcial,
que la nómina escribe dentro del cargo (`TP`, `JORNADA PARCIAL`). Dos personas de
media jornada cubren un puesto. `Store.dotacionPlantel(id)` y
`Store.dotacionDelArea()` son la cuenta buena y no dependen de que haya una
visita cargada.

## Reglas de escritura

- Todo el texto de la interfaz y de los reportes va en **castellano rioplatense**
  (voseo), sin jerga de RRHH que un gerente de tienda no use.
- Los números se formatean en **es-AR** (coma decimal, punto de miles). Nunca
  `toFixed()` en texto visible: usar `_n`, `_pct`, `_pctDia`, `fmtNum`, `fmtPct`.
- Los comentarios del código explican **por qué**, no qué. Si un comentario
  parafrasea la línea siguiente, sobra.
- Cada indicador que se muestra tiene que poder explicarse en una oración a
  alguien que no es de RRHH. Si no se puede, no va.

## Arquitectura

- Orden de carga en `index.html`: `catalogos`, `sucursales-area3`,
  `plantel-area3`, `modelo`, `talento`, `novedades`, `nomina`, `convenio`,
  `ausencias`, `checklist`, `reclamos`, `agenda`, `asistente`, `diario`,
  `acceso`, `store`, `reporte`, `app`.
  `build-pagina-unica.py` lee ese orden del HTML.
- Ruteo por hash: `#/red`, `#/nomina`, `#/asistente` (y `#/agenda`, que es la
  misma), `#/diario` (y `#/presentismo`), `#/operacion` (y `#/ventas`),
  `#/visitas`, `#/reclamos`,
  `#/movimientos[/cesiones|/bajas]`, `#/sucursal/<id>`,
  `#/estadistica[/<tab>]`, `#/visita/<id>/<tab>`, `#/config`.
  `#/sucursales` ya no es una solapa: la ruta sobrevive y redirige a `#/red`.
- Persistencia en `localStorage`, cifrable con PBKDF2-SHA256 + AES-GCM.
- **Trampa conocida:** todo lo que entra al panel se pega desde Excel, y Excel
  entrecomilla las celdas que tienen un salto de línea adentro —los encabezados
  de la nómina los tienen—. Nunca partir el texto pegado por `\n`: usar
  `filasPegadas()` de `catalogos.js`, que respeta el entrecomillado. Partir por
  `\n` pierde en silencio todas las columnas posteriores al primer salto.
- **Trampa conocida:** `setPath` parte la ruta por el punto. Cualquier clave
  compuesta que lleve un punto crea objetos anidados en vez de una clave plana.
  Usar `_` como separador (`piso_clima`) o un binding propio (`data-diario`).
- `confirm()` y `alert()` no funcionan dentro del visor de artifacts: usar
  `confirmar()` y `avisar()`.
- **Trampa conocida:** nada de `String.fromCharCode(...bytes)` ni ningún spread
  sobre un arreglo grande. Pasa un argumento por elemento y el navegador corta
  con “Maximum call stack size exceeded” a partir de unos 150.000. Le pasó al
  base64 del cifrado (`b64()` en `acceso.js`): con el padrón completo cargado
  **todo guardado fallaba**, y como el error se veía recién al recargar, parecía
  que los datos se borraban solos. Recorrer en trozos.

## Separación de escalas

Tres escalas de tiempo, tres pantallas, sin mezclarlas:

| Escala | Pantalla | Pregunta |
|---|---|---|
| El día | Presentismo | ¿Quién no está hoy y desde cuándo? |
| Lo que llevo | Asistente (chat + agenda) | ¿Qué tengo que hacer y qué estoy esperando? |
| La semana | Visitas (check list + talento) | ¿Qué está pasando en esta tienda? |
| El mes cerrado | Estadística mensual | ¿Qué pasó, cuánto costó, contra qué lo comparo? |

La navegación es una **columna a la izquierda** (`aside.lateral` en
`index.html`), agrupada por ritmo de trabajo —*Cada día*, *En la tienda*,
*Cierre del mes*, *La operación*— y no por módulo. Una entrada nueva va adentro
del grupo que le corresponde. Era una fila de solapas y dejó de entrar: en
vertical el rótulo del grupo se lee arriba de sus ítems en vez de pelear por el
ancho, y entran el ícono y el contador sin empujar nada fuera de la pantalla.

Tres cosas que hay que respetar al tocarla:

- El marcado sigue siendo `nav.tabs.principal` con `<a>` adentro, y el ruteo le
  pone `.activo` al que coincide con el hash. **La forma la da el CSS**
  (`.lateral nav.tabs.principal`), no otro marcado: las sub-navegaciones
  (`nav.tabs:not(.principal)`) siguen siendo horizontales con las mismas clases.
- **Los íconos son SVG en línea**, 24×24, `fill: none` y `stroke: currentColor`.
  Nada de tipografías de íconos ni de archivos: el panel abre desde `file://` y
  sin conexión.
- **Los contadores** (`[data-badge]`) los llena `contadoresDelMenu()` después de
  cada render: ausencias que piden acción, reclamos abiertos y movimientos sin
  aplicar. Se esconden en cero a propósito — un cero permanente deja de leerse a
  los dos días y ocupa el lugar de un número que importa.

Abajo de 980px la columna se vuelve **cajón**: el botón del encabezado la abre y
el velo, `Escape` o elegir un ítem la cierran. Cerrarla al elegir no es un
detalle: dejarla abierta tapando la pantalla a la que acabás de entrar es el
error clásico del patrón.

Fuera de esas tres escalas está **`#/nomina`**, que no responde a un ritmo sino a
«¿quién es esta persona?»: el padrón entero en una lista con buscador, flotantes
incluidos, y cada línea abre la ficha. Va al lado de *Panel* porque es material
de consulta, no una tarea del día. **Las bajas se quedan en ese listado, con su
fecha** —se las sigue buscando por nombre meses después—; lo que las separa de
los activos es la dotación, no la visibilidad.

La baja, la cesión de contrato y la modificación de puesto cuelgan de la
**persona** (`c.baja`, `c.movimientos[]`), no de la sucursal, así el historial la
acompaña cuando se muda de tienda. Se cargan en su ficha y se leen juntas en
`#/movimientos`. Lo autorizado con vigencia futura **no se aplica antes de
tiempo**: `aplicarMovimientosVencidos()` corre al abrir el panel. Documentado en
`docs/cesiones-y-bajas.md`.

El **asistente** (`assets/js/asistente.js`, pantalla `#/asistente`) pregunta a
Claude con la capacidad `sample` del visor de artifacts. Dos reglas que mandan:
**el panel tiene que seguir abriendo sin conexión** —si `claude.use('sample')`
devuelve null, la agenda funciona igual y la pantalla lo dice—, y **lo que se
manda es un resumen, nunca el padrón**: números por sucursal, visitas, reclamos,
bajas y la agenda; jamás CUIL, DNI, teléfono, domicilio, mail, banco ni CBU.
El asistente también lee **el calendario de Google** del visor con la capacidad
`mcp` —solo `list_events`, nunca escribe—. Cada código de error del conector
tiene su propio texto y su propio arreglo: un cartel único de “algo falló” es el
anti-patrón, porque esconde la acción que lo destraba. Documentado en
`docs/asistente.md`.

**Nunca publicar una página que llame a una herramienta de un conector sin haber
visto una request y una response reales.** Gmail quedó afuera por eso: el token
venció y no se pudo observar.

**`#/diario` (*Presentismo*) es solo las ausencias.** Nada más. Tenía además una
carga manual por sucursal —planificados, mínimo, ausentes, novedades, todas las
mañanas, tienda por tienda—, un tablero de KPIs, alertas, acciones para mañana y
su propio reporte. **Nadie la completaba**: sin reloj de fichadas el dato dependía
de que doce gerentes lo mandaran y de que el coordinador lo transcribiera antes de
la apertura, así que los indicadores quedaban en cero y el panel parecía roto
cuando lo que faltaba era una carga imposible de sostener. Se eliminó entera, con
`Reporte.textoDiario()`, `fichaSucursalDia()` y `panelSucursalDia()`. No reponerla:
si algún día hay fichadas, el dato entra solo, no a mano.

Lo que el motor necesitaba de esa carga sale ahora del padrón:
`presentesDelPadron(sucursal, fecha)` en `diario.js` cuenta la gente con turno de
una tienda —activa y que cubre turno— menos quien tiene una ausencia abierta esa
fecha. Es lo único que alimenta la venta por persona presente.

La ausencia se anota eligiendo a la persona: el panel completa su sucursal, su
antigüedad y los plazos de los arts. 208 y 211. **Sin la marca de certificado
presentado queda `pendienteJustificar`**, cualquiera sea la licencia, y encabeza
`alertasDeAusencias()`: es el único estado que dice qué hacer hoy —reclamar el
papel—. `tieneCertificado()` está en `ausencias.js`, junto a `tieneCargasFamilia()`,
y por el mismo motivo: el campo llega como texto y un `!!` a secas daría verdadero
para `'no'`.

**El historial va en la ficha de la persona**, no en la de la sucursal: vive en
`c.ausencias`, así que la acompaña cuando se muda de tienda. `ausenciasPorMes()`
lo reparte por mes calendario —del 25/08 al 05/09 son siete días de agosto y
cinco de septiembre, no doce de agosto— y no cuenta lo que todavía no pasó ni el
día de la reincorporación. Los días se cuentan con los dos extremos, y
`diasDeAusencia()` y el texto de `estadoDeAusencia()` usan la misma cuenta: dos
números distintos para lo mismo, uno al lado del otro, es peor que no mostrarlos.
No confundir ese bloque con *Ausencias mes a mes*, que sale de `c.novedades` (lo
liquidado). `#/diario/<colaboradorId>` abre el alta con esa persona ya elegida.

**La venta va en su propia pantalla**, `#/operacion` (*Ventas*), y es la única que
genera documento (`Reporte.textoVentasDia()`). Los totales van sobre
`calc.filasVenta`, **no sobre `calc.filas`**: el RDV llega completo todas las
mañanas y no depende de ninguna otra carga.

**Trampa conocida — nombres de ayuda repetidos entre módulos.** Los `.js` no son
módulos: en la página comparten ámbito global, y en la build de un solo archivo
van todos dentro del mismo `<script>`. Un segundo `const _diaHoy` o
`function _sumarDias` no rompe ese archivo: **rompe la página entera**, y con
`<script>` separados el módulo que llega segundo no se ejecuta. `_diaHoy` está en
`ausencias.js` y `_sumarDias` en `agenda.js`; los demás los usan sin redeclarar, o
eligen otro nombre (`_diaMas`). El chequeo que lo agarra está en la verificación
de más abajo y hay que correrlo siempre.

Las **ausencias con certificado** (`assets/js/ausencias.js`, `c.ausencias`) son
la tercera cosa distinta de `c.novedades` (el mes cerrado) y `c.licencias`
(art. 25 del CCT): la persona que hoy no está, desde cuándo y hasta cuándo. Los
plazos salen de la **LCT art. 208** —3/6 meses de licencia paga según
antigüedad, duplicados con cargas de familia— y **art. 211** —un año más de
reserva del puesto—. Es una orientación sobre la ley general, no un dictamen, y
así lo dice la pantalla. Documentado en `docs/ausencias.md`.

La **sucesión** no es un número del mes cerrado: es una conversación sobre gente
y vive en la solapa *Talento y 9-box* de la visita, junto al 9-box.

La matriz de FTE de la estadística usa el **cabezal de dos niveles de la planilla
TD01**: *Heads* (todo el mes · ingreso · total) y *F.T.U.* (todo el mes · egreso ·
ingreso · total días · hs. extras · ausent + vaca · total). Las cabezas y los
días son preguntas distintas —a cuánta gente le doy turno, y cuánto trabajo se
prestó— y por eso van en grupos separados.

El instrumento de la visita es el **check list de RRHH Operaciones**
(`assets/js/checklist.js`, documentado en `docs/checklist-rrhh.md`): 30 puntos
con criterio de aprobación, y es el único —la recorrida del HRBP se eliminó por
repetirlo—. `v.recorrida` sigue en el modelo para no romper lo ya guardado, pero
no se muestra ni entra en ningún reporte.

**Cada tienda se edita en su propia página.** La solapa *Sucursales* se eliminó:
era una tercera lista de las mismas doce tiendas —las otras dos son las tarjetas
de `#/red` y la tabla de `#/visitas`— y lo único propio que tenía era una ficha
editable escondida en una fila desplegable, mientras los mismos campos se leían
en `#/sucursal/<id>`. Lo que tenía se repartió donde ya vivía la mitad:

- **la ficha** (razón social, CUIT, ART, dirección, horario, referentes, notas)
  es ahora editable en `#/sucursal/<id>`, con un botón que alterna lectura y
  edición sobre `fichaSucursal`;
- **la importación de la nómina** está al pie de `#/nomina`;
- **el alta, la baja y «Cargar padrón del Área 3»** están en `#/config`
  (`panelSucursalesConfig()`), que es donde vive el resto de la puesta a punto.

Una pantalla nueva que necesite listar las doce tiendas tiene que apoyarse en
una de las que ya existen, no agregar una cuarta.

**Los reclamos se dan de alta en `#/reclamos` y en ningún otro lado.** Había un
segundo formulario al pie del check list: era la misma cosa con distintos campos
y obligaba a acordarse de cuál de las dos pantallas estaba más completa.
`#/reclamos/<sucursalId>` abre esa misma pantalla filtrada por una tienda —KPIs,
patrones, alta preseleccionada y autocompletado de su plantel—, y es a donde
llevan tanto el botón del pie del check list como el indicador *Reclamos
abiertos* de la ficha de la tienda. En la visita quedó el recordatorio —cuántos
hay abiertos y quiénes—, no el formulario. Que un reclamo cuente como
«planteado en esta visita» en `Reporte.textoVisita()` lo decide ahora la fecha,
no la pantalla de origen; `origenVisitaId` sigue valiendo para lo ya guardado.
Documentado en `docs/reclamos.md`.

## Verificación antes de commitear

```
for f in assets/js/*.js; do node --check "$f"; done
python3 build-pagina-unica.py
node -e "const vm=require('vm'),fs=require('fs');
  new vm.Script(fs.readFileSync('tablero-visitas-rrhh.html','utf8')
    .split('<script>')[1].split('</script>')[0]);
  console.log('la página compila')"
```
El tercero no es opcional: `node --check` valida cada archivo por separado y no
ve los choques de nombres entre módulos, que son los que dejan la página en
blanco.
Más las pruebas e2e con Playwright (`/opt/node22/lib/node_modules/playwright`)
y Chromium headless, que viven en el directorio de trabajo temporal de la sesión.

## Privacidad

Los datos personales del padrón viven **solo en el navegador del usuario**,
cifrables con clave, con una excepción acotada: `assets/js/plantel-area3.js`
guarda en el proyecto lo **operativo** de las 139 personas del área —nombre,
tienda, cargo, categoría, nivel, jornada, fechas de ingreso, estatus y unidad de
negocio—, para que el panel no abra vacío cuando el navegador se limpia.
**Ese archivo no lleva CUIL, DNI, fecha de nacimiento, teléfono, domicilio,
mails, banco ni CBU**, y no hay que agregárselos: esos campos entran al pegar la
nómina y se quedan en el navegador. El banco y el CBU se importan desde septiembre
de 2026, a pedido del coordinador: se muestran plegados en la ficha y no
aparecen en ningún reporte.

El respaldo que se exporta desde Configuración **no está cifrado** y lleva esos
datos adentro; la pantalla de Configuración lo advierte cuando hay alguno
cargado. El cifrado no tiene recuperación por diseño.

El panel se guarda **copias automáticas** en el mismo navegador, en una clave
aparte del almacén: una por día al abrir y una antes de cada acción que
reemplaza todo el contenido. Están para el borrado por error, no para perder el
equipo —para eso está el respaldo `.json`—. Están documentadas en
`docs/respaldos.md`; **una acción nueva que reemplace todo el estado tiene que
llamar a `resguardar()` antes**.
