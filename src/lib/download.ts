/**
 * Entrega un archivo generado al usuario. Dentro del visor de Claude usa la capacidad
 * "downloads" (el visor pide confirmación); en cualquier otro hosting, descarga normal.
 */
type DownloadsNs = { save(r: { filename: string; data: Blob }): Promise<unknown> };
type ClaudeGlobal = { use?: (name: string) => Promise<unknown> };

let downloadsNs: Promise<DownloadsNs | null> | null = null;

function viewerDownloads(): Promise<DownloadsNs | null> {
  const c = (window as unknown as { claude?: ClaudeGlobal }).claude;
  if (!c?.use) return Promise.resolve(null);
  downloadsNs ??= c.use('downloads').then((x) => (x as DownloadsNs) ?? null).catch(() => null);
  return downloadsNs;
}

export async function saveFile(filename: string, data: Blob): Promise<void> {
  const ns = await viewerDownloads();
  if (ns) {
    try {
      await ns.save({ filename, data });
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'declined') return;
      throw new Error(`No se pudo descargar el archivo (${code ?? 'error'}).`);
    }
    return;
  }
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
