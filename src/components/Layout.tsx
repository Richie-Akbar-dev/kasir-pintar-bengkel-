import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, roleLabel } from '@/lib/auth';
import { Icon, type IconName } from './icons';
import { Button } from './ui';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  ownerOnly?: boolean;
  accent?: boolean;
  end?: boolean;
}

const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Operasional',
    items: [
      { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
      { to: '/kasir', label: 'Kasir', icon: 'cart', accent: true },
      { to: '/work-order', label: 'Work Order / SPK', icon: 'clipboard' },
      { to: '/riwayat', label: 'Riwayat Transaksi', icon: 'receipt' },
    ],
  },
  {
    title: 'Data Master',
    items: [
      { to: '/sparepart', label: 'Sparepart & Stok', icon: 'box' },
      { to: '/jasa', label: 'Jasa Servis', icon: 'wrench' },
      { to: '/pelanggan', label: 'Pelanggan', icon: 'users' },
      { to: '/mekanik', label: 'Mekanik', icon: 'user', ownerOnly: true },
    ],
  },
  {
    title: 'Keuangan',
    items: [
      { to: '/pengeluaran', label: 'Pengeluaran', icon: 'wallet', ownerOnly: true },
      { to: '/laporan', label: 'Laporan', icon: 'chart', ownerOnly: true },
      { to: '/pengaturan', label: 'Pengaturan', icon: 'settings', ownerOnly: true },
    ],
  },
];

const TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/kasir': 'Kasir',
  '/work-order': 'Work Order / SPK',
  '/riwayat': 'Riwayat Transaksi',
  '/sparepart': 'Sparepart & Stok',
  '/jasa': 'Jasa Servis',
  '/pelanggan': 'Pelanggan & Kendaraan',
  '/mekanik': 'Mekanik',
  '/pengeluaran': 'Pengeluaran',
  '/laporan': 'Laporan',
  '/pengaturan': 'Pengaturan',
};

export default function Layout() {
  const { user, settings, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const groups = useMemo(
    () =>
      NAV_GROUPS.map((g) => ({
        ...g,
        items: g.items.filter((i) => !i.ownerOnly || user?.role === 'owner'),
      })).filter((g) => g.items.length > 0),
    [user?.role]
  );

  const title = TITLES[location.pathname] || 'Kasir Pintar Bengkel';

  return (
    <div className="flex h-full min-h-screen bg-slate-100">
      {/* ------------------------------ Sidebar ------------------------------ */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-900 text-slate-300 transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-500 text-white shadow-lg shadow-accent-500/30">
            <Icon name="wrench" size={20} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {settings?.workshopName || 'Kasir Bengkel'}
            </p>
            <p className="truncate text-[11px] text-slate-400">Kasir Pintar Bengkel</p>
          </div>
          <button
            className="ml-auto rounded p-1.5 text-slate-400 hover:bg-white/10 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Tutup menu"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition ${
                          isActive
                            ? item.accent
                              ? 'bg-accent-500 text-white shadow-sm shadow-accent-500/30'
                              : 'bg-brand-600 text-white shadow-sm shadow-brand-600/25'
                            : item.accent
                              ? 'text-accent-300 hover:bg-white/5 hover:text-accent-200'
                              : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        }`
                      }
                    >
                      <Icon name={item.icon} size={17} />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="mb-2 flex items-center gap-2.5 rounded-lg bg-white/5 px-2.5 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
              {user?.name?.slice(0, 1).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white">{user?.name}</p>
              <p className="truncate text-[11px] text-slate-400">
                {user ? roleLabel(user.role) : ''}
              </p>
            </div>
          </div>
          <button
            onClick={async () => {
              await logout();
              navigate('/login', { replace: true });
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-slate-300 transition hover:bg-red-500/10 hover:text-red-300"
          >
            <Icon name="logout" size={17} />
            Keluar
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="no-print fixed inset-0 z-30 bg-slate-900/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ------------------------------- Konten ------------------------------ */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur">
          <button
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Buka menu"
          >
            <Icon name="menu" size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-semibold text-slate-900">{title}</h1>
          </div>
          <p className="hidden text-xs text-slate-500 sm:block">
            {clock.toLocaleDateString('id-ID', {
              weekday: 'long',
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </p>
          <Link to="/kasir" className="hidden sm:block">
            <Button size="sm" variant="accent" icon="plus">
              Transaksi Baru
            </Button>
          </Link>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
