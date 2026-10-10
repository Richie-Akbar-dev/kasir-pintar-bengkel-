import { useId, useState } from 'react';
import { rupiah, rupiahShort } from '@/lib/format';

export interface Point {
  label: string;
  value: number;
  secondary?: number;
}

/** Grafik batang sederhana (SVG, tanpa library). */
export function BarChart({
  data,
  height = 180,
  color = '#3361f6',
  formatValue = rupiah,
}: {
  data: Point[];
  height?: number;
  color?: string;
  formatValue?: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => Math.max(d.value, d.secondary || 0)));
  const barWidth = 100 / Math.max(1, data.length);
  const active = hover !== null ? data[hover] : null;

  return (
    <div className="relative">
      {active && (
        <div className="pointer-events-none absolute -top-1 right-0 z-10 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg">
          <p className="font-medium">{active.label}</p>
          <p className="tabular text-slate-300">{formatValue(active.value)}</p>
          {active.secondary !== undefined && active.secondary !== null && (
            <p className="tabular text-emerald-300">Laba {formatValue(active.secondary)}</p>
          )}
        </div>
      )}
      <svg
        viewBox={`0 0 ${data.length * 10} 100`}
        preserveAspectRatio="none"
        style={{ height }}
        className="w-full"
      >
        {[0, 25, 50, 75, 100].map((y) => (
          <line
            key={y}
            x1="0"
            x2={data.length * 10}
            y1={100 - y}
            y2={100 - y}
            stroke="#e2e8f0"
            strokeWidth="0.35"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {data.map((d, i) => {
          const h = Math.max(0, (d.value / max) * 96);
          const h2 = Math.max(0, ((d.secondary || 0) / max) * 96);
          const isHover = hover === i;
          return (
            <g key={d.label + i}>
              {d.secondary !== undefined && d.secondary !== null && (
                <rect
                  x={i * 10 + barWidth * 0.12}
                  y={100 - h2}
                  width={barWidth * 0.42}
                  height={h2}
                  fill="#10b981"
                  opacity={isHover ? 1 : 0.62}
                  rx="0.8"
                />
              )}
              <rect
                x={i * 10 + barWidth * 0.5}
                y={100 - h}
                width={barWidth * 0.42}
                height={h}
                fill={color}
                opacity={isHover ? 1 : 0.82}
                rx="0.8"
              />
              <rect
                x={i * 10}
                y="0"
                width="10"
                height="100"
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex justify-between text-[10px] text-slate-400">
        {data.map((d, i) =>
          i % Math.ceil(data.length / 7) === 0 || i === data.length - 1 ? (
            <span key={d.label + i}>{d.label}</span>
          ) : (
            <span key={d.label + i} />
          )
        )}
      </div>
    </div>
  );
}

/** Grafik area (omzet) dengan dua seri opsional. */
export function AreaChart({
  data,
  height = 200,
  color = '#3361f6',
  secondaryColor = '#10b981',
}: {
  data: Point[];
  height?: number;
  color?: string;
  secondaryColor?: string;
}) {
  const id = useId();
  const max = Math.max(1, ...data.map((d) => Math.max(d.value, d.secondary || 0)));
  const step = data.length > 1 ? 100 / (data.length - 1) : 100;

  const line = (key: 'value' | 'secondary') =>
    data
      .map((d, i) => {
        const v = Math.max(0, key === 'value' ? d.value : d.secondary || 0);
        const y = 96 - (v / max) * 92;
        return `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');

  const area = (key: 'value' | 'secondary') =>
    `${line(key)} L100,100 L0,100 Z`;

  return (
    <div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height }} className="w-full">
        <defs>
          <linearGradient id={`g-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`g2-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={secondaryColor} stopOpacity="0.22" />
            <stop offset="100%" stopColor={secondaryColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 25, 50, 75, 100].map((y) => (
          <line
            key={y}
            x1="0"
            x2="100"
            y1={100 - y}
            y2={100 - y}
            stroke="#e2e8f0"
            strokeWidth="0.3"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {data.some((d) => d.secondary !== undefined && d.secondary !== null) && (
          <>
            <path d={area('secondary')} fill={`url(#g2-${id})`} />
            <path d={line('secondary')} fill="none" stroke={secondaryColor} strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
          </>
        )}
        <path d={area('value')} fill={`url(#g-${id})`} />
        <path d={line('value')} fill="none" stroke={color} strokeWidth="0.9" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-2 flex justify-between text-[10px] text-slate-400">
        {data.map((d, i) =>
          i % Math.ceil(data.length / 8) === 0 || i === data.length - 1 ? (
            <span key={d.label + i}>{d.label}</span>
          ) : (
            <span key={d.label + i} />
          )
        )}
      </div>
    </div>
  );
}

/** Batang horizontal untuk peringkat (top items, kategori, dll). */
export function RankBars({
  items,
  formatValue = rupiahShort,
}: {
  items: Array<{ name: string; value: number; caption?: string }>;
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => Math.max(0, i.value)));
  if (!items.length) return <p className="py-6 text-center text-sm text-slate-400">Belum ada data.</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={item.name + i}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate text-[13px] text-slate-700">{item.name}</span>
            <span className="shrink-0 text-[13px] font-medium tabular text-slate-900">
              {formatValue(item.value)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
            />
          </div>
          {item.caption && <p className="mt-0.5 text-[11px] text-slate-400">{item.caption}</p>}
        </li>
      ))}
    </ul>
  );
}

/** Donut sederhana untuk komposisi metode pembayaran. */
export function DonutChart({
  items,
  size = 168,
}: {
  items: Array<{ label: string; value: number; color: string }>;
  size?: number;
}) {
  const total = items.reduce((a, b) => a + b.value, 0);
  if (!total) return <p className="py-6 text-center text-sm text-slate-400">Belum ada data.</p>;

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <svg width={size} height={size} viewBox="0 0 100 100" className="shrink-0">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="16" />
        {items.map((item) => {
          const fraction = item.value / total;
          const dash = fraction * circumference;
          const el = (
            <circle
              key={item.label}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth="16"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 50 50)"
            />
          );
          offset += dash;
          return el;
        })}
        <text x="50" y="47" textAnchor="middle" fontSize="9" fill="#64748b">
          Total
        </text>
        <text x="50" y="58" textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#0f172a">
          {rupiahShort(total)}
        </text>
      </svg>
      <ul className="w-full space-y-1.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="truncate text-slate-600">{item.label}</span>
            </span>
            <span className="shrink-0 tabular text-slate-900">
              {Math.round((item.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
