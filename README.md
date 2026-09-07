# Panel de Control de RRHH — Farmatodo

Tablero para el trabajo de campo del Coordinador de RRHH: registrar las visitas a
sucursales, calcular el **FTE Real** y el **costo laboral por posición**, seguir
ausentismo, rotación, sanciones y sucesión.

De ahí salen **dos documentos distintos** para el Gerente de Operaciones: el
**reporte de la visita**, apenas se cierra cada visita, y la **estadística mensual
de la sucursal**, al cerrar el período.

Es un sitio estático: se abre haciendo doble clic en `index.html` o publicándolo
en GitHub Pages. No necesita servidor, base de datos ni instalación.

## Cómo empezar

1. Abrir `index.html`. La primera vez, la portada pide crear una clave de acceso:
   cifra el contenido guardado en esa computadora. También se puede entrar sin clave.
2. Ir a **Configuración**. El coordinador y el área vienen cargados; falta el
   nombre y el email del Gerente de Operaciones, y las copias si corresponde.
3. Ir a **Sucursales**. Vienen las doce sucursales del Área 3 con su ficha.
4. Desde **Visitas**, elegir la sucursal a la que vas y *Registrar visita*.
5. Completar las solapas y, al final, **Reporte y Envío**.
6. Al cerrar el mes, **Estadística mensual**: elegir sucursal y período, importar ahí
   la hoja del libro de novedades de liquidación, y enviar el informe.

Los datos quedan guardados en el navegador (`localStorage`). Para pasarlos a otro
equipo o archivarlos, usar **Exportar respaldo** en Configuración.

## Qué contiene cada solapa de una visita

| Solapa | Contenido |
|---|---|
| **Recorrida** | El check de la visita: 21 puntos en cuatro bloques, en el orden en que transcurre |
| **Minutas** | Reunión con el Gerente de Tienda (puntos y acuerdos) y con un colaborador (feedback y clima) |
| **FTE y Costo** | Matriz por posición: headcount, altas, bajas, ausencias, horas extras, sueldos, cargas, costo por FTE |
| **Ausentismo** | Días por concepto, separados en controlable (evitable) y no controlable (inevitable) |
| **Rotación y Bajas** | Rotación mensual y anualizada, altas y bajas con motivo y causa |
| **Sanciones** | Registro disciplinario del período |
| **Talento y 9-box** | Plantel de la sucursal, evaluación de desempeño y potencial con el gerente, matriz 9-box arrastrable y talent card por persona |
| **Sucesión** | Posiciones críticas, criticidad × escasez, candidatos y *readiness*, mapa de calor |
| **Dotación vs. Venta** | Dotación óptima según venta, % costo/venta, productividad por tickets/hora |
| **Reporte y Envío** | Diagnóstico, plan de seguimiento y envío del reporte de la visita |

## La nómina y el perfil de cada persona

El padrón del área se pega una vez en *Sucursales → Nómina del área* y reparte a
cada persona a su tienda con su cargo, sus fechas y su contacto. Desde ahí, el
nombre de cada sucursal abre **su propia pantalla**: indicadores del mes,
referentes, **organigrama** y visitas registradas.

Cada tarjeta del organigrama abre el **perfil** de esa persona: lo que trae la
nómina, los **talles de la ropa de trabajo**, y la **talent card** completa
—formación, desarrollo, fortalezas, riesgo de salida y el cuadrante del 9-box con
su historial—, la misma que se usa durante la visita.

El importador entiende tanto la nómina completa como el listado corto del área.
Los dos se complementan y conviene cargar los dos: el listado corto trae el
número de ficha de cada tienda, que la nómina no tiene.

Detalle en [`docs/nomina-y-perfiles.md`](docs/nomina-y-perfiles.md).

## Las novedades de liquidación

La planilla que arma Nómina todos los meses —una hoja por sucursal, una fila por
persona— se pega directo en *Estadística mensual* y carga de una sola vez el plantel,
las horas extras y los días de ausencia abiertos por concepto.

Lo que esa planilla **no** trae es la posición de cada persona: se asigna una vez
en *Talento y 9-box* y los meses siguientes la conservan. Con las posiciones
puestas, la solapa *FTE y Costo* de la visita ofrece **Traer la dotación del
padrón** y la matriz queda cargada sin tipear nada.

El detalle del formato, el mapeo de cada columna y las rarezas del archivo están
en [`docs/novedades-liquidacion.md`](docs/novedades-liquidacion.md).

## Los dos documentos

Son cosas distintas y se mandan en momentos distintos:

| | **Reporte de visita** | **Estadística mensual** |
|---|---|---|
| Cuándo | Al cerrar cada visita | Al cerrar el mes |
| De qué es | De esa visita | De la sucursal en ese período |
| Qué trae | Minutas, sanciones del día, 9-box, sucesión, diagnóstico y plan de acción | Dotación y FTE, costo laboral, ausentismo, horas extras, rotación, dotación vs. venta |
| Para qué sirve | Que el gerente y Operaciones tengan los compromisos por escrito | Que Operaciones tenga el número del mes |
| Dónde está | Solapa *Reporte y Envío* de la visita | Pestaña *Estadística mensual* |

La estadística mensual **consolida todas las visitas del período**. Si un mes tuvo
dos visitas, toma la matriz de la más completa y lo dice en el encabezado; si no
tuvo ninguna, se arma igual con todo marcado como pendiente.

Los dos van al mismo Gerente de Operaciones, con copia al Gerente de Tienda, y
cada uno deja su propio registro de envío.

## Documentación

- [`docs/protocolo-fte.md`](docs/protocolo-fte.md) — fórmulas de FTE, costo laboral,
  rotación y dotación óptima, con su verificación contra las planillas de origen.
- [`docs/automatizacion-email.md`](docs/automatizacion-email.md) — cómo dejar el envío
  del reporte 100% automático con Google Apps Script, Make o Zapier.
- [`docs/acceso-y-clave.md`](docs/acceso-y-clave.md) — qué protege la clave, qué
  no, y por qué no hay recuperación.
- [`docs/talento-9box.md`](docs/talento-9box.md) — escalas de desempeño y
  potencial, los nueve cuadrantes y la talent card.
- [`docs/recorrida-hrbp.md`](docs/recorrida-hrbp.md) — los 28 puntos de la
  recorrida, por qué están y en qué orden.
- [`docs/nomina-y-perfiles.md`](docs/nomina-y-perfiles.md) — el padrón de
  personas, el mapeo de cargos a posiciones y qué contiene cada perfil.
- [`docs/novedades-liquidacion.md`](docs/novedades-liquidacion.md) — cómo se
  importa el libro mensual de novedades y qué columna alimenta cada indicador.
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
