# Ausencias con certificado

El panel guarda tres cosas distintas que se parecen y no hay que mezclar:

| Dónde | Qué es | Para qué |
|---|---|---|
| `c.novedades` | Los días que trajo la liquidación del mes | El ausentismo del período cerrado |
| `c.licencias` | Las especiales del art. 25 del CCT 414/05 | Controlar el tope anual de estudio, matrimonio, etc. |
| `c.ausencias` | **La persona que hoy no está** | Saber a quién esperar y hasta cuándo |

## Por qué Presentismo no tiene nada más que esto

Primero se sacaron las **horas extras** de la carga diaria. La compañía no tiene
reloj de fichadas: el dato depende de lo que diga cada Gerente de Tienda, y nadie
va a llamar a doce tiendas todas las mañanas para preguntar. Pedir un dato que no
se va a poder cargar solo ensucia el tablero y deja un KPI en cero que parece un
problema y es un vacío.

Después se cayó el resto por el mismo motivo. La pantalla tenía una ficha por
sucursal para anotar a mano los planificados, el mínimo para abrir, los ausentes
y las novedades, todas las mañanas, tienda por tienda. **Nadie la completaba**, y
sobre esa carga se apoyaban el tablero de KPIs, las alertas, las acciones para
mañana y el reporte diario. Se eliminó entera en septiembre de 2026: lo que queda
es lo único que el coordinador sí lleva, **las ausencias**.

El motor de horas extras sigue calculando: el día que haya sistema de fichadas, el
campo vuelve y las cuentas ya están. Mientras tanto siguen llegando por el libro
de novedades a la **estadística mensual**, que es donde el dato sí existe.

## El historial queda en la ficha de la persona

Las ausencias viven en **`c.ausencias`**, o sea que ya cuelgan del colaborador y
no de la sucursal: si se muda de tienda, el historial se muda con él. Lo que
faltaba era mostrárselo, y desde septiembre de 2026 está en su perfil —el que se
abre desde *Nómina* o desde el organigrama—, en **Licencias y ausencias
registradas**.

Arriba del historial va **su ausentismo**: cuántos días faltó en los últimos tres
meses, su tasa, qué parte de los días de ausencia de su tienda representa, y la
tasa de su tienda contra la del área. Un 2% suelto no dice nada; contra el 0,5%
de su tienda dice bastante.

Abajo van los otros dos bloques de ausencias, **los tres juntos y en este
orden** —estaban separados por *Sanciones* y por *Desarrollo*, y con tres tablas
parecidas repartidas por la ficha era imposible saber cuál contestaba qué—:

| Bloque | De dónde sale | Qué contesta |
|---|---|---|
| **Licencias y ausencias registradas** | `c.ausencias`, lo que cargás en Presentismo | Qué licencias tuvo, cuándo y si trajo el papel |
| **Licencias especiales del art. 25** | `c.licencias` + la liquidación | Cuántos días de cada licencia del CCT le quedan |
| **Ausencias que liquidó Nómina, mes a mes** | `c.novedades`, el libro de liquidación | Qué días pagó la liquidación de cada mes |

El primero es lo que sabés **hoy**; el último es lo que quedó **liquidado**. Que
no coincidan es información, no un error: una licencia de este mes se liquida el
mes que viene, y por eso el título dice de dónde sale cada uno.

### Cómo se reparten los días

`ausenciasPorMes(colaborador, hoy)` corta cada ausencia por mes calendario. Una
licencia **del 25 de agosto al 5 de septiembre son siete días de agosto y cinco
de septiembre**, no doce de agosto: imputarla entera al mes en que arrancó infla
un mes y vacía el otro, que es justo lo que se mira cuando se compara contra la
liquidación.

Dos reglas más, las dos por el mismo motivo —el historial cuenta lo que pasó, no
lo que va a pasar—:

