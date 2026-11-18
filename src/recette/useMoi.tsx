import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type Moi } from './api';

const Ctx = createContext<{ moi: Moi | null; loading: boolean; refresh: () => Promise<Moi | null> }>({ moi: null, loading: true, refresh: async () => null });

export function MoiProvider({ children }: { children: ReactNode }) {
  const [moi, setMoi] = useState<Moi | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      const m = await api<Moi>('/api/moi');
      setMoi(m);
      return m;
    } catch {
      setMoi({ user: null });
      return null;
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return <Ctx.Provider value={{ moi, loading, refresh }}>{children}</Ctx.Provider>;
}

export const useMoi = () => useContext(Ctx);
