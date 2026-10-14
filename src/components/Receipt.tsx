import { Fragment, useRef } from 'react';
import { renderToString } from 'react-dom/server';
import type { Settings, Transaction } from '@/lib/types';
import { PAYMENT_LABELS } from '@/lib/types';
import { rupiah, formatDateTime } from '@/lib/format';
import { Button } from './ui';

/** Struk thermal yang bisa langsung dicetak ke printer (58mm / 80mm). */
export function ReceiptBody({
  trx,
  settings,
  showCost = false,
}: {
  trx: Transaction;
  settings: Settings | null;
  showCost?: boolean;
}) {
  const width = settings?.receiptWidth === 80 ? 'receipt-80' : 'receipt-58';
  const cashier = trx.userName || '';

  return (
    <div className={`receipt ${width}`}>
      <div className="text-center">
        <p className="text-[1.15em] font-bold uppercase">{settings?.workshopName || 'BENGKEL'}</p>
        {settings?.tagline && <p className="text-[0.9em]">{settings.tagline}</p>}
        {settings?.address && <p className="mt-0.5">{settings.address}</p>}
        {settings?.phone && <p>{settings.phone}</p>}
      </div>

      <hr />

      <div className="row">
        <span>{trx.code}</span>
        <span>{formatDateTime(trx.date)}</span>
      </div>
      <div className="row">
        <span>Kasir: {cashier}</span>
        <span>{PAYMENT_LABELS[trx.paymentMethod] || trx.paymentMethod}</span>
      </div>
      <div>
        Pelanggan: {trx.customerName}
        {trx.plateNumber ? ` / ${trx.plateNumber}` : ''}
      </div>
      {trx.vehicleLabel && <div>Kendaraan: {trx.vehicleLabel}</div>}

      <hr />

      <table>
        <tbody>
          {(trx.items || []).map((item, i) => (
            <Fragment key={i}>
              <tr>
                <td colSpan={2} style={{ paddingTop: 3 }}>
                  {item.name}
                </td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 4, verticalAlign: 'top' }}>
                  {item.qty} {item.unit} x {rupiah(item.price)}
                  {item.discount > 0 ? ` (-${rupiah(item.discount)})` : ''}
                </td>
                <td style={{ textAlign: 'right', verticalAlign: 'top' }}>{rupiah(item.subtotal)}</td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>

      <hr />

      <div className="row">
        <span>Subtotal</span>
        <span>{rupiah(trx.subtotal)}</span>
      </div>
      {trx.discountTotal > 0 && (
        <div className="row">
          <span>Diskon</span>
          <span>-{rupiah(trx.discountTotal)}</span>
        </div>
      )}
      {trx.taxAmount > 0 && (
        <div className="row">
          <span>PPN {trx.taxPercent}%</span>
          <span>{rupiah(trx.taxAmount)}</span>
        </div>
      )}
      <div className="row" style={{ fontWeight: 'bold', fontSize: '1.1em', marginTop: 2 }}>
        <span>TOTAL</span>
        <span>{rupiah(trx.total)}</span>
      </div>

      {trx.paymentMethod === 'cash' && (
        <>
          <div className="row">
            <span>Tunai</span>
            <span>{rupiah(trx.paidAmount)}</span>
          </div>
          <div className="row">
            <span>Kembali</span>
            <span>{rupiah(trx.changeAmount)}</span>
          </div>
        </>
      )}
      {trx.paymentMethod === 'credit' && (
        <div className="row" style={{ fontWeight: 'bold' }}>
          <span>BELUM LUNAS (BON)</span>
          <span>{rupiah(trx.total)}</span>
        </div>
      )}

      {showCost && settings && (
        <>
          <hr />
          <div className="row">
            <span>Total modal</span>
            <span>
              {rupiah(
                (trx.items || []).reduce(
                  (a, it) => a + (it.type === 'product' ? (it.costPrice || 0) * it.qty : 0),
                  0
                )
              )}
            </span>
          </div>
        </>
      )}

      <hr />

      <div className="text-center">
        {settings?.footerNote && <p>{settings.footerNote}</p>}
        <p style={{ marginTop: 4 }}>Terima kasih atas kunjungan Anda</p>
        <p style={{ marginTop: 2 }}>— Semoga selamat sampai tujuan —</p>
      </div>

      {trx.status === 'void' && (
        <>
          <hr />
          <p className="text-center" style={{ fontWeight: 'bold' }}>
            *** TRANSAKSI DIBATALKAN ***
          </p>
          {trx.voidReason && <p className="text-center">{trx.voidReason}</p>}
        </>
      )}
    </div>
  );
}

/**
 * Cetak struk langsung ke dialog printer peramban (mode non-thermal).
 * Tidak menampilkan modal pratinjau — dialog printer muncul langsung.
 */
export function printReceipt(trx: Transaction, settings: Settings | null): void {
  const html = renderToString(<ReceiptBody trx={trx} settings={settings} />);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) return;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Struk ${trx.code}</title>
<style>
  @page { margin: 0; }
  body { margin: 0; background: #fff; }
  .receipt { font-family: 'Consolas','Courier New',ui-monospace,monospace; color: #000; background: #fff; }
  .receipt-58 { width: 58mm; padding: 2mm; font-size: 10.5px; line-height: 1.35; }
  .receipt-80 { width: 80mm; padding: 3mm; font-size: 12px; line-height: 1.4; }
  .receipt hr { border: none; border-top: 1px dashed #000; margin: 3px 0; }
  .receipt table { width: 100%; border-collapse: collapse; }
  .receipt .row { display: flex; justify-content: space-between; gap: 6px; }
  [class~="text-center"] { text-align: center; }
  [class~="font-bold"] { font-weight: bold; }
  [class~="uppercase"] { text-transform: uppercase; }
  [class~="text-[1.15em]"] { font-size: 1.15em; }
  [class~="text-[0.9em]"] { font-size: 0.9em; }
  [class~="mt-0.5"] { margin-top: 2px; }
</style></head><body>${html}</body></html>`);
  doc.close();
  const win = iframe.contentWindow;
  if (win) {
    win.focus();
    win.print();
  }
  setTimeout(() => iframe.remove(), 1500);
}

/** Modal struk dengan tombol cetak. */
export default function ReceiptModal({
  trx,
  settings,
  onClose,
  onDone,
  autoPrint = false,
}: {
  trx: Transaction | null;
  settings: Settings | null;
  onClose: () => void;
  onDone?: () => void;
  autoPrint?: boolean;
}) {
  const printed = useRef(false);

  if (!trx) return null;

  // Cetak otomatis sekali setelah struk tampil
  if (autoPrint && !printed.current && settings?.printAutoOpen) {
    printed.current = true;
    setTimeout(() => window.print(), 350);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div className="animate-slide-up relative z-10 w-full max-w-md">
        <div className="no-print mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Transaksi tersimpan</h2>
            <p className="text-xs text-slate-300">Kode {trx.code}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-slate-300 hover:bg-white/10" aria-label="Tutup">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="print-area mx-auto w-fit rounded-lg bg-white p-2 shadow-2xl">
          <ReceiptBody trx={trx} settings={settings} />
        </div>

        <div className="no-print mt-4 flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="accent"
            icon="printer"
            onClick={() => window.print()}
          >
            Cetak Struk
          </Button>
          {onDone && (
            <Button variant="secondary" icon="plus" onClick={onDone}>
              Transaksi Baru
            </Button>
          )}
          <Button variant="outline" onClick={onClose} className="bg-white">
            Tutup
          </Button>
        </div>
        <p className="no-print mt-3 text-center text-[11px] text-slate-300">
          Kertas struk dapat diubah (58mm / 80mm) di menu Pengaturan.
        </p>
      </div>
    </div>
  );
}
