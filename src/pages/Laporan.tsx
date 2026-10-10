import { useMemo, useState } from 'react';
import { qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/useApi';
import { rupiah, monthLabel, monthRange, todayInput, daysAgoInput, formatDate } from '@/lib/format';
import { PAYMENT_LABELS, type PaymentMethod } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  ErrorBanner,
  Field,
  Input,
  LoadingBlock,
  Select,
  StatCard,
  Td,
  TableWrap,
  Th,
} from '@/components/ui';
import { AreaChart, BarChart, DonutChart, RankBars } from '@/components/Chart';

type Preset = 'today' | '7d' | '30d' | 'month' | 'lastMonth' | 'custom';

const PRESETS: Array<{ key: Preset; label: string }> = [
  { key: 'today', label: 'Hari ini' },
  { key: '7d', label: '7 hari' },
  { key: '30d', label: '30 hari' },
  { key: 'month', label: 'Bulan ini' },
  { key: 'lastMonth', label: 'Bulan lalu' },
  { key: 'custom', label: 'Kustom' },
];

function presetRange(preset: Preset): { from: string; to: string } {
  const today = todayInput();
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case '7d':
      return { from: daysAgoInput(6), to: today };
    case '30d':
      return { from: daysAgoInput(29), to: today };
    case 'month':
      return monthRange();
    case 'lastMonth':
      return monthRange(-1);
    default:
      return { from: monthRange().from, to: today };
  }
}

const DONUT_COLORS = ['#3361f6', '#10b981', '#fb7c14', '#8b5cf6', '#ef4444'];

