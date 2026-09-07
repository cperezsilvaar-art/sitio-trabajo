# Panel de Control de RRHH — Farmatodo

Tablero para el trabajo de campo del Coordinador de RRHH: registrar las visitas a
sucursales, calcular el **FTE Real** y el **costo laboral por posición**, seguir
ausentismo, rotación, sanciones y sucesión, tomar el **parte diario de asistencia
y horas extras** de las tiendas, y **enviar el reporte al Gerente de Operaciones**
apenas se cierra la visita.

Es un sitio estático: se abre haciendo doble clic en `index.html` o publicándolo
en GitHub Pages. No necesita servidor, base de datos ni instalación.

## Cómo empezar

1. Abrir `index.html`. La primera vez, la portada pide crear una clave de acceso:
   cifra el contenido guardado en esa computadora. También se puede entrar sin clave.
2. Ir a **Configuración**. El coordinador y el área vienen cargados; falta el
   nombre y el email del Gerente de Operaciones, y las copias si corresponde.
3. Ir a **Sucursales**. Vienen las doce sucursales del Área 3 con su ficha; falta
   cargar, en cada una, la **dotación esperada por turno**, que es contra lo que se
   mide el presentismo diario.
4. Desde el **Panel de la red**, botón *Registrar visita* en la sucursal visitada.
5. Completar las solapas y, al final, **Reporte y Envío**.
6. Para el día a día, **Parte diario**: el mensaje que se manda al grupo de WhatsApp
   y la carga de lo que reportan las tiendas.

Los datos quedan guardados en el navegador (`localStorage`). Para pasarlos a otro
equipo o archivarlos, usar **Exportar respaldo** en Configuración.

## Qué contiene cada solapa de una visita

| Solapa | Contenido |
|---|---|
| **Minutas** | Reunión con el Gerente de Tienda (puntos y acuerdos) y con un colaborador (feedback y clima) |
| **FTE y Costo** | Matriz por posición: headcount, altas, bajas, ausencias, horas extras, sueldos, cargas, costo por FTE. Cruza las horas extras contra las cargadas día a día en el parte |
| **Ausentismo** | Días por concepto, abiertos en inactivo / activo controlable / activo incontrolable |
| **Rotación y Bajas** | Rotación mensual y anualizada, altas y bajas con motivo y causa |
| **Sanciones** | Registro disciplinario del período |
| **Talento y 9-box** | Plantel de la sucursal, evaluación de desempeño y potencial con el gerente, matriz 9-box arrastrable y talent card por persona |
| **Sucesión** | Posiciones críticas, criticidad × escasez, candidatos y *readiness*, mapa de calor |
| **Dotación vs. Venta** | Dotación óptima según venta, % costo/venta, productividad por tickets/hora |
| **Reporte y Envío** | Diagnóstico, plan de seguimiento y envío al Gerente de Operaciones |

## El parte diario

Todos los días las sucursales reportan por un link que se comparte en el grupo de
WhatsApp: **las ausencias del día** (quién, de qué turno, por qué y si avisó) y
**las horas extras del día anterior** (quién las hizo, cuántas y por cuál de los
cuatro motivos: afluencia de público, cubrir una ausencia, promoción bancaria o
inventario).

Se pide con un día de atraso porque recién con el turno cerrado el gerente sabe
cuántas horas fueron. Eso alimenta, sin cargar nada dos veces:

- el **presentismo del día** por turno y para toda el área;
- el **ausentismo del mes** de cada sucursal, que se contrasta con lo cargado en
  la visita;
- las **horas extras acumuladas** del mes, por sucursal y consolidadas, con la
  apertura por motivo y su equivalente en FTE.

El formulario es un link de internet que se publica con Google Apps Script en
seis pasos: el paso a paso está en
[`docs/formulario-parte-diario.md`](docs/formulario-parte-diario.md) y el código
completo, en un solo archivo, en [`docs/parte-diario.gs`](docs/parte-diario.gs).

## Documentación

- [`docs/protocolo-fte.md`](docs/protocolo-fte.md) — fórmulas de FTE, costo laboral,
  rotación y dotación óptima, con su verificación contra las planillas de origen.
- [`docs/automatizacion-email.md`](docs/automatizacion-email.md) — cómo dejar el envío
  del reporte 100% automático con Google Apps Script, Make o Zapier.
- [`docs/acceso-y-clave.md`](docs/acceso-y-clave.md) — qué protege la clave, qué
  no, y por qué no hay recuperación.
- [`docs/talento-9box.md`](docs/talento-9box.md) — escalas de desempeño y
  potencial, los nueve cuadrantes y la talent card.
- [`docs/formulario-parte-diario.md`](docs/formulario-parte-diario.md) — el link
  que se manda por WhatsApp: cómo publicarlo, y cómo vuelven los datos al panel.
  El script está aparte, listo para copiar, en
  [`docs/parte-diario.gs`](docs/parte-diario.gs).
- [`docs/origen-de-los-datos.md`](docs/origen-de-los-datos.md) — qué se tomó de cada
  planilla del relevamiento inicial.

## Publicar en GitHub Pages

En el repositorio: **Settings → Pages → Source: Deploy from a branch**, rama
`main`, carpeta `/ (root)`. El sitio queda disponible en
`https://<usuario>.github.io/sitio-trabajo/`.

## Versión de archivo único

`build-pagina-unica.py` arma una copia del sitio en un solo `.html`, con el CSS y
el JavaScript embebidos, para publicarla o pasarla por correo:

```
python3 build-pagina-unica.py tablero.html
```

El orden de los archivos se lee de `index.html`, así que sumar un script al HTML
alcanza para que entre en la versión única: no hay una segunda lista que
mantener sincronizada.

Después de generarla, conviene abrirla y confirmar que el panel dibuja: si falta
un módulo, la página queda en blanco sin error visible.

## Estructura

```
index.html                 estructura de la página
assets/css/styles.css      estilos (claro y oscuro)
assets/js/catalogos.js     taxonomías: posiciones, ausentismo, bajas, sucesión
assets/js/sucursales-area3.js  padrón de las doce sucursales del Área 3
assets/js/modelo.js        cálculos: FTE, costos, ausentismo, rotación, dotación
assets/js/store.js         estado y persistencia local, respaldos
assets/js/reporte.js       armado del reporte y envío al Gerente de Operaciones
assets/js/app.js           interfaz y ruteo
```
