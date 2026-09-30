"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminShell } from "../layout/AdminShell";
import { calculateNights, formatStayDate } from "../../lib/walk-in-data";
import { loadAllReservationDetails, type ReservationDetail } from "../../lib/reservation-detail-data";
import { reservationReferenceDate } from "../../lib/reservation-list-data";

function displayDate(value: string) {
  const date = new Date(value + "T00:00:00");
  return new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
}

function sourceLabel(item: ReservationDetail) {
  return item.source === "OTA" && item.channel ? "OTA · " + item.channel : item.source;
}

function statusTone(value: string) {
  if (value === "Paid" || value === "Confirmed") return "success";
  if (value === "Checked-in") return "info";
  return "warning";
}

export function ArrivalsTodayPage() {
  const today = reservationReferenceDate;
  const [reservations, setReservations] = useState<ReservationDetail[]>([]);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("all");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    setReservations(loadAllReservationDetails());
  }, []);

  const arrivals = useMemo(() => reservations
    .filter(item => item.checkIn === today && !["Cancelled", "Checked-out", "Draft", "Expired"].includes(item.status))
    .sort((a, b) => {
      const priority: Record<string, number> = { Confirmed: 0, Pending: 1, "Checked-in": 2 };
      return (priority[a.status] ?? 3) - (priority[b.status] ?? 3) || a.bookingId.localeCompare(b.bookingId);
    }), [reservations, today]);
  const filtered = arrivals.filter(item => {
    const query = search.trim().toLowerCase();
    if (query && ![item.bookingId, item.guestName, item.whatsapp].some(value => value.toLowerCase().includes(query))) return false;
    if (source !== "all" && item.source.toLowerCase() !== source) return false;
    if (status !== "all" && item.status.toLowerCase() !== status) return false;
    return true;
  });
  const awaiting = arrivals.filter(item => item.status === "Confirmed").length;
  const checkedIn = arrivals.filter(item => item.status === "Checked-in").length;
  const pending = arrivals.filter(item => item.status === "Pending").length;

  return <AdminShell title="Reservations" context="Arrivals Today">
    <div className="arrivals-page">
      <div className="arrivals-heading"><div><span className="arrivals-eyebrow">FRONT DESK · ARRIVALS</span><h1>Arrivals Today</h1><p>{today ? displayDate(today) : "Memuat tanggal..."} · Pantau tamu yang dijadwalkan check-in hari ini.</p></div><Link href="/reservations/create-reservation-walkin" className="action-button">＋ New Reservation</Link></div>
      <div className="arrivals-summary">
        <div className="summary-card"><span className="summary-card__label">Expected Arrivals</span><strong className="summary-card__value">{arrivals.length}</strong><span className="arrivals-card-caption">Reservasi dengan check-in hari ini</span></div>
        <div className="summary-card"><span className="summary-card__label">Awaiting Check-in</span><strong className="summary-card__value">{awaiting}</strong><span className="arrivals-card-caption">Siap diproses saat tamu tiba</span></div>
        <div className="summary-card"><span className="summary-card__label">Checked-in</span><strong className="summary-card__value">{checkedIn}</strong><span className="arrivals-card-caption">Tamu sudah tiba</span></div>
        <div className="summary-card"><span className="summary-card__label">Pending</span><strong className="summary-card__value">{pending}</strong><span className="arrivals-card-caption">Perlu konfirmasi atau pembayaran</span></div>
      </div>
      <section className="arrivals-panel">
        <div className="arrivals-panel-header"><div><h2>Today&apos;s Arrival List</h2><p>{arrivals.length} reservasi dijadwalkan tiba hari ini</p></div><div className="arrivals-panel-actions"><button type="button" className="reservation-secondary-button" onClick={() => setReservations(loadAllReservationDetails())} aria-label="Refresh arrivals">↻ Refresh</button><Link href="/reservations" className="reservation-secondary-button">All Reservations</Link></div></div>
        <div className="arrivals-filters"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search booking ID, guest, or WhatsApp" aria-label="Cari kedatangan" /><select value={source} onChange={event => setSource(event.target.value)} aria-label="Filter sumber reservasi"><option value="all">All Sources</option><option value="website">Website</option><option value="walk-in">Walk-in</option><option value="phone">Phone</option><option value="ota">OTA</option></select><select value={status} onChange={event => setStatus(event.target.value)} aria-label="Filter status kedatangan"><option value="all">All Status</option><option value="confirmed">Confirmed</option><option value="pending">Pending</option><option value="checked-in">Checked-in</option></select></div>
        <div className="arrivals-table-scroll"><table className="arrivals-table"><thead><tr><th>BOOKING</th><th>GUEST</th><th>SOURCE</th><th>STAY</th><th>ROOM</th><th>PAYMENT</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>
          {filtered.map(item => <tr key={item.bookingId}>
            <td className="reservations-booking">{item.bookingId}</td>
            <td><div className="reservations-guest"><strong>{item.guestName}</strong><small>{item.whatsapp}</small></div></td>
            <td><span className="reservations-source">{sourceLabel(item)}</span></td>
            <td><div className="reservations-stay"><strong>{formatStayDate(item.checkIn)} → {formatStayDate(item.checkOut)}</strong><small>{calculateNights(item.checkIn, item.checkOut)} nights</small></div></td>
            <td>{item.room}</td>
            <td><span className={"reservations-badge reservations-badge--" + statusTone(item.paymentStatus)}>{item.paymentStatus}</span></td>
            <td><span className={"reservations-badge reservations-badge--" + statusTone(item.status)}>{item.status}</span></td>
            <td><Link href={"/reservations/" + encodeURIComponent(item.bookingId)} className="reservations-view-link">View</Link></td>
          </tr>)}
          {filtered.length === 0 && <tr><td className="arrivals-empty" colSpan={8}>{arrivals.length === 0 ? "Belum ada reservasi yang dijadwalkan tiba hari ini." : "Tidak ada kedatangan yang cocok dengan filter."}</td></tr>}
        </tbody></table></div>
        <div className="arrivals-table-footer">Showing {filtered.length} of {arrivals.length} arrivals</div>
      </section>
    </div>
  </AdminShell>;
}
