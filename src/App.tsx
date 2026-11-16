import type { ReactNode } from 'react';
import { HashRouter, MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DataProvider, useData } from './lib/store';
import type { Role } from './lib/types';
import { AdminCircuito, AdminTipos } from './pages/AdminConfig';
import { AdminModelos, ModeloEditor } from './pages/AdminModelos';
import { Aprobaciones } from './pages/Aprobaciones';
import { Auditoria } from './pages/Auditoria';
import { Biblioteca } from './pages/Biblioteca';
import { Inicio } from './pages/Inicio';
import { Login } from './pages/Login';
import { SolicitudDetalle } from './pages/SolicitudDetalle';
import { SolicitudForm } from './pages/SolicitudForm';
import { Solicitudes } from './pages/Solicitudes';

function Only({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useData();
  return user && roles.includes(user.role) ? <>{children}</> : <Navigate to="/" replace />;
}

function Shell() {
  const { user, booting } = useData();
  if (booting) return <div className="grid min-h-screen place-items-center text-sm text-ink-500">Cargando Portal RH…</div>;
  if (!user) return <Login />;
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/biblioteca" element={<Biblioteca />} />
        <Route path="/solicitudes" element={<Solicitudes />} />
        <Route path="/solicitudes/nueva" element={<Only roles={['gerente']}><SolicitudForm /></Only>} />
        <Route path="/solicitudes/:id/editar" element={<Only roles={['gerente']}><SolicitudForm /></Only>} />
        <Route path="/solicitudes/:id" element={<SolicitudDetalle />} />
        <Route path="/aprobaciones" element={<Only roles={['coordinador', 'admin_rh']}><Aprobaciones /></Only>} />
        <Route path="/auditoria" element={<Only roles={['coordinador', 'admin_rh']}><Auditoria /></Only>} />
        <Route path="/admin/modelos" element={<Only roles={['admin_rh']}><AdminModelos /></Only>} />
        <Route path="/admin/modelos/:id" element={<Only roles={['admin_rh']}><ModeloEditor /></Only>} />
        <Route path="/admin/tipos" element={<Only roles={['admin_rh']}><AdminTipos /></Only>} />
        <Route path="/admin/circuito" element={<Only roles={['admin_rh']}><AdminCircuito /></Only>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

/** En la demo publicada dentro de Claude la navegación no usa la barra de direcciones. */
const Router = import.meta.env.VITE_EMBED === '1' ? MemoryRouter : HashRouter;

export default function App() {
  return (
    <DataProvider>
      <Router>
        <Shell />
      </Router>
    </DataProvider>
  );
}
