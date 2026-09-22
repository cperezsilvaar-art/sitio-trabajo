# Ruleta de premios

Juego de ruleta para el stand de la expo. Página estática, sin dependencias,
que funciona **sin conexión** desde una notebook, una tablet o un televisor.

## Cómo se usa en el stand

1. Abre `index.html` (o la dirección publicada).
2. **Mantén presionado el nombre de la marca** —o presiona la tecla `A`— para
   abrir el panel de configuración. Los visitantes no lo encuentran por accidente.
3. Carga tus premios, colores y logo. Se guarda solo, en ese navegador.
4. Cierra el panel y a girar: botón central, clic en la rueda o barra espaciadora.

## El panel de configuración

| Sección | Qué permite |
|---|---|
| **Identidad** | Marca, título, bajada, los dos colores y el logo oficial (PNG o SVG, hasta 500 KB). |
| **Premios** | Texto del gajo, porciones, stock y **tipo**. Muestra la probabilidad real de cada gajo, calculada en vivo. |
| **Operación** | Pedir el nombre del participante antes de girar, sonido, confeti y pantalla completa. |
| **Entregas** | Listado de lo entregado, exportación a planilla y borrado del registro. |

### Porciones y probabilidad

Las **porciones** son los gajos que ocupa cada premio en la rueda, y definen su
probabilidad: 4 porciones sobre 16 son un 25 % de chance. La ruleta no está
trucada — lo que el visitante ve es la chance que realmente tiene. Las porciones
de un mismo premio se reparten separadas para que la rueda se vea prolija.

### Los tres tipos de gajo

| Tipo | Qué pasa al caer ahí |
|---|---|
| **Premio** | Entrega el premio, descuenta una unidad del stock y queda registrado como entrega. |
| **Gracias por participar** | No entrega nada y no toca el stock. Queda registrado como participación, para saber cuánta gente jugó. |
| **Gira de nuevo** | El visitante vuelve a girar sin consumir su turno. |

Con un solo premio real, lo habitual es un gajo de premio y varios de
"Gracias por participar": la rueda se ve llena y las chances quedan a la vista.

### Stock

El **stock** controla cuántas unidades entregás. Vacío significa ilimitado (sirve
para descuentos o folletos). Cuando un premio llega a cero sale de la rueda y los
demás se redistribuyen solos.

## Registro de entregas

Cada premio entregado queda registrado con fecha, hora y —si activaste el pedido
de datos— el nombre y el contacto del participante. Desde el panel lo exportás
para pegar en Excel o Google Sheets.

Los datos se guardan **solo en ese navegador**. Si la usas en dos dispositivos,
cada uno lleva su propia cuenta. Exporta las entregas antes de cerrar el evento.

Si registras datos de contacto de visitantes, avísales para qué los vas a usar:
son datos personales y corresponde tener su consentimiento.

## Estructura

```
index.html            Pantalla, capas de resultado y panel
assets/ruleta.css     Estilos
assets/ruleta.js      Rueda en canvas, giro, premios y configuración
```

## Atajos

| Atajo | Acción |
|---|---|
| Barra espaciadora | Girar |
| `A` | Abrir el panel de configuración |
| Presión larga en la marca | Abrir el panel (en pantallas táctiles) |
