import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "dashboard"
  | "calendar"
  | "rooms"
  | "prices"
  | "policy"
  | "campaign"
  | "experiences"
  | "payments"
  | "guests"
  | "reports"
  | "settings"
  | "plus"
  | "chevron"
  | "arrow"
  | "bell"
  | "menu"
  | "pin"
  | "logout"
  | "help"
  | "close"
  | "search"
  | "more"
  | "reset"
  | "info"
  | "chevronLeft"
  | "chevronRight"
  | "trash"
  | "warning"
  | "globe"
  | "expGrill"
  | "expRestaurant"
  | "expDinner"
  | "expBirthday"
  | "expCelebration"
  | "expFlorist";

const paths: Record<IconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4M17 3v4M3 10h18" />
    </>
  ),
  rooms: (
    <>
      <path d="M4 21V4a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v17M2 21h20" />
      <path d="M8 7h8v14H8zM13 14h.01" />
    </>
  ),
  prices: (
    <>
      <path d="M3 18V8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10M2 18h20M7 6V4h10v2M7 11h10" />
    </>
  ),
  policy: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  campaign: (
    <>
      <path d="m3 11 12-5v12L3 13zM15 8l4-2v12l-4-2M6 14l1 5h3l-1-4" />
    </>
  ),
  experiences: (
    <>
      <path d="M12 21V11m0 6-5-5m5 1 5-5M12 3c-4 0-7 3-7 7 0 3 2 5 4 6m6 0c3-1 4-3 4-6 0-4-3-7-7-7Z" />
    </>
  ),
  payments: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20M6 15h4" />
    </>
  ),
  guests: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1" />
    </>
  ),
  reports: (
    <>
      <path d="M4 20V4h16v16zM8 16v-4m4 4V8m4 8v-6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="m19 13 2-1-2-1-.7-2 1-2-2-2-2 1-2-.7L12 3l-1 2.3-2 .7-2-1-2 2 1 2-.7 2L3 12l2.3 1 .7 2-1 2 2 2 2-1 2 .7L12 21l1-2.3 2-.7 2 1 2-2-1-2z" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  pin: (
    <>
      <path d="m16 3 5 5-3 1-3 4v3l-2 2-4-4-5 5-1-1 5-5-4-4 2-2h3l4-3z" />
    </>
  ),
  logout: (
    <>
      <path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5M14 7l5 5-5 5M19 12H9" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 4.1 1.9c-1 .8-1.6 1.3-1.6 2.6M12 17h.01" />
    </>
  ),
  close: <path d="M5 5 19 19M19 5 5 19" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.35-4.35" />
    </>
  ),
  more: (
    <>
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </>
  ),
  reset: (
    <path d="M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8h.01M11 12h1v4h1" />
    </>
  ),
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  trash: (
    <>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
    </>
  ),
  warning: (
    <>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
    </>
  ),
  // Experience icons
  expGrill: (
    <>
      <path d="M3 5a1 1 0 0 1 1-1h3l2 4H5L3 5ZM21 5a1 1 0 0 0-1-1h-3l-2 4h4l2-4ZM12 8v13M8 21h8M5 8h14" />
    </>
  ),
  expRestaurant: (
    <>
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6h3.5M16 22v-5" />
    </>
  ),
  expDinner: (
    <>
      <path d="m17 8-1.5 1.5M12.5 4l7 7M3 21l7.5-7.5M19 3 5 17M10 14 3 21" />
    </>
  ),
  expBirthday: (
    <>
      <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8M2 21h20M7 21v-5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v5" />
      <path d="M12 11V7m-2-3c0-1 2-3 2-3s2 2 2 3a2 2 0 1 1-4 0Z" />
    </>
  ),
  expCelebration: (
    <>
      <path d="M5.8 11.3 2 22l10.7-3.79M4 3h.01M22 8h.01M15 2h.01M22 20h.01M22 2l-2.24 2.24M3.34 19.1l-.71-.71M20.66 4.9l-.71-.71" />
      <path d="m9 8 3 3-2.5 5.5L14 13l-3-3 2.5-5.5z" />
    </>
  ),
  expFlorist: (
    <>
      <path d="M12 7.5a4.5 4.5 0 1 1 4.5 4.5M12 7.5A4.5 4.5 0 1 0 7.5 12M12 7.5V13m0 0a4.5 4.5 0 1 0 4.5 4.5M12 13A4.5 4.5 0 1 1 7.5 17.5" />
      <circle cx="12" cy="13" r="1" />
    </>
  ),
};

export function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
