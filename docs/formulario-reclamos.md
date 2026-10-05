# El formulario de reclamos de sueldo

El buzón compartido con los Gerentes de Tienda. Es un formulario de Google,
igual que el de *Recepción de ausencias* que ya usan.

## Por qué un formulario de Google y no algo propio

Se probaron tres caminos y este es el único que cumple las tres condiciones a
la vez.

**Los gerentes no tienen mail corporativo.** Eso descarta todo lo que pida
iniciar sesión: una página publicada de Claude con la capacidad `db` —donde
quien entra con el link puede leer pero no escribir— y un formulario
restringido a la organización.

**Y ya llenan uno.** El formulario de ausencias tiene 734 respuestas de 28
tiendas: está probado que con un link, sin cuenta y sin mail, esta misma gente
carga. No hay que inventar nada ni enseñarles nada.

**Y nada se pierde.** Las respuestas caen en una planilla sola, sin depender de
que el coordinador esté conectado ni de que el gerente se acuerde de mandar un
mensaje. Esa era la falla del anexo: armaba el texto pero alguien tenía que
enviarlo.

Queda un paso manual —pegar la planilla en el panel— y es el mismo gesto que ya
se hace con las ausencias. El Apps Script lo eliminaría, y está escrito y
documentado en `docs/apps-script.md` para cuando ese pegado moleste.

## Son dos formularios y no uno con dos ramas

El otro es el de **presentismo** —quién no vino hoy—, documentado en
`docs/formulario-presentismo.md`. Se puede hacer un solo formulario que
pregunte primero «¿qué venís a avisar?» y derive a dos secciones. No conviene:
son dos preguntas de dos escalas distintas —el día y lo que llevo—, la planilla
saldría con la mitad de las celdas vacías y al pegarla las filas de la otra rama
se cuentan como error, y las secciones con derivación son el paso donde uno se
pierde. Dos formularios chatos no tienen nada que configurar.

## Cómo crearlo

**Duplicá el de ausencias** en vez de empezar de cero: así los permisos
—quién puede responder, si pide iniciar sesión— quedan como los que ya
funcionan, que es justo donde uno se pierde.

En Drive: clic derecho sobre el formulario de ausencias → **Hacer una copia** →
renombrarla y cambiarle las preguntas.

**Nombre:** `Reclamos de sueldo — Área 3`

**Descripción:**

> Para avisarle a RRHH que a alguien de tu equipo le pagaron mal. Lo llenás en
> un minuto y queda registrado con su fecha. Si llegó una carta documento o una
> intimación, no uses este formulario: llamá a RRHH.

## Las preguntas, en orden

| # | Pregunta | Tipo | Obligatoria |
|---|---|---|---|
| 1 | Tu nombre | Respuesta corta | sí |
| 2 | Tienda | Opción múltiple | sí |
| 3 | Apellido y nombre del colaborador | Respuesta corta | sí |
| 4 | DNI del colaborador | Respuesta corta | no |
| 5 | ¿Qué le pagaron mal? | Opción múltiple | sí |
| 6 | ¿De qué período? | Respuesta corta | sí |
| 7 | Monto aproximado | Respuesta corta | no |
| 8 | Contalo en dos renglones | Párrafo | sí |

### Por qué cada una

**1. Tu nombre.** El formulario no puede capturar el mail —no tienen—, así que
sin esta pregunta no se sabe a quién contestarle. Es lo que WhatsApp daba
gratis.

**2. Tienda**, de una lista cerrada. Texto libre acá significa «Botanico»,
«botánico» y «BOT» en la misma planilla, y el importador no las puede juntar.

**4. DNI y no legajo.** Se midió el padrón: el legajo está cargado en **0 de
141** personas y el DNI en 139. Con número el emparejamiento es exacto; sin
número el panel hace lo que puede por nombre y **nombra las filas que no cayeron
en nadie** en vez de perderlas. Por eso se pide pero no se exige: pedirlo
obligatorio haría que inventen uno.

**5. Opción múltiple y no desplegable.** Son quince opciones, y en un teléfono
un desplegable obliga a scrollear a ciegas adentro de una ventanita. La opción
múltiple las muestra todas y se elige con un toque.

**6. El período es obligatorio.** Sin él, Nómina no sabe qué liquidación
revisar, y es el dato que más se olvida de aclarar en un WhatsApp.

**7. El monto no es obligatorio** porque el gerente casi nunca lo sabe, y un
campo obligatorio que no se sabe se llena con cualquier cosa. Lo que entra con
un número se suma en el pedido a Nómina; lo que entra vacío no inventa nada.

**8. El detalle es obligatorio.** Es lo que permite verificar el reclamo contra
el recibo sin volver a preguntarle a nadie, y lo que se transcribe textual en el
pedido a Nómina.

## Las opciones de la pregunta 5

Son los `TIPOS_RECLAMO` de `reclamos.js`, **en ese orden y con ese texto
exacto**. El importador los empareja por nombre: si se cambia una palabra acá,
esa fila entra como *Otro* y se pierde el concepto.

En Google Forms se pueden **pegar las quince de una vez** en el primer campo de
opción: las separa solas por los saltos de línea.

```
Horas extras no liquidadas
Adicional nocturno
Feriado trabajado
Presentismo descontado
Francos no compensados
Vacaciones o plus vacacional
SAC / aguinaldo
Descuento indebido (faltante de caja u otro)
Categoría de convenio
Antigüedad mal computada
Aumento de convenio no aplicado
Asignaciones familiares
Obra social o ART
Uniforme o elementos de trabajo
Otro
```

«Otro» va último a propósito. La lista es cerrada para poder contar los
patrones —si todo cae en «Otro» no se ve de dónde vienen los reclamos— pero
sacarlo del todo haría que el gerente no pueda enviar, y eso es peor: que el
reclamo exista importa más que su etiqueta.

## Las opciones de la pregunta 2

```
Botánico
Devoto
La Nobleza
Mark
Olivos
Olleros
Parque Chacabuco
Rivadavia
San Martín Center
Scalabrini
Villa Devoto
Villa del Parque
```

Los **flotantes del área no están**: no son una tienda y ningún gerente carga
por ellos.

## La configuración que importa

En el engranaje de Configuración:

- **No** pedir iniciar sesión ni recolectar direcciones de correo. Si lo pide,
  los gerentes no pueden responder: no tienen mail corporativo.
- **Sí** dejar que respondan **más de una vez** — un gerente carga varios
  reclamos en la misma semana.
- **No** hace falta limitar a una respuesta por persona ni mostrar una barra de
  progreso.

Y en **Respuestas → Vincular a Hojas de cálculo**, crear la planilla. Es de
donde se copia para pegar en el panel.

## Cómo entra al panel

Se abre la planilla de respuestas, se selecciona desde la fila de encabezados
hasta la última respuesta, se copia, y se pega al pie de `#/reclamos`.

El importador empareja con el padrón usando `buscadorDePadron()` —el mismo de
los otros tres importadores: número primero, nombre después y solo sin
ambigüedad— y **no duplica**: la misma respuesta pegada dos veces entra una sola
vez, así que la planilla se puede volver a pegar entera todos los días.

La **marca temporal** que Google agrega sola es lo que identifica cada respuesta
y lo que permite no duplicarlas. No hay que tocarla ni borrar esa columna.
