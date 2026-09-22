# Gestión de Talento

Aplicación web interna para la gestión de talento: plantilla de colaboradores,
reclutamiento y selección, desempeño y capacitación. Funciona sin servidor ni
base de datos, y toda la información se guarda **cifrada en el navegador**.

Repositorio: `cperezsilvaar-art/sitio-trabajo` · Christian Pérez, Coordinador de
Recursos Humanos.

---

## Módulos

| Módulo | Qué resuelve |
|---|---|
| **Panel** | Indicadores: plantilla activa, vacantes abiertas, desempeño promedio, rotación a 12 meses, antigüedad promedio y horas‑persona de capacitación. Además, quiénes están pendientes de evaluación en el año. |
| **Colaboradores** | Alta, edición y baja de personal: cargo, área, reporte, contacto, fecha de ingreso y de egreso, estado y notas. |
| **Reclutamiento** | Vacantes (posiciones, estado, días abierta) y candidatos con avance por etapas, desde *Postulado* hasta *Contratado* o *Descartado*. |
| **Desempeño** | Evaluaciones por período con puntaje de objetivos y competencias (escala 1 a 5), potencial, fortalezas y plan de acción. Puntaje promedio por área. |
| **Capacitación** | Actividades por tipo y modalidad, duración, participantes y cálculo de horas‑persona. |
| **Datos y ajustes** | Respaldos cifrados, exportación a CSV, cambio de clave, datos de ejemplo y borrado total. |

---

## Qué hay en este repositorio

| Ruta | Qué es |
|---|---|
| `/` | **Gestión de Talento**: aplicación interna de RRHH con acceso por clave y datos cifrados. |
| `/ruleta/` | **Ruleta de premios** para el stand de la expo. Ver [`ruleta/README.md`](ruleta/README.md). |

Con GitHub Pages activado, cada una queda en su propia dirección:
`.../sitio-trabajo/` y `.../sitio-trabajo/ruleta/`.

---

## Cómo publicarla en GitHub Pages

1. En GitHub, entra al repositorio → **Settings** → **Pages**.
2. En *Source* elige **Deploy from a branch**.
3. En *Branch* selecciona `main` y la carpeta `/ (root)`. Guarda con **Save**.
4. Espera uno o dos minutos. La app queda disponible en:
   `https://cperezsilvaar-art.github.io/sitio-trabajo/`

> Para probarla antes de fusionar a `main`, puedes apuntar *Branch* a la rama de
> desarrollo `claude/zealous-babbage-9btsln`.

**Para usarla en el teléfono:** abre esa dirección en el navegador y usa
"Agregar a la pantalla de inicio". Se comporta como una app más.

---

## Seguridad: lee esto antes de cargar datos reales

La app pide una clave al abrirse. Esa clave **no se guarda en ninguna parte**:
de ella se deriva una llave de cifrado (PBKDF2‑SHA256, 250.000 iteraciones) que
cifra la información con **AES‑256‑GCM** antes de escribirla en el navegador.

Qué implica eso, en concreto:

- Quien abra la dirección sin la clave ve solo la pantalla de bloqueo.
- Quien inspeccione el almacenamiento del navegador ve texto cifrado ilegible.
- La sesión **se bloquea sola** a los 15 minutos de inactividad.
- **Si olvidas la clave, los datos no se pueden recuperar.** No existe
  "olvidé mi contraseña": esa es justamente la propiedad que hace que el cifrado
  sirva. Guarda la clave en un gestor de contraseñas.

### Qué protege y qué no

El código de la app es público (es un repositorio de GitHub); los datos no lo
son, porque nunca salen de tu dispositivo. Esto es adecuado para que **una
persona** administre la información desde sus propios equipos.

**No** sirve para que varias personas compartan la misma base de datos: no hay
servidor, así que cada navegador tiene su propia copia. Si en el futuro
necesitas acceso de varios usuarios con permisos, roles y auditoría, hay que
sumar un backend real (por ejemplo Supabase o Firebase) o un control de acceso
por delante del sitio (Cloudflare Access, Netlify Identity). En ese momento hay
que revisar además el tratamiento de datos personales que exija la normativa
laboral aplicable.

---

## Respaldos

Los datos viven en un solo navegador. Si se borra el historial del sitio, se
formatea el equipo o se cambia de computadora, **se pierden**. Por eso:

- **Respaldar** descarga un archivo `.json` **cifrado**. Es seguro guardarlo en
  la nube, enviarlo por correo o dejarlo en un pendrive: solo se abre con la
  clave con la que fue creado.
- **Restaurar desde respaldo** pide la clave de ese archivo y reemplaza el
  contenido actual del navegador. Es también la forma de llevar la información a
  otro equipo.
- **Exportar colaboradores a CSV** genera una planilla para Excel. Ese archivo
  **no está cifrado** y contiene datos personales legibles: descárgalo solo
  cuando lo necesites y bórralo después de usarlo.

Recomendación: un respaldo al cierre de cada mes, y otro antes de cargas
masivas de información.

---

## Estructura del proyecto

```
index.html          Estructura: pantalla de bloqueo y armazón de la app
assets/styles.css   Estilos, modo claro y oscuro
assets/app.js       Cifrado, datos, vistas y formularios
.nojekyll           Indica a GitHub Pages que publique los archivos tal cual
```

Sin dependencias ni compilación: HTML, CSS y JavaScript estándar.

## Desarrollo local

El cifrado del navegador exige un contexto seguro, así que abrir el archivo con
doble clic (`file://`) no funciona. Levanta un servidor local:

```bash
python3 -m http.server 8000
# y abre http://localhost:8000
```
