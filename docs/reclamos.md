# Reclamos de los colaboradores

Cuando el coordinador va a la tienda, la gente le plantea cosas: una hora extra
que no se pagó, un adicional nocturno que falta, una categoría que no
corresponde. Se dice de palabra, en el pasillo, entre dos clientes. Y se pierde.

Este registro existe para eso.

## Por qué está separado de la visita

Un reclamo **se abre** en una visita pero no le pertenece: vive hasta que se
resuelve, y casi nunca se resuelve el mismo día. Si viviera dentro de la visita,
al abrir la visita siguiente empezaría de cero.

Por eso los reclamos tienen su propia pestaña, su propio estado y su propio
reloj.

## Un solo lugar: `#/reclamos`

Hasta septiembre de 2026 había **dos altas**: la de esta pantalla y otra al pie
del check list de la visita. Eran la misma cosa con distintos campos, y el
problema no era el espacio que ocupaban: era tener que acordarse de cuál de las
dos estaba más completa. La respuesta siempre era la otra.

Ahora el alta y el seguimiento están **acá y en ningún otro lado**. Lo que
cambia es cómo se llega:

- **`#/reclamos/<sucursal>`** abre la misma pantalla filtrada por una tienda.
  Los indicadores de arriba pasan a ser los de esa tienda, la columna *Sucursal*
  desaparece de la tabla porque sobra, el alta viene con la tienda ya elegida y
  el autocompletado de nombres ofrece **su** plantel y no las 139 del área.
- **Al pie del check list de la visita** quedó el recordatorio, no el
  formulario: cuántos hay abiertos, quiénes son y desde cuándo, con un botón
  que lleva a `#/reclamos/<sucursal>`. Es lo que hace falta parado en la tienda
  —es lo primero que la gente pregunta—, sin duplicar dónde se carga.
- **En la ficha de la tienda**, el indicador *Reclamos abiertos* es un enlace al
  mismo lugar.

Que un reclamo cuente como **planteado en esta visita** ya no depende de desde
qué pantalla se cargó, sino de que su fecha coincida con la de la visita. El
campo `origenVisitaId` sigue en el modelo y sigue valiendo para los que se
guardaron cuando el alta de la visita existía.

## El reloj

Un reclamo salarial sin respuesta no se apaga solo. El panel marca:

| | |
|---|---|
| Hasta 7 días | 🟢 El colaborador todavía está esperando |
| 8 a 15 días | 🟡 Ya está preguntando a otros |
| Más de 15 | 🔴 Dejó de preguntar, que es la señal peor |

Los cortes son de gestión, no legales. Lo que rompe la confianza no suele ser el
"no": es el silencio. Por eso el panel cuenta aparte los reclamos **sin respuesta
escrita**, aunque el estado haya avanzado: escalarlo a Nómina no es lo mismo que
haberle contestado a la persona.

## Los estados

| Estado | Qué significa |
|---|---|
| **Recibido** | Se anotó, todavía nadie lo miró |
| **En análisis** | RRHH está revisando el recibo |
| **Escalado a Nómina** | Salió del área, espera respuesta de Liquidaciones |
| **Falta información** | Se necesita algo del colaborador o de la tienda |
| **Procede: se ajusta** | Se confirmó, entra en la próxima liquidación |
| **Ajustado y pagado** | Cerrado |
| **No procede, ya se explicó** | Cerrado |

*Procede* todavía cuenta como abierto: se cierra cuando el ajuste está pagado, no
cuando se aprobó. Cada cambio de estado queda con su fecha en el historial, que
es lo que después permite saber cuánto se tardó en responder.

## El patrón, que es el dato que más sirve

Cuando **dos o más personas de la misma sucursal reclaman lo mismo**, el panel lo
avisa arriba de todo. No son dos reclamos: es un error de proceso. Tres personas
con horas extras mal liquidadas en la misma tienda el mismo mes no es mala
suerte, es un problema de carga o de criterio que va a volver el mes que viene.

## Qué conviene registrar y qué no

**Sí:** el nombre, el tipo y la fecha en que lo planteó. Con eso alcanza para
abrirlo en la tienda: el botón **+ Registrar** pide nada más que esos tres datos
y la fila queda abierta para completarla. El detalle —con las palabras del
colaborador, cuanto más textual mejor— y el monto estimado se completan
después.

**La respuesta también, aunque sea que no procede.** Es el campo que más se
saltea y el único que cierra el circuito de verdad: si no quedó escrito qué se le
contestó y cuándo, para el colaborador nadie le contestó.

## Adónde llega

- **Panel de la sucursal**: un indicador con los abiertos y cuántos se pasaron,
  que además es el enlace a esta pantalla filtrada por esa tienda.
- **Check list de la visita**: los abiertos, para repasarlos antes de que te los
  pregunten, y el botón para ir a anotar uno.
- **Reporte de la visita** al Gerente de Operaciones: los planteados en esa
  visita con su detalle, los que vienen de antes con su antigüedad, y los que
  todavía no tienen respuesta como dato pendiente.
