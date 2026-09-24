# La nómina del área y el perfil de cada persona

La nómina es el padrón maestro: **una fila por persona**, con su cargo, su
tienda, sus fechas y sus datos de contacto. Es lo que le faltaba al panel para
saber quién es quién — el libro de novedades trae los movimientos del mes pero
no el puesto — y de acá sale la dotación por posición de cada sucursal.

## Cómo se importa

**Nómina → Nómina del área**, al pie de la pantalla: pegá la planilla completa,
desde la fila de encabezados. Es una sola pegada para toda el área: cada persona se reparte a su
tienda según su columna de tienda.

Entiende dos formatos, porque los dos circulan:

- **La nómina completa** (34 columnas): trae el cargo, las fechas, el contacto y
  la obra social. Es la que llena la posición de cada persona.
- **El listado corto del área** (`CUIL · FICHA · COLABORADOR · RAZON SOCIAL ·
  TIENDA · AREA · FECHA INICIO`): trae el **número de ficha de cada tienda**, que
  la nómina completa no tiene, y la fecha de inicio.

Conviene importar los dos: se complementan. `SIN TIENDA`, como llama el listado
corto a los flotantes del área, se reconoce como la misma tienda que
`FLOTANTES ÁREA 3` de la nómina completa.

Reimportar no duplica, y **no se tocan** la evaluación de desempeño y potencial,
la talent card, las notas ni los talles. Si alguien cambió de tienda, se mueve
con todo su historial.

### Cómo se reconoce a una persona que ya está cargada

Es la parte delicada, porque **los dos archivos difieren en el CUIL de varias
personas**: dígitos de más, un 2 donde va un 3. Con el CUIL solo, esas personas
entrarían dos veces. La búsqueda va en tres pasadas, de la más segura a la menos:

1. **Por CUIL exacto.**
2. **Por nombre completo**, letra por letra, sin acentos ni comas.
3. **Por apellido, primer nombre y sucursal**, las tres cosas a la vez. Es la
   que resuelve los casos donde un archivo agrega un segundo nombre —*PEREZ
   MARIEL* y *PEREZ MARIEL CATALINA*—, y la única que se informa después de
   importar, porque conviene mirarla.

Fundir dos personas distintas es peor que dejar una duplicada, así que la
tercera pasada nunca cruza de sucursal.

Cuando el CUIL que llega no coincide con el guardado, **se mantiene el
guardado** y el panel lista la discrepancia. No puede saber cuál está bien; lo
que sí puede es no perderla de vista. Vale la pena corregirlo en el origen:
con el CUIL mal, esa persona no cruza con el libro de novedades.

Con las fechas de ingreso pasa lo mismo, y ahí sí hay una regla: **gana la más
vieja**. La antigüedad reconocida no se pierde porque una planilla traiga la
fecha del último movimiento.

## Del cargo de la nómina a la posición del panel

La nómina abre el cargo mucho más que el tablero de FTE: distingue la jornada
parcial, el bloqueo de matrícula y el convenio. Para la dotación todo eso es la
misma posición:

| Cargo en la nómina | Posición en el panel |
|---|---|
| GERENTE DE TIENDA | Gerente de Tienda |
| ASISTENTE DE PISO DE VENTA SENIOR | Senior |
| ASISTENTE DE PISO DE VENTAS | APV |
| FARMACEUTICO AUXILIAR · …TP · FARMA AUX. JORNADA PARCIAL · FARM. AUX. BLOQUEO | Farmacéutico |
| DIRECTOR TECNICO · …CON BLOQUEO · …TP | DT |
| ASESORA DERMO | Asesora de Dermo |
| ASESORA DE BELLEZA | Asesora de Belleza |
| CHOFER · LIMPIEZA | Otros |

El cargo original queda guardado en el perfil de cada persona, que es donde el
detalle importa. Un cargo que no esté en la tabla se importa igual, pero sin
posición asignada: el panel lo lista para que lo resuelvas a mano.

