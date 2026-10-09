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
  `ausencias`, `vacaciones`, `desarrollo`, `indicadores`, `casos`, `checklist`, `reclamos`,
  `agenda`, `asistente`, `diario`, `acceso`, `store`, `reporte`, `app`.
  `build-pagina-unica.py` lee ese orden del HTML.
- Ruteo por hash: `#/red`, `#/nomina`, `#/asistente` (y `#/agenda`, que es la
  misma), `#/diario` (y `#/presentismo`), `#/operacion` (y `#/ventas`),
  `#/sucursales` (y `#/visitas`, que es la misma), `#/desarrollo[/<id>]`,
  `#/reclamos`, `#/movimientos[/cesiones|/bajas]`, `#/vacantes`,
  `#/vacaciones[/<sucursalId>]`, `#/sucursal/<id>`,
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

Debajo van los grupos, por ritmo de trabajo y no por módulo: *Cada día*
—Presentismo, Ventas, Asistente—, *Seguimiento* y *Cierre del mes*. Una entrada
nueva va adentro del grupo que le corresponde, salvo que sea otro punto de
partida.

**Un rótulo de grupo arriba de un solo ítem es ruido.** *La operación* tenía
adentro únicamente a *Ventas*, y la venta del día es del día: se mudó a *Cada
día*, al lado de Presentismo, que es además donde se la mira —contra la gente
que estuvo—. Un grupo nuevo se crea cuando hay dos cosas que poner adentro.

*Seguimiento* se llamaba *En la tienda* y tenía adentro a *Sucursales*. Estaba
mezclado: la puerta de entrada a una tienda no es una tarea al lado de
*Reclamos* y *Movimientos y bajas*, que son registros del área que se siguen en el
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

**Un indicador sin número no ocupa un lugar de indicador.** Es la misma regla
que la de los contadores, una pantalla más adentro. El Panel abría con diez
tarjetas de las que seis decían «—» —FTE y costo del mes cerrado, ausentismo,
horas extras, costo sobre venta, venta neta— y entre las seis tapaban las cuatro
que sí tenían un número; la ficha de una tienda, ocho de las que seis. Ninguno
está roto: salen de la estadística del mes, que se carga cuando el mes cierra.
`ordenarKpis()` (`app.js`) corre después de pintar, los saca de la tira y los
nombra abajo en una línea —«Todavía sin número: …»—, que es lo único que hacía
falta saber de ellos. **Un cero no es un vacío y se queda donde está**: «0
reclamos abiertos» es una respuesta. Si están todos vacíos la tira queda entera,
porque ahí el mensaje es justamente que todavía no hay nada. Como corre sobre el
DOM vale para las dieciocho tiras y para las que se escriban después: **no hay
que acordarse de nada al agregar un KPI nuevo**, alcanza con que el valor sea
`'—'` cuando no hay dato. Por eso la tira es `flex` y no grilla: con columnas
iguales, los dos que quedaban se estiraban a media pantalla cada uno.

**El código de la tienda entre paréntesis solo cuando dice algo.**
`Store.etiquetaSucursal()` escribía «Botánico (BOTANICO)» —el mismo nombre dos
veces— en cada fila de cada lista. Ahora compara el nombre con el código sin
acentos ni mayúsculas y lo agrega solo cuando difieren: queda «San Martín Center
(SM CENTER)», que sí avisa cómo se la llama en el RVD y en la nómina.

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

La baja, el traspaso de sucursal y la modificación de puesto cuelgan de la
**persona** (`c.baja`, `c.movimientos[]`), no de la sucursal, así el historial la
acompaña cuando se muda de tienda. Se cargan en su ficha y se leen juntas en
`#/movimientos` (*Movimientos y bajas*). Lo autorizado con vigencia futura **no
se aplica antes de tiempo**: `aplicarMovimientosVencidos()` corre al abrir el
panel. Documentado en `docs/cesiones-y-bajas.md`.

**Mover a alguien de tienda es un traspaso, y la cesión de contrato es una
pregunta adentro.** Se llamaba *cesión* al movimiento entero, que es el
instrumento legal y no lo que pasa; la cesión aplica solo cuando además cambia el
empleador, y en el Área 3 conviven doce razones sociales. El formulario
**no guarda hasta que la pregunta está contestada** (`m.conCesion`): descubrir
después que hacía falta instrumento es tarde. Al elegir el destino el panel
**sugiere y precarga** comparando la `razonSocial` de las dos tiendas, y lo dice
cuando a alguna le falta en vez de inventar una respuesta — sugiere, no decide.
Lo guardado como `tipo: 'cesion'` sigue funcionando: `esTraspaso()` lo trata como
traspaso y se lee *con cesión*, que es lo que era. **No agregar un tipo de
movimiento nuevo para la cesión**: es un atributo del traspaso.

**El empleador es de la tienda y viaja con la persona.** El traspaso movía a la
gente de una lista de colaboradores a la otra y nada más, así que
`c.razonSocialContrato` se quedaba con el de la tienda vieja: se pasaba a
alguien a Botánico y su contrato seguía figurando en Iron Lynx.
`aplicarMovimiento()` lo actualiza al aplicar el traspaso y anota de dónde
venía (`m.razonSocialAnterior`).

**Ese campo no guarda la razón social formal.** La columna de la nómina trae un
nombre corto y propio de cada tienda —«FTD ARG BOTANICO», «OLIVOS», «SM
CENTER», «BARCELONA»— y **todos los de una misma tienda comparten el mismo**.
Escribir «FARMATODO ARGENTINA S.A.», que es lo que dice la ficha de la tienda,
dejaría a esa persona distinta de sus trece compañeros hasta la nómina
siguiente. Por eso `Store.razonSocialDeTienda()` lo saca **del padrón**: es el
valor que Nómina le va a poner el mes que viene. La `razonSocial` de la ficha
de la tienda queda de respaldo, para cuando todavía no tiene gente cargada.

**No depende de la cesión.** La cesión dice si hace falta instrumento legal;
esto es cómo se llama el empleador en la nómina, y cambia con la tienda. Entre
dos tiendas que liquidan igual no cambia nada y no se anota nada.

**A quien ya se traspasó antes, la ficha se lo dice.** Si su
`razonSocialContrato` no coincide con el de su tienda, aparece un aviso con un
botón para alinearlo. Se nombra y se ofrece corregir en vez de pisarlo solo: es
un dato de la nómina y lo cambia el coordinador.

**Los documentos del legajo se registran, no se suben.** `c.documentos[]`, en
la ficha de la persona, documentado en `docs/documentos-legajo.md`: tipo, cuándo
se recibió, hasta cuándo vale, dónde está el original y un enlace opcional. Lo
que se pidió fue poder subir archivos, y se midió el terreno antes de contestar:
`localStorage` desde `file://` aguanta **4.864 KB** y el padrón cifrado ya usa
456, así que entrarían diez u once PDF escaneados y después `guardar()` **borra
las copias automáticas para hacer lugar** y deja de guardar —el modo de falla del
bug de `b64()`, donde parece que el panel se borra solo—. `IndexedDB` sí anda
desde `file://` y tiene cerca de un giga, pero queda afuera del cifrado, del
respaldo `.json` y de las copias: los archivos serían lo único del panel sin
resguardo. **No reponer la idea de guardar el archivo adentro.**

**Lo que el panel agrega es el vencimiento**, que es lo que no estaba en ningún
lado: una constancia de alumno regular no es un papel que se guarda sino uno que
se renueva por cuatrimestre. `TIPOS_DOCUMENTO` (`catalogos.js`) trae `vence`,
como `CARGOS_NOMINA` trae la jornada, y `estadoDeDocumento()` (`nomina.js`)
decide. **Solo lo que vence avisa**: un contrato firmado es un registro y no pide
nada, que es la regla de los contadores en cero. El aviso sale con 30 días
(`DIAS_AVISO_DOCUMENTO`) porque renovar una constancia es ir a la facultad.
`documentosQueVencen()` alimenta `pendientesDelArea()` —**lee, no copia**— y solo
mira el plantel activo: perseguirle el papel a quien ya se fue es ruido, y el
historial queda en su ficha igual.

**`enlaceSeguro()` (`nomina.js`) es el único lugar del panel donde algo escrito a
mano se vuelve un `href`.** Acepta solo `http` y `https`; `javascript:`, `data:`
y `file:` se muestran como texto. Un `javascript:` ahí es código corriendo
adentro de la página que tiene el padrón entero.

**El certificado médico del día no es un documento del legajo**: es una ausencia,
vive en `c.ausencias` y tiene su propio circuito. De los exámenes médicos se
registra que están hechos y hasta cuándo valen, nunca su contenido — por lo mismo
que los casos no guardan documentación.

**Una baja es un proceso, no un evento.** La persona deja de venir el día de la
baja —eso sale de la dotación en el momento y no espera a nadie— pero atrás
quedan cinco trámites, en cinco lugares distintos: `TRAMITES_BAJA`
(`catalogos.js`) son carta al estudio, notificación al empleado, novedades y
baja a Nómina, baja en PAC y baja en Sommer. Viven en `c.baja.tramites`, cada
uno con su fecha y una nota —con quién se hizo, el número de trámite—, porque
sin eso el tilde no dice nada dos semanas después. El que se olvida aparece
solo: alguien que conserva accesos, un recibo liquidado de más.

`c.baja.cerradaEl` cierra el proceso y **es una decisión, no la consecuencia de
tildar los cinco**: a veces un trámite no aplica. `estadoTramitesBaja()` separa
`completa` —están los cinco— de `cerrada`, y la pantalla **nombra lo que falta
antes de dejar cerrar en vez de impedirlo**; bloquearlo llevaría a tildar
cualquier cosa para poder seguir, que es peor que un check list incompleto pero
sincero. Destildar un trámite **no borra su nota**. Una baja con el proceso
abierto suma al contador de *Movimientos y bajas*, junto con los traspasos sin
aplicar: las dos son trabajo pendiente en esa pantalla.

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

**Volver a cargar la ausencia de alguien corrige la que estaba, no agrega otra.**
`agregarAusencia()` no miraba nada: cargar dos veces la misma —porque se
estiró, porque no te acordabas si ya la habías puesto— creaba una segunda, la
persona aparecía dos veces en Presentismo y **sus días se contaban dos veces en
el ausentismo**. El importador del parte ya resolvía esto desde el principio;
la regla salió a `ausenciaQueSeSolapa()` (`ausencias.js`) y ahora la usan los
dos, como `buscadorDePadron()`.

Lo devuelve afuera de la licencia —`{ ausencia, accion, hastaAnterior }`— y la
pantalla **dice cuál de las tres cosas hizo**: la creó, le corrigió el alta o
ya estaba. Crear en silencio una y corregir en silencio otra se leen igual, y
una de las dos sería mentira. El `accion` no se guarda adentro de la licencia:
es lo que pasó en esa llamada, no un campo suyo.

**La comparación tiene que ver también las cerradas.** Pedía que la licencia
estuviera abierta, y lo que entra por el formulario de recepción entra cerrado
si ya terminó: la de un día que el formulario supuso era invisible, así que el
parte de la tienda —que trae las fechas de verdad— creaba una segunda y la
ficha mostraba la misma licencia dos veces, «17/07 → 17/07, se reincorporó» y
«17/07 → 29/09, 75 días». La que se estira **se reabre** y queda anotada la
reincorporación que decía antes (`reincorporacionAnterior`): si no, la ficha
diría que volvió el 18/07 arriba de una licencia que termina el 29/09. Volver y
enfermarse de nuevo más tarde sí son dos licencias, porque las fechas no se
tocan.

**Cargarla sin fecha de alta también la reabre** —no tener alta es no haber
vuelto— pero ahí el `hasta` que estaba **no se borra**: se conserva y la
licencia queda en rojo pidiendo la vuelta, porque tirar una fecha medida para
poner un vacío es peor que preguntar. Y cada cosa que se corrige se nombra en
el aviso, **la reincorporación sobre todo**: es una marca que puso el
coordinador y que el panel acaba de deshacer.

**Una licencia vencida no es una a la que le falta el papel.** Eso es
`pendienteJustificar`, que se decide antes. En `vencida` el certificado está
presentado y lo que pasó es que su fecha de alta quedó atrás sin que nadie
marque la vuelta, así que decir «el certificado venció hace 2 días» al lado del
chip verde de *presentado* se lee como una contradicción. Dice «Debería haber
vuelto el 29/09/2026 · 2 días sin marcar la vuelta», que es además lo que hay
que hacer.

**Quitar una ausencia se hace desde la fila donde se la ve.** El botón vivía
solo adentro del formulario de alta, así que para borrar una había que apretar
«+ Registrar ausencia», bajar hasta *Ausencias anteriores* y encontrarla entre
varias iguales. Se ve el problema en la tabla: se arregla en la tabla.

