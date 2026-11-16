import { FileText } from 'lucide-react';
import { useState } from 'react';
import { Button, Input, Notice } from '../components/ui';
import { DEMO_PASSWORD, profiles } from '../lib/seed';
import { useData } from '../lib/store';
import { ROLE_LABEL } from '../lib/types';

export function Login() {
  const { signIn, isDemo, resetDemo } = useData();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const go = async (e?: string, p?: string) => {
    setBusy(true);
    setError('');
    try {
      await signIn(e ?? email, p ?? password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full bg-chrome-100">
      <div className="flex h-11 items-center bg-chrome-200 px-4 text-sm text-ink-700">Portal RH</div>
      <div className="mx-auto grid max-w-5xl gap-8 px-5 py-12 lg:grid-cols-2">
        <div>
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-lg bg-brand-500 text-white"><FileText size={26} /></div>
          <h1 className="text-3xl font-bold text-ink-900">Portal de Recursos Humanos</h1>
          <p className="mt-3 text-ink-500">
            Biblioteca de modelos y procedimientos, solicitudes de medidas disciplinarias con borrador automático,
            y circuito de aprobación de RH con historial de auditoría.
          </p>
          <form className="mt-8 space-y-4 rounded-xl border border-chrome-300 bg-white p-6" onSubmit={(e) => { e.preventDefault(); go(); }}>
            <Input label="Correo" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input label="Contraseña" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error && <Notice tone="error">{error}</Notice>}
            <Button type="submit" disabled={busy}>Iniciar sesión</Button>
          </form>
        </div>
        {isDemo && (
          <div className="rounded-xl border border-chrome-300 bg-white p-6">
            <h2 className="text-lg font-bold text-ink-900">Usuarios de demostración</h2>
            <p className="mt-1 text-sm text-ink-500">Contraseña de todos: <code className="rounded bg-chrome-100 px-1">{DEMO_PASSWORD}</code>. Los datos quedan sólo en este navegador.</p>
            <div className="mt-4 divide-y divide-chrome-200">
              {profiles.map((p) => (
                <button key={p.id} className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-chrome-100" onClick={() => go(p.email, DEMO_PASSWORD)} disabled={busy}>
                  <span>
                    <span className="block font-semibold text-ink-900">{p.name}</span>
                    <span className="block text-xs text-ink-500">{ROLE_LABEL[p.role]}{p.role !== 'admin_rh' ? ` · ${p.areas.join(', ')}` : ''}</span>
                  </span>
                  <span className="text-sm text-brand-500">Entrar</span>
                </button>
              ))}
            </div>
            <Button variant="link" className="mt-4" onClick={() => { if (confirmReset) { setConfirmReset(false); resetDemo(); } else setConfirmReset(true); }}>
              {confirmReset ? '¿Seguro? Se borran todos los cambios. Clic de nuevo para confirmar' : 'Restablecer datos de demostración'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
