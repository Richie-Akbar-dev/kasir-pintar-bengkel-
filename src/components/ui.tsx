import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Icon, type IconName } from './icons';

/* ============================== Button ============================== */

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'accent';
type Size = 'xs' | 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm shadow-brand-600/25 border border-transparent',
  secondary:
    'bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 border border-transparent shadow-sm',
  outline:
    'bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 border border-slate-300',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 active:bg-slate-200 border border-transparent',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 border border-transparent shadow-sm',
  success:
    'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 border border-transparent shadow-sm',
  accent:
    'bg-accent-500 text-white hover:bg-accent-600 active:bg-accent-700 border border-transparent shadow-sm shadow-accent-500/25',
};

const SIZES: Record<Size, string> = {
  xs: 'h-7 px-2 text-xs gap-1 rounded-md',
  sm: 'h-8.5 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-12 px-5 text-base gap-2 rounded-xl',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  loading?: boolean;
  block?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  block,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center font-medium transition-colors select-none
        focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-1
        disabled:opacity-50 disabled:cursor-not-allowed
        ${VARIANTS[variant]} ${SIZES[size]} ${block ? 'w-full' : ''} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Spinner /> : icon ? <Icon name={icon} size={size === 'xs' ? 13 : size === 'lg' ? 19 : 16} /> : null}
      {children}
    </button>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ============================== Inputs ============================== */

export function Field({
  label,
  hint,
  required,
  error,
  children,
  className = '',
}: {
  label?: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      {label && (
        <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </span>
      )}
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-slate-500">{hint}</span>
      ) : null}
    </label>
  );
}

const inputBase =
  'w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 ' +
  'transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-100 disabled:text-slate-500';

export function Input({
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputBase} h-10 ${className}`} {...rest} />;
}

export function Textarea({
  className = '',
  rows = 3,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows} className={`${inputBase} py-2 ${className}`} {...rest} />;
}

export function Select({
  className = '',
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${inputBase} h-10 pr-8 ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode }) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700 ${className}`}>
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500/30"
        {...rest}
      />
      {label}
    </label>
  );
}

/**
 * Input angka dengan pemisah ribuan otomatis.
 * Nilai disimpan sebagai angka murni; yang tampil diformat.
 */
export function NumberInput({
  value,
  onChange,
  className = '',
  prefix,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number | string;
  onChange: (value: number) => void;
  prefix?: string;
}) {
  const [text, setText] = useState(() => formatGrouped(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(formatGrouped(value));
  }, [value]);

  return (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
          {prefix}
        </span>
      )}
      <input
        {...rest}
        inputMode="numeric"
        className={`${inputBase} h-10 tabular ${prefix ? 'pl-9' : ''} ${className}`}
        value={text}
        onFocus={(e) => {
          focused.current = true;
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          focused.current = false;
          setText(formatGrouped(value));
          rest.onBlur?.(e);
        }}
        onChange={(e) => {
          const raw = e.target.value;
          const digits = raw.replace(/[^\d]/g, '');
          setText(digits ? grouped(digits) : '');
          onChange(digits ? Number(digits) : 0);
        }}
      />
    </div>
  );
}

function grouped(digits: string) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
function formatGrouped(value: number | string) {
  const digits = String(value ?? '').replace(/[^\d]/g, '');
  return digits ? grouped(digits) : '';
}

/* ============================== Card ============================== */

export function Card({
  title,
  subtitle,
  action,
  children,
  className = '',
  bodyClass = '',
  padded = true,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
  padded?: boolean;
}) {
  return (
    <section className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="truncate text-sm font-semibold text-slate-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={`${padded ? 'p-4' : ''} ${bodyClass}`}>{children}</div>
    </section>
  );
}

/* ============================== Badge ============================== */

const TONES: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  blue: 'bg-brand-50 text-brand-700 ring-brand-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  cyan: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
};