*Asesora de Belleza* y *Otros* se agregaron al catálogo de posiciones al leer
esta nómina. Las visitas que ya existían suman esas filas a su matriz de FTE sin
perder nada de lo cargado.

## La pantalla *Nómina* (`#/nomina`)

El padrón entero en una lista, **flotantes incluidos**, con un buscador arriba
de todo. Es la pantalla que se abre cuando alguien pregunta por una persona y
hay que encontrarla ya: antes había que adivinar en qué tienda estaba y entrar
por su organigrama.

Cada línea trae lo mínimo para reconocer a la persona sin abrirla: **apellido y
nombre, sexo, puesto, sucursal, fecha de ingreso y antigüedad**, más un cartel
cuando corresponde —de baja, bloqueo de título, media jornada—. Tocar la línea
la despliega en la **ficha completa**, la misma del organigrama; tocarla de
nuevo la cierra.

- **El buscador filtra mientras se escribe** por nombre, sucursal, puesto,
  categoría, legajo, DNI y CUIL, sin acentos ni mayúsculas que valgan. Una sola
  caja para todo: no hay que elegir antes por qué campo se busca.
- **Mostrar** aísla activos o bajas. Por defecto están los dos, que es la
  pregunta normal —«¿trabajaba acá fulano?» no distingue—.
- **Ordenar por** apellido, sucursal, puesto, antigüedad o fecha de baja.

**Las bajas no salen del listado.** Al mes siguiente se sigue buscando a esa
persona por nombre —para la liquidación, para un certificado de trabajo, para
saber cuándo se fue— y una lista que las esconde obliga a ir a mirar a otro
lado. Van con su **fecha de baja** en el cartel rojo y no cuentan en la
dotación de piso, que es lo que separa una cosa de la otra.

El sexo lo trae la nómina pegada: `plantel-area3.js`, que es lo que hace que el
panel no abra vacío, no lo guarda, así que en un navegador recién limpiado esa
marca aparece recién después de pegar la planilla.

## Agregar a alguien a mano

Una persona entra a trabajar el lunes y la nómina de la compañía la trae recién
el mes que viene. Hasta entonces no figura en ningún lado y la dotación de su
tienda está mal. El bloque **Agregar un colaborador**, arriba de la lista, la
mete el mismo día.

Pide lo mínimo para que cuente: **apellido y nombre, legajo, DNI, sucursal, área
a la que pertenece, posición, fecha de ingreso, jornada y a quién le reporta.**

Lo demás se completa solo:

- **La posición trae su nivel de cargo, su categoría de la nómina y su posición
  del panel.** Salen de `CARGOS_NOMINA`, en `catalogos.js`.
- **Al guardar, la persona suma su FTE a la tienda elegida** y aparece en su
  organigrama, en el buscador de la nómina y en la dotación del área. El aviso
  dice cuánto sumó y cuánto tiene esa tienda ahora.
- **Un cargo que dice `TP` o `JORNADA PARCIAL` entra como 0,5 FTE** aunque el
  desplegable de jornada diga full time. Lo define el cargo: si no, la dotación
  de la tienda saldría mal y nadie lo notaría hasta el cierre del mes.
- **Un cargo con `BLOQUEO` suma a la nómina pero no a la dotación de piso**,
  como cualquier otro no presencial.

Si ya hay alguien con ese nombre en esa tienda, pregunta antes de guardar: casi
siempre es la misma persona cargada dos veces.

**Cuando después llega la planilla, la importación lo reconoce y le completa lo
que falta sin duplicarlo** — lo encuentra por nombre, que es la segunda de las
tres pasadas de arriba.

## Los cargos que existen hoy

`CARGOS_NOMINA`, en `assets/js/catalogos.js`, es la lista de los **catorce
cargos** que aparecen en las 139 fichas de la nómina de septiembre de 2026. Ni
uno inventado. Cada fila junta lo que en la planilla vive en cuatro columnas
distintas, porque en la práctica van juntas:

