# FarmaPlan · Gestión mensual de horarios y dinámica de tiendas

Aplicación web para que los **gerentes de tienda** carguen los horarios mensuales de su equipo y para que **RR. HH. / Operaciones** analice, compare y apruebe la planificación de toda la cadena.

Tecnología: React 18 + TypeScript + Vite, Tailwind CSS, Recharts (gráficos), SheetJS (Excel) y Supabase (PostgreSQL + autenticación + tiempo real).

---

## Puesta en marcha

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # genera dist/ (sitio estático)
npm test           # pruebas del motor de cálculo
```

### Dos modos de funcionamiento

| Modo | Cuándo | Dónde se guardan los datos |
|---|---|---|
| **Demostración** (por defecto) | No hay variables de Supabase configuradas | En el navegador (`localStorage`). Persisten entre recargas, pero **no se comparten** entre equipos ni usuarios. La barra superior lo indica siempre. |
| **Supabase** | Se definen `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` | Base PostgreSQL compartida, con autenticación real y permisos aplicados en la base (RLS). |

> ⚠️ **Para uso real con varios gerentes es obligatorio configurar Supabase.** El modo demostración sirve para probar la herramienta; no es una base compartida.

Usuarios del modo demostración (contraseña `demo1234`): `rrhh@demo.farmaplan` (administrador), `gerente.centro@demo.farmaplan`, `gerente.palermo@demo.farmaplan`, `gerente.cordoba@demo.farmaplan`, `gerente.rosario@demo.farmaplan`. La pantalla de ingreso tiene accesos directos.

### Configurar Supabase (requerido para producción)

1. Crear un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor**, ejecutar completo [`supabase/schema.sql`](supabase/schema.sql). Crea tablas, índices, políticas RLS, reglas del flujo de aprobación y la publicación en tiempo real.
3. En **Authentication → Users**, crear el usuario administrador (correo + contraseña) y copiar su *User UID*.
4. Registrar su perfil (al final de `schema.sql` está el ejemplo):
   ```sql
   insert into public.profiles (id, email, name, role)
   values ('<UID>', 'rrhh@tuempresa.com', 'RR. HH.', 'admin');
   ```
5. Copiar `.env.example` a `.env` y completar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (Project Settings → API).
6. `npm run build` y publicar `dist/` en cualquier hosting estático (Vercel, Netlify, Supabase Storage, etc.). Las variables se incorporan en el build.
7. Ingresar como administrador → **Tiendas y parámetros** para crear tiendas (o *Cargar demostración*) y luego dar de alta a los gerentes: cada gerente se crea primero en *Authentication → Users* y después se le asigna perfil y tienda desde **Usuarios y permisos** pegando su UID. La aplicación usa sólo la clave pública (*anon*), por eso no puede crear credenciales por sí misma.

Si la actualización en tiempo real no llega, verificar en **Database → Replication** que la publicación `supabase_realtime` incluya las tablas (el script ya las agrega).

---

## Funcionalidades

**Perfiles y permisos**
- *Gerente*: sólo su tienda; carga y edita horarios de cualquier mes, ve cobertura y alertas, guarda borradores (autoguardado) y envía a revisión. No puede modificar una planificación aprobada.
- *Administrador RR. HH. / Operaciones*: todas las tiendas; consolidado, comparación, aprobación u observación, parámetros por tienda, usuarios y exportaciones.
- Los permisos se aplican en la base con **Row Level Security** y *triggers* (un gerente no puede aprobar, observar ni tocar planificaciones aprobadas aunque use la API directamente). En modo demostración se replican las mismas reglas en el navegador.

**Carga mensual** (`Carga de horarios`)
- Tabla editable empleados × días (28, 29, 30 o 31 días), agrupada por posición.
- Escritura rápida en la celda: `8-16`, `8:30-17`, `22-6` (nocturno), `8-12 15-19` (turno cortado), `f` franco, `v` vacaciones, `l` licencia, `a` ausencia.
- Selección múltiple (clic + Shift/Ctrl, arrastrar, fila o columna completa), turnos frecuentes en un clic, horario personalizado, editor de detalle (posición cubierta y observaciones), copiar/pegar (también desde y hacia Excel), deshacer.
- Copiar un día a otros, duplicar semanas y repetir el patrón de 4 semanas antes.
- Autoguardado y registro del usuario y la fecha de cada cambio. Vista calendario.

**Indicadores** (todos calculados a partir de los horarios guardados; no hay valores fijos)
- Personas por día y por franja horaria, apertura/cierre efectivos, posiciones presentes por franja, franjas de mayor y menor dotación, mapa de calor día × hora.
- Horas por empleado, posición, tienda, día y semana; promedios; comparación con horas contractuales.
- Turnos que cruzan la medianoche se reparten entre ambos días (incluye los del último día del mes anterior).

**Alertas automáticas** — errores (impiden aprobar) y advertencias:
horarios sin cargar, turnos superpuestos, franjas bajo la dotación mínima, posiciones clave sin cobertura (error o advertencia según se configure), exceso/defecto de horas diarias y semanales, descanso insuficiente, días consecutivos, desvío vs. contrato, turnos fuera del horario de apertura, dotación bajo el objetivo, planificaciones pendientes de completar y cambios posteriores al envío.

**Parámetros por tienda**: horario de apertura por día (incluye 24 h y cierre después de medianoche), dotación mínima, posiciones clave, objetivo de dotación por hora y reglas laborales.

**Flujo**: Pendiente de carga → En preparación → Enviada para revisión → Observada / Aprobada (con reapertura). Historial con fecha, usuario y comentario de cada cambio.

**Exportación a Excel**: horarios por tienda, por empleado, horas por posición, cobertura diaria y horaria, comparación entre tiendas, alertas y estado de aprobación, y libro completo. **Reporte mensual resumido** imprimible / PDF.

**Datos de demostración**: 4 tiendas ficticias (una 24 h) con empleados en las seis posiciones, mes anterior y mes actual en distintos estados. Se marcan con la etiqueta **DEMO** y pueden eliminarse desde *Tiendas y parámetros*.

---

## Estructura

```
src/lib/calc.ts         Motor de cálculo (cobertura, horas, alertas)
src/lib/store.tsx       Estado, autoguardado, flujo de aprobación
src/lib/backend/        Persistencia: local (demostración) y Supabase
src/lib/export.ts       Exportaciones Excel
src/lib/demo.ts         Generador de datos de demostración
src/components/         Tabla editable, gráficos, calendario, flujo
src/pages/              Pantallas
supabase/schema.sql     Base de datos, RLS y reglas
```

### Criterios de cálculo
- Una persona cuenta como presente en una franja horaria si trabaja al menos 30 minutos en ella.
- Las horas de un turno se imputan al día en que comienza.
- Las horas contractuales mensuales = horas semanales × días del mes / 7, descontando proporcionalmente vacaciones, licencias y ausencias; sólo se comparan cuando el mes del empleado está completo.