La ausencia se anota eligiendo a la persona: el panel completa su sucursal, su
antigüedad y los plazos de los arts. 208 y 211. **Sin la marca de certificado
presentado queda `pendienteJustificar`**, cualquiera sea la licencia, y encabeza
`alertasDeAusencias()`: es el único estado que dice qué hacer hoy —reclamar el
papel—. `tieneCertificado()` está en `ausencias.js`, junto a `tieneCargasFamilia()`,
y por el mismo motivo: el campo llega como texto y un `!!` a secas daría verdadero
para `'no'`.

**Las ausencias entran pegando la planilla del formulario de recepción**, al pie
de `#/diario`, y lo que se pega es la planilla **entera**: son las respuestas de
toda la empresa —734 filas de 28 tiendas—, de las que 193 son del Área 3.
Empareja por **número** y solo después por nombre. No duplica: la misma persona,
el mismo día y el mismo motivo entra una vez, así que se puede volver a pegar
todos los meses.

El número es `documentoDelFormulario()`, que devuelve CUIL **y** DNI: el
formulario pide el CUIL y una cuarta parte de las respuestas trae el DNI —47 de
las 193—, que identifica igual de bien y que el padrón tiene. Leerlo en vez de
descartarlo ubica 22 ausencias más. Las dos lecturas se prueban con y sin el
último dígito, porque Excel guarda el número como tal y al exportarlo le deja un
`.0` que queda como un cero de más —y un DNI terminado en 0 es posible—.

**Fuera de las tiendas del área, el nombre no alcanza.** Con la planilla entera
adentro, dos palabras iguales dejan de ser una identidad: «Martinez Maria
Eugenia» de Walker no es «PEREZ, MARIA EUGENIA» de Scalabrini. Una fila cuya
tienda no es del área **entra solo si el número coincide**, que es lo que
conserva a quien se mudó al área —Airoldi, Briceño, Díaz y Miglio traen su CUIL
de la tienda anterior— y descarta al homónimo.

**El número manda sobre el nombre, y cuando los dos se contradicen sin ninguna
duda la fila no entra.** El nombre se escribe a mano, así que «diaz cyntia» no
tiene por qué encontrar a «DIAZ, CYNTHIA» y un nombre ambiguo simplemente pierde
contra el número. Pero si el número apunta a una persona y el nombre apunta,
unívocamente, a otra —«Luis Toro» con el número de Juan Gabriel Luna— es un error
de carga del formulario: se deja afuera y se nombra en `enConflicto`, porque
adivinar cuál de los dos vale le cuelga el certificado a alguien que no faltó.

**El resultado separa lo que es ruido de lo que es trabajo.** Las 521 filas de
otras áreas se cuentan aparte (`otrasAreas`) y el aviso lo dice sin alarmar; las
que **sí son de sus tiendas y no caen en nadie** (`sinPersona`) van con nombre y
son la lista que importa —casi siempre gente que ya se fue, porque la planilla
arranca en marzo de 2025 y el padrón es el de hoy—. Antes las dos iban juntas en
un solo número de 615 y el útil quedaba tapado por el que no pedía nada.

**El parte de ausentes de las tiendas es la otra entrada, y contesta otra
pregunta.** El formulario de recepción es el registro de lo que fue pasando y
**no dice hasta cuándo**; el parte que mandan los gerentes dice *quién no está
hoy en mi tienda y hasta cuándo*. Como trae la fecha de fin escrita, **lo que
entra por ahí no lleva ningún supuesto**: `diasSupuestos` queda en falso y esos
días están medidos. Son dos entradas a propósito y no dos formas de lo mismo
—una es el pasado y la otra el presente—, y las dos viven al pie de `#/diario`
diciendo cuál sirve para qué.

`importarParteDeAusentes()` (`store.js`) lee las columnas de
`COLUMNAS_PARTE_AUSENTES`: tienda, nombre, CUIL o DNI, tipo de licencia, desde,
hasta, certificado y observaciones. **En `MOTIVOS_DEL_PARTE` el ART va antes que
enfermedad** y no es casual: el accidente de trabajo lo cubre la aseguradora y
**no corre por los plazos del art. 208**, así que meterlo en enfermedad
inculpable le mostraría al coordinador un vencimiento de licencia paga que no
existe. Lo que no se reconoce entra como *Otra* en vez de perderse: que la
persona no está es el dato.

**Sin fecha de fin la licencia entra igual, abierta** —una ART recién abierta no
tiene alta—: queda como `sinAlta` y el Panel la pone arriba de todo pidiendo el
dato, que es lo que hay que reclamarle al gerente. Sin fecha de **inicio** no
entra: no se la puede ubicar en el tiempo.

**Vuelve a mandarse todos los meses y por eso corrige en vez de duplicar**: si la
persona ya tiene una licencia abierta del mismo motivo que se solapa con la que
viene, se le corrige el `hasta`. Cargarla dos veces contaría los días dos veces.

**El parte se llena con un formulario de Google y por eso el texto de cada
pregunta es código.** Documentado en `docs/formulario-presentismo.md`. Es la
misma entrada —la planilla de respuestas se pega al pie de `#/diario` y la lee
`importarParteDeAusentes()`, sin una línea nueva—; lo que cambia es que deja de
depender de que un gerente se acuerde de armar la planilla. **No es un tercer
camino para las ausencias**, y no hay que convertirlo en uno.

Como `COLUMNAS_PARTE_AUSENTES` ubica cada columna por lo que dice su encabezado
y gana la primera que coincide, **tres preguntas no se pueden renombrar a gusto**:
la del gerente que avisa no puede decir «nombre» —se llevaría el nombre del
gerente al lugar del colaborador y cada respuesta caería en nadie—, la del
«hasta» no puede decir «licencia» —sería leída como el motivo— y las
observaciones tienen que decir «Observaciones». `e2e-formulario-presentismo.js`
corre los encabezados del doc contra la tabla del panel: si alguien renombra una
pregunta, esa prueba avisa. Lo mismo con las opciones del desplegable, que son
las palabras que `motivoDelParte()` reconoce.

**Son dos formularios y no uno con dos ramas.** El de reclamos y el de
presentismo contestan dos preguntas de dos escalas distintas, la planilla de un
formulario con ramas saldría con la mitad de las celdas vacías —y al pegarla en
`#/diario` las filas de reclamos se cuentan como error todos los días—, y las
secciones con derivación son justamente el paso donde el coordinador se pierde.

**Qué suma al ausentismo se decide en un solo lugar, y antes no.**
`motivoSumaAusentismo()` (`ausencias.js`) saca vacaciones, maternidad y
paternidad; la marca `cuentaAusentismo` —que ponen el libro con
`cuentaComoAusentismo()` y el formulario con `TIPOS_FORMULARIO`— saca el
fallecimiento, el matrimonio y el nacimiento, que entran como «otra» y no se
distinguen por el motivo. `diasDeAusenciaEntre()` pregunta las dos cosas. El
parte y el alta a mano hacían su propia cuenta —`motivo !== 'vacaciones'`— así
que **la misma maternidad sumaba o no sumaba al ausentismo según por dónde se
hubiera cargado**: la misma clase de contradicción que las tres cuentas que
daban 23, 1 y 3 días del mismo mes.

**El emparejamiento con el padrón es uno solo.** `buscadorDePadron()` (`store.js`)
lo usan los dos importadores: número primero —CUIL o DNI—, después nombre y solo
sin ambigüedad, nada de nombre para una tienda de otra área, y la fila no entra
cuando el número y el nombre apuntan cada uno sin dudas a personas distintas.
Tenerlo dos veces garantizaba que un día difieran.

**La planilla no fue pensada para medir**, y de ahí sale el único supuesto del
panel. El certificado se carga en un campo de texto libre: de los 148
certificados del Área 3, **82 traen solo la patología** y ninguna duración; de
los que la traen, la mayoría la escribe en horas —«(24) HORAS»— y no en días,
que `leerCertificado()` convierte. **El que no dice cuánto dura se toma como un
día** (`DIAS_SIN_DURACION`, `ausencias.js`), que es lo que decidió el
coordinador y lo que dicen sus propios datos: de los 66 certificados con
duración, 30 duran un día y 54 duran uno o dos. Es un supuesto, no una lectura
del papel, así que **queda marcado en la ausencia para siempre**
(`diasSupuestos: true`) y **el número nunca se muestra solo**:
`participacionDeAusencias()` devuelve `diasSupuestos` y `parteSupuesta` junto al
total, y la pantalla dice qué parte de los días se midió y qué parte se supuso
—«33% de esos días son supuestos: 13 de los 22 certificados no decían cuánto
duraban»—. Un porcentaje con su procedencia al lado se puede llevar a una
reunión con Operaciones; el mismo número sin ella, no. Documentado en
`docs/ausencias.md`.

**Las vacaciones se importan pero no son ausentismo** —son tiempo planificado y
meterlas infla el número con algo que no es un problema—, y tampoco la maternidad
ni el fallecimiento: `TIPOS_FORMULARIO` lo marca con `ausentismo: false` y
`participacionDeAusencias()` los saltea. Los apercibimientos no son una ausencia.

**El panel mide por período de liquidación y no por mes calendario.** El de
septiembre de 2026 fue **del 21/08 al 17/09**: arranca el día 21 del mes
anterior y cierra el 17 de este. Los dos días viven en `parametros`
(`periodoDesdeDia`, `periodoHastaDia`), editables en `#/config`, y de ahí salen
**las dos únicas funciones que traducen entre un período y sus fechas**, en
`convenio.js`: `rangoDePeriodo('2026-09')` devuelve `{21/08, 17/09}` y
`periodoDeFecha('2026-08-25')` devuelve `'2026-09'`. Escribir la conversión a
mano en cada pantalla garantiza que un día difieran, que es exactamente lo que
ya pasó con las tres cuentas de ausentismo. Documentado en
`docs/periodo-de-liquidacion.md`.

Medir por calendario metía los días en la ventana equivocada, y con los datos
reales no era poco: septiembre calendario daba **166 días** de ausentismo contra
**120** del período. **52 caían después del corte** —todos del libro, que
ubicaba sus licencias desde el día 1 y las estiraba— y **6 que la liquidación
sí pagó** se contaban en agosto.

**Con el día de arranque menor o igual al de cierre el período vive adentro del
mismo mes**, así que poner 1 y 31 devuelve los meses calendario sin tocar nada
más. No es una excepción: es el caso general escrito una vez.

**Los días que quedan sueltos no se pierden.** Del 21 al 17 el 18, el 19 y el 20
quedan fuera del período declarado. `periodoDeFecha()` reparte por el **día de
cierre** y no por el de arranque —lo que pasa después del corte lo paga el
recibo que viene—, así que cada día del año cae en un período y en uno solo, y
está probado sobre los 365. `#/config` los nombra y dice adónde van, sin impedir
nada: cuál es el corte lo decide Nómina.

**Lo que ya cargó el libro se reubica al volver a pegarlo**, conservando cuántos
días dura y anotando de dónde venía (`reubicadaEn`). Se mueven **solo las
suyas**: `fechasSupuestas` marca las fechas que inventó el propio importador, y
una licencia con fechas de verdad no se toca jamás.

**`diaCierreNovedades` dejó de ser un campo propio**: decía el mismo número que
cierra el período, y dos campos para un número terminan diciendo cosas
distintas. `Store.diaCierreNovedades()` lo deriva de `periodoHastaDia`, y
`periodoDeLiquidacion()` (`agenda.js`), que hacía la misma cuenta escrita dos
veces, ahora llama a `periodoDeFecha()`.

**El numerador y el denominador tienen que repartir con la misma regla.**
`rangoDePeriodo()` devuelve el período **declarado** —del 21 al 17— y
`ventanaDePeriodo()` **los días que caen** en él, que con un corte que no encaja
incluye los sueltos del período anterior. Son dos funciones y no una porque son
dos preguntas, y cuando los dos números encajan devuelven lo mismo. La serie
mensual dividía por el rango declarado mientras `periodoDeFecha()` repartía por
el día de cierre: los tres días sueltos sumaban arriba de la fracción y no
abajo, y la serie daba una tasa **más alta que el Panel sobre exactamente los
mismos días**. Es la misma clase de contradicción que las tres cuentas de
ausentismo, y se busca igual: correr las tres y compararlas.

**La ventana de medición no arranca en la mitad de un período.**
`ventanaDeMedicion()` corre el arranque al principio del período que contiene el
corte. Con `mideDesde` en el 01/09 y períodos que arrancan el 21/08, el
ausentismo de septiembre caía de 158 días a **74** sin que nada lo dijera. Se
ajusta **en el cálculo y no en el valor guardado**: el corte sigue siendo la
fecha que el coordinador escribió.

**Lo que la liquidación paga de más se recorta y se avisa.** Un período de 28
días no contiene los 30 que el libro le paga a una persona. El importador lo
recorta al cierre —inventar días afuera sería peor— y nombra a cada uno: «pagó
30 y entran 28». Recortar en silencio esconde justamente el dato que dice que el
corte describe un período más corto que el que liquida Nómina.