- **Lo que todavía no ocurrió no suma.** Un certificado hasta el 30 no son días
  de ausencia el 16. Se cuenta hasta hoy, y el total crece solo.
- **El día de la reincorporación no cuenta**, porque ese día la persona trabajó.
  Del 25/08 al 05/09 con alta el 06/09 son doce días, no trece.

Los días se cuentan **con los dos extremos**: una licencia que empieza hoy y
termina hoy es un día, no cero. `diasDeAusencia()` y el texto de
`estadoDeAusencia()` usan la misma cuenta, para que la columna y la situación no
digan números distintos uno al lado del otro.

Desde la ficha, **`#/diario/<colaboradorId>`** abre Presentismo con esa persona
ya elegida y el formulario desplegado: el alta sigue estando en un solo lugar,
pero no hay que buscarla entre 139 nombres.

## Pendiente de justificar

Una ausencia sin certificado presentado queda en `pendienteJustificar`, **sea cual
sea la licencia** que la persona invoque. Va antes que cualquier otra lectura de
`estadoDeAusencia()` porque es la única que cambia lo que hay que hacer hoy:
reclamar el papel. Encabeza los avisos y la fila lo muestra con una marca que se
puede tildar sin abrir la ficha.

La ausencia **se registra igual**, sin certificado: lo que no se anota el día que
pasa, se pierde. Marcar el certificado la mueve al circuito normal —fecha de alta,
cuántos días faltan, cuándo se agota la licencia paga—.

## Cómo se carga

**Presentismo → Ausencias del área.** Se elige a la persona y se anota la fecha
de inicio y la de alta que dice el certificado. La fecha de alta puede faltar
—muchos certificados no la traen— y en ese caso el panel avisa igual: una
ausencia sin fecha de vuelta es la que más se olvida.

El formulario trae solo. Del legajo saca **desde cuándo trabaja** y **si tiene
cargas de familia**, y con eso calcula los plazos.

## Los plazos de la ley

`plazosEnfermedad()`, en `assets/js/ausencias.js`, aplica la **LCT**:

**Art. 208 — licencia paga por enfermedad o accidente inculpable:**

| Antigüedad | Sin cargas de familia | Con cargas de familia |
|---|---|---|
| Menos de 5 años | 3 meses | 6 meses |
| 5 años o más | 6 meses | 12 meses |

**Art. 211 — reserva del puesto:** vencida la licencia paga, si la persona
todavía no puede volver, el puesto se le conserva **un año más**, sin goce de
sueldo.

El panel muestra las dos fechas: cuándo se agota el sueldo y cuándo se agota la
reserva.

**Es una orientación sobre la ley general, no un dictamen.** Solo se aplica a lo
que la ley trata como enfermedad inculpable: el accidente de trabajo lo cubre la
ART y la maternidad tiene su propio régimen, y por eso esos motivos no muestran
plazos. Las recidivas, la excedencia y los casos de larga duración no se
resuelven con una tabla.

Un detalle que costó un error: el campo de cargas de familia tiene tres estados
—sin definir, sí, no— y llega como texto. Un `!!c.cargasFamilia` da verdadero
para la cadena `'no'`, que es justo el caso en que los plazos **no** se
duplican. Para eso está `tieneCargasFamilia()`.

## Las alertas

`alertasDeAusencias()` recorre el padrón y devuelve lo que pide una acción, en
este orden: la que **venció**, la que **vence hoy**, la que **no tiene fecha de
alta** y la que vence en los próximos tres días.

Aparecen en dos lugares: en el **panel general**, porque la decisión es de
mañana a la mañana —o la persona vuelve, o hay que cubrir el turno— y enterarse
tarde es enterarse con la tienda ya abierta; y en **Presentismo**, con el botón para
resolverlas ahí mismo.

Al volver se marca **Se reincorporó**. Si en cambio trae otro certificado, se
extiende la misma ausencia: el vínculo con el art. 208 se cuenta desde el primer
día, no desde el último parte.

