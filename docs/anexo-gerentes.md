# El anexo de los Gerentes de Tienda

Lo que los gerentes usan para avisarle algo a RRHH, y cómo eso entra al panel.

## El problema que resuelve

Los gerentes escribían por WhatsApp, informalmente: «cris fulanito de tal cobró
mal», «cris llegó esta CD de x empleados». Tres cosas se perdían ahí: **de quién
se trata** —«fulanito» no es una identidad—, **qué pasó exactamente** y **la
fecha**. Y nada quedaba registrado: a las dos semanas el reclamo estaba
enterrado en un chat.

Lo que molestaba **no era el WhatsApp: era la informalidad.** Esa distinción
decide todo el diseño.

## Por qué no un formulario de Google ni una página con base de datos

Las dos se evaluaron y las dos se descartaron.

**Un formulario de Google** era el camino corto —ya existe uno para las
ausencias— pero el coordinador no lo quiso, y con razón: es la herramienta de
otro, no se parece al panel y se lee como un trámite.

**Una página publicada con la capacidad `db`** sería lo ideal si el dato pudiera
viajar solo, y no puede. El contrato de capacidades es explícito: *«by default
signed-in people read shared docs; only Contributors and up write them … never
Viewers, Commenters or outside link visitors»*. O sea que **quien entra con el
link puede leer pero no escribir**: cada gerente necesitaría una cuenta de
Claude con permiso de escritura en la organización. Catorce cuentas, catorce
permisos, y un gerente nuevo que no puede cargar nada hasta que alguien se
acuerde de darle el acceso.

Y abajo de todo está el hecho de fondo: **el panel no tiene servidor**. Es un
archivo que abre en el navegador del coordinador y guarda en ese navegador. Sin
servidor, el dato solo puede viajar por un canal que las dos partes ya toquen:
un mensaje o un documento compartido. Descartado el documento compartido, queda
el mensaje.

## Cómo funciona

`anexo-gerentes.html` es una página de un solo archivo. Abre en el teléfono, sin
login y sin conexión, con la paleta del panel. El gerente elige qué quiere
avisar, completa, y abajo le queda armado el mensaje con un botón para mandarlo.

Para él es el gesto de siempre —mandarle un mensaje a Cris— menos el tener que
pensar qué contar. Del otro lado llega esto:

```
#RRHH3 RECLAMO
Tienda: Botánico
Colaborador: PEREZ, MARIA EUGENIA
DNI: 12345
Motivo: Horas extras no liquidadas
Período: septiembre 2026
Monto: 45000
Detalle: hizo 12 horas el finde del 13 y no se las pagaron
Informa: Juan Gómez
Fecha: 2026-10-02
```

**Una línea por dato, con la clave adelante.** Se lee bien en el chat, que es la
mitad del punto: si el mensaje fuera un bloque cifrado el gerente no sabría qué
está mandando. Y se parsea sin ambigüedad del otro lado.

**Van tres salidas —WhatsApp, mail y copiar— y el texto es idéntico.** El
importador lo toma de donde venga, así que el canal no está amarrado. Si no hay
número ni casilla configurados, queda «Copiar el texto», que es una salida
completa.

## Las tres ramas

| Lo que el gerente marca | Marca | Dónde cae |
|---|---|---|
| Un reclamo de sueldo | `RECLAMO` | un **reclamo** en `#/reclamos` |
| Llegó una carta documento o una intimación | `LEGAL` | un **caso** tipo *Intercambio legal* |

Son **dos destinos y un solo link**: el gerente no tiene por qué saber que del
lado del panel los reclamos y los casos viven en lugares distintos.

**Había una tercera rama y se eliminó**: *«una situación que necesita
seguimiento»*. El anexo es solo para reclamos de sueldo. Un gerente no usa un
formulario para contar que un desempeño no levanta, y si lo usara lo que
quedaría es una impresión escrita sobre una persona en una herramienta de la
empresa, sin una conversación atrás. Es lo mismo que se rechazó cuando se pidió
un «panel de empleados complejos»: se sigue la situación, no se etiqueta a la
persona. Un reclamo y una carta documento son hechos. **No reponerla.**

