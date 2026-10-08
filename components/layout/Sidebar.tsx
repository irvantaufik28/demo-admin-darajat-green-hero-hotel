"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "../ui/BrandMark";
import { Icon, type IconName } from "../ui/Icon";
import { useTranslations } from "../../lib/i18n";
import en from "./locales/en.json";
import id from "./locales/id.json";

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
  { label: "Reservation Calendar", icon: "rooms" },
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
  { label: "Payments", icon: "payments", children: ["All Transactions", "Refunds", "Outstanding Balance"] },
  { label: "Guests", icon: "guests" },
  { label: "Master", icon: "rooms", children: [
    "Amenities", "Bed Types", "Meal Types", "Room View Types", "Floor", "Capacity Patterns",
    "Experience Categories", "OTA Channels", "Payment Methods", "Cancellation Policy Types",
  ] },
  { label: "Reports", icon: "reports", children: ["Reservation Report", "Room Performance", "Revenue"] },
  { label: "Settings", icon: "settings", children: ["Reservation Settings", "Users", "Roles & Permissions"] },
];
const websiteItems: Item[] = [
  { label: "Hotel Info", icon: "settings" },
  { label: "Homepage", icon: "dashboard" },
  { label: "Favorite Rooms", icon: "rooms" },
  { label: "Facilities", icon: "experiences" },
  { label: "Gallery", icon: "reports" },
  { label: "Testimonials", icon: "guests" },
  { label: "Contact & Location", icon: "globe" },
];
const reservationRoutes: Record<string, string> = {
  "All Transactions": "/payments/transactions",
  "Refunds": "/payments/refunds",
  "Outstanding Balance": "/payments/outstanding",
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
  "Capacity Patterns": "/master/capacity-patterns",
  "Experience Categories": "/master/experience-categories",
  "OTA Channels": "/master/ota-channels",
  "Payment Methods": "/master/payment-methods",
  "Cancellation Policy Types": "/master/cancellation-policy-types",
};

