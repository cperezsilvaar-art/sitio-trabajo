# Cartelera

Lo que le informan al coordinador y tiene que llegar a las tiendas: fechas de
pago, ventanas de adelantos, cambios de convenio, inventarios, capacitaciones.

**No es un cuaderno de notas.** Casi todo lo que llega por este canal tiene una
fecha que vence —"los adelantos se piden hasta el 14"— y el 13 a la tarde lo
único que importa es saber que vence mañana. Por eso la cartelera está armada
alrededor de las fechas, no del texto.

## Pegar el aviso como llegó

Se copia el mensaje tal cual —con emojis, viñetas, mayúsculas, lo que sea— y se
pega. El panel le saca:

- **El título**, de la primera línea con texto, sin emojis.
- **La categoría**, por las palabras que aparecen: *pagos y beneficios*,
  *convenio y normativa*, *operación de tienda*, *gente*, *formación*, *otros*.
- **Las fechas**, con una etiqueta de qué pasa ese día.

Si hubiera que cargar las fechas a mano, no se cargarían. Todo se puede corregir
después abriendo el aviso.

### Qué formatos de fecha reconoce

| Escrito así | Se lee como |
|---|---|
| `9 de septiembre` | el 9 del mes, del año que corresponda |
| `14 y 17 de septiembre` | dos fechas |
| `1 de octubre de 2026` | con año explícito |
| `17/09`, `3-10-2026`, `17/09/26` | numérico |

Cuando no hay año —lo habitual en un mensaje interno— usa el del día de
publicación. Si eso deja la fecha más de tres meses en el pasado, la pasa al año
siguiente: un aviso de diciembre que dice "5 de enero" habla del enero que viene.

### Qué etiqueta le pone a cada fecha

Según las palabras que rodean la fecha **en esa cláusula**, no en la línea
entera:

| Si dice… | La etiqueta es |
|---|---|
| hasta el, plazo, vence, último día, cierre de | **Último día** |
| se abonará, se pagará, se acredita, liquidar | **Pago** |
| se proyecta liquidar, estimado, previsto | **Pago estimado** |
| a partir del, desde el, comienza, arranca | **Arranca** |
| reunión, capacitación, curso, taller, inventario | **Evento** |

La cláusula importa: *"las solicitudes se piden **hasta el 14** y **serán
abonadas el 17**"* tiene dos fechas con sentidos opuestos en una sola oración.
Mirando la línea entera, el 17 quedaba marcado como vencimiento.

Una misma fecha puede aparecer dos veces con conceptos distintos. En el aviso de
septiembre, el 14 es a la vez el último día para pedir adelantos y el pago
estimado de la variable de Dermo: son dos hitos, no uno.

## Dónde aparece

- **En la cartelera**, ordenada por lo que vence primero, con los avisos fijados
  arriba y la agenda de los próximos 7 días como tabla de fechas (no de avisos:
  un aviso con tres fechas ocupa tres renglones).
- **En el Panel de la red**, como una tira con lo que vence hoy, mañana o en los
  próximos tres días.
- **En el reporte diario**, como bloque `PARA AVISAR EN LA TIENDA`, y solo
  cuando falten tres días o menos. Si entrara siempre, en dos semanas nadie lo
  leería.

## Reenviarlo a los gerentes

**Copiar para mandar a las tiendas** arma una versión para WhatsApp: el título
con el ícono de la categoría, el texto, y las fechas listadas al final en
formato `dd/mm`, que es lo que después preguntan. Si vence hoy o mañana, agrega
una línea de advertencia.

## Volver a leer las fechas

Si se corrige el texto del aviso, las fechas **no se recalculan solas**: eso
pisaría las que se editaron a mano. El botón *Volver a leer las fechas del
texto* las reemplaza cuando se lo pide explícitamente, y avisa cuáles encontró
antes de hacerlo.
