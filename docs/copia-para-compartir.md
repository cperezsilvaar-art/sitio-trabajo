# La copia que se le pasa a alguien de afuera

```
python3 build-pagina-unica.py --compartir panel-para-compartir.html
node check-compartir.js panel-para-compartir.html
```

El segundo no es opcional. Es el mismo trato que `check-publicacion.js` antes de
publicar: el barrido vacía **datos**, y lo que se escapa son los **comentarios**,
que viajan al HTML armado igual que el código.

## Por qué no alcanzaba `--demo`

`--demo` arma la página de demostración **del propio coordinador**. Barre las
personas —pone las cinco inventadas de `plantel-demo.js` y vacía los referentes
de cada tienda— y **deja las doce sucursales enteras**: código, RVD, dirección,
CUIT, razón social, horario. Eso fue a propósito: es dato de la empresa, no de
una persona, y es lo que hace que la página sirva para mostrar el panel.

Una copia que sale para otra empresa es otra cosa. Ahí el padrón de sucursales
—con los CUIT y las razones sociales de las doce— tampoco tiene por qué viajar,
y el cartel de `--demo` miente: dice «tu panel de trabajo es el que abrís desde
el archivo», que es cierto para el coordinador y es una pista falsa para
cualquier otro, porque en su copia no hay ningún otro panel con el padrón de
verdad.

## Qué cambia

- **Las sucursales**: `assets/js/sucursales-demo.js` ocupa el lugar de
  `sucursales-area3.js`, como `plantel-demo.js` con el plantel. Cuatro tiendas
  inventadas —Centro, Norte, Sur, Oeste—, con las dos direcciones que en
  Argentina se usan justamente para decir «esto es un ejemplo», y **sin razón
  social ni CUIT**: inventar un CUIT es inventar una empresa que puede existir.
  Cada una trae su `minimoTurno` cargado, así la cobertura de vacaciones se ve
  funcionando desde el primer día.
- **La marca, el área y el coordinador**: `sin_marca()` los reemplaza en el
  archivo armado —la hoja de estilos, el cuerpo del HTML y el JavaScript—,
  incluidos los nombres de tienda que los comentarios y los *placeholders*
  usan de ejemplo.
- **Los dos carteles**: `COPIA_PARA_COMPARTIR` cambia el de la portada y el de
  arriba del Panel por uno que dice qué es esto y dónde cargar lo propio.
  `esCopiaParaCompartir()` (`catalogos.js`) es quien lo decide.

## Dos cosas que hay que respetar al tocarlo

**El barrido corre último, cuando ya están adentro las inyecciones.** El plantel
de ejemplo y los carteles se agregan al principio del bundle *después* de armar
el JavaScript, así que un barrido anterior los deja pasar: las cinco personas de
ejemplo viven en la primera tienda del área y se llevaban su nombre a la copia.

**La marca aparece adentro de un identificador, y ése no se toca.**
`FECHADEINGRESOFARMATODOINGRESOAFTD` es la clave con la que `nomina.js`
reconoce la columna «Fecha de Ingreso Farmatodo» del Excel. Reemplazarla no
cambia un texto: **deja la página sin compilar**. Está en `INTOCABLES`, y lo
agarró el chequeo del archivo armado —el tercero de la verificación—, que es
exactamente para lo que está.

**No se arregla editando el comentario del repositorio.** Un comentario que dice
«el laboratorio de Olivos está cargado en la nómina como APV» es la razón por la
que ese código existe y tiene que seguir diciendo la verdad para quien lo lee.
Lo que cambia no es el código: es que esta copia sale para afuera. Lo mismo que
ya hace `sin_personas()`.

## Lo que la copia sí lleva

El panel entero: las dieciocho pantallas, el CCT 414/05, los plazos de los
arts. 208 y 211, los topes del Decreto 484/2000, el 9-box, el check list de 30
puntos y los importadores. Nada de eso es dato de nadie —es normativa pública y
método de trabajo—, y sin eso no habría nada que compartir.
