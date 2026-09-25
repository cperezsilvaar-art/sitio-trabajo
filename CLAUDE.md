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
  `ausencias`, `desarrollo`, `indicadores`, `casos`, `checklist`, `reclamos`,
  `agenda`, `asistente`, `diario`, `acceso`, `store`, `reporte`, `app`.
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

**El ausentismo se ve en los tres lugares donde se lo busca**, y los tres salen
del **mismo** cálculo: `ausentismoDe()` (`indicadores.js`) es un buscador sobre
`participacionDeAusencias()`, no una cuenta nueva. Dos funciones que cuentan lo
mismo dan números distintos el día que una cambia, y acá los tres niveles se
leen uno al lado del otro. Están en *Panel → Indicadores* (el área, con el
desglose), en `#/sucursal/<id>` (la tienda contra el área, arriba de los atajos)
y en la ficha de cada persona (sus días, su tasa, qué parte de los de su tienda
es, y la tasa de su tienda y la del área para poder leerla contra algo).

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
hace que el número se pueda defender. Los días se reparten por mes calendario,
igual que `ausenciasPorMes()` en la ficha.

**El plantel es el de hoy en todos los meses**, y la pantalla lo dice: el panel
guarda la foto actual y no la de cada cierre, así que la tasa de un mes viejo se
calcula contra la dotación de hoy. Es la misma aproximación anunciada que la
dotación media de la rotación.

**El historial va en la ficha de la persona**, no en la de la sucursal: vive en
`c.ausencias`, así que la acompaña cuando se muda de tienda. `ausenciasPorMes()`
lo reparte por mes calendario —del 25/08 al 05/09 son siete días de agosto y
cinco de septiembre, no doce de agosto— y no cuenta lo que todavía no pasó ni el
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
del 9-box y costo sobre venta—: ya viven donde se cargan, en la visita y en la
estadística del mes, y traerlos sería el sexto lugar con los mismos números.
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
**Antes de publicar, verificar que no quedó ningún nombre** buscándolos en el
HTML armado; que un campo esté vacío no alcanza si el nombre sigue tres líneas
más arriba, en un comentario.

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

El panel se guarda **copias automáticas** en el mismo navegador, en una clave
aparte del almacén: una por día al abrir y una antes de cada acción que
reemplaza todo el contenido. Están para el borrado por error, no para perder el
equipo —para eso está el respaldo `.json`—. Están documentadas en
`docs/respaldos.md`; **una acción nueva que reemplace todo el estado tiene que
llamar a `resguardar()` antes**.
