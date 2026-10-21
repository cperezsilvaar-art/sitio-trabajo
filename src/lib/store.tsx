import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { backend, localBackend } from './backend';
import { analyzePlan, type PlanAnalysis } from './calc';
import { daysInMonth, isoDate, monthKey, nowIso, prevMonth, uid } from './dates';
import { buildDemoData, defaultSettings } from './demo';
import type {
  AlertRecord, Employee, Entry, HistoryItem, Plan, PlanStatus, PositionId, Profile, Store, StoreSettings, TableName,
} from './types';

export interface CellChange {
  employee_id: string;
  date: string;
  /** nuevos registros de la celda (vacío = borrar) */
  entries: Omit<Entry, 'id' | 'plan_id' | 'store_id' | 'employee_id' | 'date' | 'updated_at' | 'updated_by'>[];
}

type SaveState = { status: 'idle' | 'saving' | 'saved' | 'error'; at: string | null; message?: string };

interface DataCtx {
  mode: 'local' | 'supabase';
  user: Profile | null;
  booting: boolean;
  loading: boolean;
  error: string | null;
  stores: Store[];
  settings: Record<string, StoreSettings>;
  employees: Employee[];
  profiles: Profile[];
  plans: Plan[];
  history: HistoryItem[];
  saveState: SaveState;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  reload(): Promise<void>;
  ensureMonth(year: number, month: number): void;
  monthLoaded(year: number, month: number): boolean;
  entriesFor(storeId: string, year: number, month: number): Entry[];
  planFor(storeId: string, year: number, month: number): Plan | null;
  replaceCells(storeId: string, year: number, month: number, changes: CellChange[]): void;
  flushNow(): Promise<void>;
  transitionPlan(storeId: string, year: number, month: number, to: PlanStatus, comment?: string): Promise<void>;
  saveEmployee(e: Employee): Promise<void>;
  deleteEmployee(e: Employee): Promise<void>;
  saveStore(s: Store, settings: StoreSettings): Promise<void>;
  deleteStore(s: Store): Promise<void>;
  saveProfile(p: Profile, password?: string): Promise<void>;
  loadDemo(): Promise<void>;
  removeDemo(): Promise<void>;
  resetLocal(): void;
  canEditStore(storeId: string): boolean;
  analysis(storeId: string, year: number, month: number, pos?: PositionId | null): PlanAnalysis | null;
}

const Ctx = createContext<DataCtx | null>(null);

export function useData() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useData fuera de DataProvider');
  return c;
}

