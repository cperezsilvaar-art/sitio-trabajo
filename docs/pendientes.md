# Pendientes del área

Lo que quedó para resolver afuera del panel: decisiones que las tiene que
confirmar la empresa, datos que faltan y avisos que hay que pasar. Lo que ya
tiene una pantalla donde seguirse vive ahí y no acá —esto no es una segunda
agenda—; son las cosas que no tienen todavía dónde caer.

## Horas extras: el circuito no está escrito

Hay que definirlo con Operaciones. Cuatro preguntas, y el proyecto solo
contesta dos:

**Cómo se piden — resuelto, falta usarlo.** La rama *solicitud de horas
extras* del formulario único (`docs/formulario-gerentes.md`) pide quién las
genera, el motivo —afluencia de público o cubrir una licencia, y de quién—,
cuántas horas, qué día se harían, y queda aguardando autorización. El gerente
no pide por WhatsApp: llena esa rama.

**Cuánto llevamos — resuelto, pero a mes cerrado.** `#/nomina/cierre` (*El
cierre del mes*) ya lo muestra por persona y por tienda, contra los dos topes
del **Decreto 484/2000**: 30 horas mensuales y 200 anuales. El acumulado anual
se calcula sobre los meses cargados y la pantalla lo dice. Sale de
`c.novedades`, o sea de lo que la liquidación terminó pagando: contesta «cuánto
se hizo», no «cuánto está pedido para la semana que viene».

**Quién las autoriza — no lo sabemos.** No está en ningún lado del proyecto y
no hay que inventarlo. Hay que preguntar: ¿el Gerente de Operaciones?,
¿RRHH?, ¿el Gerente de Tienda hasta un tope y de ahí para arriba sube? ¿Hay
cupo por tienda o por mes?

**Cómo se autoriza — tampoco.** Si la autorización es un mail, una respuesta al
formulario o una firma, y dónde queda registrada.

Dos cosas para tener presentes en esa conversación:

- **Los 30 y los 200 del decreto son el límite sin autorización
  administrativa previa**, que es del Ministerio y no de la empresa. Pasarse
  de ahí no se arregla con el visto bueno del Gerente de Operaciones. Es la
  confusión más común y conviene separarla desde el principio.
- **Entre el pedido y el acumulado no hay puente, y ahí está el agujero.** La
  solicitud es de antes y el acumulado es de después: hoy una tienda puede
  pedir veinte horas sin que nadie en la mesa sepa que esa persona ya va en 180
  en el año. El decreto no se excede de golpe, se excede de a poco —quien hace
  28 todos los meses nunca se pasa de un mes y termina el año en 224—. Mientras
  el circuito no esté definido, el control es mirar `#/nomina/cierre` **antes**
  de autorizar.

## Avisos que hay que pasar

- **Bajas en el archivo de nómina de colaboradores.** Reinaldo pide darlas de
  baja ahí. Hay que avisar cuando esté hecho.
- **Capacitación nueva en Academia Farmatodo — Venta por Obras Sociales.**
  Llegó por mail el 30/09. Hay que comunicarla al área.

## Farmacias Escuela e identificadores

Lo lleva **Capacitación** (Oriana Ornelas, VP de RR.HH.), no el área. Minuta de
la reunión de Argentina del **15/10/2026**, con Mariano, Reinaldo, Yannaly,
Andreina y Adriana. Está acá porque **dos cosas caen sobre el Área 3**: las
cuatro tiendas que participan y el traslado de gente entre tiendas.

| Fecha | Qué | Proyecto |
|---|---|---|
| lun 19 o mar 20/10 | Se envía la invitación a la sesión de cierre | Farmacia Escuela |
| oct (fecha de la RMO) | Se presenta el plan de identificadores y sus normas de uso | Identificadores |
| **jue 22/10, 16 a 17 h** | **Sesión de cierre del entrenamiento e inicio de la formalización, con las 4 tiendas** | Farmacia Escuela |
| vie 23/10 | Comunicado por correo a directores y gerentes de área (propuesta, para los dos planes) | Los dos |
| lun 26/10 | Comunicado de Farmacias Escuela por Todos en Contacto | Farmacia Escuela |
| lun 02/11 | Comunicado de lanyards por Todos en Contacto (propuesta) | Identificadores |
| noviembre | Fase de reconocimiento, una vez que lleguen los materiales | Farmacia Escuela |
| sin fecha | Inicio oficial del uso de identificadores: se define cuando lleguen | Identificadores |

