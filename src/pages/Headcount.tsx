import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Input, Notice, PageTitle, Pill, Select, Td, Th } from '../components/ui';
import { useData } from '../lib/store';
import { slotsForStore } from '../lib/vacantes';

export function HeadcountPage() {
  const { user, data, run } = useData();
  const [area, setArea] = useState('');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [newPos, setNewPos] = useState<Record<string, { position: string; n: string }>>({});
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  if (!user) return null;
  const canEdit = (a: string) => user.role === 'admin_rh' || (user.role === 'coordinador' && user.areas.includes(a));
  const visibleStores = data.stores.filter((s) =>
    user.role === 'gerente' ? user.store_ids.includes(s.id) : user.role === 'admin_rh' || user.areas.includes(s.area))
    .filter((s) => !area || s.area === area);
  const areas = [...new Set(visibleStores.map((s) => s.area))].sort();
  const positions = [...new Set([...data.headcount.map((h) => h.position), ...data.employees.map((e) => e.position)])].sort();

  const save = async (storeId: string, position: string, value: string) => {
    setError(''); setOk('');
    try {
      await run((s) => s.saveHeadcount(storeId, position, Number(value)));
      setOk('Headcount actualizado.');
      setDraft((d) => { const c = { ...d }; delete c[`${storeId}:${position}`]; return c; });
    } catch (e) { setError((e as Error).message); }
  };

  return (
    <div className="mx-auto max-w-[1300px]">
      <PageTitle sub={user.role === 'coordinador' || user.role === 'admin_rh'
        ? 'Cantidad de puestos autorizados por tienda. Los gerentes sólo pueden pedir vacantes donde haya lugar disponible.'
        : 'Puestos autorizados por RH, ocupados y disponibles. Si necesitás más lugares, hablalo con tu coordinador/a de RH.'}>Headcount</PageTitle>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {user.role !== 'gerente' && (
          <Select wrapClass="w-44" value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">Todas mis áreas</option>{[...new Set(data.stores.map((s) => s.area))].sort().map((a) => <option key={a}>{a}</option>)}
          </Select>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        {ok && <Notice tone="ok">{ok}</Notice>}
      </div>
      <div className="space-y-6">
        {areas.map((a) => visibleStores.filter((s) => s.area === a).map((st) => {
          const slots = slotsForStore(st.id, data.headcount, data.employees, data.vacancies);
          const edit = canEdit(st.area);
          const np = newPos[st.id] ?? { position: '', n: '1' };
          const total = slots.reduce((acc, s) => ({ a: acc.a + s.authorized, o: acc.o + s.active - s.leaving, p: acc.p + s.open, d: acc.d + Math.max(0, s.available) }), { a: 0, o: 0, p: 0, d: 0 });
          return (
            <Card key={st.id} title={<span>{st.name} <span className="text-sm font-normal text-ink-400">· {st.area}</span></span>}
              actions={<span className="text-sm text-ink-500">{total.a} autorizados · {total.o} ocupados · {total.p} en proceso · <b className="text-emerald-700">{total.d} disponibles</b></span>}>
              <table className="w-full">
                <thead className="border-b border-chrome-200"><tr><Th>Puesto</Th><Th>Autorizados</Th><Th>Ocupados</Th><Th>En proceso</Th><Th>Disponibles</Th></tr></thead>
                <tbody>
                  {slots.map((s) => {
                    const key = `${st.id}:${s.position}`;
                    const val = draft[key] ?? String(s.authorized);
                    return (
                      <tr key={key} className="border-b border-chrome-200">
                        <Td className="text-ink-700">{s.position}</Td>
                        <Td>
                          {edit ? (
                            <div className="flex items-center gap-2">
                              <input type="number" min={0} className="w-20 rounded-md border border-chrome-300 px-2 py-1 text-sm" value={val} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
                              {val !== String(s.authorized) && <Button size="sm" onClick={() => save(st.id, s.position, val)}>Guardar</Button>}
                            </div>
                          ) : s.authorized}
                        </Td>
                        <Td>{s.active - s.leaving}{s.leaving ? <span className="text-xs"> (+{s.leaving} se van)</span> : null}</Td>
                        <Td>{s.open}</Td>
                        <Td>{s.available > 0 ? <Pill tone="green">{s.available}</Pill> : s.available < 0 ? <Pill tone="red">Excedido {-s.available}</Pill> : <Pill tone="gray">0</Pill>}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {edit && (
                <div className="mt-4 flex flex-wrap items-end gap-2">
                  <Input wrapClass="w-64" list="positions" label="Agregar puesto" value={np.position} onChange={(e) => setNewPos({ ...newPos, [st.id]: { ...np, position: e.target.value } })} placeholder="Ej.: Cajero/a" />
                  <Input wrapClass="w-28" type="number" min={0} label="Autorizados" value={np.n} onChange={(e) => setNewPos({ ...newPos, [st.id]: { ...np, n: e.target.value } })} />
                  <Button variant="outline" size="sm" className="mb-1" disabled={!np.position.trim()} onClick={() => save(st.id, np.position, np.n).then(() => setNewPos({ ...newPos, [st.id]: { position: '', n: '1' } }))}><Plus size={14} /> Agregar</Button>
                </div>
              )}
            </Card>
          );
        }))}
      </div>
      <datalist id="positions">{positions.map((p) => <option key={p} value={p} />)}</datalist>
    </div>
  );
}
