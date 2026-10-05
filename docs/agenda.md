# Mi agenda

Lo que el coordinador lleva: lo que tiene que hacer, lo que está esperando que
le respondan, y lo que le informaron y no se puede olvidar.

**No es un tablón de anuncios ni una lista de tareas genérica.** Lo que se anota
acá casi siempre tiene una fecha —"los adelantos se piden hasta el 14", "llamar
a Ana el jueves"— y a las cuatro de la tarde del 13 lo único que importa es
saber qué vence mañana. Por eso el módulo está armado alrededor de las fechas.

## Anotar

Se escribe la línea **como uno la diría** y se aprieta Enter. Si hubiera que
elegir la fecha en un calendario, no se anotaría.

```
Llamar a Ana de Botánico el jueves
Firmar los recibos hoy
Revisar el inventario de Olleros en 5 días
Pedí a Compensaciones el ajuste de Gómez
Capacitación de dermo el 14 de octubre
```

El panel saca de esa línea tres cosas:

**La fecha.** Entiende `hoy`, `mañana`, `pasado mañana`, `el jueves`, `el lunes
que viene`, `en 3 días`, `en 2 semanas`, `17/09`, `3-10-2026`, `14 de octubre`,
`14 y 17 de septiembre`.

Cuando no hay año usa el actual, y si eso deja la fecha más de tres meses en el
pasado la pasa al siguiente: un apunte de diciembre que dice "5 de enero" habla
del enero que viene. Un día de la semana sin más —"el jueves"— es siempre el
próximo, nunca hoy.

**El tema.** Pagos y beneficios, convenio y normativa, operación de tienda,
gente, formación, seguimiento de visita, otros.

**El estado.** Si la línea dice que ya lo pediste —*pedí*, *mandé*, *consulté*,
*reclamé*, *quedaron en*— queda como **esperando**: la pelota está del otro
lado. Si no, queda **pendiente**.

Todo se corrige después abriendo el apunte.

### Pegar algo largo

*Pegar algo largo* abre un campo para el mensaje entero —el de Compensaciones,
una minuta, lo que sea— tal como llegó, con emojis y viñetas. Separa el título
del cuerpo y saca **todas** las fechas.

## Cómo etiqueta cada fecha

Según las palabras que rodean a la fecha **en esa cláusula**, no en la línea
entera:

| Si dice… | La etiqueta es |
|---|---|
| hasta el, plazo, vence, último día, cierre de | **Último día** |
| se abonará, se pagará, se acredita, liquidar | **Pago** |
| se proyecta liquidar, estimado, previsto | **Pago estimado** |
| a partir del, desde el, comienza, arranca | **Arranca** |
| reunión, capacitación, curso, taller, inventario, visita | **Evento** |
| llamar, mandar, pedir, firmar, cerrar, coordinar… | **Hacer** |

La cláusula importa: *"las solicitudes se piden **hasta el 14** y **serán
abonadas el 17**"* tiene dos fechas con sentidos opuestos en una sola oración.
Mirando la línea entera, el 17 quedaba marcado como vencimiento.

Una misma fecha puede aparecer dos veces con conceptos distintos. En el aviso de
septiembre, el 14 es a la vez el último día para pedir adelantos y el pago
estimado de la variable de Dermo: son dos hitos, no uno.

## Cómo se lee

La agenda se reparte sola en los cajones en que uno la mira:

- **Vencidas** — ya pasó la fecha y siguen abiertas.
- **Hoy y mañana**
- **Esta semana** — próximos 7 días.
- **Más adelante**
- **Sin fecha** — no vencen, pero tampoco se van solas.
- **Hechas** — el historial, plegado.

El círculo de la izquierda marca hecho sin abrir el apunte. Lo hecho no vence
aunque su fecha haya pasado: se saca del camino.

## Lo que sale del panel

Lo vencido y lo de hoy y mañana aparece como una tira en el **Panel de la red**.
La agenda sirve si te encuentra, no si hay que ir a buscarla.

