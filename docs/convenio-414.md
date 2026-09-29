# Convenio Colectivo 414/05 en el panel

El CCT 414/2005 (ADEF) es el que rige al Área 3. El panel no guarda el texto
completo: guarda **lo que se cuenta**.

Fuente: CCT 414/2005 (Res. S.T. 269/2005), con las modificaciones del Acuerdo
389/2009 (Res. S.T. 488/2009) y el Acuerdo 1209/2010 (Res. S.T. 1165/2010).

## Por qué existe este módulo

Las licencias del artículo 25 tienen tope: **dos días por examen y diez al año**,
cuatro días por enfermedad de un padre, seis por enfermedad de un hijo. Sin
registro de lo que cada persona se fue tomando, no hay forma de responder la
pregunta que aparece en el mostrador: *"¿me quedan días de estudio?"*.

Antes de este módulo esa respuesta era una estimación. Ahora es un número.

## Encuadre de cada persona

En la ficha del colaborador, sobre la base de su categoría de convenio y su
fecha de ingreso:

| Dato | De dónde sale |
|---|---|
| Categoría del convenio | art. 5 a 9, mapeada desde la columna *Categoría Convenio* de la nómina |
| Escalafón por antigüedad | art. 13 |
| Vacaciones que le corresponden | art. 24 |

**Escalafón (art. 13):** 1 año 5% · 2 años 10% · 5 años 20% · 10 años 30% ·
15 años 35% · 20 años 40% · 25 años 50%.

**Vacaciones (art. 24):** hasta 5 años 17 días · más de 5 y hasta 10, 26 días ·
más de 10 y hasta 20, 35 días · más de 20, 44 días. Todos corridos. Los dos
primeros tramos mejoran la Ley de Contrato de Trabajo (17 en vez de 14, 26 en
vez de 21).

La ficha también dice **cuándo salta al tramo siguiente**, que es la pregunta
que sigue.

### Cómo se mapean las categorías de la nómina

| Dice la nómina | Categoría del convenio |
|---|---|
| EMPLEADO DE FARMACIA | Empleado de farmacia (art. 7) |
| EMPLEADO ESP. DE FARMACIA | Empleado especializado (art. 8) |
| PERFUMERIA · CAJERO · ADMINISTRATIVO | Cajero, perfumería y administrativo (art. 6) |
| FARMACEUTICO · FARMACEUTICO AUXILIAR · FARMA. AUX. BLOQUEO · DIRECTOR TECNICO · DT NO PRESENCIAL | Farmacéutico (art. 9) |
| INICIAL B | Categoría Inicial "B" (art. 5) |
| FUERA DE CONVENIO · GERENTE DE TIENDA | Fuera de convenio |

Con la nómina de activos (139 personas) las 139 quedan encuadradas.

## El artículo 8 y el curso de ADEF

El art. 8 da **tres vías** a la categoría de *Empleado especializado de
farmacia*, y alcanza con una:

1. **5 años en el mismo establecimiento.**
2. **6 años en varios, con 3 en uno.**
3. El **título de Auxiliar de Farmacia** —el curso de ADEF— o el 2º año de la
   carrera aprobado.

Las dos primeras llegan solas con el calendario y no se negocian; la tercera es
la única que se puede empujar. Por eso el panel muestra el relevamiento del
curso y el reloj del artículo en la misma pantalla, `#/nomina/adef`: son el
mismo problema visto desde los dos lados. A quien le faltan cuatro años, el
curso le adelanta la categoría, y a la tienda le adelanta a alguien que puede
despachar; a quien le faltan seis meses, lo único que el curso cambia es quién
decide la fecha.

### Por qué no alcanza la antigüedad total

El artículo no pregunta cuánta antigüedad tiene sino **cómo se repartió**.
`tramosDeAntiguedad(colaborador, hoy)` la parte en tramos usando los traspasos
**ya aplicados**, que es todo lo que el panel sabe del recorrido de la persona:
quien nunca se movió tiene un solo tramo y es su antigüedad entera, que es el
caso de casi todo el plantel.

`situacionArt8(colaborador, hoy)` devuelve las tres vías por separado, cuál se
cumplió (`via`) y cuántos meses faltan para la primera que llegue por
calendario. Para la segunda vía, los tres años «en uno» solo pueden crecer en el
tramo actual: un tramo cerrado ya no suma.

### A quién le aplica

Solo al **Empleado de farmacia** (art. 7), que es la categoría desde la que se
asciende. Perfumería y caja están en el art. 6 y el farmacéutico en el 9, así
que para ellos el artículo no dice nada.

El **relevamiento del curso**, en cambio, es sobre **todo el plantel activo**:
saber quién se está formando es otra pregunta.

### El estado del relevamiento

`ESTADOS_ADEF` son cuatro: *no lo está haciendo*, *cursando*, *terminado* y *no
corresponde*. **«Sin relevar» no está en la lista y es a propósito**: es la
ausencia de `c.adef`. En un relevamiento la primera pregunta no es quién cursa
sino a quién todavía no le preguntaste, y un estado «no sé» mezclado con los
demás se tilda de apuro y borra esa diferencia. `Store.marcarAdef()` con estado
vacío borra el campo en vez de guardar una respuesta en blanco.

El aviso sale con **doce meses** de anticipación (`MESES_AVISO_ART8`): es lo que
tarda el curso, y antes de eso no sirve para decidir nada.

