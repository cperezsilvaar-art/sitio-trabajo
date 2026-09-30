# Desarrollo al rol de Senior (ROL APV)

Pantalla `#/desarrollo`. Código en `assets/js/desarrollo.js` (el modelo de
competencias y las cuentas) y en `app.js` (`vistaDesarrollo`,
`fichaEntrenamiento`, `fichaEntrenamientos`).

## Qué pregunta responde

Cuando un gerente de tienda propone a un APV para cubrir el rol de Senior por un
tiempo, empieza un proceso que hasta ahora vivía en la memoria del coordinador y
en el WhatsApp del gerente: quién lo propuso, desde cuándo, hasta cuándo se
estimó, qué se le miró en cada assessment y cómo le fue. Esta pantalla guarda
esa trazabilidad completa, de punta a punta.

Los tres cuadrantes son:

| Cuadrante | Qué hay adentro |
|---|---|
| **Propuestos** | El gerente lo propuso y el entrenamiento todavía no arrancó. |
| **En entrenamiento** | Está cubriendo el rol, con su **fecha de fin tentativa** y su avance. |
| **Cerrados** | Terminó: efectivo en el rol, sigue como APV, o se interrumpió. |

Un cuarto estado intermedio suena prolijo y en la práctica hace que nadie sepa en
cuál va cada uno. El panel **no mueve el estado solo**: que alguien quede
efectivo es una decisión de una persona. Lo que sí hace es marcar en rojo el
entrenamiento cuya fecha tentativa ya pasó y sigue abierto, y avisar cuando un
mes se fue sin la conversación con el gerente.

## Dónde vive el dato

En la **persona** (`c.entrenamientos[]`), no en la sucursal —igual que `c.baja`,
`c.movimientos` y `c.ausencias`—, así la trazabilidad la acompaña si la
trasladan de tienda en el medio del proceso. La tienda donde lo propusieron
queda igual guardada en `sucursalIdPropuesta`, porque después de la mudanza la
ficha ya no diría dónde empezó esto.

```
{ id, rol: 'APV Senior', estado: 'propuesto' | 'entrenamiento' | 'cerrado',
  propuestoPor, fechaPropuesta, sucursalIdPropuesta, motivo,
  fechaInicio, finTentativo,
  fechaCierre, resultado: 'efectivo' | 'continua' | 'interrumpido', notaCierre,
  evaluaciones: [ { id, fecha, instancia, evaluadaCon,
                    niveles: { competenciaId: nivel }, comoLeFue, proximoPaso } ] }
```

La ficha de la persona (en `#/nomina`) lo lista en modo lectura y enlaza a
`#/desarrollo/<id>`. **El formulario de evaluación está en un solo lugar**: tener
el mismo formulario en dos pantallas obliga a acordarse de cuál de las dos está
más completa, que es el error que ya se corrigió con los reclamos.

## Qué se evalúa: el inventario de competencias de Farmatodo

Nada de esto se inventó para el panel. Sale del **Inventario de Competencias**
de la compañía y, dentro de él, de la matriz *Modelos de competencias por áreas
de negocio y roles*, que para cada cargo fija el **nivel de indicador** que le
pide a cada competencia. Comparando la columna *APV* con la columna *APV Senior*
queda, literalmente, lo que esta persona tiene que trabajar para ser efectiva en
el rol.

Los niveles del inventario son **acumulativos**: quien está en 3 hace también lo
de 1 y 2. Por eso alcanza con guardar un número por competencia y por
evaluación.

| Competencia (escala) | APV | APV Senior | |
|---|---|---|---|
| Preocupación por el orden y el detalle (4) | 2 | **3** | sube |
| Madurez emocional (4) | 2 | **3** | sube |
| Energía (4) | 3 | **4** | sube |
| Desarrollo de otros (5) | 1 | **2** | sube |
| Orientación a resultados excelentes (4) | 1 | **2** | sube |
| Orientación al cliente (4) | 1 | **2** | sube |
| Seguimiento y control (4) | 1 | **2** | sube |
| Sentido de urgencia (5) | 1 | **2** | sube |
| Liderazgo (6) | — | **1** | nueva en el rol |
| Dirección de otros (4) | 1 | 1 | sostiene |
| Excelencia operativa (5) | 1 | 1 | sostiene |

**Conciencia de equipo** no está en la tabla y no es un olvido: el modelo se la
pide al APV en nivel 3 y **no se la pide al Senior**. Lo que en el APV era
cooperar con el equipo, en el Senior se le pide como Liderazgo y como Dirección
de otros. Decirlo evita que el gerente lo lea como un retroceso.

Las competencias del inventario que el modelo **no le pide a ninguno de los dos
cargos** —Capacidad de integración, Conocimiento técnico, Influencia y
negociación, Pensamiento integral, Sensibilidad interpersonal, Sentido
comercial, Vanguardia e innovación, Visión de negocio— no aparecen. Evaluar
veinte competencias para mirar once es la forma más rápida de que el gerente no
complete ninguna.

