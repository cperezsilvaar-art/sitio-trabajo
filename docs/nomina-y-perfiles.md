# La nómina del área y el perfil de cada persona

La nómina es el padrón maestro: **una fila por persona**, con su cargo, su
tienda, sus fechas y sus datos de contacto. Es lo que le faltaba al panel para
saber quién es quién — el libro de novedades trae los movimientos del mes pero
no el puesto — y de acá sale la dotación por posición de cada sucursal.

## Cómo se importa

**Sucursales → Nómina del área**: pegá la planilla completa, desde la fila de
encabezados. Es una sola pegada para toda el área: cada persona se reparte a su
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

## El perfil de cada persona

Se abre desde el organigrama de la sucursal, haciendo clic en su tarjeta.

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
