# El período de liquidación

## El mes de Nómina no es el mes del almanaque

El período de **septiembre de 2026** fue del **21/08 al 17/09**. Arranca el día
21 del mes anterior y cierra el 17 de este.

Todo el panel medía en meses calendario, y eso metía los días en la ventana
equivocada. Con los datos reales de septiembre la diferencia no era chica:

| | Días de ausentismo |
|---|---|
| Septiembre calendario (01→30/09) | **166** |
| El período real (21/08→17/09) | **120** |

Y la diferencia no era ruido:

- **52 días caían después del corte**, o sea fuera de lo que la liquidación
  pagó. Los 52 eran del libro: el importador ubicaba sus licencias desde el día
  1 y las estiraba hacia adelante, empujándolas más allá del 17.
- **6 días que la liquidación de septiembre sí pagó** quedaban contados en
  agosto, porque cayeron entre el 21 y el 31 del mes anterior.

## Dos números y una sola traducción

En `#/config`: **«El período arranca el día»** (21) y **«…y cierra el día»**
(17). De esos dos salen dos funciones, en `convenio.js`, que son **la única
traducción entre un período y sus fechas**:

- `rangoDePeriodo('2026-09')` → `{ desde: '2026-08-21', hasta: '2026-09-17' }`
- `periodoDeFecha('2026-08-25')` → `'2026-09'`

Escribir la conversión a mano en cada pantalla es garantizar que un día
difieran, que es exactamente lo que ya había pasado con las tres cuentas de
ausentismo.

**Con el día de arranque menor o igual al de cierre el período vive adentro del
mismo mes**, así que poner **1** y **31** devuelve los meses calendario sin
tocar ninguna otra cosa. No es una excepción: es el caso general escrito una
sola vez.

## Los días que quedan sueltos

Del 21 al 17 quedan tres días de cada mes afuera del período declarado: el
**18, el 19 y el 20**. Es el calendario que hoy usa Nómina y una decisión del
coordinador, no un error del panel.

**No se pierden.** `periodoDeFecha()` reparte por el **día de cierre**, no por
el de arranque: lo que pasa después del corte lo paga el recibo que viene. Si
Nómina cerró el 17, una falta del 18 se cuenta en octubre. Así cada día del año
cae en un período y en uno solo —está probado sobre los 365— y nada desaparece
de la serie.

`#/config` los nombra y explica adónde van, sin impedir nada: cuál es el corte
lo decide Nómina, no esta pantalla. Si algún mes cierra el 20, los dos números
encajan y no queda ninguno suelto.

> El 20/09/2026 cayó domingo, el 19 sábado y el 18 viernes. Es probable que la
> regla de fondo sea del 21 al 20 y que este mes se haya adelantado al jueves;
> si se confirma, es cambiar un número.

## Dónde se nota

Todo lo que el panel contaba «por mes» ahora cuenta por período:

- **El ausentismo del área y de cada tienda** — `serieMensualDeAusentismo()`
  arma un casillero por período y reparte cada día con `periodoDeFecha()`. La
  tabla escribe el rango abajo del nombre: «septiembre de 2026 · del 21/08 al
  17/09». Sin eso «septiembre» se lee como el mes del almanaque, que es
  justamente lo que dejó de ser.
- **El historial de cada persona** — `ausenciasPorMes()`, mismo reparto.
- **Los días de vínculo de un alta o una baja** — quien entró el 05/09 aportó
  14 días de 30 del período 21/08–17/09, no 26 de septiembre. Contarlo por
  calendario inflaba la dotación con gente que no estuvo, que es justo lo que
  el cierre viene a mostrar.
- **El libro de novedades** — ubica sus licencias desde el arranque del período.
- **La agenda** — a qué recibo va lo que anotás sale del mismo corte.
- **La visita** — una visita del 19 de septiembre es del recibo de octubre.

## Un campo que desapareció

`diaCierreNovedades` (25) era un campo aparte que decía **el mismo número** que
cierra el período. Dos campos para un número terminan diciendo cosas distintas,
así que `Store.diaCierreNovedades()` ahora devuelve el día de cierre del
período. Lo guardado con el nombre viejo se sigue leyendo, para no cambiarle el
corte a quien ya lo había movido a mano.

Lo mismo con `periodoDeLiquidacion()` en `agenda.js`: hacía exactamente la misma
cuenta que `periodoDeFecha()`, escrita dos veces. Ahora la llama.

## Las licencias que ya estaban

Las que el libro cargó cuando el panel medía por calendario arrancan el día 1,
que ya no es donde empieza el período. **Volver a pegar el libro de ese mes las
reubica** al arranque conservando cuántos días duran, y anota de dónde venían
(`reubicadaEn`).

Se mueven **solo las suyas**: `fechasSupuestas` marca las fechas que inventó el
propio importador, así que moverlas no borra ninguna prueba. **Una licencia con
fechas de verdad —del formulario de recepción o del parte de los gerentes— no se
toca jamás.**

Con el libro de septiembre de 2026 vuelto a pegar, las 13 licencias pasan del
01/09 al 21/08 y el ausentismo del período queda en **164 días**.

## Cuando la liquidación paga más días de los que el período tiene

Del 21 al 17 el período mide **28 días**, y el libro de septiembre de 2026 le
paga **30** a más de una persona. No entran.

El importador los recorta al cierre del período —inventar días afuera sería
peor— pero **lo avisa**, nombrando a cada uno: «pagó 30 días y entran 28».
Recortar en silencio esconde justamente el dato que dice que el corte
configurado describe un período más corto que el que liquida Nómina.

Con los 166 días de la planilla de septiembre, 8 quedan afuera por este motivo
y el ausentismo del período da **158**.

> Es la segunda señal de que la regla de fondo sería del 21 al 20: un período de
> 31 días sí contiene 30 días de licencia.

## La ventana de medición no arranca en la mitad de un período

`ventanaDeMedicion()` corre el arranque al principio del período que contiene
la fecha del corte. Con `mideDesde` en el 01/09 y períodos que arrancan el
21/08, las licencias que el libro ubica al arranque quedaban casi todas
afuera: el ausentismo de septiembre caía de 158 días a **74** sin que nada lo
dijera.

Se ajusta **en el cálculo y no en el valor guardado**, así el corte sigue
siendo la fecha que el coordinador escribió y no una que el panel le cambió por
atrás.

## El corte del año fiscal va aparte

`parametros.mideDesde` sigue siendo una fecha y no se calcula sola. Si el año
fiscal arranca con la liquidación de septiembre, la fecha es el **21/08/2026** y
no el 01/09: con el corte en el 1 quedan afuera los primeros once días del
ejercicio.
