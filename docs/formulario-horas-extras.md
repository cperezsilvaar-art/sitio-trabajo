# El formulario de horas extras

El tercer buzón compartido con los Gerentes de Tienda, y el único que **pide una
respuesta**: el gerente avisa que necesita horas extras y espera que RRHH le
diga si puede. Los otros dos —reclamos de sueldo y ausencias del día— informan
algo que ya pasó.

**Esto no entra al panel.** Las respuestas viven en su planilla y ahí se
trabajan; el panel no tiene ninguna pantalla de pedidos de horas extras y no hay
que agregársela. Lo que el panel sí sigue contestando es lo de siempre, en
*El cierre del mes* (`#/nomina/cierre`): cuántas horas extras **liquidó** cada
persona en cada período y cómo viene contra los dos topes.

## Por qué es otro formulario y no una rama de los otros dos

- Es otra pregunta y otro momento: el de reclamos mira el recibo del mes pasado,
  el de ausencias mira hoy, y este mira un día que todavía no pasó.
- **La planilla de ausencias se pega en el panel.** Si las horas extras entraran
  por ese mismo formulario, esas filas aparecerían como error —«sin fecha de
  inicio»— cada vez que pegues el parte.
- Las secciones con derivación de Google Forms son el paso donde uno se pierde
  armándolo. Tres formularios chatos no tienen nada que configurar.

## Cómo crearlo

**Duplicá el de ausencias del día** —así los permisos quedan como los que ya
funcionan— y cambiale las preguntas.

**Nombre:** `Horas extras — Área 3`

**Descripción:**

> Para pedirle a RRHH autorización de horas extras. Cargalo **antes** de que se
> hagan: hay topes por persona y por mes, y una vez hechas no se pueden
> deshacer. Te contesto por el mismo canal de siempre.

**Mensaje de confirmación** (Configuración → Presentación → Mensaje de
confirmación). Este es el que más importa de todo el formulario:

> Listo. **Esto es un pedido, no una autorización**: esperá la respuesta de RRHH
> antes de darle las horas a nadie.

Sin ese renglón, el gerente lee «respuesta enviada» como «aprobado» y las horas
se hacen igual. Es el único punto donde este formulario puede fallar feo.

## Las preguntas, en orden

| # | Pregunta | Tipo | Obligatoria |
|---|---|---|---|
| 1 | `Tu tienda` | Opción múltiple | sí |
| 2 | `Gerente que solicita` | Respuesta corta | sí |
| 3 | `Apellido y nombre de quien haría las horas` | Respuesta corta | sí |
| 4 | `DNI de quien haría las horas` | Respuesta corta | no |
| 5 | `Motivo de las horas extras` | Opción múltiple | sí |
| 6 | `Si es para cubrir una licencia, de quién` | Respuesta corta | no |
| 7 | `Cantidad de horas solicitadas` | Respuesta corta | sí |
| 8 | `¿Qué día se harían?` | Fecha | sí |
| 9 | `Algo más que RRHH tenga que saber` | Párrafo | no |

**El día es obligatorio** porque el tope es mensual: sin saber de qué mes son,
no hay nada contra qué leerlas. La cantidad de horas, por lo mismo.

**El DNI se pide pero no se exige**, igual que en los otros dos: está cargado en
139 de 141 personas del padrón, así que sirve para no confundir homónimos, pero
exigirlo haría que inventen uno.

**La 6 existe para separar dos problemas distintos.** «Cubrir a Pérez», con
Pérez de licencia desde hace tres semanas, es un pedido de dotación disfrazado de
horas extras — y eso se habla con Operaciones, no se autoriza.

## Las opciones de la pregunta 5

```
Afluencia de público
Cubrir una licencia
Inventario o tarea puntual
Otro motivo
```

Corta a propósito: lo que cambia la decisión es si la carga es **del negocio** o
si es un **agujero de cobertura**.

## Las opciones de la pregunta 1

```
Botánico
Devoto
La Nobleza
Mark
Olivos
Olleros
Parque Chacabuco
Rivadavia
San Martín Center
Scalabrini
Villa Devoto
Villa del Parque
```

## La configuración que importa

- **No** pedir iniciar sesión ni recolectar direcciones de correo: los gerentes
  no tienen mail corporativo.
- **Sí** dejar que respondan más de una vez.
- El **mensaje de confirmación** de más arriba.
- En **Respuestas → Vincular a Hojas de cálculo**, crear la planilla.
- En esa planilla, **Archivo → Configuración → Configuración regional:
  Argentina**, o las fechas quedan al revés.

## Cómo se trabaja la planilla

Google escribe sus columnas de izquierda a derecha y **no toca lo que agregues a
la derecha de la última**. Agregale dos a mano:

| `¿Autorizado?` | `Respuesta` |
|---|---|
| Sí / No | qué le contestaste y cuándo |

Con eso la planilla deja de ser un buzón y pasa a ser el registro: se ordena por
*¿Qué día se harían?* y lo que está sin contestar queda arriba.

**Antes de contestar, el dato que decide** son los dos topes del **Decreto
484/2000**: **30 horas mensuales y 200 anuales por persona**, sin autorización
administrativa previa. Lo que cada persona ya tiene liquidado se lee en
*El cierre del mes* del panel, mes a mes. Los dos topes son dos problemas
distintos: pasarse en un mes se corrige el mes que viene, y **pasarse en el año
ya no se corrige**.
