import { LogIn } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button, Input } from '../components/ui';
import { DEMO_PASSWORD } from '../lib/demo';
import { useData } from '../lib/store';

const DEMO_USERS = [
  { email: 'rrhh@demo.farmaplan', label: 'Administrador RR. HH. / Operaciones' },
  { email: 'gerente.centro@demo.farmaplan', label: 'Gerente · Demo Centro (24 h)' },
  { email: 'gerente.palermo@demo.farmaplan', label: 'Gerente · Demo Palermo' },
  { email: 'gerente.cordoba@demo.farmaplan', label: 'Gerente · Demo Nueva Córdoba' },
  { email: 'gerente.rosario@demo.farmaplan', label: 'Gerente · Demo Rosario Centro' },
];

export function Login() {
  const { signIn, mode } = useData();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e?: FormEvent, em = email, pw = password) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(em, pw);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-navy-900 p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-teal-500 text-xl font-black text-navy-900">+</div>
          <span className="text-lg font-semibold">FarmaPlan</span>
        </div>
        <div>
          <h1 className="text-3xl font-semibold leading-tight">Planificación mensual de horarios y dinámica operativa de tiendas</h1>
          <p className="mt-4 max-w-md text-slate-300">
            Los gerentes cargan los horarios de su equipo; RR. HH. y Operaciones analizan cobertura, posiciones y horas de toda la cadena en tiempo real.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm text-slate-300">
          <div><div className="text-2xl font-semibold text-teal-400">6</div>posiciones</div>
          <div><div className="text-2xl font-semibold text-teal-400">5</div>estados de aprobación</div>
          <div><div className="text-2xl font-semibold text-teal-400">24 h</div>turnos nocturnos</div>
        </div>
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-teal-500/10" />
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-2 lg:hidden"><div className="grid h-9 w-9 place-items-center rounded-lg bg-teal-500 text-lg font-black text-navy-900">+</div><span className="text-lg font-semibold text-navy-900">FarmaPlan</span></div>
          <h2 className="text-2xl font-semibold text-navy-900">Ingresar</h2>
          <p className="mt-1 text-sm text-slate-500">Accedé con tu usuario de gerente o de administración.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Input label="Correo electrónico" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input label="Contraseña" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
            <Button type="submit" disabled={busy} className="w-full"><LogIn size={16} /> Ingresar</Button>
          </form>

          {mode === 'local' ? (
            <div className="mt-8 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <div className="text-sm font-semibold text-amber-900">Modo demostración</div>
              <p className="mt-1 text-xs text-amber-800">
                No hay una base Supabase configurada: los datos se guardan en este navegador. Usuarios de prueba (contraseña <code className="font-mono">{DEMO_PASSWORD}</code>):
              </p>
              <ul className="mt-3 space-y-1.5">
                {DEMO_USERS.map((u) => (
                  <li key={u.email}>
                    <button
                      onClick={() => { setEmail(u.email); setPassword(DEMO_PASSWORD); void submit(undefined, u.email, DEMO_PASSWORD); }}
                      className="flex w-full flex-col items-start rounded-lg bg-white px-3 py-2 text-left text-sm ring-1 ring-amber-200 hover:ring-teal-500 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="font-medium text-navy-900">{u.label}</span>
                      <span className="text-xs text-slate-500">{u.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-8 text-xs text-slate-500">Autenticación gestionada por Supabase. Si no tenés usuario, solicitá el alta al administrador.</p>
          )}
        </div>
      </div>
    </div>
  );
}
