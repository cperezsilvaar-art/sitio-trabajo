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

## Nada de servicios personales del coordinador

El panel **no se conecta al calendario ni al correo**, y no hay que reponerlos.

`#/asistente` llegó a mostrar arriba las reuniones del día, leídas del calendario
de Google del visor con la capacidad `mcp`. Funcionaba bien y se sacó igual: lo
que aparecía en esa tira era la vida privada de una persona —turnos del médico,
el gimnasio— dentro de una herramienta de la empresa. Este es el tablero de
trabajo del coordinador; su calendario es suyo.

Se eliminó entero: la tira, `eventosDelDia()`, `horaDe()`, `explicarError()`, la
herramienta `ver_agenda_del_dia` del chat, y la declaración de la capacidad `mcp`
al publicar la página.

El correo siguió el mismo camino por dos motivos distintos que apuntan al mismo
lado. Primero quedó afuera por una regla técnica: **no se publica una página que
llame a una herramienta de un conector sin haber visto una request y una response
reales** —el token de Gmail estaba vencido y nunca se pudo observar—. Después el
coordinador decidió que **prefiere entrar a leer los mails él y pegar lo que
corresponda**, que es como funcionan hoy las novedades de liquidación
(`docs/novedades-liquidacion.md`).

Las dos reglas siguen valiendo para cualquier conector que se proponga más
adelante.

## El día empieza acá, no en Londres

Buscando el rango de fechas para el calendario apareció un error que venía de
antes y que **sigue importando aunque el calendario ya no esté**: `hoyISO()`
usaba `toISOString()`, que devuelve la fecha UTC, así que **a partir de las 21:00
de Buenos Aires el panel creía que era el día siguiente** — la agenda adelantaba
vencimientos y el reporte del día se cargaba con la fecha equivocada, justo a la
hora en que se cierra la jornada. Las fechas son locales desde entonces.
