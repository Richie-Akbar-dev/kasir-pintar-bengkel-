import { Link } from 'react-router-dom';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/auth';
import { rupiah, formatDate } from '@/lib/format';
import type { DashboardSummary } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  ErrorBanner,
  LoadingBlock,
  StatCard,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import { AreaChart } from '@/components/Chart';

interface SeriesPoint {
  date: string;
  omzet: number;
  profit: number | null;
  transactions: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';
  const summary = useApi<{ data: DashboardSummary }>('/api/reports/summary');
  const series = useApi<{ data: SeriesPoint[] }>('/api/reports/revenue-series?days=30');

  const s = summary.data?.data;
  const chartData = (series.data?.data || []).map((p) => ({
    label: p.date.slice(8) + '/' + p.date.slice(5, 7),
    value: p.omzet,
    secondary: p.profit ?? undefined,
  }));

  return (
    <div className="space-y-5">
      {summary.error && <ErrorBanner message={summary.error} onRetry={summary.reload} />}

      {/* ------ Kiri: 3 kartu statistik + grafik | Kanan: ringkasan + stok menipis ------ */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Omzet hari ini"
          value={s ? rupiah(s.today.omzet) : '-'}
          hint={s ? `${s.today.transactions} transaksi` : undefined}
          icon="cash"
          tone="brand"
          loading={summary.loading}
        />
        {isOwner ? (
          <StatCard
            label="Laba hari ini"
            value={s ? rupiah(s.today.profit ?? 0) : '-'}
            hint="Penjualan dikurangi modal"
            icon="chart"
            tone="green"
            loading={summary.loading}
          />
        ) : (
          <StatCard
            label="Servis berjalan"
            value={s ? s.workOrders.inProgress : '-'}
            hint={s ? `${s.workOrders.waiting} menunggu antrian` : undefined}
            icon="wrench"
            tone="accent"
            loading={summary.loading}
          />
        )}
        <StatCard
          label="Work order aktif"
          value={s ? s.workOrders.active : '-'}
          hint={s ? `${s.workOrders.ready} siap diambil` : undefined}
          icon="clipboard"
          tone="violet"
          loading={summary.loading}
        />
          </div>

        {/* ------------------------------ Grafik ------------------------------ */}
        <Card
          className="flex-1"
          title="Omzet & laba 30 hari terakhir"
          subtitle={
            isOwner
              ? 'Biru = omzet, hijau = laba kotor'
              : 'Grafik omzet (laba hanya terlihat untuk akun owner)'
          }
          action={
            <Link to="/laporan">
              <Button size="xs" variant="outline">
                Lihat laporan
              </Button>
            </Link>
          }
        >
          {series.loading ? (
            <LoadingBlock />
          ) : series.error ? (
            <ErrorBanner message={series.error} onRetry={series.reload} />
          ) : (
            <AreaChart data={chartData} height={210} />
          )}
        </Card>
        </div>

        {/* ------- Kolom kanan: Ringkasan + Stok menipis (tinggi sejajar grafik) ------- */}
        <div className="flex flex-col gap-5">
          <Card title="Ringkasan bulan ini">
            {summary.loading ? (
              <LoadingBlock />
            ) : !s ? null : (
              <dl className="space-y-3">
                <Row label="Omzet bulan ini" value={rupiah(s.month.omzet)} />
                <Row label="Jumlah transaksi" value={`${s.month.transactions} transaksi`} />
                {isOwner && <Row label="Laba kotor" value={rupiah(s.month.profit ?? 0)} />}
                {isOwner && <Row label="Pengeluaran" value={rupiah(s.month.expenses)} />}
                {isOwner && (
                  <Row
                    label="Laba bersih"
                    value={rupiah(s.month.netProfit ?? 0)}
                    tone={(s.month.netProfit ?? 0) >= 0 ? 'green' : 'red'}
                    strong
                  />
                )}
              </dl>
            )}
          </Card>

          <Card
            className="flex-1"
            title="Stok menipis"
            action={
              <Link to="/sparepart">
                <Button size="xs" variant="ghost">
                  Kelola
                </Button>
              </Link>
            }
            padded={false}
          >
            {summary.loading ? (
              <LoadingBlock />
            ) : !s || s.lowStockItems.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">
                Semua stok aman. 👍
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {s.lowStockItems.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                      <Icon name="alert" size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-slate-800">{item.name}</p>
                      <p className="text-[11px] text-slate-500">{item.code}</p>
                    </div>
                    <Badge tone="amber">
                      {item.stock} {item.unit}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {s && isOwner && (
        <p className="text-center text-xs text-slate-400">
          Nilai stok gudang: <span className="font-medium text-slate-600">{rupiah(s.inventory.stockValue ?? 0)}</span>{' '}
          · {s.inventory.totalProducts} jenis sparepart · Data per {formatDate(new Date())}
        </p>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  tone = 'slate',
  strong,
}: {
  label: string;
  value: string;
  tone?: 'slate' | 'green' | 'red';
  strong?: boolean;
}) {
  const colors = { slate: 'text-slate-900', green: 'text-emerald-600', red: 'text-red-600' };
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[13px] text-slate-500">{label}</dt>
      <dd className={`tabular text-[13px] ${strong ? 'font-semibold' : 'font-medium'} ${colors[tone]}`}>
        {value}
      </dd>
    </div>
  );
}
