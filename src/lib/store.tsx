import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { backend, isDemo, LocalBackend } from './backend';
import { buildDemoAnnouncements, buildDemoGestiones, buildDemoRequests } from './demoRequests';
import { buildSeed } from './seed';
import { EMPTY_SNAPSHOT, PortalService, type Snapshot } from './service';
import type { Profile } from './types';

interface Ctx {
  user: Profile | null;
  booting: boolean;
  data: Snapshot;
  svc: PortalService | null;
  isDemo: boolean;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
  /** Ejecuta una operación, refresca y devuelve el error (si lo hubo) como texto. */
  run<T>(fn: (svc: PortalService) => Promise<T>): Promise<T>;
  resetDemo(): Promise<void>;
}

const C = createContext<Ctx | null>(null);

async function ensureSeed() {
  if (!(backend instanceof LocalBackend)) return;
  if (!(await backend.isEmpty())) {
    // Datos de una versión anterior de la demo: se recargan.
    if (await backend.hasRecord('announcements', 'ann-demo-1')) return;
    await backend.resetAll();
  }
  const s = await buildSeed();
  const demo = await buildDemoRequests(s.data.template_versions);
  const ges = buildDemoGestiones(s.data.template_versions);
  const ann = buildDemoAnnouncements();
  await backend.seed({
    ...s.data, ...demo, ...ann, gestiones: ges.gestiones, files: [...s.data.files, ...ges.files],
    audit_events: [...demo.audit_events, ...ges.audit_events], notifications: [...demo.notifications, ...ges.notifications],
  }, s.passwords);
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [booting, setBooting] = useState(true);
  const [data, setData] = useState<Snapshot>(EMPTY_SNAPSHOT);
  const dataRef = useRef(data);
  dataRef.current = data;

  const svc = useMemo(() => (user ? new PortalService(backend, user, () => dataRef.current) : null), [user]);

  const refresh = useCallback(async () => {
    if (!svc) return;
    const s = await svc.load();
    dataRef.current = s;
    setData(s);
  }, [svc]);

  useEffect(() => {
    (async () => {
      await ensureSeed();
      setUser(await backend.restoreSession());
      setBooting(false);
    })();
  }, []);

  useEffect(() => {
    refresh();
    return backend.subscribe(() => refresh());
  }, [refresh]);

  const value: Ctx = {
    user, booting, data, svc, isDemo,
    async signIn(email, password) {
      setUser(await backend.signIn(email, password));
    },
    async signOut() {
      await backend.signOut();
      setUser(null);
      setData(EMPTY_SNAPSHOT);
    },
    refresh,
    async run(fn) {
      if (!svc) throw new Error('Sesión vencida.');
      try {
        // Se trabaja siempre sobre datos frescos: otro usuario pudo haber cambiado el estado.
        await refresh();
        return await fn(svc);
      } finally {
        await refresh();
      }
    },
    async resetDemo() {
      if (backend instanceof LocalBackend) {
        await backend.resetAll();
        await ensureSeed();
        setUser(null);
        setData(EMPTY_SNAPSHOT);
      }
    },
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useData() {
  const c = useContext(C);
  if (!c) throw new Error('DataProvider faltante');
  return c;
}
