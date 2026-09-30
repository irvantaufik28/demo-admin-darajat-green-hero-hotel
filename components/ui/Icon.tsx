import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "dashboard" | "calendar" | "rooms" | "prices" | "policy"
  | "campaign" | "experiences" | "payments" | "guests"
  | "reports" | "settings" | "plus" | "chevron" | "arrow"
  | "bell" | "menu" | "pin" | "logout" | "help" | "close";

const paths: Record<IconName, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></>,
  rooms: <><path d="M4 21V4a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v17M2 21h20" /><path d="M8 7h8v14H8zM13 14h.01" /></>,
  prices: <><path d="M3 18V8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10M2 18h20M7 6V4h10v2M7 11h10" /></>,
  policy: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
  campaign: <><path d="m3 11 12-5v12L3 13zM15 8l4-2v12l-4-2M6 14l1 5h3l-1-4" /></>,
  experiences: <><path d="M12 21V11m0 6-5-5m5 1 5-5M12 3c-4 0-7 3-7 7 0 3 2 5 4 6m6 0c3-1 4-3 4-6 0-4-3-7-7-7Z" /></>,
  payments: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M6 15h4" /></>,
  guests: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1" /></>,
  reports: <><path d="M4 20V4h16v16zM8 16v-4m4 4V8m4 8v-6" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19 13 2-1-2-1-.7-2 1-2-2-2-2 1-2-.7L12 3l-1 2.3-2 .7-2-1-2 2 1 2-.7 2L3 12l2.3 1 .7 2-1 2 2 2 2-1 2 .7L12 21l1-2.3 2-.7 2 1 2-2-1-2z" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  pin: <><path d="m16 3 5 5-3 1-3 4v3l-2 2-4-4-5 5-1-1 5-5-4-4 2-2h3l4-3z" /></>,
  logout: <><path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5M14 7l5 5-5 5M19 12H9" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 4.1 1.9c-1 .8-1.6 1.3-1.6 2.6M12 17h.01" /></>,
  close: <path d="M5 5 19 19M19 5 5 19" />,
};

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
