# El formulario de horas extras

El tercer buzón compartido con los Gerentes de Tienda, y el único que **pide una
respuesta**: el gerente avisa que necesita horas extras y espera que RRHH le
diga si puede. Los otros dos —reclamos de sueldo y ausencias del día— informan
algo que ya pasó.

## Qué contesta del lado del panel

`#/nomina/horas` (*Horas extras pedidas*), la cuarta solapa de `#/nomina`. Una
sola pregunta: **¿se lo autorizo?** Y la contesta con el único dato que la
decide: cómo queda esa persona contra los dos topes del **Decreto 484/2000**
—30 horas mensuales y 200 anuales por persona, sin autorización administrativa
previa— **si se le autoriza lo que está pidiendo**.

**Es la otra mitad de *El cierre del mes*, y son dos solapas a propósito.** El
cierre mira lo que la liquidación pagó: ahí un tope anual excedido es un dato
que ya no se puede cambiar —pasarse en un mes se corrige el mes que viene y
pasarse en el año no se corrige—. Acá el día todavía no pasó, que es el único
momento en que el número sirve para decidir algo.

### El número del mes sale de una fuente o de la otra, nunca de las dos

`horasDelPeriodo()` (`convenio.js`) devuelve las horas **y de dónde salen**:

- si el período **ya tiene novedades cargadas**, manda la liquidación: es lo que
  efectivamente se pagó, y lo que se había autorizado de ese mes ya está adentro;
- si no, mandan las **solicitudes autorizadas**, que es lo único que se sabe de
  un mes que todavía no cerró.

Sumar las dos contaría dos veces las mismas horas: 22 h liquidadas más 9 h
autorizadas del mismo período darían 31 h que nadie trabajó. Por eso cada fila
dice de dónde sale su número —«lleva 26 h liquidadas» y «lleva 26 h
autorizadas» se parecen y no son lo mismo: una todavía se puede cambiar—.

El año es el **calendario** y no los últimos doce meses, igual que en el cierre:
enero arranca de cero.

### Todo entra como pedido

Autorizar es una decisión del coordinador y **nunca la consecuencia de que el
gerente haya completado el formulario**. Volver a tocar el mismo botón destilda,
como el check list y los trámites de la baja, y destildar no borra la nota.

Lo que está sin contestar aparece además en la agenda (*Lo que quedó
pendiente*), y es el único pendiente del panel cuyo color **no sale de los días
que lleva abierto sino de los que faltan para el día en que se harían**:
contestar el martes lo que era para el sábado no es contestar, el gerente ya
decidió sin respuesta.

## Cómo crearlo

**Duplicá el de ausencias del día** —así los permisos quedan como los que ya
funcionan— y cambiale las preguntas.

**Nombre:** `Horas extras — Área 3`

**Descripción:**

> Para pedirle a RRHH autorización de horas extras. Cargalo **antes** de que se
> hagan: hay topes por persona y por mes, y una vez hechas no se pueden
> deshacer. Te contesto por el mismo canal de siempre.

**Mensaje de confirmación** (Configuración → Presentación → Mensaje de
confirmación). Este importa más que el resto:

> Listo. **Esto es un pedido, no una autorización**: esperá la respuesta de RRHH
> antes de darle las horas a nadie.

Sin ese mensaje, el gerente lee «respuesta enviada» como «aprobado», y las horas
se hacen igual.

## Las preguntas, en orden

| # | Pregunta | Tipo | Obligatoria |
|---|---|---|---|
| 1 | `Tu tienda` | Opción múltiple | sí |
| 2 | `Gerente que solicita` | Respuesta corta | sí |
| 3 | `Apellido y nombre de quien haría las horas` | Respuesta corta | sí |
| 4 | `DNI de quien haría las horas` | Respuesta corta | no |
| 5 | `Motivo de las horas extras` | Opción múltiple | sí |
| 6 | `Si es para cubrir una licencia, de quién` | Respuesta corta | no |
| 7 | `Cantidad de horas solicitadas` | Respuesta corta | sí |
| 8 | `¿Qué día se harían?` | Fecha | sí |
| 9 | `Algo más que RRHH tenga que saber` | Párrafo | no |

