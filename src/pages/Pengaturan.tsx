import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth, roleLabel } from '@/lib/auth';
import { useApi } from '@/lib/useApi';
import { rupiah, formatDateTime } from '@/lib/format';
import type { Settings, User } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  Field,
  Input,
  Modal,
  NumberInput,
  Select,
  Td,
  TableWrap,
  Th,
  useToast,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import PerangkatTab from './PerangkatTab';

type Tab = 'profil' | 'perangkat' | 'pengguna' | 'data' | 'tentang';

const TABS: Array<{
  key: Tab;
  label: string;
  icon: 'settings' | 'users' | 'database' | 'info' | 'printer';
}> = [
  { key: 'profil', label: 'Profil Bengkel', icon: 'settings' },
  { key: 'perangkat', label: 'Perangkat', icon: 'printer' },
  { key: 'pengguna', label: 'Pengguna', icon: 'users' },
  { key: 'data', label: 'Data & Backup', icon: 'database' },
  { key: 'tentang', label: 'Tentang', icon: 'info' },
];

interface BackupItem {
  name: string;
  createdAt: string;
  files: number;
}

export default function Pengaturan() {
  const { user, settings, saveSettingsLocally, refresh } = useAuth();
  const toast = useToast();
  const isOwner = user?.role === 'owner';
  const [tab, setTab] = useState<Tab>('profil');

  return (
    <div className="space-y-5">
      <Card padded={false}>
        <div className="flex flex-wrap gap-1.5 p-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition ${
                tab === t.key
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon name={t.icon} size={16} />
              {t.label}
            </button>
          ))}
        </div>
      </Card>

      {tab === 'perangkat' && <PerangkatTab />}
      {tab === 'profil' && (
        <ProfileTab
          settings={settings}
          canEdit={isOwner}
          onSaved={(s) => {
            saveSettingsLocally(s);
            toast.push('Pengaturan disimpan.');
          }}
        />
      )}
      {tab === 'pengguna' && <UsersTab />}
      {tab === 'data' && <DataTab />}
      {tab === 'tentang' && <AboutTab onLogout={refresh} />}
    </div>
  );
}

/* ============================== Profil ============================== */