| Cargo | Nivel | Categoría | Posición | Jornada |
|---|---|---|---|---|
| GERENTE DE TIENDA | GERENTE DE TIENDA | FUERA DE CONVENIO | Gerente de Tienda | 1 |
| ASISTENTE DE PISO DE VENTA SENIOR | APV SENIOR | EMPLEADO ESP. DE FARMACIA | Senior | 1 |
| DIRECTOR TECNICO | DIRECTOR TECNICO | DIRECTOR TECNICO | DT | 1 |
| DIRECTOR TECNICO TP | DIRECTOR TECNICO | DIRECTOR TECNICO | DT | 0,5 |
| DIRECTOR TECNICO CON BLOQUEO | DT CON BLOQUEO | DT NO PRESENCIAL | DT | 1 · no cubre turno |
| FARMACEUTICO AUXILIAR | FARMACEUTICO | FARMACEUTICO AUXILIAR | Farmacéutico | 1 |
| FARMACEUTICO AUXILIAR TP | FARMACEUTICO | FARMACEUTICO AUXILIAR | Farmacéutico | 0,5 |
| FARMA AUX. JORNADA PARCIAL | FARMACEUTICO | FARMA AUX. JORNADA PARCIAL | Farmacéutico | 0,5 |
| FARM. AUX. BLOQUEO | FARM. AUXL. BLOQUEO | FARMA. AUX. BLOQUEO | Farmacéutico | 1 · no cubre turno |
| ASESORA DERMO | ASESORA DERMO | PERFUMERIA | Asesora de Dermo | 1 |
| ASESORA DE BELLEZA | ASESORA DE BELLEZA | PERFUMERIA | Asesora de Belleza | 1 |
| ASISTENTE DE PISO DE VENTAS | BASE FARMACIA | EMPLEADO DE FARMACIA | APV | 1 |
| CHOFER | CHOFER | INICIAL B | Otros | 1 |
| LIMPIEZA | LIMPIEZA | INICIAL B | Otros | 1 |

El orden es el del **organigrama**, de arriba hacia abajo, no el de cuántos hay
de cada uno: es el orden en el que se busca un cargo en una lista.

`MAPA_CARGOS` —lo que usa la importación para llevar un cargo a una posición del
panel— **se arma desde esta tabla**, así que no hay dos listas que mantener
sincronizadas. Si mañana la compañía crea un cargo nuevo, se agrega acá y
aparece en el alta a mano, en la importación y en el organigrama.

Las dos **unidades de negocio** del área están en `UNIDADES_NEGOCIO`:
`OPERACIONES - FARMACIA` (125 personas) y `OPERACIONES - LABORATORIO` (14, la
tienda y el laboratorio de Olivos).

## El perfil de cada persona

Se abre desde el organigrama de la sucursal o desde la pantalla *Nómina*,
haciendo clic en su tarjeta o en su línea.

**De la nómina, como dato:** número de personal, legajo de tienda, CUIL, DNI,
sexo, fecha de nacimiento y edad, obra social, estatus, fecha de ingreso y
antigüedad, ingreso a Farmatodo, razón social del contrato, unidad de negocio,
teléfono, mail corporativo y personal, domicilio y localidad.

**Cargado a mano:** los **talles de la ropa de trabajo** —remera o chomba,
camisa, pantalón, campera y calzado—, la posición si el cargo no se reconoció, y
las notas. La nómina no trae los talles: no hay ninguna columna con esa
información.

**La talent card completa**, la misma que se usa en la visita: formación
(si estudia, qué carrera y en qué avance), desarrollo (dónde quiere crecer, a
qué posición aspira, qué movilidad acepta), lectura del desempeño (fortalezas y
qué necesita para el próximo paso), riesgo de salida y notas. Se edita tanto
desde acá como desde la solapa *Talento y 9-box* de una visita: es el mismo
lugar de datos.