**La carta documento entra como `esperando` y con riesgo alto**, no como
`abierto`: desde el minuto uno la pelota está del lado del estudio y el próximo
paso es pasársela. Entra ya escrito y fechado para hoy.

## Lo que el anexo no lleva

**No lleva el padrón.** El nombre del colaborador lo escribe el gerente. Listar
a las 136 personas en una página que abren catorce es exactamente lo que la
regla de `--demo` existe para evitar, y la autorización para trabajar con la
nómina real es para el repositorio y el equipo, no para una página que se
reparte por link. Lo verifica `check-anexo.js`, que además chequea que no viajen
los referentes de las tiendas, sus mails, los CUIT ni las direcciones.

Lo que **sí** lleva son los nombres de las doce tiendas: sin eso el gerente no
puede decir de dónde carga, y eso es dato de la empresa.

**Por eso el número importa.** Con número el emparejamiento contra el padrón es
exacto; sin número el panel hace lo que puede por nombre y **nombra las filas
que no cayeron en nadie** en vez de perderlas.

El anexo pide **DNI**, no legajo, y eso sale de medir el padrón: el legajo está
cargado en **0 de 141** personas y el DNI en 139. El legajo se sigue aceptando
—`buscadorDePadron()` lo empareja— para cuando la nómina lo traiga, pero pedirlo
primero sería pedir un dato que hoy no engancha con nada.

El importador acepta el número con varios rótulos —`DNI`, `Legajo/DNI`,
`Documento`— porque los links ya repartidos siguen mandando el viejo: un mensaje
en camino no tiene por qué perderse por un cambio de etiqueta.

## Una sola lista de motivos

El anexo tiene que ser un archivo solo, así que no puede cargar `reclamos.js`
con un `<script src>`. La alternativa sería copiar los quince tipos de reclamo
adentro de la página, y el día que se agregue uno al panel las dos listas
dirían cosas distintas sin que nada falle.

Por eso la fuente es `anexo-gerentes.plantilla.html`, con huecos marcados, y
**`build-anexo.py` los llena leyendo el código**: las tiendas de
`sucursales-area3.js`, los motivos de `TIPOS_RECLAMO` y las situaciones de
`TIPOS_CASO`. Es la misma decisión que `MAPA_CARGOS` derivándose de
`CARGOS_NOMINA`.

```
python3 build-anexo.py [--tel 5491122334455] [--mail rrhh@farmatodo.com]
```

`anexo-gerentes.html` es **generado y no se edita a mano**: lo dice un comentario
en la primera línea. Si cambia un motivo o una tienda, se vuelve a correr el
script y se reparte el link de nuevo.

Si la lista cambió **después** de repartir el link, el motivo que no reconoce
cae en `otro` y **lo que el gerente eligió se escribe en el detalle**: la
etiqueta se corrige después, el dato no se recupera.

## Cómo entra al panel

Se pega al pie de `#/reclamos` —no en una pantalla propia: es una entrada de
reclamos, igual que el parte de ausentes vive al pie de Presentismo—.

`Store.importarReportesDeGerentes(texto)` hace lo que el anexo no puede
delegarle a una página que abren catorce personas: ubicar a la persona en el
padrón y escribir donde corresponde. El formato lo lee
`leerReportesDeGerentes()` (`reclamos.js`).

**Se pegan varios de una.** El coordinador junta los de la mañana y los pega
todos juntos; se parte por la línea de la marca. Y **se puede pegar la
conversación entera**: las líneas que no son parte de un aviso se cuentan como
sobras y se informan, en vez de hacerse pasar por un reporte. Si se exportó el
chat en vez de copiar el mensaje, el `[2/10/26, 15:30] Juan Gómez: ` de cada
línea se saca antes de mirar el contenido, y los asteriscos de la negrita de
WhatsApp también: el gerente no tiene que saber de qué manera copiar.

