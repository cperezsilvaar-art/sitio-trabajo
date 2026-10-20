# El plan de desarrollo individual

## Qué contesta

«Qué acordamos hacer de acá a la próxima conversación, y se hizo.»

Es la otra mitad del 9-box. Cada cuadrante trae escrita su acción sugerida
—«plan de mejora con objetivos medibles y plazo», «proyectos que estiren su
alcance», «conversación de carrera»— y hasta ahora **no había dónde escribir
qué se hizo con eso**. El cuadrante decía qué tipo de conversación había que
tener; el plan es el registro de esa conversación.

## Por qué no alcanzaba con «Próximo paso»

El entrenamiento a Senior ya tenía un campo `proximoPaso` por evaluación: un
renglón de texto libre al pie del formulario. Servía para acordarse y nada más.

- **No decía sobre qué.** «Trabajar el liderazgo» no se parece a una acción.
- **No decía para cuándo.** Sin fecha, nada vence y nada apura.
- **Nadie volvía a preguntar si se hizo.** Se escribía una vez y quedaba en la
  línea de tiempo como un comentario, no como un compromiso.
- **Era solo para quien entrenaba.** El 90% del plantel no está en un proceso a
  Senior y también necesita un plan.

`proximoPaso` **sigue guardado y se sigue leyendo** en la trazabilidad: los
meses ya cargados se escribieron con él.

## Dónde vive

En la **persona** (`c.planes[]`), como `c.ausencias`, `c.casos`,
`c.movimientos` y `c.entrenamientos`. Si la trasladan de tienda en el medio de
un plan, el plan se va con ella.

Se escribe en **dos pantallas y con un solo formulario**:

- **La ficha de la persona**, en *Nómina*, abajo del 9-box y del entrenamiento.
- **La pantalla del entrenamiento** (`#/desarrollo/<id>`), al pie, después de
  la trazabilidad.

Eso **no rompe la regla de una sola alta**. La regla existe para que dos
formularios no pidan campos distintos y haya que acordarse de cuál está más
completo; acá es `bloquePlanDesarrollo()` dibujada dos veces, el mismo código
sobre el mismo dato. Es lo mismo que hace la talent card. Y va donde se lo está
pensando: mandar al coordinador a buscar otra pantalla justo cuando acaba de
cargar la evaluación del mes es la forma más rápida de que no escriba el plan.

En el entrenamiento se dibuja **compacta** (`opciones.compacto`): sin el
historial de tramos anteriores, que ya está en la ficha y arriba hay una línea
de tiempo.

## Un tramo a la vez

Un plan cubre **de una conversación a la siguiente**: tiene `desde`, `hasta`
—cuándo se revisa— y con quién se acordó.

**Hay un solo plan abierto por persona.** Dos planes en curso son dos listas de
prioridades, que es no tener ninguna. Al abrir uno nuevo, el anterior se cierra
si quedó abierto.

La fecha de revisión se propone sola: el **fin tentativo del entrenamiento** si
está entrenando, y si no, **treinta días**.

## Cada acción tiene cuatro cosas

| | |
|---|---|
| **Competencia** | Opcional. Solo aparece si la persona tiene un entrenamiento abierto, y el desplegable ofrece **únicamente las que le faltan**, con su «hoy 2, pide 3». Las que ya alcanzó y las dos que no suben de nivel no están: escribir un plan sobre algo que ya hace es ruido. |
| **Qué va a hacer** | La acción concreta. «Que lleve ella la apertura los martes», no «mejorar el liderazgo». Es la columna ancha porque es la que se lee. |
| **Quién acompaña** | El gerente, otro Senior, el coordinador. |
| **Para cuándo** | Fecha. Por omisión, la de revisión del plan. |

Una acción **puede no tener competencia**: hay cosas que no entran en una
casilla del inventario, y para alguien que no está entrenando la columna ni
siquiera se dibuja.

## Qué pasó con cada una

Cuatro estados, y son cuatro y no tres:

| Estado | Qué dice |
|---|---|
| *Sin revisar* | Todavía nadie la miró |
| **Se hizo** | Cerrada |
| **Sigue abierta** | No se hizo todavía y hay que seguirla |
| **No se hizo** | Cerrada: se decidió que no va |

«No se hizo» y «sigue abierta» parecen lo mismo y no lo son: **una cierra el
tema y la otra lo arrastra al plan siguiente**. Esa diferencia es lo que hace
que el plan tenga continuidad en vez de empezar de cero todos los meses.

Dos reglas que se repiten del resto del panel:

- **Volver a tocar el mismo estado lo destilda**, como el check list de la
  visita: equivocarse al marcar no puede obligar a borrar y reescribir.
- **Destildar no borra la nota**, como los trámites de la baja. Ahí está
  escrito con quién se habló y qué salió, y eso sigue siendo cierto.

## Las que siguen abiertas pasan solas

Al abrir el plan siguiente, las acciones que la revisión anterior dejó en
*sigue abierta* **se traen al nuevo**, sin revisar y con su fecha original, y
quedan marcadas como que venían de antes. Es exactamente lo que ese estado
quiere decir.

El tramo anterior es **el último, esté abierto o recién cerrado**. Buscarlo
solo entre los abiertos perdía las acciones heredadas justo en el camino
normal —se cierra el tramo y después se escribe el siguiente—, que es cuando
más importan.

## El avance se cuenta sobre lo revisado

«1 de 1 revisadas se hicieron · 2 sin revisar» y no «33% cumplido». Un plan de
tres acciones con una hecha y dos que nadie miró no es un plan cumplido a
medias: es una hecha y dos sin revisar. Es la misma regla que el «sin evaluar»
del entrenamiento y los días supuestos del ausentismo — **el número no se
muestra solo**.

## Cerrar es una decisión

Se puede cerrar el tramo con acciones sin revisar, y **la pantalla nombra lo
que falta antes de dejar cerrar en vez de impedirlo**, igual que
`c.baja.cerradaEl`. Bloquearlo llevaría a marcar cualquier cosa para poder
seguir, que es peor que un plan incompleto pero sincero.

## Al unir dos fichas duplicadas

`unirColaboradores()` concatena los planes de las dos, como las ausencias y los
entrenamientos. `planes` no estaba en su lista al escribirlo y los de la ficha
que se iba **se perdían en silencio**: es el agujero que tendría cualquier
`c.<algo>[]` nuevo que se agregue después sin acordarse de esa función.

## Lo que no hace

**No avisa.** Una acción pasada de fecha se marca en rojo en su fila y nada
más: no suma al contador del menú ni entra en *Lo que quedó pendiente*. Es una
decisión del coordinador. El panel ya avisa cuando un entrenamiento vence y
cuando un mes se fue sin evaluación; un tercer aviso por cada acción de cada
plan convertiría el contador de *Desarrollo* en un número que deja de leerse a
los dos días, que es la misma razón por la que los contadores se esconden en
cero.

**No es un legajo.** Lo que se escribe son acciones y hechos —qué va a hacer,
con quién, para cuándo, qué pasó—, no calificaciones sobre la persona. Es la
misma regla que la de los casos en seguimiento.
