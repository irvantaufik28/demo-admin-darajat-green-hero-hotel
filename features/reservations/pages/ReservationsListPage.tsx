"use client";
import "../styles/reservations.css";

import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AdminShell } from "../../../components/layout/AdminShell";
import { calculateNights, formatStayDate } from "../constants/walk-in-data";
import { getReservations, type ReservationListItem } from "../services/api";
import { restoreSession } from "../../../lib/auth";
import { useOperationalRefresh } from "../hooks/useOperationalRefresh";

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
  return value.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join("-");
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
    : reservation.source === "Ota" ? "OTA" : reservation.source;
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
  const operationalRefresh = useOperationalRefresh();
  const [reservations, setReservations] = useState<ListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [stayFilter, setStayFilter] = useState("all");
  const [customDate, setCustomDate] = useState("");
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
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        if (!(await restoreSession())) return;
        const query = new URLSearchParams({ page: String(page), limit: String(pageSize) });
        if (search.trim()) query.set("search", search.trim());
        if (sourceFilter !== "all") query.set("source", sourceFilter === "walk-in" ? "walk_in" : sourceFilter);
        if (statusFilter !== "all") query.set("reservationStatus", statusFilter.replace("-", "_"));
        if (paymentFilter !== "all") query.set("paymentStatus", paymentFilter);
        if (stayFilter === "custom" && customDate) query.set("stayDate", customDate);
        if (sortDirection !== "default") query.set("sort", `booking_code_${sortDirection}`);
        const result = await getReservations(query, controller.signal);
        if (!controller.signal.aborted) {
          setReservations(result.items.map(toListRow));
          setTotal(result.total);
        }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Reservasi gagal dimuat.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, search ? 300 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [page, search, stayFilter, customDate, sourceFilter, statusFilter, paymentFilter, sortDirection, operationalRefresh]);

  const filtered = reservations;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered;
  const hasFilters =
    !!search ||
    stayFilter !== "all" ||
    sourceFilter !== "all" ||
    statusFilter !== "all" ||
    paymentFilter !== "all";

  function resetFilters() {
    setSearch("");
    setStayFilter("all");
    setCustomDate("");
    setSourceFilter("all");
    setStatusFilter("all");
    setPaymentFilter("all");
    setPage(1);
  }

  function exportCsv() {
    const header = [
      "Booking ID",
      "Guest",
      "WhatsApp",
      "Source",
      "Check-in",
      "Check-out",
      "Room",
      "Payment",
      "Status",
      "Operational Status",
      "Total",
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
    <AdminShell title="Reservations" context="All Reservations">
      <div className="reservations-list-page">
        <div className="reservations-list-heading">
          <div>
            <div className="reservations-list-title">
              <h1>Reservations</h1>
              <span>{total} reservations</span>
            </div>
            <p>Kelola seluruh reservasi online dan offline</p>
          </div>
          <Link
            className="reservations-list-new"
            href="/reservations/create-reservation-walkin"
          >
            ＋ New Reservation
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
            placeholder="Search booking ID, guest, or WhatsApp"
            aria-label="Cari reservasi"
          />
          <kbd>⌘K</kbd>
        </div>
        <div className="reservations-list-toolbar">
          <div className="reservations-list-filters">
            <select
              aria-label="Filter tanggal menginap"
              value={stayFilter}
              onChange={(event) => {
                setStayFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">Stay Date: All Dates</option>
              <option value="custom">Stay Date: Specific Date</option>
            </select>
            {stayFilter === "custom" && (
              <input
                type="date"
                aria-label="Pilih tanggal menginap"
                value={customDate}
                onChange={(event) => {
                  setCustomDate(event.target.value);
                  setPage(1);
                }}
              />
            )}
            <select
              aria-label="Filter sumber"
              value={sourceFilter}
              onChange={(event) => {
                setSourceFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">Source: All Sources</option>
              <option value="website">Website</option>
              <option value="walk-in">Walk-in</option>
              <option value="phone">Phone</option>
              <option value="ota">OTA</option>
            </select>
            <select
              aria-label="Filter status"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">Status: All Status</option>
              {[
                "Pending",
                "Confirmed",
                "Checked-in",
                "Checked-out",
                "Cancelled",
                "Expired",
                "Draft",
              ].map((value) => (
                <option key={value} value={value.toLowerCase()}>
                  {value}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter pembayaran"
              value={paymentFilter}
              onChange={(event) => {
                setPaymentFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">Payment: All Payments</option>
              {["Unpaid", "Partial", "Paid", "Refunded", "Failed"].map(
                (value) => (
                  <option key={value} value={value.toLowerCase()}>
                    {value}
                  </option>
                ),
              )}
            </select>
            <button
              type="button"
              className="reservations-list-reset"
              disabled={!hasFilters}
              onClick={resetFilters}
            >
              Reset
            </button>
          </div>
          <div className="reservations-list-tools">
            <button type="button" onClick={exportCsv}>
              ⇩ &nbsp; Export This Page
            </button>
          </div>
        </div>
        {error && <div className="reservation-detail-missing" role="alert">{error}</div>}
        <div className="reservations-table-shell" aria-busy={loading}>
          <div className="reservations-table-scroll">
            <table className="reservations-table">
              <thead>
                <tr>
                  <th>NO</th>
                  <th>
                    <button
                      type="button"
                      onClick={() =>
                        setSortDirection((current) =>
                          current === "asc" ? "desc" : "asc",
                        )
                      }
                    >
                      BOOKING ↕
                    </button>
                  </th>
                  <th>GUEST</th>
                  <th>SOURCE</th>
                  <th>STAY</th>
                  <th>ROOM</th>
                  <th>PAYMENT</th>
                  <th>STATUS</th>
                  <th>OPERATIONAL STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {!loading && visible.map((item, index) => {
                  const nights = calculateNights(item.checkIn, item.checkOut);
                  return (
                    <tr key={item.id}>
                      <td className="reservations-no">{(currentPage - 1) * pageSize + index + 1}</td>
                      <td className="reservations-booking">{item.bookingId}</td>
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
                            {nights} {nights === 1 ? "Night" : "Nights"}
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
                          {item.operationalStatus ?? "—"}
                        </span>
                      </td>
                      <td>
                        <div className="reservations-row-actions">
                          <Link
                            className="reservations-view-link"
                            href={
                              "/reservations/" +
                              encodeURIComponent(item.id)
                            }
                          >
                            View
                          </Link>
                          <div className="reservations-menu-anchor">
                            <button
                              type="button"
                              aria-label={"Opsi " + item.bookingId}
                              aria-expanded={openMenu === item.id}
                              onClick={(event) => {
                                const rect =
                                  event.currentTarget.getBoundingClientRect();
                                setMenuPosition({
                                  top: rect.bottom + 4,
                                  right: window.innerWidth - rect.right,
                                });
                                setOpenMenu((current) =>
                                  current === item.id
                                    ? null
                                    : item.id,
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
                      {loading ? <LoadingSkeleton /> : "Tidak ada reservasi yang cocok dengan filter."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="reservations-pagination">
            <span>
              Showing{" "}
              <strong>
                {total ? (currentPage - 1) * pageSize + 1 : 0}–
                {Math.min(currentPage * pageSize, total)}
              </strong>{" "}
              of <strong>{total}</strong> reservations
            </span>
            <div>
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
              >
                ‹ Previous
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
                Next ›
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
              View details
            </Link>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
