# Novedades para la liquidación

Bloque al tope de `#/asistente` (*Mi agenda*). Código en `assets/js/agenda.js`
(los períodos y el detector), `store.js` (la marca sobre el apunte),
`reporte.js` (`textoNovedadesLiquidacion`) y `app.js` (`bloqueLiquidacion`).

## Qué pregunta responde

«¿Qué tengo que pasarle a Nómina antes del cierre?»

Durante el mes van apareciendo cosas que terminan en un recibo de sueldo: unas
horas extras, un franco trabajado, un adelanto, un faltante de caja. Llegan de a
una, sueltas, en un mail o en un WhatsApp de un gerente. **Anotarlas nunca fue el
problema: el problema es tenerlas todas juntas el día del cierre**, que es cuando
hay que mandarlas y cuando uno se acuerda de la que se olvidó.

Por eso no es una pantalla nueva sino una marca sobre la agenda, que ya es donde
caen cuando se pegan.

## No confundir con las otras dos cosas

| Dónde | Qué es |
|---|---|
| **Esto** (`item.liquidacion`) | Lo que **hay que pasar**, antes del cierre. |
| `c.novedades` | Lo que la liquidación **devolvió**, ya cerrado. El pasado agregado. |
| `c.ausencias` | La persona que hoy no está, con su certificado. |

## Cómo se marcan

**Solas.** `liquidacionDeTexto()` mira el texto que se pega contra
`PALABRAS_LIQUIDACION` —los conceptos de la planilla de Nómina: horas extras,
nocturnas, feriado y franco trabajado, adelanto, faltante de caja, día del
gremio, días de examen, mudanza, plus, viáticos, presentismo, embargo, SAC—. Si
aparece uno, el apunte queda marcado con el período que corresponde.

**Y a mano**, desde la ficha del apunte, con la misma casilla para marcar y para
desmarcar. Eso último no es un detalle: el detector se equivoca, y un falso
positivo que no se puede sacar ensucia el parte del cierre, que es justo lo que
este bloque viene a evitar.

## El período no es «el mes en curso»

`periodoDeLiquidacion(fecha, corte)` usa el **día de cierre**, que se configura
en `#/config` (`parametros.diaCierreNovedades`, 25 por defecto). Lo que aparece
después del corte **no llega a este recibo y va al siguiente**. Meterlo igual en
el mes en curso sería peor que no marcarlo: el día del cierre aparecería en la
lista algo que Nómina no va a tomar.

Los bordes están resueltos: el 30 de diciembre entra en enero del año siguiente,
y un corte puesto el 30 se ajusta al último día de febrero.

## El parte

`Reporte.textoNovedadesLiquidacion(periodo)` arma el texto que se manda, **agrupado
por sucursal**: así lo procesa Nómina —una hoja por tienda— y así se revisa antes
de mandarlo, tienda por tienda, para ver si no falta ninguna. Lo que no tiene
sucursal asignada va junto al final en vez de mezclado, porque esconderlo entre
las demás hace que se pase por alto justo cuando se está revisando.

Se copia o se descarga. **No se envía por mail desde el panel**: el correo no
está conectado y no lo va a estar (ver abajo).

## Una cosa que se ve y no se edita

El bloque lista apuntes que **también** están en su cajón por fecha. Ahí se
muestran siempre plegados (`fichaItem(..., { plegado: true })`): la misma ficha
editable abierta dos veces en la misma pantalla es un lugar de más donde
escribir y después no se sabe cuál de las dos quedó bien. Se edita en el cajón,
como cualquier otro apunte; el bloque es la lista de control del cierre.

El aviso de «cierran en N días» se enciende solo cuando falta poco **y** hay algo
sin cerrar. Un cartel permanente deja de leerse a los dos días.

## Por qué no se conecta al correo

Se evaluó leer el correo para detectar solo lo que requiere una novedad, y **el
coordinador decidió que no**: prefiere entrar a leer los mails él y pegar lo que
corresponda. Es una decisión suya, no una limitación técnica, y hay que
respetarla — no proponer la integración de vuelta.

Se apoya además en la regla del proyecto: *nunca publicar una página que llame a
una herramienta de un conector sin haber visto una request y una response
reales*. Con Gmail eso nunca se pudo observar.

## Alineación con el marco conceptual

- **Vosburgh:** es exactamente lo transaccional que hay que resolver rápido. El
  dato entra pegando el mail tal como llegó, sin tipearlo dos veces.
- **Ulrich:** el entregable lo recibe Nómina, y se juzga por si le sirve — por eso
  va agrupado por tienda, en el formato en que lo procesan, y no como una lista
  cronológica que sería más cómoda de generar.