**Trampa conocida — dos `function` con el mismo nombre no rompen nada: gana la
última.** La regla de los nombres repetidos entre módulos tiene esta segunda
mitad, que es peor que la primera. Un segundo `const` tira «already been
declared» y el chequeo del archivo armado lo agarra; un segundo `function` se
ejecuta igual y **la que carga después pisa a la anterior en silencio**. Pasó
con `nombreDePeriodo()`, escrita en `convenio.js` cuando ya existía en
`agenda.js`: no falló ningún chequeo y se notó porque la pantalla escribía
«septiembre de 2026» y la nueva decía «septiembre 2026». Antes de escribir una
función de ayuda hay que buscar el nombre en `assets/js/`.

**Los días de ausencia de un período los cuenta `diasDeAusenciaEntre()`
(`ausencias.js`) y nadie más.** Toma la licencia y la ventana y devuelve
**los días que caen adentro**: la que empezó en agosto y sigue hoy aporta sus
días de septiembre, y ni se pierde por haber empezado antes del corte ni se
cuenta entera. Las exclusiones —vacaciones, maternidad, fallecimiento,
`cuentaAusentismo: false`— también viven ahí, porque una regla repetida en tres
lugares es una regla que un día se olvida en uno.

Eso fue exactamente lo que pasó: `serieMensualDeAusentismo()`,
`participacionDeAusencias()` y `ausentismoDelArea()` contaban cada una a su
manera y daban **23, 1 y 3 días** del mismo mes, con la misma ventana y el mismo
padrón. La serie repartía por día —bien—; las otras dos exigían que la licencia
*empezara* adentro de la ventana y después la contaban completa, y la del Panel
además sumaba las vacaciones y la maternidad. Tres tarjetas del mismo tablero
diciendo 0,58%, 0,03% y 0,08%. **Una cuenta nueva de días de ausencia no se
escribe: se llama a `diasDeAusenciaEntre()`.**

**Una baja no es una ausencia, y `sigueEnElPlantel()` (`ausencias.js`) es
quien lo decide.** Dar de baja a alguien no lo sacaba de ningún lado: seguía en
*Quién no está hoy* con su licencia abierta, en las alertas pidiendo un
certificado que ya no le iba a traer nadie, y descontando turno del piso. Quien
se fue el martes no «no vino» el miércoles. La regla vale para **todo lo que
describe hoy** —`ausenciasEnCurso()`, `ausentesHoy()`, `alertasDeAusencias()`,
`presentesDelPadron()`, `documentosQueVencen()` y `_activos()` de
`indicadores.js`— y mira **las dos marcas**, `activo` y `baja`: `registrarBaja()`
pone las dos, pero una nómina importada puede traer a alguien inactivo sin baja
cargada.

**Recorta lo de hoy, no el historial**, que es la misma regla que el corte del
año fiscal: sus licencias siguen enteras en su ficha, con sus fechas.

**Y de paso cerró una grieta entre el numerador y el denominador.** Las tres
cuentas de ausentismo dividían por el plantel activo y sumaban los días de
**todo el mundo**, de baja incluida: una baja le dejaba los días arriba de la
fracción y le sacaba la persona de abajo, así que **la tasa subía sola el día
que alguien se iba**. Es la misma clase de contradicción que el rango declarado
contra la ventana que cae, y se arregla igual: las dos puntas reparten con la
misma regla. Por eso los cinco filtros sueltos de `indicadores.js` ahora pasan
todos por `_activos()`, que llama a `sigueEnElPlantel()`.

**Lo que sí se queda cuando la persona se va son los reclamos y los casos**, y
es a propósito: un reclamo de sueldo de alguien que se fue es plata que se le
debe igual, y un caso con el estudio jurídico de alguien que se fue es
exactamente el que no se puede perder de vista. Esconderlos sería tirar trabajo
abierto; lo que corresponde es que la pantalla diga que la persona ya no está,
no que la fila desaparezca.

**La vuelta de una licencia se marca donde se la ve.** Es la misma regla del
«Quitar», y faltaba la mitad: el único botón vivía en la tabla de Presentismo,
que muestra las **abiertas y ya empezadas**. Una licencia cargada con fecha de
inicio futura —o la de alguien que esa lista dejó de mostrar— se veía abierta en
la ficha de la persona y no había forma de cerrarla desde ningún lado. Ahora la
fila de la ficha trae *Se reincorporó*, *Reabrir* —`Store.reabrirAusencia()`,
que deshace la marca sin tocar las fechas y anota cuál decía— y el ✕.

**Y la acción dejó de mentir**: decía «Marcada como reincorporada» pasara lo que
pasara, también cuando `Store.reincorporar()` devolvía `null` porque no
encontraba la licencia. Desde el otro lado eso se lee como que el panel no
responde. Ahora dice el día en que volvió, o que no la encontró y dónde mirar.

**El ausentismo se ve en los tres lugares donde se lo busca**, y los tres salen
del **mismo** cálculo: `ausentismoDe()` (`indicadores.js`) es un buscador sobre
`participacionDeAusencias()`, no una cuenta nueva. Dos funciones que cuentan lo
mismo dan números distintos el día que una cambia, y acá los tres niveles se
leen uno al lado del otro. Están en *Panel → Indicadores* (el área, con el
desglose), en `#/sucursal/<id>` (la tienda contra el área, abajo de su tira de
KPIs) y en la ficha de cada persona (sus días, su tasa, qué parte de los de su tienda
es, y la tasa de su tienda y la del área para poder leerla contra algo).

**En la tienda el ausentismo son dos números con dos nombres, y el que manda es
el que se mueve.** `#/sucursal/<id>` abre con *Ausentismo del mes*, que sale de
las licencias que el coordinador va cargando y por eso cambia en el momento en
que carga una; el de la estadística del cierre quedó al lado y se llama
*Ausentismo liquidado*. Antes había uno solo, el de la liquidación, que decía «—»
hasta que el mes cerraba: cargar una licencia no movía nada y la pantalla parecía
no estar mirando. Dos fuentes con el mismo rótulo es la forma más rápida de que
alguien lleve el número de una a una reunión creyendo que es el de la otra.

**El Panel abre con «Quién no está hoy»** (`bloqueQuienNoEsta()`, sobre
`ausenciasEnCurso()`). Ese lugar lo ocupaba un aviso de *Certificados que
vencen* que listaba solo lo urgente, pero la pregunta de la mañana no es «qué
vence» sino «quién me falta y desde cuándo»: lo urgente es una columna de esa
lista, no una lista aparte. Va sobre toda ausencia empezada y sin cerrar, y no
sobre `ausentesHoy()`, porque **el que ya debería haber vuelto y nadie marcó
tampoco está en la tienda**. Con el historial cargado y nadie ausente el bloque
dice «hoy no falta nadie» en vez de desaparecer —un cero es una respuesta, y
esconderlo se lee como que la pantalla se rompió—; sin ninguna ausencia cargada
sí desaparece, como los contadores.

**Lo que se importa entra cerrado si ya terminó.** La planilla arranca en marzo
de 2025: es un registro de lo que pasó, no una carga en vivo. Sin eso las 125
licencias entraban abiertas y el Panel anunciaba 125 ausentes, cada una «vencida
hace 400 días». No se inventa la fecha de reincorporación, así que
`diasDeAusencia()` se sigue quedando con `hasta` y el ausentismo no cambia.

**`participacionDeAusencias()` (`indicadores.js`) contesta de dónde sale**, en
tres niveles: el área, cada tienda sobre el total del área y cada persona sobre
su tienda. Los tres se cuentan **en días** y los tres traen su **tasa** —días de
ausencia sobre plantel por días de la ventana—, la de cada tienda **sobre su
propio plantel** y no sobre el del área: si no, una tienda de seis personas y
una de veinte se leerían con la misma vara. Ordenar por eventos y repartir por
días, o al revés, daba dos respuestas distintas a la misma pregunta una al lado
de la otra. Se ve en *Panel → Indicadores*; el historial de cada persona ya
estaba en su ficha (`fichaAusenciasRegistradas`).

**Los indicadores del área miden desde el corte del año fiscal**
(`parametros.mideDesde`, septiembre de 2026, editable en `#/config`).
`ventanaDeMedicion()` (`indicadores.js`) es el único lugar que lo decide: la
ventana natural de cada indicador —doce meses para la rotación y el ausentismo,
tres para la participación— **no puede arrancar antes del corte**. El
coordinador venía midiendo a mano y atrás no hay serie completa: las ausencias
entraron por una planilla que arranca en marzo de 2025 y las bajas se cargaron
de a poco. Una tasa sobre una serie incompleta no es una tasa baja, es una que
no se puede comparar contra el año siguiente.

**Recorta los indicadores, no el historial.** La ficha de cada persona muestra
todas sus licencias, sean de cuando sean, y lo dice: que alguien tuvo una
licencia en mayo es un dato útil de su legajo aunque no entre en la tasa del
área.

**El rótulo nombra el período de verdad.** Con el corte recién puesto la ventana
puede ser de veinticinco días, así que la tarjeta dice «Rotación desde el
01/09/2026» y no «de los últimos 12 meses», y el ausentismo divide por los días
que la ventana tiene y no por 365 — si no, un número de un mes leído como anual
se lleva a una reunión como si fuera comparable. Lo mismo la participación, que
dice «desde el … (25 días)» en vez de «en 3 meses».

**No se corre solo.** Moverlo al próximo septiembre es una decisión del
coordinador; un corte automático le cambiaría los números sin avisar.

**El año se arma a la vista, mes a mes** (`serieMensualDeAusentismo()`, bloque
*Cómo se va llenando el año*). Con una sola tasa acumulada no se ve que el
indicador **se va llenando**: se carga una licencia, el número se mueve dos
centésimas y parece que no pasó nada. Una fila por mes desde el corte —incluidos
los que están en cero, porque un mes sin licencias es una respuesta— y el mes en
curso marcado, para que nadie lo compare contra uno cerrado.

Es **tabla con una barra y no un gráfico**, como el resto del panel: la barra
sola perdería los días y cuántos de ellos son supuestos, que es justamente lo que
hace que el número se pueda defender. Los días se reparten por período de
liquidación, igual que `ausenciasPorMes()` en la ficha, y **cada fila escribe su
rango abajo del nombre** —«septiembre de 2026 · del 21/08 al 17/09»—: sin eso
«septiembre» se lee como el mes del almanaque, que es lo que dejó de ser.

**El mismo bloque, acotado a una tienda, va en la página de la tienda.**
`serieMensualDeAusentismo()` toma un tercer argumento opcional con el id de la
sucursal y `bloqueSerieAusentismo(e, sucursalId)` lo dibuja en los dos lugares:
el del área en *Panel → Indicadores* y el de la tienda abajo de su tira de KPIs.
Es un filtro sobre la misma cuenta y no una función nueva —la tasa de la tienda
se divide por **su** plantel, no por el del área— porque dos cuentas del mismo
número terminan difiriendo el día que se toca una. El bloque de la tienda es
además donde se lee de dónde salió el *Ausentismo del mes* de arriba: el mes en
curso está marcado, con sus días y cuántos de ellos son supuestos.

**El plantel es el de hoy en todos los meses**, y la pantalla lo dice: el panel
guarda la foto actual y no la de cada cierre, así que la tasa de un mes viejo se
calcula contra la dotación de hoy. Es la misma aproximación anunciada que la
dotación media de la rotación.

**El historial va en la ficha de la persona**, no en la de la sucursal: vive en
`c.ausencias`, así que la acompaña cuando se muda de tienda. `ausenciasPorMes()`
lo reparte por **período de liquidación** con `periodoDeFecha()` —una licencia
que cruza el corte aporta a los dos— y no cuenta lo que todavía no pasó ni el
día de la reincorporación. Los días se cuentan con los dos extremos, y
`diasDeAusencia()` y el texto de `estadoDeAusencia()` usan la misma cuenta: dos
números distintos para lo mismo, uno al lado del otro, es peor que no mostrarlos.
No confundir ese bloque con *Ausencias mes a mes*, que sale de `c.novedades` (lo
liquidado). `#/diario/<colaboradorId>` abre el alta con esa persona ya elegida.

**Lo que quedó a medias en cualquier pantalla aparece en la agenda.** Un proceso
de baja sigue quince días después de que la persona dejó de venir, en cinco
lugares distintos; una ausencia sin certificado no se resuelve sola; un traspaso
espera el visto bueno. Cada cosa está bien guardada donde está, pero ninguna de
esas pantallas es la que se abre a la mañana: esa es la agenda. El bloque *Lo que
quedó pendiente*, arriba de los cajones por fecha, lo junta con
`pendientesDelArea()` (`agenda.js`): trámites de baja, ausencias que piden algo,
reclamos abiertos, movimientos sin autorizar, desarrollo y compromisos de la
última visita. Documentado en `docs/agenda.md`.

