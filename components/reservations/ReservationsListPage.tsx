"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AdminShell } from "../layout/AdminShell";
import { calculateNights, formatStayDate } from "../../lib/walk-in-data";
import { initialReservations, type ReservationRecord } from "../../lib/reservation-list-data";

const pageSize = 8;

function sourceLabel(reservation: ReservationRecord) {
  return reservation.source === "OTA" && reservation.channel ? "OTA · " + reservation.channel : reservation.source;
}

function statusClass(value: string) {
  if (value === "Paid" || value === "Confirmed" || value === "Ready to Check-in") return "success";
  if (value === "Checked-in" || value === "Checked In" || value === "In House" || value === "Due Out") return "info";
  if (value === "Checked-out" || value === "Checked Out") return "neutral";
  if (value === "Cancelled" || value === "Expired" || value === "Failed" || value === "Overdue") return "danger";
  if (value === "Refunded") return "neutral";
  return "warning";
}

function csvCell(value: string | number | undefined) {
  const text = String(value ?? "");
  const safe = /^[=+@-]/.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export function ReservationsListPage() {
  const reservations = initialReservations;
  const [search, setSearch] = useState("");
  const [stayFilter, setStayFilter] = useState("all");
  const [customDate, setCustomDate] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [sortDirection, setSortDirection] = useState<"default" | "asc" | "desc">("default");
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

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = reservations.filter(item => {
      if (term && ![item.bookingId, item.guestName, item.whatsapp, item.reference].some(value => value?.toLowerCase().includes(term))) return false;
      if (sourceFilter !== "all" && item.source.toLowerCase() !== sourceFilter) return false;
      if (statusFilter !== "all" && item.status.toLowerCase() !== statusFilter) return false;
      if (paymentFilter !== "all" && item.paymentStatus.toLowerCase() !== paymentFilter) return false;
      if (stayFilter === "custom" && customDate && !(item.checkIn <= customDate && item.checkOut > customDate)) return false;
      return true;
    });
    if (sortDirection !== "default") rows.sort((a, b) => sortDirection === "asc" ? a.bookingId.localeCompare(b.bookingId) : b.bookingId.localeCompare(a.bookingId));
    return rows;
  }, [reservations, search, stayFilter, customDate, sourceFilter, statusFilter, paymentFilter, sortDirection]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const hasFilters = !!search || stayFilter !== "all" || sourceFilter !== "all" || statusFilter !== "all" || paymentFilter !== "all";

  function resetFilters() {
    setSearch(""); setStayFilter("all"); setCustomDate(""); setSourceFilter("all");
    setStatusFilter("all"); setPaymentFilter("all"); setPage(1);
  }

  function exportCsv() {
    const header = ["Booking ID", "Guest", "WhatsApp", "Source", "Check-in", "Check-out", "Room", "Payment", "Status", "Operational Status", "Total"];
    const rows = filtered.map(item => [item.bookingId, item.guestName, item.whatsapp, sourceLabel(item), item.checkIn, item.checkOut, item.room, item.paymentStatus, item.status, item.operationalStatus ?? "", item.total ?? ""]);
    const csv = [header, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = "reservations.csv"; link.click();
    URL.revokeObjectURL(url);
  }

  return <AdminShell title="Reservations" context="All Reservations">
    <div className="reservations-list-page">
      <div className="reservations-list-heading">
        <div><div className="reservations-list-title"><h1>Reservations</h1><span>{reservations.length} reservations</span></div><p>Kelola seluruh reservasi online dan offline</p></div>
        <Link className="reservations-list-new" href="/reservations/create-reservation-walkin">＋ New Reservation</Link>
      </div>
      <div className="reservations-list-search"><span aria-hidden="true">⌕</span><input ref={searchRef} value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search booking ID, guest, or WhatsApp" aria-label="Cari reservasi" /><kbd>⌘K</kbd></div>
      <div className="reservations-list-toolbar">
        <div className="reservations-list-filters">
          <select aria-label="Filter tanggal menginap" value={stayFilter} onChange={event => { setStayFilter(event.target.value); setPage(1); }}><option value="all">Stay Date: All Dates</option><option value="custom">Stay Date: Specific Date</option></select>
          {stayFilter === "custom" && <input type="date" aria-label="Pilih tanggal menginap" value={customDate} onChange={event => { setCustomDate(event.target.value); setPage(1); }} />}
          <select aria-label="Filter sumber" value={sourceFilter} onChange={event => { setSourceFilter(event.target.value); setPage(1); }}><option value="all">Source: All Sources</option><option value="website">Website</option><option value="walk-in">Walk-in</option><option value="phone">Phone</option><option value="ota">OTA</option></select>
          <select aria-label="Filter status" value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1); }}><option value="all">Status: All Status</option>{["Pending", "Confirmed", "Checked-in", "Checked-out", "Cancelled", "Expired", "Draft"].map(value => <option key={value} value={value.toLowerCase()}>{value}</option>)}</select>
          <select aria-label="Filter pembayaran" value={paymentFilter} onChange={event => { setPaymentFilter(event.target.value); setPage(1); }}><option value="all">Payment: All Payments</option>{["Unpaid", "Partial", "Paid", "Refunded", "Failed"].map(value => <option key={value} value={value.toLowerCase()}>{value}</option>)}</select>
          <button type="button" className="reservations-list-reset" disabled={!hasFilters} onClick={resetFilters}>Reset</button>
        </div>
        <div className="reservations-list-tools"><button type="button" onClick={exportCsv}>⇩ &nbsp; Export</button></div>
      </div>
      <div className="reservations-table-shell">
        <div className="reservations-table-scroll"><table className="reservations-table">
          <thead><tr><th><button type="button" onClick={() => setSortDirection(current => current === "asc" ? "desc" : "asc")}>BOOKING ↕</button></th><th>GUEST</th><th>SOURCE</th><th>STAY</th><th>ROOM</th><th>PAYMENT</th><th>STATUS</th><th>OPERATIONAL STATUS</th><th>ACTION</th></tr></thead>
          <tbody>{visible.map(item => {
            const nights = calculateNights(item.checkIn, item.checkOut);
            return <tr key={item.bookingId}>
              <td className="reservations-booking">{item.bookingId}</td>
              <td><span className="reservations-guest"><strong>{item.guestName}</strong><small>{item.whatsapp}</small></span></td>
              <td><span className="reservations-source">{sourceLabel(item)}</span></td>
              <td><span className="reservations-stay"><strong>{formatStayDate(item.checkIn)} → {formatStayDate(item.checkOut)}</strong><small>{nights} {nights === 1 ? "Night" : "Nights"}</small></span></td>
              <td>{item.room}</td>
              <td><span className={"reservations-badge reservations-badge--" + statusClass(item.paymentStatus)}>{item.paymentStatus}</span></td>
              <td><span className={"reservations-badge reservations-badge--" + statusClass(item.status)}>{item.status}</span></td>
              <td><span className={"reservations-badge reservations-badge--" + statusClass(item.operationalStatus ?? "")}>{item.operationalStatus ?? "—"}</span></td>
              <td><div className="reservations-row-actions">
                <Link className="reservations-view-link" href={"/reservations/" + encodeURIComponent(item.bookingId)}>View</Link>
                <div className="reservations-menu-anchor"><button type="button" aria-label={"Opsi " + item.bookingId} aria-expanded={openMenu === item.bookingId} onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); setMenuPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right }); setOpenMenu(current => current === item.bookingId ? null : item.bookingId); }}>⋮</button></div>
              </div></td>
            </tr>;
          })}{visible.length === 0 && <tr><td colSpan={9} className="reservations-empty">Tidak ada reservasi yang cocok dengan filter.</td></tr>}</tbody>
        </table></div>
        <div className="reservations-pagination"><span>Showing <strong>{filtered.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filtered.length)}</strong> of <strong>{filtered.length}</strong> reservations</span><div><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>‹ Previous</button>{Array.from({ length: pageCount }, (_, index) => index + 1).map(number => <button key={number} type="button" className={currentPage === number ? "reservations-page-active" : ""} aria-current={currentPage === number ? "page" : undefined} onClick={() => setPage(number)}>{number}</button>)}<button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next ›</button></div></div>
      </div>
      {openMenu && <div className="reservations-row-menu reservations-floating-menu" style={{ top: menuPosition.top, right: menuPosition.right }}><Link href={"/reservations/" + encodeURIComponent(openMenu)}>View details</Link></div>}
    </div>
  </AdminShell>;
}