**Del resto del panel:** el desempeño y el potencial con su cuadrante del 9-box
y el historial de evaluaciones —cambiarlos desde el perfil también queda
registrado en ese historial—, y las novedades de liquidación mes a mes.

## La vista de la sucursal

Desde *Panel de la red* o *Sucursales*, el nombre de cada tienda abre su propia
pantalla: los indicadores del mes, los referentes, el **organigrama** y las
visitas registradas.

El organigrama no dibuja líneas: con tiendas de diez a treinta personas, las
líneas estorban más de lo que explican. Son bandas por nivel —el Gerente de
Tienda arriba; Senior, Farmacéutico y DT en el segundo; el piso de venta
abajo— y cada persona es una tarjeta que abre su perfil.

## Lo que conviene mirar de esta nómina

- **Siete gerentes de tienda para doce sucursales.** Devoto, La Nobleza, Mark,
  San Martín Center y Villa del Parque no tienen ninguno asignado en la nómina;
  dos de los siete figuran como flotantes del área.
- **`FLOTANTES ÁREA 3`** (cinco personas) y **`MAYOL`** (una) no son sucursales
  del padrón. El panel las crea como estructura de tipo staff para que esa gente
  no desaparezca, y avisa que lo hizo.
- **Faltan Parque Chacabuco y Villa Devoto**, igual que en el libro de
  novedades. Dos archivos seguidos sin ellas.
- **Seis personas tienen dos CUIL distintos** entre la nómina completa y el
  listado corto: GAURIS DANIEL NESTOR, MANSILLA DEBORA VERONICA, PEREZ MARIEL
  CATALINA, MAÑAS NATALIA LORENA, ANEROT ARIEL GERARDO e INSIGNARES CHIRINOS
  KEVIN ODACIR. En dos de esos casos la nómina trae doce dígitos, así que ahí el
  correcto es el del listado corto; en los otros cuatro hay que verificarlo.
- **Dos personas están solo en el listado corto** —DIAZ ROMERO IGNIELYS NICARITH
  y HERRERO CARLA ANDREA, las dos de Olivos— y **dos solo en la nómina
  completa**: ABAD GONZALO EZEQUIEL y CORDICH ANABELLA ELIDA, que son los dos
  que figuran como honorarios. Importando los dos archivos quedan las 141.
- **Las últimas columnas están casi vacías**: PDI, estado civil, nacionalidad,
  banco y CBU tienen entre uno y cuatro datos sobre 139. El panel no las importa.

## Sobre los datos personales

La nómina trae domicilio, teléfono, DNI y mail personal. Todo eso queda
**únicamente en el navegador de esta computadora**, y si creaste una clave de
acceso queda cifrado con ella. El respaldo que exporta *Configuración* sale sin
cifrar, así que conviene tratarlo como lo que es.

Los datos bancarios de la nómina —banco y CBU— **no se importan**: no hacen
falta para nada de lo que hace el panel.


---

## Nómina de septiembre de 2026

La planilla cambió dos encabezados y sumó cinco campos. El importador acepta las
dos versiones, así que un archivo viejo sigue entrando.

| Antes | Ahora |
|---|---|
| `TIENDA DONDE ESTÁ` | `NOMBRE DE SUCURSAL` |
| `Fecha de Ingreso a FTD` | `Fecha de Ingreso Farmatodo Ingreso a FTD` |
| `VP` | `DIRECCIÓN` |

Campos nuevos: **estado civil**, **nacionalidad**, **obra social / prepaga**,
**banco** y **CBU**.

### El banco y el CBU

Se importan desde esta versión, a pedido del coordinador. En la ficha aparecen
**plegados** bajo *Datos bancarios* y no salen en ningún reporte. La pantalla de
Configuración avisa que el respaldo exportado no está cifrado y los lleva
adentro.