/** Último día del mes anterior (para turnos nocturnos que continúan el día 1). */
function prevLastDay(y: number, m: number) {
  const [py, pm] = prevMonth(y, m);
  return isoDate(py, pm, daysInMonth(py, pm));
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [settingsList, setSettingsList] = useState<StoreSettings[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [months, setMonths] = useState<Record<string, Entry[]>>({});
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle', at: null });

  const monthsRef = useRef(months);
  monthsRef.current = months;
  const plansRef = useRef(plans);
  plansRef.current = plans;
  const userRef = useRef(user);
  userRef.current = user;
  const loadingMonths = useRef(new Set<string>());
  const pending = useRef<{ upserts: Map<string, Entry>; deletes: Set<string>; plans: Set<string> }>({ upserts: new Map(), deletes: new Set(), plans: new Set() });
  const flushTimer = useRef<number | null>(null);

  const loadBase = useCallback(async () => {
    const [s, st, e, p, pl, h] = await Promise.all([
      backend.select<Store>('stores'),
      backend.select<StoreSettings>('store_settings'),
      backend.select<Employee>('employees'),
      backend.select<Profile>('profiles'),
      backend.select<Plan>('plans'),
      backend.select<HistoryItem>('plan_history'),
    ]);
    setStores(s.sort((a, b) => a.code.localeCompare(b.code)));
    setSettingsList(st);
    setEmployees(e.sort((a, b) => a.name.localeCompare(b.name)));
    setProfiles(p);
    setPlans(pl);
    setHistory(h.sort((a, b) => b.at.localeCompare(a.at)));
  }, []);

  const fetchMonth = useCallback(async (y: number, m: number) => {
    const key = monthKey(y, m);
    const rows = await backend.select<Entry>('entries', [
      { col: 'date', op: 'gte', value: prevLastDay(y, m) },
      { col: 'date', op: 'lte', value: isoDate(y, m, daysInMonth(y, m)) },
    ]);
    // no pisar cambios aún no guardados
    const p = pending.current;
    const merged = rows.filter((r) => !p.deletes.has(r.id) && !p.upserts.has(r.id));
    for (const u of p.upserts.values()) if (u.date >= prevLastDay(y, m) && u.date <= isoDate(y, m, daysInMonth(y, m))) merged.push(u);
    setMonths((prev) => ({ ...prev, [key]: merged }));
  }, []);

  const reload = useCallback(async () => {
    if (!userRef.current) return;
    setLoading(true);
    try {
      await loadBase();
      await Promise.all(Object.keys(monthsRef.current).map((k) => fetchMonth(Number(k.slice(0, 4)), Number(k.slice(5)))));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [loadBase, fetchMonth]);

  // Arranque: restaurar sesión
  useEffect(() => {
    (async () => {
      try {
        if (localBackend && localBackend.isEmpty()) {
          const demo = buildDemoData();
          const { passwords, ...tables } = demo;
          localBackend.seed(tables as Partial<Record<TableName, object[]>>, passwords);
        }
        const p = await backend.restoreSession();
        if (p) {
          setUser(p);
          userRef.current = p;
          await loadBase();
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBooting(false);
      }
    })();
  }, [loadBase]);

  // Tiempo real: otras pestañas (modo local) u otros usuarios (Supabase)
  useEffect(() => {
    if (!user) return;
    let t: number | null = null;
    const off = backend.subscribe(() => {
      if (t) window.clearTimeout(t);
      t = window.setTimeout(() => void reload(), 500);
    });
    return () => {
      off();
      if (t) window.clearTimeout(t);
    };
  }, [user, reload]);

  const signIn = useCallback(async (email: string, password: string) => {
    const p = await backend.signIn(email, password);
    setUser(p);
    userRef.current = p;
    setMonths({});
    await loadBase();
  }, [loadBase]);

  const signOut = useCallback(async () => {
    await backend.signOut();
    setUser(null);
    setMonths({});
    setStores([]);
    setEmployees([]);
    setPlans([]);
  }, []);

  const ensureMonth = useCallback((y: number, m: number) => {
    const key = monthKey(y, m);
    if (monthsRef.current[key] || loadingMonths.current.has(key)) return;
    loadingMonths.current.add(key);
    fetchMonth(y, m)
      .catch((e) => setError((e as Error).message))
      .finally(() => loadingMonths.current.delete(key));
  }, [fetchMonth]);

  const monthLoaded = useCallback((y: number, m: number) => Boolean(months[monthKey(y, m)]), [months]);

  const settings = useMemo(() => {
    const out: Record<string, StoreSettings> = {};
    for (const s of stores) out[s.id] = settingsList.find((x) => x.store_id === s.id) ?? defaultSettings(s.id);
    return out;
  }, [stores, settingsList]);

  const entriesFor = useCallback(
    (storeId: string, y: number, m: number) => (months[monthKey(y, m)] ?? []).filter((e) => e.store_id === storeId),
    [months],
  );

  const planFor = useCallback(
    (storeId: string, y: number, m: number) => plans.find((p) => p.store_id === storeId && p.year === y && p.month === m) ?? null,
    [plans],
  );

  const canEditStore = useCallback(
    (storeId: string) => {
      if (!user) return false;
      return user.role === 'admin' || user.store_id === storeId;
    },
    [user],
  );

  const addHistory = useCallback(async (item: Omit<HistoryItem, 'id' | 'at' | 'user_id' | 'user_name'>) => {
    const u = userRef.current;
    const h: HistoryItem = { ...item, id: uid(), at: nowIso(), user_id: u?.id ?? null, user_name: u?.name ?? null };
    await backend.upsert('plan_history', [h]);
    setHistory((prev) => [h, ...prev]);
    return h;
  }, []);

  /** Obtiene o crea la planificación del mes (estado inicial: pendiente). */
  const ensurePlan = useCallback((storeId: string, y: number, m: number): Plan => {
    const existing = plansRef.current.find((p) => p.store_id === storeId && p.year === y && p.month === m);
    if (existing) return existing;
    const u = userRef.current;
    const p: Plan = {
      id: uid(), store_id: storeId, year: y, month: m, status: 'pendiente', changed_after_submit: false,
      submitted_at: null, approved_at: null, last_comment: null, updated_at: nowIso(), updated_by: u?.id ?? null, updated_by_name: u?.name ?? null,
    };
    plansRef.current = [...plansRef.current, p];
    setPlans(plansRef.current);
    pending.current.plans.add(p.id);
    return p;
  }, []);

  const flush = useCallback(async () => {
    if (flushTimer.current) {
      window.clearTimeout(flushTimer.current);
      flushTimer.current = null;
    }
    const p = pending.current;
    const upserts = [...p.upserts.values()];
    const deletes = [...p.deletes];
    const planIds = new Set([...p.plans, ...upserts.map((u) => u.plan_id)]);
    pending.current = { upserts: new Map(), deletes: new Set(), plans: new Set() };
    if (!upserts.length && !deletes.length && !planIds.size) return;
    setSaveState({ status: 'saving', at: null });
    try {
      const u = userRef.current!;
      const touched = plansRef.current.filter((pl) => planIds.has(pl.id) || p.plans.has(pl.id));
      // 1) planificaciones (deben existir antes que los turnos)
      const updatedPlans: Plan[] = [];
      for (const pl of touched) {
        const next: Plan = { ...pl, updated_at: nowIso(), updated_by: u.id, updated_by_name: u.name };
        const wasNew = p.plans.has(pl.id) && pl.status === 'pendiente';
        if (pl.status === 'pendiente') next.status = 'en_preparacion';
        let postSubmit = false;
        if (pl.status === 'enviada' && !pl.changed_after_submit) {
          next.changed_after_submit = true;
          postSubmit = true;
        }
        updatedPlans.push(next);
        await backend.upsert('plans', [next]);
        if (wasNew || pl.status === 'pendiente') {
          await addHistory({ plan_id: pl.id, store_id: pl.store_id, action: 'creacion', from_status: 'pendiente', to_status: 'en_preparacion', comment: null });
        } else if (postSubmit) {
          await addHistory({ plan_id: pl.id, store_id: pl.store_id, action: 'edicion_post_envio', from_status: 'enviada', to_status: 'enviada', comment: 'Se modificaron horarios después del envío a revisión.' });
        } else {
          // agrupar ediciones del mismo usuario en ventanas de 15 minutos
          const last = (await backend.select<HistoryItem>('plan_history', [{ col: 'plan_id', op: 'eq', value: pl.id }]))
            .sort((a, b) => b.at.localeCompare(a.at))[0];
          const n = upserts.filter((x) => x.plan_id === pl.id).length + deletes.length;
          if (last && last.action === 'edicion' && last.user_id === u.id && Date.now() - new Date(last.at).getTime() < 15 * 60000) {
            const prevN = Number((last.comment ?? '').match(/\d+/)?.[0] ?? 0);
            const upd = { ...last, at: nowIso(), comment: `${prevN + n} registro(s) modificados` };
            await backend.upsert('plan_history', [upd]);
            setHistory((h) => [upd, ...h.filter((x) => x.id !== upd.id)]);
          } else {
            await addHistory({ plan_id: pl.id, store_id: pl.store_id, action: 'edicion', from_status: pl.status, to_status: next.status, comment: `${n} registro(s) modificados` });
          }
        }
      }
      if (updatedPlans.length) {
        plansRef.current = plansRef.current.map((x) => updatedPlans.find((y) => y.id === x.id) ?? x);
        setPlans(plansRef.current);
      }
      // 2) turnos
      await backend.remove('entries', 'id', deletes);
      await backend.upsert('entries', upserts);
      setSaveState({ status: 'saved', at: nowIso() });
    } catch (e) {
      // reintentar en el próximo cambio
      for (const x of upserts) if (!pending.current.upserts.has(x.id)) pending.current.upserts.set(x.id, x);
      for (const d of deletes) pending.current.deletes.add(d);
      setSaveState({ status: 'error', at: null, message: (e as Error).message });
    }
  }, [addHistory]);

  const scheduleFlush = useCallback(() => {
    if (flushTimer.current) window.clearTimeout(flushTimer.current);
    setSaveState((s) => ({ ...s, status: 'saving' }));
    flushTimer.current = window.setTimeout(() => void flush(), 900);
  }, [flush]);

  // Guardar antes de cerrar la pestaña
  useEffect(() => {
    const onUnload = (ev: BeforeUnloadEvent) => {
      const p = pending.current;
      if (p.upserts.size || p.deletes.size) {
        void flush();
        ev.preventDefault();
      }
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [flush]);

  const replaceCells = useCallback((storeId: string, y: number, m: number, changes: CellChange[]) => {
    const u = userRef.current;
    if (!u || !(u.role === 'admin' || u.store_id === storeId)) {
      setSaveState({ status: 'error', at: null, message: 'No tiene permisos para modificar esta tienda.' });
      return;
    }
    const plan = ensurePlan(storeId, y, m);
    if (plan.status === 'aprobada') {
      setSaveState({ status: 'error', at: null, message: 'La planificación está aprobada. Debe reabrirse para modificarla.' });
      return;
    }
    const key = monthKey(y, m);
    const current = monthsRef.current[key] ?? [];
    const cellKeys = new Set(changes.map((c) => `${c.employee_id}|${c.date}`));
    const removed = current.filter((e) => e.store_id === storeId && cellKeys.has(`${e.employee_id}|${e.date}`));
    const added: Entry[] = changes.flatMap((c) =>
      c.entries.map((x) => ({
        ...x, id: uid(), plan_id: plan.id, store_id: storeId, employee_id: c.employee_id, date: c.date,
        updated_at: nowIso(), updated_by: u.id,
      })),
    );
    const next = [...current.filter((e) => !removed.includes(e)), ...added];
    monthsRef.current = { ...monthsRef.current, [key]: next };
    setMonths(monthsRef.current);
    const p = pending.current;
    for (const r of removed) {
      if (p.upserts.has(r.id)) p.upserts.delete(r.id);
      else p.deletes.add(r.id);
    }
    for (const a of added) p.upserts.set(a.id, a);
    p.plans.add(plan.id);
    scheduleFlush();
  }, [ensurePlan, scheduleFlush]);

  const analysis = useCallback(
    (storeId: string, y: number, m: number, pos?: PositionId | null) => {
      const store = stores.find((s) => s.id === storeId);
      if (!store) return null;
      const all = months[monthKey(y, m)] ?? [];
      const mine = all.filter((e) => e.store_id === storeId);
      return analyzePlan({
        year: y, month: m, store, settings: settings[storeId], employees: employees.filter((e) => e.store_id === storeId),
        entries: mine, carryIn: mine.filter((e) => e.date === prevLastDay(y, m)), plan: planFor(storeId, y, m), positionFilter: pos,
      });
    },
    [stores, months, settings, employees, planFor],
  );

  const transitionPlan = useCallback(async (storeId: string, y: number, m: number, to: PlanStatus, comment?: string) => {
    await flush();
    const u = userRef.current!;
    const plan = ensurePlan(storeId, y, m);
    const from = plan.status;
    const allowed: Record<string, PlanStatus[]> = u.role === 'admin'
      ? { enviada: ['aprobada', 'observada'], aprobada: ['en_preparacion'], observada: ['enviada', 'aprobada'], en_preparacion: ['enviada'] }
      : { en_preparacion: ['enviada'], observada: ['enviada'] };
    if (!allowed[from]?.includes(to)) throw new Error(`No se puede pasar de "${from}" a "${to}" con su perfil.`);
    const a = analysis(storeId, y, m);
    if (to === 'aprobada' && a && a.errors > 0) throw new Error(`La planificación tiene ${a.errors} error(es) que impiden aprobarla.`);
    if (to === 'observada' && !comment?.trim()) throw new Error('Debe indicar las observaciones.');
    const next: Plan = {
      ...plan, status: to, updated_at: nowIso(), updated_by: u.id, updated_by_name: u.name,
      submitted_at: to === 'enviada' ? nowIso() : plan.submitted_at,
      approved_at: to === 'aprobada' ? nowIso() : plan.approved_at,
      changed_after_submit: to === 'enviada' ? false : plan.changed_after_submit,
      last_comment: comment?.trim() || (to === 'observada' ? plan.last_comment : null),
    };
    await backend.upsert('plans', [next]);
    plansRef.current = plansRef.current.map((p) => (p.id === next.id ? next : p));
    setPlans(plansRef.current);
    const action: HistoryItem['action'] = to === 'enviada' ? 'envio' : to === 'aprobada' ? 'aprobacion' : to === 'observada' ? 'observacion' : 'reapertura';
    await addHistory({ plan_id: plan.id, store_id: storeId, action, from_status: from, to_status: to, comment: comment?.trim() || null });
    // Instantánea de alertas al momento del cambio de estado
    if (a) {
      const old = await backend.select<AlertRecord>('alerts', [{ col: 'plan_id', op: 'eq', value: plan.id }]);
      await backend.remove('alerts', 'id', old.map((o) => o.id));
      await backend.upsert('alerts', a.alerts.map((al) => ({ ...al, id: uid(), plan_id: plan.id, store_id: storeId, created_at: nowIso() })));
    }
  }, [flush, ensurePlan, analysis, addHistory]);

  const saveEmployee = useCallback(async (e: Employee) => {
    await backend.upsert('employees', [e]);
    setEmployees((prev) => [...prev.filter((x) => x.id !== e.id), e].sort((a, b) => a.name.localeCompare(b.name)));
  }, []);

  const deleteEmployee = useCallback(async (e: Employee) => {
    const used = await backend.select<Entry>('entries', [{ col: 'employee_id', op: 'eq', value: e.id }]);
    if (used.length) throw new Error('El empleado tiene horarios cargados: márquelo como inactivo en lugar de eliminarlo.');
    await backend.remove('employees', 'id', [e.id]);
    setEmployees((prev) => prev.filter((x) => x.id !== e.id));
  }, []);

  const saveStore = useCallback(async (s: Store, st: StoreSettings) => {
    const u = userRef.current!;
    await backend.upsert('stores', [s]);
    await backend.upsert('store_settings', [{ ...st, store_id: s.id, updated_at: nowIso(), updated_by: u.id }]);
    await loadBase();
  }, [loadBase]);

  const deleteStore = useCallback(async (s: Store) => {
    const ent = await backend.select<Entry>('entries', [{ col: 'store_id', op: 'eq', value: s.id }]);
    for (const t of ['alerts', 'plan_history'] as TableName[]) {
      const rows = await backend.select<{ id: string }>(t, [{ col: 'store_id', op: 'eq', value: s.id }]);
      await backend.remove(t, 'id', rows.map((r) => r.id));
    }
    await backend.remove('entries', 'id', ent.map((e) => e.id));
    await backend.remove('plans', 'store_id', [s.id]);
    await backend.remove('employees', 'store_id', [s.id]);
    await backend.remove('store_settings', 'store_id', [s.id]);
    const prof = profiles.filter((p) => p.store_id === s.id);
    if (prof.length) await backend.upsert('profiles', prof.map((p) => ({ ...p, store_id: null })));
    await backend.remove('stores', 'id', [s.id]);
    setMonths({});
    await loadBase();
  }, [profiles, loadBase]);

  const saveProfile = useCallback(async (p: Profile, password?: string) => {
    if (password && localBackend) await localBackend.createLocalUser(p, password);
    else await backend.upsert('profiles', [p]);
    await loadBase();
  }, [loadBase]);

  const removeDemoRef = useRef<() => Promise<void>>(async () => undefined);
  const loadDemo = useCallback(async () => {
    // Reemplaza la demostración existente para no duplicar tiendas ni usuarios
    await removeDemoRef.current();
    const demo = buildDemoData(new Date(), backend.mode === 'local');
    const current = userRef.current;
    if (current) {
      const dup = demo.profiles.find((p) => p.email.toLowerCase() === current.email.toLowerCase());
      if (dup) {
        demo.profiles = demo.profiles.filter((p) => p !== dup);
        delete demo.passwords[dup.id];
      }
    }
    if (localBackend) {
      const { passwords, ...tables } = demo;
      localBackend.seed(tables as Partial<Record<TableName, object[]>>, passwords);
    } else {
      await backend.upsert('stores', demo.stores);
      await backend.upsert('store_settings', demo.store_settings);
      await backend.upsert('employees', demo.employees);
      await backend.upsert('plans', demo.plans);
      await backend.upsert('entries', demo.entries);
      await backend.upsert('plan_history', demo.plan_history);
    }
    setMonths({});
    await loadBase();
  }, [loadBase]);

  const removeDemo = useCallback(async () => {
    for (const s of stores.filter((x) => x.is_demo)) await deleteStore(s);
    const demoProfiles = profiles.filter((p) => p.is_demo && p.id !== userRef.current?.id);
    if (demoProfiles.length) await backend.remove('profiles', 'id', demoProfiles.map((p) => p.id));
    await loadBase();
  }, [stores, profiles, deleteStore, loadBase]);
  removeDemoRef.current = removeDemo;

  const resetLocal = useCallback(() => {
    if (!localBackend) return;
    localBackend.resetAll();
    void backend.signOut().then(() => window.location.reload());
  }, []);

  const value: DataCtx = useMemo(() => ({
    mode: backend.mode, user, booting, loading, error, stores, settings, employees, profiles, plans, history, saveState,
    signIn, signOut, reload, ensureMonth, monthLoaded, entriesFor, planFor, replaceCells, flushNow: flush, transitionPlan,
    saveEmployee, deleteEmployee, saveStore, deleteStore, saveProfile, loadDemo, removeDemo, resetLocal, canEditStore, analysis,
  }), [user, booting, loading, error, stores, settings, employees, profiles, plans, history, saveState,
    signIn, signOut, reload, ensureMonth, monthLoaded, entriesFor, planFor, replaceCells, transitionPlan,
    saveEmployee, deleteEmployee, saveStore, deleteStore, saveProfile, loadDemo, removeDemo, resetLocal, canEditStore, analysis, flush]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Carga (si hace falta) y devuelve el análisis de una tienda/mes. */
export function useAnalysis(storeId: string | null, year: number, month: number, pos?: PositionId | null) {
  const { ensureMonth, analysis } = useData();
  useEffect(() => {
    ensureMonth(year, month);
  }, [ensureMonth, year, month]);
  return useMemo(() => (storeId ? analysis(storeId, year, month, pos) : null), [analysis, storeId, year, month, pos]);
}
