"use client";

import { useEffect, useState } from "react";
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
  { label: "Master", icon: "rooms", children: [
    "Amenities", "Bed Types", "Meal Types", "Room View Types", "Floor",
    "Experience Categories", "OTA Channels", "Payment Methods", "Cancellation Policy Types",
  ] },
  { label: "Reports", icon: "reports", children: ["Reservation Report", "Room Performance", "Revenue"] },
  { label: "Settings", icon: "settings", children: ["Reservation Settings", "Users", "Roles & Permissions"] },
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
  "Reservation Report": "/reports/reservations",
  "Room Performance": "/reports/room-performance",
  "Revenue": "/reports/revenue",
  "Roles & Permissions": "/settings/roles-permissions",
  "Users": "/settings/users",
  "Reservation Settings": "/settings/reservations",
  "Amenities": "/master/amenities",
  "Bed Types": "/master/bed-types",
  "Meal Types": "/master/meal-types",
  "Room View Types": "/master/room-view-types",
  "Floor": "/master/floor",
  "Experience Categories": "/master/experience-categories",
  "OTA Channels": "/master/ota-channels",
  "Payment Methods": "/master/payment-methods",
  "Cancellation Policy Types": "/master/cancellation-policy-types",
};

// Top-level items that have their own dedicated route
const topLevelRoutes: Record<string, string> = {
  "Dashboard": "/dashboard",
  "Prices & Stocks": "/prices-stocks",
  "Cancellation Policies": "/cancellation-policies",
  "Campaigns & Promotions": "/campaigns",
  "Experiences": "/experiences",
  "Payments": "/payments",
  "Guests": "/guests",
};

let openGroupsCache: string[] | null = null;

export function hydrateSidebarOpenGroups() {
  if (openGroupsCache !== null) return;
  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem("green-hero-sidebar-open-groups") || "null");
    if (Array.isArray(stored)) {
      openGroupsCache = stored.filter((value): value is string =>
        typeof value === "string" && items.some((item) => item.label === value && item.children),
      );
    }
  } catch {
    // Use the current route when no saved group state is available.
  }
}

export function Sidebar({
  pinned,
  onTogglePin,
  mobileOpen,
  onCloseMobile,
  onUnavailable,
}: Props) {
  const pathname = usePathname();
  const [hovered, setHovered] = useState(false);
  const currentGroup =
    pathname.startsWith("/reservations")
      ? "Reservations"
      : pathname.startsWith("/rooms")
        ? "Rooms"
        : pathname.startsWith("/reports")
          ? "Reports"
          : pathname.startsWith("/master")
            ? "Master"
          : pathname.startsWith("/settings")
            ? "Settings"
            : null;
  const [openGroups, setOpenGroups] = useState<string[]>(
    () => openGroupsCache ?? (currentGroup ? [currentGroup] : []),
  );
  const expanded = pinned || hovered || mobileOpen;

  useEffect(() => {
    if (openGroupsCache === null) openGroupsCache = openGroups;
  }, [openGroups]);

  function toggleGroup(label: string) {
    setOpenGroups((current) => {
      const next = current.includes(label)
        ? current.filter((value) => value !== label)
        : [...current, label];
      openGroupsCache = next;
      sessionStorage.setItem("green-hero-sidebar-open-groups", JSON.stringify(next));
      return next;
    });
    if (!expanded) setHovered(true);
  }

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
                          (item.label === "Rooms" && pathname.startsWith("/rooms")) ||
                          (item.label === "Master" && pathname.startsWith("/master")) ||
                          (item.label === "Settings" && pathname.startsWith("/settings")))
                          ? "sidebar-link sidebar-link--active"
                          : "sidebar-link"
                      }
                      title={item.label}
                      aria-expanded={
                        item.children ? openGroups.includes(item.label) : undefined
                      }
                      onClick={() => {
                        if (item.children) {
                          toggleGroup(item.label);
                        } else onUnavailable(item.label);
                      }}
                    >
                      <Icon name={item.icon} />
                      <span className="sidebar-link__label">{item.label}</span>
                      {item.children && (
                        <Icon
                          name="chevron"
                          className={
                            openGroups.includes(item.label)
                              ? "sidebar-chevron sidebar-chevron--open"
                              : "sidebar-chevron"
                          }
                          width={14}
                          height={14}
                        />
                      )}
                    </button>
                    {item.children && expanded && (
                      <div
                        className={openGroups.includes(item.label)
                          ? "sidebar-submenu-wrap sidebar-submenu-wrap--open"
                          : "sidebar-submenu-wrap"}
                        aria-hidden={!openGroups.includes(item.label)}
                        inert={!openGroups.includes(item.label)}
                      ><div className="sidebar-submenu">
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
                      </div></div>
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
