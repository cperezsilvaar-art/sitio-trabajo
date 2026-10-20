# Respaldos y copias automáticas

Todo el contenido del panel vive en el `localStorage` del navegador. Eso lo hace
rápido y privado —nada sale del equipo— pero también frágil: cualquier cosa que
limpie los datos del sitio se lleva el trabajo cargado. Hay tres formas de
perderlo, y una respuesta distinta para cada una.

## Qué puede borrar los datos

| Qué pasó | Se recupera con |
|---|---|
| Se apretó **Borrar todo** o **Cargar datos de ejemplo** | Copia automática |
| Se importó un respaldo equivocado | Copia automática |
| El navegador limpió los datos del sitio, o se cambió de equipo o de dirección | Respaldo `.json` |
| Se puso clave y se olvidó | Nada. El cifrado no tiene recuperación por diseño |

## Copias automáticas

Viven en el mismo navegador, en una clave aparte del almacén (`…​.resguardos`),
justamente para que las acciones que reemplazan todo el contenido no se las
lleven puestas. Se guarda:

- una **copia por día**, la primera vez que se abre el panel;
- una copia **antes de borrar todo**, antes de **cargar datos de ejemplo**,
  antes de **importar un respaldo** y antes de **restaurar otra copia**.

Se conservan las cuatro últimas. Si una copia tiene el mismo contenido que la
anterior, no se duplica. Si no entra en el almacenamiento, se suelta la más
vieja antes que perder la más nueva.

Con clave puesta, las copias quedan cifradas igual que el almacén: guardan el
texto tal cual está guardado, no el contenido en claro. Una copia hecha con otra
clave no se puede abrir y el panel lo dice al intentar restaurarla.

Se ven y se manejan en **Configuración → Copias automáticas de este navegador**.

## Respaldo `.json`

Es lo único que sobrevive a que el navegador borre los datos del sitio. Se
exporta desde **Configuración → Exportar respaldo**. **No está cifrado** y lleva
adentro los datos personales del padrón, incluidos banco y CBU: se guarda donde
se guardaría la nómina.

La pantalla de Configuración avisa cuando nunca se exportó uno, y cuando pasaron
más de siete días desde el último.

## Cuando el tablero abre vacío

Dos redes se tienden solas:

- El **panel general** avisa cuando no hay plantel cargado pero sí hay copias en
  el navegador, dice cuántas personas tiene la más reciente y ofrece
  restaurarla ahí mismo. Antes había que ir a buscarla a Configuración sabiendo
  que existía.
- Un guardado que no entra **ya no se traga en silencio**. `guardar()` suelta las
  copias para hacer lugar y reintenta; si igual no entra, deja el aviso y el
  panel general lo muestra arriba de todo. Un guardado que falla callado es la
  peor forma de perder trabajo: se sigue usando el panel una hora y el vacío
  aparece recién al recargar.

## Contenido que no se pudo leer

Si al abrir hay contenido guardado que no se entiende y no hay clave puesta, el
panel **no lo pisa**: lo aparta en `…​.ilegible` y arranca vacío. El caso típico
es contenido cifrado abierto sin la clave.

Configuración lo muestra y, si resulta que **sí se puede abrir**, dice cuántas
personas tiene y ofrece **recuperarlo**: ahí adentro está el trabajo de verdad y
descartarlo sería perderlo por segunda vez. Si no se puede abrir, queda la opción
de descartarlo, pero conviene primero volver a entrar con la clave.

## Qué hay guardado en este navegador

Cuando alguien dice “se borró todo”, lo primero es distinguir tres situaciones
que se ven igual en pantalla pero se arreglan distinto:

1. **El navegador quedó vacío.** No hay contenido guardado. El panel muestra las
   12 sucursales del padrón con su nombre y su razón social porque las trae el
   código, no porque estén guardadas: eso *parece* que sobrevivió algo, y no.
2. **El contenido está pero no se lee.** Hay contenido guardado, cifrado o roto.
   Nada se perdió todavía.
3. **Se reemplazó el contenido.** Hay contenido guardado, en claro, pero con
   menos adentro de lo que había.

**Configuración → Qué hay guardado en este navegador** contesta esas tres de una
sola mirada: si hay contenido y de qué tamaño, si está en claro o cifrado,
cuántas sucursales y personas tiene, y qué direcciones del navegador está usando
el panel. La tabla de copias, además, dice qué tiene adentro cada copia antes de
restaurarla.

## El guardado que fallaba con el padrón cargado

Vale la pena dejarlo escrito porque costó tres días encontrarlo. El base64 del
cifrado hacía `String.fromCharCode(...bytes)`, que pasa un argumento por byte.
Con el padrón del área cifrado son más de 150.000 y el navegador corta con
*Maximum call stack size exceeded*.

El efecto: con clave puesta y el padrón completo, **ningún guardado entraba**. Se
trabajaba normal toda la sesión —la pantalla mostraba lo que se iba cargando— y
al recargar volvía el último estado que sí había entrado, más chico. Parecía que
los datos se borraban solos.

No se veía antes porque con poco contenido el base64 entraba sin problema: el
error aparecía justo cuando el panel empezaba a tener datos de verdad.

Lo que lo destapó fue el aviso de guardado fallido. Un error tragado en la
consola habría seguido pareciendo un borrado espontáneo.