**No duplica.** El mismo aviso pegado dos veces entra una sola vez, por `origen`
+ fecha + tipo + persona. Es la regla de siempre: se vuelve a pegar todos los
días.

### El emparejamiento, y el legajo

Lo hace `buscadorDePadron()`, que es **uno solo** para los tres importadores.
El anexo le agregó una tercera forma de identificar a alguien: **el legajo**,
que es el número que el gerente tiene a mano porque lo lee del recibo. Va
después del CUIL y del DNI, porque es el más corto y el que más fácil choca —un
CUIL de once dígitos no se parece a nada, un legajo de cuatro sí—. Agregarlo ahí
en vez de en este importador es lo que evita un cuarto emparejamiento con su
propio criterio.

### La asimetría entre un reclamo y un caso

**Un reclamo entra aunque no se identifique a la persona**: vive en la raíz del
estado y guarda el nombre escrito, así que se puede trabajar igual y lo único
que falta es el vínculo con la ficha.

**Un caso no.** Los casos cuelgan de la persona (`c.casos`), así que sin ficha no
hay dónde colgarlo. Esa asimetría **se nombra en la pantalla en vez de taparse**,
y los legales van aparte y en rojo: una carta documento que no entró tiene
plazos corriendo.

### Lo que devuelve

`{ reclamos, casos, repetidos, sinPersona, enConflicto, invalidos, sobras, leidos }`.
Separa lo que es ruido de lo que es trabajo, igual que el importador de la
planilla de ausencias, y **lo que no entró vuelve con su texto** para poder
resolverlo a mano. Un aviso que desaparece sin decir nada es peor que no tener
el anexo.

## El formulario, pregunta por pregunta

Lo que el gerente ve, en orden:

1. **¿Qué querés avisar?** — las tres ramas, como botones grandes. Es la primera
   decisión y se toma con el pulgar.
2. **Tienda** — desplegable con las doce. Nunca texto libre. Los flotantes del
   área no están: no son una tienda y ningún gerente carga por ellos.
3. **Nombre del colaborador** — texto.
4. **DNI** — opcional, pero pedido. **Es el DNI y no el legajo**: se midió el
   padrón y el legajo está cargado en **0 de 141** personas, el DNI en 139.
   Pedir primero el que no sirve es pedir un dato que no va a emparejar con
   nada. El legajo se sigue aceptando, para cuando la nómina lo traiga.
5. **Qué le pagaron mal** / **qué llegó** / **de qué se trata** — según la rama.
6. **Período** y **monto aproximado** — solo en la rama de reclamo.
7. **Cuándo llegó** — solo en la rama legal.
8. **Contalo en dos renglones** — texto libre.
9. **Tu nombre** — esto es lo que WhatsApp daba gratis y un formulario pierde.
   Sin eso no se sabe a quién contestarle.

**La tienda y el nombre del gerente se recuerdan en ese teléfono**
(`localStorage`), así no los elige de nuevo todos los días. Es una comodidad de
quien carga y no viaja a ningún lado; va con `try/catch` porque un navegador que
bloquea el almacenamiento tira, y la página funciona igual sin eso.

**Los botones aparecen solo cuando el mensaje está completo**, y mientras no lo
está la pantalla dice qué falta. Mandar algo a medias obliga a una segunda
vuelta de WhatsApp, que es justo lo que esto viene a sacar.

El salto de línea del detalle **se aplasta** a ` / `: el formato es una línea por
dato y un enter en el medio rompería el parseo del otro lado.

## Lo que no va por acá

**Certificados ni documentación.** Eso se entrega como siempre; la página lo
dice. Esto es el aviso, para que quede asentado y con fecha.

## Repartirlo

Es un archivo solo, así que se puede mandar por mail, publicar o dejar en una
carpeta compartida. Antes de repartirlo:

```
python3 build-anexo.py --tel <whatsapp> --mail <casilla>
node check-anexo.js
```