Quien ya cumplió el artículo y sigue cargado como Empleado de farmacia se ve en
esta pantalla y **no en la agenda**. Se probó ponerlo ahí: como se deduce del
padrón solo, el pendiente aparece en cuanto se carga el plantel y no se puede
cerrar desde el panel —se cierra cuando la liquidación cambia la categoría, que
puede tardar meses—. Un pendiente que no se puede tildar deja de leerse.

## Los topes del artículo 25

| Licencia | Art. | Cuánto | Tope |
|---|---|---|---|
| Matrimonio | 25 a) | 15 días corridos (12 si tiene menos de 1 año) | una vez |
| Nacimiento o adopción | 25 b) | 2 días hábiles | por evento |
| Enfermedad de un hijo | 25 c) | — | **6 días hábiles al año** |
| Enfermedad de padres o cónyuge | 25 c) | — | **4 días hábiles al año** |
| Fallecimiento de familiar | 25 d) | 4 días hábiles (6 si residía a más de 500 km) | por evento |
| **Estudio (rendir examen)** | 25 e) | **2 días corridos por examen** | **10 días corridos al año** |
| Donación de sangre | 25 f) | 1 día | por cada donación |
| Mudanza | 25 g) | 1 día hábil | por cada mudanza |
| Capacitación sindical | 25 h) | — | 21 días corridos al año (solo delegados) |
| Permiso gremial | 43 | — | 40 horas al mes, en no más de 8 veces |

En enfermedad de familiares se agregan dos días si la persona enferma está a más
de 500 km del lugar de trabajo.

## El contador se alimenta solo

El libro de novedades de liquidación que se importa en la estadística mensual
trae, **por persona y por mes**, las columnas de examen, fallecimiento, mudanza
y gremial. El panel las suma al contador del año automáticamente:

```
Estudio (rendir examen)   de liquidación: 8 (2026-03 · 2026-08)
2 corridos por vez        a mano: 4   usados: 12   tope: 10   le quedan: 0
⚠ Estudio: lleva 12 días y el tope del art. 25 e) es 10.
```

**La carga a mano es la excepción**, no la regla: sirve para lo que la
liquidación todavía no muestra, porque una licencia de este mes se liquida el
mes que viene y la pregunta del colaborador es hoy.

### Qué avisa

- **Se pasó del tope anual** — con el artículo, para poder mostrarlo.
- **Un evento más largo de lo que corresponde** — tres días por un examen cuando
  el convenio da dos.
- **Le quedan dos días o menos** — para avisarlo antes de que pida el tercero.

## Bloqueo de título y no presenciales

El farmacéutico que ejerce la Dirección Técnica **con bloqueo de título**
(art. 18 b) y el auxiliar con bloqueo (art. 18 c) prestan la habilitación
profesional que la farmacia necesita para abrir. Están en la nómina, cobran y
cuestan, **pero no están en el piso**: no cubren un turno ni reemplazan una
ausencia.

Contarlos en la dotación de la tienda infla la cobertura y hace ver una sucursal
completa donde falta gente para atender. El panel los separa de todo lo
operativo:

| Dónde | Qué hace |
|---|---|
| KPI de la sucursal | Dice **Dotación en el piso** y aclara *“+ N que no cubren turno”* |
| Organigrama | Bloque aparte, **Fuera de la dotación de piso**, con borde punteado |
| Padrón del período | `personas` cuenta solo a los del piso; `noPresenciales` va aparte |
| Reporte diario | El prellenado de *tenían que trabajar* los excluye |
| Ausentes del día | No aparecen en la lista: nunca estuvieron previstos |
| Ficha | Chip ámbar con el motivo |

Se detectan por las palabras **BLOQUE** o **NO PRESENCIAL** en la categoría de
convenio, el cargo o el nivel de cargo. En el Área 3 son 6 de 139: cuatro
directores técnicos y dos auxiliares de farmacia.

Los directores técnicos **sin** bloqueo siguen contando normalmente: son seis y
sí están en el piso.

### Lo que no cambia

Siguen en la nómina y en el costo. Si hace falta su costo en la matriz de FTE
del mes, se carga a mano en la fila que corresponda: el panel avisa quiénes
quedaron afuera y por qué, en vez de descontarlos en silencio.

## Sanciones disciplinarias

Cada persona tiene su registro: fecha, tipo (llamado de atención,
apercibimiento, suspensión), motivo, días de suspensión, si fue notificada y una
nota.

Con **dos o más sanciones en los últimos 12 meses** el panel avisa: la
progresividad se mide sobre ese período, y la graduación tiene que tener
secuencia antes de aplicar una nueva.

Las sanciones que se cargan en la estadística mensual del período aparecen
también en la ficha, marcadas como tales y de solo lectura: se corrigen donde se
cargaron. Duplicarlas sería peor que no tenerlas.

## Ausencias mes a mes

Una fila por período con el detalle por concepto —enfermedad, vacaciones, sin
aviso, examen, fallecimiento, mudanza, gremial—, su total y las horas extras,
más la fila de totales del año. Sale del mismo libro de novedades.

## Lo que este módulo no hace

- **No liquida.** No calcula el sueldo ni los adicionales del art. 18; el panel
  no es un sistema de liquidación y no debería serlo.
- **No decide si una licencia corresponde.** Cuenta lo que se otorgó contra el
  tope. Si el caso es dudoso, la decisión sigue siendo del coordinador.
- **No trae la escala salarial vigente.** Los básicos del art. 12 son los de
  2005 y hoy los fijan las paritarias; ponerlos desactualizados sería peor que
  no tenerlos.