function ProfileTab({
  settings,
  canEdit,
  onSaved,
}: {
  settings: Settings | null;
  canEdit: boolean;
  onSaved: (s: Settings) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<Settings | null>(settings);
  const [saving, setSaving] = useState(false);

  // Sinkronkan bila data baru dimuat
  if (settings && !form) setForm(settings);
  const current = form || settings;

  async function save() {
    if (!current) return;
    setSaving(true);
    try {
      const res = await api.put<{ data: Settings }>('/api/settings', current);
      onSaved(res.data);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Gagal menyimpan.', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!current) return null;

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <div className="space-y-5 xl:col-span-2">
        <Card
          title="Identitas bengkel"
          subtitle="Informasi ini tampil di bagian atas struk"
          action={
            canEdit ? (
              <Button size="sm" icon="save" loading={saving} onClick={save}>
                Simpan
              </Button>
            ) : undefined
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nama bengkel" required className="sm:col-span-2">
              <Input
                value={current.workshopName}
                disabled={!canEdit}
                onChange={(e) => setForm({ ...current, workshopName: e.target.value })}
              />
            </Field>
            <Field label="Slogan / tagline" className="sm:col-span-2">
              <Input
                value={current.tagline}
                disabled={!canEdit}
                onChange={(e) => setForm({ ...current, tagline: e.target.value })}
                placeholder="mis. Servis Motor & Mobil Bergaransi"
              />
            </Field>
            <Field label="Alamat" className="sm:col-span-2">
              <Input
                value={current.address}
                disabled={!canEdit}
                onChange={(e) => setForm({ ...current, address: e.target.value })}
              />
            </Field>
            <Field label="Telepon">
              <Input
                value={current.phone}
                disabled={!canEdit}
                onChange={(e) => setForm({ ...current, phone: e.target.value })}
              />
            </Field>
            <Field label="Catatan kaki struk" className="sm:col-span-2">
              <Input
                value={current.footerNote}
                disabled={!canEdit}
                onChange={(e) => setForm({ ...current, footerNote: e.target.value })}
              />
            </Field>
          </div>
        </Card>

        <Card
          title="Transaksi & struk"
          action={
            canEdit ? (
              <Button size="sm" icon="save" loading={saving} onClick={save}>
                Simpan
              </Button>
            ) : undefined
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Lebar kertas struk">
              <Select
                value={String(current.receiptWidth)}
                disabled={!canEdit}
                onChange={(e) => setForm({ ...current, receiptWidth: Number(e.target.value) })}
              >
                <option value="58">58 mm (struk kecil)</option>
                <option value="80">80 mm (struk besar)</option>
              </Select>
            </Field>
            <Field label="Persentase PPN (%)">
              <NumberInput
                value={current.taxPercent}
                disabled={!canEdit}
                onChange={(v) => setForm({ ...current, taxPercent: Math.min(100, v) })}
              />
            </Field>
            <div className="space-y-2 sm:col-span-2">
              <Checkbox
                label="Aktifkan PPN secara bawaan di menu Kasir"
                checked={current.taxEnabled}
                disabled={!canEdit}
                onChange={(e) => setForm({ ...current, taxEnabled: e.target.checked })}
              />
              <Checkbox
                label="Langsung buka dialog cetak setelah transaksi disimpan"
                checked={current.printAutoOpen}
                disabled={!canEdit}
                onChange={(e) => setForm({ ...current, printAutoOpen: e.target.checked })}
              />
              <Checkbox
                label="Tampilkan peringatan stok menipis"
                checked={current.lowStockAlert}
                disabled={!canEdit}
                onChange={(e) => setForm({ ...current, lowStockAlert: e.target.checked })}
              />
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        <Card title="Pratinjau struk" subtitle="Contoh tampilan struk Anda">
          <div className="mx-auto w-fit rounded border border-dashed border-slate-300 bg-white p-2">
            <div className={`receipt ${current.receiptWidth === 80 ? 'receipt-80' : 'receipt-58'}`}>
              <div className="text-center">
                <p className="text-[1.15em] font-bold uppercase">{current.workshopName}</p>
                {current.tagline && <p className="text-[0.9em]">{current.tagline}</p>}
                {current.address && <p>{current.address}</p>}
                {current.phone && <p>{current.phone}</p>}
              </div>
              <hr />
              <div className="row">
                <span>TRX-001</span>
                <span>{formatDateTime(new Date())}</span>
              </div>
              <div>Pelanggan: Contoh Pelanggan / W 1234 AB</div>
              <hr />
              <div className="row">
                <span>Ganti Oli Motor x1</span>
                <span>{rupiah(25000)}</span>
              </div>
              <div className="row">
                <span>Oli Mesin 0,8L x1</span>
                <span>{rupiah(55000)}</span>
              </div>
              <hr />
              <div className="row" style={{ fontWeight: 'bold' }}>
                <span>TOTAL</span>
                <span>{rupiah(80000)}</span>
              </div>
              <div className="row">
                <span>Tunai</span>
                <span>{rupiah(100000)}</span>
              </div>
              <div className="row">
                <span>Kembali</span>
                <span>{rupiah(20000)}</span>
              </div>
              <hr />
              <div className="text-center">
                {current.footerNote && <p>{current.footerNote}</p>}
                <p style={{ marginTop: 3 }}>Terima kasih atas kunjungan Anda</p>
              </div>
            </div>
          </div>
        </Card>

        {!canEdit && (
          <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            Hanya akun owner yang dapat mengubah pengaturan bengkel.
          </p>
        )}
      </div>
    </div>
  );
}

/* ============================== Pengguna ============================== */

function UsersTab() {
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const { data, loading, reload } = useApi<{ data: User[] }>('/api/users');
  const [editing, setEditing] = useState<Partial<User> & { password?: string } | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  async function save() {
    if (!editing) return;
    if (!editing.name?.trim()) return toast.push('Nama wajib diisi.', 'error');
    if (isNew && !editing.password) return toast.push('Password wajib diisi untuk akun baru.', 'error');

    setSaving(true);
    try {
      if (isNew) {
        await api.post('/api/users', editing);
        toast.push('Pengguna ditambahkan.');
      } else {
        await api.put(`/api/users/${editing.id}`, editing);
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
    <Card
      title="Akun pengguna"
      subtitle="Owner memiliki akses penuh, kasir hanya dapat melayani transaksi"
      padded={false}
      action={
        <div className="p-3">
          <Button
            size="sm"
            icon="plus"
            onClick={() => {
              setIsNew(true);
              setEditing({ role: 'kasir', active: true });
            }}
          >
            Tambah Pengguna
          </Button>
        </div>
      }
    >
      <TableWrap>
        <thead>
          <tr>
            <Th>Nama</Th>
            <Th>Username</Th>
            <Th>Role</Th>
            <Th>Status</Th>
            <Th>Dibuat</Th>
            <Th align="center">Aksi</Th>
          </tr>
        </thead>
        <tbody>
          {(data?.data || []).map((u) => (
            <tr key={u.id} className="hover:bg-slate-50">
              <Td className="font-medium text-slate-800">
                {u.name}
                {u.id === currentUser?.id && (
                  <Badge tone="blue" className="ml-2">
                    Anda
                  </Badge>
                )}
              </Td>
              <Td className="font-mono text-xs">{u.username}</Td>
              <Td>
                <Badge tone={u.role === 'owner' ? 'violet' : 'cyan'}>{roleLabel(u.role)}</Badge>
              </Td>
              <Td>
                <Badge tone={u.active === false ? 'red' : 'green'}>
                  {u.active === false ? 'Nonaktif' : 'Aktif'}
                </Badge>
              </Td>
              <Td className="text-xs text-slate-500">{formatDateTime(u.createdAt)}</Td>
              <Td align="center">
                <div className="flex items-center justify-center gap-1">
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      setIsNew(false);
                      setEditing({ ...u, password: '' });
                    }}
                  >
                    Ubah
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    disabled={u.id === currentUser?.id}
                    onClick={() => setDeleteTarget(u)}
                  >
                    Hapus
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
          {loading && (
            <tr>
              <Td className="py-8 text-center text-slate-400">Memuat…</Td>
            </tr>
          )}
        </tbody>
      </TableWrap>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={isNew ? 'Tambah pengguna' : 'Ubah pengguna'}
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
            <Field label="Nama lengkap" required className="sm:col-span-2">
              <Input
                value={editing.name || ''}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </Field>
            <Field label="Username" required>
              <Input
                value={editing.username || ''}
                onChange={(e) => setEditing({ ...editing, username: e.target.value })}
                autoComplete="off"
              />
            </Field>
            <Field label="Role" required>
              <Select
                value={editing.role || 'kasir'}
                onChange={(e) => setEditing({ ...editing, role: e.target.value as User['role'] })}
              >
                <option value="kasir">Kasir</option>
                <option value="owner">Owner / Pemilik</option>
              </Select>
            </Field>
            <Field
              label={isNew ? 'Password' : 'Password baru'}
              required={isNew}
              hint={isNew ? undefined : 'Kosongkan bila tidak ingin mengubah'}
              className="sm:col-span-2"
            >
              <Input
                type="password"
                value={editing.password || ''}
                onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                autoComplete="new-password"
              />
            </Field>
            <div className="sm:col-span-2">
              <Checkbox
                label="Akun aktif"
                checked={editing.active !== false}
                onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
              />
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await api.del(`/api/users/${deleteTarget.id}`);
          toast.push('Pengguna dihapus.');
          setDeleteTarget(null);
          reload();
        }}
        message={`Yakin ingin menghapus akun "${deleteTarget?.name}"?`}
        confirmLabel="Hapus"
      />
    </Card>
  );
}

/* ============================== Data ============================== */

function DataTab() {
  const toast = useToast();
  const { data, loading, reload } = useApi<{
    data: Settings;
    info: { dir: string; files: Array<{ name: string; bytes: number }>; totalBytes: number };
  }>('/api/settings');
  const { data: backups, reload: reloadBackups } = useApi<{ data: BackupItem[] }>(
    '/api/settings/backups'
  );
  const [busy, setBusy] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<BackupItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function createBackup() {
    setBusy(true);
    try {
      const res = await api.post<{ data: { path: string } }>('/api/settings/backups');
      toast.push(`Backup tersimpan di ${res.data.path}`);
      reloadBackups();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Gagal membuat backup.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function restoreFromFile(file: File) {
    setBusy(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      await api.post('/api/settings/restore', { data: parsed });
      toast.push('Data berhasil dipulihkan. Muat ulang halaman…', 'success');
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Berkas backup tidak valid.', 'error');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Penyimpanan data" subtitle="Semua data tersimpan di komputer/laptop ini">
          {loading ? (
            <p className="py-6 text-center text-sm text-slate-400">Memuat…</p>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg bg-slate-50 px-3 py-2.5">
                <p className="text-[11px] text-slate-500">Lokasi folder data</p>
                <p className="mt-0.5 break-all font-mono text-[12px] text-slate-800">
                  {data?.info.dir}
                </p>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-slate-500">Total ukuran</span>
                <span className="font-medium tabular">
                  {((data?.info.totalBytes || 0) / 1024).toFixed(1)} KB
                </span>
              </div>
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Berkas</Th>
                    <Th align="right">Ukuran</Th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.info.files || []).map((f) => (
                    <tr key={f.name}>
                      <Td className="font-mono text-xs">{f.name}.json</Td>
                      <Td align="right" className="tabular text-xs">
                        {(f.bytes / 1024).toFixed(1)} KB
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </div>
          )}
        </Card>

        <Card title="Backup & pemulihan" subtitle="Backup otomatis dibuat setiap hari saat aplikasi dibuka">
          <div className="space-y-3">
            <Button icon="save" onClick={createBackup} loading={busy} block>
              Buat Backup Sekarang
            </Button>

            <div className="rounded-lg border border-dashed border-slate-300 p-3 text-center">
              <p className="mb-2 text-[13px] text-slate-600">Pulihkan dari berkas backup (.json)</p>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) restoreFromFile(file);
                }}
              />
              <Button
                variant="outline"
                icon="upload"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
              >
                Pilih Berkas
              </Button>
              <p className="mt-2 text-[11px] text-slate-400">
                Data saat ini akan dibackup otomatis sebelum dipulihkan.
              </p>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[13px] font-medium text-slate-700">Backup tersimpan</p>
                <Button size="xs" variant="ghost" icon="refresh" onClick={reloadBackups}>
                  Muat ulang
                </Button>
              </div>
              <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                {(backups?.data || []).length === 0 && (
                  <li className="px-3 py-6 text-center text-xs text-slate-400">Belum ada backup.</li>
                )}
                {(backups?.data || []).map((b) => (
                  <li key={b.name} className="flex items-center gap-2 px-3 py-2">
                    <Icon name="database" size={14} className="shrink-0 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-slate-700">{b.name}</p>
                      <p className="text-[11px] text-slate-400">{formatDateTime(b.createdAt)}</p>
                    </div>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => window.open(`/api/settings/backups/${b.name}/download`, '_blank')}
                    >
                      Unduh
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => setRestoreTarget(b)}>
                      Pulihkan
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        danger
        title="Pulihkan data"
        confirmLabel="Ya, pulihkan"
        message={
          <>
            Data saat ini akan <b>diganti</b> dengan isi backup{' '}
            <b>{restoreTarget?.name}</b>. Backup otomatis akan dibuat sebelum proses berjalan.
          </>
        }
        onConfirm={async () => {
          if (!restoreTarget) return;
          try {
            const res = await fetch(`/api/settings/backups/${restoreTarget.name}/download`);
            const parsed = await res.json();
            await api.post('/api/settings/restore', { data: parsed });
            toast.push('Data berhasil dipulihkan. Muat ulang halaman…');
            setTimeout(() => window.location.reload(), 1200);
          } catch (err) {
            toast.push(err instanceof Error ? err.message : 'Gagal memulihkan data.', 'error');
          } finally {
            setRestoreTarget(null);
            reload();
          }
        }}
      />
    </>
  );
}

/* ============================== Tentang ============================== */

function AboutTab({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth();

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card title="Tentang aplikasi">
        <dl className="space-y-2.5 text-[13px]">
          <Row label="Nama" value="Kasir Pintar Bengkel" />
          <Row label="Versi" value="1.0.0" />
          <Row label="Jenis" value="Aplikasi desktop lokal (Windows)" />
          <Row label="Penyimpanan" value="Berkas JSON di folder data/" />
          <Row label="Sedang login" value={`${user?.name} (${roleLabel(user?.role || 'kasir')})`} />
        </dl>

        <div className="mt-4 rounded-lg bg-slate-50 p-3 text-[12px] leading-relaxed text-slate-600">
          <p className="mb-1.5 font-medium text-slate-800">Cara menjalankan di Windows</p>
          <ol className="ml-4 list-decimal space-y-1">
            <li>Pastikan Node.js 18 atau lebih baru sudah terpasang.</li>
            <li>Jalankan <code className="font-mono">install.bat</code> sekali saja.</li>
            <li>
              Untuk memakai aplikasi, dobel-klik <code className="font-mono">start.bat</code>.
            </li>
            <li>Browser akan terbuka ke alamat http://localhost:3001.</li>
          </ol>
        </div>
      </Card>

      <Card title="Tips penggunaan">
        <ul className="space-y-2.5 text-[13px] text-slate-600">
          {[
            'Tekan Enter pada kolom pencarian di menu Kasir untuk menambah item dengan cepat.',
            'Gunakan Work Order untuk mencatat antrean, lalu proses ke Kasir saat pekerjaan selesai.',
            'Atur batas minimum stok agar peringatan stok menipis muncul di Dashboard.',
            'Transaksi dengan metode Kredit/Bon dapat ditandai lunas di menu Riwayat.',
            'Backup data secara berkala dari tab Data & Backup.',
          ].map((tip) => (
            <li key={tip} className="flex items-start gap-2.5">
              <Icon name="check" size={15} className="mt-0.5 shrink-0 text-emerald-600" />
              {tip}
            </li>
          ))}
        </ul>

        <div className="mt-4 flex gap-2">
          <Button variant="outline" icon="refresh" onClick={onLogout}>
            Muat ulang data
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value}</dd>
    </div>
  );
}
