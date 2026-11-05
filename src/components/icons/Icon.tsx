import type { ReactNode } from "react";

/** The Butler's own line icon set: 24px grid, 1.5px stroke, round caps and joins. */

function gearPath(): string {
  const teeth = 8;
  const innerRadius = 7;
  const outerRadius = 9.6;
  const offsets = [-0.36, -0.17, 0.17, 0.36];
  const points = Array.from({ length: teeth }, (_, tooth) => {
    const angle = (tooth / teeth) * Math.PI * 2;
    return offsets.map((offset, index) => {
      const radius = index === 0 || index === offsets.length - 1 ? innerRadius : outerRadius;
      const x = 12 + radius * Math.cos(angle + offset);
      const y = 12 + radius * Math.sin(angle + offset);
      return `${x.toFixed(2)} ${y.toFixed(2)}`;
    });
  }).flat();
  return `M${points.join(" L")} Z`;
}

const GEAR = gearPath();
const DOT = 2.4;

const ICONS = {
  home: (
    <>
      <path d="M3.5 10.6 12 4l8.5 6.6" />
      <path d="M5.8 9v10.5h12.4V9" />
      <path d="M10 19.5v-5.2h4v5.2" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.8" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8" />
      <circle cx="16.75" cy="16.75" r="3.25" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="M8 14.5h.01M12 14.5h.01M16 14.5h.01" strokeWidth={DOT} />
    </>
  ),
  wallet: (
    <>
      <path d="M5 7.5v-1a2 2 0 0 1 2-2h9.5v3" />
      <rect x="3.5" y="7.5" width="17" height="12" rx="2.5" />
      <path d="M16.5 13.5h.01" strokeWidth={DOT} />
    </>
  ),
  bell: (
    <>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15L6 16.5Z" />
      <path d="M10 20.5a2.1 2.1 0 0 0 4 0" />
    </>
  ),
  settings: (
    <>
      <path d={GEAR} />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  check: <path d="M5.5 12.5l4.2 4.2 8.8-9.4" />,
  "chevron-left": <path d="M14.5 5.5 8 12l6.5 6.5" />,
  "chevron-right": <path d="M9.5 5.5 16 12l-6.5 6.5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2.2" />
    </>
  ),
  transfer: <path d="M4 8.5h15M15.5 5l3.5 3.5-3.5 3.5M20 15.5H5M8.5 12 5 15.5 8.5 19" />,
  repeat: (
    <>
      <path d="M17 3.5 20 6.5 17 9.5" />
      <path d="M20 6.5H9.5A5.5 5.5 0 0 0 4 12" />
      <path d="M7 20.5 4 17.5 7 14.5" />
      <path d="M4 17.5h10.5A5.5 5.5 0 0 0 20 12" />
    </>
  ),
  pencil: (
    <>
      <path d="M4.5 19.5h4l10-10a2.83 2.83 0 0 0-4-4l-10 10v4Z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  send: (
    <>
      <path d="M20.5 3.5 3.5 10.2l6.6 2.7 2.7 6.6 7.7-16Z" />
      <path d="M10.1 12.9l4.4-4.4" />
    </>
  ),
  phone: (
    <path d="M5 4.5h3.2l1.6 4-2 1.3a10.5 10.5 0 0 0 6.4 6.4l1.3-2 4 1.6V19a1.5 1.5 0 0 1-1.6 1.5A15.5 15.5 0 0 1 3.5 6.1 1.5 1.5 0 0 1 5 4.5Z" />
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
    </>
  ),
  moon: <path d="M19.5 14.6A8 8 0 1 1 9.4 4.5a6.4 6.4 0 0 0 10.1 10.1Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="3.8" />
      <path d="M12 3v1.8M12 19.2V21M3 12h1.8M19.2 12H21M5.6 5.6l1.3 1.3M17.1 17.1l1.3 1.3M5.6 18.4l1.3-1.3M17.1 6.9l1.3-1.3" />
    </>
  ),
  backspace: (
    <>
      <path d="M9 5.5h10.5A1.5 1.5 0 0 1 21 7v10a1.5 1.5 0 0 1-1.5 1.5H9L3.5 12 9 5.5Z" />
      <path d="M12.5 9.5l5 5M17.5 9.5l-5 5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5 5 6.4V12c0 4.3 2.9 7.4 7 8.5 4.1-1.1 7-4.2 7-8.5V6.4l-7-2.9Z" />
      <path d="M9 12l2.2 2.2 4-4.2" />
    </>
  ),
  book: (
    <>
      <path d="M12 6.5c-1.6-1.4-4-2-7.5-2v13.8c3.5 0 5.9.6 7.5 2" />
      <path d="M12 6.5c1.6-1.4 4-2 7.5-2v13.8c-3.5 0-5.9.6-7.5 2V6.5Z" />
    </>
  ),
  dumbbell: <path d="M6.5 7.5v9M17.5 7.5v9M3.5 10v4M20.5 10v4M6.5 12h11" />,
  briefcase: (
    <>
      <rect x="3.5" y="7.5" width="17" height="12" rx="2.5" />
      <path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M3.5 12.5h17" />
    </>
  ),
  sparkles: (
    <>
      <path d="M11 4.5l1.6 4.4 4.4 1.6-4.4 1.6L11 16.5l-1.6-4.4L5 10.5l4.4-1.6L11 4.5Z" />
      <path d="M18 15l.8 2.2 2.2.8-2.2.8L18 21l-.8-2.2-2.2-.8 2.2-.8L18 15Z" />
    </>
  ),
  heart: (
    <path d="M12 19.5s-7.5-4.3-7.5-9.7A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.4c0 5.4-7.5 9.7-7.5 9.7Z" />
  ),
  cart: (
    <>
      <path d="M3.5 4.5h2.2l2.1 10h10.4l2-7.2H6.4" />
      <circle cx="9.5" cy="19" r="1.3" />
      <circle cx="16.8" cy="19" r="1.3" />
    </>
  ),
  plane: (
    <>
      <path d="M3 12.8 20.5 5l-4.2 14.2-4.4-4.7-3.6 3v-5.2L3 12.8Z" />
      <path d="M8.3 13.1 20.5 5" />
    </>
  ),
  music: (
    <>
      <path d="M9 17.5V5.8l10-2.3v11.8" />
      <circle cx="6.5" cy="17.5" r="2.5" />
      <circle cx="16.5" cy="15.3" r="2.5" />
    </>
  ),
  code: <path d="M8.5 7.5 4 12l4.5 4.5M15.5 7.5 20 12l-4.5 4.5M13.6 4.8l-3.2 14.4" />,
  graduation: (
    <>
      <path d="M2.5 9.5 12 5l9.5 4.5L12 14 2.5 9.5Z" />
      <path d="M6.5 11.5v4.2c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3v-4.2M21.5 9.5v5" />
    </>
  ),
  coffee: (
    <>
      <path d="M4.5 9h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5V9Z" />
      <path d="M16.5 10.5H18a2.5 2.5 0 0 1 0 5h-1.5M8.5 3.5v2.5M12.5 3.5v2.5" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 19.5C5 11 10 5.5 20 5c-.5 10-6 15-14.5 15" />
      <path d="M5 19.5l7.5-7.5" />
    </>
  ),
  star: <path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8L12 3.8Z" />,
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3 19.5a6 6 0 0 1 12 0" />
      <path d="M15.5 5.5a3.2 3.2 0 0 1 0 6.1M17.5 14a6 6 0 0 1 3.5 5.5" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.5-1-2.6 0-1 .8-1.7 1.8-1.7h2.1a3.8 3.8 0 0 0 3.8-3.8C20.5 6.8 16.7 3.5 12 3.5Z" />
      <circle cx="7.6" cy="11.6" r="1" />
      <circle cx="9.8" cy="7.6" r="1" />
      <circle cx="14.4" cy="7.6" r="1" />
    </>
  ),
  gamepad: (
    <>
      <path d="M7 8.5h10a4.5 4.5 0 0 1 4.3 5.8l-.9 3a2.5 2.5 0 0 1-4.3.9L14.5 16h-5l-1.6 2.2a2.5 2.5 0 0 1-4.3-.9l-.9-3A4.5 4.5 0 0 1 7 8.5Z" />
      <path d="M8 11v3.5M6.25 12.75h3.5" />
      <path d="M15.5 11.8h.01M17.2 13.6h.01" strokeWidth={DOT} />
    </>
  ),
  camera: (
    <>
      <path d="M4 8.5a2 2 0 0 1 2-2h2l1.5-2h5l1.5 2h2a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8.5Z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  cash: (
    <>
      <rect x="2.5" y="6.5" width="19" height="11" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 9.5h.01M18 14.5h.01" strokeWidth={DOT} />
    </>
  ),
  bank: <path d="M3.5 9.5 12 4.5l8.5 5M5 9.5h14M6.5 9.5v8M10 9.5v8M14 9.5v8M17.5 9.5v8M4 19.5h16" />,
  mobile: (
    <>
      <rect x="7" y="3" width="10" height="18" rx="2.5" />
      <path d="M11 17.5h2" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M3 10h18M6.5 14.5h4" />
    </>
  ),
  piggy: (
    <>
      <path d="M18.5 10.5c1 .6 1.5 1.5 1.5 2.5v1.5l-1.8.6-1.2 2v2.4h-2.5v-1.3h-4v1.3H8v-2.1a5.6 5.6 0 0 1-3-4.9 6.5 5.5 0 0 1 9.5-4.9l2.5-1.1v3h1.5Z" />
      <path d="M3.5 11.5c0 1 .6 1.7 1.5 2" />
      <path d="M15 11h.01" strokeWidth={DOT} />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  title?: string;
}

export function Icon({ name, size = 22, strokeWidth = 1.5, className, title }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {ICONS[name]}
    </svg>
  );
}
