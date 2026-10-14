import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from './api';
import type { Role, Settings, User } from './types';

interface AuthState {
  user: User | null;
  settings: Settings | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  saveSettingsLocally: (settings: Settings) => void;
}

export const DEFAULT_SETTINGS: Settings = {
  workshopName: 'Bengkel Pintar',
  tagline: '',
  address: '',
  phone: '',
  footerNote: '',
  taxEnabled: false,
  taxPercent: 11,
  lowStockAlert: true,
  receiptWidth: 58,
  printAutoOpen: true,
  printerType: 'browser',
  printerName: '',
  printerHost: '',
  printerPort: 9100,
  comPort: '',
  baudRate: 9600,
  printerAutoCut: true,
  printCopies: 1,
  openDrawerOnCash: true,
  drawerPin: 2,
  scannerEnterAddsItem: true,
  scannerBeep: true,
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ user: User; settings: Settings }>('/api/auth/me');
      setUser(res.user);
      setSettings({ ...DEFAULT_SETTINGS, ...res.settings });
    } catch {
      setUser(null);
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.post<{ user: User }>('/api/auth/login', { username, password });
    setUser(res.user);
    const me = await api.get<{ settings: Settings }>('/api/auth/me');
    setSettings({ ...DEFAULT_SETTINGS, ...me.settings });
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    await api.post('/api/auth/logout').catch(() => undefined);
    setUser(null);
    setSettings(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      settings,
      loading,
      login,
      logout,
      refresh,
      saveSettingsLocally: (s: Settings) => setSettings({ ...DEFAULT_SETTINGS, ...s }),
    }),
    [user, settings, loading, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>');
  return ctx;
}

/** Helper: apakah pengguna saat ini punya akses owner. */
export function useIsOwner(): boolean {
  return useAuth().user?.role === 'owner';
}

export function roleLabel(role: Role): string {
  return role === 'owner' ? 'Owner / Pemilik' : 'Kasir';
}
