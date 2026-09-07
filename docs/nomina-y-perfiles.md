# La nómina del área y el perfil de cada persona

La nómina es el padrón maestro: **una fila por persona**, con su cargo, su
tienda, sus fechas y sus datos de contacto. Es lo que le faltaba al panel para
saber quién es quién — el libro de novedades trae los movimientos del mes pero
no el puesto — y de acá sale la dotación por posición de cada sucursal.

## Cómo se importa

**Sucursales → Nómina del área**: pegá la planilla completa, desde la fila de
encabezados. Es una sola pegada para toda el área: cada persona se reparte a su
tienda según la columna `TIENDA DONDE ESTÁ`.

Reimportar no duplica. La persona se identifica por CUIL —y por nombre si el
CUIL vino mal tipeado—, se le actualizan los datos y el cargo, y **no se tocan**
la evaluación de desempeño y potencial, la talent card, las notas ni los talles.
Si alguien cambió de tienda, se mueve con todo su historial.

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

**Del resto del panel:** la evaluación de desempeño y potencial con su cuadrante
del 9-box, y el historial de novedades de liquidación mes a mes.

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
- **Dos CUIL con doce dígitos** (MAÑAS NATALIA y GAURIS DANIEL NESTOR). Se
  importan igual y el panel los marca, pero conviene corregirlos en la nómina:
  con el CUIL mal, esa persona no se cruza con el libro de novedades.
- **Las últimas columnas están casi vacías**: PDI, estado civil, nacionalidad,
  banco y CBU tienen entre uno y cuatro datos sobre 139. El panel no las importa.

## Sobre los datos personales

La nómina trae domicilio, teléfono, DNI y mail personal. Todo eso queda
**únicamente en el navegador de esta computadora**, y si creaste una clave de
acceso queda cifrado con ella. El respaldo que exporta *Configuración* sale sin
cifrar, así que conviene tratarlo como lo que es.

Los datos bancarios de la nómina —banco y CBU— **no se importan**: no hacen
falta para nada de lo que hace el panel.
