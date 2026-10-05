# El buzón de los Gerentes de Tienda

**Un solo formulario de Google y un solo link.** El gerente entra, dice qué
viene a avisar y el formulario lo lleva a la sección que corresponde:

| Elige | Y contesta |
|---|---|
| *Alguien no vino* | tipo de licencia, desde, hasta, certificado, observaciones |
| *A alguien le pagaron mal* | concepto, período, monto, el detalle |
| *Necesito autorización de horas extras* | por qué, a quién cubre, cuántas, qué día |

Las tres preguntas comparten las mismas cuatro primeras: la tienda, quién
avisa, el colaborador y su DNI.

## Por qué uno y no tres

Se evaluaron las dos formas. Tres formularios chatos no tienen nada que
configurar y dejan cada planilla limpia, pero son **tres links para repartir a
doce personas**, y el que se equivoca de link no manda nada. Uno solo es un
link y una respuesta a «¿dónde cargo esto?».

El coordinador eligió uno. Lo que hay que tener presente de esa elección está
abajo, en *Lo que cuesta tenerlo en uno*.

## Cómo se crea

**No se arma a mano.** `apps-script/CrearFormularios.gs` lo crea entero —las
tres secciones, la bifurcación, las opciones, cuáles son obligatorias y el
mensaje de confirmación— más la planilla de respuestas con la configuración
regional en Argentina.

Se corre **una sola vez** y **no se publica nada**: no es una aplicación web,
no hay que implementar ni configurar quién tiene acceso, que es donde se
complicó el intento anterior.

1. **script.google.com** con la cuenta de Farmatodo → Nuevo proyecto
2. Borrar lo que haya y pegar el archivo entero
3. Elegir la función `crearElBuzon` y **Ejecutar**
4. Autorizar. Si aparece «Google no verificó esta aplicación» →
   *Configuración avanzada → Ir a (tu proyecto)*
5. El link sale en el registro de ejecución

## El texto de cada pregunta es código

La planilla de respuestas se pega al pie de `#/diario` y el panel ubica cada
columna **por lo que dice su encabezado**, quedándose con la primera que
coincide (`COLUMNAS_PARTE_AUSENTES`, en `ausencias.js`). Con las tres cosas en
un mismo formulario eso deja de ser una formalidad y pasa a ser lo que hace que
funcione:

- **La persona se pregunta una sola vez, antes de la bifurcación.** Si cada
  sección tuviera su propio «Apellido y nombre…», habría tres columnas con ese
  encabezado y el panel se quedaría con la primera — que en una fila de ausencia
  estaría vacía, y entonces **ninguna ausencia caería en nadie**. Es además el
  diseño correcto: las tres cosas son sobre una persona.
- **La sección de ausencias va primera**, porque «Tipo de licencia» tiene que
  ganarle a cualquier otra pregunta que diga «licencia» o «motivo».
- Por lo mismo, las de horas extras dicen **«¿Por qué hacen falta?»** y **«Si es
  para cubrir a alguien, a quién»**, sin esas dos palabras.
- **La pregunta de quién avisa no puede decir «nombre»**: se llevaría el nombre
  del gerente al lugar del colaborador.

Las veinte columnas quedan en este orden:

```
Marca temporal · Tu tienda · Gerente que avisa ·
Apellido y nombre del colaborador · DNI del colaborador · ¿Qué venís a avisar?
  → Tipo de licencia · ¿Desde qué día no viene? · ¿Hasta qué día? (si ya lo sabés) ·
    ¿Te dejó el certificado? · Observaciones
  → ¿Qué le pagaron mal? · ¿De qué período? · Monto aproximado · Contalo en dos renglones
  → ¿Por qué hacen falta? · Si es para cubrir a alguien, a quién ·
    Cantidad de horas solicitadas · ¿Qué día se harían? · Algo más que RRHH tenga que saber
```

## Decisiones que no son de redacción

**El ART va aparte de la enfermedad.** Lo cubre la aseguradora y **no corre por
los plazos del art. 208** de la LCT: metido en enfermedad inculpable, el panel
mostraría un vencimiento de licencia paga que no existe.

**«¿Hasta qué día?» no es obligatoria.** Una ART recién abierta no tiene alta, y
pedir una fecha que nadie sabe se contesta inventándola. Sin fecha de fin la
licencia entra igual, abierta, y el Panel la pone arriba de todo pidiendo el
dato.

**El certificado se contesta `Sí` / `No` / `Todavía no`, con ese texto exacto.**
«Sí» es lo único que el panel toma como presentado; las otras dos dejan la
ausencia pidiendo el papel, que es el único estado que dice qué hacer hoy. Un
«Sí, lo tengo acá» no serviría.

**El DNI se pide pero no se exige.** Está cargado en 139 de 141 personas del
padrón, así que sirve para no confundir homónimos; exigirlo haría que inventen
uno. El emparejamiento es `buscadorDePadron()`: número primero, nombre después
y solo sin ambigüedad.

**Los quince conceptos de reclamo son `TIPOS_RECLAMO`, en ese orden y con ese
texto.** Si se cambia una palabra, esa fila entra como *Otro* y se pierde el
concepto.

**El mensaje de confirmación avisa que un pedido de horas extras no es una
autorización.** Es el único punto donde este formulario puede fallar feo: sin
ese renglón el gerente lee «respuesta enviada» como «aprobado» y las horas se
hacen igual.

**Sin iniciar sesión y sin recolectar el mail**: los gerentes no tienen mail
corporativo. Por eso el formulario pregunta a mano quién avisa, que es lo que el
WhatsApp daba gratis.

**Configuración regional de la planilla: Argentina.** El script ya la pone. Sin
eso las fechas se copian al revés y todo octubre entra como mayo sin que nada
falle a la vista.

## Lo que cuesta tenerlo en uno

**Al pegar la planilla en Presentismo, las filas de reclamos y de horas extras
se cuentan como salteadas**, porque no traen fecha de inicio. El aviso lo dice
—«2 no traían fecha de inicio y se saltearon»— y no rompe nada: las ausencias
entran igual y no se duplican al volver a pegar. Si molesta, se filtra la
planilla por *¿Qué venís a avisar?* antes de copiar.

Está probado de punta a punta en `e2e-formulario-unico.js`: una respuesta de
cada sección, las dos ausencias entran con su motivo y sus fechas, la de horas
extras no crea ninguna, y pegar la planilla dos veces no duplica.

## Lo que todavía no entra solo

**Los reclamos y las horas extras no tienen importador.** Los reclamos se dan de
alta en `#/reclamos`, con el pegado del mensaje que ya funciona; los pedidos de
horas extras se trabajan en la planilla —conviene agregarle a la derecha dos
columnas a mano, `¿Autorizado?` y `Respuesta`, que Google no toca— y el dato que
decide son los topes del **Decreto 484/2000**, 30 horas mensuales y 200 anuales
por persona, que se leen en *El cierre del mes*.
