# sitio-trabajo
Coordinador de Recursos Humanos - Farmatodo

Sitio web del **Área 3 · Operaciones** con dos secciones:

1. **Organigrama dinámico por tienda**: Gerente de Tienda arriba con el Director Técnico al costado; debajo los APB Senior, luego los Asistentes de Piso de Venta y, abajo, Dermo y Asesoras. Las tarjetas se arrastran entre niveles o se tocan para cambiar el puesto o mover a otra tienda.
2. **Minuta semanal**: cada viernes se carga una minuta con 7 bloques (Capacitación, Ausentismo y licencias, Casos críticos, Sanciones disciplinarias, Bajas, Movimientos internos, Reuniones con colaboradores). Queda todo el historial, con buscador.

## Privacidad
Los datos (nómina y minutas) **se guardan cifrados** en `data/data.enc.json` (AES-256-GCM, clave derivada de la contraseña con PBKDF2). Sin la contraseña no se puede leer nada, aunque el repositorio o el sitio sean públicos. La nómina original en Excel **no** se sube al repositorio, ni los CUIL.

## Cómo publicarlo (una sola vez)
1. Unir esta rama a `main`.
2. En GitHub: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`**.
   (En cuentas gratuitas GitHub Pages requiere que el repositorio sea público; los datos siguen cifrados.)
3. La dirección queda en `https://cperezsilvaar-art.github.io/sitio-trabajo/`. Esa dirección + la contraseña es todo lo que necesita el gerente.

## Modo editor (para cargar minutas y publicar cambios)
1. En GitHub: **Settings (de tu perfil) → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
   - Repository access: *Only select repositories* → `sitio-trabajo`.
   - Permissions → Repository permissions → **Contents: Read and write**.
2. En el sitio: ⚙︎ **Configuración** → pegar el token → *Guardar token*. Queda guardado solo en ese navegador.
3. Cargás la minuta (o mové gente del organigrama) y tocás **Publicar cambios**. En 1–2 minutos lo ve el gerente.

Sin token, los cambios en el organigrama se guardan solo en ese dispositivo.

Desde Configuración también se puede **cambiar la contraseña** y **descargar un respaldo**.
