# Vacantes y vacaciones

Dos pantallas que contestan la misma pregunta desde dos lados: **con cuánta
gente cuento**. La vacante es el lugar que falta cubrir y no se cubre solo; las
vacaciones son el lugar que se vacía en una fecha acordada y vuelve. Van
separadas porque una se resuelve contratando y la otra moviendo una fecha.

## Vacantes — `#/vacantes`

Lo que se pidió guardar es **qué puesto falta y en qué tienda**, y eso es todo
lo que pide el alta. Lo único que se agregó es **desde cuándo está abierta**:
sin esa fecha la lista se lee igual el primer día que a los cuatro meses, que
es justamente cuando hay que hacer ruido. A los 21 días la fila pasa a ámbar y
a los 45 a rojo.

**La vacante cuelga de la tienda** (`s.vacantes[]`) y no de la persona, al
revés que todo lo demás del panel —`c.baja`, `c.ausencias`, `c.casos`,
`c.entrenamientos`, `c.planes`—. Es lo único que se guarda así, y por una
razón: una vacante es exactamente el lugar donde no hay nadie de quien colgarla.

**El puesto sale de `CARGOS_NOMINA`**, como el alta a mano de `#/nomina`. La
posición del panel se **deriva** del cargo elegido y no se pide aparte: una
segunda lista de puestos se desincroniza de la primera sin que nada falle, que
es lo que `MAPA_CARGOS` ya evitó derivándose de `CARGOS_NOMINA`.

**Dentro de la tienda se dibuja como una tarjeta más.** En `#/sucursal/<id>` la
vacante aparece en el organigrama al lado de la gente de su puesto, punteada y
en ámbar, diciendo «Vacante» y el cargo. Esa era la forma pedida: que «me falta
un farmacéutico en Devoto» se vea mirando la tienda y no entrando a otra
pantalla. El título del grupo suma el contador de vacantes al de cabezas.

**No cuenta en la dotación**, y no es un olvido: la dotación contesta con
cuánta gente cubro el turno, y una vacante es gente que no está. Se ve al lado,
que es lo que hace que las dos preguntas se lean juntas.

**Cubrirla no la borra.** Pasa a la tabla de abajo con cuánto tardó: con qué se
cubrió un puesto y en cuántos días es lo que se lleva a la conversación de
dotación con Operaciones. Borrarla es para la que se cargó por error, y el
diálogo lo aclara — la misma distinción que *borrar* contra *dar de baja*.

**El contador del menú son las vacantes abiertas**, y se esconde en cero como
todos los demás.

## Vacaciones — `#/vacaciones[/<sucursal>]`

El cuadro de planificación que el área venía llevando en una planilla, más lo
único que la planilla no puede contestar: **con cuánta gente queda la tienda el
día que alguien sale**.

### Los tramos no son una lista nueva

**Un tramo de vacaciones es una ausencia con motivo `vacaciones`**, de las que
ya vivían en `c.ausencias`. No se abrió una segunda lista, y la razón es la de
siempre: dos listas de lo mismo terminan diciendo cosas distintas, y acá una de
las dos ya la llenan el libro de novedades y el formulario de recepción.

El alta de la pantalla llama a `Store.agregarAusencia()`, así que hereda el
antiduplicado (`ausenciaQueSeSolapa()`): volver a cargar la misma salida
**corrige la que estaba en vez de agregar otra**, y la pantalla dice cuál de
las tres cosas hizo. Y la salida aparece sola en Presentismo, en la ficha de la
persona y en el ausentismo —donde sigue sin contar, porque las vacaciones son
tiempo planificado— sin que nadie la copie. **No es un segundo formulario**: es
el mismo código sobre el mismo dato, como `bloquePlanDesarrollo()`.

**«Último día» es el último de vacaciones, no el de la vuelta.** Del 5 al 21
son 17 días y se reincorpora el 22. Es la convención de cualquier otra licencia
del panel, y mezclarla con la fecha de retorno —que es lo que dice la planilla—
daría dos números para lo mismo.

