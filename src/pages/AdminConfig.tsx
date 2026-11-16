import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Card, Checkbox, Input, Modal, Notice, PageTitle, Pill, Select, Td, Textarea, Th } from '../components/ui';
import { uid } from '../lib/service';
import { useData } from '../lib/store';
import { ROLE_LABEL, type MeasureType, type Policy, type Profile, type Role, type SituationType } from '../lib/types';

function useAct() {
  const { run } = useData();
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const act = async (fn: Parameters<typeof run>[0], msg = 'Guardado.') => {
    setError(''); setOk('');
    try { await run(fn); setOk(msg); return true; } catch (e) { setError((e as Error).message); return false; }
  };
  return { act, error, ok };
}

/* ---------- Tipos de medida y situaciones ---------- */

export function AdminTipos() {
  const { data } = useData();
  const { act, error, ok } = useAct();
  const [edit, setEdit] = useState<{ m: MeasureType; isNew: boolean } | null>(null);
  const [sit, setSit] = useState('');
  const measures = [...data.measure_types].sort((a, b) => a.order - b.order);

  return (
    <div className="mx-auto max-w-[1300px]">
      <PageTitle sub="Definí qué medidas pueden solicitar los gerentes y qué requisitos tiene cada una. Los cambios aplican a las solicitudes nuevas.">Tipos de medida y situaciones</PageTitle>
      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}
      {ok && <div className="mb-4"><Notice tone="ok">{ok}</Notice></div>}
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card title="Tipos de medida" actions={<Button size="sm" variant="outline" onClick={() => setEdit({ isNew: true, m: { id: uid('m'), name: '', description: '', active: true, requires_attachment: false, requires_antecedentes: false, order: measures.length + 1 } })}><Plus size={14} /> Nuevo tipo</Button>}>
          <table className="w-full">
            <thead className="border-b border-chrome-200"><tr><Th>Medida</Th><Th>Requisitos</Th><Th>Modelos</Th><Th>Estado</Th><Th /></tr></thead>
            <tbody>
              {measures.map((m) => (
                <tr key={m.id} className="border-b border-chrome-200">
                  <Td><div className="text-ink-700">{m.name}</div><div className="text-xs">{m.description}</div></Td>
                  <Td className="text-sm">{[m.requires_antecedentes && 'Antecedentes', m.requires_attachment && 'Respaldo documental'].filter(Boolean).join(', ') || '—'}</Td>
                  <Td className="text-sm">{data.templates.filter((t) => t.measure_type_ids.includes(m.id)).map((t) => t.title).join(', ') || <span className="text-rose-600">Sin modelo</span>}</Td>
                  <Td>{m.active ? <Pill tone="green">Activo</Pill> : <Pill tone="gray">Inactivo</Pill>}</Td>
                  <Td><Button variant="link" onClick={() => setEdit({ m: { ...m }, isNew: false })}>Editar</Button></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Tipos de situación">
          <form className="mb-4 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (sit.trim() && await act((s) => s.saveSituationType({ id: uid('sit'), name: sit.trim(), active: true }, true))) setSit(''); }}>
            <Input wrapClass="flex-1" placeholder="Nueva situación…" value={sit} onChange={(e) => setSit(e.target.value)} />
            <Button type="submit" size="sm">Agregar</Button>
          </form>
          <ul className="divide-y divide-chrome-200">
            {data.situation_types.map((s: SituationType) => (
              <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                <span className={s.active ? 'text-ink-700' : 'text-ink-400 line-through'}>{s.name}</span>
                <Button variant="link" onClick={() => act((svc) => svc.saveSituationType({ ...s, active: !s.active }, false))}>{s.active ? 'Desactivar' : 'Activar'}</Button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      {edit && (
        <Modal title={edit.isNew ? 'Nuevo tipo de medida' : 'Editar tipo de medida'} onClose={() => setEdit(null)}
          footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button><Button disabled={!edit.m.name.trim()} onClick={async () => { if (await act((s) => s.saveMeasureType(edit.m, edit.isNew))) setEdit(null); }}>Guardar</Button></>}>
          <div className="space-y-4">
            <Input label="Nombre" required value={edit.m.name} onChange={(e) => setEdit({ ...edit, m: { ...edit.m, name: e.target.value } })} />
            <Textarea label="Descripción para el gerente" className="min-h-[70px]" value={edit.m.description} onChange={(e) => setEdit({ ...edit, m: { ...edit.m, description: e.target.value } })} />
            <Input label="Orden" type="number" value={edit.m.order} onChange={(e) => setEdit({ ...edit, m: { ...edit.m, order: Number(e.target.value) } })} />
            <Checkbox label="Exige antecedentes" checked={edit.m.requires_antecedentes} onChange={(v) => setEdit({ ...edit, m: { ...edit.m, requires_antecedentes: v } })} />
            <Checkbox label="Exige documentación respaldatoria" checked={edit.m.requires_attachment} onChange={(v) => setEdit({ ...edit, m: { ...edit.m, requires_attachment: v } })} />
            <Checkbox label="Activo (disponible para nuevas solicitudes)" checked={edit.m.active} onChange={(v) => setEdit({ ...edit, m: { ...edit.m, active: v } })} />
            <p className="text-xs text-ink-400">Para asociar modelos a este tipo, editá el modelo en “Modelos y versiones”.</p>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------- Circuito, permisos y usuarios ---------- */

export function AdminCircuito() {
  const { data, isDemo } = useData();
  const { act, error, ok } = useAct();
  const [p, setP] = useState<Policy>(data.policy);
  const [edit, setEdit] = useState<{ u: Profile; isNew: boolean } | null>(null);
  useEffect(() => setP(data.policy), [data.policy]);
  const areas = [...new Set(data.stores.map((s) => s.area))].sort();
  const coords = data.profiles.filter((u) => u.role === 'coordinador' && u.active);

  return (
    <div className="mx-auto max-w-[1300px]">
      <PageTitle sub="Quién aprueba, cómo se asignan las solicitudes y quién accede al portal. Cada cambio queda en el historial de auditoría.">Circuito, permisos y usuarios</PageTitle>
      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}
      {ok && <div className="mb-4"><Notice tone="ok">{ok}</Notice></div>}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Política de aprobación">
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-sm font-semibold text-ink-700">Roles que pueden aprobar, rechazar o devolver</div>
              <div className="flex gap-5">
                {(['coordinador', 'admin_rh'] as Role[]).map((r) => (
                  <Checkbox key={r} label={ROLE_LABEL[r]} checked={p.approver_roles.includes(r)} onChange={(v) => setP({ ...p, approver_roles: v ? [...p.approver_roles, r] : p.approver_roles.filter((x) => x !== r) })} />
                ))}
              </div>
              <p className="mt-1 text-xs text-ink-400">Los gerentes nunca pueden aprobar, y nadie puede decidir sobre una solicitud que inició.</p>
            </div>
            <Checkbox label="Los coordinadores sólo deciden solicitudes de sus áreas" checked={p.restrict_to_area} onChange={(v) => setP({ ...p, restrict_to_area: v })} />
            <Checkbox label="Exigir comentario al aprobar" checked={p.comment_required_on_approve} onChange={(v) => setP({ ...p, comment_required_on_approve: v })} />
            <Input label="Plazo de revisión (días hábiles)" type="number" min={1} value={p.review_sla_days} onChange={(e) => setP({ ...p, review_sla_days: Number(e.target.value) })} />
            <Textarea label="Leyenda de los borradores" className="min-h-[70px]" value={p.draft_disclaimer} onChange={(e) => setP({ ...p, draft_disclaimer: e.target.value })} />
          </div>
        </Card>
        <Card title="Asignación por área">
          <p className="mb-3 text-sm text-ink-500">Coordinador/a que recibe las solicitudes de cada área. Si no se define, se toma el primero que cubra el área.</p>
          <div className="space-y-3">
            {areas.map((a) => (
              <Select key={a} label={a} value={p.routing[a] ?? ''} onChange={(e) => setP({ ...p, routing: { ...p.routing, [a]: e.target.value } })}>
                <option value="">Automático</option>
                {coords.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.areas.join(', ')})</option>)}
              </Select>
            ))}
          </div>
          <Button className="mt-5" onClick={() => act((s) => s.savePolicy(p), 'Política actualizada.')}>Guardar política y asignación</Button>
        </Card>
      </div>

      <Card className="mt-6" title="Usuarios" actions={<Button size="sm" variant="outline" onClick={() => setEdit({ isNew: true, u: { id: uid('u'), email: '', name: '', role: 'gerente', store_ids: [], areas: [], active: true } })}><Plus size={14} /> Nuevo usuario</Button>}>
        {!isDemo && <div className="mb-3"><Notice tone="info">Con Supabase, primero creá el usuario en Authentication y usá su UID como identificador del perfil (ver README).</Notice></div>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="border-b border-chrome-200"><tr><Th>Nombre</Th><Th>Correo</Th><Th>Rol</Th><Th>Áreas / tiendas</Th><Th>Estado</Th><Th /></tr></thead>
            <tbody>
              {data.profiles.map((u) => (
                <tr key={u.id} className="border-b border-chrome-200">
                  <Td className="text-ink-700">{u.name}</Td><Td>{u.email}</Td><Td>{ROLE_LABEL[u.role]}</Td>
                  <Td className="text-sm">{u.role === 'gerente' ? u.store_ids.map((id) => data.stores.find((s) => s.id === id)?.name).join(', ') : u.areas.join(', ')}</Td>
                  <Td>{u.active ? <Pill tone="green">Activo</Pill> : <Pill tone="gray">Inactivo</Pill>}</Td>
                  <Td><Button variant="link" onClick={() => setEdit({ u: { ...u }, isNew: false })}>Editar</Button></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {edit && (
        <Modal title={edit.isNew ? 'Nuevo usuario' : 'Editar usuario'} onClose={() => setEdit(null)}
          footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button><Button disabled={!edit.u.name || !edit.u.email} onClick={async () => {
            const u = { ...edit.u, areas: edit.u.role === 'gerente' ? [...new Set(edit.u.store_ids.map((id) => data.stores.find((s) => s.id === id)?.area ?? ''))].filter(Boolean) : edit.u.areas };
            if (await act((s) => s.saveProfile(u, edit.isNew))) setEdit(null);
          }}>Guardar</Button></>}>
          <div className="space-y-4">
            {edit.isNew && !isDemo && <Input label="UID de Supabase" value={edit.u.id} onChange={(e) => setEdit({ ...edit, u: { ...edit.u, id: e.target.value } })} />}
            <Input label="Nombre" value={edit.u.name} onChange={(e) => setEdit({ ...edit, u: { ...edit.u, name: e.target.value } })} />
            <Input label="Correo" type="email" value={edit.u.email} onChange={(e) => setEdit({ ...edit, u: { ...edit.u, email: e.target.value } })} />
            <Select label="Rol" value={edit.u.role} onChange={(e) => setEdit({ ...edit, u: { ...edit.u, role: e.target.value as Role } })}>
              {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            {edit.u.role === 'gerente' ? (
              <div><div className="mb-1 text-sm font-semibold">Tiendas a cargo</div><div className="grid grid-cols-2 gap-2">
                {data.stores.map((s) => <Checkbox key={s.id} label={s.name} checked={edit.u.store_ids.includes(s.id)} onChange={(v) => setEdit({ ...edit, u: { ...edit.u, store_ids: v ? [...edit.u.store_ids, s.id] : edit.u.store_ids.filter((x) => x !== s.id) } })} />)}
              </div></div>
            ) : (
              <div><div className="mb-1 text-sm font-semibold">Áreas que cubre</div><div className="flex flex-wrap gap-4">
                {areas.map((a) => <Checkbox key={a} label={a} checked={edit.u.areas.includes(a)} onChange={(v) => setEdit({ ...edit, u: { ...edit.u, areas: v ? [...edit.u.areas, a] : edit.u.areas.filter((x) => x !== a) } })} />)}
              </div></div>
            )}
            <Checkbox label="Activo" checked={edit.u.active} onChange={(v) => setEdit({ ...edit, u: { ...edit.u, active: v } })} />
            {isDemo && edit.isNew && <p className="text-xs text-ink-400">En la demostración, los usuarios nuevos no tienen contraseña: sirven para probar la asignación.</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}