**La que venció no es la que le falta el papel.** El papel que falta es
`pendienteJustificar`, que se decide antes y es otro estado. En `vencida` el
certificado está presentado: lo que pasó es que su fecha de alta quedó atrás y
nadie marcó la vuelta. Decía «el certificado venció hace 2 días» al lado del
chip verde de *presentado*, y las dos cosas juntas se leen como una
contradicción —«si ya lo trajo y lo justifiqué, ¿qué venció?»—. Ahora dice
**«Debería haber vuelto el 29/09/2026 · 2 días sin marcar la vuelta»**, que es
además lo que hay que hacer: marcar la reincorporación o cargar el certificado
nuevo.

## Traer las ausencias del formulario de recepción

Los gerentes cargan las ausencias en un formulario de Google —*Recepción de
ausencias por certificados, apercibimientos y vacaciones*— y la planilla de
respuestas se pega al pie de `#/diario`, igual que la nómina. No hay conector:
el archivo lleva **patologías** adentro y eso vive solo en el navegador.

### Lo que la planilla no puede dar

**No fue pensada para medir.** El certificado se carga en un solo campo de texto
libre que pide patología, fecha de inicio y días de reposo, y en la práctica:

| De 148 certificados del Área 3 | |
|---|---|
| Traen duración (días u horas) | **66 (45%)** |
| Traen fecha de inicio | 67 (45%) |
| Traen las dos cosas | 54 (36%) |
| Solo la patología | **82 (55%)** |

La mitad escribe la duración en **horas** —«(24) HORAS»— y no en días, así que
`leerCertificado()` lee las dos formas y convierte: 24 horas es un día.

### El certificado sin duración se toma como un día

La primera versión no mostraba ningún porcentaje sobre días, justamente por la
tabla de arriba: calculado sobre el 45% de los certificados no sería un
porcentaje bajo, sería uno falso. Pero tampoco servía: el coordinador necesita
el ausentismo de los últimos tres meses y nómina todavía no tiene el documento
de licencias, así que la planilla es lo único que hay.

La salida la eligió él: **el certificado que no dice cuánto dura se toma como un
día** (`DIAS_SIN_DURACION` en `ausencias.js`). No es una lectura del papel, es un
supuesto, y sus propios datos lo respaldan:

| De los 66 certificados que sí traen duración | |
|---|---|
| Duran **un día** | **30 (45%)** |
| Duran uno o dos días | 54 (82%) |
| Duran más de una semana | 4 |

Un día es la duración más frecuente y la más conservadora de las plausibles: si
el supuesto se equivoca, subestima el ausentismo en vez de inflarlo.

**El supuesto queda marcado para siempre.** La ausencia se guarda con
`diasSupuestos: true`, y de ahí en adelante ningún número lo pierde:
`participacionDeAusencias()` devuelve `diasSupuestos` y `parteSupuesta` al lado
de los días totales, y la pantalla lo escribe en la misma oración que el
porcentaje —«39 días de ausencia de 12 personas, sobre un plantel de 133 en 3
meses. 33% de esos días son supuestos: 13 de los 22 certificados no decían
cuánto duraban y se tomaron como un día»—. Eso es lo que hace que el número se
pueda llevar a una reunión: no que sea exacto, sino que diga de qué está hecho.

Una ausencia que se importó **antes** de tomar el supuesto quedó sin `hasta`.
Volver a pegar la planilla **la completa** en vez de contarla como repetida, así
no hay que borrar nada para recuperar los días.

### Lo importado entra cerrado si ya terminó

La planilla arranca en marzo de 2025: es un **registro de lo que ya pasó**, no
una carga en vivo. Una licencia cuyo certificado terminó antes de hoy está
terminada —la persona volvió hace meses—, así que entra con `reincorporado`.

