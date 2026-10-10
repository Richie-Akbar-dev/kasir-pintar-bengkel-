import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/useApi';
import { rupiah } from '@/lib/format';
import {
  PAYMENT_LABELS,
  type Customer,
  type Mechanic,
  type PaymentMethod,
  type Product,
  type Service,
  type Transaction,
  type Vehicle,
} from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  Modal,
  NumberInput,
  Select,
  Textarea,
  useToast,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import ReceiptModal from '@/components/Receipt';
import { beep, beepError, isDirectPrint, printTransaction } from '@/lib/hardware';

interface CartItem {
  key: string;
  type: 'product' | 'service';
  refId: string;
  code: string;
  name: string;
  unit: string;
  price: number;
  costPrice: number;
  qty: number;
  discount: number;
  mechanicId: string;
  stock: number;
}

const PAYMENTS: PaymentMethod[] = ['cash', 'transfer', 'qris', 'debit', 'credit'];

export default function Kasir() {
  const { settings, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const isOwner = user?.role === 'owner';

  const [tab, setTab] = useState<'all' | 'product' | 'service'>('all');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');

  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [defaultMechanic, setDefaultMechanic] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [taxEnabled, setTaxEnabled] = useState(!!settings?.taxEnabled);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paidAmount, setPaidAmount] = useState(0);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastTrx, setLastTrx] = useState<Transaction | null>(null);
  const [workOrderId, setWorkOrderId] = useState<string | null>(params.get('wo'));

  const [customerModal, setCustomerModal] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const directPrint = isDirectPrint(settings);

  const products = useApi<{ data: Product[] }>('/api/products');
  const services = useApi<{ data: Service[] }>('/api/services');
  const mechanics = useApi<{ data: Mechanic[] }>('/api/mechanics');

  // Kolom pencarian selalu siap menerima hasil scan barcode
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  /* ------------------------- Muat dari work order ------------------------- */
  useEffect(() => {
    const woId = params.get('wo');
    if (!woId) return;
    api
      .get<{ data: { customerId: string; vehicleId: string; mechanicId: string; items: CartItem[]; customerName: string; plateNumber: string } }>(
        `/api/work-orders/${woId}`
      )
      .then(async (res) => {
        const wo = res.data;
        setWorkOrderId(woId);
        if (wo.mechanicId) setDefaultMechanic(wo.mechanicId);
        if (wo.customerId) {
          try {
            const c = await api.get<{ data: Customer }>(`/api/customers/${wo.customerId}`);
            setCustomer(c.data);
            if (wo.vehicleId) {
              const v = (c.data.vehicles || []).find((x) => x.id === wo.vehicleId);
              if (v) setVehicle(v);
            }
          } catch {
            /* abaikan */
          }
        }
        const loaded: CartItem[] = (wo.items || []).map((it) => ({
          key: `${it.type}-${it.refId}`,
          type: it.type,
          refId: it.refId,
          code: it.code,
          name: it.name,
          unit: it.unit,
          price: it.price,
          costPrice: it.costPrice || 0,
          qty: it.qty,
          discount: 0,
          mechanicId: wo.mechanicId || '',
          stock: 9999,
        }));
        setCart(loaded);
        toast.push(`Item dari ${woId ? 'work order' : ''} berhasil dimuat`, 'info');
      })
      .catch(() => toast.push('Work order tidak ditemukan.', 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get('wo')]);

  /* -------------------------------- Katalog -------------------------------- */
  const catalog = useMemo(() => {
    const list: Array<CartItem & { category: string; stock: number; durationMin?: number }> = [];
    const needle = query.trim().toLowerCase();

    for (const p of products.data?.data || []) {
      if (p.active === false) continue;
      if (tab === 'service') continue;
      if (category && p.category !== category) continue;
      if (
        needle &&
        !`${p.name} ${p.code} ${p.barcode} ${p.category}`.toLowerCase().includes(needle)
      )
        continue;
      list.push({
        key: `product-${p.id}`,
        type: 'product',
        refId: p.id,
        code: p.code,
        name: p.name,
        unit: p.unit,
        price: p.sellPrice,
        costPrice: p.costPrice || 0,
        qty: 1,
        discount: 0,
        mechanicId: '',
        stock: p.stock,
        category: p.category,
      });
    }

    for (const s of services.data?.data || []) {
      if (s.active === false) continue;
      if (tab === 'product') continue;
      if (category && s.category !== category) continue;
      if (needle && !`${s.name} ${s.code} ${s.category}`.toLowerCase().includes(needle)) continue;
      list.push({
        key: `service-${s.id}`,
        type: 'service',
        refId: s.id,
        code: s.code,
        name: s.name,
        unit: 'Layanan',
        price: s.price,
        costPrice: 0,
        qty: 1,
        discount: 0,
        mechanicId: '',
        stock: 9999,
        category: s.category,
        durationMin: s.durationMin,
      });
    }

    return list.slice(0, 60);
  }, [products.data, services.data, query, tab, category]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products.data?.data || []) if (tab !== 'service') set.add(p.category);
    for (const s of services.data?.data || []) if (tab !== 'product') set.add(s.category);
    return [...set].sort();
  }, [products.data, services.data, tab]);

  /* --------------------------------- Keranjang --------------------------------- */
  const addToCart = useCallback(
    (item: CartItem) => {
      setCart((prev) => {
        const found = prev.find((c) => c.key === item.key);
        if (found) {
          if (found.type === 'product' && found.qty + 1 > found.stock) {
            toast.push(`Stok ${found.name} hanya ${found.stock}`, 'error');
            return prev;
          }
          return prev.map((c) => (c.key === item.key ? { ...c, qty: c.qty + 1 } : c));
        }
        return [
          ...prev,
          { ...item, mechanicId: item.type === 'service' ? defaultMechanic : '' },
        ];
      });
    },
    [defaultMechanic, toast]
  );

  const updateItem = useCallback((key: string, patch: Partial<CartItem>) => {
    setCart((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }, []);

  const removeItem = useCallback((key: string) => {
    setCart((prev) => prev.filter((c) => c.key !== key));
  }, []);

  const clearAll = useCallback(() => {
    setCart([]);
    setCustomer(null);
    setVehicle(null);
    setDiscountAmount(0);
    setPaidAmount(0);
    setNote('');
    setWorkOrderId(null);
    setDefaultMechanic('');
    if (params.get('wo')) setParams({}, { replace: true });
  }, [params, setParams]);

  /* ---------------------------------- Total ---------------------------------- */
  const subtotal = cart.reduce((a, c) => a + c.price * c.qty, 0);
  const itemDiscount = cart.reduce((a, c) => a + c.discount, 0);
  const discount = Math.min(discountAmount, subtotal - itemDiscount);
  const taxable = Math.max(0, subtotal - itemDiscount - discount);
  const taxAmount = taxEnabled ? Math.round((taxable * (settings?.taxPercent || 0)) / 100) : 0;
  const total = Math.max(0, taxable + taxAmount);
  const change = paymentMethod === 'cash' ? Math.max(0, paidAmount - total) : 0;

  useEffect(() => {
    if (paymentMethod !== 'cash') setPaidAmount(total);
  }, [paymentMethod, total]);

  // Ikuti pengaturan PPN bengkel saat data pengaturan baru dimuat
  useEffect(() => {
    setTaxEnabled(!!settings?.taxEnabled);
  }, [settings?.taxEnabled]);

  /** Enter pada kolom pencarian: tambahkan item pertama yang cocok (hasil scan). */
  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();

    if (!catalog.length) {
      beepError();
      return;
    }
    // Aman hanya bila hasil tunggal, atau bila pengaturan mengizinkan
    if (catalog.length > 1 && settings?.scannerEnterAddsItem === false) {
      beepError();
      toast.push(`Ditemukan ${catalog.length} item, pilih salah satu.`, 'info');
      return;
    }

    addToCart(catalog[0]);
    setQuery('');
    if (settings?.scannerBeep !== false) beep();
    searchRef.current?.focus();
  }

  /* --------------------------------- Simpan --------------------------------- */
  async function submit(then: 'print' | 'stay') {
    if (!cart.length) return toast.push('Keranjang masih kosong.', 'error');
    if (paymentMethod === 'cash' && paidAmount < total)
      return toast.push('Jumlah uang tunai kurang dari total.', 'error');

    setSubmitting(true);
    try {
      const res = await api.post<{ data: Transaction }>('/api/transactions', {
        items: cart.map((c) => ({
          type: c.type,
          refId: c.refId,
          qty: c.qty,
          price: c.price,
          discount: c.discount,
          mechanicId: c.type === 'service' ? c.mechanicId || defaultMechanic : c.mechanicId,
        })),
        customerId: customer?.id || null,
        customerName: customer?.name || 'Pelanggan Umum',
        vehicleId: vehicle?.id || null,
        plateNumber: vehicle?.plateNumber || '',
        mechanicId: defaultMechanic || null,
        discountAmount: discount,
        taxEnabled,
        taxPercent: settings?.taxPercent ?? 0,
        paymentMethod,
        paidAmount: paymentMethod === 'cash' ? paidAmount : total,
        note,
        workOrderId,
      });
      setLastTrx(res.data);
      toast.push(`Transaksi ${res.data.code} tersimpan`);

      if (then === 'print' && directPrint) {
        // Cetak langsung ke printer thermal + buka laci bila Tunai
        try {
          const out = await printTransaction(res.data.id);
          toast.push(
            out.drawerOpened ? 'Struk tercetak & laci uang terbuka.' : 'Struk terkirim ke printer.'
          );
        } catch (err) {
          toast.push(
            err instanceof Error ? err.message : 'Gagal mencetak ke printer. Silakan cetak ulang.'
          , 'error');
        }
      }

      clearAll();
      if (then === 'stay') setLastTrx(null);
      products.reload();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Gagal menyimpan transaksi.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------------------------------- Render ---------------------------------- */
  const customerVehicles = customer?.vehicles || [];

  return (
    <div className="pb-10">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        {/* ============================ KATALOG ============================ */}
        <div className="space-y-4 xl:col-span-3">
          <Card padded={false}>
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-lg bg-slate-100 p-0.5">
                  {(
                    [
                      ['all', 'Semua'],
                      ['product', 'Sparepart'],
                      ['service', 'Jasa Servis'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setTab(key);
                        setCategory('');
                      }}
                      className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition ${
                        tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="relative min-w-[220px] flex-1">
                  <Icon
                    name="search"
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Cari sparepart / jasa, atau scan barcode…"
                    autoFocus
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                  {query && (
                    <button
                      onClick={() => {
                        setQuery('');
                        searchRef.current?.focus();
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      aria-label="Bersihkan"
                    >
                      <Icon name="x" size={13} />
                    </button>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  icon="refresh"
                  onClick={() => {
                    products.reload();
                    services.reload();
                  }}
                >
                  Muat ulang
                </Button>
              </div>

              {categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setCategory('')}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                      category === ''
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Semua kategori
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCategory(c === category ? '' : c)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                        category === c
                          ? 'bg-brand-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid max-h-[calc(100vh-19rem)] grid-cols-1 gap-2 overflow-y-auto border-t border-slate-100 p-3 sm:grid-cols-2">
              {products.loading && services.loading ? (
                <p className="col-span-full py-10 text-center text-sm text-slate-400">Memuat katalog…</p>
              ) : catalog.length === 0 ? (
                <p className="col-span-full py-10 text-center text-sm text-slate-400">
                  Tidak ada item yang cocok dengan pencarian.
                </p>
              ) : (
                catalog.map((item) => {
                  const lowStock = item.type === 'product' && item.stock <= 0;
                  return (
                    <button
                      key={item.key}
                      onClick={() => addToCart(item)}
                      disabled={lowStock}
                      className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${
                        lowStock
                          ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60'
                          : 'border-slate-200 bg-white hover:border-brand-400 hover:bg-brand-50/40 hover:shadow-sm'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          item.type === 'product' ? 'bg-slate-100 text-slate-500' : 'bg-accent-50 text-accent-600'
                        }`}
                      >
                        <Icon name={item.type === 'product' ? 'box' : 'wrench'} size={17} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-slate-800">
                          {item.name}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-slate-400">{item.code}</span>
                          <span className="text-[10px] text-slate-300">·</span>
                          <span className="truncate text-[10px] text-slate-400">{item.category}</span>
                        </span>
                        <span className="mt-1.5 flex items-center gap-2">
                          <span className="text-[13px] font-semibold tabular text-brand-700">
                            {rupiah(item.price)}
                          </span>
                          {item.type === 'product' && (
                            <Badge tone={item.stock <= 0 ? 'red' : item.stock <= 5 ? 'amber' : 'slate'}>
                              stok {item.stock} {item.unit}
                            </Badge>
                          )}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        {/* ============================ KERANJANG ============================ */}
        <div className="xl:col-span-2">
          <div className="space-y-4 xl:sticky xl:top-20">
            {/* Pelanggan */}
            <Card padded={false}>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-slate-900">
                    {customer ? customer.name : 'Pelanggan Umum'}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {vehicle
                      ? `${vehicle.plateNumber} · ${vehicle.brand} ${vehicle.model}`
                      : customer?.phone || 'Tanpa data kendaraan'}
                  </p>
                </div>
                <Button size="sm" variant="outline" icon="users" onClick={() => setCustomerModal(true)}>
                  Pilih
                </Button>
              </div>
              {customer && customerVehicles.length > 0 && (
                <div className="border-t border-slate-100 px-4 py-2.5">
                  <Select
                    value={vehicle?.id || ''}
                    onChange={(e) =>
                      setVehicle(customerVehicles.find((v) => v.id === e.target.value) || null)
                    }
                    className="h-9 text-[13px]"
                  >
                    <option value="">— Tanpa kendaraan —</option>
                    {customerVehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.plateNumber} · {v.brand} {v.model}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </Card>

            {/* Item */}
            <Card
              title="Keranjang"
              subtitle={cart.length ? `${cart.length} jenis item` : 'Belum ada item'}
              action={
                cart.length > 0 ? (
                  <Button size="xs" variant="ghost" icon="trash" onClick={clearAll}>
                    Kosongkan
                  </Button>
                ) : undefined
              }
              padded={false}
            >
              {cart.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-slate-400">
                  Klik item di katalog untuk menambahkan.
                </p>
              ) : (
                <ul className="max-h-[46vh] divide-y divide-slate-100 overflow-y-auto">
                  {cart.map((item) => (
                    <li key={item.key} className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-slate-800">{item.name}</p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                            <span className="font-mono">{item.code}</span>
                            <span>·</span>
                            <span>{rupiah(item.price)}</span>
                            {item.type === 'product' && <span>· stok {item.stock}</span>}
                          </p>
                        </div>
                        <button
                          onClick={() => removeItem(item.key)}
                          className="rounded p-1 text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                          aria-label="Hapus"
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex items-center rounded-lg border border-slate-300">
                          <button
                            className="px-2 py-1 text-slate-500 transition hover:text-slate-900"
                            onClick={() =>
                              updateItem(item.key, { qty: Math.max(1, item.qty - 1) })
                            }
                          >
                            <Icon name="minus" size={13} />
                          </button>
                          <span className="w-9 text-center text-[13px] font-medium tabular">
                            {item.qty}
                          </span>
                          <button
                            className="px-2 py-1 text-slate-500 transition hover:text-slate-900 disabled:opacity-40"
                            disabled={item.type === 'product' && item.qty >= item.stock}
                            onClick={() => updateItem(item.key, { qty: item.qty + 1 })}
                          >
                            <Icon name="plus" size={13} />
                          </button>
                        </div>

                        {isOwner ? (
                          <div className="flex-1">
                            <NumberInput
                              value={item.price}
                              onChange={(v) => updateItem(item.key, { price: v })}
                              prefix="Rp"
                              className="h-8 text-[13px]"
                            />
                          </div>
                        ) : (
                          <span className="flex-1 text-right text-[13px] font-semibold tabular text-slate-900">
                            {rupiah(item.price * item.qty - item.discount)}
                          </span>
                        )}

                        {isOwner && (
                          <div className="w-24">
                            <NumberInput
                              value={item.discount}
                              onChange={(v) =>
                                updateItem(item.key, {
                                  discount: Math.min(v, item.price * item.qty),
                                })
                              }
                              placeholder="Diskon"
                              className="h-8 text-[13px]"
                            />
                          </div>
                        )}
                      </div>

                      {item.type === 'service' && (
                        <div className="mt-2">
                          <Select
                            value={item.mechanicId}
                            onChange={(e) => updateItem(item.key, { mechanicId: e.target.value })}
                            className="h-8 text-[12px]"
                          >
                            <option value="">— Pilih mekanik (opsional) —</option>
                            {(mechanics.data?.data || [])
                              .filter((m) => m.active !== false)
                              .map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))}
                          </Select>
                        </div>
                      )}

                      {isOwner && (
                        <p className="mt-1 text-right text-[11px] text-slate-400">
                          Subtotal {rupiah(item.price * item.qty - item.discount)}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {/* Ringkasan */}
              <div className="space-y-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
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
                <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
                  <span>Total</span>
                  <span className="tabular text-brand-700">{rupiah(total)}</span>
                </div>
              </div>
            </Card>

            {/* Pembayaran */}
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

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Diskon transaksi">
                    <NumberInput
                      value={discountAmount}
                      onChange={(v) => setDiscountAmount(Math.min(v, subtotal - itemDiscount))}
                      prefix="Rp"
                      className="h-9 text-[13px]"
                    />
                  </Field>
                  <Field label="Mekanik (default)">
                    <Select
                      value={defaultMechanic}
                      onChange={(e) => {
                        setDefaultMechanic(e.target.value);
                        setCart((prev) =>
                          prev.map((c) =>
                            c.type === 'service' && !c.mechanicId
                              ? { ...c, mechanicId: e.target.value }
                              : c
                          )
                        );
                      }}
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
                </div>

                {settings?.taxEnabled !== false && (
                  <Checkbox
                    label={`Kenakan PPN ${settings?.taxPercent ?? 0}%`}
                    checked={taxEnabled}
                    onChange={(e) => setTaxEnabled(e.target.checked)}
                  />
                )}

                <Textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Catatan (opsional)"
                  className="text-[13px]"
                />

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => submit('stay')}
                    loading={submitting}
                    disabled={!cart.length}
                  >
                    Simpan
                  </Button>
                  <Button
                    variant="accent"
                    size="lg"
                    icon="printer"
                    onClick={() => submit('print')}
                    loading={submitting}
                    disabled={!cart.length}
                  >
                    Bayar & Cetak
                  </Button>
                </div>
                {workOrderId && (
                  <p className="text-center text-[11px] text-slate-500">
                    Transaksi ini terhubung dengan work order{' '}
                    <button
                      className="text-brand-600 hover:underline"
                      onClick={() => navigate('/work-order')}
                    >
                      (lihat SPK)
                    </button>
                  </p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* -------------------------- Modal pelanggan -------------------------- */}
      <CustomerPicker
        open={customerModal}
        onClose={() => setCustomerModal(false)}
        onPick={(c, v) => {
          setCustomer(c);
          setVehicle(v || null);
          setCustomerModal(false);
        }}
        onReset={() => {
          setCustomer(null);
          setVehicle(null);
          setCustomerModal(false);
        }}
      />

      <ReceiptModal
        trx={lastTrx}
        settings={settings}
        autoPrint={!directPrint}
        onClose={() => setLastTrx(null)}
        onDone={() => {
          setLastTrx(null);
          clearAll();
        }}
      />
    </div>
  );
}

/* ======================== Pemilih pelanggan ======================== */

function CustomerPicker({
  open,
  onClose,
  onPick,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (customer: Customer, vehicle?: Vehicle | null) => void;
  onReset: () => void;
}) {
  const [q, setQ] = useState('');
  const { data, loading } = useApi<{ data: Customer[] }>(open ? `/api/customers${qs({ q })}` : null, [q]);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pilih pelanggan"
      subtitle="Cari berdasarkan nama, nomor HP, atau alamat"
      size="lg"
      footer={
        <Button variant="ghost" onClick={onReset}>
          Reset ke Pelanggan Umum
        </Button>
      }
    >
      <div className="space-y-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ketik nama pelanggan…"
          autoFocus
        />
        <div className="max-h-[52vh] overflow-y-auto">
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-400">Memuat…</p>
          ) : !data?.data.length ? (
            <p className="py-8 text-center text-sm text-slate-400">
              Pelanggan tidak ditemukan. Tambahkan dulu di menu Pelanggan.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.data.map((c) => (
                <li key={c.id}>
                  <div className="flex items-center gap-3 px-1 py-2.5">
                    <button
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                        <Icon name="user" size={17} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-slate-800">
                          {c.name}
                        </span>
                        <span className="block truncate text-[11px] text-slate-500">
                          {c.phone} · {c.vehicleCount || 0} kendaraan · {c.transactionCount || 0} transaksi
                        </span>
                      </span>
                    </button>
                    <Button size="xs" onClick={() => onPick(c, null)}>
                      Pilih
                    </Button>
                  </div>
                  {expanded === c.id && (
                    <div className="mb-2 ml-12 space-y-1.5 border-l-2 border-slate-100 pl-3">
                      {(c.vehicles || []).length === 0 ? (
                        <p className="text-[11px] text-slate-400">Belum ada kendaraan terdaftar.</p>
                      ) : (
                        (c.vehicles || []).map((v) => (
                          <button
                            key={v.id}
                            onClick={() => onPick(c, v)}
                            className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left transition hover:bg-brand-50"
                          >
                            <span className="text-[13px] font-medium text-slate-800">
                              {v.plateNumber}
                            </span>
                            <span className="truncate text-[11px] text-slate-500">
                              {v.brand} {v.model} {v.year ? `(${v.year})` : ''}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
