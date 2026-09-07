# Gestión Operativa de RRHH — Farmatodo

Tablero para el trabajo de campo del Coordinador de RRHH: registrar las visitas a
sucursales, calcular el **FTE Real** y el **costo laboral por posición**, seguir
ausentismo, rotación, sanciones y sucesión, y **enviar el reporte al Gerente de
Operaciones** apenas se cierra la visita.

Es un sitio estático: se abre haciendo doble clic en `index.html` o publicándolo
en GitHub Pages. No necesita servidor, base de datos ni instalación.

## Cómo empezar

1. Abrir `index.html`.
2. Ir a **Configuración** y cargar el nombre del coordinador, el nombre y el email
   del Gerente de Operaciones, y las copias si corresponde.
3. Ir a **Sucursales**. Vienen diez sucursales provisorias (`sucursal1` … `sucursal10`).
   Reemplazar el campo *Nombre real* por el nombre que corresponda a medida que se
   conozcan las tiendas; el código provisorio queda como identificador interno.
4. Desde el **Panel de la red**, botón *Registrar visita* en la sucursal visitada.
5. Completar las solapas y, al final, **Reporte y Envío**.

Los datos quedan guardados en el navegador (`localStorage`). Para pasarlos a otro
equipo o archivarlos, usar **Exportar respaldo** en Configuración.

## Qué contiene cada solapa de una visita

| Solapa | Contenido |
|---|---|
| **Minutas** | Reunión con el Gerente de Tienda (puntos y acuerdos) y con un colaborador (feedback y clima) |
| **FTE y Costo** | Matriz por posición: headcount, altas, bajas, ausencias, horas extras, sueldos, cargas, costo por FTE |
| **Ausentismo** | Días por concepto, abiertos en inactivo / activo controlable / activo incontrolable |
| **Rotación y Bajas** | Rotación mensual y anualizada, altas y bajas con motivo y causa |
| **Sanciones** | Registro disciplinario del período |
| **Sucesión** | Posiciones críticas, criticidad × escasez, candidatos y *readiness*, mapa de calor |
| **Dotación vs. Venta** | Dotación óptima según venta, % costo/venta, productividad por tickets/hora |
| **Reporte y Envío** | Diagnóstico, plan de seguimiento y envío al Gerente de Operaciones |

## Documentación

- [`docs/protocolo-fte.md`](docs/protocolo-fte.md) — fórmulas de FTE, costo laboral,
  rotación y dotación óptima, con su verificación contra las planillas de origen.
- [`docs/automatizacion-email.md`](docs/automatizacion-email.md) — cómo dejar el envío
  del reporte 100% automático con Google Apps Script, Make o Zapier.
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
assets/js/modelo.js        cálculos: FTE, costos, ausentismo, rotación, dotación
assets/js/store.js         estado y persistencia local, respaldos
assets/js/reporte.js       armado del reporte y envío al Gerente de Operaciones
assets/js/app.js           interfaz y ruteo
```