Sin eso las 125 entraban abiertas y el Panel anunciaba **125 ausentes**, cada una
«vencida hace 400 días». No se inventa la fecha de reincorporación:
`diasDeAusencia()` con `reincorporado` y sin fecha se queda con `hasta`, que es
exactamente lo que dice el papel, así que el ausentismo no cambia. La que sigue
abierta hoy entra abierta y aparece en el Panel, que es su lugar.

### Lo que se pega es la planilla entera

La planilla de respuestas es de **toda la empresa**: 734 filas de 28 tiendas
desde marzo de 2025, de las que **193 son del Área 3**. No hay que filtrarla
antes —se pega completa y el panel se queda con lo suyo—, y eso cambia cómo
tiene que emparejar.

### Cómo empareja

**Primero el número.** `documentoDelFormulario()` devuelve CUIL y DNI, porque el
formulario pide el CUIL y una parte de los gerentes escribe el DNI:

| De las 193 filas del Área 3 | |
|---|---|
| Traen un CUIL de 11 dígitos | 146 |
| Traen un DNI de 7 u 8 | **47** |

El DNI identifica igual de bien y el padrón lo tiene desde que se pega la nómina,
así que leerlo en vez de descartarlo **ubica 22 ausencias** que antes dependían de
que el nombre estuviera bien escrito. Las dos lecturas se prueban con y sin el
último dígito: Excel guarda el número como número y al exportarlo le deja un `.0`
que queda como un cero de más al final, y un DNI terminado en 0 es perfectamente
posible.

**Después el nombre, y solo si no hay ambigüedad.** El formulario lo escribe a
mano y aparecen «luciana ortellano» y «luiciana ortellano» para la misma persona.

**Fuera de las tiendas del área, el nombre no alcanza.** Con las 734 filas
adentro, dos palabras iguales dejan de ser una identidad: «Martinez Maria Eugenia»
de Walker comparte MARIA y EUGENIA con «PEREZ, MARIA EUGENIA» de Scalabrini y no
es la misma persona. Una fila cuya tienda no es del área **entra solo si el número
coincide**. Eso no pierde a nadie que importe: quien se mudó al área trae su CUIL
en las filas de la tienda anterior —Airoldi, Briceño, Díaz, Miglio— y esas siguen
entrando, que es justo lo que hay que conservar, porque el historial acompaña a la
persona y no a la tienda.

### Cuando el número y el nombre se contradicen

El número manda. Un nombre ambiguo o mal escrito simplemente pierde.

Lo que no se resuelve solo es cuando **los dos apuntan, cada uno sin ninguna duda,
a personas distintas**: «Luis Toro» con el número de Juan Gabriel Luna. Eso es un
error de carga del formulario, y hay cuatro en el archivo. La fila **no entra** y
se nombra en `enConflicto`, porque adivinar cuál de los dos vale le cuelga un
certificado a alguien que no faltó —y ese alguien aparece después con ausentismo
en una reunión con Operaciones—. Se resuelve con el gerente, no en el panel.

### Lo que el resultado informa

El aviso separa tres cosas que antes iban en un solo número:

- **`otrasAreas`** (521): filas de tiendas de otras áreas. Es ruido esperable y el
  aviso lo dice sin alarmar.
- **`sinPersona`** (70): filas **de sus tiendas** que no caen en nadie del padrón
  de hoy. Van con nombre y son la lista que importa. Casi siempre es gente que ya
  se fue: la planilla arranca en marzo de 2025 y el padrón es el de hoy.
- **`enConflicto`** (4): las de arriba.

Las dos primeras iban juntas en un solo «615 no se pudieron atribuir», y el número
que pedía algo quedaba tapado por el que no pedía nada. Es la misma regla que
esconde los contadores en cero.

**No duplica**: la misma persona, el mismo día y el mismo motivo entra una sola
vez, así que se puede volver a pegar la planilla entera cada mes.

### Qué cuenta como ausentismo y qué no