Cada competencia trae en el panel su **definición textual del inventario** y los
**títulos de los indicadores hasta el nivel que pide el rol**. Pedirle a un
gerente que lea los seis niveles de Liderazgo para evaluar el primero es lo
mismo que no darle nada.

## Las evaluaciones

Dos cosas distintas, en la misma lista y con la misma forma:

- el **seguimiento mensual con el gerente**, que es el compromiso del proceso;
- los **assessments** (1, 2, 3) y la **evaluación de cierre**, que son las
  instancias formales.

Cada evaluación guarda la fecha, la instancia, con quién se hizo, el nivel que se
le reconoce en cada competencia, **cómo le fue** y el **próximo paso**.

Lo que se deja en *sin cambio* **mantiene lo de la evaluación anterior**: una
charla que habló de tres competencias no tiene por qué volver a puntuar las once.
`nivelesActuales()` recorre las evaluaciones por fecha y se queda con el último
número de cada competencia, así que una conversación corta no borra lo que midió
el assessment del mes pasado.

El avance se cuenta como **competencias que llegaron al nivel que pide el rol,
sobre once**. No es un promedio a propósito: un 2 de Liderazgo sobre una escala
de 6 y un 2 de Seguimiento sobre una de 4 no son lo mismo, y promediarlos da un
número que no significa nada.

## Por qué entra, contra el marco conceptual

- **McKinsey (`docs/marco-conceptual.md`, hallazgo 1):** planificación de
  *capacidades*, no de headcount. Saber que faltan dos Senior en el área es
  headcount; saber que hay tres APV entrenando y en qué competencia está cada uno
  es capacidades.
- **McKinsey (hallazgo 3):** más de la mitad de los empleados recibe feedback una
  vez al año o nunca, y RRHH **sobreestima** cuánto feedback se dio. De ahí que
  el panel cuente si el mes tuvo su conversación y lo marque cuando no: sin
  registro, la respuesta a "¿cuándo hablamos de esto?" es una estimación, y la
  estimación va a estar inflada.
- **Ulrich:** el entregable lo recibe el **gerente de tienda**, que con esto sabe
  qué mirarle a su APV este mes, y el **colaborador**, que sabe contra qué se lo
  mide. No es un informe que "queda más completo".
- **Vosburgh:** no hay ninguna planilla nueva que tipear. Las once competencias
  ya vienen cargadas y la evaluación del mes son unos desplegables y dos
  renglones.

## En la visita

La visita muestra quiénes de esa tienda están propuestos o entrenando, con su
avance y si el mes ya tuvo su evaluación. Es un **recordatorio, no un
formulario**, por el mismo motivo que los reclamos: el alta y la evaluación viven
en `#/desarrollo` y en ningún otro lado. Lo que hace falta durante la visita es
acordarse de que hay que sentarse con el gerente a hablar de esta persona, que es
justo cuando el gerente está enfrente.

Colgaba del pie de *Talento y 9-box* y ahora cuelga de la visita, que es a lo que
siempre correspondió. Al mudar el 9-box se lo sacó por redundante con la solapa
*Al rol de Senior*, y no lo era: esa solapa está en `#/desarrollo`, adonde se
entra **cuando ya te acordaste**.

## El plan entre una evaluación y la otra

Al pie de la pantalla está el **plan de desarrollo individual**: qué se acordó
hacer de esta evaluación a la próxima, con quién y para cuándo. Cuelga de la
persona y no del entrenamiento —documentado en
[`docs/plan-desarrollo.md`](plan-desarrollo.md)— así que la acompaña si la
trasladan y sigue existiendo cuando el entrenamiento cierra.

Cuando la persona está entrenando, cada acción puede apuntar a una de las
competencias **que le faltan**, con su «hoy 2, pide 3». Eso es lo que convierte
el plan en el puente entre una evaluación y la siguiente, en vez de una lista
suelta de buenas intenciones.

El campo **«Próximo paso»** del formulario de evaluación sigue ahí y se sigue
leyendo en la trazabilidad, porque los meses ya cargados se escribieron con él.
Lo que se trabaja de acá en adelante es el plan.

## Lo que esta pantalla no hace

- **No liquida ni recategoriza.** Que alguien quede efectivo como Senior es un
  movimiento de puesto: se carga en la ficha de la persona y se lee en
  `#/movimientos`, como cualquier otra modificación.
- **No decide.** El panel marca vencimientos y meses sin evaluar; efectivizar,
  extender o interrumpir lo decide el coordinador con el gerente.
- **No reemplaza al 9-box.** *Talento y 9-box*, la otra solapa de esta misma
  pantalla, es donde se decide **a quién mirar**. Acá se registra **qué pasó
  después**.
