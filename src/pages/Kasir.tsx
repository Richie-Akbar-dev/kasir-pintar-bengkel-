import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/useApi';
import { rupiah } from '@/lib/format';
import type { Mechanic, Product, Service } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  NumberInput,
  Select,
  useToast,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import { beep, beepError } from '@/lib/hardware';

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

/** Keranjang disimpan sementara untuk halaman Pembayaran. */
export interface KasirCartSave {
  items: CartItem[];
  customerName: string;
  plateNumber: string;
  workOrderId: string | null;
}

export const KASIR_CART_KEY = 'kasir-cart';

export default function Kasir() {
  const { settings, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const isOwner = user?.role === 'owner';

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');

  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [workOrderId, setWorkOrderId] = useState<string | null>(params.get('wo'));
  const [submitting, setSubmitting] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

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
      .get<{
        data: {
          mechanicId: string;
          items: CartItem[];
          customerName: string;
          plateNumber: string;
        };
      }>(`/api/work-orders/${woId}`)
      .then((res) => {
        const wo = res.data;
        setWorkOrderId(woId);
        setCustomerName(wo.customerName || '');
        setPlateNumber(wo.plateNumber || '');
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
        toast.push('Item dari work order berhasil dimuat', 'info');
      })
      .catch(() => toast.push('Work order tidak ditemukan.', 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get('wo')]);

  /* -------------------------------- Katalog -------------------------------- */
  /** Jumlah item yang sudah ada di keranjang (untuk stok visual). */
  const reservedOf = useCallback(
    (key: string) => cart.find((c) => c.key === key)?.qty || 0,
    [cart]
  );

  const catalog = useMemo(() => {
    const list: Array<CartItem & { category: string; durationMin?: number }> = [];
    const needle = query.trim().toLowerCase();

    for (const p of products.data?.data || []) {
      if (p.active === false) continue;
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
  }, [products.data, services.data, query, category]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products.data?.data || []) set.add(p.category);
    for (const s of services.data?.data || []) set.add(s.category);
    return [...set].sort();
  }, [products.data, services.data]);

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
        return [...prev, { ...item }];
      });
    },
    [toast]
  );

  const updateItem = useCallback((key: string, patch: Partial<CartItem>) => {
    setCart((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }, []);

  const removeItem = useCallback((key: string) => {
    setCart((prev) => prev.filter((c) => c.key !== key));
  }, []);

  const clearAll = useCallback(() => {
    setCart([]);
    setCustomerName('');
    setPlateNumber('');
    setWorkOrderId(null);
    if (params.get('wo')) setParams({}, { replace: true });
  }, [params, setParams]);

  /* ---------------------------------- Total ---------------------------------- */
  const subtotal = cart.reduce((a, c) => a + c.price * c.qty, 0);
  const itemDiscount = cart.reduce((a, c) => a + c.discount, 0);
  const total = Math.max(0, subtotal - itemDiscount);

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

  /* --------------------------- A. Simpan → Work Order --------------------------- */
  async function saveWorkOrder() {
    if (!cart.length) return toast.push('Keranjang masih kosong.', 'error');
    if (!customerName.trim()) {
      beepError();
      return toast.push('Nama pelanggan wajib diisi.', 'error');
    }
    setSubmitting(true);
    try {
      const res = await api.post<{ data: { code: string } }>('/api/work-orders', {
        customerName: customerName.trim(),
        plateNumber: plateNumber.trim(),
        complaint: 'Pekerjaan dari kasir',
        status: 'menunggu',
        commitStock: true,
        items: cart.map((c) => ({
          type: c.type,
          refId: c.refId,
          qty: c.qty,
          price: c.price,
          discount: c.discount,
        })),
      });
      toast.push(`Work order ${res.data.code} tersimpan — stok sudah diperbarui.`);
      clearAll();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Gagal menyimpan work order.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------------------------- B. Bayar → halaman bayar ---------------------------- */
  function goToPayment() {
    if (!cart.length) return toast.push('Keranjang masih kosong.', 'error');
    const save: KasirCartSave = {
      items: cart,
      customerName: customerName.trim(),
      plateNumber: plateNumber.trim(),
      workOrderId,
    };
    sessionStorage.setItem(KASIR_CART_KEY, JSON.stringify(save));
    navigate('/kasir/bayar');
  }

  /* ---------------------------------- Render ---------------------------------- */
  return (
    <div className="pb-10">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        {/* ============================ KATALOG ============================ */}
        <div className="space-y-4 xl:col-span-3">
          <Card padded={false}>
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
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

              {/* Hasil */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {catalog.length === 0 ? (
                  <p className="col-span-full py-10 text-center text-sm text-slate-400">
                    Tidak ada item yang cocok.
                  </p>
                ) : (
                  catalog.map((item) => {
                    const reserved = reservedOf(item.key);
                    const avail = item.stock - reserved;
                    const empty = item.type === 'product' && avail <= 0;
                    return (
                      <button
                        key={item.key}
                        onClick={() => addToCart(item)}
                        disabled={empty}
                        className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${
                          empty
                            ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60'
                            : 'border-slate-200 bg-white hover:border-brand-400 hover:bg-brand-50/40 hover:shadow-sm'
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                            item.type === 'product'
                              ? 'bg-slate-100 text-slate-500'
                              : 'bg-accent-50 text-accent-600'
                          }`}
                        >
                          <Icon name={item.type === 'product' ? 'box' : 'wrench'} size={17} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-medium text-slate-800">
                            {item.name}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5">
                            <span className="font-mono text-[10px] text-slate-400">{item.code}</span>
                            <span className="text-[10px] text-slate-300">·</span>
                            <span className="truncate text-[10px] text-slate-400">
                              {item.category}
                            </span>
                          </span>
                          <span className="mt-1.5 flex items-center gap-2">
                            <span className="text-[13px] font-semibold tabular text-brand-700">
                              {rupiah(item.price)}
                            </span>
                            {item.type === 'product' && (
                              <Badge tone={avail <= 0 ? 'red' : avail <= 5 ? 'amber' : 'slate'}>
                                stok {avail} {item.unit}
                              </Badge>
                            )}
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* ============================ KERANJANG ============================ */}
        <div className="xl:col-span-2">
          <div className="space-y-4 xl:sticky xl:top-20">
            {/* Pelanggan — nama & plat diketik manual */}
            <Card padded={false}>
              <div className="space-y-3 px-4 py-3">
                <Field label="Nama pelanggan" required>
                  <Input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Contoh: Andi"
                    className="h-10 text-[13px]"
                  />
                </Field>
                <Field label="Plat nomor (opsional)">
                  <Input
                    value={plateNumber}
                    onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                    placeholder="Contoh: W 1234 AB"
                    className="h-10 text-[13px]"
                  />
                </Field>
                <p className="text-[11px] text-slate-400">
                  Nama dipakai sebagai pembeda antar pelanggan.
                </p>
              </div>
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
                <ul className="max-h-[42vh] divide-y divide-slate-100 overflow-y-auto">
                  {cart.map((item) => (
                    <li key={item.key} className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-slate-800">
                            {item.name}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                            <span className="font-mono">{item.code}</span>
                            <span>·</span>
                            <span>{rupiah(item.price)}</span>
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

              {/* Ringkasan + aksi */}
              <div className="space-y-3 border-t border-slate-100 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between text-[13px] text-slate-600">
                  <span>Subtotal</span>
                  <span className="tabular">{rupiah(subtotal)}</span>
                </div>
                {itemDiscount > 0 && (
                  <div className="flex items-center justify-between text-[13px] text-emerald-600">
                    <span>Diskon item</span>
                    <span className="tabular">-{rupiah(itemDiscount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
                  <span>Total</span>
                  <span className="tabular text-brand-700">{rupiah(total)}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="lg"
                    icon="clipboard"
                    onClick={saveWorkOrder}
                    loading={submitting}
                    disabled={!cart.length}
                  >
                    A. Simpan
                  </Button>
                  <Button
                    variant="accent"
                    size="lg"
                    icon="cash"
                    onClick={goToPayment}
                    disabled={!cart.length}
                  >
                    B. Bayar →
                  </Button>
                </div>
                <p className="text-center text-[11px] text-slate-500">
                  <strong>A. Simpan</strong> = barang masuk daftar pekerjaan (work order), stok
                  berkurang. · <strong>B. Bayar</strong> = lanjut ke halaman pembayaran.
                </p>
                {workOrderId && (
                  <p className="text-center text-[11px] text-slate-500">
                    Terhubung dengan work order{' '}
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
    </div>
  );
}