`TIPOS_FORMULARIO` mapea lo que el formulario ofrece a los motivos del panel.
**Las vacaciones se importan pero no cuentan**: son tiempo planificado y meterlas
adentro infla el número con algo que no es un problema. La maternidad y el
fallecimiento tampoco. Los apercibimientos no son una ausencia y se saltean.

La regla es la misma por los cuatro caminos, y antes no lo era. Lo que decide
por **motivo** es `motivoSumaAusentismo()` (`ausencias.js`): vacaciones,
maternidad y paternidad no suman. Lo que decide por **concepto** es la marca
`cuentaAusentismo` que traen el libro —con `cuentaComoAusentismo()`— y el
formulario —con `TIPOS_FORMULARIO`—, y es la que saca el fallecimiento, el
matrimonio y el nacimiento, que entran como «otra» y no se distinguen por el
motivo. `diasDeAusenciaEntre()` pregunta las dos cosas.

Tenerlo por motivo en un solo lugar arregló un agujero: el parte de las tiendas
y el alta a mano hacían su propia cuenta —`motivo !== 'vacaciones'`— así que
**la misma maternidad sumaba o no sumaba al ausentismo según por dónde se
hubiera cargado**. Es la misma clase de contradicción que las tres cuentas de
ausentismo que daban 23, 1 y 3 días del mismo mes.

### De dónde sale el ausentismo

`participacionDeAusencias()` (`indicadores.js`) lo reparte en tres niveles: el
área, cada tienda con su participación sobre el total, y adentro de cada tienda
cada persona con su participación sobre esa tienda. Los tres van **en días**, y
los tres traen además su **tasa**: días de ausencia sobre plantel por días de la
ventana.

### La otra entrada: el parte de las tiendas

El formulario de recepción es el registro de lo que fue pasando y **no dice
hasta cuándo**. El parte que mandan los gerentes dice *quién no está hoy en mi
tienda y hasta cuándo*, y como trae la fecha de fin escrita, **lo que entra por
ahí no lleva ningún supuesto**: `diasSupuestos` queda en falso y esos días están
medidos. `importarParteDeAusentes()` (`store.js`) lee las columnas de
`COLUMNAS_PARTE_AUSENTES` y vive al pie de `#/diario`, al lado del otro, diciendo
cuál sirve para qué.

Desde octubre de 2026 el parte **se llena con un formulario de Google** en vez
de una planilla armada a mano: `docs/formulario-presentismo.md` tiene las
preguntas, con el texto exacto de cada encabezado y por qué —`COLUMNAS_PARTE_AUSENTES`
ubica cada columna por lo que dice su encabezado, y una pregunta «Tu nombre»
antes que la del colaborador se llevaría el nombre del gerente al lugar
equivocado—. **No es una entrada nueva**: es la misma, y lo que cambia es que
deja de depender de que alguien se acuerde de mandarla.

### La tercera entrada: el libro de novedades

El libro que devuelve la liquidación **registra licencias**, no solo novedades.
`registrarLicenciasDelLibro()` (`store.js`) crea la ausencia de cada concepto
según `MOTIVO_DE_NOVEDAD`. Sin eso el ausentismo por sucursal se quedaba en cero
con el mes entero cargado, porque se calcula sobre `c.ausencias` y el libro solo
llenaba `c.novedades`.

**Los días están medidos, las fechas no.** El libro dice cuántos días pagó, no
cuáles: la licencia se ubica al principio del mes y queda con
`fechasSupuestas: true` para siempre. Es el mismo trato que `diasSupuestos` le
da al certificado sin duración.

**Una licencia con fechas reales le gana.** Si ya hay una del mismo motivo que
toca el mes, la del libro no entra: los días no se cuentan dos veces y se puede
volver a pegar el libro todos los meses.

**Las vacaciones no se registran** —no están en `MOTIVO_DE_NOVEDAD`— y la
maternidad, el matrimonio, el nacimiento y el fallecimiento sí, pero con
`cuentaAusentismo: false`, que sale de `cuentaComoAusentismo()`.

