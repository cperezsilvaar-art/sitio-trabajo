import type { ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { SelectionProvider } from './lib/selection';
import { DataProvider, useData } from './lib/store';
import { Alertas } from './pages/Alertas';
import { Aprobaciones } from './pages/Aprobaciones';
import { Comparacion } from './pages/Comparacion';
import { Configuracion } from './pages/Configuracion';
import { Dashboard } from './pages/Dashboard';
import { Empleados } from './pages/Empleados';
import { Login } from './pages/Login';
import { Planificacion } from './pages/Planificacion';
import { Reportes } from './pages/Reportes';
import { TiendaDinamica } from './pages/TiendaDinamica';

function AdminOnly({ children }: { children: ReactNode }) {
  const { user } = useData();
  return user?.role === 'admin' ? <>{children}</> : <Navigate to="/" replace />;
}

function Shell() {
  const { user, booting } = useData();
  if (booting) return <div className="grid min-h-screen place-items-center text-sm text-slate-500">Cargando FarmaPlan…</div>;
  if (!user) return <Login />;
  return (
    <SelectionProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/planificacion" element={<Planificacion />} />
          <Route path="/tienda" element={<TiendaDinamica />} />
          <Route path="/comparacion" element={<AdminOnly><Comparacion /></AdminOnly>} />
          <Route path="/alertas" element={<Alertas />} />
          <Route path="/aprobaciones" element={<Aprobaciones />} />
          <Route path="/empleados" element={<Empleados />} />
          <Route path="/reportes" element={<Reportes />} />
          <Route path="/configuracion" element={<Configuracion />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </SelectionProvider>
  );
}

export default function App() {
  return (
    <DataProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </DataProvider>
  );
}
