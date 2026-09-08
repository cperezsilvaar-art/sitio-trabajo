# Reportes a diario

La estadística mensual mide el mes que cerró. Este módulo mide **el día que
pasó**, que es la única escala en la que todavía se puede hacer algo: si hoy
faltaron tres personas en una tienda de ocho, la decisión es de hoy a la mañana.

Se carga con el dato del día anterior y se manda a Operaciones **antes de la
apertura**.

## Los cinco indicadores

| Indicador | Fórmula | Qué dice |
|---|---|---|
| Ausentismo diario | ausentes ÷ dotación planificada | La falta imprevista de personal en la jornada. Recarga al equipo presente y demora la atención. |
| Horas extras | horas extras ÷ horas ordinarias planificadas | Cuánta cobertura se compró en vez de dotarla. Sube el costo de la jornada. |
| FTE real del día | planificados − ausentes + (horas extras ÷ jornada) | La capacidad equivalente con la que efectivamente operó el equipo. |
| Novedades y bajas | conteo de renuncias, desvinculaciones, abandonos y licencias largas | Las vacantes críticas que hay que cubrir en las próximas jornadas. |
| Cobertura de turnos | presentes ÷ mínimo requerido | Si la tienda pudo abrir y operar en condiciones. Es el que manda. |

La jornada de referencia (8 horas por defecto) sale de **Configuración →
Parámetros → `horasJornada`**.

## Cómo se carga

1. Elegí el día en **Día reportado**. Por defecto es ayer.
2. **Traer la dotación del padrón** completa la dotación planificada y una
   propuesta de mínimo por sucursal, a partir del padrón del período. Solo
   completa lo que está vacío: nunca pisa lo que cargaste a mano.
3. Ajustá el **mínimo** de cada tienda: con cuánta gente abre en condiciones. Es
   el número que decide si hay que mover a alguien.
4. En **Ver** se agregan los ausentes con nombre y motivo, y las novedades del
   día. Los presentes se deducen solos (planificados − ausentes) salvo que los
   escribas.
5. **Horas extras** y su motivo, que es uno de cuatro: afluencia de público,
   cubrir una ausencia, promoción bancaria, inventario.

Los presentes se deducen y no se cargan porque en la tienda se cuenta quién
falta, no quién vino.

## Motivos de ausencia

Corto a propósito: en el día no hay legajo a mano, hay un llamado a las siete de
la mañana. La clasificación fina contra los códigos de liquidación se hace al
cierre del mes, en la estadística.

**Evitables** (la tienda puede trabajar sobre esto): falta sin aviso, faltó con
aviso sin justificar, permiso personal, llegada tarde que no cubrió el turno.

**Inevitables** (se administran, no se reducen): enfermedad con parte médico,
accidente de trabajo, licencia legal, vacaciones.

Esta división es la misma de la estadística mensual y por el mismo motivo:
llevar a comité un ausentismo que es casi todo vacaciones hace perder
credibilidad.

## El RDV

El **Reporte Diario de Ventas** que llega todas las mañanas trae, por tienda, la
venta de ayer, la del mes, lo requerido, la meta del día y las transacciones.

Para importarlo: abrí el archivo en Excel, andá a la hoja **RDV Operaciones**,
seleccioná desde la fila de encabezados —la que dice *Área … Tienda … Ayer …
Mes*— hasta la última tienda, copiá y pegá.

Se toman solo las filas del área configurada. Los nombres del RDV que no
coinciden con los del panel se resuelven con una tabla de alias:

| RDV | Panel |
|---|---|
| SAN MARTIN | SM CENTER |
| VILLA DEL PARQUE II | VILLA DEL PARQUE |
| 25 DE MAYO (NOBLEZA) | LA NOBLEZA |

Lo que no se puede ubicar se informa; no se descarta en silencio.

**La venta no cambia ningún indicador de RRHH.** Sirve para leer la cobertura
contra el volumen que efectivamente hubo que atender: el mismo hueco de personal
pesa distinto en un día flojo que en uno de promoción bancaria.

Dos índices distintos, que no hay que mezclar:
- **Índice del día** = venta de ayer ÷ meta de ese día.
- **Índice del mes** = acumulado del mes ÷ requerido acumulado.

Comparar la venta de ayer contra el requerido del mes entero da un desvío falso
de −80%.

## El documento

Cinco bloques fijos, en el orden en que se leen cuando hay diez minutos:

1. **Resumen ejecutivo del día** — dos o tres oraciones.
2. **Tablero de KPIs** — una fila por sucursal reportada, más el total del área.
3. **Qué significa esto para la operación** — la traducción al negocio.
4. **Alertas y desvíos** — ordenadas por gravedad: primero lo que impide operar,
   después lo que cuesta plata, al final lo que conviene corregir antes de que se
   vuelva costumbre.
5. **Acciones para mañana** — hasta cuatro, derivadas de las alertas. No se
   inventan: cada una responde a un desvío concreto del día.

Las sucursales sin carga quedan explícitamente afuera del cálculo y se listan al
final de las alertas. Un día sin reportar no es un día sin ausencias, y mezclarlos
daría un ausentismo optimista.
