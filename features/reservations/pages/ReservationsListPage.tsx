"use client";
import "../../dashboard/styles/dashboard.css";
import "../styles/reservations.css";

import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AdminShell } from "../../../components/layout/AdminShell";
import { DateRangePicker } from "../../campaigns/components/DateRangePicker";
import { calculateNights, formatStayDate } from "../constants/walk-in-data";
import { getReservations, type ReservationListItem } from "../services/api";
import { restoreSession } from "../../../lib/auth";
import { useOperationalRefresh } from "../hooks/useOperationalRefresh";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

const pageSize = 8;

type ListRow = {
  id: string;
  bookingId: string;
  guestName: string;
  whatsapp: string;
  source: string;
  channel?: string;
  reference?: string;
  checkIn: string;
  checkOut: string;
  room: string;
  paymentStatus: string;
  status: string;
  operationalStatus?: string;
  operationalDescription?: string;
  total: number;
};

function displayStatus(value: string) {
  return value
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("-");
}

function toListRow(item: ReservationListItem): ListRow {
  return {
    id: item.id,
    bookingId: item.bookingCode,
    guestName: item.guest.fullName,
    whatsapp: item.guest.phone,
    source: item.source === "walk_in" ? "Walk-in" : displayStatus(item.source),
    channel: item.otaChannel?.name,
    reference: item.externalReference ?? undefined,
    checkIn: item.checkInDate,
    checkOut: item.checkOutDate,
    room: item.rooms.map((room) => room.roomTypeName).join(", ") || "—",
    paymentStatus: displayStatus(item.paymentStatus),
    status: displayStatus(item.reservationStatus),
    operationalStatus: item.operationalStatus?.label,
    operationalDescription: item.operationalStatus?.description,
    total: item.bookingTotal,
  };
}

function sourceLabel(reservation: ListRow) {
  return reservation.source === "Ota" && reservation.channel
    ? "OTA · " + reservation.channel
    : reservation.source === "Ota"
      ? "OTA"
      : reservation.source;
}

function statusClass(value: string) {
  if (
    value === "Paid" ||
    value === "Confirmed" ||
    value === "Ready to Check-in"
  )
    return "success";
  if (
    value === "Checked-in" ||
    value === "Checked In" ||
    value === "In House" ||
    value === "Due Out"
  )
    return "info";
  if (value === "Checked-out" || value === "Checked Out") return "neutral";
  if (
    value === "Cancelled" ||
    value === "Expired" ||
    value === "Failed" ||
    value.startsWith("Overdue")
  )
    return "danger";
  if (value === "Refunded") return "neutral";
  return "warning";
}

