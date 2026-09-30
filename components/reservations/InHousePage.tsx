"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminShell } from "../layout/AdminShell";
import { formatStayDate } from "../../lib/walk-in-data";
import { loadAllReservationDetails, type ReservationDetail } from "../../lib/reservation-detail-data";
import { reservationReferenceDate } from "../../lib/reservation-list-data";

function daysUntil(date: string, today: string) {
  return Math.round((new Date(date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000);
}

function occupiedUnits(reservation: ReservationDetail) {
  if (reservation.roomNumbers?.length) return reservation.roomNumbers.length;
  const quantities = Object.values(reservation.quantities ?? {});
  return quantities.length ? Math.max(1, quantities.reduce((sum, quantity) => sum + quantity, 0)) : 1;
}

function depositLabel(reservation: ReservationDetail) {
  const held = (reservation.depositAmount ?? 0) - (reservation.depositRefunded ?? 0) - (reservation.depositDeducted ?? 0);
  return held > 0 ? `Rp${new Intl.NumberFormat("id-ID").format(held)} · Held` : "No Deposit";
}

function paymentTone(status: string) {
  if (status === "Paid") return "success";
  if (status === "Unpaid") return "danger";
  return "warning";
}

export function InHousePage() {
  const today = reservationReferenceDate;
  const [reservations, setReservations] = useState<ReservationDetail[]>([]);
  const [search, setSearch] = useState("");
  const [checkOut, setCheckOut] = useState("all");
  const [payment, setPayment] = useState("all");

  useEffect(() => {
    setReservations(loadAllReservationDetails());
  }, []);

  const guests = useMemo(() => reservations
    .filter(item => item.status === "Checked-in" && item.checkIn <= today)
    .sort((a, b) => a.checkOut.localeCompare(b.checkOut) || a.guestName.localeCompare(b.guestName)), [reservations, today]);
  const filtered = guests.filter(item => {
    const query = search.trim().toLowerCase();
    if (query && ![item.guestName, item.bookingId, item.room, ...(item.roomNumbers ?? [])].some(value => value.toLowerCase().includes(query))) return false;
    const remaining = daysUntil(item.checkOut, today);
    if (checkOut === "today" && remaining !== 0) return false;
    if (checkOut === "tomorrow" && remaining !== 1) return false;
    if (checkOut === "later" && remaining <= 1) return false;
    if (payment !== "all" && item.paymentStatus.toLowerCase() !== payment) return false;
    return true;
  });
  const roomsOccupied = guests.reduce((sum, item) => sum + occupiedUnits(item), 0);

  return <AdminShell title="Reservations" context="In House">
    <div className="in-house-page">
      <div className="in-house-heading"><div><div className="in-house-title"><h1>In House</h1><span>{guests.length} guests in house · {roomsOccupied} rooms occupied</span></div><p>Tamu yang sedang menginap saat ini</p></div><Link href="/reservations/create-reservation-walkin" className="action-button">＋ New Reservation</Link></div>
      <div className="in-house-filters"><div className="in-house-filter-controls"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search guest, room, or booking ID" aria-label="Search in-house guests" /><select value={checkOut} onChange={event => setCheckOut(event.target.value)} aria-label="Filter check-out date"><option value="all">Check-out: All</option><option value="today">Check-out: Today</option><option value="tomorrow">Check-out: Tomorrow</option><option value="later">Check-out: Later</option></select><select value={payment} onChange={event => setPayment(event.target.value)} aria-label="Filter payment status"><option value="all">Payment: All Payments</option><option value="unpaid">Payment: Unpaid</option><option value="partial">Payment: Partial</option><option value="paid">Payment: Paid</option></select><button type="button" onClick={() => { setSearch(""); setCheckOut("all"); setPayment("all"); }}>Reset</button></div><span>Showing <strong>{filtered.length}</strong> of <strong>{guests.length}</strong> entries</span></div>
      <section className="in-house-table-shell"><div className="in-house-table-scroll"><table className="in-house-table"><thead><tr><th>GUEST</th><th>BOOKING</th><th>ROOM</th><th>STAY</th><th>PAYMENT</th><th>DEPOSIT</th><th>ACTION</th></tr></thead><tbody>
        {filtered.map(item => { const remaining = daysUntil(item.checkOut, today); const held = depositLabel(item); return <tr key={item.bookingId}>
          <td><div className="reservations-guest"><strong>{item.guestName}</strong><small>{item.whatsapp}</small></div></td>
          <td><span className="in-house-booking">{item.bookingId}</span></td>
          <td className="in-house-room">{item.room}{item.roomNumbers?.length ? " · " + item.roomNumbers.join(", ") : ""}</td>
          <td><div className="in-house-stay"><strong>{formatStayDate(item.checkIn)} → {formatStayDate(item.checkOut)}</strong>{remaining === 0 ? <span className="in-house-due">Check-out today</span> : <small>{remaining < 0 ? `${Math.abs(remaining)} ${remaining === -1 ? "day" : "days"} overdue` : `${remaining} ${remaining === 1 ? "night" : "nights"} remaining`}</small>}</div></td>
          <td><span className={"reservations-badge reservations-badge--" + paymentTone(item.paymentStatus)}>{item.paymentStatus}</span></td>
          <td>{held === "No Deposit" ? <span className="in-house-muted">No Deposit</span> : <span className="reservations-badge reservations-badge--warning">{held}</span>}</td>
          <td><button type="button" className="in-house-view-button" disabled>View</button></td>
        </tr>; })}
        {filtered.length === 0 && <tr><td className="in-house-empty" colSpan={7}>{guests.length === 0 ? "Belum ada tamu yang sedang menginap." : "Tidak ada tamu yang cocok dengan filter."}</td></tr>}
      </tbody></table></div><div className="in-house-table-footer"><span className="in-house-audit-dot" />Data reservasi tersimpan di browser ini</div></section>
    </div>
  </AdminShell>;
}
