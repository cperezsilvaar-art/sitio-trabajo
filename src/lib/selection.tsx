import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useData } from './store';

interface Sel {
  year: number;
  month: number;
  storeId: string | null;
  setMonth(y: number, m: number): void;
  setStoreId(id: string): void;
}

const Ctx = createContext<Sel | null>(null);
const KEY = 'farmaplan:sel';

function read(): Partial<Sel> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

/** Tienda, mes y año seleccionados, compartidos entre pantallas. */
export function SelectionProvider({ children }: { children: ReactNode }) {
  const { user, stores } = useData();
  const now = new Date();
  const saved = read();
  const [year, setYear] = useState(saved.year ?? now.getFullYear());
  const [month, setM] = useState(saved.month ?? now.getMonth() + 1);
  const [storeId, setStore] = useState<string | null>(saved.storeId ?? null);

  useEffect(() => {
    if (user?.role === 'gerente') setStore(user.store_id);
    else if (stores.length && (!storeId || !stores.some((s) => s.id === storeId))) setStore(stores[0].id);
  }, [user, stores, storeId]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ year, month, storeId }));
    } catch {
      /* sin almacenamiento */
    }
  }, [year, month, storeId]);

  return (
    <Ctx.Provider
      value={{
        year, month, storeId,
        setMonth: (y, m) => { setYear(y); setM(m); },
        setStoreId: (id) => { if (user?.role === 'admin') setStore(id); },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSelection() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSelection fuera de SelectionProvider');
  return c;
}