### Una sola cuenta de días

`diasDeAusenciaEntre(ausencia, desde, hasta)` (`ausencias.js`) devuelve **los días
de esa licencia que caen adentro de la ventana**, y es la única cuenta de días de
ausencia del panel. `diasDeAusencia()` contesta otra pregunta —cuánto duró la
licencia— y se sigue usando para el historial de la persona.

Antes había tres cuentas. Con el mismo mes, la misma ventana y el mismo padrón,
`serieMensualDeAusentismo()` daba **23 días**, `participacionDeAusencias()`
**1** y `ausentismoDelArea()` **3**, o sea 0,58%, 0,03% y 0,08% en tres tarjetas
del mismo tablero. Las dos últimas exigían que la licencia *empezara* adentro de
la ventana —así que la que venía de agosto y seguía abierta no existía— y después
la contaban **entera**, incluidos los días de antes del corte; la del Panel,
además, sumaba las vacaciones y la maternidad, que no son ausentismo.

Las exclusiones viven también ahí: vacaciones, `cuentaAusentismo: false`
—maternidad, fallecimiento— y lo que no pasó todavía. Una cuenta nueva de días de
ausencia no se escribe: se llama a `diasDeAusenciaEntre()`.

La tasa de cada tienda se calcula **sobre su propio plantel**, no sobre el del
área. Una tienda de seis personas con cuatro días de ausencia y una de veinte
con los mismos cuatro días aportan lo mismo al total del área y no tienen el
mismo problema; la participación contesta «de dónde salen los días» y la tasa
contesta «cuál está peor».

Repartir por días pero ordenar por eventos —que es como quedó la primera
versión— daba dos respuestas distintas a la misma pregunta, una al lado de la
otra. Ahora las dos escalas usan días.

Se ve en **tres lugares**, todos sobre el mismo cálculo: *Panel → Indicadores*
(el área, con el desglose por tienda y por persona), `#/sucursal/<id>` (la tienda
contra el área) y la ficha de cada persona (`fichaAusenciasRegistradas`).
`ausentismoDe(estado, colaboradorId, sucursalId, hasta)` es el buscador que usan
los dos últimos: **no es una cuenta nueva**, porque dos funciones que cuentan lo
mismo dan números distintos el día que una cambia.

### En la página de la tienda

La tira de KPIs de `#/sucursal/<id>` abre con **Ausentismo del mes**: el que sale
de las licencias que se van cargando, así que se mueve en el momento en que se
carga una. El de la estadística del cierre quedó al lado con su propio nombre,
**Ausentismo liquidado**. Antes había uno solo —el de la liquidación—, que decía
«—» hasta que el mes cerraba: cargar una licencia no movía nada y la pantalla
parecía no estar mirando. Dos fuentes con el mismo rótulo es la forma más rápida
de que alguien lleve el número de una a una reunión creyendo que es el de la otra.

Abajo de la tira va el mismo bloque mes a mes del área, acotado a la tienda:
`serieMensualDeAusentismo(estado, hasta, sucursalId)` toma el id como tercer
argumento opcional y `bloqueSerieAusentismo(e, sucursalId)` lo dibuja en los dos
lugares. Es un **filtro sobre la misma cuenta**, no una función aparte, y la tasa
de la tienda se divide por su propio plantel. Ahí también se lee la tienda contra
el área —«esta tienda acumula 1,1% y el área, 0,8%»— y de dónde sale el número de
arriba: el mes en curso está marcado, con sus días y cuántos son supuestos.

## Quién no está hoy, en el Panel

`ausenciasEnCurso()` devuelve toda ausencia empezada y sin cerrar, con su estado,
y el Panel abre con esa lista. Es más ancha que `ausentesHoy()` a propósito: el
que ya debería haber vuelto y nadie marcó la reincorporación tampoco está en la
tienda, y es justamente el caso que hay que resolver.

