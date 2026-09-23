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
  `ausencias`, `desarrollo`, `checklist`, `reclamos`, `agenda`, `asistente`,
  `diario`, `acceso`, `store`, `reporte`, `app`.
  `build-pagina-unica.py` lee ese orden del HTML.
- Ruteo por hash: `#/red`, `#/nomina`, `#/asistente` (y `#/agenda`, que es la
  misma), `#/diario` (y `#/presentismo`), `#/operacion` (y `#/ventas`),
  `#/sucursales` (y `#/visitas`, que es la misma), `#/desarrollo[/<id>]`,
  `#/reclamos`, `#/movimientos[/cesiones|/bajas]`, `#/sucursal/<id>`,
  `#/estadistica[/<tab>]`, `#/visita/<id>/<tab>`, `#/config`.
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
| La semana | Sucursales → la tienda (check list + talento) | ¿Qué está pasando en esta tienda? |
| El mes cerrado | Estadística mensual | ¿Qué pasó, cuánto costó, contra qué lo comparo? |

La navegación es una **columna a la izquierda** (`aside.lateral` en
`index.html`). Arriba de todo, sueltos y sin rótulo, van los **tres niveles de
zoom**: *Panel* (el área), *Sucursales* (una tienda), *Nómina* (una persona). No
son tareas, son desde dónde se mira, y de ahí sale el camino de todos los días:
**Sucursales → elegir la sucursal → lo que haga falta de esa tienda**.

Debajo van los grupos, por ritmo de trabajo y no por módulo: *Cada día*,
*Seguimiento*, *Cierre del mes*, *La operación*. Una entrada nueva va adentro
del grupo que le corresponde, salvo que sea otro punto de partida.

*Seguimiento* se llamaba *En la tienda* y tenía adentro a *Sucursales*. Estaba
mezclado: la puerta de entrada a una tienda no es una tarea al lado de
*Reclamos* y *Cesiones y bajas*, que son registros del área que se siguen en el
tiempo. Sacar *Sucursales* arriba dejó al grupo diciendo lo que es.

La columna era una fila de solapas y dejó de entrar: en vertical el rótulo del
grupo se lee arriba de sus ítems en vez de pelear por el ancho, y entran el
ícono y el contador sin empujar nada fuera de la pantalla.

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

**El encabezado es solo el botón de menú y dónde estás parado.** Tenía el
selector «Ir a una sucursal…» y «+ Nueva visita», que aparecían en las trece
pantallas, incluidas las que no tienen nada que ver con una visita. Registrar
una visita se hace en `#/sucursales` y en ningún otro lado. Una acción que sirve en
una sola pantalla no va en el armazón.

**Los cargos que existen hoy están en `CARGOS_NOMINA` (`catalogos.js`)**: los
catorce que aparecen en las 139 fichas de la nómina, ninguno inventado. Cada fila
junta cargo, nivel de cargo, categoría de la nómina, posición del panel, jornada
y si es un bloqueo de matrícula, porque en la práctica van juntos: elegir
«FARMACEUTICO AUXILIAR TP» ya dice que son 0,5 FTE. `MAPA_CARGOS` **se deriva de
esa lista** — no agregar una segunda lista de cargos. Un cargo nuevo se agrega
ahí y aparece en el alta a mano, en la importación y en el organigrama.

**Se puede dar de alta a alguien a mano**, desde `#/nomina`, sin esperar la
nómina del mes: nombre, legajo, DNI, sucursal, unidad de negocio, posición, fecha
de ingreso, jornada y jefe (`c.jefe`, que la nómina no trae). Al guardar suma su
FTE a la tienda. **Un cargo que dice `TP` o `JORNADA PARCIAL` entra como 0,5
aunque el desplegable diga full time**: lo define el cargo, porque si no la
dotación de la tienda sale mal y no se nota hasta el cierre del mes. La
importación posterior lo reconoce por nombre y lo completa sin duplicarlo.

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
Documentado en `docs/asistente.md`.

