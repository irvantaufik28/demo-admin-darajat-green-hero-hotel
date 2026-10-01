"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminShell } from "../layout/AdminShell";
import { formatRupiah, formatStayDate } from "../../lib/walk-in-data";

type InHouseRecord = {
  bookingId: string;
  guestName: string;
  whatsapp: string;
  room: string;
  roomNumber: string;
  checkOut: string;
  paymentStatus: "Paid" | "Partial" | "Unpaid";
  reservationStatus: "Checked-in";
  operationalStatus: "In House" | "Due Out" | "Overdue";
  deposit: number;
};

// Nine fixed demo cases, independent of reservations and the current date.
const guests: InHouseRecord[] = [
  { bookingId: "GH-260929-131", guestName: "Andika Putra", whatsapp: "+62 812 3311 2231", room: "Deluxe Room", roomNumber: "201", checkOut: "2026-10-01", paymentStatus: "Paid", reservationStatus: "Checked-in", operationalStatus: "In House", deposit: 0 },
  { bookingId: "GH-260929-132", guestName: "Melati Sari", whatsapp: "+62 812 3311 2232", room: "Family Room", roomNumber: "105", checkOut: "2026-10-01", paymentStatus: "Partial", reservationStatus: "Checked-in", operationalStatus: "In House", deposit: 300000 },
  { bookingId: "GH-260929-133", guestName: "Doni Saputra", whatsapp: "+62 812 3311 2233", room: "Suite Room", roomNumber: "301", checkOut: "2026-10-01", paymentStatus: "Unpaid", reservationStatus: "Checked-in", operationalStatus: "In House", deposit: 0 },
  { bookingId: "GH-260929-134", guestName: "Nadia Putri", whatsapp: "+62 812 3311 2234", room: "Deluxe Room", roomNumber: "202", checkOut: "2026-09-30", paymentStatus: "Paid", reservationStatus: "Checked-in", operationalStatus: "Due Out", deposit: 300000 },
  { bookingId: "GH-260929-135", guestName: "Fikri Ramadhan", whatsapp: "+62 812 3311 2235", room: "Family Room", roomNumber: "106", checkOut: "2026-09-30", paymentStatus: "Partial", reservationStatus: "Checked-in", operationalStatus: "Due Out", deposit: 0 },
  { bookingId: "GH-260929-136", guestName: "Rani Maharani", whatsapp: "+62 812 3311 2236", room: "Deluxe Room", roomNumber: "203", checkOut: "2026-09-30", paymentStatus: "Unpaid", reservationStatus: "Checked-in", operationalStatus: "Due Out", deposit: 300000 },
  { bookingId: "GH-260929-137", guestName: "Bagas Pratama", whatsapp: "+62 812 3311 2237", room: "Deluxe Room", roomNumber: "204", checkOut: "2026-09-29", paymentStatus: "Paid", reservationStatus: "Checked-in", operationalStatus: "Overdue", deposit: 0 },
  { bookingId: "GH-260929-138", guestName: "Lina Kusuma", whatsapp: "+62 812 3311 2238", room: "Family Room", roomNumber: "107", checkOut: "2026-09-29", paymentStatus: "Partial", reservationStatus: "Checked-in", operationalStatus: "Overdue", deposit: 300000 },
  { bookingId: "GH-260929-139", guestName: "Yoga Hidayat", whatsapp: "+62 812 3311 2239", room: "Deluxe Room", roomNumber: "205", checkOut: "2026-09-29", paymentStatus: "Unpaid", reservationStatus: "Checked-in", operationalStatus: "Overdue", deposit: 0 },
];

function paymentTone(status: string) {
  if (status === "Paid") return "success";
  if (status === "Unpaid") return "danger";
  return "warning";
}

export function InHousePage() {
  const [search, setSearch] = useState("");
  const [checkOut, setCheckOut] = useState("all");
  const [payment, setPayment] = useState("all");

  const filtered = guests.filter(item => {
    const query = search.trim().toLowerCase();
    if (query && ![item.guestName, item.bookingId, item.room, item.roomNumber].some(value => value.toLowerCase().includes(query))) return false;
    if (checkOut !== "all" && item.operationalStatus.toLowerCase() !== checkOut) return false;
    if (payment !== "all" && item.paymentStatus.toLowerCase() !== payment) return false;
    return true;
  });
  const roomsOccupied = guests.length;

  return <AdminShell title="Reservations" context="In House">
    <div className="in-house-page">
      <div className="in-house-heading"><div><div className="in-house-title"><h1>In House</h1><span>{guests.length} guests in house · {roomsOccupied} rooms occupied</span></div><p>Sembilan kasus demo tamu yang masih berstatus Checked-in.</p></div><Link href="/reservations/create-reservation-walkin" className="action-button">＋ New Reservation</Link></div>
      <div className="in-house-filters"><div className="in-house-filter-controls"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search guest, room, or booking ID" aria-label="Search in-house guests" /><select value={checkOut} onChange={event => setCheckOut(event.target.value)} aria-label="Filter check-out status"><option value="all">Check-out: All</option><option value="in house">Check-out: Later</option><option value="due out">Check-out: Today</option><option value="overdue">Check-out: Overdue</option></select><select value={payment} onChange={event => setPayment(event.target.value)} aria-label="Filter payment status"><option value="all">Payment: All Payments</option><option value="unpaid">Payment: Unpaid</option><option value="partial">Payment: Partial</option><option value="paid">Payment: Paid</option></select><button type="button" onClick={() => { setSearch(""); setCheckOut("all"); setPayment("all"); }}>Reset</button></div><span>Showing <strong>{filtered.length}</strong> of <strong>{guests.length}</strong> entries</span></div>
      <section className="in-house-table-shell"><div className="in-house-table-scroll"><table className="in-house-table"><thead><tr><th>GUEST</th><th>BOOKING</th><th>ROOM</th><th>CHECK-OUT</th><th>PAYMENT</th><th>RESERVATION STATUS</th><th>OPERATIONAL STATUS</th><th>DEPOSIT</th><th>ACTION</th></tr></thead><tbody>
        {filtered.map(item => <tr key={item.bookingId}>
          <td><div className="reservations-guest"><strong>{item.guestName}</strong><small>{item.whatsapp}</small></div></td>
          <td><span className="in-house-booking">{item.bookingId}</span></td>
          <td className="in-house-room">{item.room} · {item.roomNumber}</td>
          <td>{formatStayDate(item.checkOut)}</td>
          <td><span className={"reservations-badge reservations-badge--" + paymentTone(item.paymentStatus)}>{item.paymentStatus}</span></td>
          <td><span className="reservations-badge reservations-badge--info">{item.reservationStatus}</span></td>
          <td><span className={"reservations-badge reservations-badge--" + (item.operationalStatus === "Overdue" ? "danger" : item.operationalStatus === "Due Out" ? "warning" : "info")}>{item.operationalStatus}</span></td>
          <td>{item.deposit === 0 ? <span className="in-house-muted">No Deposit</span> : <span className="reservations-badge reservations-badge--warning">{formatRupiah(item.deposit)}</span>}</td>
          <td><button type="button" className="in-house-view-button" disabled>View</button></td>
        </tr>)}
        {filtered.length === 0 && <tr><td className="in-house-empty" colSpan={9}>Tidak ada tamu yang cocok dengan filter.</td></tr>}
      </tbody></table></div><div className="in-house-table-footer"><span className="in-house-audit-dot" />Data demo statis</div></section>
    </div>
  </AdminShell>;
}