### El derecho

Los días legales salen de `vacacionesDe()` (`convenio.js`), que ya existía: el
**art. 24 del CCT 414/05** mejora la LCT en los dos primeros tramos —17 días
hasta los 5 años y 26 hasta los 10, contra 14 y 21 de la ley—.

**La antigüedad se mide al 31 de diciembre del año del ciclo**, no al día de
hoy. Lo dice el último párrafo del **art. 150 de la LCT**, y no es un detalle:
quien entró el 12/12/2022 tiene 4 años para el ciclo 2026 y 17 días; medirlo
contra una fecha de octubre le daría 3 y el mismo número, pero a quien entró en
diciembre de 2021 le daría 17 donde le tocan 26. Los siete casos de la planilla
de MS Patricios se prueban uno por uno en `e2e-vacaciones.js`.

**Los días que arrastra del ciclo anterior el panel no los puede deducir** —no
guarda la foto de cada cierre— así que se cargan a mano en la columna *Pend.
ant.* del cuadro. Viven en `c.vacacionesPendientes`, **indexados por el año del
ciclo**: el número del año que viene no tiene por qué pisar el de este, y sin
el año al lado nadie sabe de cuándo arrastra. En cero **se borra la clave** en
vez de guardar un 0, como `marcarAdef()` con el estado vacío: «no arrastra
nada» y «todavía no lo miré» son dos cosas distintas.

Usa un binding propio (`data-vacpend`) porque `data-colab-campo` escribe campos
planos y la clave lleva el año adentro.

### Planificado, tomado y saldo son tres números

- **Planificados** son los días con fecha, todo el ciclo, incluido lo que
  todavía no pasó.
- **Tomados** son los que ya transcurrieron.
- **Saldo** es el total menos los planificados: **lo que falta ubicar en el
  calendario**, que es la pregunta de la planificación. No es lo que falta
  gozar.

La planilla los confunde en uno solo porque arranca con todo en cero. Una vez
que hay fechas cargadas son tres preguntas distintas y mostrarlas juntas es lo
que evita que alguien lea «saldo 17» y crea que esa persona no salió.

### La cobertura: lo único que la planilla no puede hacer

`coberturaDeVacaciones()` recorre **día por día** el ciclo y informa **el peor
día de cada mes**. Por mes no alcanza: dos personas afuera la misma semana y
dos en semanas distintas dan el mismo total mensual y son dos situaciones
opuestas, y esa es exactamente la pregunta que se hace al armar el calendario.

El piso resultante se compara contra **`minimoTurno`**, el campo de la ficha de
la tienda que dice con cuánta gente abre en condiciones. **Sin ese número no se
pinta nada en rojo**: la pantalla dice que falta el dato y enlaza a la ficha.
Inventar un mínimo sería peor que no tenerlo.

**El contador del menú son las tiendas que quedan cortas**, no la gente sin
planificar. Al empezar el ciclo nadie tiene fecha y ese contador diría 136: un
número así deja de leerse el mismo día. Lo que pide una decisión es la tienda
que algún día del ciclo baja del turno mínimo, que son pocas y casi siempre
ninguna.

### La cobertura por posición: «te quedás sin dos APV»

La cobertura total en FTE contesta cuánto turno queda; **no contesta de qué
posición no queda nadie**. Un piso de 6 FTE con los dos APV afuera no es un
piso de 6, y una farmacia sin su director técnico no abre.

`coberturaDeVacaciones()` cuenta además **por posición y en personas, no en
FTE**: dos farmacéuticos de media jornada son un FTE y son dos personas, y el
que se va deja un turno sin cubrir, no medio. Guarda el peor día **de cada
posición**, que no tiene por qué ser el mismo que el peor del total.