**El panel no se conecta a ningún servicio personal del coordinador.** Este es
su tablero de trabajo, y su calendario y su correo son suyos. Leía el
**calendario de Google** con la capacidad `mcp` y mostraba las reuniones del día
arriba de la agenda: se eliminó entero —la tira, `eventosDelDia()`, `horaDe()`,
`explicarError()`, la herramienta `ver_agenda_del_dia` del chat y la declaración
de `mcp` al publicar— porque lo que aparecía ahí era la vida privada de una
persona dentro de una herramienta de la empresa. El correo se evaluó y se
descartó por lo mismo. **No reponer ninguno de los dos ni proponerlos de
vuelta**: lo que tenga que entrar al panel se pega a mano, que es como el
coordinador eligió trabajar.

Queda en pie la regla que dejó a Gmail afuera la primera vez: **nunca publicar
una página que llame a una herramienta de un conector sin haber visto una
request y una response reales.**

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

**Las novedades que hay que pasarle a Nómina** viven como una marca sobre la
agenda (`item.liquidacion`, un período `'2026-09'`), en un bloque al tope de
`#/asistente`. Documentado en `docs/novedades-liquidacion.md`. Es la tercera cosa
distinta: `c.novedades` es lo que la liquidación **devolvió** ya cerrado, y esto
es lo de antes —lo que **hay que pasar**—. Se marcan solas al pegar un texto que
habla de horas extras, francos, adelantos o faltantes, y se marcan y **desmarcan**
a mano con la misma casilla: el detector se equivoca y un falso positivo que no
se puede sacar ensucia el parte del cierre.

El período **no es el mes en curso** sino el que sale de
`periodoDeLiquidacion(fecha, corte)`: lo que aparece después del día de cierre
—`parametros.diaCierreNovedades`, 25 por defecto, editable en `#/config`— va al
recibo siguiente. Juntar en el parte algo que Nómina no va a tomar es peor que no
marcarlo. El bloque lista apuntes que también están en su cajón por fecha y por
eso los muestra **siempre plegados**: la misma ficha editable abierta dos veces
en una pantalla es un lugar de más donde escribir.

**El correo no se conecta y no hay que proponerlo de vuelta.** Se evaluó leerlo
para detectar solo lo que requiere una novedad y el coordinador decidió que
prefiere entrar a leer los mails él y pegar lo que corresponda. Es una decisión
suya, no una limitación técnica.

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
y vive en la solapa *Talento y 9-box* de la visita, junto al 9-box. Ahí se
decide **a quién mirar**; qué pasó después con esa persona se registra en
`#/desarrollo`.

**En *Talento y 9-box* solo se evalúa.** El nombre, el puesto y la fecha de
ingreso se leen: eran campos editables al lado de los desplegables de evaluación
y era fácil pisar el dato de la nómina mientras se evaluaba a otro. Lo editable
de la fila son desempeño y potencial, que es el punto de la solapa. La identidad
se corrige en la ficha de la persona —donde `nombre` y `fechaIngreso` son ahora
campos, no `dato()`— porque sacarlos de la tabla los dejaba sin ningún lugar
donde arreglarlos.

**El plantel tampoco se arma acá.** La tabla es `d.activos`, la misma lista que
dibuja la matriz: el plantel activo de esa sucursal, así que una baja desaparece
sola. Iba por su cuenta sobre `s.colaboradores` y listaba a los de baja mientras
el contador de «sin evaluar» ya los excluía. Se sacaron el alta y el ✕ de la
fila: sumar gente es el alta de `#/nomina`, y `borrar-colaborador` se movió a la
ficha de la persona. **Borrar no es dar de baja**: borrar elimina a la persona con
su evaluación, sus ausencias y su historial y es para el que se cargó por error;
el que dejó de trabajar va a la baja, que lo conserva. El diálogo lo aclara.

La matriz de FTE de la estadística usa el **cabezal de dos niveles de la planilla
TD01**: *Heads* (todo el mes · ingreso · total) y *F.T.U.* (todo el mes · egreso ·
ingreso · total días · hs. extras · ausent + vaca · total). Las cabezas y los
días son preguntas distintas —a cuánta gente le doy turno, y cuánto trabajo se
prestó— y por eso van en grupos separados.

