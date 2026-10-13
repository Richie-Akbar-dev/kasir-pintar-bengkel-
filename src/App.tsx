import { useEffect } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ToastProvider } from '@/components/ui';
import Layout from '@/components/Layout';

import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Kasir from '@/pages/Kasir';
import Pembayaran from '@/pages/Pembayaran';
import WorkOrder from '@/pages/WorkOrder';
import Riwayat from '@/pages/Riwayat';
import Sparepart from '@/pages/Sparepart';
import JasaServis from '@/pages/JasaServis';
import Pelanggan from '@/pages/Pelanggan';
import Mekanik from '@/pages/Mekanik';
import Pengeluaran from '@/pages/Pengeluaran';
import Laporan from '@/pages/Laporan';
import Pengaturan from '@/pages/Pengaturan';

function Splash() {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-900">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-accent-500 text-white shadow-xl shadow-accent-500/30">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a4 4 0 0 0 5 5l-9.3 9.3a2.1 2.1 0 0 1-3-3l9.3-9.3-2-2Z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-300">Memuat Kasir Pintar Bengkel…</p>
      </div>
    </div>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading, refresh } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => {
      refresh();
      navigate('/login', { replace: true });
    };
    window.addEventListener('auth:expired', handler);
    return () => window.removeEventListener('auth:expired', handler);
  }, [refresh, navigate]);

  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicOnly>
                  <Login />
                </PublicOnly>
              }
            />
            <Route
              element={
                <Protected>
                  <Layout />
                </Protected>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/kasir" element={<Kasir />} />
              <Route path="/kasir/bayar" element={<Pembayaran />} />
              <Route path="/work-order" element={<WorkOrder />} />
              <Route path="/riwayat" element={<Riwayat />} />
              <Route path="/sparepart" element={<Sparepart />} />
              <Route path="/jasa" element={<JasaServis />} />
              <Route path="/pelanggan" element={<Pelanggan />} />
              <Route path="/mekanik" element={<Mekanik />} />
              <Route path="/pengeluaran" element={<Pengeluaran />} />
              <Route path="/laporan" element={<Laporan />} />
              <Route path="/pengaturan" element={<Pengaturan />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