**Lee, no copia.** Nada de eso se convierte en un ítem de `e.agenda`: cada línea
es un enlace a donde la cosa se resuelve, no una casilla. Es la misma regla que
dejó los reclamos con una sola alta — dos casillas para lo mismo terminan
diciendo cosas distintas, y tildar una dejaría a la otra como un pendiente
fantasma. Una fuente nueva de pendientes se agrega adentro de
`pendientesDelArea()` y no escribiendo en la agenda. Cada línea dice hace cuánto
está abierta y a los 15 días (`DIAS_PARA_INSISTIR`) pasa a rojo: no es un plazo
legal, es cuando el coordinador ya no se acuerda solo. Sin pendientes el bloque
no aparece, por lo mismo que los contadores se esconden en cero.

**Las novedades que hay que pasarle a Nómina** viven como una marca sobre la
agenda (`item.liquidacion`, un período `'2026-09'`), en un bloque al tope de
`#/asistente`. Documentado en `docs/novedades-liquidacion.md`. Es la tercera cosa
distinta: `c.novedades` es lo que la liquidación **devolvió** ya cerrado, y esto
es lo de antes —lo que **hay que pasar**—. Se marcan solas al pegar un texto que
habla de horas extras, francos, adelantos o faltantes, y se marcan y **desmarcan**
a mano con la misma casilla: el detector se equivoca y un falso positivo que no
se puede sacar ensucia el parte del cierre.

El período **no es el mes en curso** sino el que sale de
`periodoDeLiquidacion(fecha, corte)`, que hoy llama a `periodoDeFecha()`: lo que
aparece después del día de cierre del período —`parametros.periodoHastaDia`, 17,
editable en `#/config`— va al recibo siguiente. Juntar en el parte algo que Nómina no va a tomar es peor que no
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
`ausencias.js`, `_sumarDias` en `agenda.js` y `_diasEntre` en `desarrollo.js`;
los demás los usan sin redeclarar, o eligen otro nombre (`_diaMas`). Le volvió a
pasar a `casos.js`, que se escribió con su propio `_diasEntre` y lo habría
dejado todo en blanco: el chequeo lo agarró antes de commitear. El chequeo que lo agarra está en la verificación
de más abajo y hay que correrlo siempre.

Las **ausencias con certificado** (`assets/js/ausencias.js`, `c.ausencias`) son
la tercera cosa distinta de `c.novedades` (el mes cerrado) y `c.licencias`
(art. 25 del CCT): la persona que hoy no está, desde cuándo y hasta cuándo. Los
plazos salen de la **LCT art. 208** —3/6 meses de licencia paga según
antigüedad, duplicados con cargas de familia— y **art. 211** —un año más de
reserva del puesto—. Es una orientación sobre la ley general, no un dictamen, y
así lo dice la pantalla. Documentado en `docs/ausencias.md`.

**El curso de ADEF y el art. 8 son el mismo problema desde dos lados**, y por
eso se miran en una sola pantalla: `#/nomina/adef` (*Curso de ADEF*), la segunda
solapa de `#/nomina`. El art. 8 del CCT da **tres vías** a la categoría de
Empleado especializado y alcanza con una: 5 años en el mismo establecimiento, 6
en varios con 3 en uno, o el título de Auxiliar de Farmacia. Las dos primeras
llegan solas con el calendario y no se negocian; la tercera es la única que se
puede empujar, y el curso que la da lo dicta ADEF. Mostrar el relevamiento sin
el reloj haría pensar que el curso es opcional para quien ya tiene cuatro años y
medio, cuando lo único que ahí cambia es quién decide la fecha.

`situacionArt8()` y `relevamientoAdef()` viven en `convenio.js`, que es donde
vive el CCT. **No alcanza con la antigüedad total**: el artículo pregunta cómo se
repartió, así que `tramosDeAntiguedad()` la parte por establecimiento usando los
traspasos ya aplicados —lo único que el panel sabe del recorrido de la persona—.
Quien nunca se movió tiene un solo tramo, que es el caso de casi todo el
plantel. El aviso sale con **doce meses** de anticipación (`MESES_AVISO_ART8`):
es lo que tarda el curso, y antes de eso no sirve para decidir nada.

**El artículo aplica solo al Empleado de farmacia** (art. 7), que es la categoría
desde la que se asciende; Perfumería está en otro artículo y el farmacéutico ya
está arriba. **El relevamiento, en cambio, es sobre todo el plantel activo**:
saber quién se está formando es otra pregunta y el coordinador la hace igual.

**«Sin relevar» no es un estado de la lista: es la ausencia del campo.** En un
relevamiento la primera pregunta no es quién cursa sino a quién todavía no le
preguntaste, y un «no sé» mezclado con los demás se tilda de apuro y borra esa
diferencia. Por eso `Store.marcarAdef()` con estado vacío **borra `c.adef`** en
vez de guardar una respuesta en blanco. Vive colgado de la persona, como
`c.baja`, `c.ausencias` y `c.entrenamientos`, y usa un binding propio
(`data-adef`) porque `data-colab-campo` escribe campos planos.

Es **una tabla y no fichas desplegables**: lo que se hace ahí es una pasada de
141 respuestas de un tirón, y cada apertura es una razón para dejarlo por la
mitad. Ordena por lo que apura y no alfabético —el alfabético sirve para buscar
a alguien, y para eso está la otra solapa—. **Son dos solapas y no dos entradas
del menú**, por lo mismo que el Panel: es la misma lista de personas mirada de
dos formas, y una tercera lista de las 141 sería una de más.

**Esto no va a la agenda**, y se probó ponerlo. Quien ya cumplió el artículo se
deduce del padrón solo, así que el pendiente aparecía **en el momento en que se
carga el plantel** y no se podía cerrar desde el panel: se cierra cuando la
liquidación cambia la categoría, que puede tardar meses. Un pendiente que no se
puede tildar es un número fijo arriba de la agenda, y a los dos días deja de
leerse — la misma razón por la que los contadores se esconden en cero, vista al
revés. La cuenta vive en su pantalla, que es donde se la va a buscar.

**El libro de novedades se pega entero, una vez por mes.**
`importarLibroDeNovedades()` (`store.js`) reparte cada fila por su columna
**TIENDA** y saltea las de otras áreas —de las 533 filas del libro, 139 son del
Área 3—. Antes había que separar la hoja de cada tienda y pegar catorce veces, y
lo peor no era el trabajo: el importador por hoja **crea** a quien no encuentra,
así que una pegada en la sucursal equivocada metía 141 personas donde no van y
no se notaba hasta el cierre. **El del libro no crea a nadie**: la fila que no
cae en el padrón se devuelve con nombre y tienda, que casi siempre es alguien
que ya se fue. Usa `buscadorDePadron()`, como los otros dos importadores.

**Los encabezados del libro cambiaron en 2026** y hubo que enseñárselos:
las licencias pasaron a llamarse `LIC. …` —con la errata `LIC. EFERMEDAD`
incluida, que está en la planilla—, el nombre viene en **una sola columna**
`COLABORADOR` en vez de apellido y nombre separados, y aparecieron cinco
conceptos nuevos: **ART, matrimonio, nacimiento, maternidad y reserva de
puesto**. Los rótulos viejos siguen en `COLUMNAS_NOVEDADES` porque los meses ya
cargados se leyeron con ellos.

**`MAPA_AUSENCIAS` es la única lista de conceptos** y ahora dice dos cosas más:
`cod` es el de TD01 y **queda vacío en los que TD01 no tiene** —esos se cuentan
igual y no se les inventa un código—, y `ausentismo: false` marca lo que no es
ausentismo aunque sea una ausencia. `cuentaComoAusentismo()` es quien decide, en
un solo lugar. **No partir el nombre completo por el primer espacio**: rompe los
apellidos compuestos, y en el área hay varios.

**El panel fabricaba duplicados y era `importarNovedades()`.** El importador de
**una hoja** buscaba a la persona solo dentro de esa tienda y, si no la
encontraba, la creaba: cualquiera con un traspaso sin aplicar —el libro la trae
en la tienda nueva, el padrón la tiene en la vieja— terminaba con dos fichas.
Después aparecía dos veces en Presentismo, contaba dos veces en la dotación y
cada ficha se quedaba con la mitad del historial. Ahora **busca en toda el área
antes de crear a nadie** y **no la muda**: dónde está cargada lo decide el
traspaso, no la planilla del mes. El importador del libro entero nunca creó a
nadie.

**Las que ya quedaron se limpian en `#/config`.** `Store.duplicados()` las
encuentra por CUIL, por DNI o por nombre, y dice **con qué se quedó cada
ficha** —licencias, meses de novedades, movimientos, si está evaluada—, que es
lo que decide cuál conservar. `unirColaboradores(queda, seVa)` junta todo en la
elegida: las listas se concatenan sin repetir —las ausencias por motivo y
fechas—, los meses de novedades que falten se traen y **en el choque gana la
ficha que se conserva**, los campos sueltos se completan solo donde están
vacíos. Resguarda antes, porque borra una ficha. El bloque no aparece cuando no
hay ninguno, como los contadores.

**El libro no solo guarda la novedad: registra la licencia.** Sin eso llenaba
`c.novedades` y el ausentismo por sucursal —que se calcula sobre
`c.ausencias`— se quedaba en cero aunque el mes tuviera 166 días de licencia:
el coordinador cargaba el cierre y no se movía nada, porque era la misma
pantalla mirando otra caja. `registrarLicenciasDelLibro()` (`store.js`) crea la
ausencia de cada concepto con `MOTIVO_DE_NOVEDAD`.

**El libro dice cuántos días, no cuáles.** La duración está medida —la
liquidación la pagó— pero las fechas no, así que la licencia se ubica al
principio del mes y queda marcada con **`fechasSupuestas`** para siempre, y la
ficha lo dice en la fila y al pie. Es el mismo trato que `diasSupuestos` le da
al certificado sin duración: lo que se supone se marca y no se muestra solo.

**Las fechas son las que ya estaban; los días, los que se pagaron.** Si la
persona ya tiene una licencia de ese motivo que toca el mes, su `desde` es el
bueno —el del libro sería inventado— pero **la cantidad de días la manda la
liquidación**, que es lo que efectivamente se pagó: se estira el `hasta` hasta
cubrirlos, dentro del mes. Se corrige **la que tenía la duración supuesta**,
que es el eslabón débil —un certificado sin duración tomado como un día—, y esa
deja de ser un supuesto. Queda anotado en cuál cierre se ajustó y cuál era el
`hasta` anterior. **Hacia abajo no se toca**: que la liquidación pagara menos
días que el certificado es un problema de la liquidación, y recortar la
licencia borraría la prueba — se informa y listo. Volver a pegar el mismo libro
no suma un día ni la estira de nuevo. Y **`cuentaAusentismo` sale de `cuentaComoAusentismo()`**, si no la
maternidad, el matrimonio, el nacimiento y el fallecimiento entrarían al
ausentismo por la puerta de atrás.

**La ficha de la persona tiene dos bloques de ausencias y no tres.** El tercero
—*Ausencias que liquidó Nómina, mes a mes*— **se eliminó, con su función**.
Existía cuando la liquidación era una fuente aparte que había que cotejar
contra lo registrado; desde que el libro registra las licencias decía
exactamente lo mismo que el bloque de arriba dos renglones más abajo, y con
otro formato. Lo único suyo que no estaba en ningún lado —las horas extras del
mes— vive ahora en *El cierre del mes*.

**Un bloque vacío tampoco ocupa un bloque.** Es la regla del indicador sin
número, una pantalla más adentro: con ninguna licencia del art. 25 usada, la
tabla de cinco filas de guiones se reemplaza por una línea y el botón de
registrar. La ficha abría con dos tablas llenas de «—» que había que leer para
descubrir que no decían nada.

**Los topes de horas extras no los pone el CCT sino el Decreto 484/2000**: 30
horas mensuales y 200 anuales sin autorización administrativa previa.
`TOPES_HORAS_EXTRAS` y `topeHorasExtras()` viven en `convenio.js` y se leen en
`#/nomina/cierre` (*El cierre del mes*), la tercera solapa de `#/nomina`.

**Los dos topes se contestan por separado porque son dos problemas**: pasarse en
un mes se corrige el mes que viene; pasarse en el año ya no se corrige. Y agarran
casos distintos —quien hace 34 horas en noviembre excede el mensual, y quien hace
28 todos los meses nunca excede un mes y termina el año en 224—, así que mostrar
uno solo dejaría la mitad afuera. El anual es del **año calendario** y no de los
últimos doce meses: enero arranca de cero.

**El acumulado del año se calcula sobre los meses cargados y la pantalla lo
dice.** Un acumulado anual con tres meses adentro no es un acumulado anual, y
sin ese renglón se lee como que nadie se pasó. Es la misma regla que los días
supuestos del ausentismo: el número nunca se muestra solo.

**No controla el tope diario, y no es un olvido**: las novedades traen el total
del mes por persona y no el reparto por día, así que un control diario sería un
número inventado. El corte entre 50% y 100% es el del **art. 201 de la LCT** y
cambia lo que se paga, no cuántas horas se trabajaron: las dos suman igual
contra el tope.