### Los CBU que Excel rompe

Un CBU son 22 dígitos. Si la columna no está formateada como texto, Excel lo
guarda como número y lo escribe `7.00276300040573e+19`: se pierden los últimos
siete dígitos y **eso no se puede reconstruir**.

El importador los detecta y los marca en vez de guardarlos como si fueran
válidos, porque un CBU corrupto que parece correcto no lo vuelve a mirar nadie.
En el archivo de septiembre había dos así.

La solución está en el origen: formatear la columna CBU como texto antes de
exportar.


### Pegar desde Excel: las celdas con salto de línea

Cuatro encabezados de esta planilla tienen un **salto de línea adentro de la
celda**:

```
Razón Social⏎Contratado/a
Fecha de ⏎Nacimiento
Fecha de  Ingreso Farmatodo⏎Ingreso a FTD
Antigüedad ⏎en Farmatodo
```

Al copiar, Excel encierra esas celdas entre comillas y el salto viaja adentro.
Un lector que parta el texto por `\n` a secas rompe la fila de encabezados en
cinco y **pierde en silencio todas las columnas que vienen después** —incluida
`NOMBRE DE SUCURSAL`, que es la columna 10—.

Los tres importadores (nómina, novedades de liquidación y RDV) usan
`filasPegadas()`, en `catalogos.js`, que respeta el entrecomillado, une la celda
partida en una sola etiqueta y devuelve una fila por registro real. Con las 140
líneas de esta planilla, el pegado son 145 líneas físicas y 140 filas.

## La jornada: 1 FTE o medio

La nómina no trae una columna de jornada. El tiempo parcial viene escrito dentro
del cargo o de la categoría: `DIRECTOR TECNICO TP`, `FARMACEUTICO AUXILIAR TP`,
`FARMA AUX. JORNADA PARCIAL`. `jornadaDeVinculo()`, en `convenio.js`, lo lee de
ahí y devuelve **1** para la jornada completa y **0,5** para la parcial.

Por eso la dotación se suma en FTE y no en cabezas: dos personas de media
jornada cubren un puesto, no dos. La ficha de cada persona muestra la jornada y
deja corregirla a mano cuando el cargo está mal escrito; lo que se corrige a
mano manda sobre lo que dice la nómina.

En la nómina de septiembre de 2026 son tres: Facundo Miglio (Devoto), Laura
Kaplan (Scalabrini) y Marcelo Vassallo (SM Center). El área tiene 127 personas
de piso y **125,5 FTE**.

## Quién no cuenta en la dotación de piso

Tres situaciones distintas, que el panel separa una por una:

| Situación | Cómo se reconoce | Dónde aparece |
|---|---|---|
| **Bloqueo de título / no presencial** | El cargo o la categoría dicen `BLOQUEO` o `NO PRESENCIAL` | Aparte, en “Fuera de la dotación de piso” |
| **Flotantes del área** | Su tienda es `FLOTANTES ÁREA 3` | Como staff, no como tienda: suman al área, no a una sucursal |
| **Sin actividad** | Estatus `LICENCIA SIN GOCE DE SUELDO`, o dado de baja | Aparte, en “Sin actividad este mes” |

En septiembre de 2026: 6 con bloqueo, 5 flotantes y 1 con licencia sin goce.
139 personas en total, 127 en el piso de una tienda.

Olivos es un caso propio: la tienda y el laboratorio comparten dirección y la
nómina los pone en la misma fila de tienda. Son 13 FTE de farmacia y 13 de
laboratorio, y la ficha lo dice arriba del organigrama para que nadie lea 26
personas donde el mostrador tiene 13.

## Dos caminos para cargar el plantel

**Cargar el plantel del área** (`Nómina`, al pie) repone las 139
personas desde `assets/js/plantel-area3.js`, que es parte del proyecto. Es la
respuesta a que el navegador se limpie: el padrón de sucursales vuelve solo y el
plantel, hasta ahora, no.

