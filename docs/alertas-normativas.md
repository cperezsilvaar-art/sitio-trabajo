# Alertas normativas — cómo funcionan

El tablero contrasta lo que se releva en cada visita contra la **Ley de Contrato
de Trabajo (Ley 20.744)** y el **CCT 414/05 de ADEF**, y marca los temas que la
norma regula.

## Qué es y qué no es

Es una **ayuda de relevamiento**: señala qué artículo mirar y por qué, a partir
de los números cargados y de las palabras que aparecen en las minutas.

No interpreta los hechos, no evalúa la gravedad de una injuria ni sustituye la
consulta con Legales o Relaciones Laborales. Un caso concreto se resuelve con el
expediente completo, no con una alerta de pantalla.

## Dos condiciones previas

**1. La jurisdicción.** El art. 3 del CCT 414/05 limita su ámbito a la Ciudad
Autónoma de Buenos Aires y a estos partidos bonaerenses: San Martín, Tres de
Febrero, Morón, Ituzaingó, Hurlingham, Merlo, San Justo, La Matanza, Lanús,
Avellaneda, San Isidro, San Fernando, Vicente López, Lomas de Zamora, Escobar,
Pilar, Tigre, San Miguel, Malvinas Argentinas, José C. Paz y Moreno. El art. 16
de la LCT prohíbe aplicar convenios por analogía. Por eso cada sucursal declara
su jurisdicción, y el tablero avisa cuando queda fuera del ámbito.

**2. El encuadre de categorías.** El convenio no usa las posiciones de tienda
sino sus propias categorías (arts. 5 a 9). Sin encuadre no se puede evaluar el
básico, el escalafón por antigüedad ni los adicionales. El encuadre propuesto por
defecto es:

| Posición de tienda | Categoría del convenio | Artículo |
|---|---|---|
| Gerente de Tienda | Fuera de convenio | — |
| Senior | Empleado Especializado de Farmacia | art. 8 |
| APV | Empleado de Farmacia | art. 7 |
| Farmacéutico | Farmacéutico | art. 9 |
| DT | Farmacéutico con Dirección Técnica | arts. 9 y 18 inc. b |
| Asesora de Dermo | Personal de Perfumería | art. 6 inc. b |

Es una lectura de las tareas que describen esos artículos, **no una definición de
la empresa**. Confirmalo con Legales antes de usarlo para liquidar: de ese
encuadre dependen el básico, el escalafón y los adicionales.

## De dónde salen las alertas

**Situaciones que cargás** en la solapa *Alertas normativas*. Cada situación
tiene un tipo (reemplazo, enfermedad, suspensión, embarazo, descuento, egreso,
menor, jornada…), un dato numérico y la antigüedad del colaborador. Con eso el
tablero aplica el umbral que fija la norma. Ejemplos:

- Reemplazo de 4 meses en categoría superior → recategorización definitiva
  (CCT art. 10).
- 78 días de licencia con 2 años de antigüedad y cargas de familia → sobre un
  tope de 180 días (LCT art. 208).
- Descuento del 30% del sueldo → supera el tope del 20% (LCT arts. 131 y 133).

**Datos que ya están en la visita**: horas extras de la matriz de FTE,
suspensiones y vacaciones del ausentismo, ausencias sin aviso, sanciones,
altas y bajas, dotación para el cálculo de delegados.

**Texto libre de las minutas**: se detectan palabras clave y se señala la norma
que aplica. Si escribís "le quieren descontar la falla de caja", aparecen el
art. 19 del convenio y el art. 131 de la LCT. Esto detecta **temas**, no
situaciones: es un recordatorio, no un diagnóstico.

## Niveles

| Nivel | Qué significa |
|---|---|
| **Crítica** | Algo que, con los datos cargados, ya está fuera de la norma o a punto de estarlo |
| **Alta** | Una obligación o un plazo que hay que verificar ahora |
| **Revisar** | Un tema mencionado que conviene contrastar |
| **Referencia** | El dato de la norma, sin desvío detectado |

Las críticas y las altas viajan en el reporte al Gerente de Operaciones. Las de
menor prioridad quedan en el tablero.

## Consulta rápida

En la misma solapa hay un campo donde pegar cualquier texto y buscar las normas
relacionadas. Sirve durante la conversación, sin tener que cargar la situación
como caso.

## Sobre las cifras del convenio

Los **básicos del art. 12 son de 2005** y están superados por las paritarias
posteriores: el tablero no los usa ni los muestra como vigentes. Lo que sí sigue
vigente y está incorporado son las reglas porcentuales: el escalafón por
antigüedad del art. 13, los adicionales del art. 18, el fondo compensador del
art. 19 y la obligación del art. 22 de mantener la diferencia porcentual entre
categorías ante cualquier aumento general.

También quedó registrado que las referencias del convenio a trabajadores
**mayores de 14 años** (arts. 5 y 28) fueron desplazadas por la Ley 26.390, que
fijó la edad mínima de admisión al empleo en 16 años.

## Actualización

Las normas están en `assets/js/normativa.js`, cada una con su fuente citada.
Cuando cambie una paritaria o se reforme un artículo, se edita ahí y el cambio
alcanza a todas las visitas.
