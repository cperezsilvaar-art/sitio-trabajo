# El buzón de los Gerentes de Tienda

**Un solo link y tres cosas adentro.** El gerente entra, dice qué viene a avisar
y el formulario lo lleva a las preguntas que corresponden:

| Elige | Y contesta |
|---|---|
| *Alguien no vino* | tipo de licencia, desde, hasta, certificado, observaciones |
| *A alguien le pagaron mal* | concepto, período, monto, el detalle |
| *Necesito autorización de horas extras* | por qué, a quién cubre, cuántas, qué día |

Las cuatro primeras preguntas son comunes: la tienda, quién avisa, el
colaborador y su DNI.

## Se arma en Tally, y por qué

El coordinador descartó el formulario de Google tres veces, y el motivo no es
capricho: **se lee como un trámite**, y lo que el buzón viene a conseguir es que
el gerente se apropie de cargar lo suyo. Tally da un link que se abre sin
cuenta, se ve como una página y no como una planilla, tiene lógica condicional
en el plan gratis y un tablero propio donde entrar a mirar las respuestas.

**El costo está nombrado y lo decidió él**: los nombres del plantel y los
reclamos de sueldo quedan guardados en un servicio **fuera del Workspace de
Farmatodo**. Es un tratamiento de datos personales de terceros —Ley 25.326— y
corresponde que lo mire IT. No es una decisión de diseño.

Si IT no lo deja pasar, el camino de atrás está escrito y listo:
`apps-script/CrearFormularios.gs` arma el mismo buzón como formulario de Google,
adentro de la empresa, corriendo un script una sola vez.

## El texto de cada pregunta es código

La planilla de respuestas se pega al pie de `#/diario` y el panel ubica cada
columna **por lo que dice su encabezado**, quedándose con la primera que
coincide (`COLUMNAS_PARTE_AUSENTES`, en `ausencias.js`). Tally exporta con el
título de cada pregunta como encabezado, así que **las preguntas se llaman como
se llaman por eso**:

- **La persona se pregunta una sola vez, antes de la bifurcación.** Si cada
  rama tuviera su propio «Apellido y nombre…», habría tres columnas con ese
  encabezado y el panel se quedaría con la primera — que en una fila de ausencia
  está vacía, y entonces **ninguna ausencia caería en nadie**. Es además el
  diseño correcto: las tres cosas son sobre una persona.
- **La página de ausencias va primera**, porque «Tipo de licencia» tiene que
  ganarle a cualquier otra pregunta que diga «licencia» o «motivo».
- Por lo mismo, las de horas extras dicen **«¿Por qué hacen falta?»** y **«Si es
  para cubrir a alguien, a quién»**, sin esas dos palabras.
- **La pregunta de quién avisa no puede decir «nombre»**: se llevaría el nombre
  del gerente al lugar del colaborador.

Verificado en `e2e-formulario-unico.js` sobre las veinte columnas, con una
respuesta de cada rama: las ocho que el panel busca caen donde tienen que caer,
las ausencias entran con su motivo y sus fechas, la fila de horas extras no crea
ninguna, y volver a pegar la planilla no duplica.

## Cómo se arma en Tally

En Tally se escribe como en un documento y los bloques se insertan con `/`.

### Página 1 — la que ven todos

Título `RRHH Área 3 — avisos de tienda` y abajo, como texto:

> Para avisarle a RRHH de tu equipo: un error en el sueldo de alguien, una
> ausencia del día o un pedido de horas extras. Elegís qué venís a avisar y el
> formulario te lleva a las preguntas que corresponden.

| Pregunta | Bloque | Obligatoria |
|---|---|---|
| `Tu tienda` | Opción múltiple | **sí** |
| `Gerente que avisa` | Respuesta corta | **sí** |
| `Apellido y nombre del colaborador` | Respuesta corta | **sí** |
| `DNI del colaborador` | Respuesta corta | no |
| `¿Qué venís a avisar?` | Opción múltiple | **sí** |

Opciones de `Tu tienda`:

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

Opciones de `¿Qué venís a avisar?`:

```
Alguien no vino
A alguien le pagaron mal
Necesito autorización de horas extras
```

Al pie de la página, un bloque `/logic`:

| Si `¿Qué venís a avisar?` es | Entonces |
|---|---|
| Alguien no vino | ir a la página 2 |
| A alguien le pagaron mal | ir a la página 3 |
| Necesito autorización de horas extras | ir a la página 4 |

### Página 2 — `Alguien no vino`

> Cargalo el mismo día, aunque todavía no sepas hasta cuándo falta ni tengas el
> certificado en la mano.

