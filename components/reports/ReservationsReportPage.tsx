"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AdminShell } from "../layout/AdminShell";
import { initialReservations, type ReservationRecord } from "../../lib/reservation-list-data";
import { calculateNights } from "../../lib/walk-in-data";

type DateBy = "booking" | "checkIn" | "checkOut";
const pageSize = 10;
const money = (value: number) => `Rp${value.toLocaleString("id-ID")}`;
const dateLabel = (value: string) => new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));

function bookingDate(row: ReservationRecord) {
  const match = row.bookingId.match(/^GH-(\d{2})(\d{2})(\d{2})-/);
  return match ? `20${match[1]}-${match[2]}-${match[3]}` : row.checkIn;
}

function roomQuantity(row: ReservationRecord) {
  return Math.max(1, Object.values(row.quantities ?? {}).reduce((sum, value) => sum + value, 0));
}

function roomLabel(row: ReservationRecord) {
  return row.room.replaceAll(" Room", "").replaceAll(", ", " / ");
}

function paidAmount(row: ReservationRecord) {
  return row.paymentStatus === "Refunded" ? 0 : row.amountPaid ?? 0;
}

function outstandingAmount(row: ReservationRecord) {
  return ["Cancelled", "Expired"].includes(row.status) ? 0 : Math.max(0, (row.total ?? 0) - paidAmount(row));
}

function badgeTone(status: string) {
  if (status === "Confirmed" || status === "Checked-in") return "success";
  if (status === "Cancelled" || status === "Expired") return "danger";
  if (status === "Pending") return "warning";
  return "neutral";
}

