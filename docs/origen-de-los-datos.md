# Origen de los datos del tablero

Qué se tomó de cada planilla del relevamiento inicial y qué no.

## Tablero de Estadísticas de RRHH de tienda (`TD01.xls`)

Es el esqueleto operativo. Se tomaron sus estructuras, no sus datos: la planilla
corresponde a otra empresa y a un período de 2012, y sirve como modelo de
formulario, no como información de las sucursales a cargo.

| Hoja | Qué aportó |
|---|---|
| `DOT` | Modelo de dotación en *heads* y *FTU's*: dotación estable, prorrateo de ingresos y egresos, horas extras y ausencias. Es la validación de la fórmula de FTE |
| `ORG` | Idea de estructura de tienda por niveles de mando |
| `ESTADISTICA (1)` | Planilla de sanciones: tipo, motivo, puesto, sector |
| `ESTADISTICA (2)` | Conceptos de ausentismo con su código, agrupados en inactivo / activo controlable / activo incontrolable |
| `ESTADISTICA (3)` | Registro de altas y bajas con motivo |
| `ESTADISTICA (4)` y `(5)` | Fórmulas de rotación: dotación promedio, rotación mensual, proyección anual, acumulado |
| `ESTADISTICA (6)` | Bajas por posición |
| `ESTADISTICA (7)` | Motivos de baja: renuncias, despidos, otros |
| `ESTADÍSTICA (8)` | Causas de rotación codificadas A-1 a C-3 |

## Planificador de dotación (`Dotacion_Selma_Abril2026_final2_1.xlsx`)

Aportó el **motor de decisión** de dotación: factor de cargas 1,65, benchmark de
10% de costo laboral sobre venta, 6% para estructura de soporte, la regla de
productividad de 6 tickets por hora cada 6 horas trabajadas, y el semáforo
Ampliar / Óptima / Revisar / Reducir.

Los datos de sus 18 sucursales pertenecen a otra red y **no se cargaron** en el
tablero: habrían quedado como información de Farmatodo sin serlo. Lo que se
incorporó son los parámetros y las fórmulas, verificados fila por fila
(ver `protocolo-fte.md`, sección 6).

También quedó registrada una observación de la planilla que se respeta en el
diseño: el costo laboral se arma **sumando los sueldos reales de cada sucursal**,
no aplicando promedios.

## Succession Planning Toolkit (`Succession_Planning_Toolkit.xlsx`)

Plantilla en inglés, sin datos cargados. Aportó la metodología del módulo de
sucesión: encuesta de criticidad y escasez en escala 1 a 3, mapa de calor,
disponibilidad del rol, *readiness* del candidato en tres tramos y las métricas de
cobertura (posiciones críticas, cuántas tienen plan, candidatos por posición).

Se tradujo y se acotó a lo que se puede relevar en una visita de tienda. El
*Talent Profile* completo del toolkit (historial, formación, plan de acción por
candidato) quedó fuera por ahora: es una herramienta de escritorio, no de campo.

## Nombres de sucursales

Las diez sucursales vienen como `sucursal1` … `sucursal10`, según lo pedido.
El código provisorio funciona como identificador interno y el campo *Nombre real*
es el que aparece en los reportes. Se pueden agregar o eliminar sucursales desde
la solapa correspondiente.
