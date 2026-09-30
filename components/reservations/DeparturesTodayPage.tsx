"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminShell } from "../layout/AdminShell";
import { loadAllReservationDetails, type ReservationDetail } from "../../lib/reservation-detail-data";
import { reservationReferenceDate } from "../../lib/reservation-list-data";

function departureStatus(reservation: ReservationDetail) {
  return reservation.status === "Checked-out" ? "Checked-out" : "Due Out";
}

function paymentTone(status: string) {
  if (status === "Paid") return "success";
  if (status === "Unpaid") return "danger";
  return "warning";
}

function formatCurrency(value: number) {
  return "Rp" + new Intl.NumberFormat("id-ID").format(value);
}

function depositLabel(reservation: ReservationDetail) {
  if (!reservation.depositAmount) return "No Deposit";
  if (reservation.status === "Checked-out" && reservation.depositRefunded) return "Refunded";
  const held = reservation.depositAmount - (reservation.depositRefunded ?? 0) - (reservation.depositDeducted ?? 0);
  return held > 0 ? `${formatCurrency(held)} · Held` : "Settled";
}

export function DeparturesTodayPage() {
  const today = reservationReferenceDate;
  const [reservations, setReservations] = useState<ReservationDetail[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [payment, setPayment] = useState("all");

  useEffect(() => {
    setReservations(loadAllReservationDetails());
  }, []);

  const departures = useMemo(() => reservations
    .filter(item => item.checkOut === today && ["Checked-in", "Checked-out"].includes(item.status))
    .sort((a, b) => Number(a.status === "Checked-out") - Number(b.status === "Checked-out") || a.guestName.localeCompare(b.guestName)), [reservations, today]);
  const filtered = departures.filter(item => {
    const query = search.trim().toLowerCase();
    if (query && ![item.guestName, item.bookingId, item.whatsapp].some(value => value.toLowerCase().includes(query))) return false;
    if (status !== "all" && departureStatus(item).toLowerCase() !== status) return false;
    if (payment !== "all" && item.paymentStatus.toLowerCase() !== payment) return false;
    return true;
  });
  const dueOut = departures.filter(item => item.status !== "Checked-out").length;

  return <AdminShell title="Reservations" context="Departures Today">
    <div className="departures-page">
      <div className="departures-heading">
        <div>
          <div className="departures-heading-title"><h1>Departures Today</h1><span className="departures-count">{departures.length} departures today · {dueOut} belum check-out</span></div>
          <p>Tamu yang dijadwalkan check-out hari ini</p>
        </div>
        <Link href="/reservations/create-reservation-walkin" className="action-button">＋ New Reservation</Link>
      </div>
      <div className="departures-filters">
        <div className="departures-filter-controls">
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search guest or booking ID" aria-label="Search guest or booking ID" />
          <select value={status} onChange={event => setStatus(event.target.value)} aria-label="Filter departure status"><option value="all">Status: All</option><option value="due out">Due Out</option><option value="checked-out">Checked-out</option></select>
          <select value={payment} onChange={event => setPayment(event.target.value)} aria-label="Filter payment status"><option value="all">Payment: All Payments</option><option value="unpaid">Unpaid</option><option value="partial">Partial</option><option value="paid">Paid</option></select>
          <button type="button" onClick={() => { setSearch(""); setStatus("all"); setPayment("all"); }}>Reset</button>
        </div>
        <span>Showing {filtered.length} of {departures.length} entries</span>
      </div>
      <section className="departures-table-shell">
        <div className="departures-table-scroll"><table className="departures-table"><thead><tr><th>GUEST</th><th>BOOKING</th><th>ROOM</th><th>PAYMENT</th><th>DEPOSIT</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>
          {filtered.map(item => <tr key={item.bookingId} className={item.status === "Checked-out" ? "departures-row--complete" : undefined}>
            <td><div className="reservations-guest"><strong>{item.guestName}</strong><small>{item.whatsapp}</small></div></td>
            <td className="departures-booking">{item.bookingId}</td>
            <td className="departures-room">{item.room}{item.roomNumbers?.length ? " · " + item.roomNumbers.join(", ") : ""}</td>
            <td><span className={"reservations-badge reservations-badge--" + paymentTone(item.paymentStatus)}>{item.paymentStatus}</span></td>
            <td>{item.depositAmount ? <span className="reservations-badge reservations-badge--warning">{depositLabel(item)}</span> : <span className="departures-muted">No Deposit</span>}</td>
            <td><span className="reservations-badge reservations-badge--neutral">{departureStatus(item)}</span></td>
            <td><Link href={"/reservations/" + encodeURIComponent(item.bookingId)} className="departures-view-link">View</Link></td>
          </tr>)}
          {filtered.length === 0 && <tr><td colSpan={7} className="departures-empty">{departures.length === 0 ? "Belum ada reservasi yang dijadwalkan check-out hari ini." : "Tidak ada tamu yang cocok dengan filter."}</td></tr>}
        </tbody></table></div>
        <div className="departures-table-footer"><span className="departures-audit-dot" />Data reservasi tersimpan di browser ini</div>
      </section>
    </div>
  </AdminShell>;
}