**`cierreDelMes()` lee `c.novedades` y no `c.ausencias`.** Son las dos cosas
distintas de siempre: `c.ausencias` es la licencia con su certificado, lo que el
coordinador sigue día a día; las novedades son lo que la liquidación terminó
pagando, que es contra lo que se cierra el mes. **Que los dos números difieran
es información, no un error** —ahí está el certificado que no llegó a tiempo— y
por eso cada uno se lee donde vive y no se los promedia. Las vacaciones aparecen
en el desglose por concepto pero no suman al total de días, igual que en
`participacionDeAusencias()`.

**Los días y las horas se llevan a FTE con los divisores de la estadística**,
`parametros.diasMes` (30) y `parametros.horasMes` (200), que salen de
`#/config` y no de una constante nueva: si el coordinador los cambia, la matriz
de FTE y esta pantalla se tienen que mover juntas. Un FTE es una persona de
jornada completa —45 horas semanales—, así que los días de ausencia se leen
sobre 30 y las horas extras sobre 200. Puestos en la misma unidad se pueden
restar, y esa resta —el **turno neto**— es el número que contesta cuánta gente
faltó de verdad en el mes: en septiembre de 2026 el área perdió 5,53 FTE en
licencias y repuso 1,65 pagando extras, o sea **−3,88 FTE**. Las tiendas se
ordenan por el neto y no por las horas: la que perdió un FTE entero en licencias
está peor que la que hizo cuarenta horas extras.

**Las altas y las bajas cuentan, y esa era la pata que faltaba.** Quien entró el
16 aportó quince días y no un mes, y los que le faltaron para los 30 se
descuentan igual que una ausencia: contarlo como mes entero infla la dotación
con gente que no estuvo, que es justo lo que el cierre viene a mostrar. El
**FTE real** es la fórmula de la matriz de TD01 —días de vínculo ÷ 30, menos
ausencias ÷ 30, más horas extras ÷ 200— y el **neto** es lo mismo leído contra
tener a todos el mes completo.

La cuenta de los días de vínculo es `movimientoDelMes()`, que ya la usaba la
matriz de FTE y era privada de `store.js`: se abrió como
**`Store.diasDeVinculo()`** en vez de escribir una parecida en `convenio.js`.
Dos formas de contar los días de un alta terminan difiriendo el día que se toca
una. **Se mide contra el período y no contra el mes**: quien entró el 05/09
aportó 14 días de 30 del período 21/08–17/09, no 26 de septiembre. Los días se
devuelven en la escala de `diasMes` —30— y no en los que el período dure, así el
período entero vale 1 FTE aunque mida 28 días.

Va en `#/nomina` y no en la estadística porque la pregunta es «¿alguien se pasó
del tope?», que es sobre personas y cruza los meses; la estadística mira **una
tienda en un mes** y desde ahí el tope anual no se puede contestar. Son **dos
tablas y no una**: la de tiendas dice dónde está la carga y es la que se lleva a
Operaciones, la de personas dice quién, que es lo que hay que corregir.

La **sucesión** no es un número del mes cerrado: es una conversación sobre
gente, y por eso vive en `#/desarrollo`, que tiene **dos solapas y no dos
entradas del menú**: *Talento y 9-box* (`#/desarrollo/talento`) decide **a quién
mirar** y *Al rol de Senior* (`#/desarrollo`) registra **qué pasó después con
esa persona**. Son las dos mitades de la misma conversación.

**El 9-box mira toda el área y estaba adentro de una visita.** Era una solapa de
`#/visita/<id>`, así que para tener el mapa del área había que abrir una visita
por tienda y acordarse de los catorce parciales. Ahora `vistaTalento()` arranca
en el área entera y el selector de tienda es para la charla con un gerente: si
la lista arrancara en una tienda habría que recorrer catorce para el panorama.
La visita quedó con el check list y el recordatorio de sucesión, en una sola
página y sin barra de solapas.

**El área se lee en tres grupos y no en nueve cuadrantes**, que es la pregunta
que el coordinador se hace todos los días: a quién tengo mapeado como
**talento**, quién como **especialista** y quién como **contribuidor consistente
(CC)**. `GRUPOS_TALENTO` (`talento.js`) los define sobre los cuadrantes que ya
existen —talento es potencial y desempeño de 2 o 3; especialista es el que
rinde muy bien sin proyección de nivel; CC es el que cumple y no busca crecer— y
`grupoDeTalento()` es quien decide. **No se cargan aparte**: un campo propio
sería una segunda respuesta a la misma pregunta y el día que difieran no hay
forma de saber cuál vale. El cuarto grupo —*En plan de mejora*, los tres
cuadrantes de desempeño por debajo— **no es uno de los tres y va igual**: dejarlo
afuera daría un mapa que no suma el plantel. La ficha de cada persona dice el
suyo con la misma función, y **no repite el nombre cuando el cuadrante y el grupo
se llaman igual** —«Queda en Especialista» y no «Especialista, que se lee como
Especialista»—, que es la regla del código de la tienda entre paréntesis. Los
**sin evaluar** van al pie y no como un grupo más, por lo mismo que «sin relevar»
en el curso de ADEF: que a alguien todavía no lo miraste no es una lectura sobre
esa persona, y mezclarlo borra la única diferencia que importa al empezar. Los
porcentajes son **sobre los evaluados** y la pantalla dice cuántos faltan, como
los días supuestos del ausentismo.

**Arrastrar en la matriz funciona sin visita abierta.** El `drop` pedía
`visitaEnCurso` y buscaba a la persona adentro de esa visita, así que en la
pantalla nueva la matriz quedaba de adorno: se arrastraba y no pasaba nada.
Ahora la busca en el padrón y fecha el movimiento con el día y el gerente de su
tienda; con una visita abierta sigue fechando con la visita, que es el dato
bueno.

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
**competencias que llegaron al nivel que pide el rol**, nunca como promedio: un
2 sobre una escala de 6 y un 2 sobre una de 4 no son lo mismo.

**El denominador son nueve, no once.** De las once del modelo, *Dirección de
otros* y *Excelencia operativa* le piden al Senior **el mismo nivel que ya le
piden al APV**: no hay nada que desarrollar ahí. Contarlas hacía que alguien
que hizo todo bien quedara en 9 de 11 para siempre, salvo que se puntuaran a
mano dos competencias que nadie tenía por qué puntuar —y el coordinador miraba
el número sin entender de dónde salía—. `competenciasConSalto()` existía
justamente para esto y **no la llamaba nadie**. La tabla las sigue mostrando,
que es el modelo completo, pero se leen «ya la pide el rol de APV» y no como
pendientes.

**El número nunca se muestra solo**: al lado va cuántas quedan **sin evaluar**,
porque «2 de 9» con seis sin mirar no es lo mismo que «2 de 9» con todas
miradas. Es la misma regla que los días supuestos del ausentismo.

**El formulario pide las nueve y cada opción dice qué significa el número.**
Antes listaba las once —dos de ellas sin nada que evaluar— y los desplegables
decían «objetivo 3» y «sin cambio (hoy 3)» sin aclarar de dónde salía el 3.
Ahora cada competencia dice **de qué nivel parte como APV y a cuál tiene que
llegar**, y dentro del desplegable el nivel del APV y el del rol están marcados
al lado del indicador. Sin eso hay que saberse el inventario de memoria para
poder puntuar.
El formulario de evaluación está **solo ahí**; la ficha de la persona y el pie de
la visita lo listan en lectura y enlazan, como el recordatorio de reclamos.
`bloqueDesarrollo()` colgaba del 9-box y ahora cuelga de la **visita**, que es a
lo que siempre correspondió: lo que hace falta no es tenerlo al lado de la
matriz, es acordarse **mientras el gerente está enfrente** de que este mes hay
que sentarse a hablar de esa persona. Se lo sacó por redundante con la solapa
*Al rol de Senior* y no lo era: esa solapa está en `#/desarrollo`, adonde se
entra cuando ya te acordaste.

**El plan de desarrollo individual es la otra mitad del 9-box** (`c.planes[]`,
`talento.js`, documentado en `docs/plan-desarrollo.md`): qué se acordó hacer de
una conversación a la siguiente, y si se hizo. Cada cuadrante ya traía escrita
su acción sugerida —«plan de mejora con objetivos medibles y plazo»— y no había
dónde escribir qué se hizo con eso.

**Es para cualquiera del padrón, entrene o no.** Cuelga de la **persona**, como
`c.ausencias`, `c.casos` y `c.entrenamientos`, así la acompaña si la trasladan.
El entrenamiento a Senior ya tenía `proximoPaso` por evaluación: un renglón de
texto libre, sin competencia, sin fecha y sin nadie que vuelva a preguntar si se
hizo. Sigue guardado y se sigue leyendo en la trazabilidad, pero lo que se
trabaja es el plan.

**Un solo formulario dibujado en dos pantallas.** `bloquePlanDesarrollo()` va en
la ficha de la persona y al pie del entrenamiento. **No rompe la regla de una
sola alta**: la regla existe para que dos formularios no pidan campos distintos,
y acá es el mismo código sobre el mismo dato, como la talent card. Va donde se
lo está pensando — mandar a buscar otra pantalla justo al terminar de cargar la
evaluación del mes es la forma más rápida de que el plan no se escriba.

**Un tramo abierto a la vez**: dos planes en curso son dos listas de
prioridades, o sea ninguna. **Cuatro estados por acción y no tres** —*se hizo*,
*sigue abierta*, *no se hizo*, sin revisar—: «no se hizo» cierra el tema y
«sigue abierta» lo arrastra al plan siguiente, y esa diferencia es lo que le da
continuidad. Las que siguen abiertas **se heredan solas** al abrir el tramo
nuevo, y el tramo anterior es **el último, esté abierto o recién cerrado**:
buscarlo solo entre los abiertos las perdía justo en el camino normal —cerrar y
después escribir el siguiente—. Volver a tocar un estado lo destilda y
**destildar no borra la nota**, como el check list y los trámites de la baja.

**El avance se cuenta sobre lo revisado**: «1 de 1 revisadas se hicieron · 2 sin
revisar», nunca «33%». Cerrar el tramo con acciones sin revisar se puede, y la
pantalla **nombra lo que falta antes de dejar cerrar en vez de impedirlo**,
igual que `c.baja.cerradaEl`.

**La competencia es opcional y solo aparece si está entrenando**, con las que le
faltan y su «hoy 2, pide 3». Para alguien que no entrena, las nueve del rol de
Senior no significan nada y la columna no se dibuja.

**Un arreglo nuevo colgado de la persona hay que sumarlo a
`unirColaboradores()`.** `planes` no estaba en su lista y al unir dos fichas
duplicadas los de la que se iba se perdían en silencio — el mismo agujero que
tendría cualquier `c.<algo>[]` que se agregue después.

**No avisa, y es una decisión.** Una acción pasada de fecha se marca en su fila
y nada más: no suma al contador del menú ni a `pendientesDelArea()`. El panel ya
avisa por el entrenamiento vencido y por el mes sin evaluación; un tercer aviso
por cada acción de cada plan convierte el contador de *Desarrollo* en un número
que deja de leerse, que es la regla de los contadores en cero vista al revés.

**Las vacantes y las vacaciones contestan la misma pregunta desde dos lados** —
con cuánta gente cuento— y por eso son dos pantallas y no una: la vacante es el
lugar que falta cubrir y no se cubre solo; las vacaciones son el lugar que se
vacía en una fecha acordada y vuelve. Una se resuelve contratando y la otra
moviendo una fecha. Documentadas en `docs/vacantes-y-vacaciones.md`.

**La vacante cuelga de la tienda (`s.vacantes[]`) y no de la persona**, al revés
que todo lo demás —`c.baja`, `c.ausencias`, `c.casos`, `c.entrenamientos`,
`c.planes`—: es lo único que se guarda así, porque una vacante es exactamente el
lugar donde no hay nadie de quien colgarla. Guarda **qué puesto y en qué
tienda**, que es lo que se pidió, más **desde cuándo está abierta**, que es lo
único que la convierte en algo que apura: sin esa fecha la lista se lee igual el
primer día que a los cuatro meses. El puesto sale de `CARGOS_NOMINA` y la
posición **se deriva** del cargo — no agregar un segundo desplegable de puestos.
**Dentro de `#/sucursal/<id>` se dibuja como una tarjeta más del organigrama**,
punteada y en ámbar, al lado de la gente de su puesto: era la forma pedida, que
«me falta un farmacéutico en Devoto» se vea mirando la tienda. **No cuenta en la
dotación** —la dotación es con cuánta gente cubro el turno— y cubrirla no la
borra: pasa abajo con cuánto tardó, que es lo que se lleva a Operaciones.

