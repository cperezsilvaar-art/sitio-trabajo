import { Download } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input, PageTitle, Pill, Select, Td, Th } from '../components/ui';
import { downloadBytes } from '../lib/documents';
import { useData } from '../lib/store';
import { fmtDateTime } from '../lib/template';
import { ROLE_LABEL, STATUS_LABEL } from '../lib/types';

const ENTITY: Record<string, string> = { request: 'Solicitud', template: 'Modelo', measure_type: 'Tipo de medida', config: 'Configuración', user: 'Usuario' };

export function Auditoria() {
  const { data } = useData();
  const [q, setQ] = useState('');
  const [entity, setEntity] = useState('');
  const [actor, setActor] = useState('');
  const reqs = new Map(data.requests.map((r) => [r.id, r]));
  const tpls = new Map(data.templates.map((t) => [t.id, t]));
  const label = (entityType: string, id: string) => entityType === 'request' ? reqs.get(id)?.number ?? id : entityType === 'template' ? tpls.get(id)?.title ?? id : id;

  const rows = [...data.audit_events]
    .filter((e) => !entity || e.entity === entity)
    .filter((e) => !actor || e.actor_id === actor)
    .filter((e) => !q || `${e.action} ${e.comment ?? ''} ${e.actor_name} ${label(e.entity, e.entity_id)}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.at.localeCompare(a.at));

  const exportCsv = () => {
    const esc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const lines = [['fecha', 'usuario', 'rol', 'objeto', 'referencia', 'accion', 'desde', 'hacia', 'version', 'interno', 'detalle'].join(';')];
    for (const e of rows) lines.push([e.at, e.actor_name, e.actor_role, ENTITY[e.entity], label(e.entity, e.entity_id), e.action, e.from_status ?? '', e.to_status ?? '', e.revision ?? '', e.internal ? 'si' : 'no', e.comment ?? ''].map(esc).join(';'));
    downloadBytes(`auditoria-${new Date().toISOString().slice(0, 10)}.csv`, '﻿' + lines.join('\n'), 'text/csv;charset=utf-8');
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageTitle sub="Registro permanente de acciones: no se edita ni se borra." actions={<Button variant="outline" onClick={exportCsv}><Download size={15} /> Exportar CSV</Button>}>Historial de auditoría</PageTitle>
      <div className="mb-4 flex flex-wrap gap-3">
        <Input wrapClass="w-72" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select wrapClass="w-48" value={entity} onChange={(e) => setEntity(e.target.value)}>
          <option value="">Todo</option>
          {Object.entries(ENTITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select wrapClass="w-56" value={actor} onChange={(e) => setActor(e.target.value)}>
          <option value="">Todos los usuarios</option>
          {data.profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px]">
          <thead className="border-b border-chrome-200"><tr><Th>Fecha</Th><Th>Usuario</Th><Th>Objeto</Th><Th>Acción</Th><Th>Detalle</Th></tr></thead>
          <tbody>
            {rows.slice(0, 500).map((e) => (
              <tr key={e.id} className="border-b border-chrome-200 align-top">
                <Td className="whitespace-nowrap text-sm">{fmtDateTime(e.at)}</Td>
                <Td className="text-sm"><div className="text-ink-700">{e.actor_name}</div><div className="text-xs">{ROLE_LABEL[e.actor_role]}</div></Td>
                <Td className="text-sm">{ENTITY[e.entity]}<div className="text-xs">{e.entity === 'request' ? <Link className="text-brand-500 hover:underline" to={`/solicitudes/${e.entity_id}`}>{label(e.entity, e.entity_id)}</Link> : e.entity === 'template' ? <Link className="text-brand-500 hover:underline" to={`/admin/modelos/${e.entity_id}`}>{label(e.entity, e.entity_id)}</Link> : label(e.entity, e.entity_id)}</div></Td>
                <Td className="text-sm">{e.action.replace(/_/g, ' ')}{e.to_status && <div className="text-xs">{e.from_status ? `${STATUS_LABEL[e.from_status]} → ` : ''}{STATUS_LABEL[e.to_status]}</div>} {e.internal && <Pill tone="amber">Interno</Pill>}</Td>
                <Td className="max-w-xl whitespace-pre-wrap text-sm">{e.comment}{e.revision ? <span className="text-ink-400"> (v{e.revision})</span> : null}</Td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 500 && <p className="mt-2 text-xs text-ink-400">Se muestran los 500 más recientes. Exportá el CSV para ver todo.</p>}
      </div>
    </div>
  );
}
