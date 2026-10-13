# El período de prueba

Una persona que entra tiene seis meses de prueba, y en esos seis meses el
coordinador no la ve: la ve el gerente de su tienda. Lo que el panel hace es
**pedirle al gerente que diga cómo le va, cada dos meses**, y poner las tres
conversaciones antes de que el plazo venza — porque cuando se vence, la
decisión ya se tomó sola.

Vive en `#/desarrollo/prueba`, la tercera solapa de *Desarrollo*.

## Las tres fechas no se crean: se deducen

El pedido fue «cuando doy de alta a alguien, que le arme las tres
evaluaciones». Crearlas en el alta tenía un agujero: **quien entra por la
nómina del mes no pasa por el alta a mano**, así que la mitad del plantel
nuevo se quedaría sin ninguna.

Por eso las fechas no se guardan. Salen de `c.fechaIngreso` y de dos
parámetros, y **toda persona nueva aparece con sus tres evaluaciones sin que
nadie las cree**, haya entrado por donde haya entrado. Es la misma regla de
*lee, no copia* que la agenda: lo único que se guarda es lo que no se puede
deducir —qué contestó el gerente, cuándo y quién—.

Tiene además una consecuencia buena: **corregir la fecha de ingreso en la
ficha mueve las tres evaluaciones**, sin que haya que tocar nada más.

## Seis meses, cada dos, tres conversaciones

El plazo es el del **art. 92 bis de la LCT**, que la **Ley 27.742** (Ley Bases,
vigente desde el 09/07/2024) llevó de 3 a 6 meses. Las convenciones colectivas
pueden estirarlo a 8 meses en empresas de 6 a 100 trabajadores y a un año en
las de hasta 5: no es el caso del área, pero por eso **es un parámetro y no una
constante** (`parametros.mesesPeriodoPrueba`, editable en `#/config`).

La cadencia es el otro parámetro (`mesesEntreEvaluacionesPrueba`, 2). **De los
dos números salen los hitos** y por eso no hay ningún «3» escrito a mano: con
6 y 2 son tres, con 8 y 2 son cuatro.

**La última es la que decide** y se nombra así en la pantalla: después de ella
no queda tiempo para conversar nada.

## El plazo corre desde la antigüedad reconocida

Desde `c.fechaIngreso`, **nunca desde `c.fechaIngresoFTD`**. Las farmacias del
área se compraron, así que casi todo el plantel tiene una fecha de Farmatodo
reciente y una antigüedad vieja: medir desde la de Farmatodo pondría a más de
cien personas en período de prueba. La transferencia de establecimiento
continúa el vínculo (art. 225 LCT), no lo empieza. Está probado sobre el padrón
real: de los que tienen la fecha de Farmatodo posterior a su ingreso, ninguno
cuenta como a prueba.

**Una baja no está a prueba**, por `sigueEnElPlantel()`: la misma regla que la
saca de Presentismo. Su historial queda en la ficha igual.

## Tres respuestas y ninguna más

`RESULTADOS_PRUEBA`: *va bien*, *con observaciones* y *el gerente no lo
confirma*. «Bien» y «muy bien» serían el mismo estado con dos nombres; lo que
cambia la decisión es si hay algo que corregir y si llega a tiempo.

**La tercera no dice «despedirlo»**: dice que el gerente no lo confirma. Qué se
hace con eso lo decide el coordinador, y si termina en una baja, esa baja tiene
su propio circuito con sus cinco trámites.

Sin resultado **se borra la evaluación** en vez de guardar un registro vacío,
como `marcarAdef()`: volver a «todavía no la hice» es una respuesta válida.

## Qué entra en la agenda y qué no

`alertasDePrueba()` devuelve **solo lo vencido y lo que está por vencer**. Una
evaluación que toca dentro de dos meses no es un pendiente: es el calendario, y
meterla convertiría el contador en un número fijo —la regla de los contadores
en cero, vista al revés—.

Es la única clase de pendiente del panel con **fecha de caducidad dura**: a los
seis meses la persona queda confirmada sola, haya habido conversación o no. Por
eso el grupo va arriba en *Lo que quedó pendiente*.

Suma al contador de *Desarrollo* junto con las alertas del entrenamiento: las
dos se resuelven en la misma pantalla, y separarlas pediría una entrada más en
un grupo que ya tiene seis.

## El preaviso quedó sin resolver, a propósito

El panel **no calcula una fecha límite para avisar**, y no es un olvido. La
Ley 27.742 sacó del art. 92 bis la frase que remitía a los arts. 231 y 232, y
las fuentes no coinciden sobre si el preaviso de 15 días sigue vigente: hay
análisis que sostienen que el art. 231 no se tocó y sigue aplicando, y otros
que citan una modificación posterior que lo elimina expresamente durante la
prueba.

Inventar una fecha límite sobre eso sería peor que no darla: el coordinador la
usaría para decidir una baja. La pantalla dice que el plazo cambió, que las
fuentes no coinciden y que lo confirme con el estudio. Es el mismo trato que
los plazos de los arts. 208 y 211 en las ausencias: **una orientación sobre la
ley general, no un dictamen.**

## Tercera solapa y no una entrada del menú

*Seguimiento* ya tiene seis entradas. Y esto es lo mismo que las otras dos
solapas de *Desarrollo* —una conversación con el gerente sobre una persona, con
fechas y un veredicto— con una diferencia: acá la agenda la pone el calendario
y no el coordinador.
