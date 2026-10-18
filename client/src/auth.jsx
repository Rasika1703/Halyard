import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const refresh = useCallback(async () => {
    try { setUser((await api.me()).user); } catch { setUser(null); } finally { setReady(true); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const login = async (b) => setUser((await api.login(b)).user);
  const register = async (b) => setUser((await api.register(b)).user);
  const logout = async () => { await api.logout().catch(() => {}); setUser(null); };
  return <Ctx.Provider value={{ user, ready, login, register, logout, refresh }}>{children}</Ctx.Provider>;
}
