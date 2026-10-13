import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/useApi';
import { rupiah } from '@/lib/format';
import {
  PAYMENT_LABELS,
  type Mechanic,
  type PaymentMethod,
  type Transaction,
} from '@/lib/types';
import {
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  NumberInput,
  Select,
  Textarea,
  useToast,
} from '@/components/ui';
import ReceiptModal from '@/components/Receipt';
import { isDirectPrint, printTransaction } from '@/lib/hardware';
import { KASIR_CART_KEY, type KasirCartSave } from './Kasir';

const PAYMENTS: PaymentMethod[] = ['cash', 'transfer', 'qris', 'debit', 'credit'];

export default function Pembayaran() {
  const { settings } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState<KasirCartSave | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paidAmount, setPaidAmount] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [taxEnabled, setTaxEnabled] = useState(!!settings?.taxEnabled);
  const [note, setNote] = useState('');
  const [defaultMechanic, setDefaultMechanic] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastTrx, setLastTrx] = useState<Transaction | null>(null);

  const mechanics = useApi<{ data: Mechanic[] }>('/api/mechanics');
  const directPrint = isDirectPrint(settings);

  /* Muat keranjang dari penyimpanan sementara — bila kosong, kembali ke Kasir */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KASIR_CART_KEY);
      if (!raw) {
        navigate('/kasir', { replace: true });
        return;
      }
      setData(JSON.parse(raw) as KasirCartSave);
    } catch {
      navigate('/kasir', { replace: true });
    }
  }, [navigate]);

  // Ikuti pengaturan PPN bengkel saat data pengaturan baru dimuat
  useEffect(() => {
    setTaxEnabled(!!settings?.taxEnabled);
  }, [settings?.taxEnabled]);

  const items = data?.items || [];
  const subtotal = items.reduce((a, c) => a + c.price * c.qty, 0);
  const itemDiscount = items.reduce((a, c) => a + c.discount, 0);
  const discount = Math.min(discountAmount, subtotal - itemDiscount);
  const taxable = Math.max(0, subtotal - itemDiscount - discount);
  const taxAmount = taxEnabled ? Math.round((taxable * (settings?.taxPercent || 0)) / 100) : 0;
  const total = Math.max(0, taxable + taxAmount);
  const change = paymentMethod === 'cash' ? Math.max(0, paidAmount - total) : 0;

  useEffect(() => {
    if (paymentMethod !== 'cash') setPaidAmount(total);
  }, [paymentMethod, total]);

  /* ------------------------------- Bayar ------------------------------- */
  async function submit() {
    if (!data) return;
    if (paymentMethod === 'cash' && paidAmount < total)
      return toast.push('Jumlah uang tunai kurang dari total.', 'error');

    setSubmitting(true);
    try {
      const res = await api.post<{ data: Transaction }>('/api/transactions', {
        items: data.items.map((c) => ({
          type: c.type,
          refId: c.refId,
          qty: c.qty,
          price: c.price,
          discount: c.discount,
          mechanicId: c.mechanicId || defaultMechanic,
        })),
        customerId: null,
        customerName: data.customerName || 'Pelanggan Umum',
        vehicleId: null,
        plateNumber: data.plateNumber || '',
        mechanicId: defaultMechanic || null,
        discountAmount: discount,
        taxEnabled,
        taxPercent: settings?.taxPercent ?? 0,
        paymentMethod,
        paidAmount: paymentMethod === 'cash' ? paidAmount : total,
        note,
        workOrderId: data.workOrderId,
      });
      toast.push(`Transaksi ${res.data.code} tersimpan`);

      if (directPrint) {
        try {
          const out = await printTransaction(res.data.id);
          toast.push(
            out.drawerOpened ? 'Struk tercetak & laci uang terbuka.' : 'Struk terkirim ke printer.'
          );
        } catch (err) {
          toast.push(
            err instanceof Error ? err.message : 'Gagal mencetak ke printer. Cetak ulang dari Riwayat.',
            'error'
          );
        }
      }

      setLastTrx(res.data);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Gagal menyimpan transaksi.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  /** Setelah struk ditutup: bersihkan & kembali ke Kasir. */
  function finish() {
    sessionStorage.removeItem(KASIR_CART_KEY);
    setLastTrx(null);
    navigate('/kasir');
  }

  if (!data) return null;

  return (
    <div className="pb-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Pembayaran</h2>
        <Button variant="ghost" size="sm" onClick={() => navigate('/kasir')}>
          ← Kembali ke Kasir
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* ===================== Rincian belanja ===================== */}
        <div className="space-y-5 lg:col-span-2">
          <Card title="Rincian belanja" padded={false}>
            <ul className="divide-y divide-slate-100">
              {items.map((item) => (
                <li key={item.key} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-800">{item.name}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      <span className="font-mono">{item.code}</span> · {item.qty} {item.unit} ×{' '}
                      {rupiah(item.price)}
                      {item.discount > 0 && (
                        <span className="text-emerald-600"> · diskon {rupiah(item.discount)}</span>
                      )}
                    </p>
                  </div>
                  <span className="text-[13px] font-semibold tabular text-slate-900">
                    {rupiah(item.price * item.qty - item.discount)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Pelanggan">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Nama pelanggan">
                <Input value={data.customerName || 'Pelanggan Umum'} readOnly className="h-10 bg-slate-50 text-[13px]" />
              </Field>
              <Field label="Plat nomor">
                <Input
                  value={data.plateNumber || '—'}
                  readOnly
                  className="h-10 bg-slate-50 text-[13px]"
                />
              </Field>
            </div>
            {data.workOrderId && (
              <p className="mt-2 text-[11px] text-slate-500">
                Pembayaran untuk work order yang sedang berjalan.
              </p>
            )}
          </Card>
        </div>

        {/* ===================== Pembayaran ===================== */}
        <div>
          <Card title="Pembayaran" padded={false}>
            <div className="space-y-3 p-4">
              <div className="grid grid-cols-3 gap-2">
                {PAYMENTS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setPaymentMethod(m)}
                    className={`rounded-lg border px-2 py-2 text-[12px] font-medium transition ${
                      paymentMethod === m
                        ? 'border-brand-500 bg-brand-600 text-white shadow-sm'
                        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {PAYMENT_LABELS[m]}
                  </button>
                ))}
              </div>

              {paymentMethod === 'cash' ? (
                <div className="space-y-2">
                  <Field label="Uang diterima">
                    <NumberInput
                      value={paidAmount}
                      onChange={setPaidAmount}
                      prefix="Rp"
                      className="h-11 text-base font-semibold"
                      autoFocus
                    />
                  </Field>
                  <div className="flex flex-wrap gap-1.5">
                    {[total, 20_000, 50_000, 100_000, 150_000, 200_000]
                      .filter((v) => v > 0)
                      .map((v) => (
                        <button
                          key={v}
                          onClick={() => setPaidAmount(Math.max(v, total))}
                          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-600 transition hover:bg-slate-50"
                        >
                          {rupiah(v)}
                        </button>
                      ))}
                    <button
                      onClick={() => setPaidAmount(Math.ceil(total / 5000) * 5000)}
                      className="rounded-md border border-brand-300 bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-700 transition hover:bg-brand-100"
                    >
                      Bulatkan
                    </button>
                  </div>
                  <div
                    className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${
                      paidAmount >= total ? 'bg-emerald-50' : 'bg-amber-50'
                    }`}
                  >
                    <span className="text-[13px] font-medium text-slate-700">Kembalian</span>
                    <span
                      className={`text-lg font-bold tabular ${
                        paidAmount >= total ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {rupiah(change)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-[13px] text-slate-600">
                  {paymentMethod === 'credit'
                    ? 'Transaksi dicatat sebagai bon/piutang. Tandai lunas nanti di menu Riwayat.'
                    : `Pembayaran ${PAYMENT_LABELS[paymentMethod]} sebesar ${rupiah(total)}.`}
                </div>
              )}

              <Field label="Diskon transaksi">
                <NumberInput
                  value={discountAmount}
                  onChange={(v) => setDiscountAmount(Math.min(v, subtotal - itemDiscount))}
                  prefix="Rp"
                  className="h-9 text-[13px]"
                />
              </Field>

              {settings?.taxEnabled !== false && (
                <Checkbox
                  label={`Kenakan PPN ${settings?.taxPercent ?? 0}%`}
                  checked={taxEnabled}
                  onChange={(e) => setTaxEnabled(e.target.checked)}
                />
              )}

              <Field label="Mekanik utama (opsional)">
                <Select
                  value={defaultMechanic}
                  onChange={(e) => setDefaultMechanic(e.target.value)}
                  className="h-9 text-[13px]"
                >
                  <option value="">— Tidak ada —</option>
                  {(mechanics.data?.data || [])
                    .filter((m) => m.active !== false)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </Select>
              </Field>

              <Textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Catatan (opsional)"
                className="text-[13px]"
              />

              {/* Total */}
              <div className="space-y-1 rounded-lg bg-slate-50 px-3 py-2.5">
                <div className="flex items-center justify-between text-[13px] text-slate-600">
                  <span>Subtotal</span>
                  <span className="tabular">{rupiah(subtotal)}</span>
                </div>
                {itemDiscount + discount > 0 && (
                  <div className="flex items-center justify-between text-[13px] text-emerald-600">
                    <span>Diskon</span>
                    <span className="tabular">-{rupiah(itemDiscount + discount)}</span>
                  </div>
                )}
                {taxEnabled && (
                  <div className="flex items-center justify-between text-[13px] text-slate-600">
                    <span>PPN {settings?.taxPercent ?? 0}%</span>
                    <span className="tabular">{rupiah(taxAmount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-slate-200 pt-1.5 text-base font-semibold text-slate-900">
                  <span>Total</span>
                  <span className="tabular text-brand-700">{rupiah(total)}</span>
                </div>
              </div>

              <Button
                variant="accent"
                size="lg"
                icon="printer"
                block
                onClick={submit}
                loading={submitting}
                disabled={!items.length}
              >
                Proses &amp; Cetak
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Struk kecil sebagai pop-up setelah pembayaran */}
      <ReceiptModal
        trx={lastTrx}
        settings={settings}
        autoPrint={!directPrint}
        onClose={finish}
        onDone={finish}
      />
    </div>
  );
}
