"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AdminShell } from "../layout/AdminShell";
import { initialReservations, type ReservationRecord } from "../../lib/reservation-list-data";

const bookingIds = [
  "GH-260929-101", "GH-260929-102", "GH-261001-144",
  "GH-260929-106", "GH-260929-105", "GH-260929-104",
  "GH-260929-109", "GH-260929-108", "GH-260929-107",
  "GH-260929-110", "GH-261001-145", "GH-261001-146",
  "GH-260929-113", "GH-260929-114",
  "GH-261001-147", "GH-260929-116",
];

const paymentRows = bookingIds.map((id) => initialReservations.find((item) => item.bookingId === id)).filter((item): item is ReservationRecord => Boolean(item));
const money = (value: number) => `Rp${value.toLocaleString("id-ID")}`;
const dateLabel = (value: string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));

function badgeTone(value: string) {
  if (value === "Paid" || value === "Confirmed" || value === "Checked-in") return "success";
  if (value === "Partial" || value === "Pending" || value === "Unpaid") return "warning";
  if (value === "Checked-out" || value === "Refunded" || value === "Expired") return "neutral";
  return "danger";
}

function refundedAmount(row: ReservationRecord) {
  return row.paymentStatus === "Refunded" ? row.total ?? 0 : 0;
}

function exportCsv(rows: ReservationRecord[]) {
  const columns = ["Booking", "Guest", "Source", "Reservation Status", "Booking Total", "Paid", "Refunded", "Remaining", "Payment Status", "Method"];
  const csv = [columns, ...rows.map((row) => {
    const total = row.total ?? 0;
    const paid = row.paymentStatus === "Refunded" ? total : row.amountPaid ?? 0;
    return [row.bookingId, row.guestName, row.source, row.status, String(total), String(paid), String(refundedAmount(row)), String(Math.max(0, total - paid - refundedAmount(row))), row.paymentStatus, row.paymentMethod ?? "—"];
  })].map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  link.download = "payments.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

export function PaymentsPage() {
  const [search, setSearch] = useState("");
  const [reservationStatus, setReservationStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [source, setSource] = useState("");
  const [method, setMethod] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const visibleRows = useMemo(() => paymentRows.filter((row) => {
    const term = search.trim().toLowerCase();
    return (!term || [row.bookingId, row.guestName, row.whatsapp].some((value) => value.toLowerCase().includes(term))) &&
      (!reservationStatus || row.status === reservationStatus) &&
      (!paymentStatus || row.paymentStatus === paymentStatus) &&
      (!source || row.source === source) &&
      (!method || row.paymentMethod === method) &&
      (!from || row.checkIn >= from) && (!to || row.checkIn <= to);
  }), [search, reservationStatus, paymentStatus, source, method, from, to]);

  function reset() {
    setSearch(""); setReservationStatus(""); setPaymentStatus("");
    setSource(""); setMethod(""); setFrom(""); setTo("");
  }

  return <AdminShell title="Payments" context="Payments">
    <div className="payments-page">
      <div className="payments-heading"><div><h1>Payments</h1><p>Pantau status pembayaran dan catat pembayaran reservasi</p></div><button type="button" onClick={() => exportCsv(visibleRows)}>↓ Export CSV</button></div>
      <div className="payments-filters">
        <input aria-label="Search payments" placeholder="Search booking, guest, or WhatsApp" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select aria-label="Reservation status" value={reservationStatus} onChange={(event) => setReservationStatus(event.target.value)}><option value="">Res: All Status</option>{["Pending", "Confirmed", "Checked-in", "Checked-out", "Cancelled", "Expired"].map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Payment status" value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}><option value="">Payment: All</option>{["Unpaid", "Partial", "Paid", "Failed", "Refunded", "Expired"].map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Source" value={source} onChange={(event) => setSource(event.target.value)}><option value="">Source: All</option>{["Website", "Walk-in", "Phone", "OTA"].map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Payment method" value={method} onChange={(event) => setMethod(event.target.value)}><option value="">Method: All</option>{[...new Set(paymentRows.map((row) => row.paymentMethod ?? "—"))].map((value) => <option key={value}>{value}</option>)}</select>
        <div className="payments-date-filter"><input aria-label="From check-in date" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /><span>–</span><input aria-label="To check-in date" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></div>
        <button type="button" onClick={reset}>Reset</button>
      </div>
      <div className="payments-table-shell"><div className="payments-table-scroll"><table className="payments-table"><thead><tr><th>Booking</th><th>Guest</th><th>Source</th><th>Reservation Status</th><th>Booking Total</th><th>Paid</th><th>Refunded</th><th>Remaining</th><th>Payment Status</th><th>Method</th><th>Action</th></tr></thead><tbody>{visibleRows.map((row) => {
        const total = row.total ?? 0;
        const paid = row.paymentStatus === "Refunded" ? total : row.amountPaid ?? 0;
        const refunded = refundedAmount(row);
        const remaining = Math.max(0, total - paid - refunded);
        return <tr key={row.bookingId}><td><strong className="payments-booking">{row.bookingId}</strong><small>{dateLabel(row.checkIn)} – {dateLabel(row.checkOut)}</small></td><td><strong>{row.guestName}</strong><small>{row.whatsapp}</small></td><td>{row.source === "OTA" && row.channel ? `OTA · ${row.channel}` : row.source}</td><td><span className={`reservations-source payments-badge--${badgeTone(row.status)}`}>{row.status}</span></td><td>{money(total)}</td><td className="payments-paid">{paid ? money(paid) : "—"}</td><td className={refunded ? "payments-refunded" : ""}>{refunded ? money(refunded) : "—"}</td><td className={remaining ? "payments-remaining" : ""}>{money(remaining)}</td><td><span className={`reservations-source payments-badge--${badgeTone(row.paymentStatus)}`}>{row.paymentStatus}</span></td><td>{row.paymentMethod ?? "—"}</td><td><Link href={`/payments/${row.bookingId}`}>View</Link></td></tr>;
      })}</tbody></table>{visibleRows.length === 0 && <p className="payments-empty">Tidak ada pembayaran yang sesuai filter.</p>}</div><div className="payments-footer">Menampilkan <strong>{visibleRows.length}</strong> dari <strong>{paymentRows.length}</strong> transaksi reservasi</div></div>
      <div className="payments-note">Deposit jaminan dicatat terpisah dari saldo pembayaran reservasi.</div>
    </div>
  </AdminShell>;
}
