# Protocolo de cálculo — FTE Real, costo laboral y dotación

Este documento fija las fórmulas que usa el tablero y deja registrada la
verificación de cada una contra las planillas de origen.

## 1. Convención de días

`Días trabajados` significa **días de vínculo laboral en el mes**, no días de
presencia efectiva:

- Una posición cubierta el mes completo aporta **30 días**.
- Un alta o una baja aportan **los días efectivos** de ese mes.
- El ausentismo se descuenta **aparte**.

### Cómo se cargan los ingresos y los egresos

Quien ingresó o egresó durante el mes **no se cuenta en la dotación de mes
completo**: entra solo con los días que efectivamente trabajó.

Esos días **se suman**, no se restan. Una persona que renunció el día 25 trabajó
25 días, y ese trabajo se prestó. Lo que baja el FTE es que hayan sido 25 y no
30, no la baja en sí misma.

Ejemplo — 5 APV todo el mes más una sexta persona que renunció el día 25:

| Campo | Valor |
|---|---|
| Mes completo | 5 personas |
| Egresos | 25 días |
| Días de vínculo | 5 × 30 + 25 = 175 |
| Personas equivalentes | 175 ÷ 30 = 5,83 |

El error a evitar es cargar 6 en “mes completo” **y** 25 en egresos: esa persona
quedaría contada dos veces (55 días para un solo puesto). El tablero avisa
cuando un valor de ingresos o egresos llega a 30 días o más, porque eso siempre
significa que la persona corresponde a la columna de mes completo.

La columna **Personas equiv.** existe para ese control: tiene que parecerse a la
dotación observada en la tienda.

Esta distinción es lo que evita el doble descuento: si en “días trabajados” se
cargaran días ya netos de ausencias, el ausentismo se restaría dos veces. Es la
misma convención de la hoja `DOT` del tablero de estadísticas, donde el FTU sale
de sumar dotación estable, prorrateo de ingresos y egresos, y horas extras, y
restar “Ausent + Vacac”.

## 2. FTE Real

```
FTE Real = (días de vínculo ÷ 30) − (días ausentes ÷ 30) + (horas extras ÷ 200)
```

Componentes, tal como los pide la gestión:

| Impacto | Fórmula |
|---|---|
| Ausencias y vacaciones | `− (días de ausencia ÷ 30)` |
| Horas extras | `+ (horas extras ÷ 200)` |
| Altas y bajas | `(días trabajados efectivos ÷ 30)` |

Los divisores 30 y 200 son parámetros editables en **Configuración**.

**Verificación 1 — caso de trabajo.** APV con 4 personas el mes completo, un alta
el día 11 (20 días), 6 días de vacaciones y 40 horas extras:

```
140/30 − 6/30 + 40/200 = 4,667 − 0,200 + 0,200 = 4,67 FTE
```

**Verificación 2 — hoja `DOT`, fila “Área Ventas”.** 79 heads el mes completo,
egreso de 1,2333 FTU, 0,485 FTU de horas extras y 4,2667 FTU de ausencias:

```
79 + 1,2333 + 0,485 − 4,2667 = 76,45167 FTU
```

El tablero reproduce ese valor con precisión de cuatro decimales.

## 3. Costo laboral

```
Costo Total Rol       = Sueldo Base + Costo Hs. Extras + Bonos/Otros + Cargas Sociales
Cargas Sociales       = (Sueldo Base + Hs. Extras + Bonos) × (factor − 1)
Costo Promedio por FTE = Costo Total Rol ÷ FTE Real
```

El **factor de cargas** por defecto es **1,65**, tomado del planificador de
dotación. Se puede cambiar en Configuración, o pisar el cálculo cargando el valor
real de cargas por posición al pie de la solapa *FTE y Costo*.

Cuando el FTE Real de una posición es cero, el costo por FTE queda en
`[PENDIENTE]` en lugar de dividir por cero.

## 4. Ausentismo

```
% ausentismo = días de ausencia ÷ días de vínculo del período
```

El corte que decide qué se puede hacer es si la ausencia **se podía evitar o
no**, con los códigos de la planilla original:

- **Controlable (evitable)** — se origina en factores donde la organización o el
  propio colaborador pueden incidir: ausente sin aviso (081), ausente con aviso
  (080), enfermo injustificado (084), permiso sin goce (082), suspensión (083) y
  permiso con goce. Entran acá las faltas injustificadas, los temas personales
  postergables, lo que se explica por clima o motivación, y lo que se repite por
  mala organización del tiempo.

- **No controlable (inevitable)** — enfermedad (085) y accidente (086)
  comprobados, accidente laboral a cargo de ART (031), maternidad (089), las
  licencias amparadas por ley (050 a 059), vacaciones (071), licencia de
  repartición oficial, y la fuerza mayor. No se gestionan: se planifican.

Los **días evitables** son los del primer grupo, y son los que corresponde
discutir con el Gerente de Tienda. Que una ausencia pese en la cobertura no la
vuelve gestionable: una licencia por maternidad hay que cubrirla, no reducirla.

