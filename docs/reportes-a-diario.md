# Presentismo del día y venta del día

La estadística mensual mide el mes que cerró. Este módulo mide **el día que
pasó**, que es la única escala en la que todavía se puede hacer algo: si hoy
faltaron tres personas en una tienda de ocho, la decisión es de hoy a la mañana.

Se carga con el dato del día anterior y se manda a Operaciones **antes de la
apertura**.

## Dos pantallas, no una

Son **dos preguntas distintas** y desde septiembre de 2026 viven separadas, a
pedido del coordinador:

| Pantalla | Ruta | Pregunta |
|---|---|---|
| **Presentismo** | `#/diario` (también `#/presentismo`) | ¿Quién no está hoy y desde cuándo? |
| **Ventas** | `#/operacion` (también `#/ventas`) | ¿Cuánto volumen hubo que atender? |

Lo que las separa no es una preferencia de orden: **el que las recibe hace cosas
distintas con cada una**. El presentismo se resuelve moviendo gente antes de la
apertura; la venta se lee después, para saber cuánto pesó el hueco.

El único cruce que sobrevive es la **venta por persona presente**, y vive en la
pantalla de Ventas.

## Se eliminó la carga manual del día

Presentismo tenía una ficha por sucursal donde se anotaban a mano, todas las
mañanas, los planificados, el mínimo para abrir, los ausentes del día y las
novedades. **Nadie la completaba**, y con razón: la compañía no tiene reloj de
fichadas, así que el dato dependía de que doce gerentes lo mandaran y de que el
coordinador lo transcribiera antes de la apertura. Los indicadores quedaban en
cero y el panel parecía roto cuando lo que faltaba era una carga imposible de
sostener.

Con ella se fueron el tablero de KPIs del día, las alertas, las acciones para
mañana y el **reporte diario de presentismo** que se armaba con esos datos
(`Reporte.textoDiario`). Quedó una sola cosa, que es la que el coordinador sí
lleva: **las ausencias**.

Lo que el motor necesitaba de esa carga ahora sale del padrón. `presentesDelPadron()`,
en `diario.js`, cuenta la gente con turno de una tienda —activa, que cubre turno—
menos quien tiene una ausencia abierta en esa fecha. Es lo que alimenta la venta
por persona presente, sin que nadie cargue nada.

Lo marcado como *«hay que avisarlo en la tienda»* en la agenda, que antes viajaba
en el reporte diario, pasó al **informe del check list**, que es el que
efectivamente se lleva a la tienda.

## Cómo se carga una ausencia

Una sola pantalla y un solo camino:

1. **Elegí a la persona** en el desplegable, agrupado por sucursal.
2. El panel completa solo **su sucursal, su fecha de ingreso, su antigüedad** y,
   con las cargas de familia, **lo que le corresponde por los arts. 208 y 211**.
3. Poné el **tipo de licencia**, el **desde** y, si el certificado lo dice, el
   **hasta**.
4. Marcá **«ya trajo el certificado»** solo cuando el papel esté.

**Sin esa marca la ausencia queda `pendiente de justificar`**, sea cual sea la
licencia que la persona invoque, y encabeza los avisos hasta que presente el
papel. Es el estado que más importa: es el único que dice qué hay que hacer hoy
—reclamar el certificado—. La ausencia se registra igual: lo que no se anota el
día que pasa, se pierde.

Después, `estadoDeAusencia()` ordena el resto: sin fecha de alta, vence hoy,
vuelve en tantos días, venció hace tantos. La tabla tiene la marca del
certificado para poder cambiarla sin abrir la ficha.


## El RDV (pantalla *Ventas*)

El **Reporte Diario de Ventas** que llega todas las mañanas trae, por tienda, la
venta de ayer, la del mes, lo requerido, la meta del día y las transacciones.

Para importarlo: abrí el archivo en Excel, andá a la hoja **RDV Operaciones**,
seleccioná desde la fila de encabezados —la que dice *Área … Tienda … Ayer …
Mes*— hasta la última tienda, copiá y pegá.

Se toman solo las filas del área configurada. Los nombres del RDV que no
coinciden con los del panel se resuelven con una tabla de alias:

| RDV | Panel |
|---|---|
| SAN MARTIN | SM CENTER |
| VILLA DEL PARQUE II | VILLA DEL PARQUE |
| 25 DE MAYO (NOBLEZA) | LA NOBLEZA |

Lo que no se puede ubicar se informa; no se descarta en silencio.

**La venta no cambia ningún indicador de RRHH.** Sirve para leer la cobertura
contra el volumen que efectivamente hubo que atender: el mismo hueco de personal
pesa distinto en un día flojo que en uno de promoción bancaria.

Dos índices distintos, que no hay que mezclar:
- **Índice del día** = venta de ayer ÷ meta de ese día.
- **Índice del mes** = acumulado del mes ÷ requerido acumulado.

Comparar la venta de ayer contra el requerido del mes entero da un desvío falso
de −80%.

### De dónde salen los presentes

La venta se suma sobre `calc.filasVenta`: todas las tiendas que tienen venta
importada, sin depender de ninguna otra carga.

La **venta por persona presente** necesita la otra punta, y la saca del padrón.
`presentesDelPadron(sucursal, fecha)` cuenta la gente de esa tienda que está
activa, cubre turno —el bloqueo de título y los no presenciales nunca entran— y
no tiene una ausencia abierta en esa fecha. Nadie carga nada: sale de la nómina
y de lo anotado en Presentismo.

El cociente usa las **dos puntas del mismo subconjunto**: solo las tiendas que
tienen venta *y* plantel cargado. Dividir la venta de once tiendas por la gente
de dos da un número que no es de nadie.

## El documento de venta

`Reporte.textoVentasDia()`, que se copia o se baja desde la pantalla de Ventas:

1. **El día** — venta, meta, índice del día, índice del mes, transacciones y la
   venta por persona presente.
2. **Por sucursal** — una fila por tienda con venta importada.

Presentismo ya no genera ningún documento: no hay nada que mandar que el
destinatario no vea mejor en la pantalla.
