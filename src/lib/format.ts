/** Format angka & tanggal dalam gaya Indonesia. */

const rupiahFmt = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const numberFmt = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

export function rupiah(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'Rp 0';
  return rupiahFmt.format(Number(value));
}

/** Ringkas untuk angka besar pada kartu: Rp 12,5 jt / Rp 850 rb */
export function rupiahShort(value: number | null | undefined): string {
  const n = Number(value || 0);
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1).replace('.', ',')} M`;
  if (abs >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1).replace('.', ',')} jt`;
  if (abs >= 1_000) return `Rp ${Math.round(n / 1_000)} rb`;
  return `Rp ${n}`;
}

export function number(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '0';
  return numberFmt.format(Number(value));
}

/** Pemisah ribuan untuk kolom input angka. */
export function groupDigits(raw: string | number): string {
  const s = String(raw ?? '');
  if (!s) return '';
  const negative = s.trimStart().startsWith('-');
  const digits = s.replace(/[^\d]/g, '');
  if (!digits) return s;
  return (negative ? '-' : '') + numberFmt.format(Number(digits));
}

/** Hilangkan pemisah ribuan untuk dikirim ke server. */
export function ungroupDigits(raw: string | number): number {
  if (typeof raw === 'number') return raw;
  const cleaned = String(raw ?? '').replace(/[^\d-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export function todayInput(): string {
  return toInputDate(new Date());
}

export function toInputDate(value: string | Date): string {
  const d = new Date(value);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Awal & akhir bulan berjalan dalam format YYYY-MM-DD. */
export function monthRange(offset = 0): { from: string; to: string } {
  const start = new Date();
  start.setDate(1);
  start.setMonth(start.getMonth() + offset);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  return { from: toInputDate(start), to: toInputDate(end) };
}

export function daysAgoInput(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toInputDate(d);
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${names[Number(m) - 1] || m} ${y}`;
}

export function relativeDay(value: string | Date): string {
  const d = new Date(value);
  const now = new Date();
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = Math.round((b - a) / 86400000);
  if (diff === 0) return `Hari ini, ${formatTime(d)}`;
  if (diff === 1) return `Kemarin, ${formatTime(d)}`;
  return formatDateTime(d);
}