// Top-level items that have their own dedicated route
const topLevelRoutes: Record<string, string> = {
  "Dashboard": "/dashboard",
  "Reservation Calendar": "/reservations/room-rack",
  "Prices & Stocks": "/prices-stocks",
  "Cancellation Policies": "/cancellation-policies",
  "Campaigns & Promotions": "/campaigns",
  "Experiences": "/experiences",
  "Guests": "/guests",
  "Favorite Rooms": "/web-settings/favorite-rooms",
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
  const { t } = useTranslations({ en, id });
  const [hovered, setHovered] = useState(false);
  const [section, setSection] = useState<"hotelier" | "website">(
    pathname.startsWith("/web-settings") ? "website" : "hotelier",
  );
  const [menuSearch, setMenuSearch] = useState("");
  const currentGroup =
    pathname.startsWith("/payments")
      ? "Payments"
      : pathname.startsWith("/reservations") && pathname !== "/reservations/room-rack"
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
  const visibleItems = (section === "hotelier" ? items : websiteItems).filter((item) => {
    const term = menuSearch.trim().toLowerCase();
    const label = section === "website" ? t("websiteItems." + item.label) : t("items." + item.label);
    return !term || label.toLowerCase().includes(term) ||
      item.children?.some((child) => child.toLowerCase().includes(term));
  });
  const groupIsOpen = (item: Item) => openGroups.includes(item.label) || Boolean(
    menuSearch.trim() && item.children?.some((child) =>
      child.toLowerCase().includes(menuSearch.trim().toLowerCase()),
    ),
  );

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
          aria-label={t("aria.closeNav")}
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
        aria-label={t("aria.nav")}
      >
        <div className="sidebar-main">
          <div className="sidebar-brand">
            <BrandMark />
            <div className="sidebar-brand__text">
              <strong>{t("brand.name")}</strong>
              <span>{t("brand.subtitle")}</span>
            </div>
            <button
              type="button"
              className="sidebar-pin"
              onClick={onTogglePin}
              aria-label={pinned ? t("aria.collapse") : t("aria.pin")}
              title={pinned ? t("aria.collapse") : t("aria.pin")}
            >
              <Icon name="pin" width={15} height={15} />
            </button>
          </div>
          <div className="sidebar-section-tabs" role="tablist" aria-label="Area navigasi">
            <button
              type="button"
              role="tab"
              aria-selected={section === "hotelier"}
              className={section === "hotelier" ? "sidebar-section-tab sidebar-section-tab--active" : "sidebar-section-tab"}
              onClick={() => { setSection("hotelier"); setMenuSearch(""); }}
              title="Hotelier"
            >
              <Icon name="rooms" width={18} height={18} />
              <span>HOTELIER</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={section === "website"}
              className={section === "website" ? "sidebar-section-tab sidebar-section-tab--active" : "sidebar-section-tab"}
              onClick={() => { setSection("website"); setMenuSearch(""); }}
              title={t("website.title")}
            >
              <Icon name="globe" width={18} height={18} />
              <span>{t("website.title")}</span>
            </button>
          </div>
          <div className="sidebar-menu-search">
            <Icon name="search" width={17} height={17} />
            <input
              type="search"
              value={menuSearch}
              onChange={(event) => setMenuSearch(event.target.value)}
              placeholder={t("website.searchPlaceholder")}
              aria-label={t("website.searchLabel")}
            />
          </div>
          {section === "hotelier" && <div className="sidebar-action">
            <Link
              className="sidebar-new-button"
              href="/reservations/create-reservation-walkin"
              onClick={onCloseMobile}
              title={t("newReservation")}
            >
              <Icon name="plus" />
              <span>{t("newReservation")}</span>
            </Link>
          </div>}
          <nav className="sidebar-navigation" aria-label={t("aria.mainMenu")}>
            {visibleItems.map((item) => (
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
                    title={section === "website" ? t("websiteItems." + item.label) : t("items." + item.label)}
                    onClick={onCloseMobile}
                  >
                    <Icon name={item.icon} />
                    <span className="sidebar-link__label">{section === "website" ? t("websiteItems." + item.label) : t("items." + item.label)}</span>
                  </Link>
                ) : (
                  <>
                    <button
                      type="button"
                      className={
                        ((item.label === "Reservations" &&
                          pathname.startsWith("/reservations") &&
                          pathname !== "/reservations/room-rack") ||
                          (item.label === "Rooms" && pathname.startsWith("/rooms")) ||
                          (item.label === "Payments" && pathname.startsWith("/payments")) ||
                          (item.label === "Master" && pathname.startsWith("/master")) ||
                          (item.label === "Settings" && pathname.startsWith("/settings")))
                          ? "sidebar-link sidebar-link--active"
                          : "sidebar-link"
                      }
                      title={section === "website" ? t("websiteItems." + item.label) : item.label}
                      aria-expanded={
                        item.children ? groupIsOpen(item) : undefined
                      }
                      onClick={() => {
                        if (item.children) {
                          toggleGroup(item.label);
                        } else onUnavailable(section === "website" ? t("websiteItems." + item.label) : item.label);
                      }}
                    >
                      <Icon name={item.icon} />
                      <span className="sidebar-link__label">{section === "website" ? t("websiteItems." + item.label) : t("items." + item.label)}</span>
                      {item.children && (
                        <Icon
                          name="chevron"
                          className={
                            groupIsOpen(item)
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
                        className={groupIsOpen(item)
                          ? "sidebar-submenu-wrap sidebar-submenu-wrap--open"
                          : "sidebar-submenu-wrap"}
                        aria-hidden={!groupIsOpen(item)}
                        inert={!groupIsOpen(item)}
                      ><div className="sidebar-submenu">
                        {item.children.filter((child) =>
                          !menuSearch.trim() || item.label.toLowerCase().includes(menuSearch.trim().toLowerCase()) ||
                          child.toLowerCase().includes(menuSearch.trim().toLowerCase()),
                        ).map((child) =>
                          reservationRoutes[child] ? (
                            <Link
                              className={
                                (pathname === reservationRoutes[child] ||
                                  (child === "All Transactions" && pathname === "/payments") ||
                                  (child === "All Transactions" && /^\/payments\/[^/]+$/.test(pathname) && !["refunds", "outstanding", "transactions"].includes(pathname.split("/")[2])) ||
                                  (child === "Room Types" && pathname.startsWith("/rooms") && !pathname.startsWith("/rooms/numbers")))
                                  ? "sidebar-submenu__active"
                                  : ""
                              }
                              href={reservationRoutes[child]}
                              key={child}
                              onClick={onCloseMobile}
                            >
                              {t("items." + child)}
                            </Link>
                          ) : (
                            <button
                              type="button"
                              key={child}
                              onClick={() => onUnavailable(child)}
                            >
                              {t("items." + child)}
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
          <span className="sidebar-footer__text">{t("footer.shift")}</span>
          <button
            type="button"
            title={t("footer.help")}
            aria-label={t("footer.help")}
            onClick={() => onUnavailable(t("footer.help"))}
          >
            <Icon name="help" />
          </button>
        </div>
      </aside>
    </>
  );
}
