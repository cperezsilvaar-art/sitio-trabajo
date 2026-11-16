import { FileDown, LayoutGrid, List, Printer } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, cx, DocThumb, Empty, Input, Modal, PageTitle, Pill, shortDate, Td, Th } from '../components/ui';
import { downloadStored, printDocument } from '../lib/documents';
import { useData } from '../lib/store';
import { fmtDate } from '../lib/template';
import { CATEGORY_LABEL, type Template, type TemplateCategory } from '../lib/types';

const ACCENTS: Record<TemplateCategory, string> = {
  sancion: 'bg-rose-500', comunicacion: 'bg-brand-500', procedimiento: 'bg-violet-500', instructivo: 'bg-amber-400', otro: 'bg-slate-400',
};

export function Biblioteca() {
  const { user, data, svc } = useData();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Template | null>(null);
  if (!user || !svc) return null;
  const cat = params.get('cat') as TemplateCategory | null;

  const rows = data.templates
    .filter((t) => t.active)
    .filter((t) => !cat || t.category === cat)
    .filter((t) => !q || `${t.title} ${t.description}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.title.localeCompare(b.title));
  const version = (t: Template) => data.template_versions.find((v) => v.id === t.current_version_id);

  const download = async (t: Template) => {
    const v = version(t);
    if (v?.file_id) {
      const f = await svc.getFile(v.file_id);
      if (f) return downloadStored(f);
    }
    printDocument({ title: t.title, content: v?.body ?? '', draft: false, footer: `${t.title} · versión ${v?.version} vigente desde ${fmtDate(v?.created_at)}` });
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageTitle sub="Modelos, procedimientos e instructivos oficiales de Recursos Humanos. Siempre se muestra la versión vigente.">
        {cat ? CATEGORY_LABEL[cat] : 'Biblioteca de RH'}
      </PageTitle>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button onClick={() => setParams({})} className={cx('rounded-full px-3 py-1 text-sm', !cat ? 'bg-ink-700 text-white' : 'bg-chrome-100 hover:bg-chrome-200')}>Todos</button>
        {(Object.keys(CATEGORY_LABEL) as TemplateCategory[]).map((c) => (
          <button key={c} onClick={() => setParams({ cat: c })} className={cx('rounded-full px-3 py-1 text-sm', cat === c ? 'bg-ink-700 text-white' : 'bg-chrome-100 hover:bg-chrome-200')}>{CATEGORY_LABEL[c]}</button>
        ))}
        <Input wrapClass="ml-auto w-64" placeholder="Buscar en la biblioteca" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex gap-1">
          <button className={cx('rounded-md p-2', view === 'list' ? 'bg-ink-700 text-white' : 'hover:bg-chrome-100')} onClick={() => setView('list')} aria-label="Lista"><List size={18} /></button>
          <button className={cx('rounded-md p-2', view === 'grid' ? 'bg-ink-700 text-white' : 'hover:bg-chrome-100')} onClick={() => setView('grid')} aria-label="Cuadrícula"><LayoutGrid size={18} /></button>
        </div>
      </div>

      {rows.length === 0 ? <Empty>No hay documentos en esta sección.</Empty> : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((t) => (
            <div key={t.id} className="flex flex-col rounded-xl border border-chrome-300 p-5">
              <div className="flex gap-4">
                <DocThumb accent={ACCENTS[t.category]} />
                <div className="min-w-0">
                  <button className="text-left font-bold text-ink-900 hover:underline" onClick={() => setOpen(t)}>{t.title}</button>
                  <div className="text-xs text-ink-500">Versión {version(t)?.version} · actualizado {fmtDate(t.updated_at)}</div>
                </div>
              </div>
              <p className="mt-3 flex-1 text-sm text-ink-500">{t.description}</p>
              <div className="mt-4 flex gap-4">
                <Button variant="link" onClick={() => setOpen(t)}>Ver</Button>
                <Button variant="link" onClick={() => download(t)}>Descargar</Button>
                {user.role === 'gerente' && t.measure_type_ids.length > 0 && <Button variant="link" onClick={() => nav(`/solicitudes/nueva?modelo=${t.id}`)}>Usar este modelo</Button>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead className="border-b border-chrome-200"><tr><Th className="w-16" /><Th>Nombre</Th><Th>Sección</Th><Th>Versión vigente</Th><Th>Actualizado</Th><Th /></tr></thead>
            <tbody>
              {rows.map((t) => {
                const v = version(t);
                return (
                  <tr key={t.id} className="border-b border-chrome-200 hover:bg-chrome-100">
                    <Td><div className="flex justify-center"><DocThumb small accent={ACCENTS[t.category]} /></div></Td>
                    <Td>
                      <button className="text-left text-[16px] text-ink-700 hover:underline" onClick={() => setOpen(t)}>{t.title}</button>
                      <div className="text-xs text-ink-500">{v?.file_name?.split('.').pop()?.toUpperCase() ?? 'TEXTO'} · {t.description}</div>
                    </Td>
                    <Td>{CATEGORY_LABEL[t.category].split(' ')[0]}</Td>
                    <Td><Pill tone="gray">v{v?.version}</Pill></Td>
                    <Td>{shortDate(t.updated_at)}</Td>
                    <Td className="whitespace-nowrap text-right">
                      <Button variant="ghost" size="sm" onClick={() => download(t)} title="Descargar"><FileDown size={16} /></Button>
                      {user.role === 'gerente' && t.measure_type_ids.length > 0 && <Button size="sm" onClick={() => nav(`/solicitudes/nueva?modelo=${t.id}`)}>Usar</Button>}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {open && (() => {
        const v = version(open);
        return (
          <Modal wide title={open.title} onClose={() => setOpen(null)} footer={<>
            <Button variant="outline" onClick={() => printDocument({ title: open.title, content: v?.body ?? '', draft: false })}><Printer size={15} /> Imprimir</Button>
            <Button variant="outline" onClick={() => download(open)}><FileDown size={15} /> Descargar</Button>
            {user.role === 'gerente' && open.measure_type_ids.length > 0 && <Button onClick={() => nav(`/solicitudes/nueva?modelo=${open.id}`)}>Usar este modelo</Button>}
          </>}>
            <div className="mb-3 text-sm text-ink-500">Versión {v?.version} vigente desde {fmtDate(v?.created_at)} · {v?.change_notes}</div>
            <div className="doc-paper rounded-lg border border-chrome-300 p-8 text-[13px] text-ink-900">{(v?.body ?? '').replace(/\{\{\s*estado_documento\s*\}\}\n*/g, '')}</div>
            {open.measure_type_ids.length > 0 && <p className="mt-3 text-xs text-ink-400">Los campos entre {'{{ }}'} se completan solos con los datos de la solicitud.</p>}
          </Modal>
        );
      })()}
    </div>
  );
}
