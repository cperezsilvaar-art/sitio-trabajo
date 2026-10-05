# El buzón de los reclamos — guía de publicación

Esto se hace **una sola vez**. Son cinco pasos y unos quince minutos.

Al final el gerente aprieta **«Enviar a RRHH»** en el anexo y el reclamo
aparece solo en `#/reclamos`. Nadie copia ni pega nada.

## Qué estamos armando y por qué

El panel vive en el navegador y nadie puede escribir ahí desde afuera. Para que
el dato del gerente llegue sin que él lo mande por un mensaje hace falta **un
lugar donde el dato caiga**, y después que el panel vaya a buscarlo.

Ese lugar es una **planilla de Google tuya**, y lo que la hace escribible desde
el anexo es un **Apps Script** publicado como aplicación web. Corre en el Google
Workspace de Farmatodo: los datos no salen a ningún tercero.

```
Anexo del gerente  ──(Enviar a RRHH)──>  Apps Script  ──>  tu planilla
                                                              │
Tu panel  <──────────(lo lee al abrir)────────────────────────┘
```

## Paso 1 — La planilla

1. Andá a [sheets.new](https://sheets.new) con tu cuenta de Farmatodo.
2. Ponele un nombre: **Reclamos Área 3**.
3. No hace falta crear ninguna hoja ni encabezado: el script los crea solos la
   primera vez.

## Paso 2 — El script, adentro de esa planilla

1. En la planilla: **Extensiones → Apps Script**.
2. Se abre un editor con un archivo `Código.gs` que tiene un `function
   myFunction() {}`. **Borrá todo** lo que haya ahí.
3. Pegá el contenido de `apps-script/Codigo.gs` de este repositorio.

Que el script viva **adentro de la planilla** (y no como un proyecto suelto) es
lo que le permite escribir en ella sin pedir permisos extra.

## Paso 3 — La clave para leer

Arriba del archivo hay una línea:

```js
const CLAVE_PARA_LEER = 'PONER-UNA-CLAVE-LARGA-E-INVENTADA-ACA';
```

Cambiala por una clave larga e inventada —treinta caracteres o más—. No tiene
que ser recordable: la escribís acá una vez y me la pasás una vez, y nunca más.

**Para qué es.** Guardar un reclamo no pide clave, porque tiene que poder
hacerlo cualquier gerente con el link, sin cuenta y sin login. **Leer sí la
pide**, porque lo que se lee son nombres de personas y reclamos de sueldo. Esa
clave la va a conocer solamente tu panel. Es lo que hace que puedas repartir el
link del anexo a doce personas sin que ninguna pueda leer lo que mandaron las
otras.

Guardá el archivo (el disquete, o `Ctrl+S`).

## Paso 4 — Publicarlo

1. Arriba a la derecha: **Implementar → Nueva implementación**.
2. En el engranaje de la izquierda elegí **Aplicación web**.
3. Completá así, y esto importa:

| Campo | Qué poner | Por qué |
|---|---|---|
| Descripción | Buzón de reclamos | — |
| **Ejecutar como** | **Yo** (tu cuenta) | el script escribe en *tu* planilla |
| **Quién tiene acceso** | **Cualquier usuario** | si pide login, los gerentes no lo usan |

4. **Implementar**. Google te va a pedir autorizar: aceptá. Si aparece una
   pantalla que dice «Google no verificó esta aplicación», entrá en
   **Configuración avanzada → Ir a (tu proyecto)**. Es tu propio script: lo
   estás autorizando a escribir en tu propia planilla.
5. Te va a dar una **URL de la aplicación web**, parecida a esto:

```
https://script.google.com/macros/s/AKfycb..................../exec
```

## Paso 5 — Probar que anda, antes de seguir

Pegá esa URL en el navegador agregándole `?accion=ping` al final:

```
https://script.google.com/macros/s/AKfycb..../exec?accion=ping
```

Tiene que contestar:

```json
{"ok":true,"version":1}
```

**Si contesta eso, está listo.** Pasame dos cosas y conecto el anexo y el panel:

1. la **URL** completa
2. la **clave** que pusiste en el paso 3

## Si algo sale distinto

**«Se requiere autorización» al abrir el `?accion=ping`** → en *Quién tiene
acceso* quedó algo distinto de «Cualquier usuario». Implementar → administrar
implementaciones → editar → corregirlo.

**No aparece Extensiones → Apps Script** → la cuenta tiene Apps Script
bloqueado por la administración. Ahí hace falta pedírselo a IT: es el pedido que
está al final de este documento.

**Devuelve una página de error de Google en vez de JSON** → casi siempre es que
se pegó el código con el `function myFunction(){}` original todavía adentro.
Borrá todo y pegá de nuevo.

## Cada vez que cambie el código del script

Si más adelante hay que tocar `Codigo.gs`, no alcanza con guardar: hay que
**Implementar → Administrar implementaciones → editar (el lápiz) → Versión:
Nueva versión → Implementar**. La URL no cambia. Guardar sin volver a
implementar deja andando la versión vieja, y eso se busca durante media hora.

## El pedido para IT, si hace falta

> Necesito publicar un Apps Script como aplicación web dentro de nuestro Google
> Workspace. Es para que los Gerentes de Tienda del Área 3 puedan registrar los
> reclamos de sueldo de su gente en una planilla mía, en lugar de mandármelos
> por WhatsApp.
>
> - El script vive adentro de una planilla de mi propia cuenta de Farmatodo.
> - Se ejecuta con mi usuario y solo escribe en esa planilla.
> - Necesita acceso «Cualquier usuario» porque los gerentes lo abren desde el
>   teléfono y pedirles iniciar sesión haría que no lo usen.
> - **Ningún dato sale de Google Workspace**: no hay servicios de terceros, ni
>   almacenamiento externo, ni integraciones.
> - La lectura de los datos está protegida con una clave que solo conozco yo;
>   sin ella la dirección no devuelve nada.