**Un tramo de vacaciones es una ausencia con motivo `vacaciones`, y no una lista
nueva.** Ya vivían en `c.ausencias` —las cargan el libro de novedades y el
formulario de recepción— así que `#/vacaciones` llama a `Store.agregarAusencia()`
y hereda el antiduplicado de `ausenciaQueSeSolapa()`: volver a cargar la misma
salida corrige la que estaba. No rompe la regla de una sola alta, por lo mismo
que `bloquePlanDesarrollo()`: es el mismo código sobre el mismo dato. **No abrir
una segunda lista de tramos.** Y **«último día» es el último de vacaciones, no el
de la vuelta** —del 5 al 21 son 17 días y vuelve el 22—, que es la convención de
cualquier otra licencia del panel.

**La antigüedad de las vacaciones se mide al 31 de diciembre del año del ciclo**,
no al día de hoy: último párrafo del **art. 150 de la LCT**. Los días salen de
`vacacionesDe()` (art. 24 del CCT, que mejora la ley: 17 hasta los 5 años y 26
hasta los 10). `cicloDeVacaciones()` (`vacaciones.js`) es **el único lugar que
traduce entre el ciclo y sus fechas**, como `rangoDePeriodo()` con el período de
liquidación, y sale de `parametros.vacacionesAnio`, `vacacionesMesDesde` y
`vacacionesMesHasta`, editables en `#/config`. La ventana es **del 1 de octubre al 30 de abril**,
que es la del art. 154 de la LCT. Con el mes de arranque mayor que el de cierre
cruza el año, que es el caso normal. **Los días que arrastra del ciclo anterior el panel no los puede
deducir** y se cargan a mano en `c.vacacionesPendientes`, **indexados por el año**
y con un binding propio (`data-vacpend`); en cero se borra la clave en vez de
guardar un 0, como `marcarAdef()`.

**Planificado, tomado y saldo son tres números y no uno.** El saldo es el total
menos lo planificado: **lo que falta ubicar en el calendario**, no lo que falta
gozar. La planilla los confunde porque arranca con todo en cero.

**El laboratorio no cuenta como APV, y por eso existe `posicionDeCobertura()`
(`nomina.js`).** El laboratorio de Olivos prepara alopatía y homeopatía y su
gente está cargada en la nómina como «ASISTENTE DE PISO DE VENTAS»: **ocho
personas que la tienda contaba en el piso y no están en el piso**, así que
«te quedás sin dos APV» era un número que no se podía disparar nunca. El
casillero de cobertura de esa gente es «Laboratorio · Alopatía» u
«Homeopatía», y de paso la cobertura avisa también cuando la tienda se queda
sin homeopatía. **No pisa `c.posicion`**: la posición dice qué *es* la persona
—de ahí salen el 9-box, el organigrama y el desarrollo— y el casillero dice
dónde se la *cuenta*, así que se deriva y no se guarda. **Sigue contando en la
dotación**, que es plantel y cuesta, y `dotacionPlantel().laboratorio` lo
devuelve aparte.

**`esDeLaboratorio()` devuelve un objeto, no un booleano**, igual que
`esNoPresencial()` y por la misma trampa: hay que leer `.laboratorio`. La forma
repetida es a propósito — dos formas distintas para la misma clase de pregunta
es peor que una con una trampa conocida.

**La especialidad no viene en ninguna planilla**: la sabe el coordinador. Vive
en `c.laboratorio`, se cambia desde la ficha de la persona (`data-lab`) y en
vacío **se borra la marca**, como `marcarAdef()`. La lista inicial está en
`LABORATORIO_AREA3` (`plantel-area3.js`) y una migración de una sola vez la
escribe sobre el padrón ya cargado sin tocar nada más. **Va en ese archivo y no
en `catalogos.js` porque son nombres de personas**: la build de la página
publicada vacía `plantel-area3.js` entero y `catalogos.js` viaja tal cual — por
eso `build-pagina-unica.py` también inyecta `LABORATORIO_AREA3 = []`, que si no
la página rompe con un ReferenceError.

**Dos colores y el rótulo siempre escrito al lado.** `--lab-alo` y
`--lab-homeo` pasaron el validador de daltonismo y contraste contra los dos
fondos, y los pasos del modo oscuro se eligieron contra el fondo oscuro. La
administrativa va en gris porque **no es una especialidad**: pintarla de un
tercer color diría que sí lo es.

**La cobertura se cuenta también por posición, en personas y no en FTE**, y eso
es lo que contesta «te quedás sin dos APV»: un piso de 6 FTE con los dos APV
afuera no es un piso de 6, y una farmacia sin su DT no abre. Dos umbrales:
**queda en cero** es categórico y no depende de ningún mínimo configurado;
**se va la mitad o más** es un aviso. **El aviso sale al anotar la salida**, no
al mirar la pantalla —se decide al elegir la fecha— y **se nombra sin impedir**:
mover una salida es una conversación, no una validación.

**El calendario es la excepción a «tabla y no gráfico»**, porque lo que hay que
ver es el **solapamiento**: dos salidas de enero se leen igual en una lista y en
una tira de días se ve de una que hay nueve con las dos personas afuera. Por
dentro sigue siendo una tabla, con una fila por persona y una columna por día, y
abajo **una fila por posición con cuántos quedan cada día** — el número escrito
en la celda y el color solo acompañando, como la barra de composición.

**La planilla se pega plana, una fila por tramo** (`importarPlanDeVacaciones()`,
`COLUMNAS_PLAN_VACACIONES`). El Excel del área tiene una hoja por tienda y diez
pares SALIDA/RETORNO; pegar hoja por hoja es lo que ya salió mal con el libro de
novedades. **«Retorno» es el día que vuelve** —sale el 26/10, retorna el 12/11,
17 días— y la resta al último día de licencia se hace en un solo lugar, adentro
del importador. **No crea a nadie** y **completa el CUIL donde falta**, así la
pegada del año que viene empareja por número y no por nombre.

**Lo que arranca antes de la ventana no se tira: se nombra**
(`tramosFueraDeVentana()`). La planilla traía nueve salidas entre julio y
septiembre y la ventana arranca el 01/10. **No se descuentan del saldo**: cuál
ciclo pagó una salida de julio no se puede deducir, y adivinarlo le descontaría
días a alguien que todavía los tiene.

**Lo que la planilla no puede contestar es la cobertura, y es la razón de la
pantalla.** `coberturaDeVacaciones()` recorre **día por día** e informa **el peor
día de cada mes**: dos personas afuera la misma semana y dos en semanas
distintas dan el mismo total mensual y son dos situaciones opuestas. El piso se
compara contra `minimoTurno` de la ficha de la tienda, y **sin ese número no se
pinta nada en rojo**: la pantalla dice que falta el dato en vez de inventar un
mínimo. **El contador del menú son las tiendas que quedan cortas**, no la gente
sin planificar — al empezar el ciclo nadie tiene fecha y ese contador diría 136,
que es un número que deja de leerse el mismo día.

**Las vacaciones no se justifican: se otorgan.** `estadoDeAusencia()` mandaba a
`pendienteJustificar` —en rojo, encabezando las alertas— a toda ausencia sin
certificado, y las vacaciones no tienen papel que reclamar: quedaban ahí para
siempre. Ya le pasaba a las del libro de novedades. `motivoPideCertificado()`
(`ausencias.js`) lo decide en un solo lugar, al lado de `motivoSumaAusentismo()`;
las demás licencias siguen pidiendo comprobante. En Presentismo esa casilla dice
«no lleva» en vez de ofrecer un tilde: una casilla que no hay que tildar nunca
enseña a tildar sin mirar.

**Los tramos que trajo el libro van en gris y punteados**: dice cuántos días se
pagaron y no cuáles, así que quedan ubicados al principio del mes. Mismo trato
que `diasSupuestos` con el certificado sin duración.

El instrumento de la visita es el **check list de RRHH Operaciones**
(`assets/js/checklist.js`, documentado en `docs/checklist-rrhh.md`): 30 puntos
con criterio de aprobación, y es el único —la recorrida del HRBP se eliminó por
repetirlo—. `v.recorrida` sigue en el modelo para no romper lo ya guardado, pero
no se muestra ni entra en ningún reporte, y **su código ya no está**:
`RECORRIDA_HRBP` y `evaluarRecorrida()` eran 114 líneas que no llamaba nadie
desde que la solapa se sacó.

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

**El Panel abre con la composición del plantel, tienda por tienda**
(`bloqueComposicion()` en `app.js`, sobre `composicionPorSucursal()` de
`nomina.js`): cuántas mujeres y cuántos varones, antigüedad promedio y edad
promedio. Son las tres que arman la conversación de capacidades con Operaciones
—una tienda de gente nueva no se supervisa como una de quince años de casa— y es
lo que McKinsey llama planificar capacidades y no headcount.

**Cuenta personas, no FTE**: dos de media jornada son dos personas. El FTE
contesta «cuánto turno cubro» y esto contesta «quiénes son», que es otra
pregunta; por lo mismo los de bloqueo de título entran, que son plantel aunque
no cubran piso.

Es **una tabla y no un gráfico**, a propósito: con catorce tiendas y tres medidas
de unidades distintas, cualquier gráfico único obliga a dos escalas en un mismo
eje, que es la forma más común de mentir sin querer. La única marca es la barrita
de composición —eso sí es parte de un todo— y **va siempre con los dos números al
lado**: el color nunca es lo único que dice cuál es cuál. Los dos tonos
(`--sexo-f`, `--sexo-m`) están validados para daltonismo y contraste, y los pasos
del modo oscuro se eligieron contra el fondo oscuro, no derivados del claro: los
tokens de la interfaz son demasiado claros y poco saturados para una marca de
datos. **No colorear las filas por tienda**: son categorías sin orden y el largo
de la barra ya dice lo que hay que ver.

**La edad sale de `fechaNacimiento`, que no está en la semilla del repositorio**
—la privacidad la deja afuera— así que aparece recién al pegar la nómina del mes.
Mientras no haya ninguna, la columna entera **no se dibuja** y el copete dice de
dónde va a salir, por lo mismo que un indicador sin número sale de la tira. El
sexo **sí** está en la semilla (`sx`), porque si no el tablero abre vacío en un
navegador limpio, que es justo lo que la semilla existe para evitar. Cuando un
promedio sale de una parte del plantel, la celda dice **sobre cuántos** está
hecho: «40,0 años · sobre 13 de 136».

**El Panel tiene dos solapas y no dos pantallas**: *Situación* (`#/red`) y
*Indicadores* (`#/red/indicadores`). Las dos miran el área de conjunto, que es el
mismo nivel de zoom; separarlas en dos entradas del menú habría dejado **seis
lugares con KPIs**. Una contesta «qué está pasando hoy» y la otra «cómo está
armada el área».

**Los indicadores de RRHH viven en `assets/js/indicadores.js`** y salen del
**padrón y de nada más**: composición, las dos antigüedades, la estructura por
nivel de cargo y la cobertura de los puestos que no pueden faltar. No dependen de
que haya una visita, una estadística ni un RDV cargados, a propósito: un tablero
que necesita tres cargas previas es un tablero que nadie mira.

**Las dos antigüedades cuentan historias distintas y van las dos.** Las farmacias
del área se compraron, así que el promedio da 6,2 años en la farmacia y 1,3 en
Farmatodo: mucha gente con antigüedad reconocida y poco tiempo bajo la cultura de
la empresa. Mostrar una sola cuenta media historia, y el número sin esa
explicación al lado confunde.

**Cada número trae escrita la oración que lo explica** (`.ind-lectura`). Es la
mitad del indicador: sirve para trabajarlo y para proyectarlo sin que nadie tenga
que traducirlo. Las bandas de antigüedad son **ordenadas**, así que llevan una
rampa de un tono en cinco pasos —validada contra los dos fondos— y no colores
distintos; la estructura por nivel de cargo es **nominal**, así que va toda del
mismo color y lo que se compara es el largo.

**Un indicador o está implementado y aparece cuando el dato existe, o no se
promete.** `rotacionDelArea()`, `ausentismoDelArea()` y `reclamosDelArea()`
devuelven `null` mientras no haya con qué, y entonces la pantalla los lista al pie
—con qué hay que cargar y un enlace para ir—; en cuanto hay un dato aparecen
arriba, en *Lo que se mueve*, con su número. **Nunca las dos cosas ni ninguna**:
`loQueFaltaParaMedir()` pregunta por el propio cálculo y no por si el dato suelto
existe.

La primera versión hacía solo la mitad: listaba seis indicadores como «ya viene»
y, al cargar la primera baja, **el renglón desaparecía de la lista sin que
apareciera nada en su lugar**. Eso es peor que el guión que la lista venía a
evitar. Un indicador nuevo se agrega con su cálculo, o no se agrega.

**Tres no se repiten acá a propósito** —cumplimiento del check list, distribución
del 9-box y costo sobre venta—: ya viven donde se cargan, en la visita, en
*Desarrollo → Talento y 9-box* y en la estadística del mes, y traerlos sería el
sexto lugar con los mismos números.
`DONDE_VIVEN_LOS_OTROS` los enlaza en vez de prometerlos.

**La rotación separa renuncias de despidos** porque no son el mismo problema: una
se previene con condiciones de trabajo y la otra es una decisión propia. La
dotación media del período es **aproximada** —los activos de hoy más la mitad de
los que se fueron— porque el panel guarda el plantel de hoy y no la foto de cada
mes, **y la pantalla lo dice**: un promedio inventado sobre una serie que no
existe sería peor que un número aproximado y anunciado como tal.

