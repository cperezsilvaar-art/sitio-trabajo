# Cesiones, modificaciones y bajas

Tres cosas le pasan a una persona además de trabajar: se va, se muda de tienda o
le cambia el puesto. Las tres se cargan en **su ficha**, dentro de la sucursal, y
se leen juntas en **Cesiones y bajas** (`#/movimientos`).

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

Una baja cargada por error se deshace con **Deshacer**, y la persona vuelve a su
plantel.

## Cesión de contrato

Botón **Cesión de contrato**. Muestra la sucursal actual y pide la **nueva
sucursal destino**, la **vigencia** y **observaciones** —la nota del empleado, la
conformidad del gerente que lo recibe, lo que corresponda—.

Queda **pendiente de autorizar**. Al autorizarla:

- si la vigencia ya llegó, la persona pasa al plantel de la tienda nueva;
- si es futura, queda **autorizada** y se aplica sola el día que corresponde,
  al abrir el panel. Antes de ese día sigue figurando en su tienda actual, que
  es donde realmente está.

El panel calcula además **qué tienda absorbe el costo del mes**, con la regla del
procedimiento de Empleos: del 1 al 15 lo paga la tienda de destino, del 16 en
adelante la de origen (`tiendaQueAbsorbeElCosto()`).

## Modificación

Botón **Modificación**, para el cambio de puesto o de jornada. Pide el cargo
nuevo, la jornada nueva, la vigencia y observaciones. Funciona igual que la
cesión: pendiente → autorizada → aplicada, y al aplicarse cambia el cargo, la
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
