# El formulario de presentismo

El segundo buzón compartido con los Gerentes de Tienda: **quién no vino hoy y
hasta cuándo**. Es un formulario de Google, como el de reclamos de sueldo
(`docs/formulario-reclamos.md`) y como el de recepción de ausencias que ya
llenan.

## No es una entrada nueva del panel

Esto que llega es el **parte de ausentes** —el papel que hoy mandan los
gerentes cuando se acuerdan—, nada más que llenado por un formulario en vez de
una planilla armada a mano. Entra por donde ya entraba: pegando la planilla de
respuestas al pie de `#/diario`, con `importarParteDeAusentes()`.

Que no sea una tercera entrada importa. El panel tiene **dos** y son dos a
propósito:

| Lo que llega | Qué contesta | Por dónde entra |
|---|---|---|
| Recepción de ausencias | lo que fue pasando, con su certificado | `#/diario`, el formulario |
| **El parte** | quién no está **hoy** y **hasta cuándo** | `#/diario`, el parte |

Una es el pasado y la otra el presente. Lo que este formulario cambia no es
*qué* se mide sino que el parte deje de depender de que alguien se acuerde de
mandarlo.

## Por qué es otro formulario y no una rama del de reclamos

Se puede hacer un solo formulario con una primera pregunta —«¿qué venís a
avisar?»— que derive a dos secciones. **No conviene**, por tres razones:

- **Son dos preguntas de dos escalas distintas.** El panel entero está armado
  sobre eso: el día se mira en Presentismo y los reclamos en su pantalla. Un
  buzón que mezcla las dos obliga a separarlas del otro lado.
- **La planilla saldría con la mitad de las celdas vacías.** Las respuestas de
  una rama no tienen las columnas de la otra, y al pegarla en `#/diario` las
  filas de reclamos se cuentan como «sin fecha de inicio»: ruido en el aviso de
  todos los días.
- **Las secciones con derivación son el paso donde uno se pierde.** Dos
  formularios chatos no tienen nada que configurar.

El costo es un link más. Para el gerente son dos links con dos nombres claros,
que es más fácil que un formulario que primero le pregunta qué quiere hacer.

## Cómo crearlo

**Duplicá el de reclamos de sueldo** —o el de recepción de ausencias—: así los
permisos, que es donde uno se pierde, quedan como los que ya funcionan. En
Drive: clic derecho → **Hacer una copia** → renombrar y cambiar las preguntas.

**Nombre:** `Ausencias del día — Área 3`

**Descripción:**

> Para avisarle a RRHH que alguien de tu equipo no vino. Llenalo el mismo día,
> aunque todavía no sepas hasta cuándo falta ni tengas el certificado en la
> mano: eso se completa después.

## Las preguntas, en orden

| # | Pregunta | Tipo | Obligatoria |
|---|---|---|---|
| 1 | `Tu tienda` | Opción múltiple | sí |
| 2 | `Gerente que avisa` | Respuesta corta | sí |
| 3 | `Apellido y nombre del colaborador` | Respuesta corta | sí |
| 4 | `DNI del colaborador` | Respuesta corta | no |
| 5 | `Tipo de licencia` | Opción múltiple | sí |
| 6 | `¿Desde qué día no viene?` | Fecha | sí |
| 7 | `¿Hasta qué día? (si ya lo sabés)` | Fecha | **no** |
| 8 | `¿Te dejó el certificado?` | Opción múltiple | sí |
| 9 | `Observaciones` | Párrafo | no |

**El texto de cada pregunta es el encabezado de la planilla, y es lo que el
panel lee.** No está escrito así por gusto: `COLUMNAS_PARTE_AUSENTES`
(`ausencias.js`) ubica cada columna por lo que dice su encabezado, y hay tres
choques posibles que este texto esquiva.

- **2 no puede decir «nombre».** La columna del colaborador se busca por
  «apellido y nombre», «colaborador» o «nombre», y gana la **primera** que
  aparece. Una pregunta «Tu nombre» antes que la 3 se llevaría el nombre del
  gerente al lugar del colaborador, y cada respuesta caería en nadie.
- **7 no puede decir «licencia».** El motivo se busca por «tipo de licencia»,
  «motivo» o «licencia». Un «¿Hasta qué día tiene licencia?» puesto antes que
  la 5 sería leído como el motivo.
- **9 tiene que decir «Observaciones»**, no «Algo más que quieras contar»: las
  notas se buscan por «observacion», «comentario» o «nota».

Lo que el panel no reconoce lo ignora, así que la **marca temporal** que Google
agrega sola y la pregunta 2 viajan en la planilla sin molestar. La 2 está
igual porque sin ella no se sabe a quién preguntarle: es lo que el WhatsApp
daba gratis.

