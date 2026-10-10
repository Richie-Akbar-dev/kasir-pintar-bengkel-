import { Link } from 'react-router-dom';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/auth';
import { rupiah, rupiahShort, relativeDay, formatDate } from '@/lib/format';
import type { DashboardSummary } from '@/lib/types';
import { PAYMENT_LABELS } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  ErrorBanner,
  LoadingBlock,
  StatCard,
  Td,
  TableWrap,
  Th,
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

      {/* ------------------------------ Statistik ------------------------------ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
        <StatCard
          label="Piutang belum lunas"
          value={s ? rupiahShort(s.receivables.total) : '-'}
          hint={s ? `${s.receivables.count} transaksi bon` : undefined}
          icon="wallet"
          tone="red"
          loading={summary.loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* ------------------------------ Grafik ------------------------------ */}
        <Card
          className="xl:col-span-2"
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

        {/* ------------------------------ Ringkasan ------------------------------ */}
        <div className="space-y-5">
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

      {/* ------------------------------ Transaksi terakhir ------------------------------ */}
      <Card
        title="Transaksi terakhir"
        subtitle="8 transaksi paling baru"
        action={
          <Link to="/riwayat">
            <Button size="xs" variant="outline">
              Semua riwayat
            </Button>
          </Link>
        }
        padded={false}
      >
        {summary.loading ? (
          <LoadingBlock />
        ) : !s || s.recentTransactions.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">
            Belum ada transaksi.{' '}
            <Link to="/kasir" className="text-brand-600 hover:underline">
              Buat transaksi pertama
            </Link>
          </p>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Kode</Th>
                <Th>Waktu</Th>
                <Th>Pelanggan</Th>
                <Th>Pembayaran</Th>
                <Th align="right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {s.recentTransactions.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <Td className="font-mono text-xs">{t.code}</Td>
                  <Td className="whitespace-nowrap text-xs text-slate-500">{relativeDay(t.date)}</Td>
                  <Td>
                    <span className="font-medium text-slate-800">{t.customerName}</span>
                    <span className="ml-1.5 text-xs text-slate-400">({t.itemCount} item)</span>
                  </Td>
                  <Td>
                    <Badge tone={t.paymentMethod === 'credit' ? 'amber' : 'slate'}>
                      {PAYMENT_LABELS[t.paymentMethod as keyof typeof PAYMENT_LABELS] || t.paymentMethod}
                    </Badge>
                  </Td>
                  <Td align="right" className="font-medium tabular">
                    {rupiah(t.total)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

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
