# Presentismo del día y venta del día

La estadística mensual mide el mes que cerró. Este módulo mide **el día que
pasó**, que es la única escala en la que todavía se puede hacer algo: si hoy
faltaron tres personas en una tienda de ocho, la decisión es de hoy a la mañana.

Se carga con el dato del día anterior y se manda a Operaciones **antes de la
apertura**.

## Dos pantallas, no una

Son **dos preguntas distintas** y desde septiembre de 2026 viven separadas, a
pedido del coordinador:

| Pantalla | Ruta | Pregunta |
|---|---|---|
| **Presentismo** | `#/diario` (también `#/presentismo`) | ¿Quién vino y quién no? |
| **Ventas** | `#/operacion` (también `#/ventas`) | ¿Cuánto volumen hubo que atender? |

Lo que las separa no es una preferencia de orden: **el que las recibe hace cosas
distintas con cada una**. El presentismo se resuelve moviendo gente antes de la
apertura; la venta se lee después, para saber cuánto pesó el hueco. Mezcladas,
el informe que va a Operaciones tenía que explicar las dos y no se leía ninguna.

El único cruce que sobrevive es la **venta por persona presente**, y vive en la
pantalla de Ventas.

## Los cinco indicadores

| Indicador | Fórmula | Qué dice |
|---|---|---|
| Ausentismo diario | ausentes ÷ dotación planificada | La falta imprevista de personal en la jornada. Recarga al equipo presente y demora la atención. |
| Horas extras | horas extras ÷ horas ordinarias planificadas | Cuánta cobertura se compró en vez de dotarla. Sube el costo de la jornada. |
| FTE real del día | planificados − ausentes + (horas extras ÷ jornada) | La capacidad equivalente con la que efectivamente operó el equipo. |
| Novedades y bajas | conteo de renuncias, desvinculaciones, abandonos y licencias largas | Las vacantes críticas que hay que cubrir en las próximas jornadas. |
| Cobertura de turnos | presentes ÷ mínimo del día | Si la tienda pudo operar en condiciones. Es el que manda. |

La jornada de referencia (8 horas por defecto) sale de **Configuración →
Parámetros → `horasJornada`**.

## Cómo se carga

La carga es **de a una sucursal**. Arriba hay una ficha por tienda que dice en
qué estado está —sin cargar (○), sin novedades (✓), con algo que mirar (▲)— y se
abre una sola a la vez. La grilla de doce filas por siete campos vacíos no
existe: era imposible de mirar y se abandona en tres semanas.

1. Elegí el día en **Día reportado**. Por defecto es ayer.
2. **Traer la dotación del padrón** completa cuántos tenían que trabajar en cada
   sucursal, a partir del padrón del período (o del plantel cargado, si todavía
   no se importaron las novedades del mes). Solo completa lo que está vacío.
3. Abrí la primera tienda y cargá lo que tenga. **Sin novedades: dotación
   completa** despacha en un click las que abrieron con todos y salta a la
   siguiente sin cargar.
4. Los ausentes se agregan con nombre y motivo; las novedades del día también.
   Los presentes se deducen solos (planificados − ausentes) salvo que los
   escribas, porque en la tienda se cuenta quién falta, no quién vino.
5. **Horas extras** y su motivo, que es uno de cuatro: afluencia de público,
   cubrir una ausencia, promoción bancaria, inventario.

### El mínimo del día

De las personas previstas para el día, con cuántas la tienda funciona sin
resentir la atención —cubriendo apertura, cierre y mostrador—.

**No se estima.** Depende del horario, del mostrador y del recetario de cada
tienda; calcularlo como una fracción del plantel daba coberturas del 150% que no
querían decir nada. Se carga una vez por sucursal y queda para todos los días.
Hasta que se define, la cobertura de esa tienda no se calcula y el indicador del
área lo avisa.

El total del área **solo promedia las sucursales que tienen mínimo definido**.
Dividir los presentes de doce tiendas por el mínimo de una daba 2.825%.

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

## El RDV (pantalla *Ventas*)

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

### Por qué la venta no espera al presentismo

El RDV llega **completo** todas las mañanas; el presentismo se carga **tienda por
tienda** a lo largo del día. Cuando los totales de venta se armaban sobre las
sucursales con el día cargado, importar el RDV entero mostraba la venta de dos
tiendas de once y parecía un error de importación. Por eso `calcularDiario()`
devuelve `filasVenta` aparte de `filas`: la venta se suma sobre todas las
tiendas que la tienen.

La **venta por persona presente** es la excepción, y se calcula con las dos
puntas del mismo subconjunto —solo las tiendas que tienen venta *y* presentismo—.
Dividir la venta de once tiendas por los presentes de dos da un número que no es
de nadie.

## El documento de presentismo

Cinco bloques fijos, en el orden en que se leen cuando hay diez minutos:

1. **Resumen ejecutivo del día** — dos o tres oraciones.
2. **Tablero de KPIs** — una fila por sucursal reportada, más el total del área.
3. **Qué significa esto para la operación** — la traducción al negocio.
4. **Alertas y desvíos** — ordenadas por gravedad: primero lo que impide operar,
   después lo que cuesta plata, al final lo que conviene corregir antes de que se
   vuelva costumbre.
5. **Acciones para mañana** — hasta cuatro, derivadas de las alertas. No se
   inventan: cada una responde a un desvío concreto del día.

**La venta no está en este documento.** Tiene el suyo, en la pantalla de Ventas:
el día, la tabla por sucursal y la venta por persona presente.

Las sucursales sin carga quedan explícitamente afuera del cálculo y se listan al
final de las alertas. Un día sin reportar no es un día sin ausencias, y mezclarlos
daría un ausentismo optimista.
