import { useState } from 'react';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/useApi';
import { rupiah, formatDate, monthRange, todayInput } from '@/lib/format';
import type { Expense } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  LoadingBlock,
  Modal,
  NumberInput,
  StatCard,
  Td,
  TableWrap,
  Th,
  useToast,
} from '@/components/ui';

const CATEGORIES = [
  'Gaji',
  'Listrik & Air',
  'Sewa',
  'Perlengkapan',
  'Peralatan',
  'Perawatan Alat',
  'Konsumsi',
  'Utilitas',
  'Lainnya',
];

const EMPTY: Partial<Expense> = {
  name: '',
  category: 'Lainnya',
  amount: 0,
  note: '',
  date: todayInput(),
};

export default function Pengeluaran() {
  const { user } = useAuth();
  const toast = useToast();
  const isOwner = user?.role === 'owner';

  const [range, setRange] = useState<'month' | 'all' | 'custom'>('month');
  const [from, setFrom] = useState(monthRange().from);
  const [to, setTo] = useState(monthRange().to);

  const [editing, setEditing] = useState<Partial<Expense> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const effectiveFrom = range === 'all' ? '' : from;
  const effectiveTo = range === 'all' ? '' : to;

  const { data, loading, error, reload } = useApi<{ data: Expense[]; meta: { total: number } }>(
    `/api/expenses${qs({ from: effectiveFrom, to: effectiveTo })}`,
    [effectiveFrom, effectiveTo]
  );

  const rows = data?.data || [];

  const byCategory = rows.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});
  const topCategories = Object.entries(byCategory)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  async function save() {
    if (!editing) return;
    if (!editing.name?.trim()) return toast.push('Keterangan wajib diisi.', 'error');
    if (!editing.amount) return toast.push('Jumlah harus lebih dari 0.', 'error');

    setSaving(true);
    try {
      if (isNew) {
        await api.post('/api/expenses', editing);
        toast.push('Pengeluaran dicatat.');
      } else {
        await api.put(`/api/expenses/${editing.id}`, editing);
        toast.push('Perubahan disimpan.');
      }
      setEditing(null);
      reload();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Gagal menyimpan.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label={range === 'all' ? 'Total pengeluaran' : 'Pengeluaran periode ini'}
          value={rupiah(data?.meta.total || 0)}
          icon="wallet"
          tone="red"
          loading={loading}
        />
        <StatCard
          label="Jumlah catatan"
          value={rows.length}
          hint="Transaksi pengeluaran"
          icon="receipt"
          tone="brand"
          loading={loading}
        />
        <StatCard
          label="Kategori terbesar"
          value={topCategories[0]?.category || '-'}
          hint={topCategories[0] ? rupiah(topCategories[0].total) : 'Belum ada data'}
          icon="chart"
          tone="accent"
          loading={loading}
        />
      </div>

      <Card padded={false}>
        <div className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex rounded-lg bg-slate-100 p-0.5">
            {(
              [
                ['month', 'Bulan ini'],
                ['all', 'Semua'],
                ['custom', 'Kustom'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setRange(key)}
                className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition ${
                  range === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {range === 'custom' && (
            <>
              <Field label="Dari" className="w-40">
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
              </Field>
              <Field label="Sampai" className="w-40">
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
              </Field>
            </>
          )}

          <div className="ml-auto flex gap-2">
            {isOwner && (
              <Button
                variant="outline"
                icon="download"
                onClick={() => window.open('/api/expenses/export/csv', '_blank')}
              >
                Ekspor CSV
              </Button>
            )}
            <Button
              icon="plus"
              onClick={() => {
                setIsNew(true);
                setEditing({ ...EMPTY, date: todayInput() });
              }}
            >
              Catat Pengeluaran
            </Button>
          </div>
        </div>

        {error ? (
          <div className="p-4">
            <ErrorBanner message={error} onRetry={reload} />
          </div>
        ) : loading && !data ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="wallet"
            title="Belum ada pengeluaran"
            description="Catat biaya operasional bengkel agar laba bersih bisa dihitung."
          />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <Th>Tanggal</Th>
                  <Th>Keterangan</Th>
                  <Th>Kategori</Th>
                  <Th>Dicatat oleh</Th>
                  <Th align="right">Jumlah</Th>
                  <Th align="center">Aksi</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <Td className="whitespace-nowrap text-xs text-slate-500">{formatDate(e.date)}</Td>
                    <Td>
                      <span className="block max-w-[24rem] truncate font-medium text-slate-800">
                        {e.name}
                      </span>
                      {e.note && (
                        <span className="block truncate text-[11px] text-slate-400">{e.note}</span>
                      )}
                    </Td>
                    <Td>
                      <Badge tone="slate">{e.category}</Badge>
                    </Td>
                    <Td className="text-xs text-slate-500">{e.userName || '-'}</Td>
                    <Td align="right" className="tabular font-semibold text-red-600">
                      {rupiah(e.amount)}
                    </Td>
                    <Td align="center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => {
                            setIsNew(false);
                            setEditing({
                              ...e,
                              date: e.date ? new Date(e.date).toISOString().slice(0, 10) : '',
                            });
                          }}
                        >
                          Ubah
                        </Button>
                        {isOwner && (
                          <Button size="xs" variant="ghost" onClick={() => setDeleteTarget(e)}>
                            Hapus
                          </Button>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-xs text-slate-500">Total pada periode ini</p>
              <p className="text-base font-bold tabular text-red-600">{rupiah(data?.meta.total || 0)}</p>
            </div>
          </>
        )}
      </Card>

      {topCategories.length > 0 && (
        <Card title="Rincian per kategori">
          <ul className="space-y-2">
            {topCategories.map((c) => (
              <li key={c.category} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="text-slate-600">{c.category}</span>
                <span className="tabular font-medium text-slate-900">{rupiah(c.total)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={isNew ? 'Catat pengeluaran' : 'Ubah pengeluaran'}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Batal
            </Button>
            <Button onClick={save} loading={saving} icon="save">
              Simpan
            </Button>
          </>
        }
      >
        {editing && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Keterangan" required className="sm:col-span-2">
              <Input
                value={editing.name || ''}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="mis. Bayar listrik bengkel"
              />
            </Field>
            <Field label="Kategori">
              <select
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                value={editing.category || 'Lainnya'}
                onChange={(e) => setEditing({ ...editing, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Jumlah" required>
              <NumberInput
                value={editing.amount || 0}
                onChange={(v) => setEditing({ ...editing, amount: v })}
                prefix="Rp"
              />
            </Field>
            <Field label="Tanggal">
              <Input
                type="date"
                value={editing.date || todayInput()}
                onChange={(e) => setEditing({ ...editing, date: e.target.value })}
              />
            </Field>
            <Field label="Catatan">
              <Input
                value={editing.note || ''}
                onChange={(e) => setEditing({ ...editing, note: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await api.del(`/api/expenses/${deleteTarget.id}`);
          toast.push('Pengeluaran dihapus.');
          setDeleteTarget(null);
          reload();
        }}
        message={`Yakin ingin menghapus pengeluaran "${deleteTarget?.name}"?`}
        confirmLabel="Hapus"
      />
    </div>
  );
}