**Trampa conocida — `esNoPresencial()` devuelve un objeto**, no un booleano, así
que `filter(c => esNoPresencial(c))` se queda con todo el plantel: hay que leer
`.noPresencial`. Le pasó a este tablero, que anunciaba que las 136 personas del
área tienen bloqueo de título. Es la misma forma del `!!` sobre
`tieneCertificado()`.

**Siguen siendo dos listas de tiendas y no tres.** `#/red` mira el área de
conjunto —KPIs y una tarjeta por tienda— y `#/sucursales` mira tienda por
tienda. Una pantalla nueva que necesite listar las doce tiene que apoyarse en
una de esas dos. La regla que eliminó la vieja solapa *Sucursales* no cambió;
lo que cambió es cuál de las dos listas es la puerta de entrada.

**Los flotantes no son una tienda** y la pantalla lo respeta: se los marca como
staff, no se los mide por visitas y no aparecen en el selector para registrar
una. Están en la lista porque ahí hay gente que hay que poder alcanzar.

**`#/sucursal/<id>` es el final del camino** y por eso tiene el bloque *De esta
tienda*: atajos a Presentismo, Reclamos, Desarrollo y Movimientos y bajas, cada uno
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

**Los casos en seguimiento viven en `#/casos`** (`assets/js/casos.js`,
`c.casos[]`): las situaciones que no se resuelven solas —un desempeño que no
levanta, un ausentismo que ya no es un resfrío, un intercambio con el estudio
jurídico—.

**Se sigue la situación, no se etiqueta a la persona**, y el nombre no es
casual: el coordinador pidió «panel de empleados complejos» y eso sería una
lista de adjetivos sobre gente con nombre y apellido guardada en una
herramienta de la empresa. No dice qué hacer, envejece mal y en un juicio se lee
como prueba de un prejuicio. Un caso tiene fecha de apertura, un próximo paso y
una fecha de cierre, y cuando se resuelve **se cierra**. Por eso lo que se
escribe son hechos y acciones —qué pasó, cuándo, qué sigue y quién lo lleva— y
no calificaciones.

**Las señales no se tipean: se leen.** `senalesDe()` trae el cuadrante del
9-box —«Riesgo» es exactamente el bajo desempeño con bajo potencial, y ya está
calculado—, los días y la tasa de ausencia de la persona, si hoy tiene licencia
abierta, sus reclamos abiertos, sus sanciones y si está en desarrollo. Pedir que
se vuelva a cargar algo que el panel ya sabe es la forma más rápida de que los
dos números difieran.

**La documentación no va acá.** Certificados, informes médicos, cartas documento
e intercambios con el estudio viven en el legajo y en el estudio; la pantalla lo
dice. El panel guarda que el caso existe, en qué estado está y qué sigue: con
eso alcanza para no perderle el rastro y evita que una historia clínica termine
en el almacenamiento de un navegador.

**Tres estados y ninguno más**: *abierto* —la próxima acción es tuya—,
*esperando* —depende de un tercero: el estudio, una junta médica, una
respuesta— y *cerrado*. «En seguimiento» y «abierto» serían el mismo estado con
dos nombres; lo que cambia la lectura es de qué lado está la pelota.
`estadoDeCaso()` marca lo que pide algo: el próximo paso vencido, el caso sin
próximo paso definido y el que lleva `DIAS_CASO_SIN_MOVIMIENTO` (21) quieto —a
las tres semanas ya no se está siguiendo, se está olvidando—.

**Los casos cuelgan de la persona**, como `c.baja`, `c.movimientos`,
`c.ausencias` y `c.entrenamientos`, así el seguimiento la acompaña si la
trasladan. Lo que pide algo entra en `pendientesDelArea()` y en el contador del
menú, no en `e.agenda`: es la misma regla de *lee, no copia*.

**Los Gerentes de Tienda tienen su propio anexo, y el dato viaja por un
mensaje.** `anexo-gerentes.html` es la página que usan para avisar algo: abre en
el teléfono, sin login y sin conexión, con la paleta del panel. Documentado en
`docs/anexo-gerentes.md`.

Lo que molestaba **no era el WhatsApp: era la informalidad** —«cris fulanito de
tal cobró mal»—, y esa distinción decide el diseño: el gerente sigue mandando un
mensaje, pero el anexo se lo arma. Lo que llega es una línea por dato con la
clave adelante, que **se lee de corrido y se parsea sin ambigüedad**; si fuera un
bloque cifrado el gerente no sabría qué está mandando.

**Pero no va por WhatsApp, y es una decisión del coordinador.** La primera
versión abría el chat con el mensaje ya escrito, con el argumento de que el
gerente seguía haciendo el gesto de siempre. Él lo descartó: un reclamo de sueldo
que entra a su chat personal se mezcla con todo lo demás, y la informalidad que
el anexo viene a sacar vuelve por la puerta del canal. Quedan **mail y copiar**,
con el texto idéntico, y el importador lo toma de donde venga. Se eliminó el
botón, la constante `TEL_RRHH` y la opción `--tel` del generador — apagado
volvería por descuido. **No reponerlo.**

**No hay otra forma de que el dato llegue, y las dos alternativas se
descartaron con el motivo escrito.** El panel no tiene servidor, así que el dato
solo viaja por un canal que las dos partes toquen. Un formulario de Google se
descartó porque el coordinador no lo quiso —es la herramienta de otro y se lee
como un trámite—. Una página publicada con la capacidad `db` **no sirve**: el
contrato es explícito en que quien entra con el link lee pero **no escribe**
—«never Viewers, Commenters or outside link visitors»—, así que harían falta
catorce cuentas de Claude con permiso de escritura. **No proponer ninguna de las
dos de vuelta.**

**El anexo es solo para reclamos de sueldo**, más avisar que llegó una carta
documento. **Dos ramas, dos destinos, un solo link**: `RECLAMO` cae en
`#/reclamos` y `LEGAL` abre un caso. El gerente no tiene por qué saber que del
lado del panel viven en lugares distintos. La **carta documento entra
`esperando` y con riesgo alto**, no `abierto`: desde el minuto uno la pelota está
en el estudio.

Había una tercera rama —*«una situación que necesita seguimiento»*— y **se
eliminó a pedido del coordinador, con `tipoDeCasoPorNombre()` y la extracción de
`TIPOS_CASO` del generador**. Un gerente no usa un formulario para contar que un
desempeño no levanta, y si lo usara quedaría una impresión escrita sobre una
persona en una herramienta de la empresa, sin una conversación atrás — lo mismo
que se rechazó cuando se pidió un «panel de empleados complejos». Un reclamo y
una carta documento son hechos. **No reponerla.** Lo ya importado con esa marca
sigue en su ficha, y una rama que el importador no reconoce se devuelve en
`invalidos` con su texto en vez de perderse.

**El anexo no lleva el padrón** y no hay que agregárselo: el nombre lo escribe el
gerente. Listar a las 136 personas en una página que abren catorce es lo que la
regla de `--demo` existe para evitar. Lo verifica `check-anexo.js`, que también
chequea los referentes, sus mails, los CUIT y las direcciones. Las doce tiendas
sí van: sin eso no se puede decir de dónde se carga.

**`anexo-gerentes.html` es generado y no se edita a mano.** La fuente es
`anexo-gerentes.plantilla.html` y `build-anexo.py` le inyecta las tiendas de
`sucursales-area3.js` y los motivos de `TIPOS_RECLAMO` y `TIPOS_CASO`. Una
segunda lista de motivos adentro de la página se desincronizaría de la del panel
sin que nada falle, que es lo que `MAPA_CARGOS` ya evitó derivándose de
`CARGOS_NOMINA`.

**`buscadorDePadron()` ahora empareja también por legajo**, que es el número que
el gerente tiene a mano porque lo lee del recibo. Va después del CUIL y del DNI
—un CUIL de once dígitos no se parece a nada, un legajo de cuatro sí— y quien no
pasa `legajo` no cambia de comportamiento. Se agregó ahí y no en el importador
nuevo: cuatro emparejamientos con cuatro criterios es la garantía de que un día
difieran.

**Un reclamo entra sin ficha; un caso no.** El reclamo vive en la raíz del estado
y guarda el nombre escrito, así que se puede trabajar igual. Los casos cuelgan de
la persona, así que sin ficha no hay dónde colgarlos: la asimetría **se nombra en
la pantalla en vez de taparse**, y los legales van aparte y en rojo porque una
carta documento que no entró tiene plazos corriendo.

**Trampa conocida — `casoNuevo()` arma una forma fija y descarta las claves que
no conoce.** Un dato nuevo de un caso se agrega *ahí*, no pasándolo a
`abrirCaso()`: el caso se crea igual y la clave se pierde en silencio. Pasó con
`origen`, y sin esa marca el antiduplicado del anexo no reconocía lo ya cargado
—pegar el mismo aviso dos veces habría duplicado el caso—. Se agregaron `origen`
e `informadoPor`; `origen: 'anexo'` sigue la convención de `c.ausencias`, que ya
usa `origen: 'formulario'`.

**Lo que el coordinador quiere del anexo no es dejar de recibir WhatsApps: es
poder decirle a Nómina de dónde salen los reclamos.** Esa es la razón de
`origenDeReclamos()` (`reclamos.js`), y la regla que lo ordena todo es: **un
reclamo suelto es un trámite; el mismo concepto repetido es un proceso roto.**
De quién es depende de cómo se reparte:

- en **varias tiendas** (`TIENDAS_PARA_SER_DE_NOMINA`, 3) es de **Nómina**: así
  se liquida en todas partes, y no son cinco errores sueltos;
- concentrado en **una** es de **esa tienda**: cómo carga o cómo comunica;
- que vuelva en **dos períodos** es *no se corrigió*, y gana sobre todo lo demás
  —un concepto que vuelve es peor que uno más grande que pasó una vez—;
- y donde la mayoría de los resueltos **no procede** es de **explicación**, no de
  liquidación. Ese es el que más se malinterpreta: «no procede» se lee como
  «reclamo infundado» cuando lo que dice es que alguien no pudo leer su propio
  recibo y nadie se lo explicó.

Los porcentajes van **sobre los cerrados** y la pantalla dice cuántos siguen
abiertos: «el 70% no procedió» con la mitad sin resolver no es un 70%.
`patronesDeReclamos()` se queda —contesta «qué tienda mirar»— y no se
reemplaza. El bloque va en `#/reclamos` y no en *Panel → Indicadores*, que
sería el sexto lugar con los mismos números.

**`periodoReclamado()` lee `periodoAfectado`, que es texto libre**, y si no lo
entiende cae en la fecha en que se planteó. Nunca inventa un período: el que no
se pudo ubicar no ensucia uno ajeno.

**Son dos reportes y no uno recortado**, porque son dos lectores y dos
preguntas. `Reporte.textoReclamosNomina()` contesta «qué hay que arreglar en el
proceso» y **abre con el veredicto y no con la lista**: catorce renglones de
casos se leen como catorce trámites, y lo que hay que ver es que seis son el
mismo. `Reporte.textoReclamosDeTienda()` contesta «qué pasó con lo que cargué»,
va caso por caso con su estado y su respuesta textual, y es **lo que hace que el
gerente se apropie**: sin devolverle el estado carga en un vacío y en dos
semanas vuelve a preguntar por WhatsApp, que es justo lo que el anexo viene a
sacar. No lleva la comparación entre tiendas: los números de las otras no son
suyos.

**El WhatsApp se pega en el alta y queda textual.** El coordinador decidió
seguir recibiendo los avisos como siempre y cargarlos él, y eso tiene un costo:
lo registrado es su reconstrucción y no la palabra del gerente. Pegando el
mensaje queda textual en el detalle, y `leerMensajeDeReclamo()` propone el
concepto, el período y el monto. **Propone y no decide, y cada pista dice de qué
palabra salió**: una adivinanza sin su motivo al lado se acepta de apuro, y el
concepto mal puesto ensucia justo el número que se le lleva a Nómina. Nunca pisa
lo que ya está escrito a mano.

`PALABRAS_DE_RECLAMO` **completa a `TIPOS_RECLAMO`, no la reemplaza**: los `id`
son los de esa lista y uno que no exista se grita por consola al cargar. Lo que
agrega es cómo lo escribe un gerente apurado, que no es el nombre formal
—nadie tipea «Adicional nocturno», tipea «el nocturno»—. Se buscan **con borde
de palabra**: «sacaron» no puede dar SAC ni «cuarto» dar ART, que es el falso
positivo que contaría un reclamo de francos como aguinaldo. Y el monto entra
**solo con signo de pesos**: un número suelto puede ser una cantidad de horas, y
tomarlo como plata inventa una cifra que después se suma.

