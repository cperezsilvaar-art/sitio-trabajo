# Ausencias con certificado

El panel guarda tres cosas distintas que se parecen y no hay que mezclar:

| Dónde | Qué es | Para qué |
|---|---|---|
| `c.novedades` | Los días que trajo la liquidación del mes | El ausentismo del período cerrado |
| `c.licencias` | Las especiales del art. 25 del CCT 414/05 | Controlar el tope anual de estudio, matrimonio, etc. |
| `c.ausencias` | **La persona que hoy no está** | Saber a quién esperar y hasta cuándo |

## Por qué no hay horas extras en Presentismo

Se sacaron de la carga diaria. La compañía no tiene reloj de fichadas: el dato
depende de lo que diga cada Gerente de Tienda, y nadie va a llamar a doce
tiendas todas las mañanas para preguntar por las horas extras. Pedir un dato que
no se va a poder cargar solo ensucia el tablero y deja un KPI en cero que parece
un problema y es un vacío.

El motor las sigue calculando: el día que haya sistema de fichadas, el campo
vuelve y las cuentas ya están. Mientras tanto, las horas extras siguen llegando
por el libro de novedades a la **estadística mensual**, que es donde el dato sí
existe.

Lo que sí se puede llevar día a día es el **ausentismo**, y eso es lo que ocupó
ese lugar.

## Cómo se carga

**Presentismo → Ausencias con certificado.** Se elige a la persona y se anota la fecha
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