**Dos umbrales y no uno.** Que una posición quede en **cero** es categórico y no
depende de ningún mínimo configurado: ese día no hay ningún APV en el piso. Que
se vaya **la mitad o más** es un aviso: queda alguien, pero la tienda opera
distinto. Lo primero va en rojo, lo segundo en ámbar.

**El aviso sale al anotar la salida, no al mirar la pantalla.** Que la tienda se
quede sin cobertura se decide al elegir la fecha, y descubrirlo tres pantallas
después es descubrirlo cuando el gerente ya se fue. **Se nombra y no se
impide**: mover una salida es una conversación, no una validación.

### El laboratorio no cuenta como APV

El laboratorio de Olivos prepara **alopatía** y **homeopatía**, y su gente está
cargada en la nómina como «ASISTENTE DE PISO DE VENTAS»: **ocho personas que la
tienda contaba en el piso y no están en el piso**. Con eso, «te quedás sin dos
APV» era un número que nunca se iba a disparar — Olivos parecía tener dieciocho
APV y tiene ocho.

`posicionDeCobertura()` (`nomina.js`) es el único lugar que decide en qué
casillero cuenta cada persona: la del laboratorio va en «Laboratorio ·
Alopatía» o «Laboratorio · Homeopatía», y de paso la cobertura también avisa
cuando se queda sin homeopatía, que es un turno igual de imposible de cubrir.

**No pisa `c.posicion`.** La posición dice qué *es* la persona —de ahí salen el
9-box, el organigrama y el desarrollo— y el casillero dice dónde se la *cuenta*.
Son dos preguntas distintas sobre el mismo dato, así que el casillero se deriva
y no se guarda.

**Sigue contando en la dotación de la tienda**, que es plantel y cuesta;
`dotacionPlantel()` lo devuelve aparte en `laboratorio` para poder leerlo solo.

**Y tiene su propio organigrama.** La página de la tienda arma dos cuadros:
*Organigrama · Farmacia* y *Organigrama · Laboratorio*, en tarjetas separadas.
El del laboratorio se agrupa **por especialidad** —alopatía y homeopatía son
dos mesadas distintas— y no por posición, con el Senior y el farmacéutico
primero dentro de cada una. El encabezado de farmacia dice «· Farmacia» solo
cuando hay laboratorio: en las otras once tiendas no hay nada de qué
distinguirlo.

### El calendario, que es la excepción a «tabla y no gráfico»

Lo que hay que ver es el **solapamiento**. Dos salidas de enero se leen igual en
una lista —«05/01→21/01» y «12/01→28/01»— y en una tira de días se ve de una que
hay nueve días con las dos personas afuera. Una lista de fechas obliga a hacer
esa cuenta en la cabeza catorce veces, y esa es justamente la cuenta que nadie
hace.

Sigue siendo **una tabla por dentro** —se lee con lector de pantalla y se copia a
Excel—, con las celdas pintadas: una fila por persona, una columna por día del
mes, un mes a la vez.

Abajo va **una fila por posición con cuántos quedan cada día**. El número está
escrito en la celda y el color solo lo acompaña, que es la misma regla que la
barra de composición del Panel: el color nunca es lo único que dice qué pasa.
Una sola serie —la salida— así que un solo tono y sin leyenda; el título de la
tarjeta ya dice qué es cada barra.

### Las vacaciones no se justifican: se otorgan

`estadoDeAusencia()` mandaba a `pendienteJustificar` —en rojo, y encabezando
las alertas— a toda ausencia sin certificado. Las vacaciones no tienen papel
que reclamar, así que quedaban ahí para siempre. Ya le pasaba a las que trae el
libro de novedades y se iba a multiplicar con una pantalla que las planifica.

`motivoPideCertificado()` (`ausencias.js`) lo decide **en un solo lugar**, al
lado de `motivoSumaAusentismo()`, y las demás licencias no cambian: el
certificado médico, el acta de matrimonio y la partida de nacimiento se siguen
pidiendo. En Presentismo la casilla de certificado de una fila de vacaciones
dice «no lleva» en vez de ofrecer un tilde: una casilla que no hay que tildar
nunca enseña a tildar sin mirar.

