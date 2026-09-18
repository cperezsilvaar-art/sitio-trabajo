/*
 * plantel-area3.js — Plantel de DEMOSTRACIÓN. Cinco personas inventadas.
 *
 * Acá vivía el plantel real del Área 3 —las 139 personas de la nómina de
 * septiembre de 2026—. Se sacó a pedido del coordinador para poder mostrar el
 * panel sin exponer a nadie: **ninguna de estas cinco personas existe**, los
 * nombres son inventados y las fechas también.
 *
 * Están pensadas para que una sola tienda alcance para mostrar cómo cuenta el
 * panel, que es lo que no se entiende mirando una lista:
 *
 *   - cinco cabezas, pero **3,5 FTE de piso**, porque Espósito es media
 *     jornada (`j: 0.5`, que el cargo `TP` ya implica);
 *   - Dávalos tiene **bloqueo de título**: presta la habilitación y no cubre
 *     turno, así que queda aparte de toda cuenta operativa y nunca suma a la
 *     dotación de piso;
 *   - Corvalán es la APV con menos antigüedad: es la candidata natural para
 *     mostrar la ruta de desarrollo al rol de Senior.
 *
 * Se cargan desde «Cargar el plantel del área», al pie de `#/nomina`.
 *
 * El plantel real no vuelve acá. Entra pegando la nómina en esa misma
 * pantalla y se queda solamente en el navegador, que es donde corresponde.
 * Si alguna vez hace falta recuperarlo, está en el historial de git, en los
 * commits anteriores a este archivo.
 */

const PLANTEL_AREA3 = [
  {"ap": "ACUÑA",    "no": "VALENTINA",        "t": "BOTANICO", "cat": "FUERA DE CONVENIO",         "cargo": "GERENTE DE TIENDA",                 "niv": "GERENTE DE TIENDA", "ing": "2017-03-06", "ftd": "2025-03-01", "est": "INDETERMINADO", "uni": "OPERACIONES - FARMACIA"},
  {"ap": "BELTRÁN",  "no": "MATÍAS EZEQUIEL",  "t": "BOTANICO", "cat": "EMPLEADO ESP. DE FARMACIA", "cargo": "ASISTENTE DE PISO DE VENTA SENIOR", "niv": "APV SENIOR",        "ing": "2020-09-14", "ftd": "2025-03-01", "est": "INDETERMINADO", "uni": "OPERACIONES - FARMACIA"},
  {"ap": "CORVALÁN", "no": "ROCÍO",            "t": "BOTANICO", "cat": "EMPLEADO DE FARMACIA",      "cargo": "ASISTENTE DE PISO DE VENTAS",       "niv": "BASE FARMACIA",     "ing": "2024-02-19", "ftd": "2024-02-19", "est": "INDETERMINADO", "uni": "OPERACIONES - FARMACIA"},
  {"ap": "DÁVALOS",  "no": "IGNACIO",          "t": "BOTANICO", "cat": "DT NO PRESENCIAL",          "cargo": "DIRECTOR TECNICO CON BLOQUEO",      "niv": "DT CON BLOQUEO",    "ing": "2019-11-04", "ftd": "2025-03-01", "est": "INDETERMINADO", "uni": "OPERACIONES - FARMACIA"},
  {"ap": "ESPÓSITO", "no": "CAMILA",           "t": "BOTANICO", "cat": "FARMACEUTICO AUXILIAR",     "cargo": "FARMACEUTICO AUXILIAR TP",          "niv": "FARMACEUTICO",      "ing": "2023-06-01", "ftd": "2025-03-01", "est": "INDETERMINADO", "uni": "OPERACIONES - FARMACIA", "j": 0.5}
];

if (typeof module !== 'undefined' && module.exports) module.exports = { PLANTEL_AREA3 };