function exportCsv(rows: ReservationRecord[]) {
  const header = ["Booking ID", "Booking Date", "Guest", "Source", "Room Type", "Room Qty", "Check-in", "Check-out", "Nights", "Room Nights", "Reservation Status", "Booking Total", "Discount", "Paid", "Outstanding"];
  const body = rows.map((row) => {
    const nights = Math.max(1, calculateNights(row.checkIn, row.checkOut));
    return [row.bookingId, bookingDate(row), row.guestName, row.source === "OTA" && row.channel ? `OTA · ${row.channel}` : row.source, roomLabel(row), roomQuantity(row), row.checkIn, row.checkOut, nights, nights * roomQuantity(row), row.status, row.total ?? 0, 0, paidAmount(row), outstandingAmount(row)];
  });
  const csv = [header, ...body].map((cells) => cells.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  link.download = "reservation-report.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

export function ReservationsReportPage() {
  const [search, setSearch] = useState("");
  const [dateBy, setDateBy] = useState<DateBy>("booking");
  const [from, setFrom] = useState("2026-09-01");
  const [to, setTo] = useState("2026-10-31");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [room, setRoom] = useState("");
  const [ota, setOta] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => initialReservations.filter((row) => {
    const relevantDate = dateBy === "booking" ? bookingDate(row) : row[dateBy];
    const term = search.trim().toLowerCase();
    return (!term || [row.bookingId, row.guestName, row.whatsapp].some((value) => value.toLowerCase().includes(term))) &&
      (!from || relevantDate >= from) && (!to || relevantDate <= to) &&
      (!status || row.status === status) && (!source || row.source === source) &&
      (!room || row.room.toLowerCase().includes(room.toLowerCase())) &&
      (!ota || row.source === "OTA" && row.channel === ota);
  }), [search, dateBy, from, to, status, source, room, ota]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const active = filtered.filter((row) => !["Cancelled", "Expired"].includes(row.status));
  const bookingValue = active.reduce((sum, row) => sum + (row.total ?? 0), 0);
  const paid = active.reduce((sum, row) => sum + paidAmount(row), 0);
  const outstanding = active.reduce((sum, row) => sum + outstandingAmount(row), 0);
  const count = (value: string) => filtered.filter((row) => row.status === value).length;
  const roomNights = filtered.reduce((sum, row) => sum + Math.max(1, calculateNights(row.checkIn, row.checkOut)) * roomQuantity(row), 0);

  function reset() {
    setSearch(""); setDateBy("booking"); setFrom("2026-09-01"); setTo("2026-10-31");
    setStatus(""); setSource(""); setRoom(""); setOta(""); setPage(1);
  }

  return <AdminShell title="Reports" context="Reservations">
    <div className="report-reservations-page">
      <div className="report-reservations-heading"><div><h1>Reservations Report</h1><p>Monitor reservation activity, stay dates, room nights, booking value, payments, and outstanding balances.</p></div><span>Data demo · statis</span></div>
      <div className="report-reservations-overview">
        <section className="report-reservations-card"><h2>▣ &nbsp; Reservation Summary</h2><div className="report-reservations-metrics">{[["Total Resv", filtered.length], ["Confirmed", count("Confirmed")], ["Checked-in", count("Checked-in")], ["Checked-out", count("Checked-out")], ["Cancelled", count("Cancelled")], ["Room Nights", roomNights]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section>
        <section className="report-reservations-card"><h2>▣ &nbsp; Financial Snapshot</h2><div className="report-reservations-metrics report-reservations-metrics--finance"><div><span>Booking Value</span><strong>{money(bookingValue)}</strong></div><div><span>Paid</span><strong>{money(paid)}</strong></div><div><span>Outstanding</span><strong>{money(outstanding)}</strong></div></div><p>Nilai keuangan mencakup reservasi aktif dalam filter. Deposit tidak termasuk.</p></section>
      </div>
      <div className="report-reservations-filters"><div className="report-reservations-filter-main"><input aria-label="Search reservations report" placeholder="Search booking ID, guest, or WhatsApp" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /><label>Date By<select value={dateBy} onChange={(event) => { setDateBy(event.target.value as DateBy); setPage(1); }}><option value="booking">Booking Date</option><option value="checkIn">Check-in Date</option><option value="checkOut">Check-out Date</option></select></label><div className="report-reservations-dates"><input aria-label="From date" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /><span>–</span><input aria-label="To date" type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} /></div></div><div className="report-reservations-filter-extra"><select aria-label="Reservation status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All Status</option>{["Pending", "Confirmed", "Checked-in", "Checked-out", "Cancelled", "Expired"].map((value) => <option key={value}>{value}</option>)}</select><select aria-label="Source" value={source} onChange={(event) => { setSource(event.target.value); setOta(""); setPage(1); }}><option value="">All Sources</option>{["Website", "Phone", "Walk-in", "OTA"].map((value) => <option key={value}>{value}</option>)}</select><select aria-label="Room type" value={room} onChange={(event) => { setRoom(event.target.value); setPage(1); }}><option value="">All Room Types</option>{["Deluxe", "Family", "Suite"].map((value) => <option key={value}>{value}</option>)}</select><select aria-label="OTA channel" value={ota} disabled={source !== "OTA"} onChange={(event) => { setOta(event.target.value); setPage(1); }}><option value="">All OTA {source !== "OTA" ? "(Inactive)" : ""}</option>{[...new Set(initialReservations.filter((row) => row.source === "OTA").map((row) => row.channel).filter((value): value is string => Boolean(value)))].map((value) => <option key={value}>{value}</option>)}</select><button type="button" onClick={reset}>Reset</button><button type="button" className="report-reservations-export" onClick={() => exportCsv(filtered)}>↓ Export CSV</button></div></div>
      <div className="report-reservations-table-shell"><div className="report-reservations-table-scroll"><table className="report-reservations-table"><thead><tr>{["Booking ID", "Booking Date", "Guest", "Source", "Room Type", "Room Qty", "Check-in", "Check-out", "Nights", "Room Nights", "Reservation Status", "Booking Total", "Discount", "Paid", "Outstanding"].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{visible.map((row) => {
        const nights = Math.max(1, calculateNights(row.checkIn, row.checkOut));
        const outstanding = outstandingAmount(row);
        return <tr key={row.bookingId}><td><Link href={`/reservations/${row.bookingId}`}>{row.bookingId}</Link></td><td>{dateLabel(bookingDate(row))}</td><td>{row.guestName}</td><td>{row.source === "OTA" && row.channel ? `OTA · ${row.channel}` : row.source}</td><td>{roomLabel(row)}</td><td>{roomQuantity(row)}</td><td>{dateLabel(row.checkIn)}</td><td>{dateLabel(row.checkOut)}</td><td>{nights}</td><td>{nights * roomQuantity(row)}</td><td><span className={`reservations-badge reservations-badge--${badgeTone(row.status)}`}>{row.status}</span></td><td>{money(row.total ?? 0)}</td><td>{money(0)}</td><td>{money(paidAmount(row))}</td><td className={outstanding ? "report-reservations-outstanding" : ""}>{money(outstanding)}</td></tr>;
      })}</tbody></table>{filtered.length === 0 && <p className="report-reservations-empty">Tidak ada reservasi yang sesuai filter.</p>}</div><div className="report-reservations-footer"><span>Showing <strong>{filtered.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filtered.length)}</strong> of <strong>{filtered.length}</strong> reservations</span><div><button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Prev</button><span>{page} / {pageCount}</span><button type="button" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}>Next</button></div></div></div>
      <p className="report-reservations-note">All financial figures are in Indonesian Rupiah (IDR). Export CSV follows the active filters.</p>
    </div>
  </AdminShell>;
}
