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
registradas**, arriba de *Ausencias mes a mes*.

Son dos bloques distintos y conviene no confundirlos:

| Bloque | De dónde sale | Qué contesta |
|---|---|---|
| **Licencias y ausencias registradas** | `c.ausencias`, lo que cargás en Presentismo | Qué licencias tuvo, cuándo y si trajo el papel |
| **Ausencias mes a mes** | `c.novedades`, el libro de liquidación | Qué días pagó la liquidación de cada mes |

El primero es lo que sabés **hoy**; el segundo es lo que quedó **liquidado**. Que
no coincidan es información, no un error: una licencia de este mes se liquida el
mes que viene.

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

**Por eso el panel no muestra un porcentaje de ausentismo sobre días.** Un
porcentaje calculado sobre el 45% de los certificados no es un porcentaje bajo:
es un porcentaje falso, y va a una reunión con Operaciones como si fuera el del
área. Lo que se muestra es:

- **eventos**, que están completos y por eso permiten comparar tiendas y
  personas con exactitud;
- **días conocidos**, diciendo siempre sobre cuántos certificados se saben.

Una ausencia sin duración **se guarda igual**, con `sinDuracion: true`: que la
persona faltó es un hecho, y cuántos días faltó es otro dato.

### Cómo empareja

Por **CUIL**, que es lo único unívoco. Excel guarda el CUIL como número y al
exportarlo le deja un `.0` que se lee como un dígito de más:
`cuilDelFormulario()` lo saca. El nombre es el respaldo y solo vale si no hay
ambigüedad —el formulario lo escribe a mano y aparecen «luciana ortellano» y
«luiciana ortellano» para la misma persona—.

**No duplica**: la misma persona, el mismo día y el mismo motivo entra una sola
vez, así que se puede volver a pegar la planilla entera cada mes.

### Qué cuenta como ausentismo y qué no

`TIPOS_FORMULARIO` mapea lo que el formulario ofrece a los motivos del panel.
**Las vacaciones se importan pero no cuentan**: son tiempo planificado y meterlas
adentro infla el número con algo que no es un problema. La maternidad y el
fallecimiento tampoco. Los apercibimientos no son una ausencia y se saltean.

### De dónde sale el ausentismo

`participacionDeAusencias()` (`indicadores.js`) lo reparte en tres niveles: el
área, cada tienda con su participación sobre el total, y adentro de cada tienda
cada persona con su participación sobre esa tienda. Se cuenta en eventos
—completos— y no en días —incompletos—. Se ve en *Panel → Indicadores*, y el
historial de cada persona está en su ficha (`fichaAusenciasRegistradas`).