**`buscadorDePadron()` se abrió como `Store.buscarEnPadron()`** para que la
pantalla lo use, en vez de escribir una búsqueda parecida en `app.js`. Es lo
mismo que `Store.diasDeVinculo()`.

**Lo que se descartó para que el dato viaje solo, con el motivo escrito.** El
coordinador pidió un link donde los gerentes completen y que eso llegue
**automáticamente** a `#/reclamos`. No se puede con lo que hay: ninguna página
escribe dentro del navegador donde vive el panel. Se evaluaron una web app de
**Apps Script** —que sí lo daría: link propio, planilla de la empresa, y el
panel leyéndola al abrir— y el `db` de una página publicada —que **no**, porque
quien entra con el link lee pero no escribe—. **El coordinador eligió quedarse
con el anexo**, que arma el mensaje y se pega. No reproponer ninguna de las dos
sin que él lo pida.

**Lo que lo excede se le manda a Nómina, y eso es otro documento.**
`Reporte.textoPedidoANomina()` no es el análisis con otro formato: son dos
conversaciones. El análisis se discute en una reunión; el pedido es una orden de
trabajo —estas personas, este período, este concepto, esta plata— y se contesta
liquidando. Tres cosas lo hacen servible:

- **Se agrupa por período de liquidación**, porque así trabaja Nómina. Un pedido
  que mezcla períodos les deja a ellos separarlo, y entonces lo separan mal o lo
  postergan. Adentro de cada período, por tienda.
- **Arranca diciendo qué filtró el coordinador** —«de los 7 registrados, 1 no
  procedía y 1 lo sigo yo»—. Cinco casos pre-filtrados se leen distinto que
  catorce en crudo: dicen que del otro lado hubo criterio y no una lista
  reenviada.
- **Separa «revisá esto» de «ya está decidido, falta el ajuste»**, que son dos
  pedidos distintos. Lo segundo no se discute, se liquida.

Cada persona va con **su documento** —DNI, o CUIL si no hay—, porque un pedido
sin identificador le deja a Nómina adivinar; el que no tiene ficha en el padrón
lo dice en vez de ir sin identificar. Y va **lo que dijo, textual**, que es lo
que permite verificarlo contra el recibo sin volver a preguntarle a nadie.

**El triage es un clic por fila** (`a-nomina` en la lista de `#/reclamos`).
Marcar «me excede» abriendo la ficha de cada uno son catorce aperturas para una
decisión de un segundo, y es el paso que hace que el pedido no se arme nunca.
Deja el reclamo en `nomina` **y `aCargo: 'nomina'`**: si no, queda escalado y
colgado de RRHH al mismo tiempo. El bloque **no aparece sin nada que mandar**,
como los contadores en cero, pero con reclamos abiertos y ninguno marcado **sí
dice qué falta hacer**: ahí el vacío no es «no hay trabajo» sino «todavía no
decidiste cuáles te exceden».

**Un apellido puede ser una palabra común, y `check-anexo.js` lo sabe.** En el
padrón hay una persona de apellido **SUELDO SANCHEZ**, y el anexo dice «reclamos
de sueldo» como sustantivo: marcarlo sería un falso positivo que, repetido,
enseña a ignorar el chequeo —que es la peor forma de romperlo—.
`APELLIDOS_QUE_SON_PALABRAS` es explícita y corta a propósito: solo las que de
verdad chocan con este padrón, y si entra alguien de apellido Flores hay que
agregarla a mano mirando que el uso sea el sustantivo. La excepción **no debilita
el chequeo**: al lado corre la señal fuerte, el **nombre completo** o el apellido
con sus dos palabras, que ninguna excepción puede tapar.

**Trampa conocida — un bloque nuevo en una pantalla rompe las pruebas que
cuentan sobre toda ella.** `e2e-reclamos-unico.js` contaba `table tbody tr` de la
pantalla entera y los bloques de *Para mandarle a Nómina* y *De dónde vienen*
agregaron tres tablas; `e2e-anexo-circuito.js` leía el primer `.aviso-caja` y el
primero pasó a ser otro. Las dos fallas eran de las pruebas y no del panel, pero
cuestan una corrida entera de la suite: **al agregar una tabla, un `.kpis` o un
`.aviso-caja` a una pantalla que ya tiene pruebas, acotar los selectores a su
sección antes de correrlas.**

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

**Antes de publicar la página**, además:

```
node check-publicacion.js
```

**Si se tocó el anexo de los gerentes**, además:

```
python3 build-anexo.py
node check-anexo.js
```

El segundo no es opcional y es el que importa: el anexo se reparte por link a
catorce personas, así que es una página publicada en todo sentido y no puede
llevar un solo nombre de persona adentro. `anexo-gerentes.html` es **generado**:
lo que se edita es `anexo-gerentes.plantilla.html`.

## Privacidad

Los datos personales del padrón viven **solo en el navegador del usuario**,
cifrables con clave, con dos excepciones acotadas que sí están en el proyecto.
La gerencia autorizó al coordinador a trabajar con la nómina real del Área 3, y
esa autorización es para **el repositorio y el equipo, no para una página
publicada**.

`assets/js/plantel-area3.js` guarda lo **operativo** de las 136 personas del área
—nombre, sexo, tienda, cargo, categoría, nivel, jornada, fechas de ingreso,
estatus y unidad de negocio—, para que el panel no abra vacío cuando el navegador
se limpia. El **sexo** (`sx`) está ahí porque sin él la composición por sucursal
del Panel abre vacía; la **fecha de nacimiento no**, y no hay que agregarla. `assets/js/sucursales-area3.js` guarda los referentes de cada tienda:
gerente, director técnico, contacto administrativo con su mail y referente de
RRHH.

**Ninguno de los dos lleva CUIL, DNI, fecha de nacimiento, teléfono, domicilio,
mails del colaborador, banco ni CBU**, y no hay que agregárselos: esos campos
entran al pegar la nómina y se quedan en el navegador. El banco y el CBU se
importan desde septiembre de 2026, a pedido del coordinador: se muestran
plegados en la ficha y no aparecen en ningún reporte.

**La página publicada dice que es una demostración y carga sus cinco personas
sola.** Abrir el link y encontrarse con cinco nombres desconocidos —o con el
tablero en cero— se lee como que se perdieron los datos. `--demo` inyecta
`PAGINA_DE_DEMOSTRACION = true`, que es lo único que el panel necesita saber:
con eso muestra un cartel arriba del Panel aclarando que las personas están
inventadas y que el panel de trabajo es el que se abre desde el archivo, y carga
la semilla al entrar.

**Solo la de demostración carga sola.** En el panel de trabajo reponer el
plantel sigue siendo **un clic a propósito**: la semilla es la nómina de un mes
concreto y meterla sola en un navegador nuevo se adelanta a lo que el
coordinador iba a pegar. En una página publicada no hay nada que adelantarse y
el clic es puro estorbo. Las dos respetan `Store.arrancoEnFrio()` —cierto solo
cuando nunca se guardó nada— así que un tablero vaciado a mano se queda vacío en
vez de repoblarse a espaldas de quien lo borró; ahí lo que aparece es el aviso
de las copias automáticas, que es mejor que reponer a ciegas.

**Lo que se publica como página se arma con `--demo`** (o con `--sin-plantel`,
que es lo mismo pero deja el padrón vacío). `--demo` pone en su lugar las cinco
personas inventadas de `assets/js/plantel-demo.js` —Acuña, Beltrán, Corvalán,
Dávalos y Espósito, todas en Botánico—, que **no existen**. Es la que hay que
usar: una página publicada sin nadie adentro abre en cero y parece rota, porque
no hay gente que cargar. `index.html` no carga `plantel-demo.js`; solo lo usa la
build.

Las dos barren lo mismo: vacían `PLANTEL_AREA3` y sacan de `sucursales-area3.js` los
nombres de personas —los referentes, sus mails y el comentario de cabecera, que
también nombraba a alguien—. Ese segundo barrido no existía y las doce fichas de
referentes viajaron a la página publicada durante meses, porque el archivo se
llama «sucursales» y uno lo lee como datos de las tiendas. Las tiendas sí
quedan —código, `rvd`, dirección, CUIT, razón social, horario—: eso es dato de
la empresa y es lo que hace que la página publicada sirva para mostrarla.
**Antes de publicar corre `node check-publicacion.js`**, y no es opcional. El
barrido de `--demo` y `--sin-plantel` vacía los **datos** y no toca los
**comentarios**, y un comentario viaja al HTML armado igual que el código: en
`store.js` había **cinco personas del padrón escritas con nombre y apellido**
dentro de ejemplos —«el número de fulano con el nombre de mengano»— y viajaron
a la página publicada durante meses. El chequeo busca los nombres de la semilla,
los apellidos con borde de palabra, el patrón «APELLIDO, NOMBRE» en mayúsculas
y cualquier cosa con forma de CUIL. **Los ejemplos de los comentarios y de los
placeholders van con nombres inventados**, y las siglas que el patrón agarra de
más —«CUIL, DNI», «ART, ANSES»— están nombradas una por una en el script, como
`APELLIDOS_QUE_SON_PALABRAS`: lo que aparezca nuevo lo tiene que mirar una
persona.

El respaldo que se exporta desde Configuración **no está cifrado** y lleva esos
datos adentro; la pantalla de Configuración lo advierte cuando hay alguno
cargado. El cifrado no tiene recuperación por diseño, y **las copias
automáticas guardan el crudo del almacén**, así que con clave puesta están
cifradas con la misma: sin la clave tampoco se leen. El `.json` exportado es la
única salida, y por eso es el que hay que tener.

**Cada panel tiene su propia clave, y la portada ahora lo dice.** El panel que se
abre desde el archivo y la página publicada son dos almacenamientos distintos:
la clave de uno no abre el otro. Las dos portadas eran idénticas, así que
quedarse afuera de la demostración se confundía con quedarse afuera del panel de
trabajo. El cartel de «esto es la demostración» vivía **adentro** del panel —o
sea detrás del candado, justo donde no se lo puede leer cuando no se logra
entrar— y ahora también está en la portada, y el error de clave equivocada
nombra las dos cosas: que cada panel tiene la suya y que la única salida es
empezar de cero e importar un `.json`.

**Un guardado que falla en silencio es la peor forma de perder trabajo, y el
aviso vivía en una sola pantalla.** `guardar()` es asincrónico: cuando
`localStorage` no acepta lo que se escribe —no hay lugar, el navegador tiene
bloqueado el almacenamiento— la pantalla **ya se pintó diciendo que salió
bien**. El cartel que lo decía estaba adentro de `vistaRed()`, así que se podía
trabajar una hora entera en Presentismo, en Nómina o en Reclamos sin enterarse,
y el vacío aparecía recién al recargar. Le pasó dos veces al coordinador.

Ahora el aviso vive en el **armazón** (`#falla-guardado` en `index.html`, lo
llena `avisoDeGuardado()`): se ve en las diecisiete pantallas, **no se va al
cambiar de pantalla** —es un estado, no un cartelito de un momento— y trae
adentro el botón de exportar el respaldo, que es la única salida. Dice además
que lo cargado **sigue estando mientras no se cierre ni se recargue**, que es
el dato que decide qué hacer en ese minuto.

Y **no espera al próximo repintado**: `Store.alFallarElGuardado(fn)` avisa en
el momento en que el guardado falla, porque para cuando el coordinador cambie
de pantalla ya puede haber cargado veinte cosas. Cuando el almacenamiento
vuelve a aceptar, el cartel se va solo.

**El encabezado dice cuándo guardó esta copia, y en ámbar cuando no es de
hoy.** Es la otra mitad del problema de arriba, y la que explica las tres
veces que al coordinador «se le borró» lo de la mañana: **el almacenamiento
cambia con la dirección desde la que se abre el panel**. El archivo de
siempre, el mismo archivo bajado otra vez a Descargas y la página publicada
son tres cajas distintas que por dentro se ven idénticas —la misma pantalla,
el mismo padrón de la semilla—, así que abrir la que no era se lee como un
borrado y no como lo que es.

`guardar()` sella `estado.guardadoEl` y `selloDeGuardado()` (`app.js`) lo
escribe en `#sello-guardado`: «Guardado 11:42» si es de hoy, «Guardado el
03/10» y **en ámbar** si no. El ámbar no es decoración: es la única señal de
que lo que se está mirando no es donde se venía trabajando. Se mueve con cada
guardado vía `Store.onChange`, porque un sello que solo se actualiza al cambiar
de pantalla diría la hora de hace veinte minutos justo cuando se lo mira para
saber si lo de recién quedó.

La hora va en **24 horas**: `toLocaleTimeString('es-AR')` sin `hour12: false`
devuelve «06:09 p. m.».

El panel se guarda **copias automáticas** en el mismo navegador, en una clave
aparte del almacén: una por día al abrir y una antes de cada acción que
reemplaza todo el contenido. Están para el borrado por error, no para perder el
equipo —para eso está el respaldo `.json`—. Están documentadas en
`docs/respaldos.md`; **una acción nueva que reemplace todo el estado tiene que
llamar a `resguardar()` antes**.
