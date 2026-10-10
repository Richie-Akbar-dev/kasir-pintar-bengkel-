import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button, Field, Input } from '@/components/ui';
import { Icon } from '@/components/icons';

export default function Login() {
  const { login, settings } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(username.trim(), password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Panel kiri */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-slate-900 p-10 lg:flex">
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, #fb7c14 0, transparent 45%), radial-gradient(circle at 80% 70%, #3361f6 0, transparent 45%)',
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-500 text-white shadow-lg shadow-accent-500/40">
              <Icon name="wrench" size={22} />
            </div>
            <div>
              <p className="text-base font-semibold text-white">Kasir Pintar Bengkel</p>
              <p className="text-xs text-slate-400">Aplikasi kasir & manajemen bengkel</p>
            </div>
          </div>
        </div>

        <div className="relative">
          <h1 className="max-w-md text-3xl font-semibold leading-tight text-white">
            Kelola transaksi, stok sparepart, dan servis bengkel dalam satu aplikasi.
          </h1>
          <ul className="mt-6 space-y-2.5 text-sm text-slate-300">
            {[
              'Kasir cepat dengan pencarian sparepart & jasa',
              'Work order / SPK dengan status pengerjaan',
              'Peringatan stok menipis otomatis',
              'Laporan omzet, laba, dan komisi mekanik',
              'Data tersimpan aman di laptop Anda',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <Icon name="check" size={16} className="mt-0.5 shrink-0 text-accent-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-500">
          {settings?.workshopName || 'Bengkel Pintar'} · Berjalan offline di komputer lokal
        </p>
      </div>

      {/* Panel kanan */}
      <div className="flex w-full items-center justify-center bg-slate-100 p-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-500 text-white">
              <Icon name="wrench" size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Kasir Pintar Bengkel</p>
              <p className="text-xs text-slate-500">Silakan masuk</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Masuk ke aplikasi</h2>
            <p className="mt-1 text-sm text-slate-500">
              Gunakan akun yang sudah dibuat oleh pemilik bengkel.
            </p>

            <form onSubmit={onSubmit} className="mt-5 space-y-4">
              <Field label="Username" required>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="mis. owner"
                  autoComplete="username"
                  autoFocus
                  required
                />
              </Field>

              <Field label="Password" required>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    <Icon name={showPassword ? 'x' : 'search'} size={15} />
                  </button>
                </div>
              </Field>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              <Button type="submit" size="lg" block loading={busy} icon="logout">
                Masuk
              </Button>
            </form>

            <div className="mt-5 rounded-lg bg-slate-50 px-3.5 py-3 text-xs text-slate-600 ring-1 ring-slate-200">
              <p className="mb-1.5 font-medium text-slate-700">Akun bawaan (demo)</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  <code className="font-mono text-[11px] text-slate-800">owner / owner123</code> —
                  akses penuh
                </span>
                <span>
                  <code className="font-mono text-[11px] text-slate-800">kasir / kasir123</code> —
                  transaksi saja
                </span>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Ganti password akun ini di menu Pengaturan setelah instalasi.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