**El texto de cada pregunta es el encabezado de la planilla, y es lo que el
panel lee.** `COLUMNAS_SOLICITUD_HORAS` (`convenio.js`) ubica cada columna por
lo que dice su encabezado y gana la primera que coincide. Dos choques que este
texto esquiva:

- **La 2 no puede decir «apellido y nombre»**, o se llevaría el nombre del
  gerente al lugar de quien hace las horas.
- **La clave de la 6 es la frase «cubrir una licencia», no «de quién»**: con
  «de quién» a secas se llevaba la pregunta 3, que dice «de quien haría las
  horas». Las dos caían en la misma columna y nadie cubría a nadie.

`e2e-horas-pedidas.js` corre estos encabezados y estas opciones contra las
tablas del propio panel. Si una pregunta se renombra, esa prueba avisa.

### Por qué el día es obligatorio

Porque el tope es **mensual**: sin el día no hay mes contra el que leer las
horas, y entonces no hay nada que autorizar. Una fila sin día no entra y el
aviso del pegado la nombra. Lo mismo la cantidad de horas.

### Por qué el DNI se pide pero no se exige

El emparejamiento con el padrón es el mismo de los otros tres importadores
—`buscadorDePadron()`: número primero, nombre después y solo sin ambigüedad—.
El DNI está cargado en **139 de 141** personas y el legajo en 0, así que con
número el emparejamiento es exacto. Exigirlo haría que inventen uno.

**Lo que no cae en nadie no se inventa.** Un pedido cuelga de la persona
(`c.solicitudesHoras[]`, como `c.baja` y `c.ausencias`), así que sin ficha no hay
dónde ponerlo: se devuelve con nombre y el aviso dice que si es un alta nueva hay
que pegar primero la nómina del mes.

Cuelga de la persona y no de la tienda por una razón concreta: **los dos topes
son por persona**, así que lo pedido tiene que estar donde está lo liquidado para
poder sumarse. Y si la trasladan de tienda en el medio del mes, su acumulado del
año la acompaña.

## Las opciones de la pregunta 5

```
Afluencia de público
Cubrir una licencia
Inventario o tarea puntual
Otro motivo
```

La lista es corta a propósito: lo que cambia la decisión es si la carga es **del
negocio** —y entonces se discute con Operaciones— o si es un **agujero de
cobertura** —y entonces el problema es la licencia y no las horas—. Por eso la
pregunta 6 existe: «cubrir a Pérez» con Pérez de licencia desde hace tres
semanas es un pedido de dotación disfrazado de horas extras.

`motivoDeSolicitud()` las reconoce **con borde de palabra**, que es la regla de
`PALABRAS_DE_RECLAMO` y está acá por un motivo medido: con `includes()`,
«in**venta**rio» contiene «venta» y un inventario entraba como afluencia de
público. Es el mismo falso positivo que hacía que «sacaron» diera SAC.

## Las opciones de la pregunta 1

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

## La configuración que importa

- **No** pedir iniciar sesión ni recolectar direcciones de correo: los gerentes
  no tienen mail corporativo.
- **Sí** dejar que respondan más de una vez.
- El **mensaje de confirmación** de más arriba.
- En **Respuestas → Vincular a Hojas de cálculo**, crear la planilla.
- En esa planilla, **Archivo → Configuración → Configuración regional:
  Argentina**, o las fechas se copian al revés y todo octubre entra como mayo
  sin que nada falle a la vista.

## Cómo entra al panel

Se abre la planilla, se selecciona desde la fila de encabezados hasta la última
respuesta, se copia, y se pega al pie de `#/nomina/horas`.

**Se vuelve a pegar entera todos los días**: la marca temporal que Google agrega
sola identifica cada respuesta y no se duplica. Lo ya contestado se queda como
estaba.

El aviso del pegado **nombra a los que se pasan de un tope**, con cuántas horas
quedarían. Ese es el momento en que el número cambia una decisión, y el aviso es
donde se lo va a leer.

## Lo que no hace

**No contesta solo.** La respuesta se la da el coordinador por el canal de
siempre; el panel registra qué contestó y cuándo. Un formulario de Google no
puede devolverle nada al que lo completó, y armar un segundo circuito para eso
—una planilla publicada, un mail automático— es más mecanismo del que una
respuesta de una línea necesita.

**No controla el tope diario**, por lo mismo que el cierre del mes: haría falta
el reparto por día y lo que hay es el total.