export default function Laporan() {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';

  const [preset, setPreset] = useState<Preset>('30d');
  const [custom, setCustom] = useState(() => presetRange('30d'));
  const [type, setType] = useState<'all' | 'product' | 'service'>('all');

  const range = preset === 'custom' ? custom : presetRange(preset);
  const query = qs({ from: range.from, to: range.to });

  const pl = useApi<{
    data: {
      transactions: number;
      revenue: number;
      cogs: number | null;
      grossProfit: number | null;
      commission: number | null;
      expenses: number | null;
      netProfit: number | null;
      avgTransaction: number;
    };
  }>(`/api/reports/profit-loss${query}`, [query]);

  const series = useApi<{ data: Array<{ date: string; omzet: number; profit: number | null; transactions: number }> }>(
    `/api/reports/revenue-series${qs({
      from: range.from,
      to: range.to,
      days: Math.max(
        7,
        Math.min(
          365,
          Math.round(
            (new Date(range.to).getTime() - new Date(range.from).getTime()) / 86400000
          ) + 1
        )
      ),
    })}`,
    [range.from, range.to]
  );

  const monthly = useApi<{
    data: Array<{
      month: string;
      omzet: number;
      profit: number | null;
      expenses: number | null;
      netProfit: number | null;
      transactions: number;
    }>;
  }>('/api/reports/monthly?months=12');

  const topItems = useApi<{
    data: Array<{ type: string; name: string; code: string; qty: number; revenue: number; profit: number | null }>;
  }>(`/api/reports/top-items${qs({ ...range, type })}`, [range.from, range.to, type]);

  const mechanicReport = useApi<{
    data: Array<{ name: string; sharePercent: number; jobCount: number; revenue: number; commission: number }>;
  }>(`/api/reports/mechanics${query}`, [query]);

  const payments = useApi<{ data: Array<{ method: string; label: string; count: number; total: number }> }>(
    `/api/reports/payments${query}`,
    [query]
  );

  const categories = useApi<{ data: Array<{ category: string; revenue: number; qty: number }> }>(
    `/api/reports/categories${qs({ ...range, type })}`,
    [range.from, range.to, type]
  );

  const dailyData = useMemo(
    () =>
      (series.data?.data || []).map((p) => ({
        label: `${p.date.slice(8)}/${p.date.slice(5, 7)}`,
        value: p.omzet,
        secondary: p.profit ?? undefined,
      })),
    [series.data]
  );

  const monthlyData = useMemo(
    () =>
      (monthly.data?.data || []).map((m) => ({
        label: monthLabel(m.month),
        value: m.omzet,
        secondary: m.netProfit ?? undefined,
      })),
    [monthly.data]
  );

  const donutData = useMemo(
    () =>
      (payments.data?.data || []).map((p, i) => ({
        label: PAYMENT_LABELS[p.method as PaymentMethod] || p.label,
        value: p.total,
        color: DONUT_COLORS[i % DONUT_COLORS.length],
      })),
    [payments.data]
  );

  const summary = pl.data?.data;

  async function exportCsv() {
    const url = `/api/transactions/export/csv${qs({ from: range.from, to: range.to })}`;
    window.open(url, '_blank');
  }

  return (
    <div className="space-y-5">
      {/* ------------------------------ Filter ------------------------------ */}
      <Card padded={false}>
        <div className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex flex-wrap rounded-lg bg-slate-100 p-0.5">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPreset(p.key)}
                className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition ${
                  preset === p.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <>
              <Field label="Dari" className="w-40">
                <Input
                  type="date"
                  value={custom.from}
                  onChange={(e) => setCustom({ ...custom, from: e.target.value })}
                  className="h-9"
                />
              </Field>
              <Field label="Sampai" className="w-40">
                <Input
                  type="date"
                  value={custom.to}
                  onChange={(e) => setCustom({ ...custom, to: e.target.value })}
                  className="h-9"
                />
              </Field>
            </>
          )}

          <Field label="Jenis item" className="w-40">
            <Select value={type} onChange={(e) => setType(e.target.value as 'all' | 'product' | 'service')} className="h-9">
              <option value="all">Semua</option>
              <option value="product">Sparepart</option>
              <option value="service">Jasa</option>
            </Select>
          </Field>

          <div className="ml-auto">
            <Button variant="outline" icon="download" onClick={exportCsv}>
              Ekspor CSV
            </Button>
          </div>
        </div>
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
          Periode: <b className="text-slate-700">{formatDate(range.from)}</b> s/d{' '}
          <b className="text-slate-700">{formatDate(range.to)}</b>
        </div>
      </Card>

      {pl.error && (
        <ErrorBanner message={pl.error} onRetry={pl.reload} />
      )}

      {/* --------------------------- Laba / rugi --------------------------- */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Omzet"
          value={summary ? rupiah(summary.revenue) : '-'}
          hint={summary ? `${summary.transactions} transaksi` : undefined}
          icon="cash"
          tone="brand"
          loading={pl.loading}
        />
        <StatCard
          label="Rata-rata transaksi"
          value={summary ? rupiah(summary.avgTransaction) : '-'}
          icon="chart"
          tone="cyan"
          loading={pl.loading}
        />
        {isOwner ? (
          <>
            <StatCard
              label="Laba kotor"
              value={summary ? rupiah(summary.grossProfit ?? 0) : '-'}
              hint={summary ? `Modal ${rupiah(summary.cogs ?? 0)}` : undefined}
              icon="chart"
              tone="green"
              loading={pl.loading}
            />
            <StatCard
              label="Komisi mekanik"
              value={summary ? rupiah(summary.commission ?? 0) : '-'}
              icon="user"
              tone="violet"
              loading={pl.loading}
            />
            <StatCard
              label="Pengeluaran"
              value={summary ? rupiah(summary.expenses ?? 0) : '-'}
              icon="wallet"
              tone="accent"
              loading={pl.loading}
            />
            <StatCard
              label="Laba bersih"
              value={summary ? rupiah(summary.netProfit ?? 0) : '-'}
              hint="Laba kotor dikurangi komisi & pengeluaran"
              icon="sparkles"
              tone={(summary?.netProfit ?? 0) >= 0 ? 'green' : 'red'}
              loading={pl.loading}
            />
          </>
        ) : (
          <>
            <StatCard
              label="Jumlah item terjual"
              value={topItems.data?.data.reduce((a, i) => a + i.qty, 0) ?? '-'}
              icon="box"
              tone="green"
              loading={topItems.loading}
            />
            <StatCard
              label="Metode favorit"
              value={payments.data?.data[0]?.label || '-'}
              icon="wallet"
              tone="violet"
              loading={payments.loading}
            />
            <StatCard
              label="Kategori terlaris"
              value={categories.data?.data[0]?.category || '-'}
              icon="sparkles"
              tone="accent"
              loading={categories.loading}
            />
            <StatCard
              label="Mekanik terbaik"
              value={mechanicReport.data?.data[0]?.name || '-'}
              icon="user"
              tone="cyan"
              loading={mechanicReport.loading}
            />
          </>
        )}
      </div>

      {/* ------------------------------ Grafik ------------------------------ */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="Tren omzet harian"
          subtitle={isOwner ? 'Biru = omzet, hijau = laba kotor' : 'Grafik omzet harian'}
        >
          {series.loading ? (
            <LoadingBlock />
          ) : (
            <AreaChart data={dailyData} height={220} />
          )}
        </Card>

        <Card title="Komposisi pembayaran">
          {payments.loading ? <LoadingBlock /> : <DonutChart items={donutData} />}
        </Card>
      </div>

      <Card title="Perbandingan 12 bulan" subtitle="Omzet per bulan dibandingkan laba bersih">
        {monthly.loading ? <LoadingBlock /> : <BarChart data={monthlyData} height={220} />}
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm bg-brand-500" /> Omzet
          </span>
          {isOwner && (
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-sm bg-emerald-500" /> Laba bersih
            </span>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card title="Item terlaris" subtitle="Berdasarkan nilai penjualan">
          {topItems.loading ? (
            <LoadingBlock />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Item</Th>
                  <Th align="right">Terjual</Th>
                  <Th align="right">Omzet</Th>
                  {isOwner && <Th align="right">Laba</Th>}
                </tr>
              </thead>
              <tbody>
                {(topItems.data?.data || []).slice(0, 10).map((item, i) => (
                  <tr key={item.code + i}>
                    <Td>
                      <span className="block max-w-[15rem] truncate text-slate-800">{item.name}</span>
                      <span className="text-[11px] text-slate-400">
                        {item.type === 'product' ? 'Sparepart' : 'Jasa'} · {item.code}
                      </span>
                    </Td>
                    <Td align="right" className="tabular">
                      {item.qty}
                    </Td>
                    <Td align="right" className="tabular font-medium">
                      {rupiah(item.revenue)}
                    </Td>
                    {isOwner && (
                      <Td align="right" className="tabular text-emerald-600">
                        {rupiah(item.profit ?? 0)}
                      </Td>
                    )}
                  </tr>
                ))}
                {(topItems.data?.data || []).length === 0 && (
                  <tr>
                    <Td className="py-8 text-center text-slate-400">Belum ada data pada periode ini.</Td>
                  </tr>
                )}
              </tbody>
            </TableWrap>
          )}
        </Card>

        <Card title="Kinerja mekanik" subtitle="Omzet & estimasi komisi">
          {mechanicReport.loading ? (
            <LoadingBlock />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Mekanik</Th>
                  <Th align="right">Job</Th>
                  <Th align="right">Omzet</Th>
                  <Th align="right">Komisi</Th>
                </tr>
              </thead>
              <tbody>
                {(mechanicReport.data?.data || []).map((m) => (
                  <tr key={m.name}>
                    <Td>
                      <span className="block truncate text-slate-800">{m.name}</span>
                      <span className="text-[11px] text-slate-400">{m.sharePercent}% bagi hasil</span>
                    </Td>
                    <Td align="right" className="tabular">
                      {m.jobCount}
                    </Td>
                    <Td align="right" className="tabular font-medium">
                      {rupiah(m.revenue)}
                    </Td>
                    <Td align="right" className="tabular text-emerald-600">
                      {rupiah(m.commission)}
                    </Td>
                  </tr>
                ))}
                {(mechanicReport.data?.data || []).length === 0 && (
                  <tr>
                    <Td className="py-8 text-center text-slate-400">
                      Belum ada pekerjaan yang ditugaskan.
                    </Td>
                  </tr>
                )}
              </tbody>
            </TableWrap>
          )}
        </Card>

        <Card title="Omzet per kategori">
          {categories.loading ? (
            <LoadingBlock />
          ) : (
            <RankBars
              items={(categories.data?.data || []).slice(0, 8).map((c) => ({
                name: c.category,
                value: c.revenue,
                caption: `${c.qty} item terjual`,
              }))}
            />
          )}
        </Card>
      </div>

      {!isOwner && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Badge tone="amber">Kasir</Badge>
          Angka laba, modal, komisi, dan pengeluaran hanya dapat dilihat oleh akun owner.
        </div>
      )}

      {isOwner && (
        <Card title="Ringkasan metode pembayaran" padded={false}>
          <TableWrap>
            <thead>
              <tr>
                <Th>Metode</Th>
                <Th align="right">Jumlah transaksi</Th>
                <Th align="right">Total</Th>
                <Th align="right">Porsi</Th>
              </tr>
            </thead>
            <tbody>
              {(payments.data?.data || []).map((p) => {
                const totalAll = (payments.data?.data || []).reduce((a, x) => a + x.total, 0) || 1;
                return (
                  <tr key={p.method}>
                    <Td>{PAYMENT_LABELS[p.method as PaymentMethod] || p.label}</Td>
                    <Td align="right" className="tabular">
                      {p.count}
                    </Td>
                    <Td align="right" className="tabular font-medium">
                      {rupiah(p.total)}
                    </Td>
                    <Td align="right" className="tabular text-slate-500">
                      {Math.round((p.total / totalAll) * 100)}%
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        </Card>
      )}
    </div>
  );
}