Antes ahí había un aviso de *Certificados que vencen* que listaba solo lo
urgente. La pregunta de la mañana no es «qué vence» sino «quién me falta y desde
cuándo»: lo urgente es una columna de esa lista, no una lista aparte.

Con el historial cargado y nadie ausente, el bloque dice **«hoy no falta nadie»**
en vez de desaparecer —un cero es una respuesta—. Sin ninguna ausencia cargada sí
desaparece, como los contadores del menú.

## Cargar dos veces la misma no la duplica

`agregarAusencia()` no miraba nada: volver a cargar la ausencia de alguien
—porque se estiró, porque no te acordabas si ya la habías puesto— creaba una
segunda. La persona aparecía dos veces en Presentismo y **sus días se contaban
dos veces en el ausentismo**.

El importador del parte de las tiendas ya resolvía esto desde el principio. La
regla salió a `ausenciaQueSeSolapa()` y ahora la usan los dos, por lo mismo que
`buscadorDePadron()` es uno solo: la misma licencia es mismo motivo y fechas que
se tocan.

**Otro motivo en las mismas fechas sí es otra licencia.**

**La comparación mira también las cerradas, y eso es lo que faltaba.** Pedía
que la licencia estuviera abierta, y lo que entra por el formulario de
recepción entra **cerrado si ya terminó** —es un registro de lo que pasó—: la
de un día que el formulario supuso quedaba invisible para la comparación, así
que el parte de la tienda, que traía las fechas de verdad, creaba una segunda
licencia. En la ficha de Falavigna se veían las dos: 17/07 → 17/07, «se
reincorporó», y 17/07 → 29/09, 75 días. La misma licencia contada dos veces.

Una licencia cerrada que se estira **se reabre**, y queda anotado qué
reincorporación decía antes (`reincorporacionAnterior`): si no, la ficha
quedaría diciendo que la persona volvió el 18/07 arriba de una licencia que
termina el 29/09.

**Cargarla sin fecha de alta también la reabre**, porque decir que no hay alta
es decir que todavía no volvió. Ahí el `hasta` que estaba **no se borra**: se
conserva y la licencia queda en rojo pidiendo la vuelta. Tirar una fecha que
alguien midió para poner un vacío es peor que preguntar.

Cada cosa que se corrige se nombra en el aviso, **la reincorporación sobre
todo**: es una marca que el coordinador puso a mano y que el panel acaba de
deshacer. Enterarse de eso al mes siguiente, mirando una ficha, es tarde.

**Volver y enfermarse de nuevo más tarde sí son dos licencias**, porque las
fechas no se tocan. Lo que se unifica es la misma ausencia cargada dos veces,
no dos ausencias parecidas.

La pantalla dice cuál de las tres cosas hizo:

| | |
|---|---|
| No había nada | «Ausencia registrada…» |
| Ya estaba, con las mismas fechas | «Esa ausencia ya estaba cargada desde el 20/09. No se duplicó.» |
| Ya estaba y el certificado se estiró | «Ya tenía una cargada desde el 20/09: se le corrigió el alta del 25/09 al 30/09 en vez de duplicarla.» |

Crear en silencio una y corregir en silencio otra se leen igual, y una de las
dos sería mentira. Lo que hizo se devuelve **afuera** de la licencia
—`{ ausencia, accion, hastaAnterior }`—: es lo que pasó en esa llamada, no un
campo de la licencia, y guardarlo la ensuciaría para siempre.

## Quitar una se hace desde donde se la ve

El botón *Quitar* vivía solo adentro del formulario de alta, así que para
borrar una había que apretar **+ Registrar ausencia**, bajar hasta *Ausencias
anteriores* y encontrarla entre varias iguales. Ahora está también en la fila
de la tabla de Presentismo, al lado de *Se reincorporó*.
