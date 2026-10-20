# Talento: desempeño, potencial y talent card

## Dónde está la pantalla

`#/desarrollo/talento`, la primera solapa de **Desarrollo**. Antes era una solapa
de la visita (`#/visita/<id>/talento`), y eso hacía que **el mapa del área no
existiera**: para saber a quién tenía mapeado como talento había que abrir una
visita por tienda y sumar catorce parciales de memoria. La pregunta del
coordinador es sobre el área, así que la pantalla arranca en el área.

El **selector de tienda** sigue estando, para la conversación con un gerente.
Está en segundo lugar a propósito: si la lista arrancara en una tienda habría que
recorrer las catorce para tener el panorama, que es justo lo que se venía
haciendo.

Son **dos solapas y no dos entradas del menú**, por lo mismo que el Panel y
Nómina: *Talento y 9-box* decide **a quién mirar** y *Al rol de Senior* registra
**qué pasó después con esa persona**. Es la misma conversación, mirada de dos
lados.

La visita quedó con el check list y el recordatorio de sucesión, en **una sola
página y sin barra de solapas**: con un solo instrumento, una barra de una solapa
es ruido.

## Los tres grupos del mapa

Nueve cuadrantes son el detalle de la charla con un gerente. Para mirar el área
de conjunto el coordinador la lee en **tres grupos**, que es la pregunta que se
hace todos los días: a quién tengo mapeado como **talento**, quién como
**especialista** y quién como **contribuidor consistente (CC)**.

| Grupo | Cuadrantes | Qué dice |
|---|---|---|
| **Talento** | Estrella, Promesa, Alto desempeño, Profesional sólido | Entrega lo que la posición pide y puede asumir una de mayor alcance. De acá sale la sucesión. |
| **Especialista** | Especialista | Muy bueno en lo suyo, sin proyección de cambio de nivel. Referente técnico, y perderlo se nota en el piso. |
| **Contribuidor consistente (CC)** | Eficaz | Hace lo que la posición pide y no busca crecer. Es el sostén de la operación. |
| **En plan de mejora** | Enigma, Inconsistente, Riesgo | Hoy no alcanza lo esperado, con o sin potencial visible. |

Cuatro decisiones que hay que respetar al tocarlo:

- **Se derivan del cuadrante y no se cargan aparte.** `GRUPOS_TALENTO` y
  `grupoDeTalento()` (`talento.js`) los calculan sobre desempeño y potencial. Un
  campo propio sería una segunda respuesta a la misma pregunta, y el día que
  difieran no hay forma de saber cuál vale.
- **El cuarto grupo no es uno de los tres y va igual.** Quien hoy no alcanza lo
  esperado tiene que estar en algún lado: dejarlo afuera daría un mapa que no
  suma el plantel, y el que falta es justamente el que pide trabajo.
- **Los sin evaluar van al pie, no como un grupo más.** Es lo mismo que «sin
  relevar» en el curso de ADEF: que a alguien todavía no lo miraste no es una
  lectura sobre esa persona, y mezclarlo borra la única diferencia que importa
  al empezar.
- **Los porcentajes son sobre los evaluados**, y la línea de abajo dice cuántos
  faltan sobre el plantel. Un porcentaje sin su denominador se lleva a una
  reunión como si cubriera a todos, igual que los días supuestos del ausentismo.

Abajo del mapa sigue el detalle **por cuadrante**, ordenado del que hay que
retener al que hay que resolver, y abajo de ese la tabla de evaluación y la
matriz.

La **ficha de la persona**, en *Nómina*, dice en qué grupo queda con la misma
función (`grupoDeTalento()`), abajo de los dos desplegables: es la misma lectura,
una persona a la vez. No repite el nombre cuando el cuadrante y el grupo se
llaman igual —«Queda en Especialista», no «Especialista, que se lee como
Especialista»—, que es la regla del código de la tienda entre paréntesis.

## El plan de desarrollo

El 9-box dice **qué tipo de conversación** hay que tener con cada persona —cada
cuadrante trae su acción sugerida—. Dónde se escribe **qué se hizo con eso** es
el plan de desarrollo individual, que vive en la ficha de la persona y está
documentado en [`docs/plan-desarrollo.md`](plan-desarrollo.md).

## Dónde vive el dato

Los colaboradores **cuelgan de la sucursal, no de la visita**. Es la decisión de
diseño que hace que el módulo sirva: la evaluación es un estado vigente, no una
foto de un día. Si la semana siguiente el gerente aporta información nueva, se
ajusta el valor y la persona se mueve de cuadrante, sin perder de dónde venía.

Cada cambio queda registrado en el historial de la persona con la fecha, el
gerente con quien se evaluó y el motivo. Solo se registra cuando el valor
efectivamente cambia, así el historial cuenta movimientos y no reediciones.

## En esta solapa solo se evalúa

La tabla tenía el **nombre, la posición y la fecha de ingreso como campos
editables**, al lado de los desplegables de evaluación. Era fácil pisar el dato
de la nómina sin querer mientras se evaluaba a otro, y no había ningún motivo
para editarlos ahí: la conversación con el gerente es sobre desempeño y
potencial, no sobre cómo se escribe un apellido.

