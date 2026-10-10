import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/useApi';
import { rupiah, formatDateTime, relativeDay } from '@/lib/format';
import { WO_STATUS_LABELS, type Customer, type Mechanic, type WoStatus, type WorkOrder } from '@/lib/types';
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
  SearchInput,
  Select,
  StatCard,
  Textarea,
  useToast,
} from '@/components/ui';
import { Icon } from '@/components/icons';

const STATUSES: WoStatus[] = ['menunggu', 'dikerjakan', 'selesai', 'diambil'];

const STATUS_TONE: Record<WoStatus, string> = {
  menunggu: 'amber',
  dikerjakan: 'blue',
  selesai: 'green',
  diambil: 'slate',
};

const NEXT_STATUS: Partial<Record<WoStatus, WoStatus>> = {
  menunggu: 'dikerjakan',
  dikerjakan: 'selesai',
  selesai: 'diambil',
};

const EMPTY: Partial<WorkOrder> = {
  customerName: '',
  customerPhone: '',
  plateNumber: '',
  vehicleLabel: '',
  complaint: '',
  diagnosis: '',
  mechanicName: '',
  estimatedCost: 0,
  odometer: null,
  status: 'menunggu',
};

export default function WorkOrderPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const isOwner = user?.role === 'owner';

  const [status, setStatus] = useState<WoStatus | 'all'>('all');
  const [q, setQ] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [isNew, setIsNew] = useState(true);
  const [form, setForm] = useState<Partial<WorkOrder>>({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState<WorkOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkOrder | null>(null);

  const { data, loading, error, reload } = useApi<{
    data: WorkOrder[];
    meta: { counts: Record<string, number> };
  }>(`/api/work-orders${qs({ status: status === 'all' ? '' : status, q })}`, [status, q]);

  const mechanics = useApi<{ data: Mechanic[] }>('/api/mechanics');
  const customers = useApi<{ data: Customer[] }>('/api/customers');

  const orders = useMemo(
    () => [...(data?.data || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [data]
  );
  const counts = data?.meta.counts || {};

  function openCreate() {
    setIsNew(true);
    setForm({ ...EMPTY });
    setFormOpen(true);
  }

  async function save() {
    if (!form.customerName?.trim()) return toast.push('Nama pelanggan wajib diisi.', 'error');
    if (!form.complaint?.trim()) return toast.push('Keluhan/permintaan wajib diisi.', 'error');

    setSaving(true);
    try {
      const payload = {
        ...form,
        customerId: form.customerId || null,
        vehicleId: form.vehicleId || null,
        mechanicId: form.mechanicId || null,
      };
      if (isNew) {
        await api.post('/api/work-orders', payload);
        toast.push('Work order dibuat.');
      } else if (form.id) {
        await api.put(`/api/work-orders/${form.id}`, payload);
        toast.push('Work order diperbarui.');
      }
      setFormOpen(false);
      reload();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Gagal menyimpan.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(order: WorkOrder, next: WoStatus) {
    try {
      await api.post(`/api/work-orders/${order.id}/status`, { status: next });
      toast.push(`${order.code} → ${WO_STATUS_LABELS[next]}`);
      reload();
      if (detail?.id === order.id) setDetail({ ...detail, status: next });
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Gagal mengubah status.', 'error');
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setStatus(status === s ? 'all' : s)}>
            <StatCard
              label={WO_STATUS_LABELS[s]}
              value={counts[s] || 0}
              icon={
                s === 'menunggu' ? 'clock' : s === 'dikerjakan' ? 'wrench' : s === 'selesai' ? 'check' : 'car'
              }
              tone={
                s === 'menunggu' ? 'accent' : s === 'dikerjakan' ? 'brand' : s === 'selesai' ? 'green' : 'slate'
              }
              loading={loading}
            />
          </button>
        ))}
      </div>

      <Card padded={false}>
        <div className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex rounded-lg bg-slate-100 p-0.5">
            {(['all', ...STATUSES] as const).map((key) => (
              <button
                key={key}
                onClick={() => setStatus(key)}
                className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition ${
                  status === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {key === 'all' ? 'Semua' : WO_STATUS_LABELS[key]}
              </button>
            ))}
          </div>
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Cari SPK, pelanggan, atau plat…"
            className="min-w-[220px] flex-1"
          />
          <Button icon="plus" onClick={openCreate}>
            Buat Work Order
          </Button>
        </div>

        {error ? (
          <div className="p-4">
            <ErrorBanner message={error} onRetry={reload} />
          </div>
        ) : loading && !data ? (
          <LoadingBlock />
        ) : orders.length === 0 ? (
          <EmptyState
            icon="clipboard"
            title="Belum ada work order"
            description="Buat SPK untuk mencatat kendaraan yang sedang dikerjakan."
            action={
              <Button icon="plus" onClick={openCreate}>
                Buat Work Order
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {orders.map((o) => (
              <article
                key={o.id}
                className="animate-fade-in rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-sm"
              >
                <header className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] text-slate-400">{o.code}</p>
                    <h3 className="truncate text-[14px] font-semibold text-slate-900">
                      {o.plateNumber || 'Tanpa plat'}
                    </h3>
                  </div>
                  <Badge tone={STATUS_TONE[o.status]}>{WO_STATUS_LABELS[o.status]}</Badge>
                </header>

                <p className="truncate text-[13px] font-medium text-slate-700">{o.customerName}</p>
                <p className="truncate text-[11px] text-slate-500">
                  {o.vehicleLabel || '-'}
                  {o.odometer ? ` · ${o.odometer.toLocaleString('id-ID')} km` : ''}
                </p>

                <p className="mt-2 line-clamp-2 rounded-lg bg-slate-50 px-2.5 py-2 text-[12px] text-slate-600">
                  {o.complaint}
                </p>

                <dl className="mt-2.5 flex items-center justify-between text-[12px]">
                  <dt className="flex items-center gap-1.5 text-slate-500">
                    <Icon name="user" size={13} /> {o.mechanicName || 'Belum ditentukan'}
                  </dt>
                  <dd className="tabular font-semibold text-slate-800">
                    {o.estimatedCost ? rupiah(o.estimatedCost) : '-'}
                  </dd>
                </dl>

                <p className="mt-1 text-[11px] text-slate-400">{relativeDay(o.date)}</p>

                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
                  <Button size="xs" variant="ghost" onClick={() => setDetail(o)}>
                    Detail
                  </Button>
                  {NEXT_STATUS[o.status] && (
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => changeStatus(o, NEXT_STATUS[o.status] as WoStatus)}
                    >
                      {o.status === 'menunggu' ? 'Mulai' : o.status === 'dikerjakan' ? 'Selesai' : 'Sudah diambil'}
                    </Button>
                  )}
                  {o.status !== 'diambil' && (
                    <Button
                      size="xs"
                      variant="accent"
                      icon="cart"
                      onClick={() => navigate(`/kasir?wo=${o.id}`)}
                    >
                      Ke Kasir
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>

      {/* ------------------------------ Form ------------------------------ */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={isNew ? 'Buat work order baru' : 'Ubah work order'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Batal
            </Button>
            <Button onClick={save} loading={saving} icon="save">
              Simpan
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Pelanggan" className="sm:col-span-2" hint="Pilih pelanggan terdaftar atau ketik manual">
            <div className="flex gap-2">
              <Select
                className="flex-1"
                value={form.customerId || ''}
                onChange={(e) => {
                  const c = (customers.data?.data || []).find((x) => x.id === e.target.value);
                  setForm({
                    ...form,
                    customerId: c?.id || '',
                    customerName: c?.name || '',
                    customerPhone: c?.phone || '',
                  });
                }}
              >
                <option value="">— Pelanggan umum / ketik manual —</option>
                {(customers.data?.data || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.phone}
                  </option>
                ))}
              </Select>
            </div>
          </Field>

          <Field label="Nama pelanggan" required>
            <Input
              value={form.customerName || ''}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
            />
          </Field>
          <Field label="Nomor HP">
            <Input
              value={form.customerPhone || ''}
              onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
            />
          </Field>
          <Field label="Nomor polisi">
            <Input
              value={form.plateNumber || ''}
              onChange={(e) => setForm({ ...form, plateNumber: e.target.value.toUpperCase() })}
              placeholder="W 1234 AB"
            />
          </Field>
          <Field label="Jenis kendaraan">
            <Input
              value={form.vehicleLabel || ''}
              onChange={(e) => setForm({ ...form, vehicleLabel: e.target.value })}
              placeholder="Honda Vario 125 (2019)"
            />
          </Field>
          <Field label="Keluhan / permintaan" required className="sm:col-span-2">
            <Textarea
              rows={2}
              value={form.complaint || ''}
              onChange={(e) => setForm({ ...form, complaint: e.target.value })}
              placeholder="mis. Mesin brebet, rem belakang berbunyi"
            />
          </Field>
          <Field label="Diagnosis / temuan" className="sm:col-span-2">
            <Textarea
              rows={2}
              value={form.diagnosis || ''}
              onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
            />
          </Field>
          <Field label="Mekanik">
            <Select
              value={form.mechanicId || ''}
              onChange={(e) => {
                const m = (mechanics.data?.data || []).find((x) => x.id === e.target.value);
                setForm({ ...form, mechanicId: e.target.value, mechanicName: m?.name || '' });
              }}
            >
              <option value="">— Belum ditentukan —</option>
              {(mechanics.data?.data || [])
                .filter((m) => m.active !== false)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Estimasi biaya">
            <NumberInput
              value={form.estimatedCost || 0}
              onChange={(v) => setForm({ ...form, estimatedCost: v })}
              prefix="Rp"
            />
          </Field>
          <Field label="Kilometer (odometer)">
            <NumberInput
              value={form.odometer || 0}
              onChange={(v) => setForm({ ...form, odometer: v })}
            />
          </Field>
          <Field label="Status">
            <Select
              value={form.status || 'menunggu'}
              onChange={(e) => setForm({ ...form, status: e.target.value as WoStatus })}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {WO_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>

      {/* ------------------------------ Detail ------------------------------ */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.code} — ${detail.plateNumber || 'Tanpa plat'}` : ''}
        subtitle={detail ? formatDateTime(detail.date) : ''}
        size="md"
        footer={
          detail && (
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                {isOwner && detail.status !== 'diambil' && (
                  <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(detail)}>
                    Hapus
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  icon="edit"
                  onClick={() => {
                    setIsNew(false);
                    setForm({ ...detail });
                    setDetail(null);
                    setFormOpen(true);
                  }}
                >
                  Ubah
                </Button>
              </div>
              <div className="flex gap-2">
                {NEXT_STATUS[detail.status] && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => changeStatus(detail, NEXT_STATUS[detail.status] as WoStatus)}
                  >
                    {WO_STATUS_LABELS[NEXT_STATUS[detail.status] as WoStatus]}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="accent"
                  icon="cart"
                  onClick={() => navigate(`/kasir?wo=${detail.id}`)}
                >
                  Proses ke Kasir
                </Button>
              </div>
            </div>
          )
        }
      >
        {detail && (
          <div className="space-y-4 text-[13px]">
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3">
              <Meta label="Pelanggan" value={detail.customerName} />
              <Meta label="Kontak" value={detail.customerPhone || '-'} />
              <Meta label="Kendaraan" value={detail.vehicleLabel || '-'} />
              <Meta
                label="Odometer"
                value={detail.odometer ? `${detail.odometer.toLocaleString('id-ID')} km` : '-'}
              />
              <Meta label="Mekanik" value={detail.mechanicName || '-'} />
              <Meta label="Estimasi" value={detail.estimatedCost ? rupiah(detail.estimatedCost) : '-'} />
            </div>

            <div>
              <p className="mb-1 font-medium text-slate-800">Keluhan</p>
              <p className="rounded-lg border border-slate-200 p-2.5 text-slate-600">{detail.complaint}</p>
            </div>
            {detail.diagnosis && (
              <div>
                <p className="mb-1 font-medium text-slate-800">Diagnosis</p>
                <p className="rounded-lg border border-slate-200 p-2.5 text-slate-600">{detail.diagnosis}</p>
              </div>
            )}

            {(detail.items || []).length > 0 && (
              <div>
                <p className="mb-1 font-medium text-slate-800">Item pekerjaan</p>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {detail.items.map((it, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 px-2.5 py-2">
                      <span className="min-w-0">
                        <span className="block truncate text-slate-700">{it.name}</span>
                        <span className="text-[11px] text-slate-400">
                          {it.qty} {it.unit} × {rupiah(it.price)}
                        </span>
                      </span>
                      <span className="tabular font-medium">{rupiah(it.price * it.qty)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {detail.transactionCode && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800">
                Sudah ditagihkan pada transaksi <b>{detail.transactionCode}</b>.
              </p>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await api.del(`/api/work-orders/${deleteTarget.id}`);
          toast.push('Work order dihapus.');
          setDeleteTarget(null);
          setDetail(null);
          reload();
        }}
        message={`Yakin ingin menghapus work order ${deleteTarget?.code}?`}
        confirmLabel="Hapus"
      />
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="truncate font-medium text-slate-800">{value}</p>
    </div>
  );
}
