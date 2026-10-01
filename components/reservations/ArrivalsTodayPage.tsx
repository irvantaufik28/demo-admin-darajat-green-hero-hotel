"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminShell } from "../layout/AdminShell";
import { calculateNights, formatStayDate } from "../../lib/walk-in-data";
import type { OperationalStatus, ReservationRecord } from "../../lib/reservation-list-data";

type ArrivalRecord = ReservationRecord & { operationalStatus: OperationalStatus; action: "View" };

const arrivals: ArrivalRecord[] = [
  { bookingId: "GH-260929-117", guestName: "Dewi Kartika", whatsapp: "+62 812 3311 2217", source: "Website", checkIn: "2026-09-30", checkOut: "2026-10-01", room: "Deluxe Room", paymentStatus: "Paid", status: "Confirmed", operationalStatus: "Ready to Check-in", action: "View" },
  { bookingId: "GH-260929-105", guestName: "Rafi Nugraha", whatsapp: "+62 812 3311 2205", source: "Phone", checkIn: "2026-09-30", checkOut: "2026-10-01", room: "Family Room", paymentStatus: "Partial", status: "Confirmed", operationalStatus: "Ready to Check-in", action: "View" },
  { bookingId: "GH-260929-104", guestName: "Sari Wulandari", whatsapp: "+62 812 3311 2204", source: "Phone", checkIn: "2026-09-30", checkOut: "2026-10-01", room: "Deluxe Room", paymentStatus: "Unpaid", status: "Confirmed", operationalStatus: "Ready to Check-in", action: "View" },
  { bookingId: "GH-260929-101", guestName: "Nabila Putri", whatsapp: "+62 857 1122 3344", source: "Phone", checkIn: "2026-09-30", checkOut: "2026-10-01", room: "Deluxe Room", paymentStatus: "Unpaid", status: "Pending", operationalStatus: "Awaiting Confirmation", action: "View" },
  { bookingId: "GH-260929-102", guestName: "Ayu Lestari", whatsapp: "+62 812 7788 9900", source: "Phone", checkIn: "2026-09-30", checkOut: "2026-10-01", room: "Family Room", paymentStatus: "Partial", status: "Pending", operationalStatus: "Awaiting Confirmation", action: "View" },
  { bookingId: "GH-260929-119", guestName: "Intan Permata", whatsapp: "+62 812 3311 2219", source: "Phone", checkIn: "2026-09-30", checkOut: "2026-10-01", room: "Deluxe Room", paymentStatus: "Paid", status: "Checked-in", operationalStatus: "Checked In", action: "View" },
  { bookingId: "GH-260929-120", guestName: "Yusuf Maulana", whatsapp: "+62 812 3311 2220", source: "Walk-in", checkIn: "2026-09-30", checkOut: "2026-10-01", room: "Family Room", paymentStatus: "Partial", status: "Checked-in", operationalStatus: "Checked In", action: "View" },
  { bookingId: "GH-260929-121", guestName: "Maya Lestari", whatsapp: "+62 812 3311 2221", source: "Phone", checkIn: "2026-09-30", checkOut: "2026-10-01", room: "Suite Room", paymentStatus: "Unpaid", status: "Checked-in", operationalStatus: "Checked In", action: "View" },
];

function sourceLabel(item: ReservationRecord) {
  return item.source === "OTA" && item.channel ? "OTA · " + item.channel : item.source;
}

function statusTone(value: string) {
  if (value === "Paid" || value === "Confirmed") return "success";
  if (value === "Checked-in" || value === "Checked In") return "info";
  if (value === "Ready to Check-in") return "success";
  return "warning";
}

export function ArrivalsTodayPage() {
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("all");
  const filtered = arrivals.filter(item => {
    const query = search.trim().toLowerCase();
    if (query && ![item.bookingId, item.guestName, item.whatsapp].some(value => value.toLowerCase().includes(query))) return false;
    if (source !== "all" && item.source.toLowerCase() !== source) return false;
    return true;
  });

  return <AdminShell title="Reservations" context="Arrivals Today">
    <div className="arrivals-page">
      <div className="arrivals-heading"><div><span className="arrivals-eyebrow">FRONT DESK · ARRIVALS</span><h1>Arrivals Today</h1><p>Data demo kedatangan dan tamu yang sudah check-in.</p></div><Link href="/reservations/create-reservation-walkin" className="action-button">＋ New Reservation</Link></div>
      <section className="arrivals-panel">
        <div className="arrivals-panel-header"><div><h2>Today&apos;s Arrival List</h2><p>{arrivals.length} reservasi demo</p></div><div className="arrivals-panel-actions"><Link href="/reservations" className="reservation-secondary-button">All Reservations</Link></div></div>
        <div className="arrivals-filters"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search booking ID, guest, or WhatsApp" aria-label="Cari kedatangan" /><select value={source} onChange={event => setSource(event.target.value)} aria-label="Filter sumber reservasi"><option value="all">All Sources</option><option value="website">Website</option><option value="walk-in">Walk-in</option><option value="phone">Phone</option><option value="ota">OTA</option></select></div>
        <div className="arrivals-table-scroll"><table className="arrivals-table"><thead><tr><th>BOOKING</th><th>GUEST</th><th>SOURCE</th><th>STAY</th><th>ROOM</th><th>PAYMENT</th><th>STATUS</th><th>OPERATIONAL STATUS</th><th>ACTION</th></tr></thead><tbody>
          {filtered.map(item => <tr key={item.bookingId}>
            <td className="reservations-booking">{item.bookingId}</td>
            <td><div className="reservations-guest"><strong>{item.guestName}</strong><small>{item.whatsapp}</small></div></td>
            <td><span className="reservations-source">{sourceLabel(item)}</span></td>
            <td><div className="reservations-stay"><strong>{formatStayDate(item.checkIn)} → {formatStayDate(item.checkOut)}</strong><small>{calculateNights(item.checkIn, item.checkOut)} nights</small></div></td>
            <td>{item.room}</td>
            <td><span className={"reservations-badge reservations-badge--" + statusTone(item.paymentStatus)}>{item.paymentStatus}</span></td>
            <td><span className={"reservations-badge reservations-badge--" + statusTone(item.status)}>{item.status}</span></td>
            <td><span className={"reservations-badge reservations-badge--" + statusTone(item.operationalStatus)}>{item.operationalStatus}</span></td>
            <td><Link href={"/reservations/" + encodeURIComponent(item.bookingId)} className="reservations-view-link">View</Link></td>
          </tr>)}
          {filtered.length === 0 && <tr><td className="arrivals-empty" colSpan={9}>Tidak ada kedatangan yang cocok dengan filter.</td></tr>}
        </tbody></table></div>
        <div className="arrivals-table-footer">Showing {filtered.length} of {arrivals.length} arrivals</div>
      </section>
    </div>
  </AdminShell>;
}
