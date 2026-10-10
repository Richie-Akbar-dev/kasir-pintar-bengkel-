import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/useApi';
import type { Settings } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ErrorBanner,
  Field,
  Input,
  NumberInput,
  Select,
  useToast,
} from '@/components/ui';
import { Icon } from '@/components/icons';

interface HardwareStatus {
  platform: string;
  windows: boolean;
  config: {
    type: string;
    name: string;
    host: string;
    port: number;
    comPort: string;
    baudRate: number;
    autoCut: boolean;
    copies: number;
    openDrawerOnCash: boolean;
    drawerPin: number;
  };
  printers: string[];
  paperChars: Record<string, number>;
}

const PRINTER_TYPES = [
  { value: 'browser', label: 'Cetak lewat browser (struk HTML)', hint: 'Paling aman — berjalan di semua printer Windows' },
  { value: 'windows', label: 'Printer Windows — cetak langsung', hint: 'Tanpa dialog, bisa membuka laci uang' },
  { value: 'network', label: 'Printer jaringan (LAN / Wi-Fi)', hint: 'Butuh alamat IP printer, biasanya port 9100' },
  { value: 'serial', label: 'Port serial (COM)', hint: 'Untuk printer serial lama, pole display, atau timbangan' },
  { value: 'file', label: 'Simpan ke berkas (diagnostik)', hint: 'Untuk memeriksa hasil perintah ESC/POS' },
];

