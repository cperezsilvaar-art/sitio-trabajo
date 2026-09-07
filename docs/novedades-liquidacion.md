# El libro de novedades de liquidación

Es la planilla que arma Nómina todos los meses: **una hoja por sucursal, una
fila por persona**, con las horas extras y los días de ausencia que van a
liquidación. Es la fuente más confiable que hay para tres cosas del panel, y
hasta ahora se cargaban a mano.

## Qué trae y qué no

**Sí trae:**

| Columna de la planilla | Adónde va en el panel |
|---|---|
| `APELLIDO`, `NOMBRE`, `CUIL`, `LEGAJO` | El plantel de la sucursal |
| `HORAS EXTRAS 50%` + `HORAS EXTRAS 100%` | Horas extras de la matriz de FTE |
| `DIAS ENFERMEDAD` | Ausentismo, concepto **085 Enfermedad** |
| `DÍAS DE VACACIONES` | Ausentismo, concepto **071 Vacaciones** |
| `DÍAS DE AUSENCIA NO JUSTIFICADA` | Ausentismo, concepto **081 Ausente sin aviso** |
| `AUSENCIA POR FALLECIMIENTO` | Ausentismo, concepto **052 Fallecimiento 1er grado** |
| `MUDANZA` | Ausentismo, concepto **054 Mudanza** |
| `DIAS EXAMEN` | Ausentismo, concepto **056 Examen universitario** |

De esos seis conceptos, **solo la ausencia no justificada es evitable**. El
resto son licencias y enfermedad comprobada: se planifican, no se gestionan.

`HORAS NOCTURNAS`, `TURNO`, `FERIADO TRABAJADO`, `DIA DEL GREMIO`, `FALTANTE DE
CAJERO` y `OBSERVACIONES` se guardan con la persona pero todavía no alimentan
ningún indicador.

**No trae la posición de cada persona.** No hay ninguna columna con el puesto:
la que más se le acerca es `SECTOR` (TIENDA / LAB / ADM), y solo aparece en dos
hojas. Por eso el puesto se asigna una vez, a mano, en la solapa *Talento y
9-box*, y de ahí en más los meses siguientes lo conservan.

## Cómo se importa

1. Abrí el libro del mes en Excel y andá a la hoja de la sucursal.
2. Seleccioná **desde la fila de encabezados hasta la última persona** y copiá.
3. En el panel: **Estadística mensual** → elegí la sucursal y el mes → pegá en
   *Novedades de liquidación* → **Importar**.

Se repite por cada hoja. La importación es acumulativa por sucursal y mes: si
volvés a importar la misma hoja no duplica a nadie, actualiza sus novedades y
respeta todo lo que hayas cargado a mano —posición, evaluación, talent card—.

Después, en la visita de ese período, la solapa *FTE y Costo* ofrece **Traer la
dotación del padrón**: llena mes completo, ausencias y horas extras por
posición, y completa el ausentismo por concepto. Los sueldos y las altas y bajas
quedan como estén: eso la planilla no lo trae.

## Dos rarezas del archivo que el importador resuelve solo

**Filas corridas.** En algunas hojas —en el libro de agosto, *LA NOBLEZA* y *SM
CENTER*— el bloque de identidad quedó desplazado una columna a la izquierda: el
legajo cayó bajo el encabezado `TIENDA` y el CUIL bajo `LEGAJO`. Las columnas de
novedades **no** están corridas. El importador ubica a la persona por el CUIL,
fila por fila, y lee las novedades por su encabezado; avisa cuántas filas venían
así.

Vale la pena saberlo porque leerlas mal cambia el número que más importa: con el
corrimiento aplicado a todo, los 23 días de vacaciones de SM CENTER se leen como
23 días de ausencia injustificada.

**Encabezados repetidos o distintos.** Alguna hoja repite `HORAS NOCTURNAS`, y
`DÍAS DE AUSENCIA NO JUSTIFICADA` aparece a veces abreviado. Los encabezados se
comparan sin acentos, sin espacios y en mayúsculas, y de cada campo se toma la
primera aparición.

## Qué revisar antes de dar los números por buenos

- **La hoja `RIVADAVIA`** del libro de agosto tiene `TIENDA = OLLEROS` en todas
  sus filas. El importador usa la sucursal que elegís en pantalla, no esa
  columna, así que no afecta la carga; pero conviene avisarle a Nómina.
- **Faltan dos sucursales**: el libro de agosto trae diez hojas, y el Área 3
  tiene doce. No están *Parque Chacabuco* ni *Villa Devoto*.
- **Quien no vino en la hoja del mes** y sigue activo en el plantel se lista
  después de importar: puede ser una baja que no registraste, o una hoja
  incompleta.