Al **informe del check list** que se lleva a la tienda viaja **solo lo que
marcaste como "hay que avisarlo en la tienda"**, y solo cuando faltan tres días o
menos. El resto es tu trabajo, no el de la tienda. Iba en el reporte diario de
presentismo hasta que ese reporte se eliminó junto con la carga manual del día;
el informe de la visita es el que efectivamente se lleva puesto.

**Copiar para mandar** arma la versión de WhatsApp: título con el ícono del
tema, el detalle, y las fechas al final en `dd/mm`, que es lo que después
preguntan.

## Volver a leer las fechas

Si se corrige el texto, las fechas **no se recalculan solas**: eso pisaría las
que se editaron a mano. El botón *Leer las fechas del texto* las reemplaza
cuando se lo pide explícitamente, y avisa cuáles encontró antes de hacerlo.

## Lo que quedó pendiente

Un proceso de baja empieza el día que la persona deja de venir y sigue quince
días más, repartido en cinco lugares distintos. Una ausencia sin certificado no
se resuelve sola. Un traspaso espera tu visto bueno. Cada una de esas cosas está
bien guardada en su pantalla —y ahí es donde tiene que estar— pero **ninguna de
esas pantallas es la que se abre a la mañana para ver qué hay que hacer**: esa
es la agenda.

El bloque **Lo que quedó pendiente**, arriba de los cajones por fecha, junta de
donde vive cada una:

| Grupo | De dónde sale | Lleva a |
|---|---|---|
| Trámites de baja sin terminar | `c.baja.tramites`, proceso sin cerrar | `#/movimientos/bajas` |
| Ausencias que piden algo | `alertasDeAusencias()` | `#/diario/<persona>` |
| Documentos que hay que renovar | `documentosQueVencen()` | `#/nomina` |
| Horas extras esperando autorización | `c.solicitudesHoras[]` en `pedida` | `#/nomina/horas` |
| Reclamos abiertos | `e.reclamos` sin estado cerrado | `#/reclamos/<tienda>` |
| Movimientos sin autorizar | `c.movimientos[]` en `pendiente` | `#/movimientos` |
| Desarrollo al rol de Senior | `alertasDeDesarrollo()` | `#/desarrollo/<persona>` |
| Casos que piden algo | `casosDelArea()` | `#/casos` |
| Compromisos de la última visita | `v.diagnostico.plan`, sin cumplir | la visita |

**Las horas extras son el único grupo que mira hacia adelante.** Todos los demás
cuentan desde que la cosa quedó abierta; una solicitud de horas extras tiene su
propia fecha de vencimiento —el día en que se harían— y contestar el martes lo
que era para el sábado no es contestar: el gerente ya decidió sin respuesta. Por
eso su color sale de los días que **faltan** y no de los que lleva, y la línea
dice ahí mismo si autorizarla pasa un tope.

### No copia nada

`pendientesDelArea()` (`agenda.js`) **lee y arma la lista; no escribe**. Lo
pendiente no se convierte en un ítem de `e.agenda`.

Es la misma razón por la que los reclamos se dan de alta en un solo lado: dos
casillas para la misma cosa terminan diciendo cosas distintas. Tildar el cuarto
trámite de una baja en `#/movimientos/bajas` hace desaparecer esa línea de la
agenda sin tocar nada acá; si en cambio hubiera un ítem copiado, quedaría un
pendiente fantasma que hay que cerrar dos veces.

Por eso cada línea es un enlace a donde la cosa se resuelve, y no una casilla.

### Los días

Cada línea dice hace cuánto está abierta —desde la fecha de la baja, del
certificado, del reclamo, del movimiento— y las más viejas van primero adentro
de su grupo. A los **15 días** (`DIAS_PARA_INSISTIR`) la línea pasa de ámbar a
rojo: no es un plazo legal, es el punto en el que el coordinador ya no se
acuerda solo. Un compromiso de visita con plazo vencido va en rojo desde el día
siguiente al plazo, porque ahí sí hay una fecha comprometida con alguien.

### Cuando no hay nada

El bloque **no aparece**, igual que los contadores del menú se esconden en cero
y que un indicador sin número sale de la tira. Un «0 pendientes» permanente deja
de leerse a los dos días.
