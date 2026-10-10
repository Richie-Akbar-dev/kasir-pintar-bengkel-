import { useMemo, useState } from 'react';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/useApi';
import { rupiah } from '@/lib/format';
import type { Product, Service } from '@/lib/types';
import {
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
  SearchInput,
  Select,
  StatCard,
  Td,
  TableWrap,
  Textarea,
  Th,
  useToast,
} from '@/components/ui';

const EMPTY: Partial<Service> = {
  code: '',
  name: '',
  category: '',
  price: 0,
  durationMin: 30,
  notes: '',
  active: true,
};

export default function JasaServis() {
  const { user } = useAuth();
  const toast = useToast();
  const isOwner = user?.role === 'owner';

  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [editing, setEditing] = useState<Partial<Service> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [newCategory, setNewCategory] = useState('');

  const { data, loading, error, reload } = useApi<{ data: Service[] }>(
    `/api/services${qs({ q, category })}`,
    [q, category]
  );
  const categories = useApi<{ data: string[] }>('/api/service-categories');
  const productCats = useApi<{ data: Product[] }>('/api/products');

  const services = data?.data || [];

  const stats = useMemo(() => {
    const avg = services.length
      ? Math.round(services.reduce((a, s) => a + s.price, 0) / services.length)
      : 0;
    const totalMin = services.reduce((a, s) => a + (s.durationMin || 0), 0);
    return { total: services.length, avg, totalMin };
  }, [services]);

  async function save() {
    if (!editing) return;
    if (!editing.name?.trim()) return toast.push('Nama jasa wajib diisi.', 'error');
    if (!editing.price) return toast.push('Harga jasa wajib diisi.', 'error');

    setSaving(true);
    try {
      if (isNew) {
        await api.post('/api/services', editing);
        toast.push('Jasa servis ditambahkan.');
      } else {
        await api.put(`/api/services/${editing.id}`, editing);
        toast.push('Perubahan disimpan.');
      }
      setEditing(null);
      reload();
      categories.reload();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Gagal menyimpan.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function addCategory() {
    const name = newCategory.trim();
    if (!name) return;
    try {
      await api.post('/api/service-categories', { name });
      toast.push(`Kategori "${name}" ditambahkan.`);
      setNewCategory('');
      categories.reload();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Gagal menambah kategori.', 'error');
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Jenis jasa servis" value={stats.total} icon="wrench" tone="brand" loading={loading} />
        <StatCard
          label="Rata-rata harga"
          value={rupiah(stats.avg)}
          hint="Per jenis layanan"
          icon="cash"
          tone="accent"
          loading={loading}
        />
        <StatCard
          label="Total estimasi durasi"
          value={`${Math.floor(stats.totalMin / 60)}j ${stats.totalMin % 60}m`}
          hint="Jika semua dikerjakan"
          icon="clock"
          tone="violet"
          loading={loading}
        />
      </div>

      <Card padded={false}>
        <div className="flex flex-wrap items-end gap-3 p-4">
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Cari nama atau kode jasa…"
            className="min-w-[220px] flex-1"
          />
          <Field label="Kategori" className="w-52">
            <Select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9">
              <option value="">Semua kategori</option>
              {(categories.data?.data || []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          {isOwner && (
            <Button
              icon="plus"
              onClick={() => {
                setIsNew(true);
                setEditing({ ...EMPTY });
              }}
            >
              Tambah Jasa
            </Button>
          )}
        </div>

        {error ? (
          <div className="p-4">
            <ErrorBanner message={error} onRetry={reload} />
          </div>
        ) : loading && !data ? (
          <LoadingBlock />
        ) : services.length === 0 ? (
          <EmptyState
            icon="wrench"
            title="Belum ada jasa servis"
            description="Tambahkan layanan seperti ganti oli, servis CVT, dll."
            action={
              isOwner && (
                <Button
                  icon="plus"
                  onClick={() => {
                    setIsNew(true);
                    setEditing({ ...EMPTY });
                  }}
                >
                  Tambah Jasa
                </Button>
              )
            }
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Kode</Th>
                <Th>Nama layanan</Th>
                <Th>Kategori</Th>
                <Th align="right">Estimasi</Th>
                <Th align="right">Harga</Th>
                {isOwner && <Th align="center">Aksi</Th>}
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <Td className="font-mono text-xs">{s.code}</Td>
                  <Td>
                    <span className="block max-w-[26rem] truncate font-medium text-slate-800">
                      {s.name}
                    </span>
                    {s.notes && <span className="text-[11px] text-slate-400">{s.notes}</span>}
                  </Td>
                  <Td className="text-xs text-slate-500">{s.category}</Td>
                  <Td align="right" className="text-xs text-slate-500">
                    {s.durationMin ? `${s.durationMin} menit` : '-'}
                  </Td>
                  <Td align="right" className="tabular font-semibold">
                    {rupiah(s.price)}
                  </Td>
                  {isOwner && (
                    <Td align="center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => {
                            setIsNew(false);
                            setEditing({ ...s });
                          }}
                        >
                          Ubah
                        </Button>
                        <Button size="xs" variant="ghost" onClick={() => setDeleteTarget(s)}>
                          Hapus
                        </Button>
                      </div>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      {isOwner && (
        <Card title="Kategori jasa" subtitle="Kategori dipakai untuk mengelompokkan layanan di menu Kasir">
          <div className="flex flex-wrap gap-2">
            {(categories.data?.data || []).map((c) => (
              <span
                key={c}
                className="group inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-3 pr-1.5 text-[12px] text-slate-700"
              >
                {c}
                <button
                  onClick={async () => {
                    await api.del(`/api/service-categories/${encodeURIComponent(c)}`);
                    categories.reload();
                  }}
                  className="rounded-full p-0.5 text-slate-400 transition hover:bg-red-100 hover:text-red-600"
                  aria-label={`Hapus ${c}`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-end gap-2">
            <Field label="Tambah kategori" className="flex-1">
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="mis. Servis Berkala"
                list="produk-kategori"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCategory();
                  }
                }}
              />
            </Field>
            <Button variant="outline" icon="plus" onClick={addCategory}>
              Tambah
            </Button>
          </div>
          <datalist id="produk-kategori">
            {[...new Set((productCats.data?.data || []).map((p) => p.category))].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Card>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={isNew ? 'Tambah jasa servis' : 'Ubah jasa servis'}
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
            <Field label="Kode" hint="Kosongkan untuk kode otomatis">
              <Input
                value={editing.code || ''}
                onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                placeholder="JS-001"
              />
            </Field>
            <Field label="Kategori">
              <Input
                value={editing.category || ''}
                onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                list="kategori-jasa-list"
                placeholder="mis. Servis Berkala"
              />
            </Field>
            <Field label="Nama layanan" required className="sm:col-span-2">
              <Input
                value={editing.name || ''}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="mis. Servis Ringan Motor"
              />
            </Field>
            <Field label="Harga" required>
              <NumberInput
                value={editing.price || 0}
                onChange={(v) => setEditing({ ...editing, price: v })}
                prefix="Rp"
              />
            </Field>
            <Field label="Estimasi durasi (menit)">
              <NumberInput
                value={editing.durationMin || 0}
                onChange={(v) => setEditing({ ...editing, durationMin: v })}
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
                Aktif (tampil di menu Kasir)
              </label>
            </div>
          </div>
        )}
        <datalist id="kategori-jasa-list">
          {(categories.data?.data || []).map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await api.del(`/api/services/${deleteTarget.id}`);
          toast.push('Jasa servis dihapus.');
          setDeleteTarget(null);
          reload();
        }}
        message={`Yakin ingin menghapus "${deleteTarget?.name}"?`}
        confirmLabel="Hapus"
      />
    </div>
  );
}
