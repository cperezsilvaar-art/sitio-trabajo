// Descarga e impresión de documentos. El borrador siempre sale marcado como BORRADOR;
// el definitivo sólo existe si RH aprobó la solicitud.

import { base64ToBytes, buildValues, fillDocx } from './template';
import type { PortalService } from './service';
import type { DisciplinaryRequest, FinalDocument, RequestData, StoredFile, TemplateVersion } from './types';

export function downloadBytes(name: string, bytes: Uint8Array | string, mime: string) {
  const blob = new Blob([typeof bytes === 'string' ? bytes : (bytes as BlobPart)], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name.replace(/[\\/:*?"<>|]/g, '-');
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadStored(f: StoredFile) {
  downloadBytes(f.name, base64ToBytes(f.data), f.mime);
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Abre una ventana de impresión (permite "Guardar como PDF"). */
export function printDocument(opts: { title: string; content: string; draft: boolean; footer?: string }) {
  const w = window.open('', '_blank');
  if (!w) {
    throw new Error('El navegador bloqueó la ventana de impresión. Permita las ventanas emergentes para este sitio.');
  }
  const wm = opts.draft
    ? `<div class="wm">BORRADOR</div><div class="banner">BORRADOR – Sin validez hasta su aprobación por Recursos Humanos. No entregar al colaborador.</div>`
    : '';
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(opts.title)}</title>
<style>
@page { size: A4; margin: 22mm 20mm 20mm 25mm; }
body { font: 11pt/1.55 Arial, Helvetica, sans-serif; color: #111; white-space: pre-wrap; text-align: justify; margin: 0; }
.wm { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; font: 700 110pt Arial; color: rgba(220,38,38,.10); transform: rotate(-30deg); z-index: -1; }
.banner { border: 2px solid #dc2626; color: #b91c1c; font-weight: 700; padding: 6px 10px; margin-bottom: 14px; white-space: normal; text-align: center; }
.foot { margin-top: 28px; padding-top: 6px; border-top: 1px solid #ccc; font-size: 8pt; color: #666; white-space: normal; }
</style></head><body>${wm}${escapeHtml(opts.content)}${opts.footer ? `<div class="foot">${escapeHtml(opts.footer)}</div>` : ''}
<script>window.onload = () => setTimeout(() => window.print(), 200);</script></body></html>`);
  w.document.close();
}

/** Word del borrador: usa el .docx del modelo si existe, con la leyenda de borrador. */
export async function downloadDraftDocx(svc: PortalService, req: DisciplinaryRequest | (RequestData & { number: string; manager_name: string }), tv: TemplateVersion) {
  if (!tv.file_id) return false;
  const tpl = await svc.getFile(tv.file_id);
  if (!tpl || !tpl.name.toLowerCase().endsWith('.docx')) return false;
  const values = buildValues(req, {
    number: req.number, manager_name: req.manager_name, issued_at: new Date().toISOString(),
    city: 'Ciudad Autónoma de Buenos Aires', final: false,
  }, tv.fields);
  const bytes = await fillDocx(tpl.data, values);
  downloadBytes(`${req.number} – BORRADOR – ${req.employee_name}.docx`, bytes, tpl.mime);
  return true;
}

export async function downloadFinal(svc: PortalService, req: DisciplinaryRequest, doc: FinalDocument, format: 'docx' | 'print') {
  const footer = `Documento definitivo · Solicitud ${req.number} · versión ${doc.revision} · aprobado por ${doc.approved_by_name} el ${new Date(doc.approved_at).toLocaleString('es-AR')} · SHA-256 ${doc.sha256}`;
  if (format === 'docx' && doc.docx_file_id) {
    const f = await svc.getFile(doc.docx_file_id);
    if (f) {
      downloadStored(f);
      await svc.logDownload(req.id, `Descarga del documento definitivo (Word) v${doc.revision}.`);
      return;
    }
  }
  printDocument({ title: `${req.number} – ${req.measure_type_name} – ${req.employee_name}`, content: doc.content, draft: false, footer });
  await svc.logDownload(req.id, `Impresión del documento definitivo v${doc.revision}.`);
}
