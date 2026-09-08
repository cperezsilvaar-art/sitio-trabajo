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
