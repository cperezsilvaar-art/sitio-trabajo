# Cómo explicarle estos indicadores al Gerente de Operaciones

Este documento no tiene fórmulas: las fórmulas están en `protocolo-fte.md`.
Acá está **qué decir** de cada número y **para qué sirve** en una reunión de
operaciones.

---

## La pregunta de fondo: si el FTE se calcula a mes vencido, ¿para qué sirve?

Sirve **justamente por eso**. El FTE es un número de cierre y no puede ser otra
cosa: recién cuando el mes terminó se sabe cuántos días trabajó cada uno,
cuántos faltaron y cuántas horas extras se hicieron.

La confusión aparece cuando se lo trata como una herramienta de gestión diaria.
No lo es. La división es así:

| Momento | Herramienta | Pregunta que responde |
|---|---|---|
| Durante el mes | La visita semanal a la sucursal | ¿Qué está pasando y qué hago hoy? |
| Al cierre del mes | El FTE y la estadística | ¿Qué pasó, cuánto costó y contra qué lo comparo? |

Las causas se trabajan en la visita. El FTE **mide el resultado** de ese
trabajo. Un tablero que solo tuviera FTE sería un tablero que llega tarde
siempre; un tablero que solo tuviera visitas no podría comparar nada ni
justificar una dotación. Por eso están los dos y por eso están separados.

### Las tres cosas para las que sí sirve un número de cierre

**1. Comparar sucursales de distinto tamaño.**
Una tienda de 6 personas y una de 22 no se comparan por cantidad de gente.
Se comparan por puestos equivalentes: cuánta gente *efectiva* tuvo cada una
respecto de la que tenía asignada. El FTE es lo que hace comparable a
BOTANICO con MAR.

**2. Ver si la dotación aprobada se está usando de verdad.**
Una tienda puede tener 12 posiciones aprobadas y haber funcionado con 10,4
puestos reales: las ausencias se comieron 1,6. En la planilla de dotación
figuran 12 y todo parece en orden. El FTE es el único lugar donde eso se ve.
Esa brecha es el argumento cuando el gerente de tienda dice "no llego con la
gente que tengo" y la planilla dice que sí llega.

**3. Explicar el costo laboral sobre venta.**
Cuando el costo/venta se dispara, hay tres explicaciones posibles y solo una
se arregla con dotación: sueldos, horas extras, o menos venta. El costo por
puesto real separa las tres. Sin FTE, "el costo laboral subió" no tiene
próximo paso.

### La frase para la reunión

> "El FTE me dice cuánta tienda hubo de verdad el mes pasado, no cuánta figura
> en la planilla. Las causas las trabajo en la visita durante el mes; esto es
> el termómetro de lo que salió."

---

## Qué mirar de cada indicador

El documento mensual arranca con el bloque **LO QUE HAY QUE MIRAR DE ESTE MES**,
que ya viene escrito en estos términos. Debajo, la lectura de cada uno:

### Cobertura (FTE Real vs. dotación asignada)
- **Qué dice:** cuántos puestos de tiempo completo funcionaron realmente.
- **Cuándo importa:** brecha de 0,3 puestos o más, para cualquier lado.
- **Para abajo:** la tienda trabajó con menos gente de la que tiene asignada.
  Se siente en la atención, no en la planilla.
- **Para arriba:** se cubrió con horas extras. Sale más caro que cubrirlo con
  dotación.

### Costo laboral sobre venta
- **Qué dice:** cuánto de cada peso vendido se fue en gente.
- **Zonas:** objetivo 10%, techo de alerta 15%.
- **Decisión que habilita:** la dotación óptima según la venta del mes, que el
  panel calcula y muestra al lado. Es el número con el que se pide o se
  devuelve una posición.

### Ausentismo
- **Qué dice:** cuánto del tiempo de vínculo no se prestó.
- **Lo importante no es el total, es el corte:**
  - *Controlable (evitable)*: faltas injustificadas, permisos, clima. **Sobre
    esto la tienda puede trabajar.**
  - *No controlable (inevitable)*: enfermedad y accidente comprobados,
    licencias legales, vacaciones. Se administra, no se reduce.
- **Error clásico:** llevar a comité un ausentismo del 8% que es casi todo
  vacaciones y licencias. Se pierde credibilidad. Llevá siempre el número
  evitable.

### Horas extras
- **Qué dice:** cuánto de la cobertura se compró en lugar de dotarla.
- **Leerlo junto con la cobertura:** horas extras altas + brecha negativa =
  falta gente. Horas extras altas + brecha positiva = mala grilla horaria.

### Rotación
- **Qué dice:** bajas del mes y su proyección anual.
- **Cuidado con el anualizado en tiendas chicas:** una baja en una tienda de 6
  personas da 200% anualizado. El número absoluto y el motivo dicen más.

---

## Lo que este tablero no reemplaza

- No mide presentismo diario ni horario: los datos vienen de la liquidación
  del mes cerrado.
- No proyecta: describe el mes que pasó.
- No decide dotación: da el rango y la brecha; la decisión es de Operaciones.

## El prellenado separa a quien entró o se fue

`dotacionDelPadron()` ya no manda a todo el mundo a “Mes completo”. Mira la fecha
de ingreso y la fecha de baja de cada persona contra el período:

- si el vínculo empezó dentro del mes, va a **Ingresos** con los días que alcanzó
  a trabajar (entrar el 16 de un mes de 30 son 15 días);
- si terminó dentro del mes, va a **Egresos** con los días trabajados (irse el 25
  son 25 días);
- el resto son **Mes completo**.

Antes el prellenado los contaba a todos como dotación estable, y al agregar los
días de ingreso la persona quedaba contada dos veces: 6 cabezas + 15 días daban
6,5 FTE donde correspondían 5,5. El error se inducía desde el propio panel.

La matriz muestra ahora, debajo de cada número de días, a cuánto FTE equivale
—15 días → *0,50 FTE*—, y arriba de la tabla lista los movimientos del mes con
nombre y días, para que se vea de dónde salen.
