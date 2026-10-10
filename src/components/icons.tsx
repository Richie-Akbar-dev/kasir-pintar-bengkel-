import type { SVGProps } from 'react';

/** Kumpulan ikon SVG inline (stroke-based, 24x24) — tanpa dependency eksternal. */
const PATHS: Record<string, string> = {
  dashboard: 'M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z',
  cart: 'M3 4h2l2.4 11.2A2 2 0 0 0 9.4 17h8.3a2 2 0 0 0 2-1.6L21 8H6M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 6h6M9 13h6',
  wrench:
    'M14.7 6.3a4 4 0 0 0 5 5l-9.3 9.3a2.1 2.1 0 0 1-3-3l9.3-9.3-2-2Z',
  box: 'M12 3 4 7v10l8 4 8-4V7l-8-4Zm0 0v18M4 7l8 4 8-4',
  users: 'M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 4a3.25 3.25 0 1 1 0 6.5 3.25 3.25 0 0 1 0-6.5ZM21 20v-1a4 4 0 0 0-3-3.87M16.5 4.13a4 4 0 0 1 0 7.75',
  user: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  wallet: 'M20 8V7a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6m13 8h3',
  chart: 'M4 20V10m5 10V4m5 16v-7m5 7V8',
  settings:
    'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8.4-2.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.87 1.2V20a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.87-1.2l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4 15H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 11 4.5V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.87 1.2l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.6 11H20a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5.2-1.8L21 21',
  trash: 'M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13M10 11v6m4-6v6',
  edit: 'M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z',
  x: 'M6 6l12 12M18 6 6 18',
  check: 'M5 13l4 4L19 7',
  printer: 'M7 8V3h10v5M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M7 14h10v7H7v-7Z',
  chevronLeft: 'M15 6l-6 6 6 6',
  chevronRight: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  chevronUp: 'M18 15l-6-6-6 6',
  alert: 'M12 9v4m0 3h.01M10.3 4.3 2.6 17.6A2 2 0 0 0 4.3 20.6h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5m5 5H3',
  menu: 'M4 7h16M4 12h16M4 17h16',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3 2',
  download: 'M12 4v11m0 0 4-4m-4 4-4-4M4 19h16',
  upload: 'M12 20V9m0 0 4 4m-4-4-4 4M4 5h16',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6',
  car: 'M5 16h14M6.5 16V9.5L8 6h8l1.5 3.5V16M7 19h2m6 0h2M6 9.5h12',
  motorcycle:
    'M5 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm14 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8 15h6l2-5h2M8 15l-3-5H3m5 5V9h3l2 5',
  clipboard: 'M9 4h6v3H9V4Zm-3 3h12v13H6V7Zm3 5h6m-6 3h4',
  phone: 'M6.6 3h2.1l1.5 4-2 1.4a11 11 0 0 0 5.4 5.4l1.4-2 4 1.5v2.1A2 2 0 0 1 16.8 21 15.8 15.8 0 0 1 3 7.2 2 2 0 0 1 4.9 5.2',
  filter: 'M4 5h16l-6 7v6l-4-2v-4L4 5Z',
  database: 'M12 7c4.4 0 8-1.1 8-2.5S16.4 2 12 2 4 3.1 4 4.5 7.6 7 12 7Zm8 0v5c0 1.4-3.6 2.5-8 2.5S4 13.4 4 12V7m16 5v5c0 1.4-3.6 2.5-8 2.5S4 18.4 4 17v-5',
  save: 'M5 4h11l3 3v13H5V4Zm4 3h6v5H9V7Zm3 8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  cash: 'M4 7h16v10H4V7Zm8 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM6 10v4m12-4v4',
  sparkles: 'M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13h.01M12 11v5',
};

export type IconName = keyof typeof PATHS;

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 18, ...rest }: IconProps) {
  const d = PATHS[name] || PATHS.info;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={d} />
    </svg>
  );
}