function csvCell(value: string | number | undefined) {
  const text = String(value ?? "");
  const safe = /^[=+@-]/.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export function ReservationsListPage() {
  const { t } = useTranslations({ en, id });
  const operationalRefresh = useOperationalRefresh();
  const [reservations, setReservations] = useState<ListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [stayDateFrom, setStayDateFrom] = useState("");
  const [stayDateTo, setStayDateTo] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [sortDirection, setSortDirection] = useState<
    "default" | "asc" | "desc"
  >("default");
  const [page, setPage] = useState(1);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") setOpenMenu(null);
    }
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(
      async () => {
        setLoading(true);
        setError("");
        try {
          if (!(await restoreSession())) return;
          const query = new URLSearchParams({
            page: String(page),
            limit: String(pageSize),
          });
          if (search.trim()) query.set("search", search.trim());
          if (sourceFilter !== "all")
            query.set(
              "source",
              sourceFilter === "walk-in" ? "walk_in" : sourceFilter,
            );
          if (statusFilter !== "all")
            query.set("reservationStatus", statusFilter.replace("-", "_"));
          if (paymentFilter !== "all")
            query.set("paymentStatus", paymentFilter);
          if (stayDateFrom && stayDateTo) {
            query.set("stayDateFrom", stayDateFrom);
            query.set("stayDateTo", stayDateTo);
          }
          if (sortDirection !== "default")
            query.set("sort", `booking_code_${sortDirection}`);
          const result = await getReservations(query, controller.signal);
          if (!controller.signal.aborted) {
            setReservations(result.items.map(toListRow));
            setTotal(result.total);
          }
        } catch (cause) {
          if (!controller.signal.aborted)
            setError(
              cause instanceof Error
                ? cause.message
                : t("list.messages.loadError"),
            );
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      },
      search ? 300 : 0,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    page,
    search,
    stayDateFrom,
    stayDateTo,
    sourceFilter,
    statusFilter,
    paymentFilter,
    sortDirection,
    operationalRefresh,
  ]);

  const filtered = reservations;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered;
  const hasFilters =
    !!search ||
    !!stayDateFrom ||
    !!stayDateTo ||
    sourceFilter !== "all" ||
    statusFilter !== "all" ||
    paymentFilter !== "all";

  function resetFilters() {
    setSearch("");
    setStayDateFrom("");
    setStayDateTo("");
    setSourceFilter("all");
    setStatusFilter("all");
    setPaymentFilter("all");
    setPage(1);
  }

  function exportCsv() {
    const header = [
      t("list.csv.bookingId"),
      t("list.csv.guest"),
      t("list.csv.whatsapp"),
      t("list.csv.source"),
      t("list.csv.checkIn"),
      t("list.csv.checkOut"),
      t("list.csv.room"),
      t("list.csv.payment"),
      t("list.csv.status"),
      t("list.csv.operationalStatus"),
      t("list.csv.total"),
    ];
    const rows = filtered.map((item) => [
      item.bookingId,
      item.guestName,
      item.whatsapp,
      sourceLabel(item),
      item.checkIn,
      item.checkOut,
      item.room,
      item.paymentStatus,
      item.status,
      item.operationalStatus ?? "",
      item.total ?? "",
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `reservations-page-${currentPage}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminShell title={t("shell.title")} context={t("shell.allReservations")}>
      <div className="reservations-list-page">
        <div className="reservations-list-heading">
          <div>
            <div className="reservations-list-title">
              <h1>{t("list.heading")}</h1>
              <span>{t("list.count", { count: total })}</span>
            </div>
            <p>{t("list.description")}</p>
          </div>
          <Link
            className="reservations-list-new"
            href="/reservations/create-reservation-walkin"
          >
            ＋ {t("list.newReservation")}
          </Link>
        </div>
        <div className="reservations-list-search">
          <span aria-hidden="true">⌕</span>
          <input
            ref={searchRef}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder={t("list.searchPlaceholder")}
            aria-label={t("list.searchAriaLabel")}
          />
          <kbd>⌘K</kbd>
        </div>
        <div className="reservations-list-toolbar">
          <div className="reservations-list-filters">
            <DateRangePicker
              label={t("list.filters.stayDateAriaLabel")}
              start={stayDateFrom}
              end={stayDateTo}
              numberOfMonths={2}
              onChange={(start, end) => {
                setStayDateFrom(start);
                setStayDateTo(end);
                setPage(1);
              }}
            />
            <select
              aria-label={t("list.filters.sourceAriaLabel")}
              value={sourceFilter}
              onChange={(event) => {
                setSourceFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">{t("list.filters.sourceAll")}</option>
              <option value="website">{t("source.website")}</option>
              <option value="walk-in">{t("source.walkIn")}</option>
              <option value="phone">{t("source.phone")}</option>
              <option value="ota">{t("source.ota")}</option>
            </select>
            <select
              aria-label={t("list.filters.statusAriaLabel")}
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">{t("list.filters.statusAll")}</option>
              {(
                [
                  ["Pending", "status.pending"],
                  ["Confirmed", "status.confirmed"],
                  ["Checked-in", "status.checkedIn"],
                  ["Checked-out", "status.checkedOut"],
                  ["No_show", "status.noShow"],
                  ["Cancelled", "status.cancelled"],
                  ["Expired", "status.expired"],
                  ["Draft", "status.draft"],
                ] as const
              ).map(([value, key]) => (
                <option key={value} value={value.toLowerCase()}>
                  {t(key)}
                </option>
              ))}
            </select>
            <select
              aria-label={t("list.filters.paymentAriaLabel")}
              value={paymentFilter}
              onChange={(event) => {
                setPaymentFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">{t("list.filters.paymentAll")}</option>
              {(
                [
                  ["Unpaid", "status.unpaid"],
                  ["Partial", "status.partial"],
                  ["Paid", "status.paid"],
                  ["Refunded", "status.refunded"],
                  ["Failed", "status.failed"],
                ] as const
              ).map(([value, key]) => (
                <option key={value} value={value.toLowerCase()}>
                  {t(key)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="reservations-list-reset"
              disabled={!hasFilters}
              onClick={resetFilters}
            >
              {t("list.filters.reset")}
            </button>
          </div>
          <div className="reservations-list-tools">
            <button type="button" onClick={exportCsv}>
              ⇩ &nbsp; {t("list.exportThisPage")}
            </button>
          </div>
        </div>
        {error && (
          <div className="reservation-detail-missing" role="alert">
            {error}
          </div>
        )}
        <div className="reservations-table-shell" aria-busy={loading}>
          <div className="reservations-table-scroll">
            <table className="reservations-table">
              <thead>
                <tr>
                  <th>{t("list.table.no")}</th>
                  <th>
                    <button
                      type="button"
                      onClick={() =>
                        setSortDirection((current) =>
                          current === "asc" ? "desc" : "asc",
                        )
                      }
                    >
                      {t("list.table.booking")} ↕
                    </button>
                  </th>
                  <th>{t("list.table.guest")}</th>
                  <th>{t("list.table.source")}</th>
                  <th>{t("list.table.stay")}</th>
                  <th>{t("list.table.room")}</th>
                  <th>{t("list.table.payment")}</th>
                  <th>{t("list.table.status")}</th>
                  <th>{t("list.table.operationalStatus")}</th>
                  <th>{t("list.table.action")}</th>
                </tr>
              </thead>
              <tbody>
                {!loading &&
                  visible.map((item, index) => {
                    const nights = calculateNights(item.checkIn, item.checkOut);
                    return (
                      <tr key={item.id}>
                        <td className="reservations-no">
                          {(currentPage - 1) * pageSize + index + 1}
                        </td>
                        <td className="reservations-booking">
                          {item.bookingId}
                        </td>
                        <td>
                          <span className="reservations-guest">
                            <strong>{item.guestName}</strong>
                            <small>{item.whatsapp}</small>
                          </span>
                        </td>
                        <td>
                          <span className="reservations-source">
                            {sourceLabel(item)}
                          </span>
                        </td>
                        <td>
                          <span className="reservations-stay">
                            <strong>
                              {formatStayDate(item.checkIn)} →{" "}
                              {formatStayDate(item.checkOut)}
                            </strong>
                            <small>
                              {nights}{" "}
                              {nights === 1
                                ? t("common.night")
                                : t("common.nights")}
                            </small>
                          </span>
                        </td>
                        <td>{item.room}</td>
                        <td>
                          <span
                            className={
                              "reservations-badge reservations-badge--" +
                              statusClass(item.paymentStatus)
                            }
                          >
                            {item.paymentStatus}
                          </span>
                        </td>
                        <td>
                          <span
                            className={
                              "reservations-badge reservations-badge--" +
                              statusClass(item.status)
                            }
                          >
                            {item.status}
                          </span>
                        </td>
                        <td>
                          <span
                            title={item.operationalDescription}
                            className={
                              "reservations-badge reservations-badge--" +
                              statusClass(item.operationalStatus ?? "")
                            }
                          >
                            {item.operationalStatus ?? t("common.emptyDash")}
                          </span>
                        </td>
                        <td>
                          <div className="reservations-row-actions">
                            <Link
                              className="reservations-view-link"
                              href={
                                "/reservations/" + encodeURIComponent(item.id)
                              }
                            >
                              {t("common.view")}
                            </Link>
                            <div className="reservations-menu-anchor">
                              <button
                                type="button"
                                aria-label={t("list.table.optionsAriaLabel", {
                                  bookingId: item.bookingId,
                                })}
                                aria-expanded={openMenu === item.id}
                                onClick={(event) => {
                                  const rect =
                                    event.currentTarget.getBoundingClientRect();
                                  setMenuPosition({
                                    top: rect.bottom + 4,
                                    right: window.innerWidth - rect.right,
                                  });
                                  setOpenMenu((current) =>
                                    current === item.id ? null : item.id,
                                  );
                                }}
                              >
                                ⋮
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                {(loading || visible.length === 0) && (
                  <tr>
                    <td colSpan={10} className="reservations-empty">
                      {loading ? <LoadingSkeleton /> : t("list.messages.empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="reservations-pagination">
            <span>
              {t("list.pagination.showing", {
                from: total ? (currentPage - 1) * pageSize + 1 : 0,
                to: Math.min(currentPage * pageSize, total),
                total,
              })}
            </span>
            <div>
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
              >
                ‹ {t("list.pagination.previous")}
              </button>
              {Array.from({ length: pageCount }, (_, index) => index + 1).map(
                (number) => (
                  <button
                    key={number}
                    type="button"
                    className={
                      currentPage === number ? "reservations-page-active" : ""
                    }
                    aria-current={currentPage === number ? "page" : undefined}
                    onClick={() => setPage(number)}
                  >
                    {number}
                  </button>
                ),
              )}
              <button
                type="button"
                disabled={currentPage === pageCount}
                onClick={() => setPage(currentPage + 1)}
              >
                {t("list.pagination.next")} ›
              </button>
            </div>
          </div>
        </div>
        {openMenu && (
          <div
            className="reservations-row-menu reservations-floating-menu"
            style={{ top: menuPosition.top, right: menuPosition.right }}
          >
            <Link href={"/reservations/" + encodeURIComponent(openMenu)}>
              {t("common.viewDetails")}
            </Link>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