export function Badge({
  children,
  tone = 'slate',
  className = '',
}: {
  children: ReactNode;
  tone?: keyof typeof TONES | string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
        TONES[tone] || TONES.slate
      } ${className}`}
    >
      {children}
    </span>
  );
}

/* ============================== Modal ============================== */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={`animate-slide-up relative z-10 w-full ${widths[size]} rounded-xl bg-white shadow-2xl ring-1 ring-slate-900/10`}
        role="dialog"
        aria-modal="true"
      >
        {(title || subtitle) && (
          <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">{title}</h2>
              {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Tutup"
            >
              <Icon name="x" size={18} />
            </button>
          </header>
        )}
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Konfirmasi',
  message,
  confirmLabel = 'Ya, lanjutkan',
  danger = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{message}</p>
    </Modal>
  );
}

/* ============================== Table ============================== */

export function TableWrap({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({
  children,
  className = '',
  align = 'left',
}: {
  children?: ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
}) {
  const map = { left: 'text-left', right: 'text-right', center: 'text-center' };
  return (
    <th
      className={`whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 ${map[align]} ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className = '',
  align = 'left',
}: {
  children?: ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
}) {
  const map = { left: 'text-left', right: 'text-right', center: 'text-center' };
  return (
    <td className={`border-b border-slate-100 px-3 py-2.5 align-middle text-slate-700 ${map[align]} ${className}`}>
      {children}
    </td>
  );
}

/* ============================ Empty state ============================ */

export function EmptyState({
  icon = 'info',
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon name={icon} size={22} />
      </div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingBlock({ label = 'Memuat data…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-14 text-sm text-slate-500">
      <Spinner /> {label}
    </div>
  );
}

/* ============================ Pagination ============================ */

export function Pagination({
  page,
  totalPages,
  totalRows,
  onPage,
}: {
  page: number;
  totalPages: number;
  totalRows?: number;
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1 && !totalRows) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
      <p className="text-xs text-slate-500">
        {totalRows !== undefined ? `${totalRows} data · ` : ''}Halaman {page} dari {Math.max(1, totalPages)}
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          size="xs"
          variant="outline"
          icon="chevronLeft"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Sebelumnya
        </Button>
        <Button
          size="xs"
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Berikutnya <Icon name="chevronRight" size={13} />
        </Button>
      </div>
    </div>
  );
}

/* ============================== Toast ============================== */

type ToastTone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

const ToastContext = createContext<{ push: (message: string, tone?: ToastTone) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, tone, message }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-full max-w-sm flex-col gap-2 print:hidden">
        {items.map((t) => (
          <div
            key={t.id}
            className={`animate-fade-in pointer-events-auto flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-sm shadow-lg ring-1 ${
              t.tone === 'success'
                ? 'bg-emerald-600 text-white ring-emerald-700'
                : t.tone === 'error'
                  ? 'bg-red-600 text-white ring-red-700'
                  : 'bg-slate-800 text-white ring-slate-900'
            }`}
          >
            <Icon
              name={t.tone === 'success' ? 'check' : t.tone === 'error' ? 'alert' : 'info'}
              size={17}
              className="mt-0.5 shrink-0"
            />
            <span className="leading-snug">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast harus dipakai di dalam <ToastProvider>');
  return ctx;
}

/* ============================ Komponen lain ============================ */

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'brand',
  loading,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: IconName;
  tone?: 'brand' | 'accent' | 'green' | 'red' | 'violet' | 'cyan' | 'slate';
  loading?: boolean;
}) {
  const tones: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-600',
    slate: 'bg-slate-100 text-slate-600',
    accent: 'bg-accent-50 text-accent-600',
    green: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    violet: 'bg-violet-50 text-violet-600',
    cyan: 'bg-cyan-50 text-cyan-600',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-500">{label}</p>
          {loading ? (
            <div className="mt-2 h-6 w-24 animate-pulse rounded bg-slate-100" />
          ) : (
            <p className="mt-1 truncate text-xl font-semibold tabular text-slate-900">{value}</p>
          )}
          {hint && <p className="mt-1 truncate text-xs text-slate-500">{hint}</p>}
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon name={icon} size={18} />
        </div>
      </div>
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Cari…',
  className = '',
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className={`relative ${className}`}>
      <Icon
        name="search"
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <input
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputBase} h-10 pl-9 ${className}`}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Bersihkan"
        >
          <Icon name="x" size={13} />
        </button>
      )}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <span className="flex items-center gap-2">
        <Icon name="alert" size={17} /> {message}
      </span>
      {onRetry && (
        <Button size="xs" variant="outline" icon="refresh" onClick={onRetry}>
          Coba lagi
        </Button>
      )}
    </div>
  );
}
