import { useState } from 'react';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/useApi';
import { rupiah, formatDateTime, monthRange, todayInput } from '@/lib/format';
import { PAYMENT_LABELS, type Paginated, type Transaction } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  LoadingBlock,
  Modal,
  Pagination,
  SearchInput,
  Select,
  Td,
  TableWrap,
  Th,
  useToast,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import ReceiptModal from '@/components/Receipt';
import { isDirectPrint, printTransaction } from '@/lib/hardware';

export default function Riwayat() {
  const { settings, user } = useAuth();
  const toast = useToast();
  const isOwner = user?.role === 'owner';

  const [range, setRange] = useState<'today' | 'month' | 'all' | 'custom'>('month');
  const [from, setFrom] = useState(monthRange().from);
  const [to, setTo] = useState(monthRange().to);
  const [q, setQ] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);

  const [detail, setDetail] = useState<Transaction | null>(null);
  const [receiptTrx, setReceiptTrx] = useState<Transaction | null>(null);
  const [voidTarget, setVoidTarget] = useState<Transaction | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const effectiveFrom = range === 'today' ? todayInput() : range === 'all' ? '' : from;
  const effectiveTo = range === 'today' ? todayInput() : range === 'all' ? '' : to;

  const { data, loading, error, reload } = useApi<Paginated<Transaction>>(
    `/api/transactions${qs({
      from: effectiveFrom,
      to: effectiveTo,
      q,
      paymentMethod,
      status,
      page,
      limit: 25,
    })}`,
    [effectiveFrom, effectiveTo, q, paymentMethod, status, page]
  );

  async function openDetail(id: string) {
    try {
      const res = await api.get<{ data: Transaction }>(`/api/transactions/${id}`);
      setDetail(res.data);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Gagal memuat detail.', 'error');
    }
  }

  async function doVoid() {
    if (!voidTarget) return;
    try {
      await api.post(`/api/transactions/${voidTarget.id}/void`, { reason: voidReason });
      toast.push('Transaksi dibatalkan & stok dikembalikan.');
      setVoidTarget(null);
      setVoidReason('');
      setDetail(null);
      reload();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Gagal membatalkan.', 'error');
    }
  }

  async function settle(trx: Transaction) {
    try {
      await api.post(`/api/transactions/${trx.id}/settle`);
      toast.push('Piutang ditandai lunas.');
      reload();
      if (detail?.id === trx.id) setDetail({ ...detail, creditSettled: true });
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Gagal memperbarui.', 'error');
    }
  }

  const rows = data?.data || [];
  const meta = data?.meta;
  const directPrint = isDirectPrint(settings);

  /** Cetak ulang: langsung ke printer bila dikonfigurasi,否则 buka pratinjau. */
  async function cetak(trx: Transaction) {
    if (!directPrint) {
      setReceiptTrx(trx);
      return;
    }
    try {
      await printTransaction(trx.id);
      toast.push('Struk dikirim ke printer.');
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Gagal mencetak.', 'error');
    }
  }

  return (
    <div className="space-y-5">
      {/* ------------------------------ Filter ------------------------------ */}
      <Card padded={false}>
        <div className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex rounded-lg bg-slate-100 p-0.5">
            {(
              [
                ['today', 'Hari ini'],
                ['month', 'Bulan ini'],
                ['all', 'Semua'],
                ['custom', 'Kustom'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => {
                  setRange(key);
                  setPage(1);
                }}
                className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition ${
                  range === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {range === 'custom' && (
            <>
              <Field label="Dari" className="w-40">
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
              </Field>
              <Field label="Sampai" className="w-40">
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
              </Field>
            </>
          )}

          <SearchInput
            value={q}
            onChange={(v) => {
              setQ(v);
              setPage(1);
            }}
            placeholder="Cari kode / pelanggan / plat…"
            className="min-w-[220px] flex-1"
          />

          <Field label="Pembayaran" className="w-44">
            <Select
              value={paymentMethod}
              onChange={(e) => {
                setPaymentMethod(e.target.value);
                setPage(1);
              }}
              className="h-9"
            >
              <option value="">Semua</option>
              {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Status" className="w-36">
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="h-9"
            >
              <option value="all">Semua</option>
              <option value="paid">Aktif</option>
              <option value="void">Dibatalkan</option>
            </Select>
          </Field>

          {isOwner && (
            <Button
              variant="outline"
              icon="download"
              onClick={() => {
                const url = `/api/transactions/export/csv${qs({
                  from: effectiveFrom,
                  to: effectiveTo,
                })}`;
                window.open(url, '_blank');
              }}
            >
              Ekspor CSV
            </Button>
          )}
        </div>
      </Card>

      {/* ------------------------------ Tabel ------------------------------ */}
      <Card padded={false}>
        {error ? (
          <div className="p-4">
            <ErrorBanner message={error} onRetry={reload} />
          </div>
        ) : loading && !data ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="receipt"
            title="Belum ada transaksi"
            description="Transaksi yang Anda simpan di menu Kasir akan muncul di sini."
          />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <Th>Kode</Th>
                  <Th>Waktu</Th>
                  <Th>Pelanggan</Th>
                  <Th>Item</Th>
                  <Th>Pembayaran</Th>
                  <Th>Kasir</Th>
                  <Th align="right">Total</Th>
                  <Th align="center">Aksi</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className={t.status === 'void' ? 'bg-red-50/40' : 'hover:bg-slate-50'}>
                    <Td className="font-mono text-xs">{t.code}</Td>
                    <Td className="whitespace-nowrap text-xs text-slate-500">{formatDateTime(t.date)}</Td>
                    <Td>
                      <span className="block truncate font-medium text-slate-800">{t.customerName}</span>
                      {t.plateNumber && (
                        <span className="block text-[11px] text-slate-400">{t.plateNumber}</span>
                      )}
                    </Td>
                    <Td className="text-xs text-slate-500">
                      {(t.items || []).reduce((a, i) => a + i.qty, 0)} item
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={t.paymentMethod === 'credit' ? 'amber' : 'slate'}>
                          {PAYMENT_LABELS[t.paymentMethod] || t.paymentMethod}
                        </Badge>
                        {t.paymentMethod === 'credit' && !t.creditSettled && (
                          <Badge tone="red">Bon</Badge>
                        )}
                        {t.status === 'void' && <Badge tone="red">Batal</Badge>}
                      </div>
                    </Td>
                    <Td className="text-xs text-slate-500">{t.userName || '-'}</Td>
                    <Td align="right" className="font-semibold tabular">
                      {rupiah(t.total)}
                    </Td>
                    <Td align="center">
                      <div className="flex items-center justify-center gap-1">
                        <Button size="xs" variant="ghost" onClick={() => openDetail(t.id)}>
                          Detail
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => cetak(t)}
                          aria-label="Cetak"
                          title={directPrint ? 'Cetak ke printer thermal' : 'Tampilkan struk'}
                        >
                          <Icon name="printer" size={14} />
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>

            {meta && (
              <div className="border-t border-slate-100 bg-slate-50 px-4 py-2.5">
                <p className="text-xs text-slate-500">
                  Total omzet pada filter ini:{' '}
                  <span className="font-semibold text-slate-800">{rupiah(meta.totalOmzet || 0)}</span>
                </p>
              </div>
            )}

            {meta && (
              <Pagination
                page={meta.page}
                totalPages={meta.totalPages}
                totalRows={meta.totalRows}
                onPage={setPage}
              />
            )}
          </>
        )}
      </Card>

      {/* ------------------------------ Detail ------------------------------ */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `Transaksi ${detail.code}` : ''}
        subtitle={detail ? formatDateTime(detail.date) : ''}
        size="lg"
        footer={
          detail && (
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                {isOwner && detail.status !== 'void' && (
                  <Button size="sm" variant="danger" icon="trash" onClick={() => setVoidTarget(detail)}>
                    Batalkan transaksi
                  </Button>
                )}
                {detail.paymentMethod === 'credit' && !detail.creditSettled && (
                  <Button size="sm" variant="success" icon="check" onClick={() => settle(detail)}>
                    Tandai lunas
                  </Button>
                )}
              </div>
              <Button size="sm" variant="secondary" icon="printer" onClick={() => cetak(detail)}>
                {directPrint ? 'Cetak ke printer' : 'Cetak struk'}
              </Button>
            </div>
          )
        }
      >
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-[13px] sm:grid-cols-4">
              <Info label="Pelanggan" value={detail.customerName} />
              <Info label="Kendaraan" value={detail.plateNumber || '-'} />
              <Info label="Kasir" value={detail.userName || '-'} />
              <Info label="Status" value={detail.status === 'void' ? 'Dibatalkan' : 'Aktif'} />
            </div>

            <TableWrap>
              <thead>
                <tr>
                  <Th>Item</Th>
                  <Th align="right">Qty</Th>
                  <Th align="right">Harga</Th>
                  <Th align="right">Diskon</Th>
                  <Th align="right">Subtotal</Th>
                </tr>
              </thead>
              <tbody>
                {(detail.items || []).map((item, i) => (
                  <tr key={i}>
                    <Td>
                      <span className="block font-medium text-slate-800">{item.name}</span>
                      <span className="text-[11px] text-slate-400">
                        {item.type === 'product' ? 'Sparepart' : 'Jasa'} · {item.code}
                      </span>
                    </Td>
                    <Td align="right" className="tabular">
                      {item.qty} {item.unit}
                    </Td>
                    <Td align="right" className="tabular">
                      {rupiah(item.price)}
                    </Td>
                    <Td align="right" className="tabular text-emerald-600">
                      {item.discount ? `-${rupiah(item.discount)}` : '-'}
                    </Td>
                    <Td align="right" className="tabular font-medium">
                      {rupiah(item.subtotal)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>

            <div className="ml-auto w-full max-w-xs space-y-1.5 text-[13px]">
              <Line label="Subtotal" value={rupiah(detail.subtotal)} />
              <Line label="Diskon" value={`-${rupiah(detail.discountTotal)}`} tone="green" />
              {detail.taxAmount > 0 && (
                <Line label={`PPN ${detail.taxPercent}%`} value={rupiah(detail.taxAmount)} />
              )}
              <Line label="Total" value={rupiah(detail.total)} strong />
              {detail.paymentMethod === 'cash' && (
                <>
                  <Line label="Dibayar" value={rupiah(detail.paidAmount)} />
                  <Line label="Kembali" value={rupiah(detail.changeAmount)} />
                </>
              )}
            </div>

            {detail.note && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[13px] text-slate-600">
                <span className="font-medium">Catatan:</span> {detail.note}
              </div>
            )}
            {detail.status === 'void' && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">
                Dibatalkan oleh {detail.voidedBy || '-'}
                {detail.voidReason ? ` · ${detail.voidReason}` : ''}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ------------------------------ Void ------------------------------ */}
      <Modal
        open={!!voidTarget}
        onClose={() => setVoidTarget(null)}
        title="Batalkan transaksi"
        subtitle="Stok sparepart akan dikembalikan ke gudang"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setVoidTarget(null)}>
              Batal
            </Button>
            <Button variant="danger" onClick={doVoid}>
              Ya, batalkan
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Transaksi <span className="font-medium">{voidTarget?.code}</span> senilai{' '}
            <span className="font-medium">{rupiah(voidTarget?.total || 0)}</span> akan dibatalkan.
          </p>
          <Field label="Alasan pembatalan">
            <Input
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="mis. salah input, barang dikembalikan"
            />
          </Field>
        </div>
      </Modal>

      <ReceiptModal trx={receiptTrx} settings={settings} onClose={() => setReceiptTrx(null)} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="truncate font-medium text-slate-800">{value}</p>
    </div>
  );
}

function Line({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'green';
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span
        className={`tabular ${strong ? 'text-base font-bold' : 'font-medium'} ${
          tone === 'green' ? 'text-emerald-600' : 'text-slate-900'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
