import { useState } from 'react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { rupiah } from '@/lib/format';
import type { Mechanic } from '@/lib/types';
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
  Textarea,
  Th,
  useToast,
} from '@/components/ui';

const EMPTY: Partial<Mechanic> = { name: '', phone: '', sharePercent: 40, notes: '', active: true };

export default function Mekanik() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi<{ data: Mechanic[] }>('/api/mechanics');
  const performance = useApi<{
    data: Array<{
      mechanicId: string;
      name: string;
      sharePercent: number;
      jobCount: number;
      revenue: number;
      commission: number;
    }>;
  }>('/api/reports/mechanics');

  const [editing, setEditing] = useState<Partial<Mechanic> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Mechanic | null>(null);

  const mechanics = data?.data || [];
  const perfById = new Map((performance.data?.data || []).map((p) => [p.mechanicId, p]));

  async function save() {
    if (!editing) return;
    if (!editing.name?.trim()) return toast.push('Nama mekanik wajib diisi.', 'error');
    setSaving(true);
    try {
      if (isNew) {
        await api.post('/api/mechanics', editing);
        toast.push('Mekanik ditambahkan.');
      } else {
        await api.put(`/api/mechanics/${editing.id}`, editing);
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
        <StatCard label="Jumlah mekanik" value={mechanics.length} icon="user" tone="brand" loading={loading} />
        <StatCard
          label="Total omzet dari mekanik"
          value={rupiah((performance.data?.data || []).reduce((a, p) => a + p.revenue, 0))}
          hint="Bulan berjalan"
          icon="chart"
          tone="green"
          loading={performance.loading}
        />
        <StatCard
          label="Total komisi (bagi hasil)"
          value={rupiah((performance.data?.data || []).reduce((a, p) => a + p.commission, 0))}
          hint="Estimasi yang harus dibayarkan"
          icon="wallet"
          tone="accent"
          loading={performance.loading}
        />
      </div>

      <Card
        title="Data mekanik"
        subtitle="Bagi hasil dipakai untuk menghitung estimasi komisi pada laporan"
        padded={false}
        action={
          <div className="p-3">
            <Button
              size="sm"
              icon="plus"
              onClick={() => {
                setIsNew(true);
                setEditing({ ...EMPTY });
              }}
            >
              Tambah Mekanik
            </Button>
          </div>
        }
      >
        {error ? (
          <div className="p-4">
            <ErrorBanner message={error} onRetry={reload} />
          </div>
        ) : loading && !data ? (
          <LoadingBlock />
        ) : mechanics.length === 0 ? (
          <EmptyState
            icon="user"
            title="Belum ada mekanik"
            description="Tambahkan mekanik untuk mencatat siapa yang mengerjakan tiap pekerjaan."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Nama</Th>
                <Th>Kontak</Th>
                <Th align="right">Bagi hasil</Th>
                <Th align="right">Pekerjaan (bulan ini)</Th>
                <Th align="right">Omzet</Th>
                <Th align="right">Estimasi komisi</Th>
                <Th>Status</Th>
                <Th align="center">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {mechanics.map((m) => {
                const perf = perfById.get(m.id);
                return (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <Td className="font-medium text-slate-800">{m.name}</Td>
                    <Td className="text-xs text-slate-500">{m.phone || '-'}</Td>
                    <Td align="right" className="tabular">
                      {m.sharePercent || 0}%
                    </Td>
                    <Td align="right" className="tabular text-xs text-slate-500">
                      {perf?.jobCount || 0}
                    </Td>
                    <Td align="right" className="tabular">
                      {rupiah(perf?.revenue || 0)}
                    </Td>
                    <Td align="right" className="tabular font-medium text-emerald-600">
                      {rupiah(perf?.commission || 0)}
                    </Td>
                    <Td>
                      <Badge tone={m.active === false ? 'red' : 'green'}>
                        {m.active === false ? 'Nonaktif' : 'Aktif'}
                      </Badge>
                    </Td>
                    <Td align="center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => {
                            setIsNew(false);
                            setEditing({ ...m });
                          }}
                        >
                          Ubah
                        </Button>
                        <Button size="xs" variant="ghost" onClick={() => setDeleteTarget(m)}>
                          Hapus
                        </Button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={isNew ? 'Tambah mekanik' : 'Ubah mekanik'}
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
            <Field label="Nama mekanik" required className="sm:col-span-2">
              <Input
                value={editing.name || ''}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </Field>
            <Field label="Nomor HP">
              <Input
                value={editing.phone || ''}
                onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
              />
            </Field>
            <Field label="Bagi hasil (%)" hint="Persentase omzet jasa yang menjadi hak mekanik">
              <NumberInput
                value={editing.sharePercent || 0}
                onChange={(v) => setEditing({ ...editing, sharePercent: Math.min(100, v) })}
              />
            </Field>
            <Field label="Catatan" className="sm:col-span-2">
              <Textarea
                rows={2}
                value={editing.notes || ''}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
              />
            </Field>
            <div className="sm:col-span-2">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-brand-600"
                  checked={editing.active !== false}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                />
                Aktif
              </label>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await api.del(`/api/mechanics/${deleteTarget.id}`);
          toast.push('Mekanik dihapus.');
          setDeleteTarget(null);
          reload();
        }}
        message={`Yakin ingin menghapus mekanik "${deleteTarget?.name}"?`}
        confirmLabel="Hapus"
      />
    </div>
  );
}
