# Traspasos, modificaciones y bajas

Tres cosas le pasan a una persona además de trabajar: se va, se muda de tienda o
le cambia el puesto. Las tres se cargan en **su ficha**, dentro de la sucursal, y
se leen juntas en **Movimientos y bajas** (`#/movimientos`).

## Baja

Botón **Baja** en la ficha. Pide fecha, motivo y observaciones. El motivo sale de
`MOTIVOS_BAJA` en `catalogos.js`, agrupado en Renuncias, Despidos y Otros: son
los mismos motivos con los que después se arma la rotación del mes, para no
tener dos vocabularios distintos para lo mismo.

La persona **no se borra**: sale del plantel de piso —deja de contar en la
dotación y en el FTE— y pasa al **Listado de bajas**, donde su fila se abre y
muestra la ficha completa: sucursal, puesto, CUIL, fechas, antigüedad al irse,
jornada, sanciones y movimientos aplicados. Es lo que se mira cuando alguien
pregunta por una liquidación final o por qué se fue.

Una baja cargada por error se deshace desde dos lugares, porque el error se
descubre en cualquiera de los dos: en el **Listado de bajas** y en la propia
**sucursal**, que muestra sus bajas en una tabla abajo del organigrama con el
botón al lado. La persona vuelve a su plantel y el FTE vuelve al número que
tenía.

## El FTE se mueve solo

Dar de baja a alguien baja la **dotación de piso** de su tienda y la del área en
el momento, sin pasar por ninguna otra pantalla. Si la persona era de media
jornada, baja medio punto: Devoto pasa de 10,5 a 10,0 FTE cuando se va el
farmacéutico auxiliar de jornada parcial, y vuelve a 10,5 al deshacer la baja.

Ese número es el KPI **Dotación de piso**, que muestra el FTE adelante y las
personas abajo. No confundirlo con **FTE del mes cerrado**, que sale de la
estadística mensual y queda en `—` hasta que haya una visita cargada: son dos
preguntas distintas —con cuánta gente cuento hoy, y cuánta usé el mes pasado—.

## Traspaso de sucursal

Botón **Traspaso de sucursal**. Muestra la sucursal actual y pide la **tienda a
la que va**, la **vigencia** y **observaciones** —la nota del empleado, la
conformidad del gerente que lo recibe, lo que corresponda—.

Se llamaba *cesión de contrato*, que es el instrumento legal y no la cosa que
pasa: lo que pasa es que la persona se muda de tienda. La cesión aplica solo
cuando además **cambia el empleador**, y por eso ahora es una pregunta adentro
del traspaso y no el nombre del movimiento.

### ¿Aplica cesión de contrato?

El formulario lo pregunta y **no guarda hasta que se contesta**: la diferencia
entre un movimiento interno y uno que necesita instrumento legal es de las que
se descubren tarde. Queda en `m.conCesion` —`true`, `false`, o `null` mientras
nadie contestó—.

Al elegir la tienda de destino el panel **sugiere y precarga** la respuesta
comparando la `razonSocial` de las dos tiendas: si son la misma, mismo empleador
y suele ser un movimiento interno; si son distintas, cambia el empleador y suele
instrumentarse la cesión. En el Área 3 conviven doce razones sociales, así que la
pregunta no es retórica: Botánico, Parque Chacabuco y Villa Devoto son FARMATODO
ARGENTINA S.A., y Devoto es MA TECH S.R.L.

**Sugiere, no decide.** Si a una de las dos tiendas le falta la razón social el
panel lo dice y no propone nada, y la respuesta siempre se puede cambiar: el
padrón puede estar incompleto y el que sabe si hay que instrumentarla es el
coordinador.

Los movimientos guardados antes de este cambio tienen `tipo: 'cesion'`.
`esTraspaso()` los sigue tratando como traspasos —se aplican igual y mueven a la
persona— y se leen como *con cesión de contrato*, que es lo que eran.

Queda **pendiente de autorizar**. Al autorizarlo:

- si la vigencia ya llegó, la persona pasa al plantel de la tienda nueva;
- si es futura, queda **autorizada** y se aplica sola el día que corresponde,
  al abrir el panel. Antes de ese día sigue figurando en su tienda actual, que
  es donde realmente está.

El panel calcula además **qué tienda absorbe el costo del mes**, con la regla del
procedimiento de Empleos: del 1 al 15 lo paga la tienda de destino, del 16 en
adelante la de origen (`tiendaQueAbsorbeElCosto()`).

## Modificación

Botón **Modificación**, para el cambio de puesto o de jornada. Pide el cargo
nuevo, la jornada nueva, la vigencia y observaciones. Funciona igual que el
traspaso: pendiente → autorizada → aplicada, y al aplicarse cambia el cargo, la
posición del organigrama y la jornada.

El panel es el registro del área, **no reemplaza la carga en RyR Online**, que
tiene sus propios niveles de aprobación (Regional de RRHH y de Operaciones,
Empleos HO, Dirección de RRHH) y su fecha de corte: antes del 20 de cada mes para
que rija desde el mes siguiente.

## Dónde vive cada cosa

`c.baja` y `c.movimientos[]` cuelgan de la **persona**, no de la sucursal: así el
historial la acompaña cuando se muda de tienda. Un movimiento ya aplicado no se
anula desde el panel — mover a alguien de vuelta es un movimiento nuevo, y queda
registrado como tal.

## La baja es un proceso, no un evento

La persona deja de venir el día de la baja y sale de la dotación en ese
momento: eso no espera a ningún trámite. Pero atrás quedan **cinco cosas que
hacer en cinco lugares distintos**, y el que se olvida aparece solo semanas
después —alguien que conserva accesos, un recibo que se liquida de más—.

`TRAMITES_BAJA` (`catalogos.js`), en el orden en que se hacen:

1. **Carta solicitada al estudio** — el telegrama o la carta documento.
2. **Notificación al empleado** — que quede notificada y firme.
3. **Envío de novedades y baja a Nómina** — lo último que se le pasa.
4. **Baja en PAC** — mientras siga activo ahí, conserva accesos.
5. **Baja en Sommer** — lo mismo.

No están enumerados en la pantalla a propósito: si uno se adelanta, no hay que
pelearse con el panel.

Viven en `c.baja.tramites`, cada uno con `hecho`, la `fecha` en que se tildó y
una `nota`. La nota es la mitad del valor: con quién se hizo, el número de
trámite. Sin eso, dos semanas después el tilde no dice nada. **Destildar no
borra la nota** — si alguien escribió «la pidió Ana el martes», esa frase sigue
valiendo aunque el trámite se reabra.

### Cerrar no es lo mismo que completar

`c.baja.cerradaEl` cierra el proceso y **es una decisión del coordinador**, no
la consecuencia automática de tildar los cinco: a veces un trámite no aplica a
esa baja. `estadoTramitesBaja()` devuelve `completa` y `cerrada` por separado.

La pantalla **nombra lo que falta antes de dejar cerrar, pero no lo impide**.
Bloquearlo llevaría a tildar cualquier cosa para poder seguir, que es peor que
un check list incompleto pero sincero. Y se puede reabrir.

### Dónde se ve

- En la **ficha de la persona**, apenas se registra la baja.
- En **`#/movimientos/bajas`**: una columna con *2 de 5* o *cerrada*, y el check
  list entero al abrir la fila.
- En el **contador de _Movimientos y bajas_** del menú, junto con los traspasos
  y las modificaciones sin aplicar: las dos cosas son trabajo pendiente en esa
  pantalla.