`e2e-formulario-presentismo.js` corre estos encabezados contra la tabla del
propio panel. Si una pregunta se renombra, esa prueba es la que avisa.

### Por qué la 7 no es obligatoria

Porque **una ART recién abierta no tiene alta**, y pedir una fecha que nadie
sabe se contesta inventándola. Sin fecha de fin la licencia entra igual,
abierta: queda como `sinAlta` y el Panel la pone arriba de todo pidiendo el
dato, que es exactamente lo que hay que reclamarle al gerente. Con fecha, en
cambio, **no hay ningún supuesto**: `diasSupuestos` queda en falso y esos días
están medidos, al revés de lo que llega por el formulario de recepción, donde
el certificado no dice cuánto dura y el panel toma un día.

### Por qué la 4 se pide pero no se exige

El emparejamiento con el padrón es por número primero y por nombre después. Se
midió: el DNI está cargado en **139 de 141** personas y el legajo en **0**. Con
número el emparejamiento es exacto; sin número el panel hace lo que puede por
nombre y **nombra las filas que no cayeron en nadie** en vez de perderlas.
Exigirlo haría que inventen uno, que es peor que no tenerlo.

## Las opciones de la pregunta 5

Pegalas de una vez en el primer campo de opción: Google las separa solas por
los saltos de línea.

```
Enfermedad con certificado
Accidente de trabajo (ART)
No vino y no avisó
Enfermedad de un familiar a cargo
Licencia por paternidad
Licencia por maternidad
Vacaciones
Otro motivo
```

`motivoDelParte()` las reconoce por pedazo de palabra, así que **se pueden
reescribir mientras la palabra clave quede**: «ART», «accidente», «familiar»,
«paternidad», «maternidad», «vacacion», «enfermedad». Lo que no se reconoce
entra como *Otra* en vez de perderse: que la persona no está es el dato, y el
motivo se corrige después en su ficha.

**El accidente de trabajo va aparte de la enfermedad y no es un detalle de
redacción**: lo cubre la aseguradora y **no corre por los plazos del art. 208**
de la LCT. Metido en enfermedad inculpable, el panel le mostraría al
coordinador un vencimiento de licencia paga que no existe.

**«No vino y no avisó» es la opción que más importa** y la que un formulario de
licencias se olvida: es la única ausencia que pide una conversación el mismo
día. Entra como *Otra* y **sí suma al ausentismo**.

**La maternidad, la paternidad y las vacaciones entran pero no son
ausentismo**: son tiempo previsto, y contarlas infla el número con algo que no
es un problema de la operación. Lo decide `motivoSumaAusentismo()`
(`ausencias.js`), en un solo lugar para los cuatro caminos por los que puede
entrar una licencia.

**El fallecimiento de un familiar no está en la lista.** Es una licencia del
art. 25 del CCT y se carga en la ficha de la persona; por acá entraría como
*Otra* y sumaría al ausentismo, que no corresponde. Si un gerente lo avisa como
«Otro motivo», hay que corregirle el motivo en la ficha.

## Las opciones de las preguntas 1 y 8

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

Los flotantes del área no están: no son una tienda y ningún gerente carga por
ellos.

Y el certificado, **con este texto exacto**:

```
Sí
No
Todavía no
```

«Sí» es lo único que el panel toma como certificado presentado. Las otras dos
dejan la ausencia como `pendienteJustificar`, que encabeza las alertas y es el
único estado que dice qué hacer hoy: reclamar el papel. Un «Sí, lo tengo acá»
**no sirve**: la lectura es exacta y entraría como si no lo hubiera.

## La configuración que importa

- **No** pedir iniciar sesión ni recolectar direcciones de correo: los gerentes
  no tienen mail corporativo y no podrían responder.
- **Sí** dejar que respondan más de una vez: puede faltar más de uno el mismo
  día.
- En **Respuestas → Vincular a Hojas de cálculo**, crear la planilla.
- En esa planilla, **Archivo → Configuración → Configuración regional:
  Argentina**. Es lo que hace que las fechas se copien como `5/10/2026` y no
  como `10/5/2026`. El panel lee día primero; con la planilla en otra región,
  todo octubre entraría como mayo y nada fallaría a la vista.

## Cómo entra al panel

Se abre la planilla, se selecciona **desde la fila de encabezados** hasta la
última respuesta, se copia, y se pega al pie de `#/diario`.

La planilla **se vuelve a pegar entera todos los días**: la misma respuesta no
entra dos veces, y la licencia que el gerente extiende —mandó otra respuesta
con un `hasta` más lejano— se **corrige** en vez de duplicarse. Si figuraba
cerrada y el parte dice que sigue, se reabre y queda anotada la
reincorporación que decía antes.