**Sin goce de haberes** es un atributo aparte, no un tercer grupo: marca los días
que el colaborador no cobra de la empresa —los paga un tercero (ART, ANSES) o no
se pagan—. Cruza los dos grupos: una suspensión y una licencia por maternidad
son las dos sin goce, y solo la primera es evitable. Sirve para leer el costo,
no para decidir sobre qué trabajar.

**Verificación — consolidado de la planilla de ausentismo.** 277 días sobre 4.890
de vínculo dan 5,6646%, valor que el tablero reproduce.

> El detalle por concepto es informativo: el FTE Real se calcula con la columna
> “Días ausentes” de la matriz. Si ambos números no coinciden, el tablero avisa
> en pantalla y lo marca en el reporte.

## 5. Rotación

```
Nueva dotación    = dotación anterior + altas − bajas
Dotación promedio = (dotación anterior + nueva dotación) ÷ 2
Rotación mensual  = bajas ÷ dotación promedio
Proyección anual  = rotación mensual × 12
```

**Verificación — enero de la planilla de rotación.** Dotación 166 → 164, 4 bajas:
promedio 165, rotación 2,4242%, proyección anual 29,0909%.

Las bajas se clasifican en renuncias, despidos y otros, y admiten además la causa
de rotación codificada (A-1 a C-3) del tablero de estadísticas.

## 6. Dotación óptima según venta

```
Costo laboral real  = brutos × factor de cargas
% costo / venta     = costo laboral real ÷ venta neta
Costo por empleado  = costo laboral real ÷ empleados
Dotación óptima     = (venta × objetivo 10%) ÷ costo por empleado
Dotación máxima     = (venta × alerta 15%) ÷ costo por empleado
Ahorro / inversión  = costo óptimo − costo real
```

### La banda de costo laboral sobre venta

El costo laboral no se mide contra un único valor sino contra dos umbrales:

| Zona | Lectura |
|---|---|
| **Hasta 10%** 🟢 | Farmacia eficiente. Alta facturación por empleado, procesos optimizados, o peso fuerte de venta libre y perfumería, que requieren menos personal especializado por volumen o tienen mejor margen |
| **Entre 10% y 15%** 🟡 | Por encima del objetivo pero por debajo del techo. Conviene entender qué lo empuja: horas extras, cobertura de francos o venta por debajo de lo previsto |
| **15% o más** 🔴 | Techo de alerta. Suele significar tienda sobreestructurada, caída de ventas, o un modelo operativo costoso: horario extendido con plus nocturnos y horas extras, o recetario magistral de alta demanda de mano de obra |

De ahí salen dos dotaciones distintas: la **óptima**, que es la que sostiene el
presupuesto del objetivo, y la **máxima**, que es hasta dónde llega la venta
antes de tocar el techo de alerta. Entre ambas hay margen de decisión; por
encima de la máxima, no.

Cuando la tienda supera el techo, el diagnóstico automático cruza el dato con lo
que el propio tablero ya sabe: si las horas extras están desviadas, lo dice; si
la dotación excede la máxima sostenible, lo cuantifica.

Para estructura de soporte el benchmark sigue siendo **6%** sobre la venta de la
red. Los tres valores se editan en Configuración.

Semáforo, según `diferencia = dotación óptima − dotación actual`:

| Diferencia | Lectura |
|---|---|
| ≥ +3 | 🟢 Ampliar dotación |
| 0 a +2 | ✅ Dotación óptima |
| −1 a −2 | 🟡 Revisar |
| ≤ −3 | 🔴 Reducir dotación |

**Verificación — sucursal MAR del planificador de dotación.** Brutos 43.675.071,
20 empleados, venta 840.688.942:

| Dato | Planilla | Tablero |
|---|---|---|
| Costo laboral real | 72.063.867,15 | 72.063.867,15 |
| % costo / venta | 8,5720% | 8,5720% |
| Dotación óptima | 23 | 23 |
| Costo óptimo | 82.873.447,22 | 82.873.447,22 |
| Ahorro / inversión | 10.809.580,07 | 10.809.580,07 |
| Semáforo | 🟢 Ampliar | 🟢 Ampliar |

El semáforo se validó además contra las 15 sucursales de venta de la planilla.

## 7. Productividad

```
Tickets por hora = tickets ÷ horas trabajadas
Cumplimiento     = tickets por hora ÷ objetivo (6)
```

Un cumplimiento por encima del 100% indica que la tienda vende más de lo que su
dotación sostiene: es el argumento cuantitativo para pedir una incorporación.

## 8. Sucesión

Criticidad y escasez se puntúan de 1 a 3. Una posición se considera **crítica**
cuando la criticidad es ≥ 2,5, o ≥ 2 combinada con escasez alta.

| Situación | Riesgo |
|---|---|
| Crítica y sin candidatos | Alto |
| Crítica, con candidatos, ninguno listo en menos de 1 año | Medio |
| Resto | Bajo |
