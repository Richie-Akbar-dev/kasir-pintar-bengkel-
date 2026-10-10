import { useState } from 'react';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/useApi';
import { rupiah, formatDate } from '@/lib/format';
import type { Customer, Vehicle } from '@/lib/types';
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

const EMPTY_CUSTOMER: Partial<Customer> = { name: '', phone: '', address: '', notes: '' };
const EMPTY_VEHICLE: Partial<Vehicle> = {
  plateNumber: '',
  brand: '',
  model: '',
  year: null,
  type: 'Motor',
  notes: '',
};

export default function Pelanggan() {
  const { user } = useAuth();
  const toast = useToast();
  const isOwner = user?.role === 'owner';

  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Partial<Customer> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const [detail, setDetail] = useState<Customer | null>(null);
  const [vehicleForm, setVehicleForm] = useState<{ customerId: string; data: Partial<Vehicle> } | null>(
    null
  );
  const [deleteVehicle, setDeleteVehicle] = useState<{ customerId: string; vehicle: Vehicle } | null>(
    null
  );

  const { data, loading, error, reload } = useApi<{ data: Customer[] }>(
    `/api/customers${qs({ q })}`,
    [q]
  );

  const customers = data?.data || [];

  const stats = {
    total: customers.length,
    vehicles: customers.reduce((a, c) => a + (c.vehicleCount || 0), 0),
    spend: customers.reduce((a, c) => a + (c.totalSpend || 0), 0),
  };

  async function saveCustomer() {
    if (!editing) return;
    if (!editing.name?.trim()) return toast.push('Nama pelanggan wajib diisi.', 'error');
    if (!editing.phone?.trim()) return toast.push('Nomor HP wajib diisi.', 'error');

    setSaving(true);
    try {
      if (isNew) {
        await api.post('/api/customers', editing);
        toast.push('Pelanggan ditambahkan.');
      } else {
        await api.put(`/api/customers/${editing.id}`, editing);
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

  async function saveVehicle() {
    if (!vehicleForm) return;
    if (!vehicleForm.data.plateNumber?.trim())
      return toast.push('Nomor polisi wajib diisi.', 'error');

    try {
      if (vehicleForm.data.id) {
        await api.put(`/api/customers/vehicles/${vehicleForm.data.id}`, vehicleForm.data);
        toast.push('Kendaraan diperbarui.');
      } else {
        await api.post(`/api/customers/${vehicleForm.customerId}/vehicles`, vehicleForm.data);
        toast.push('Kendaraan ditambahkan.');
      }
      setVehicleForm(null);
      reload();
      if (detail) {
        const res = await api.get<{ data: Customer }>(`/api/customers/${detail.id}`);
        setDetail(res.data);
      }
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Gagal menyimpan kendaraan.', 'error');
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total pelanggan" value={stats.total} icon="users" tone="brand" loading={loading} />
        <StatCard label="Kendaraan terdaftar" value={stats.vehicles} icon="car" tone="violet" loading={loading} />
        <StatCard
          label="Total belanja"
          value={rupiah(stats.spend)}
          hint="Akumulasi seluruh transaksi"
          icon="cash"
          tone="green"
          loading={loading}
        />
      </div>

      <Card padded={false}>
        <div className="flex flex-wrap items-end gap-3 p-4">
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Cari nama, HP, atau alamat…"
            className="min-w-[240px] flex-1"
          />
          <Button
            icon="plus"
            onClick={() => {
              setIsNew(true);
              setEditing({ ...EMPTY_CUSTOMER });
            }}
          >
            Tambah Pelanggan
          </Button>
        </div>

        {error ? (
          <div className="p-4">
            <ErrorBanner message={error} onRetry={reload} />
          </div>
        ) : loading && !data ? (
          <LoadingBlock />
        ) : customers.length === 0 ? (
          <EmptyState
            icon="users"
            title="Belum ada pelanggan"
            description="Data pelanggan memudahkan Anda melihat riwayat servis kendaraan."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Nama</Th>
                <Th>Kontak</Th>
                <Th>Kendaraan</Th>
                <Th>Transaksi</Th>
                <Th align="right">Total belanja</Th>
                <Th>Terakhir servis</Th>
                <Th align="center">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <Td>
                    <span className="block max-w-[14rem] truncate font-medium text-slate-800">
                      {c.name}
                    </span>
                    {c.address && (
                      <span className="block max-w-[14rem] truncate text-[11px] text-slate-400">
                        {c.address}
                      </span>
                    )}
                  </Td>
                  <Td className="text-xs text-slate-500">{c.phone}</Td>
                  <Td>
                    <Badge tone="blue">{c.vehicleCount || 0} unit</Badge>
                  </Td>
                  <Td className="tabular text-xs text-slate-500">{c.transactionCount || 0}x</Td>
                  <Td align="right" className="tabular font-medium">
                    {rupiah(c.totalSpend || 0)}
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-slate-500">
                    {c.lastVisit ? formatDate(c.lastVisit) : '-'}
                  </Td>
                  <Td align="center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={async () => {
                          const res = await api.get<{ data: Customer }>(`/api/customers/${c.id}`);
                          setDetail(res.data);
                        }}
                      >
                        Detail
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => {
                          setIsNew(false);
                          setEditing({ ...c });
                        }}
                      >
                        Ubah
                      </Button>
                      {isOwner && (
                        <Button size="xs" variant="ghost" onClick={() => setDeleteTarget(c)}>
                          <Icon name="trash" size={14} />
                        </Button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      {/* --------------------------- Form pelanggan --------------------------- */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={isNew ? 'Tambah pelanggan' : 'Ubah pelanggan'}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Batal
            </Button>
            <Button onClick={saveCustomer} loading={saving} icon="save">
              Simpan
            </Button>
          </>
        }
      >
        {editing && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nama" required className="sm:col-span-2">
              <Input
                value={editing.name || ''}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="Nama lengkap pelanggan"
              />
            </Field>
            <Field label="Nomor HP / WhatsApp" required>
              <Input
                value={editing.phone || ''}
                onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                placeholder="0812-xxxx-xxxx"
              />
            </Field>
            <Field label="Alamat">
              <Input
                value={editing.address || ''}
                onChange={(e) => setEditing({ ...editing, address: e.target.value })}
              />
            </Field>
            <Field label="Catatan" className="sm:col-span-2">
              <Textarea
                rows={2}
                value={editing.notes || ''}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Modal>

      {/* ------------------------------ Detail ------------------------------ */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.name || ''}
        subtitle={detail ? `${detail.phone}${detail.address ? ` · ${detail.address}` : ''}` : ''}
        size="lg"
        footer={
          detail && (
            <Button
              size="sm"
              icon="plus"
              onClick={() => setVehicleForm({ customerId: detail.id, data: { ...EMPTY_VEHICLE } })}
            >
              Tambah Kendaraan
            </Button>
          )
        }
      >
        {detail && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="Transaksi" value={`${detail.transactionCount || 0}x`} />
              <MiniStat label="Total belanja" value={rupiah(detail.totalSpend || 0)} />
              <MiniStat
                label="Terakhir servis"
                value={detail.lastVisit ? formatDate(detail.lastVisit) : '-'}
              />
            </div>

            <div>
              <h3 className="mb-2 text-[13px] font-semibold text-slate-800">Kendaraan</h3>
              {(detail.vehicles || []).length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">
                  Belum ada kendaraan terdaftar.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {(detail.vehicles || []).map((v) => (
                    <li key={v.id} className="flex items-center gap-3 px-3 py-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                        <Icon name={v.type === 'Mobil' ? 'car' : 'motorcycle'} size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-slate-800">{v.plateNumber}</p>
                        <p className="truncate text-[11px] text-slate-500">
                          {v.brand} {v.model} {v.year ? `· ${v.year}` : ''} · {v.type}
                        </p>
                      </div>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() =>
                          setVehicleForm({ customerId: detail.id, data: { ...v } })
                        }
                      >
                        Ubah
                      </Button>
                      {isOwner && (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setDeleteVehicle({ customerId: detail.id, vehicle: v })}
                        >
                          <Icon name="trash" size={14} />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-[13px] font-semibold text-slate-800">Riwayat transaksi</h3>
              {(detail.history || []).length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">
                  Belum ada transaksi.
                </p>
              ) : (
                <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
                  <TableWrap>
                    <thead className="sticky top-0">
                      <tr>
                        <Th>Kode</Th>
                        <Th>Tanggal</Th>
                        <Th>Plat</Th>
                        <Th align="right">Total</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detail.history || []).map((h) => (
                        <tr key={h.id}>
                          <Td className="font-mono text-[11px]">{h.code}</Td>
                          <Td className="whitespace-nowrap text-xs text-slate-500">
                            {formatDate(h.date)}
                          </Td>
                          <Td className="text-xs">{h.plateNumber || '-'}</Td>
                          <Td align="right" className="tabular text-xs font-medium">
                            {rupiah(h.total)}
                            {h.status === 'void' && (
                              <span className="ml-1 text-[10px] text-red-500">(batal)</span>
                            )}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </TableWrap>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ---------------------------- Form kendaraan ---------------------------- */}
      <Modal
        open={!!vehicleForm}
        onClose={() => setVehicleForm(null)}
        title={vehicleForm?.data?.id ? 'Ubah kendaraan' : 'Tambah kendaraan'}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setVehicleForm(null)}>
              Batal
            </Button>
            <Button onClick={saveVehicle} icon="save">
              Simpan
            </Button>
          </>
        }
      >
        {vehicleForm && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nomor polisi" required className="sm:col-span-2">
              <Input
                value={vehicleForm.data.plateNumber || ''}
                onChange={(e) =>
                  setVehicleForm({
                    ...vehicleForm,
                    data: { ...vehicleForm.data, plateNumber: e.target.value.toUpperCase() },
                  })
                }
                placeholder="W 1234 AB"
              />
            </Field>
            <Field label="Merek">
              <Input
                value={vehicleForm.data.brand || ''}
                onChange={(e) =>
                  setVehicleForm({
                    ...vehicleForm,
                    data: { ...vehicleForm.data, brand: e.target.value },
                  })
                }
                placeholder="Honda"
              />
            </Field>
            <Field label="Model / tipe">
              <Input
                value={vehicleForm.data.model || ''}
                onChange={(e) =>
                  setVehicleForm({
                    ...vehicleForm,
                    data: { ...vehicleForm.data, model: e.target.value },
                  })
                }
                placeholder="Vario 125"
              />
            </Field>
            <Field label="Tahun">
              <Input
                type="number"
                value={vehicleForm.data.year ?? ''}
                onChange={(e) =>
                  setVehicleForm({
                    ...vehicleForm,
                    data: { ...vehicleForm.data, year: e.target.value ? Number(e.target.value) : null },
                  })
                }
                placeholder="2020"
              />
            </Field>
            <Field label="Jenis">
              <Select
                value={vehicleForm.data.type || 'Motor'}
                onChange={(e) =>
                  setVehicleForm({
                    ...vehicleForm,
                    data: { ...vehicleForm.data, type: e.target.value },
                  })
                }
              >
                <option value="Motor">Motor</option>
                <option value="Mobil">Mobil</option>
              </Select>
            </Field>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await api.del(`/api/customers/${deleteTarget.id}`);
          toast.push('Pelanggan dihapus.');
          setDeleteTarget(null);
          reload();
        }}
        message={`Yakin ingin menghapus pelanggan "${deleteTarget?.name}"?`}
        confirmLabel="Hapus"
      />

      <ConfirmDialog
        open={!!deleteVehicle}
        onClose={() => setDeleteVehicle(null)}
        onConfirm={async () => {
          if (!deleteVehicle) return;
          await api.del(`/api/customers/vehicles/${deleteVehicle.vehicle.id}`);
          toast.push('Kendaraan dihapus.');
          setDeleteVehicle(null);
          reload();
          setDetail(null);
        }}
        message={`Yakin ingin menghapus kendaraan "${deleteVehicle?.vehicle.plateNumber}"?`}
        confirmLabel="Hapus"
      />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2.5">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-0.5 truncate text-[13px] font-semibold tabular text-slate-800">{value}</p>
    </div>
  );
}
