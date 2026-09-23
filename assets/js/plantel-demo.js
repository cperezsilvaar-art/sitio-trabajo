/*
 * plantel-demo.js — Cinco personas inventadas, solo para la página publicada.
 *
 * **Ninguna de estas personas existe.** El plantel de verdad vive en
 * `plantel-area3.js` y no sale del repositorio ni del navegador del
 * coordinador: una página publicada es pública y ahí no va nadie real.
 *
 * `index.html` NO carga este archivo. Lo usa solamente
 * `build-pagina-unica.py --demo`, que arma la versión que se publica: saca
 * `plantel-area3.js`, pone estas cinco en su lugar y barre los nombres de los
 * referentes de las sucursales. Sin esto la página publicada abre vacía y
 * parece rota, que es exactamente lo que pasó.
 *
 * Están elegidas para que una sola tienda muestre cómo cuenta el panel: cinco
 * cabezas pero **3,5 FTE de piso**, porque Espósito es media jornada y Dávalos
 * tiene bloqueo de título y no cubre turno. Corvalán es la APV con menos
 * antigüedad: la candidata natural para mostrar `#/desarrollo`.
 */

const PLANTEL_AREA3 = [
  {"ap": "ACUÑA",    "no": "VALENTINA",        "t": "BOTANICO", "cat": "FUERA DE CONVENIO",         "cargo": "GERENTE DE TIENDA",                 "niv": "GERENTE DE TIENDA", "ing": "2017-03-06", "ftd": "2025-03-01", "est": "INDETERMINADO", "uni": "OPERACIONES - FARMACIA"},
  {"ap": "BELTRÁN",  "no": "MATÍAS EZEQUIEL",  "t": "BOTANICO", "cat": "EMPLEADO ESP. DE FARMACIA", "cargo": "ASISTENTE DE PISO DE VENTA SENIOR", "niv": "APV SENIOR",        "ing": "2020-09-14", "ftd": "2025-03-01", "est": "INDETERMINADO", "uni": "OPERACIONES - FARMACIA"},
  {"ap": "CORVALÁN", "no": "ROCÍO",            "t": "BOTANICO", "cat": "EMPLEADO DE FARMACIA",      "cargo": "ASISTENTE DE PISO DE VENTAS",       "niv": "BASE FARMACIA",     "ing": "2024-02-19", "ftd": "2024-02-19", "est": "INDETERMINADO", "uni": "OPERACIONES - FARMACIA"},
  {"ap": "DÁVALOS",  "no": "IGNACIO",          "t": "BOTANICO", "cat": "DT NO PRESENCIAL",          "cargo": "DIRECTOR TECNICO CON BLOQUEO",      "niv": "DT CON BLOQUEO",    "ing": "2019-11-04", "ftd": "2025-03-01", "est": "INDETERMINADO", "uni": "OPERACIONES - FARMACIA"},
  {"ap": "ESPÓSITO", "no": "CAMILA",           "t": "BOTANICO", "cat": "FARMACEUTICO AUXILIAR",     "cargo": "FARMACEUTICO AUXILIAR TP",          "niv": "FARMACEUTICO",      "ing": "2023-06-01", "ftd": "2025-03-01", "est": "INDETERMINADO", "uni": "OPERACIONES - FARMACIA", "j": 0.5}
];

if (typeof module !== 'undefined' && module.exports) module.exports = { PLANTEL_AREA3 };
