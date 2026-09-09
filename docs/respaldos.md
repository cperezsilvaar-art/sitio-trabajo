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

## Contenido que no se pudo leer

Si al abrir hay contenido guardado que no se entiende y no hay clave puesta, el
panel **no lo pisa**: lo aparta en `…​.ilegible` y arranca vacío. El caso típico
es contenido cifrado abierto sin la clave. Configuración lo muestra y ofrece
descartarlo, pero conviene primero volver a entrar con la clave.
