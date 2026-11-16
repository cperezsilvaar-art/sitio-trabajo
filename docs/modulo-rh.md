# Guía del módulo de gestiones, sanciones y aprobaciones

## Para gerentes

1. **Nueva solicitud** (botón azul arriba a la derecha, o *Crear*).
2. Elegí la tienda y el colaborador (o escribí el legajo).
3. Describí el hecho: qué pasó, cuándo, dónde, quiénes lo vieron y qué impacto tuvo. Sin opiniones.
4. Indicá antecedentes y adjuntá el respaldo (actas, planillas, capturas). Algunas medidas lo exigen.
5. Elegí la medida y el modelo. Completá los datos que pide el modelo.
6. Revisá el borrador y **Enviá a RH**. Desde ese momento no se puede modificar, salvo que RH te la devuelva.

En **Mis solicitudes** ves el estado de cada una. Si RH pide modificaciones, la solicitud
aparece en *Requieren mi atención* con la devolución: corregí y reenviá.

Cuando la medida está **Aprobada**, descargá el documento definitivo, notificá al
colaborador y **registrá la notificación** en el portal. Si se niega a firmar, dejá
constancia con dos testigos y anotalo en las observaciones.

> Nunca entregues un borrador. Sólo el documento definitivo (sin la leyenda
> BORRADOR, con el nombre de quien aprobó) tiene validez.

## Para coordinadores de RH

- **Solicitudes pendientes de aprobación** muestra lo que espera decisión, de la más antigua a la
  más nueva. En rojo, las que superaron el plazo de revisión.
- En cada solicitud: *Tomar la solicitud* (pasa a *Pendiente de revisión* y le avisa al gerente),
  revisar datos, adjuntos, versiones anteriores y otras solicitudes del mismo colaborador.
- **Observaciones internas**: sólo las ve RH; quedan en la auditoría.
- **Decisión**: aprobar, rechazar o pedir modificaciones. Para rechazar o devolver, la devolución es
  obligatoria y la ve el gerente.
- Al aprobar se genera el documento definitivo de **esa versión**. No se puede aprobar una solicitud
  que uno mismo inició.
- **Cerrar** el caso una vez registrada la notificación.
- **Rectificar**: si después de aprobar hay que cambiar algo (y todavía no se notificó), la aprobación
  queda sin efecto, la solicitud vuelve a borrador y requiere una nueva aprobación. La versión
  anterior queda en el historial como "sin efecto".

## Para administradores de RH: cómo preparar un modelo

1. **Modelos y versiones → Cargar modelo.**
2. Escribí o pegá el texto. Donde va un dato, insertá el marcador con los botones de *Insertar campo*.
   Marcadores disponibles:

   | Marcador | Dato |
   |---|---|
   | `{{colaborador}}`, `{{legajo}}`, `{{puesto}}` | Datos del colaborador |
   | `{{tienda}}`, `{{area}}` | Tienda y área |
   | `{{fecha_incidente}}`, `{{fecha_incidente_larga}}` | 03/11/2026 · 3 de noviembre de 2026 |
   | `{{tipo_situacion}}`, `{{tipo_medida}}` | Clasificación |
   | `{{descripcion_hechos}}`, `{{antecedentes}}` | Lo que escribió el gerente |
   | `{{gerente}}`, `{{numero_solicitud}}` | Solicitante y número |
   | `{{fecha_emision}}`, `{{fecha_emision_larga}}`, `{{ciudad}}` | Emisión |
   | `{{aprobado_por}}` | Nombre de quien aprobó (vacío en borradores) |
   | `{{estado_documento}}` | Leyenda de borrador (vacío en el definitivo) |

3. **Campos adicionales**: si el modelo necesita algo más (días de suspensión, fechas, plazo de
   descargo), agregalo como campo. El identificador es el marcador (`{{dias_suspension}}`).
4. **Word**: para respetar exactamente el formato institucional, subí el `.docx` con los mismos
   marcadores escritos tal cual (por ejemplo `{{colaborador}}`). El portal verifica que no haya
   marcadores desconocidos. Consejo: escribí cada marcador de una sola vez, sin cambiarle el formato
   a la mitad, para que Word no lo parta internamente.
5. Marcá qué **tipos de solicitud** usan el modelo y publicá.

Cada cambio de texto, campos o archivo publica una **versión nueva** y pide describir qué cambió.
Las solicitudes ya enviadas siguen usando la versión con la que se generaron. Un modelo desactivado
deja de aparecer para los gerentes pero se conserva con todo su historial.

En **Circuito, permisos y usuarios** se define qué roles aprueban, si los coordinadores se limitan a
sus áreas, el coordinador de cada área, el plazo de revisión y la leyenda de los borradores.