**El desarrollo al rol de Senior vive en `#/desarrollo`** y está documentado en
`docs/desarrollo-senior.md`. Es la trazabilidad de un APV propuesto para cubrir
el rol: quién lo propuso y cuándo, desde cuándo entrena, la **fecha de fin
tentativa**, cada assessment y la conversación mensual con el gerente. Tres
cuadrantes —propuesto, en entrenamiento, cerrado— y ninguno más; el panel
**no mueve el estado solo**, pero marca en rojo lo vencido y avisa cuando un mes
se fue sin evaluación.

Lo que se evalúa **sale del inventario de competencias de Farmatodo**, no de una
lista inventada: `COMPETENCIAS_SENIOR` (`desarrollo.js`) son las once que la
matriz *Modelos de competencias por áreas de negocio y roles* le pide al APV
Senior, con el nivel que ya trae como APV y el que le exige el rol. Los niveles
del inventario son **acumulativos**, así que se guarda un número por competencia.
Cada una trae su definición textual y los títulos de los indicadores **hasta el
nivel del rol**: los seis niveles de Liderazgo para evaluar el primero es lo
mismo que no darle nada al gerente. *Conciencia de equipo* queda afuera a
propósito —el modelo se la pide al APV y no al Senior— y la pantalla lo dice.

El entrenamiento cuelga de la **persona** (`c.entrenamientos[]`), como `c.baja`,
`c.movimientos` y `c.ausencias`, así la trazabilidad la acompaña si la trasladan
en el medio del proceso. Lo que se deja en *sin cambio* en una evaluación
**mantiene lo de la evaluación anterior**: `nivelesActuales()` se queda con el
último número de cada competencia, para que una charla sobre tres competencias
no borre lo que midió el assessment del mes pasado. El avance se cuenta como
**competencias que llegaron al nivel que pide el rol, sobre once**, nunca como
promedio: un 2 sobre una escala de 6 y un 2 sobre una de 4 no son lo mismo.
El formulario de evaluación está **solo ahí**; la ficha de la persona y el pie de
*Talento y 9-box* en la visita lo listan en lectura y enlazan, como el
recordatorio de reclamos.

El instrumento de la visita es el **check list de RRHH Operaciones**
(`assets/js/checklist.js`, documentado en `docs/checklist-rrhh.md`): 30 puntos
con criterio de aprobación, y es el único —la recorrida del HRBP se eliminó por
repetirlo—. `v.recorrida` sigue en el modelo para no romper lo ya guardado, pero
no se muestra ni entra en ningún reporte.

**`#/sucursales` (*Sucursales*) es la puerta de entrada a las tiendas** y
reemplazó a *Visitas* en el menú. Es la misma lista mirada desde donde el
coordinador la mira: no piensa «voy a registrar una visita» sino «voy a
Botánico», y la visita es algo que pasa adentro de la tienda, no al revés. Una
fila por tienda con **la situación de cada una** —dotación en FTE, ausencias de
hoy separando las que no tienen certificado, reclamos abiertos, gente en
desarrollo, última visita con su semáforo y compromisos sin cerrar—, ordenable
por lo que pide atención, por nombre, por antigüedad de la visita o por
dotación. `#/visitas` sigue viva como ruta: hay enlaces guardados y el botón
«Visitar» de cada ficha.

**Siguen siendo dos listas de tiendas y no tres.** `#/red` mira el área de
conjunto —KPIs y una tarjeta por tienda— y `#/sucursales` mira tienda por
tienda. Una pantalla nueva que necesite listar las doce tiene que apoyarse en
una de esas dos. La regla que eliminó la vieja solapa *Sucursales* no cambió;
lo que cambió es cuál de las dos listas es la puerta de entrada.

**Los flotantes no son una tienda** y la pantalla lo respeta: se los marca como
staff, no se los mide por visitas y no aparecen en el selector para registrar
una. Están en la lista porque ahí hay gente que hay que poder alcanzar.

