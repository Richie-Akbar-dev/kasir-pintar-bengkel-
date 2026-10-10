import { useMemo, useState } from 'react';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/useApi';
import { rupiah, number as fmtNumber } from '@/lib/format';
import type { Product, StockMovement } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  LoadingBlock,
  Modal,
  NumberInput,
  Pagination,
  SearchInput,
  Select,
  StatCard,
  Td,
  TableWrap,
  Textarea,
  Th,
  useToast,
} from '@/components/ui';
import { Icon } from '@/components/icons';

const EMPTY: Partial<Product> = {
  code: '',
  name: '',
  category: '',
  unit: 'Pcs',
  costPrice: 0,
  sellPrice: 0,
  stock: 0,
  minStock: 5,
  barcode: '',
  location: '',
  supplier: '',
  notes: '',
  active: true,
};

export default function Sparepart() {
  const { user } = useAuth();
  const toast = useToast();
  const isOwner = user?.role === 'owner';

  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [stockTarget, setStockTarget] = useState<Product | null>(null);
  const [movementsFor, setMovementsFor] = useState<Product | null>(null);

  const { data, loading, error, reload } = useApi<{ data: Product[] }>(
    `/api/products${qs({ q, category, lowStock: lowOnly ? 1 : '' })}`,
    [q, category, lowOnly]
  );

  const products = data?.data || [];

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(),
    [products]
  );

  const stats = useMemo(() => {
    const low = products.filter((p) => p.stock <= p.minStock).length;
    const out = products.filter((p) => p.stock <= 0).length;
    const value = products.reduce((a, p) => a + (p.costPrice || 0) * p.stock, 0);
    const retail = products.reduce((a, p) => a + p.sellPrice * p.stock, 0);
    return { total: products.length, low, out, value, retail };
  }, [products]);

  const paged = useMemo(() => products.slice((page - 1) * 25, page * 25), [products, page]);
  const totalPages = Math.max(1, Math.ceil(products.length / 25));

  async function save() {
    if (!editing) return;
    if (!editing.name?.trim()) return toast.push('Nama sparepart wajib diisi.', 'error');
    if (!editing.sellPrice) return toast.push('Harga jual wajib diisi.', 'error');

    setSaving(true);
    try {
      if (isNew) {
        await api.post('/api/products', editing);
        toast.push('Sparepart ditambahkan.');
      } else {
        await api.put(`/api/products/${editing.id}`, editing);
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

  async function adjustStock(type: 'in' | 'out' | 'set', qty: number, note: string) {
    if (!stockTarget) return;
    try {
      await api.post(`/api/products/${stockTarget.id}/stock`, { type, qty, note });
      toast.push('Stok diperbarui.');
      setStockTarget(null);
      reload();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Gagal memperbarui stok.', 'error');
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Jenis sparepart" value={stats.total} icon="box" tone="brand" loading={loading} />
        <StatCard
          label="Stok menipis"
          value={stats.low}
          hint="Di bawah batas minimum"
          icon="alert"
          tone="accent"
          loading={loading}
        />
        <StatCard
          label="Stok habis"
          value={stats.out}
          hint="Perlu segera dibeli"
          icon="x"
          tone="red"
          loading={loading}
        />
        {isOwner && (
          <StatCard
            label="Nilai stok (modal)"
            value={rupiah(stats.value)}
            hint={`Nilai jual ${rupiah(stats.retail)}`}
            icon="database"
            tone="green"
            loading={loading}
          />
        )}
      </div>

      <Card padded={false}>
        <div className="flex flex-wrap items-end gap-3 p-4">
          <SearchInput
            value={q}
            onChange={(v) => {
              setQ(v);
              setPage(1);
            }}
            placeholder="Cari nama, kode, atau barcode…"
            className="min-w-[220px] flex-1"
          />
          <Field label="Kategori" className="w-48">
            <Select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="h-9"
            >
              <option value="">Semua kategori</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <div className="pb-2">
            <Checkbox
              label="Hanya stok menipis"
              checked={lowOnly}
              onChange={(e) => {
                setLowOnly(e.target.checked);
                setPage(1);
              }}
            />
          </div>
          {isOwner && (
            <Button
              icon="plus"
              onClick={() => {
                setIsNew(true);
                setEditing({ ...EMPTY });
              }}
            >
              Tambah Sparepart
            </Button>
          )}
        </div>

        {error ? (
          <div className="p-4">
            <ErrorBanner message={error} onRetry={reload} />
          </div>
        ) : loading && !data ? (
          <LoadingBlock />
        ) : products.length === 0 ? (
          <EmptyState
            icon="box"
            title="Belum ada sparepart"
            description="Tambahkan data sparepart agar bisa dipilih di menu Kasir."
            action={
              isOwner && (
                <Button
                  icon="plus"
                  onClick={() => {
                    setIsNew(true);
                    setEditing({ ...EMPTY });
                  }}
                >
                  Tambah Sparepart
                </Button>
              )
            }
          />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <Th>Kode</Th>
                  <Th>Nama</Th>
                  <Th>Kategori</Th>
                  <Th align="right">Stok</Th>
                  {isOwner && <Th align="right">Harga Beli</Th>}
                  <Th align="right">Harga Jual</Th>
                  <Th align="center">Aksi</Th>
                </tr>
              </thead>
              <tbody>
                {paged.map((p) => {
                  const low = p.stock <= p.minStock;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <Td className="font-mono text-xs">{p.code}</Td>
                      <Td>
                        <span className="block max-w-[22rem] truncate font-medium text-slate-800">
                          {p.name}
                        </span>
                        {p.location && (
                          <span className="text-[11px] text-slate-400">Rak: {p.location}</span>
                        )}
                      </Td>
                      <Td className="text-xs text-slate-500">{p.category}</Td>
                      <Td align="right">
                        <span className={`font-medium tabular ${low ? 'text-red-600' : ''}`}>
                          {fmtNumber(p.stock)} {p.unit}
                        </span>
                        <span className="block text-[11px] text-slate-400">min {p.minStock}</span>
                      </Td>
                      {isOwner && (
                        <Td align="right" className="tabular text-slate-500">
                          {rupiah(p.costPrice || 0)}
                        </Td>
                      )}
                      <Td align="right" className="tabular font-medium">
                        {rupiah(p.sellPrice)}
                      </Td>
                      <Td align="center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={async () => {
                              const res = await api.get<{ data: Product }>(`/api/products/${p.id}`);
                              setMovementsFor(res.data);
                            }}
                            aria-label="Riwayat stok"
                          >
                            <Icon name="clock" size={14} />
                          </Button>
                          {isOwner && (
                            <>
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => setStockTarget(p)}
                                aria-label="Sesuaikan stok"
                              >
                                <Icon name="refresh" size={14} />
                              </Button>
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => {
                                  setIsNew(false);
                                  setEditing({ ...p });
                                }}
                              >
                                Ubah
                              </Button>
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => setDeleteTarget(p)}
                                aria-label="Hapus"
                              >
                                <Icon name="trash" size={14} />
                              </Button>
                            </>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
            <Pagination page={page} totalPages={totalPages} totalRows={products.length} onPage={setPage} />
          </>
        )}
      </Card>

      {/* ------------------------------ Form ------------------------------ */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={isNew ? 'Tambah sparepart' : 'Ubah sparepart'}
        size="lg"
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
                placeholder="SP-001"
              />
            </Field>
            <Field label="Kategori">
              <Input
                value={editing.category || ''}
                onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                placeholder="mis. Oli & Pelumas"
                list="kategori-list"
              />
            </Field>
            <Field label="Nama sparepart" required className="sm:col-span-2">
              <Input
                value={editing.name || ''}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="mis. Oli Mesin Yamalube 0,8L"
              />
            </Field>
            <Field label="Satuan">
              <Input
                value={editing.unit || ''}
                onChange={(e) => setEditing({ ...editing, unit: e.target.value })}
                placeholder="Pcs / Botol / Set"
              />
            </Field>
            <Field label="Barcode (opsional)">
              <Input
                value={editing.barcode || ''}
                onChange={(e) => setEditing({ ...editing, barcode: e.target.value })}
              />
            </Field>
            <Field label="Harga beli (modal)" required={isOwner}>
              <NumberInput
                value={editing.costPrice || 0}
                onChange={(v) => setEditing({ ...editing, costPrice: v })}
                prefix="Rp"
              />
            </Field>
            <Field label="Harga jual" required>
              <NumberInput
                value={editing.sellPrice || 0}
                onChange={(v) => setEditing({ ...editing, sellPrice: v })}
                prefix="Rp"
              />
            </Field>
            <Field label="Stok awal" hint={isNew ? undefined : 'Ubah lewat tombol penyesuaian stok'}>
              <NumberInput
                value={editing.stock || 0}
                onChange={(v) => setEditing({ ...editing, stock: v })}
                disabled={!isNew}
              />
            </Field>
            <Field label="Batas minimum stok">
              <NumberInput
                value={editing.minStock || 0}
                onChange={(v) => setEditing({ ...editing, minStock: v })}
              />
            </Field>
            <Field label="Lokasi / rak">
              <Input
                value={editing.location || ''}
                onChange={(e) => setEditing({ ...editing, location: e.target.value })}
              />
            </Field>
            <Field label="Supplier">
              <Input
                value={editing.supplier || ''}
                onChange={(e) => setEditing({ ...editing, supplier: e.target.value })}
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
              <Checkbox
                label="Aktif (tampil di menu Kasir)"
                checked={editing.active !== false}
                onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
              />
            </div>
          </div>
        )}
        <datalist id="kategori-list">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Modal>

      {/* --------------------------- Penyesuaian stok --------------------------- */}
      <StockModal product={stockTarget} onClose={() => setStockTarget(null)} onSave={adjustStock} />

      {/* ------------------------------ Riwayat ------------------------------ */}
      <Modal
        open={!!movementsFor}
        onClose={() => setMovementsFor(null)}
        title={`Riwayat stok — ${movementsFor?.name || ''}`}
        size="md"
      >
        {movementsFor && <MovementList movements={movementsFor.movements || []} />}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await api.del(`/api/products/${deleteTarget.id}`);
          toast.push('Sparepart dihapus.');
          setDeleteTarget(null);
          reload();
        }}
        title="Hapus sparepart"
        message={`Yakin ingin menghapus "${deleteTarget?.name}"? Tindakan ini tidak bisa dibatalkan.`}
        confirmLabel="Hapus"
      />
    </div>
  );
}

