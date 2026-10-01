"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "../ui/BrandMark";
import { Icon, type IconName } from "../ui/Icon";

type Props = {
  pinned: boolean;
  onTogglePin: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onUnavailable: (label: string) => void;
};

type Item = { label: string; icon: IconName; children?: string[] };
const items: Item[] = [
  { label: "Dashboard", icon: "dashboard" },
  {
    label: "Reservations",
    icon: "calendar",
    children: [
      "New Reservation",
      "Phone Reservation",
      "OTA Reservation",
      "All Reservations",
      "Arrivals Today",
      "Departures Today",
      "In House",
    ],
  },
  { label: "Rooms", icon: "rooms", children: ["Room Types", "Room Numbers"] },
  { label: "Prices & Stocks", icon: "prices" },
  { label: "Cancellation Policies", icon: "policy" },
  { label: "Campaigns & Promotions", icon: "campaign" },
  { label: "Experiences", icon: "experiences" },
  { label: "Payments", icon: "payments" },
  { label: "Guests", icon: "guests" },
  { label: "Reports", icon: "reports", children: ["Occupancy", "Revenue"] },
  { label: "Settings", icon: "settings", children: ["Property", "Staff"] },
];
const reservationRoutes: Record<string, string> = {
  "New Reservation": "/reservations/create-reservation-walkin",
  "Phone Reservation": "/reservations/create-reservation-phone",
  "OTA Reservation": "/reservations/create-reservation-ota",
  "All Reservations": "/reservations",
  "Arrivals Today": "/reservations/arrivals-today",
  "Departures Today": "/reservations/departures-today",
  "In House": "/reservations/in-house",
  "Room Types": "/rooms",
  "Room Numbers": "/rooms/numbers",
};

// Top-level items that have their own dedicated route
const topLevelRoutes: Record<string, string> = {
  "Dashboard": "/dashboard",
  "Prices & Stocks": "/prices-stocks",
  "Cancellation Policies": "/cancellation-policies",
  "Campaigns & Promotions": "/campaigns",
  "Experiences": "/experiences",
};

export function Sidebar({
  pinned,
  onTogglePin,
  mobileOpen,
  onCloseMobile,
  onUnavailable,
}: Props) {
  const pathname = usePathname();
  const [hovered, setHovered] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(
    pathname.startsWith("/reservations")
      ? "Reservations"
      : pathname.startsWith("/rooms")
        ? "Rooms"
        : null,
  );
  const expanded = pinned || hovered || mobileOpen;

  return (
    <>
      {mobileOpen && (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="Tutup navigasi"
          onClick={onCloseMobile}
        />
      )}
      <aside
        className={[
          "admin-sidebar",
          expanded ? "admin-sidebar--expanded" : "",
          pinned ? "admin-sidebar--pinned" : "",
          mobileOpen ? "admin-sidebar--mobile-open" : "",
        ].join(" ")}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label="Navigasi admin"
      >
        <div className="sidebar-main">
          <div className="sidebar-brand">
            <BrandMark />
            <div className="sidebar-brand__text">
              <strong>Green Hero Darajat</strong>
              <span>Admin System</span>
            </div>
            <button
              type="button"
              className="sidebar-pin"
              onClick={onTogglePin}
              aria-label={pinned ? "Ciutkan sidebar" : "Sematkan sidebar"}
              title={pinned ? "Ciutkan sidebar" : "Sematkan sidebar"}
            >
              <Icon name="pin" width={15} height={15} />
            </button>
          </div>
          <div className="sidebar-action">
            <Link
              className="sidebar-new-button"
              href="/reservations/create-reservation-walkin"
              onClick={onCloseMobile}
              title="New Reservation"
            >
              <Icon name="plus" />
              <span>New Reservation</span>
            </Link>
          </div>
          <nav className="sidebar-navigation" aria-label="Menu utama">
            {items.map((item) => (
              <div key={item.label}>
                {item.label in topLevelRoutes ? (
                  // Items with a dedicated top-level route (Dashboard, Campaigns & Promotions, etc.)
                  <Link
                    href={topLevelRoutes[item.label]}
                    className={
                      pathname === topLevelRoutes[item.label]
                        ? "sidebar-link sidebar-link--active"
                        : "sidebar-link"
                    }
                    aria-current={
                      pathname === topLevelRoutes[item.label] ? "page" : undefined
                    }
                    title={item.label}
                    onClick={onCloseMobile}
                  >
                    <Icon name={item.icon} />
                    <span className="sidebar-link__label">{item.label}</span>
                  </Link>
                ) : (
                  <>
                    <button
                      type="button"
                      className={
                        ((item.label === "Reservations" &&
                          pathname.startsWith("/reservations")) ||
                          (item.label === "Rooms" && pathname.startsWith("/rooms")))
                          ? "sidebar-link sidebar-link--active"
                          : "sidebar-link"
                      }
                      title={item.label}
                      aria-expanded={
                        item.children ? openGroup === item.label : undefined
                      }
                      onClick={() => {
                        if (item.children) {
                          setOpenGroup((current) =>
                            current === item.label ? null : item.label,
                          );
                          if (!expanded) setHovered(true);
                        } else onUnavailable(item.label);
                      }}
                    >
                      <Icon name={item.icon} />
                      <span className="sidebar-link__label">{item.label}</span>
                      {item.children && (
                        <Icon
                          name="chevron"
                          className={
                            openGroup === item.label
                              ? "sidebar-chevron sidebar-chevron--open"
                              : "sidebar-chevron"
                          }
                          width={14}
                          height={14}
                        />
                      )}
                    </button>
                    {item.children && openGroup === item.label && expanded && (
                      <div className="sidebar-submenu">
                        {item.children.map((child) =>
                          reservationRoutes[child] ? (
                            <Link
                              className={
                                (pathname === reservationRoutes[child] ||
                                  (child === "Room Types" && pathname.startsWith("/rooms") && !pathname.startsWith("/rooms/numbers")))
                                  ? "sidebar-submenu__active"
                                  : ""
                              }
                              href={reservationRoutes[child]}
                              key={child}
                              onClick={onCloseMobile}
                            >
                              {child}
                            </Link>
                          ) : (
                            <button
                              type="button"
                              key={child}
                              onClick={() => onUnavailable(child)}
                            >
                              {child}
                            </button>
                          ),
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </nav>
        </div>
        <div className="sidebar-footer">
          <span className="sidebar-shift-dot" />
          <span className="sidebar-footer__text">Shift A (07:00 - 15:00)</span>
          <button
            type="button"
            title="Help & Documentation"
            aria-label="Help & Documentation"
            onClick={() => onUnavailable("Help & Documentation")}
          >
            <Icon name="help" />
          </button>
        </div>
      </aside>
    </>
  );
}