**`#/sucursal/<id>` es el final del camino** y por eso tiene el bloque *De esta
tienda*: atajos a Presentismo, Reclamos, Desarrollo y Cesiones y bajas, cada uno
con el número que dice si hace falta ir. **No son pantallas nuevas ni copias**:
son las del área, filtradas o posicionadas en esa tienda. Lo que aportan es no
tener que acordarse del nombre de la tienda para volver a buscarla del otro
lado, que es exactamente el paso que sobraba.

**Cada tienda se edita en su propia página.** La vieja solapa *Sucursales* era
una tercera lista y lo único propio que tenía era una ficha editable escondida
en una fila desplegable, mientras los mismos campos se leían en
`#/sucursal/<id>`. Lo que tenía se repartió donde ya vivía la mitad:

- **la ficha** (razón social, CUIT, ART, dirección, horario, referentes, notas)
  es ahora editable en `#/sucursal/<id>`, con un botón que alterna lectura y
  edición sobre `fichaSucursal`;
- **la importación de la nómina** está al pie de `#/nomina`;
- **el alta, la baja y «Cargar padrón del Área 3»** están en `#/config`
  (`panelSucursalesConfig()`), que es donde vive el resto de la puesta a punto.

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
blanco. Ese chequeo parte el HTML por `<script>`, así que **ningún `.js` puede
llevar esa etiqueta escrita en un comentario**: parte el archivo en dos y el
chequeo falla en una línea que no tiene nada malo.
Más las pruebas e2e con Playwright (`/opt/node22/lib/node_modules/playwright`)
y Chromium headless, que viven en el directorio de trabajo temporal de la sesión.

## Privacidad

Los datos personales del padrón viven **solo en el navegador del usuario**,
cifrables con clave, con dos excepciones acotadas que sí están en el proyecto.
La gerencia autorizó al coordinador a trabajar con la nómina real del Área 3, y
esa autorización es para **el repositorio y el equipo, no para una página
publicada**.

`assets/js/plantel-area3.js` guarda lo **operativo** de las 139 personas del área
—nombre, tienda, cargo, categoría, nivel, jornada, fechas de ingreso, estatus y
unidad de negocio—, para que el panel no abra vacío cuando el navegador se
limpia. `assets/js/sucursales-area3.js` guarda los referentes de cada tienda:
gerente, director técnico, contacto administrativo con su mail y referente de
RRHH.

**Ninguno de los dos lleva CUIL, DNI, fecha de nacimiento, teléfono, domicilio,
mails del colaborador, banco ni CBU**, y no hay que agregárselos: esos campos
entran al pegar la nómina y se quedan en el navegador. El banco y el CBU se
importan desde septiembre de 2026, a pedido del coordinador: se muestran
plegados en la ficha y no aparecen en ningún reporte.

**Lo que se publica como página se arma siempre con `--sin-plantel`**, que ahora
hace dos cosas: vacía `PLANTEL_AREA3` y saca de `sucursales-area3.js` los
nombres de personas —los referentes, sus mails y el comentario de cabecera, que
también nombraba a alguien—. Ese segundo barrido no existía y las doce fichas de
referentes viajaron a la página publicada durante meses, porque el archivo se
llama «sucursales» y uno lo lee como datos de las tiendas. Las tiendas sí
quedan —código, `rvd`, dirección, CUIT, razón social, horario—: eso es dato de
la empresa y es lo que hace que la página publicada sirva para mostrarla.
**Antes de publicar, verificar que no quedó ningún nombre** buscándolos en el
HTML armado; que un campo esté vacío no alcanza si el nombre sigue tres líneas
más arriba, en un comentario.

El respaldo que se exporta desde Configuración **no está cifrado** y lleva esos
datos adentro; la pantalla de Configuración lo advierte cuando hay alguno
cargado. El cifrado no tiene recuperación por diseño.

El panel se guarda **copias automáticas** en el mismo navegador, en una clave
aparte del almacén: una por día al abrir y una antes de cada acción que
reemplaza todo el contenido. Están para el borrado por error, no para perder el
equipo —para eso está el respaldo `.json`—. Están documentadas en
`docs/respaldos.md`; **una acción nueva que reemplace todo el estado tiene que
llamar a `resguardar()` antes**.
