# Documentos del legajo

Qué papeles tiene cada persona, hasta cuándo valen y dónde está el original.
Vive en `c.documentos[]` y se carga en la ficha de la persona, en `#/nomina`.

## El panel registra que el documento existe, no el documento

El pedido fue poder **subir archivos** —«tengo la constancia de alumno regular
de un empleado y la quiero subir ahí»—. Se midió el terreno antes de decidir, y
el terreno dijo que no.

### Lo que se midió

Abriendo el panel desde `file://` en Chromium:

| | |
|---|---|
| `localStorage`, donde vive el almacén | **4.864 KB en total** |
| El padrón cifrado, hoy | ~456 KB |
| Un PDF escaneado de una página, en base64 | ~400 KB |
| O sea | **diez u once documentos y se llena** |
| `IndexedDB` desde `file://` | **funciona**, guardó un blob de 2 MB; cuota ~1 GB |

### Por qué ninguna de las dos sirve

**`localStorage` no, y el modo de falla es el peor posible.** Cuando no entra,
`guardar()` **borra primero las copias automáticas** para hacer lugar y después
deja de guardar. Subir el sexto certificado volaría los respaldos del navegador
en silencio. Es el mismo modo de falla del bug de `String.fromCharCode(...bytes)`
en `b64()`: parece que el panel se borra solo.

**`IndexedDB` sí entraría, pero queda afuera de todo lo que protege al panel.**
Es un almacenamiento aparte: no lo toca el cifrado con clave, no entra en el
respaldo `.json` —que es la única salida— ni en las copias automáticas. Un
respaldo que se llevara los PDF adentro dejaría de pesar 340 KB y pasaría a
decenas de megas. Los archivos serían lo único del panel sin resguardo: si se
rompe la máquina, el registro se recupera y los documentos no.

### Lo que el panel sí puede hacer, y que no estaba en ningún lado

Una constancia de alumno regular **no es un papel que se guarda: es un papel que
se renueva**. Se emite por cuatrimestre y habilita los dos días por examen del
art. 25 e), hasta diez al año; si la persona está haciendo el curso de ADEF es
además la prueba de la tercera vía del art. 8.

Lo que faltaba no era el PDF: era **quién tiene constancia vigente, hasta cuándo
y a quién hay que pedirle la nueva**. Eso es exactamente lo que el panel hace
bien y no cuesta un byte de almacenamiento.

## Qué se guarda

`c.documentos[]`, cada uno con:

| Campo | |
|---|---|
| `tipo` | uno de `TIPOS_DOCUMENTO` (`catalogos.js`) |
| `recibidoEl` | cuándo llegó |
| `venceEl` | hasta cuándo vale. **Vacío si no vence** |
| `donde` | dónde está el original: legajo físico, carpeta compartida |
| `enlace` | opcional, para abrirlo en un clic |
| `notas` | número de trámite, con quién se hizo |

**Cuelga de la persona**, como `c.baja`, `c.ausencias`, `c.casos`,
`c.entrenamientos` y `c.planes`, así la acompaña si la trasladan de tienda. Está
en las dos listas de `unirColaboradores()`: un arreglo nuevo colgado de la
persona que no se suma ahí se pierde en silencio al unir dos fichas duplicadas,
que es lo que ya le pasó a `planes`.

## Solo lo que vence avisa

`estadoDeDocumento()` (`nomina.js`) devuelve `vencido`, `porVencer`, `vigente` o
`sinVencimiento`. **Un documento sin fecha de vencimiento no está incompleto**:
hay papeles que no vencen, y un contrato firmado es un registro y nada más. No
pide nada, por la misma razón por la que un contador en cero se esconde.

El aviso sale con **30 días** (`DIAS_AVISO_DOCUMENTO`): renovar una constancia
de alumno regular es ir a la facultad, y avisar la semana anterior es avisar
tarde. No es un plazo legal.

**El tipo sabe si se renueva.** `TIPOS_DOCUMENTO` trae `vence`, igual que
`CARGOS_NOMINA` trae la jornada, así que la fila de una constancia de alumno
regular sin fecha dice «se renueva: poné hasta cuándo vale» en vez de quedar
muda.

## Dónde aparece

**En la ficha de la persona**, como tabla editable en línea, con el patrón de
las sanciones: una fila por documento, lo que pide algo arriba y el botón de
quitar en la fila donde se lo ve.

**En la agenda**, entre los pendientes: `documentosQueVencen()` alimenta el
grupo *Documentos que hay que renovar* de `pendientesDelArea()` (`agenda.js`).
Es la regla de siempre —**lee, no copia**—: no se escribe nada en `e.agenda`,
cada línea es un enlace a donde se resuelve.

**Solo del plantel activo.** Perseguirle la constancia a alguien que ya se fue
es ruido; el historial sigue en su ficha igual, como las licencias viejas.

## El enlace se valida, y no es una precaución teórica

El campo lo escribe una persona y el valor termina en un `href`. Un
`javascript:` ahí es código corriendo adentro de la página que tiene el padrón
entero. `enlaceSeguro()` (`nomina.js`) acepta **solo `http` y `https`** y
cualquier otra cosa se muestra como texto con un chip que dice «no es un
enlace». `data:`, `file:` y un `JaVaScRiPt:` con mayúsculas alternadas quedan
afuera, y está probado.

Es el único lugar del panel donde algo escrito a mano se convierte en un enlace.

## Lo que no va acá

**El certificado médico del día no es un documento del legajo**: eso es una
ausencia, vive en `c.ausencias` y tiene su propio circuito —con su estado, su
vencimiento de licencia y sus plazos de los arts. 208 y 211—. `TIPOS_DOCUMENTO`
no tiene un tipo para eso a propósito.

De los exámenes médicos se registra **que están hechos y hasta cuándo valen**,
no su contenido. El informe queda en el legajo, por lo mismo que los casos en
seguimiento no guardan documentación: evita que una historia clínica termine en
el almacenamiento de un navegador.
