import { Database, Plus, Save, Trash2, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Card, DemoBadge, Input, Modal, PageHeader, Select, cx, useConfirm } from '../components/ui';
import { POSITIONS, WEEKDAYS } from '../lib/constants';
import { nowIso, pad, uid } from '../lib/dates';
import { defaultHours, defaultSettings } from '../lib/demo';
import { useData } from '../lib/store';
import type { Profile, Role, Store, StoreSettings } from '../lib/types';

export function Configuracion() {
  const { user, stores, settings, saveStore, deleteStore } = useData();
  const isAdmin = user?.role === 'admin';
  const visible = isAdmin ? stores : stores.filter((s) => s.id === user?.store_id);
  const [selId, setSelId] = useState<string | null>(visible[0]?.id ?? null);
  const [draft, setDraft] = useState<{ store: Store; st: StoreSettings } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const confirmUi = useConfirm();

  useEffect(() => {
    const s = stores.find((x) => x.id === selId) ?? visible[0];
    if (s && (!draft || draft.store.id !== s.id)) setDraft({ store: structuredClone(s), st: structuredClone(settings[s.id]) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId, stores]);

  const newStore = () => {
    const id = uid();
    const s: Store = { id, code: `T-${pad(stores.length + 1)}`, name: '', region: '', address: '', is_demo: false, hours: defaultHours(), created_at: nowIso() };
    setSelId(null);
    setDraft({ store: s, st: defaultSettings(id) });
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.store.name.trim() || !draft.store.code.trim()) return setMsg({ ok: false, text: 'Código y nombre son obligatorios.' });
    try {
      await saveStore(draft.store, draft.st);
      setSelId(draft.store.id);
      setMsg({ ok: true, text: 'Parámetros guardados. Los indicadores y alertas ya se recalcularon.' });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  const ro = !isAdmin;
  const d = draft;
  const setStore = (p: Partial<Store>) => d && setDraft({ ...d, store: { ...d.store, ...p } });
  const setSt = (p: Partial<StoreSettings>) => d && setDraft({ ...d, st: { ...d.st, ...p } });

  return (
    <div>
      <PageHeader title="Tiendas y parámetros" subtitle="Horarios de apertura, dotación mínima, posiciones clave, objetivos de cobertura y reglas laborales por tienda">
        {isAdmin && <Button onClick={newStore}><Plus size={16} /> Nueva tienda</Button>}
      </PageHeader>
      {ro && <p className="mb-4 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">Los parámetros de tu tienda los define RR. HH. / Operaciones. Podés consultarlos aquí.</p>}

      <div className="grid gap-4 xl:grid-cols-4">
        <Card title="Tiendas" bodyClass="p-0">
          <ul className="divide-y divide-slate-100">
            {visible.map((s) => (
              <li key={s.id}>
                <button onClick={() => setSelId(s.id)} className={cx('w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50', d?.store.id === s.id && 'bg-teal-50/60')}>
                  <div className="font-medium text-navy-900">{s.name}<DemoBadge show={s.is_demo} /></div>
                  <div className="text-xs text-slate-500">{s.code} · {s.region}</div>
                </button>
              </li>
            ))}
            {d && !stores.some((s) => s.id === d.store.id) && <li className="bg-teal-50/60 px-4 py-2.5 text-sm font-medium text-teal-800">Nueva tienda (sin guardar)</li>}
          </ul>
        </Card>

        {d && (
          <div className="space-y-4 xl:col-span-3">
            <Card title="Datos de la tienda">
              <fieldset disabled={ro} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Input label="Código" value={d.store.code} onChange={(e) => setStore({ code: e.target.value })} />
                <Input label="Nombre" value={d.store.name} onChange={(e) => setStore({ name: e.target.value })} className="lg:col-span-2" />
                <Input label="Región" value={d.store.region} onChange={(e) => setStore({ region: e.target.value })} />
                <Input label="Dirección" value={d.store.address} onChange={(e) => setStore({ address: e.target.value })} className="sm:col-span-2" />
                <Select label="Tipo de datos" value={d.store.is_demo ? '1' : '0'} onChange={(e) => setStore({ is_demo: e.target.value === '1' })}>
                  <option value="0">Datos reales</option><option value="1">Demostración</option>
                </Select>
              </fieldset>
            </Card>

            <Card title="Horario de apertura" subtitle="Si el cierre es igual o anterior a la apertura, la tienda cierra al día siguiente (00:00–00:00 = 24 h).">
              <fieldset disabled={ro} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
                  const h = d.store.hours[wd];
                  const upd = (p: Partial<typeof h>) => setStore({ hours: d.store.hours.map((x, i) => (i === wd ? { ...x, ...p } : x)) });
                  return (
                    <div key={wd} className="rounded-lg border border-slate-200 p-2.5">
                      <div className="flex items-center justify-between text-sm font-medium text-navy-900">
                        {WEEKDAYS[wd]}
                        <label className="flex items-center gap-1 text-xs font-normal text-slate-600"><input type="checkbox" checked={h.closed} onChange={(e) => upd({ closed: e.target.checked })} /> Cerrado</label>
                      </div>
                      {!h.closed && (
                        <div className="mt-2 flex items-center gap-1">
                          <input type="time" value={h.open} onChange={(e) => upd({ open: e.target.value })} className="w-full rounded border border-slate-300 px-1.5 py-1 text-sm" aria-label="Apertura" />
                          <span className="text-xs">a</span>
                          <input type="time" value={h.close} onChange={(e) => upd({ close: e.target.value })} className="w-full rounded border border-slate-300 px-1.5 py-1 text-sm" aria-label="Cierre" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </fieldset>
            </Card>

            <Card title="Cobertura y posiciones clave">
              <fieldset disabled={ro} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input label="Dotación mínima por franja (personas)" type="number" min={0} value={d.st.min_staff} onChange={(e) => setSt({ min_staff: Number(e.target.value) })} />
                  <Select label="Falta de posición clave" value={d.st.key_positions_blocking ? '1' : '0'} onChange={(e) => setSt({ key_positions_blocking: e.target.value === '1' })}>
                    <option value="1">Error (impide aprobar)</option><option value="0">Advertencia</option>
                  </Select>
                </div>
                <div>
                  <div className="mb-1.5 text-xs font-medium text-slate-600">Posiciones que deben estar presentes durante todo el horario de apertura</div>
                  <div className="flex flex-wrap gap-2">
                    {POSITIONS.map((p) => {
                      const on = d.st.key_positions.includes(p.id);
                      return (
                        <label key={p.id} className={cx('flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ring-1', on ? 'bg-teal-50 text-teal-900 ring-teal-400' : 'ring-slate-300')}>
                          <input type="checkbox" checked={on} onChange={(e) => setSt({ key_positions: e.target.checked ? [...d.st.key_positions, p.id] : d.st.key_positions.filter((x) => x !== p.id) })} />
                          {p.name}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 flex flex-wrap items-center gap-3 text-xs font-medium text-slate-600">
                    Objetivo de dotación por hora (dotación necesaria)
                    <label className="flex items-center gap-1 font-normal"><input type="checkbox" checked={!!d.st.target_by_hour} onChange={(e) => setSt({ target_by_hour: e.target.checked ? Array(24).fill(d.st.min_staff) : null })} /> Definir objetivo</label>
                  </div>
                  {d.st.target_by_hour ? (
                    <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
                      {d.st.target_by_hour.map((v, h) => (
                        <label key={h} className="text-center text-[10px] text-slate-500">
                          {pad(h)} h
                          <input type="number" min={0} value={v} onChange={(e) => setSt({ target_by_hour: d.st.target_by_hour!.map((x, i) => (i === h ? Number(e.target.value) : x)) })}
                            className="mt-0.5 w-full rounded border border-slate-300 px-1 py-1 text-center text-sm text-slate-800" />
                        </label>
                      ))}
                    </div>
                  ) : <p className="text-xs text-slate-500">Sin objetivo: no se compara la dotación prevista con la necesaria.</p>}
                </div>
              </fieldset>
            </Card>

            <Card title="Reglas laborales" subtitle="Generan advertencias cuando la planificación se aparta de estos parámetros">
              <fieldset disabled={ro} className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <Input label="Máx. horas diarias" type="number" step="0.5" value={d.st.max_daily_hours} onChange={(e) => setSt({ max_daily_hours: Number(e.target.value) })} />
                <Input label="Mín. horas por jornada" type="number" step="0.5" value={d.st.min_daily_hours} onChange={(e) => setSt({ min_daily_hours: Number(e.target.value) })} />
                <Input label="Máx. horas semanales" type="number" value={d.st.max_weekly_hours} onChange={(e) => setSt({ max_weekly_hours: Number(e.target.value) })} />
                <Input label="Descanso mínimo (h)" type="number" value={d.st.min_rest_hours} onChange={(e) => setSt({ min_rest_hours: Number(e.target.value) })} />
                <Input label="Máx. días consecutivos" type="number" value={d.st.max_consecutive_days} onChange={(e) => setSt({ max_consecutive_days: Number(e.target.value) })} />
                <Input label="Tolerancia vs. contrato (%)" type="number" value={d.st.contract_tolerance_pct} onChange={(e) => setSt({ contract_tolerance_pct: Number(e.target.value) })} />
              </fieldset>
            </Card>

            {isAdmin && (
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => void save()}><Save size={16} /> Guardar tienda y parámetros</Button>
                {stores.some((s) => s.id === d.store.id) && (
                  <Button variant="ghost" onClick={async () => {
                    if (!(await confirmUi.ask(`¿Eliminar "${d.store.name}" con todos sus empleados, horarios e historial? Esta acción no se puede deshacer.`))) return;
                    await deleteStore(d.store);
                    setSelId(null);
                    setDraft(null);
                  }}><Trash2 size={16} /> Eliminar tienda</Button>
                )}
                {msg && <span className={cx('text-sm', msg.ok ? 'text-emerald-700' : 'text-rose-700')}>{msg.text}</span>}
              </div>
            )}
          </div>
        )}
      </div>

      {confirmUi.dialog}
      {isAdmin && <UsersSection />}
      {isAdmin && <DemoSection />}
    </div>
  );
}

function UsersSection() {
  const { mode, profiles, stores, saveProfile, user } = useData();
  const [edit, setEdit] = useState<(Profile & { password?: string; isNew?: boolean }) | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    if (!edit) return;
    if (!edit.email || !edit.name) return setErr('Nombre y correo son obligatorios.');
    if (edit.role === 'gerente' && !edit.store_id) return setErr('El gerente debe tener una tienda asignada.');
    if (edit.isNew && mode === 'local' && !edit.password) return setErr('Definí una contraseña.');
    if (edit.isNew && mode === 'supabase' && !/^[0-9a-f-]{36}$/i.test(edit.id)) return setErr('Ingresá el UUID del usuario creado en Supabase Auth.');
    const { password, isNew, ...p } = edit;
    void isNew;
    try {
      await saveProfile({ ...p, store_id: p.role === 'admin' ? null : p.store_id }, mode === 'local' ? password : undefined);
      setEdit(null);
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <Card title="Usuarios y permisos" className="mt-6" actions={<Button size="sm" onClick={() => { setErr(null); setEdit({ id: mode === 'local' ? uid() : '', email: '', name: '', role: 'gerente', store_id: stores[0]?.id ?? null, is_demo: false, isNew: true }); }}><UserPlus size={14} /> Nuevo usuario</Button>} bodyClass="p-0 overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Nombre</th><th>Correo</th><th>Perfil</th><th>Tienda</th><th className="px-4" /></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {profiles.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-2 font-medium text-navy-900">{p.name}<DemoBadge show={p.is_demo} /></td>
              <td className="text-slate-600">{p.email}</td>
              <td>{p.role === 'admin' ? 'Administrador RR. HH. / Operaciones' : 'Gerente de Tienda'}</td>
              <td>{stores.find((s) => s.id === p.store_id)?.name ?? '—'}</td>
              <td className="px-4 text-right">{p.id !== user?.id && <Button size="sm" variant="ghost" onClick={() => { setErr(null); setEdit({ ...p }); }}>Editar</Button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Modal open={!!edit} title={edit?.isNew ? 'Nuevo usuario' : 'Editar usuario'} onClose={() => setEdit(null)}
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancelar</Button><Button onClick={() => void save()}>Guardar</Button></>}>
        {edit && (
          <div className="space-y-3">
            {edit.isNew && mode === 'supabase' && (
              <div className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900">
                Con Supabase, primero creá el usuario (correo y contraseña) en <b>Authentication → Users</b> del panel de Supabase y copiá su <b>User UID</b> aquí. La aplicación no usa la clave de servicio, por lo que no puede crear credenciales por sí misma.
              </div>
            )}
            {edit.isNew && mode === 'supabase' && <Input label="User UID de Supabase" value={edit.id} onChange={(e) => setEdit({ ...edit, id: e.target.value.trim() })} />}
            <Input label="Nombre" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <Input label="Correo" type="email" value={edit.email} disabled={!edit.isNew} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
            {edit.isNew && mode === 'local' && <Input label="Contraseña (se guarda sólo en este navegador)" type="password" value={edit.password ?? ''} onChange={(e) => setEdit({ ...edit, password: e.target.value })} />}
            <Select label="Perfil" value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value as Role })}>
              <option value="gerente">Gerente de Tienda</option><option value="admin">Administrador RR. HH. / Operaciones</option>
            </Select>
            {edit.role === 'gerente' && (
              <Select label="Tienda asignada" value={edit.store_id ?? ''} onChange={(e) => setEdit({ ...edit, store_id: e.target.value })}>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            )}
            {err && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}
          </div>
        )}
      </Modal>
    </Card>
  );
}

function DemoSection() {
  const { mode, stores, loadDemo, removeDemo, resetLocal } = useData();
  const [busy, setBusy] = useState(false);
  const confirmUi = useConfirm();
  const demoCount = stores.filter((s) => s.is_demo).length;
  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    try { await f(); } catch (e) { await confirmUi.notify((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Card title="Datos de demostración" className="mt-6">
      {confirmUi.dialog}
      <div className="flex flex-wrap items-start gap-4">
        <Database className="mt-1 text-amber-600" />
        <div className="min-w-0 flex-1 text-sm text-slate-600">
          <p>Los datos de demostración son ficticios y se identifican con la etiqueta <DemoBadge /> en tiendas, empleados y usuarios. Hay {demoCount} tienda(s) demo cargada(s).</p>
          {mode === 'supabase' && <p className="mt-1 text-xs">En Supabase, la demostración crea tiendas, empleados y horarios, pero no usuarios: asigná gerentes desde "Usuarios y permisos".</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => run(loadDemo)}>Cargar demostración</Button>
          <Button variant="secondary" disabled={busy || !demoCount} onClick={async () => (await confirmUi.ask('¿Eliminar todas las tiendas, empleados, horarios y usuarios de demostración?')) && run(removeDemo)}>Eliminar datos demo</Button>
          {mode === 'local' && <Button variant="danger" disabled={busy} onClick={async () => (await confirmUi.ask('Se borrarán TODOS los datos guardados en este navegador y se regenerará la demostración. ¿Continuar?')) && resetLocal()}>Reiniciar base local</Button>}
        </div>
      </div>
    </Card>
  );
}