| Pregunta | Bloque | Obligatoria |
|---|---|---|
| `Tipo de licencia` | Opción múltiple | **sí** |
| `¿Desde qué día no viene?` | Fecha | **sí** |
| `¿Hasta qué día? (si ya lo sabés)` | Fecha | **no** |
| `¿Te dejó el certificado?` | Opción múltiple | **sí** |
| `Observaciones` | Texto largo | no |

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

El certificado, con este texto exacto: `Sí` · `No` · `Todavía no`.

Al pie, un `/logic`: si `¿Qué venís a avisar?` es *Alguien no vino* → ir a la
página de agradecimiento. Sin eso, el gerente sigue de largo a las preguntas de
las otras dos ramas.

### Página 3 — `A alguien le pagaron mal`

> Si llegó una carta documento o una intimación, no uses el formulario: llamá a
> RRHH.

| Pregunta | Bloque | Obligatoria |
|---|---|---|
| `¿Qué le pagaron mal?` | Opción múltiple | **sí** |
| `¿De qué período?` | Respuesta corta | **sí** |
| `Monto aproximado` | Respuesta corta | no |
| `Contalo en dos renglones` | Texto largo | **sí** |

Los quince conceptos, en este orden y con este texto —son los que el panel
reconoce; si se cambia una palabra, esa fila entra como *Otro*:

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

Al pie, el mismo `/logic` hacia la página de agradecimiento.

### Página 4 — `Necesito autorización de horas extras`

> Cargalo antes de que se hagan: hay topes por persona y por mes, y una vez
> hechas no se pueden deshacer.

| Pregunta | Bloque | Obligatoria |
|---|---|---|
| `¿Por qué hacen falta?` | Opción múltiple | **sí** |
| `Si es para cubrir a alguien, a quién` | Respuesta corta | no |
| `Cantidad de horas solicitadas` | Respuesta corta | **sí** |
| `¿Qué día se harían?` | Fecha | **sí** |
| `Algo más que RRHH tenga que saber` | Texto largo | no |

```
Afluencia de público
Cubrir a alguien que falta
Inventario o tarea puntual
Otro
```

Es la última, así que no necesita lógica: sigue sola al agradecimiento.

### La página de agradecimiento

> Listo, quedó registrado con su fecha.
>
> Si pediste horas extras, ojo: **eso es un pedido, no una autorización**.
> Esperá la respuesta de RRHH antes de dárselas a nadie.

Ese último párrafo es el único punto donde el buzón puede fallar feo: sin él, el
gerente lee «enviado» como «aprobado» y las horas se hacen igual.

## Decisiones que no son de redacción

**El ART va aparte de la enfermedad.** Lo cubre la aseguradora y **no corre por
los plazos del art. 208** de la LCT: metido en enfermedad inculpable, el panel
mostraría un vencimiento de licencia paga que no existe.

**«¿Hasta qué día?» no es obligatoria.** Una ART recién abierta no tiene alta, y
pedir una fecha que nadie sabe se contesta inventándola. Sin fecha de fin la
licencia entra igual, abierta, y el Panel la pone arriba de todo pidiendo el
dato.

**«Sí» es lo único que el panel toma como certificado presentado.** Las otras
dos dejan la ausencia pidiendo el papel, que es el único estado que dice qué
hacer hoy. Un «Sí, lo tengo acá» no serviría.

**El DNI se pide pero no se exige.** Está cargado en 139 de 141 personas del
padrón, así que sirve para no confundir homónimos; exigirlo haría que inventen
uno. El emparejamiento es `buscadorDePadron()`: número primero, nombre después y
solo sin ambigüedad.

**Sin cuenta y sin pedir el mail**: los gerentes no tienen mail corporativo. Por
eso el formulario pregunta a mano quién avisa, que es lo que el WhatsApp daba
gratis.

## Cómo llega al panel

Tally sincroniza con una hoja de cálculo de Google, o exporta CSV. De ahí se
copia desde la fila de encabezados y se pega al pie de `#/diario`, igual que el
parte de ausentes de siempre.

**Si se sincroniza con Sheets, poner la planilla en configuración regional
Argentina** (*Archivo → Configuración*): si no, las fechas se copian al revés y
todo octubre entra como mayo sin que nada falle a la vista.

**Al pegar, las filas de reclamos y de horas extras se cuentan como salteadas**
porque no traen fecha de inicio. El aviso lo dice y no rompe nada: las ausencias
entran igual y no se duplican al volver a pegar. Si molesta, se filtra por
*¿Qué venís a avisar?* antes de copiar.

## Lo que todavía no entra solo

**Los reclamos y las horas extras no tienen importador.** Los reclamos se dan de
alta en `#/reclamos`, con el pegado del mensaje que ya funciona. Los pedidos de
horas extras se trabajan en el tablero de Tally —conviene marcar ahí cuáles se
autorizaron— y el dato que decide son los topes del **Decreto 484/2000**, 30
horas mensuales y 200 anuales por persona, que se leen en *El cierre del mes*.