/* ============================ Modal stok ============================ */

function StockModal({
  product,
  onClose,
  onSave,
}: {
  product: Product | null;
  onClose: () => void;
  onSave: (type: 'in' | 'out' | 'set', qty: number, note: string) => Promise<void>;
}) {
  const [type, setType] = useState<'in' | 'out' | 'set'>('in');
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  if (!product) return null;

  const labels = { in: 'Barang masuk (+) ', out: 'Barang keluar (−)', set: 'Setel stok (opname)' };

  return (
    <Modal
      open={!!product}
      onClose={onClose}
      title="Penyesuaian stok"
      subtitle={`${product.name} · stok saat ini ${product.stock} ${product.unit}`}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onSave(type, qty, note);
                setQty(1);
                setNote('');
              } finally {
                setBusy(false);
              }
            }}
          >
            Simpan
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Jenis penyesuaian">
          <Select value={type} onChange={(e) => setType(e.target.value as 'in' | 'out' | 'set')}>
            <option value="in">{labels.in}</option>
            <option value="out">{labels.out}</option>
            <option value="set">{labels.set}</option>
          </Select>
        </Field>
        <Field
          label={type === 'set' ? 'Stok sebenarnya' : 'Jumlah'}
          hint={type === 'out' ? `Maksimal ${product.stock}` : undefined}
        >
          <NumberInput value={qty} onChange={setQty} />
        </Field>
        <Field label="Keterangan">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="mis. pembelian dari supplier / stok opname"
          />
        </Field>
        {type === 'set' && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Selisih sebesar <b>{Math.abs(qty - product.stock)}</b> akan dicatat sebagai penyesuaian.
          </p>
        )}
      </div>
    </Modal>
  );
}

function MovementList({ movements }: { movements: StockMovement[] }) {
  if (!movements.length)
    return <p className="py-8 text-center text-sm text-slate-400">Belum ada pergerakan stok.</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {movements.map((m) => (
        <li key={m.id} className="flex items-center gap-3 py-2.5">
          <Badge tone={m.type === 'in' ? 'green' : 'red'}>{m.type === 'in' ? 'Masuk' : 'Keluar'}</Badge>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] text-slate-700">{m.note || '-'}</p>
            <p className="text-[11px] text-slate-400">
              {new Date(m.createdAt).toLocaleString('id-ID')}
              {m.refCode ? ` · ${m.refCode}` : ''}
            </p>
          </div>
          <span className="tabular text-[13px] font-medium">
            {m.type === 'in' ? '+' : '-'}
            {m.qty}
          </span>
        </li>
      ))}
    </ul>
  );
}