Ese archivo guarda únicamente lo operativo —nombre, tienda, cargo, categoría,
nivel, jornada, fechas de ingreso, estatus y unidad de negocio—. **No guarda
CUIL, DNI, fecha de nacimiento, teléfono, domicilio, mails, banco ni CBU.** Esos
campos entran solo al pegar la planilla y viven solo en el navegador.

Los dos caminos usan el mismo importador, así que se complementan y ninguno
duplica a nadie: cargar el plantel y después pegar la nómina deja 139 personas,
0 nuevas y 139 completadas.

Cuando llegue una nómina nueva, el archivo se regenera desde el `.xlsx`; mientras
tanto, pegar la planilla alcanza para actualizar lo que cambió.

## Quién queda cargado y no vino en la planilla

Al importar, el panel compara contra lo que ya había **en las tiendas que la
planilla trae** —si se pegó una parte, el resto del área no tiene por qué
aparecer como faltante— y avisa quién estaba cargado y no vino.

No los borra: casi siempre es gente que se fue, y hasta que se les cargue la
baja siguen contando en la dotación de piso. El aviso es para ir a su ficha y
cargarla. Pegando la nómina de septiembre sobre el listado corto de agosto
aparecen dos: Diaz Romero y Herrero, las dos de Olivos.

## Quiénes son, tienda por tienda

El Panel (`#/red`) abre con una tabla de composición del plantel: **cuántas
mujeres y cuántos varones** hay en cada tienda, la **antigüedad promedio** y la
**edad promedio**. Sale de `composicionPorSucursal()` (`nomina.js`) y se dibuja
con `bloqueComposicion()` (`app.js`).

Son las tres preguntas que arman la conversación de capacidades con Operaciones:
una tienda de gente nueva no se supervisa como una de quince años de casa, y una
de once personas con cuatro mujeres no tiene el mismo problema de cobertura que
una de once con nueve.

### Cuenta personas, no FTE

Dos personas de media jornada son **dos personas**, no una. El FTE contesta
«cuánto turno cubro»; esto contesta «quiénes son», que es otra pregunta. Por lo
mismo, quien tiene bloqueo de título entra: es parte del plantel aunque no cubra
piso. Así que los números de esta tabla **no tienen que coincidir** con la
dotación de piso, y está bien que no coincidan.

### Por qué es una tabla y no un gráfico

Catorce tiendas y tres medidas de unidades distintas. Cualquier gráfico único
obligaría a dos escalas en un mismo eje, que es la forma más común de mentir sin
querer, y con más de siete categorías que todas importan la tabla gana siempre.

La única marca es la **barrita de composición**, que sí es parte de un todo, y va
siempre con los dos números escritos al lado más una referencia de color arriba:
la identidad nunca depende solo del color. Los dos tonos están validados para
daltonismo y contraste contra los dos fondos; los del modo oscuro se eligieron
contra el fondo oscuro y no se derivaron del claro.

### Los datos que faltan se dicen, no se rellenan

- La **edad** sale de la fecha de nacimiento, que por privacidad no está en la
  semilla del repositorio: entra al pegar la nómina del mes. Mientras no haya
  ninguna, la columna no se dibuja y el copete explica de dónde va a salir.
- El **sexo** sí está en la semilla (`sx`), porque si no el tablero abriría vacío
  en un navegador limpio.
- Un promedio calculado sobre parte del plantel dice **sobre cuántos**: «40,0
  años · sobre 13 de 136». Un promedio de trece fichas sobre ciento treinta y
  seis leído como si fuera de todas es peor que no mostrarlo.
- El porcentaje de mujeres se calcula **sobre quienes tienen el sexo cargado**,
  no sobre el total: con diez fichas incompletas, sobre el total mentiría hacia
  abajo.
