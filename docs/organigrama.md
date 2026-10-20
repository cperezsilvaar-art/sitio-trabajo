# El organigrama de una tienda

`#/sucursales/organigrama[/<sucursalId>]` —la segunda solapa de *Sucursales*— y
el mismo cuadro adentro de `#/sucursal/<id>`. El modelo vive en
`assets/js/organigrama.js` y el dibujo en `app.js`: dos cosas distintas, y la
primera se puede probar sin navegador.

## Qué contesta, y qué contestaba el anterior

El cuadro que había agrupaba por posición: una fila de Seniors, una de APV, una
de DT. Eso contesta **cuánta gente de cada puesto hay**, que ya lo dice la tira
de KPIs de arriba, y no contesta **quién responde a quién**, que es lo que se
mira con el Gerente de Operaciones enfrente.

## La forma

```
        [Asistente del gerente]——[GERENTE DE TIENDA]——[Farmacia: DT]
                                        │                   │
                      ┌─────────────────┴───────┐      Farmacéutico
                 Piso de venta             Perfumería
                   Senior                Dermo · Belleza
                     │
                    APV
```

- **La farmacia va al costado y no abajo del piso de venta.** El DT presta la
  habilitación que la farmacia necesita para abrir: responde al Gerente de
  Tienda y no al APV Senior. El farmacéutico cuelga del DT.
- **Perfumería es una rama y no un nivel.** La Asesora de Dermo no le responde
  al Senior: le responde al gerente.
- **La limpieza va al costado, como asistente del gerente**, por lo mismo: no
  es del piso de venta.
- **Las vacantes son una tarjeta más**, en el nivel del puesto que falta, como
  ya lo eran en el cuadro anterior.

## Las tres reglas que lo ordenan

**Se mueve desde la ficha de la persona, nunca arrastrando.** Dónde cae cada
uno sale de su puesto, y el puesto se corrige en Nómina o llega con un traspaso
entre tiendas. Un organigrama que se edita por arrastre guarda **una segunda
verdad al lado de la nómina**, y el día que difieren no hay forma de saber cuál
vale. Es la misma razón por la que el casillero del laboratorio se deriva y no
se guarda.

**Nadie se cae del cuadro.** Una posición que las reglas no conocen no
desaparece: sale al pie, en *sin ubicar*, con su nombre. Perder a una persona
del organigrama es peor que mostrarla en el lugar equivocado, porque lo segundo
se ve. Lo mismo con el grupo «Sin especialidad» del laboratorio.

**Quien no cubre turno está igual, y la tarjeta lo dice.** El DT con bloqueo es
el DT de esa farmacia aunque no pise el local. Antes vivía en una lista aparte
abajo del cuadro —*Fuera de la dotación de piso*—, que se eliminó: en la
estructura está, y lo que lo separa es la **cuenta**, que sigue en el KPI *No
cubren turno*.

## Cuando la nómina no dice quién es el gerente

En seis tiendas del área no hay nadie con el cargo de Gerente de Tienda: quien
conduce está cargado como APV Senior. El cuadro no se queda sin cabeza —toma a
quien la **ficha de la tienda** nombra como gerente, emparejando por palabras
del nombre— y **lo dice**: «arriba va quien figura como gerente en la ficha». Es
la misma regla que el aviso de la razón social: nombrar y ofrecer corregir, no
pisar en silencio. El arreglo de verdad es cargarle el cargo en su ficha.

**Al Director Técnico no se lo sube a la cima ni para esto.** En una tienda la
misma persona figura en la ficha como gerente y como DT; subirla dejaba a esa
farmacia sin la rama de la habilitación, que es justo lo que no puede faltar. Se
queda en Farmacia y la pantalla dice que además conduce la tienda.

## Lo que no entra

El **laboratorio** no está en este cuadro: es otra unidad de negocio y tiene el
suyo, agrupado por especialidad. Juntarlos hacía leer veintiséis personas donde
el mostrador tiene once.

## Las líneas

Son **bordes de CSS y no un SVG**: el panel abre desde `file://` y sin conexión,
y un dibujo con coordenadas habría que recalcularlo cada vez que entra alguien.
El navegador acomoda las cajas y las líneas las siguen. Abajo de 820px el árbol
se lee en vertical, con un filete a la izquierda en lugar de los conectores: es
lo que entra en un teléfono sin scroll horizontal.

**No lleva ningún color nuevo.** El azul de la cima, el ámbar de la vacante y el
relleno de quien está en desarrollo ya estaban; un cuarto color contra el verde
del 9-box no pasa el validador de daltonismo, que es lo mismo que pasó cuando se
intentó pintar los cuatro grupos de talento.