Ahora esas tres columnas **se leen**, y muestran el cargo real de la nómina en
vez de la posición genérica del panel. Lo único editable de la fila son
desempeño y potencial, que es el punto de la solapa.

**Se corrigen en la ficha de la persona**, desde *Nómina*. Ahí se agregaron el
apellido y nombre y la fecha de ingreso como campos editables: antes solo se
leían, así que sacarlos de esta tabla habría dejado un dato sin ningún lugar
donde arreglarlo —el caso concreto es un tipeo en el alta a mano—.

## El plantel no se arma acá

La tabla tenía **+ Agregar colaborador** al pie y un **✕** por fila. Las dos cosas
sobran: el plantel de una tienda sale de su nómina, y desde que la identidad de
la fila se lee, el botón de agregar creaba una fila vacía que ni siquiera se
podía completar ahí.

Ahora la tabla es **el plantel activo de esa sucursal**, la misma lista que
dibuja la matriz. Para sumar a alguien está el alta de *Nómina*; el pie de la
tabla lo dice y lleva.

Dos consecuencias que se ven:

- **Una baja desaparece sola de la tabla y del contador de sin evaluar.** Antes
  la tabla iba por su cuenta sobre `s.colaboradores` y listaba a los de baja
  —en gris, pero listados y evaluables— mientras el contador ya los excluía.
- **Borrar del padrón se hace desde la ficha de la persona**, que es a donde se
  llega desde cualquier pantalla. Ojo con la diferencia: *borrar* elimina a la
  persona con su evaluación, sus ausencias y su historial, y es para el que se
  cargó por error; **para el que dejó de trabajar lo que corresponde es la
  baja**, que lo conserva con su registro. El diálogo lo dice.

## Las dos escalas

**Desempeño** — qué resultados da hoy en su posición:

| | |
|---|---|
| 1 · Por debajo | No alcanza lo esperado para su posición |
| 2 · Esperado | Cumple con lo que la posición requiere |
| 3 · Supera | Consistentemente por encima de lo esperado |

**Potencial** — hasta dónde puede llegar:

| | |
|---|---|
| 1 · En su nivel | Aporta donde está; no se proyecta un salto |
| 2 · Puede crecer | Puede asumir una posición de mayor alcance |
| 3 · Alto | Puede crecer más de un nivel o cambiar de función |

## Los nueve cuadrantes

| Potencial \ Desempeño | Por debajo | Esperado | Supera |
|---|---|---|---|
| **Alto** | Enigma | Promesa | Estrella |
| **Puede crecer** | Inconsistente | Profesional sólido | Alto desempeño |
| **En su nivel** | Riesgo | Eficaz | Especialista |

Cada uno trae su lectura y la acción sugerida, que aparecen debajo de la matriz
para los cuadrantes que tienen gente.

## Cómo se ajusta

Dos caminos, equivalentes:

- **Los selectores de la tabla**, cuando estás cargando la evaluación con el
  gerente delante.
- **Arrastrar la persona** de un cuadrante a otro en la matriz, cuando el
  gerente te dice "a este lo veo mejor". El movimiento se confirma con un aviso
  que dice de dónde a dónde fue.

En ambos casos la fecha que se guarda es **la del día y el gerente de su
tienda**; con una visita abierta se fecha con la visita y el evaluador es el
gerente que figura en la minuta, que es el dato bueno cuando existe.

El `drop` de la matriz **exigía una visita abierta** y buscaba a la persona
adentro de esa visita. Con la pantalla movida al área eso dejaba la matriz de
adorno: se arrastraba y no pasaba nada, sin ningún aviso. Ahora la busca en el
padrón, como el desplegable de la tabla, que nunca tuvo el problema.

## Talent card

El botón *Ficha* despliega la ficha completa de la persona:

- **Formación** — si estudia y qué, el avance, la formación previa.
- **Desarrollo** — dónde quiere desarrollarse (con sus palabras), a qué posición
  aspira, si puede moverse de sucursal.
- **Lectura del desempeño** — fortalezas, qué necesita desarrollar, riesgo de
  salida.
- **Historial de evaluaciones** — cada movimiento con su fecha y motivo.

## En el reporte

El reporte al Gerente de Operaciones incluye una sección con la ubicación de
cada persona en la matriz, quiénes están listos para asumir más, quiénes tienen
plan de mejora pendiente, el riesgo de salida alto y quiénes están estudiando
con su interés de desarrollo.

## Talento y Sucesión son cosas distintas

Conviven dos matrices y conviene no confundirlas:

- **Talento y 9-box** evalúa **personas**: desempeño × potencial.
- **Sucesión** evalúa **posiciones**: criticidad × escasez de talento en el
  mercado, con sus candidatos y su *readiness*.

Una dice a quién desarrollar; la otra, qué puestos quedarían descubiertos. Se
cruzan cuando alguien del cuadrante Estrella o Promesa aparece como candidato de
una posición crítica.
