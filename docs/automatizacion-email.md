# Envío automático del reporte al Gerente de Operaciones

El tablero ofrece dos modos de envío. El primero funciona sin configurar nada; el
segundo deja el envío totalmente automático.

## Modo 1 — Cliente de correo (sin configuración)

Es el modo por defecto. Al presionar **Enviar al Gerente de Operaciones** se abre
Outlook, Gmail o el cliente que esté configurado en el equipo, con destinatario,
copias, asunto y el reporte completo ya cargados en el cuerpo. Solo hay que
confirmar el envío.

Ventajas: no requiere ninguna cuenta ni permiso adicional, y el correo sale desde
la casilla del coordinador, con su firma.

Límite: algunos clientes recortan mensajes muy largos abiertos por este método. Si
eso pasa, el botón **Copiar reporte** deja el texto completo en el portapapeles
para pegarlo en el correo.

## Modo 2 — Envío automático por endpoint

Cargando una URL en **Configuración → Endpoint de envío automático**, el tablero
manda el reporte por `POST` sin abrir el cliente de correo. El coordinador
presiona el botón y el mail sale solo.

### Estructura del envío

`POST` con el cuerpo en JSON:

```json
{
  "para": "operaciones@empresa.com",
  "cc": ["rrhh@empresa.com"],
  "asunto": "Visita RRHH · Centro (sucursal1) · 15/04/2026",
  "cuerpo": "REPORTE DE VISITA A SUCURSAL - FARMATODO ...",
  "sucursal": { "codigo": "sucursal1", "nombre": "Centro", "tipo": "venta" },
  "visita":   { "id": "…", "fecha": "2026-04-15", "periodo": "2026-04", "coordinador": "…" },
  "metricas": {
    "headcount": 12,
    "fteReal": 11.4,
    "costoLaboralTotal": 18500000,
    "costoPorFte": 1622807,
    "ausentismoPct": 0.048,
    "horasExtras": 96,
    "rotacionMensual": 0.0242,
    "dotacionOptima": 13,
    "diferenciaDotacion": 1
  }
}
```

El bloque `metricas` permite, además de enviar el mail, volcar cada visita a una
planilla y tener la serie histórica de toda la red sin recargar nada a mano.

> Nota técnica: el `Content-Type` es `text/plain;charset=utf-8` aunque el
> contenido sea JSON. Es deliberado: así el navegador no dispara la verificación
> previa `OPTIONS`, que Google Apps Script no responde. En el endpoint hay que
> parsear el cuerpo como JSON igual.

### Opción A — Google Apps Script (gratis, recomendada)

1. Crear una planilla nueva en Google Sheets, con una hoja llamada `Visitas`.
2. **Extensiones → Apps Script** y pegar:

```javascript
function doPost(e) {
  const d = JSON.parse(e.postData.contents);

  MailApp.sendEmail({
    to: d.para,
    cc: (d.cc || []).join(','),
    subject: d.asunto,
    body: d.cuerpo
  });

  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Visitas');
  if (hoja.getLastRow() === 0) {
    hoja.appendRow(['Enviado', 'Sucursal', 'Fecha visita', 'Período', 'Coordinador',
                    'Headcount', 'FTE Real', 'Costo laboral', 'Costo/FTE',
                    '% Ausentismo', 'Hs. extras', 'Rotación', 'Dotación óptima', 'Diferencia']);
  }
  const m = d.metricas || {};
  hoja.appendRow([new Date(), d.sucursal.nombre || d.sucursal.codigo, d.visita.fecha,
                  d.visita.periodo, d.visita.coordinador, m.headcount, m.fteReal,
                  m.costoLaboralTotal, m.costoPorFte, m.ausentismoPct, m.horasExtras,
                  m.rotacionMensual, m.dotacionOptima, m.diferenciaDotacion]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. **Implementar → Nueva implementación → Aplicación web**.
   - *Ejecutar como*: yo.
   - *Quién tiene acceso*: cualquier usuario.
4. Autorizar los permisos que pide (enviar correo y escribir en la planilla).
5. Copiar la URL `https://script.google.com/macros/s/…/exec` y pegarla en
   **Configuración → Endpoint de envío automático**.

El correo sale desde la cuenta de Google del coordinador y cada visita queda
además registrada como una fila en la planilla.

### Opción B — Make o Zapier

Crear un escenario con disparador **Webhook / Catch Hook**, copiar la URL que
generan y pegarla en Configuración. Después encadenar los módulos que hagan falta:
enviar el mail, agregar una fila a una planilla, avisar por Teams o Slack, o crear
la tarea de seguimiento.

### Opción C — Casilla corporativa vía TI

Si el área de sistemas prefiere que el correo salga de una casilla institucional,
el endpoint puede ser un servicio interno que reciba este mismo `POST` y lo
reenvíe por el servidor SMTP de la empresa. Lo único que necesitan saber es la
estructura del JSON de arriba.

## Enviar automáticamente al cerrar la visita

Hoy el envío se dispara con el botón, a propósito: conviene revisar la vista
previa antes de que el reporte salga. Si preferís que salga solo al marcar la
visita como cerrada, se agrega en `assets/js/app.js` y se avisa.

## Sobre los datos

El tablero no manda información a ningún lado por su cuenta: todo queda en el
navegador hasta que se presiona el botón de envío. Como el reporte incluye
nombres de colaboradores, feedback de clima y datos salariales, conviene:

- usar el endpoint solo con cuentas y servicios habilitados por la empresa;
- mantener la lista de copias acotada a quien deba recibirla;
- exportar respaldos a una carpeta de trabajo, no a un equipo compartido.
