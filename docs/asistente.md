# El asistente

`#/asistente` es la pantalla de lo personal del coordinador: arriba la
conversación con Claude, abajo la agenda de siempre. Salió del grupo *Cada día*
—donde se mezclaba con el reporte del área— y la tira de pendientes desapareció
del panel general por la misma razón.

## Cómo funciona

`assets/js/asistente.js` usa la capacidad **`sample`** del visor de artifacts:
`await claude.use('sample')` devuelve la función que pregunta, o `null`.

**Si devuelve `null`, no pasa nada malo.** El panel abre desde `file://` y sin
conexión, así que el asistente es un agregado: la pantalla avisa que esa parte
necesita el visor, deshabilita el campo, y la agenda funciona igual. Nunca un
botón que no hace nada.

Cada pregunta viaja con una **radiografía del tablero** armada en el momento
—`Asistente.contexto()`—, porque el modelo no recuerda nada entre llamadas: lo
que no va en ese bloque no existe para él. Y se arma de nuevo cada vez porque el
tablero cambia mientras se conversa; al historial va la pregunta pelada, así la
tercera respuesta no contesta con la foto de la primera.

## Qué ve y qué no

Va: los números del área y de cada sucursal, las visitas con su check list, los
reclamos abiertos, las cesiones sin cerrar, las bajas y la agenda. Los nombres
aparecen solo donde hacen falta para entender de quién se habla —quién se fue,
quién reclamó, quién no cubre turno—.

**No va: CUIL, DNI, fecha de nacimiento, teléfono, domicilio, mails, banco ni
CBU.** No es una promesa: `e2e-asistente.js` revisa el texto que sale y falla si
aparece alguno. Son unos 2 KB con el área entera cargada.

## Las dos herramientas

El asistente puede escribir en la agenda, y solo ahí:

- `anotar_en_agenda(texto)` — pasa por `Store.anotarTexto()`, el mismo camino que
  escribir a mano, así que también le saca la fecha al texto.
- `marcar_hecho(id)` — el id es el que figura entre corchetes en el contexto.

No toca sucursales, plantel, visitas ni reclamos. Si en algún momento hace falta
que haga más, la herramienta se agrega acá y se documenta.

## Lo que hay que saber antes de usarlo

- **Lo paga quien abre la página.** La primera pregunta pide permiso en el visor.
- Si el artefacto está compartido públicamente, cualquiera con el link puede
  preguntar y ese consumo corre por la cuenta de quien publicó. Conviene tenerlo
  privado.
- `rate_limited`, `not_granted` y `cancelled` se muestran como respuesta en el
  hilo, sin reintentos automáticos.

## El calendario de Google

`#/asistente` muestra arriba **las reuniones de hoy**, leídas del calendario de
quien abre la página con la capacidad **`mcp`** del visor: las credenciales son
del viewer y el código nunca ve un token. El modelo además tiene la herramienta
`ver_agenda_del_dia`, así que puede cruzar la agenda con las reuniones —
"tenés visita a Olivos el jueves y una reunión a las 10".

Es **solo lectura**: `list_events` y nada más. No crea, no modifica, no borra.

### Cada error tiene su propio arreglo

Un cartel único de "algo falló" es el anti-patrón de esta capacidad: esconde la
única acción que arregla la página. Cada código tiene su texto y solo se
reintenta lo que el runtime marca como reintentable:

| Código | Qué dice la tira | Reintenta |
|---|---|---|
| `server_not_connected` | Agregá el calendario en claude.ai → Conectores | no |
| `needs_reauth` | Se venció el acceso, reconectalo | no |
| `selection_required` | Tenés más de un calendario y no elegiste | no |
| `server_unavailable` | Google no contestó, probá de nuevo | sí, con botón |
| `blocked_by_policy` / `approval_required` | La política de tu organización no lo permite | no |

### El día empieza acá, no en Londres

El rango que se le pide al conector sale de la medianoche **local**. Buscando
esto apareció un error que venía de antes: `hoyISO()` usaba `toISOString()`, que
devuelve la fecha UTC, así que **a partir de las 21:00 de Buenos Aires el panel
creía que era el día siguiente** — la agenda adelantaba vencimientos y el reporte
del día se cargaba con la fecha equivocada, justo a la hora en que se cierra la
jornada. Ahora las dos fechas son locales.

## Gmail

Todavía no. El conector pide re-autorización —el token venció— y no se publica
una página que llame a una herramienta cuyo formato de respuesta no se haya
visto funcionar de verdad: adivinarlo significa que se rompe recién cuando se
usa. Cuando el conector vuelva, se observa una llamada real y se agrega.