export default function PerangkatTab() {
  const { settings, saveSettingsLocally } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState<Settings | null>(settings);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<Array<{ tone: 'ok' | 'err'; text: string }>>([]);

  const status = useApi<{ data: HardwareStatus }>('/api/hardware/status');

  if (settings && !form) setForm(settings);
  const current = form;

  useEffect(() => {
    if (settings) setForm((prev) => (prev ? prev : settings));
  }, [settings]);

  if (!current) return null;

  const printers = status.data?.data.printers || [];
  const isWindows = !!status.data?.data.windows;
  const typeInfo = PRINTER_TYPES.find((t) => t.value === current.printerType) || PRINTER_TYPES[0];

  function pushLog(tone: 'ok' | 'err', text: string) {
    setLog((prev) => [{ tone, text: `${new Date().toLocaleTimeString('id-ID')} — ${text}` }, ...prev].slice(0, 8));
  }

  async function save(silent = false) {
    setSaving(true);
    try {
      const res = await api.put<{ data: Settings }>('/api/settings', current);
      saveSettingsLocally(res.data);
      setForm(res.data);
      if (!silent) toast.push('Pengaturan perangkat disimpan.');
      return res.data;
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Gagal menyimpan.', 'error');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function action(kind: 'test-connection' | 'test-print' | 'open-drawer', label: string) {
    setBusy(kind);
    try {
      const saved = await save(true);
      if (!saved) return;
      if (kind === 'test-print') {
        const res = await api.post<{ ok: boolean; bytes: number }>('/api/hardware/test-print', {
          openDrawer: false,
        });
        pushLog('ok', `${label}: struk uji terkirim (${res.bytes} byte).`);
        toast.push('Struk uji berhasil dikirim ke printer.');
      } else if (kind === 'open-drawer') {
        await api.post('/api/hardware/open-drawer');
        pushLog('ok', `${label}: perintah buka laci terkirim.`);
        toast.push('Perintah buka laci terkirim.');
      } else {
        const res = await api.post<{ ok: boolean; message: string; printers?: string[] }>(
          '/api/hardware/test-connection'
        );
        pushLog(res.ok ? 'ok' : 'err', `${label}: ${res.message || (res.ok ? 'OK' : 'gagal')}`);
        if (res.ok) toast.push(res.message || 'Koneksi printer OK.');
        else toast.push(res.message || 'Koneksi gagal.', 'error');
        status.reload();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan.';
      pushLog('err', `${label}: ${message}`);
      toast.push(message, 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <Card
        title="Printer struk"
        subtitle="Cetak langsung tanpa dialog, dan buka laci uang otomatis"
        action={
          <Button size="sm" icon="save" loading={saving} onClick={() => save()}>
            Simpan
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Field label="Jenis pencetakan" hint={typeInfo.hint} className="lg:col-span-2">
            <Select
              value={current.printerType}
              onChange={(e) =>
                setForm({ ...current, printerType: e.target.value as Settings['printerType'] })
              }
            >
              {PRINTER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>

          {current.printerType === 'windows' && (
            <Field
              label="Nama printer"
              hint={
                isWindows
                  ? 'Persis seperti yang tampil di Pengaturan Windows'
                  : 'Daftar otomatis hanya tersedia di Windows'
              }
              className="lg:col-span-2"
            >
              <div className="flex gap-2">
                {printers.length > 0 ? (
                  <Select
                    className="flex-1"
                    value={current.printerName}
                    onChange={(e) => setForm({ ...current, printerName: e.target.value })}
                  >
                    <option value="">— Pilih printer —</option>
                    {printers.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    className="flex-1"
                    value={current.printerName}
                    onChange={(e) => setForm({ ...current, printerName: e.target.value })}
                    placeholder="mis. XP-58 atau POS-5890"
                  />
                )}
                <Button
                  variant="outline"
                  icon="refresh"
                  loading={status.loading}
                  onClick={status.reload}
                >
                  Muat daftar
                </Button>
              </div>
            </Field>
          )}

          {current.printerType === 'network' && (
            <>
              <Field label="Alamat IP printer" hint="Bisa dicek dari menu self-test printer">
                <Input
                  value={current.printerHost}
                  onChange={(e) => setForm({ ...current, printerHost: e.target.value })}
                  placeholder="192.168.1.50"
                />
              </Field>
              <Field label="Port" hint="Umumnya 9100">
                <NumberInput
                  value={current.printerPort}
                  onChange={(v) => setForm({ ...current, printerPort: v })}
                />
              </Field>
            </>
          )}

          {current.printerType === 'serial' && (
            <>
              <Field label="Port COM" hint="mis. COM3 — cek di Device Manager">
                <Input
                  value={current.comPort}
                  onChange={(e) => setForm({ ...current, comPort: e.target.value })}
                  placeholder="COM3"
                />
              </Field>
              <Field label="Baud rate">
                <Select
                  value={String(current.baudRate)}
                  onChange={(e) => setForm({ ...current, baudRate: Number(e.target.value) })}
                >
                  {[2400, 4800, 9600, 19200, 38400, 57600, 115200].map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          )}

          <Field label="Jumlah salinan struk" hint="1–3">
            <NumberInput
              value={current.printCopies}
              onChange={(v) => setForm({ ...current, printCopies: Math.min(3, Math.max(1, v)) })}
            />
          </Field>

          <Field label="Pin laci uang">
            <Select
              value={String(current.drawerPin)}
              onChange={(e) => setForm({ ...current, drawerPin: Number(e.target.value) })}
            >
              <option value={2}>Pin 2 (paling umum)</option>
              <option value={5}>Pin 5</option>
            </Select>
          </Field>

          <div className="space-y-2 lg:col-span-2">
            <Checkbox
              label="Potong kertas otomatis setelah cetak"
              checked={current.printerAutoCut}
              onChange={(e) => setForm({ ...current, printerAutoCut: e.target.checked })}
            />
            <Checkbox
              label="Buka laci uang otomatis saat pembayaran Tunai"
              checked={current.openDrawerOnCash}
              onChange={(e) => setForm({ ...current, openDrawerOnCash: e.target.checked })}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <Button
            variant="outline"
            icon="refresh"
            loading={busy === 'test-connection'}
            onClick={() => action('test-connection', 'Tes koneksi')}
          >
            Tes Koneksi
          </Button>
          <Button
            variant="secondary"
            icon="printer"
            loading={busy === 'test-print'}
            onClick={() => action('test-print', 'Cetak tes')}
            disabled={current.printerType === 'browser'}
          >
            Cetak Struk Uji
          </Button>
          <Button
            variant="accent"
            icon="cash"
            loading={busy === 'open-drawer'}
            onClick={() => action('open-drawer', 'Buka laci')}
            disabled={current.printerType === 'browser'}
          >
            Buka Laci Uang
          </Button>
        </div>

        {current.printerType === 'browser' && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            Mode browser aktif: struk dicetak lewat dialog cetak Windows. Untuk mencetak
            <b> tanpa dialog</b> dan membuka laci uang otomatis, pilih salah satu jenis printer di atas.
          </p>
        )}

        {log.length > 0 && (
          <ul className="mt-4 space-y-1 rounded-lg bg-slate-900 p-3 font-mono text-[11px] text-slate-200">
            {log.map((l, i) => (
              <li key={i} className={l.tone === 'ok' ? 'text-emerald-300' : 'text-red-300'}>
                {l.text}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card
          title="Barcode scanner"
          subtitle="Scanner mode keyboard (HID) langsung bekerja tanpa pengaturan tambahan"
          action={
            <Button size="sm" icon="save" loading={saving} onClick={() => save()}>
              Simpan
            </Button>
          }
        >
          <div className="space-y-2">
            <Checkbox
              label="Tekan Enter setelah scan langsung menambah item ke keranjang"
              checked={current.scannerEnterAddsItem}
              onChange={(e) => setForm({ ...current, scannerEnterAddsItem: e.target.checked })}
            />
            <Checkbox
              label="Bunyi beep singkat saat item berhasil ditambahkan"
              checked={current.scannerBeep}
              onChange={(e) => setForm({ ...current, scannerBeep: e.target.checked })}
            />
          </div>
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
            Pastikan scanner dalam mode <b>HID / keyboard</b> (bukan mode COM).
            Bila scanner Anda mengirim karakter tambahan sebelum/sesudah kode,
            sebagian besar merek bisa diatur ulang lewat buku kode (barcode konfigurasi).
          </p>
        </Card>

        <Card title="Informasi sistem" subtitle="Status pendeteksian perangkat">
          {status.error ? (
            <ErrorBanner message={status.error} onRetry={status.reload} />
          ) : (
            <dl className="space-y-2 text-[13px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Sistem operasi</dt>
                <dd className="font-medium text-slate-800">
                  {status.data?.data.platform || '—'}
                  {isWindows ? '' : ' (bukan Windows)'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Deteksi printer Windows</dt>
                <dd>
                  <Badge tone={isWindows ? 'green' : 'amber'}>
                    {isWindows ? 'Tersedia' : 'Tidak tersedia'}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Printer terdeteksi</dt>
                <dd className="font-medium text-slate-800">{printers.length}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Karakter per baris</dt>
                <dd className="font-medium text-slate-800">
                  {current.receiptWidth === 80
                    ? status.data?.data.paperChars?.['80'] || 48
                    : status.data?.data.paperChars?.['58'] || 32}{' '}
                  (kertas {current.receiptWidth} mm)
                </dd>
              </div>
            </dl>
          )}

          {printers.length > 0 && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Printer terpasang
              </p>
              <ul className="space-y-1">
                {printers.map((p) => (
                  <li key={p} className="flex items-center gap-2 text-[13px] text-slate-700">
                    <Icon name="printer" size={13} className="text-slate-400" />
                    <span className="truncate">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