**Las dos fechas de noviembre dependen de un envío**, no de una decisión: la
fase de reconocimiento y el inicio de los identificadores esperan los
materiales. Lo que viene para Argentina: 5 audífonos Logitech, 150 lanyards
—140 con identificador y 10 identificadores sueltos—, 4 kits de reconocimiento
(4 cajas, 4 placas, 70 chocolates y 4 normas de instalación) y 55 termos con 55
hojas de stickers. **Si no llegan, las dos fechas se corren**, así que conviene
preguntar por el envío antes del 02/11 y no después.

**Dos cosas de la minuta no cierran y hay que confirmarlas.** Los próximos
pasos dicen que el comunicado de Farmacias Escuela se envía el **24/10**, que
cae **sábado**, y el calendario de la misma minuta dice el lunes 26. Y la fecha
del comunicado a GA y DR figura a la vez como propuesta del 23/10 y como
pendiente de definir.

**Lo que toca al panel: el traslado y la formación.** Se planteó cómo garantizar
que quien se traslada a una Farmacia Escuela esté formado a tiempo. La salida
propuesta es integrar los movimientos de Argentina con John y, mientras eso no
esté, **actualizar a mano la plantilla semanal de Academia Farmatodo** para que
el curso se active y avance en los dashboards.

El panel ya sabe la mitad: el traspaso se carga en la ficha de la persona
(`c.movimientos`) y `aplicarMovimientosVencidos()` lo vuelca el día que
corresponde. Lo que falta para que avise es **saber cuáles son las cuatro
tiendas**: con esa lista, aplicar un traspaso a una de ellas puede dejar el
pendiente de cargar a esa persona en la plantilla semanal. **No se inventan**
—la minuta dice «las 4 tiendas» y no las nombra—, así que hasta que estén
confirmadas esto es un apunte y no una función.

## Ropa de trabajo — Botánico

Pedido anotado por mail el **lun 16/11/2026** («Ropa botánico»). Hay que
gestionarlo y confirmar la entrega.

| Prenda | Talle | Cantidad |
|---|---|---|
| Camisa manga larga | L | 1 |
| Camisa manga larga | XS | 1 |
| Chaleco | L | 1 |
| Chaleco | XS | 1 |
| Pantalón — **Victor** (BARON APONTE, Victor Eduardo, APV Botánico) | 42 | 1 |
| Pantalón — **Kevin** (INSIGNARES CHIRINOS, Kevin Odacir, APV Senior Botánico) | 42 | 1 |

En el mismo mail figuran **Cata (flotante)** y **un APV de Olleros**. Falta
confirmar a quién corresponde cada camisa y cada chaleco: el mail lista los
talles sin decir de quién son. Cata no aparece en la nómina del Área 3 de
septiembre; si es flotante, puede no estar asignada a una tienda.

## Tarjetas Nubi — todo el equipo de Botánico

Hay que **pedir las tarjetas Nubi para todo el equipo de Botánico**. Según la
nómina del Área 3 de septiembre son 12 personas (confirmar altas y bajas
posteriores antes de enviar el pedido):

| Apellido y nombre | Puesto |
|---|---|
| ANTURY ARTUNDUAGA, Ana Caterine | Gerente de tienda |
| SANTOS TORREALBA, Yessika | Director técnico |
| INSIGNARES CHIRINOS, Kevin Odacir | APV Senior |
| BARON APONTE, Victor Eduardo | APV |
| BELLO BASTIDAS, María Valentina | APV |
| CARPIO, Diana | APV |
| CONTRERAS, Daniel | APV |
| LUNA, Juan Gabriel | APV |
| PANDURO AMES, Elizabeth Rosario | APV |
| RANGEL, Ivanova | APV |
| URBINA LEGUA, Keyla Antonella | APV |
| ZORRILLA RINCON, Edgar Manuel | APV |

## Con fecha

- **11/10 — cesiones del Área 3.** Es el dead line.

## Movimientos en curso

- **Rivadavia — reemplazo de Mariel.** Liliana, farmacéutica, entrevistada con
  Eduardo. Pasó a exámenes médicos.
- **Rivadavia — Paul.** Está en período de prueba y hay que darlo de baja al
  fin del período. El puesto se cubre con un APV.

## Datos del padrón que faltan

- Referentes de **Devoto** y **Scalabrini**: la ficha de las dos tiendas está
  sin gerente, director técnico, contacto administrativo ni referente de RRHH.
- **COLL, José Alberto** figura en MAYOL: confirmar si es su tienda.
- **HERRERO, Carla Andrea**: falta definir el cargo.
- **Peñaranda, Melina Belén**: la maternidad quedó cargada con el concepto
  equivocado en el libro de novedades.