### Pegar la planilla

El área la lleva en Excel con **una hoja por tienda** y diez pares de columnas
SALIDA/RETORNO. Pegar hoja por hoja es lo que ya salió mal con el libro de
novedades —catorce pegadas y una en la tienda equivocada que no se nota hasta
el cierre—, así que `importarPlanDeVacaciones()` (`store.js`) lee **una tabla
plana con una fila por tramo**: TIENDA, COLABORADOR, CUIL, INGRESO, PEND AÑO
ANT, SALIDA, RETORNO. Las columnas se ubican por el encabezado
(`COLUMNAS_PLAN_VACACIONES`), así que el orden no importa.

**Quien no tiene ninguna salida entra igual**, con las dos fechas vacías: su
fila sirve para cargar los días que arrastra del ciclo anterior.

**«Retorno» es el día que vuelve, no el último de licencia.** Así lo escribe la
planilla —sale el 26/10 y retorna el 12/11, que son 17 días— y así lo entiende
el gerente. El panel guarda el último día, como cualquier otra licencia, y la
resta se hace **en un solo lugar**, dentro del importador.

**No crea a nadie**, como el libro: la fila que no cae en el padrón se devuelve
con nombre y tienda. Usa `buscadorDePadron()`. **Y completa el CUIL donde
falta**: la planilla lo trae y el padrón del repositorio no —la privacidad lo
deja afuera—, así que la primera pegada empareja por nombre y deja el número
escrito, y la del año que viene ya empareja por número. Nunca pisa un CUIL
cargado.

### El ciclo

`parametros.vacacionesAnio`, `vacacionesMesDesde` y `vacacionesMesHasta`,
editables en `#/config`. `cicloDeVacaciones()` es **el único lugar que traduce
entre el ciclo y sus fechas**, como `rangoDePeriodo()` con el período de
liquidación. La LCT (art. 154) ubica las vacaciones entre el 1 de octubre y el
30 de abril; el área planifica desde julio, así que los meses son un parámetro
y no una constante. **Con el mes de arranque mayor que el de cierre la ventana
cruza el año** —julio de 2026 a abril de 2027—, que es el caso normal; con los
dos adentro del mismo año funciona igual, por lo mismo que el período de
liquidación: es el caso general escrito una vez.

**Un tramo pertenece al ciclo en el que empieza**, aunque termine afuera: la
salida es lo que se acuerda con el gerente y lo que ocupa el lugar en el
calendario de la tienda.

**Lo que arranca antes de la ventana no se tira: se nombra.** La planilla traía
nueve salidas entre julio y septiembre. `tramosFueraDeVentana()` las junta y la
fila de esa persona dice «+17 antes del ciclo». **No se descuentan del saldo**:
cuál ciclo pagó una salida de julio no se puede deducir —puede ser el arrastre
del anterior o un adelanto de éste— y adivinarlo le descontaría días a alguien
que todavía los tiene. Las licencias quedan enteras en su ficha, con sus fechas.

### Lo supuesto se marca

Los tramos que trajo el libro de novedades van **en gris y punteados**. El
libro dice cuántos días se pagaron y no cuáles, así que sus licencias quedan
ubicadas al principio del mes: los días están medidos, el día de salida no. Es
el mismo trato que `diasSupuestos` le da al certificado sin duración, y por la
misma razón — lo que se supone no se muestra como si alguien lo hubiera
acordado.

## Qué comparten las dos pantallas

El plantel que miran es **el que cubre turno**: `sigueEnElPlantel()` saca a las
bajas —a quien se fue no se le planifican vacaciones— y `esNoPresencial()` saca
al bloqueo de título, que no ocupa un lugar en el calendario del piso. Es la
misma lista que cuenta la dotación, a propósito: planificar sobre una dotación
y medir la cobertura sobre otra es la grieta de siempre entre el numerador y el
denominador.
