"use client";

import { useMemo, useState } from "react";
import { AdminShell } from "../../../components/layout/AdminShell";
import {
  revenueMethods,
  revenueRows,
  revenueSources,
  revenueTotals,
  type RevenueRow,
} from "../constants/revenue-report-data";

type DateBy = "paymentDate" | "bookingDate" | "checkIn";
const money = (value: number) => `Rp${value.toLocaleString("id-ID")}`;

function exportCsv(rows: RevenueRow[]) {
  const header = [
    "Booking ID", "Guest", "Source", "Reservation Status", "Payment Status",
    "Method", "Booking Date", "Payment Date", "Check-in Date", "Room Type",
    "Gross Booking Value", "Discount", "Net Booking Value", "Paid", "Refunded",
    "Outstanding", "Net Collected",
  ];
  const body = rows.map((row) => [
    row.bookingId, row.guestName, row.source, row.status, row.paymentStatus,
    row.methodGroup, row.bookingDate, row.paymentDate ?? "", row.checkIn, row.room,
    row.gross, row.discount, row.gross - row.discount, row.paid, row.refunded,
    row.outstanding, row.paid - row.refunded,
  ]);
  const csv = [header, ...body]
    .map((cells) => cells.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  link.download = "revenue-report.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

export function RevenueReportPage() {
  const [dateBy, setDateBy] = useState<DateBy>("bookingDate");
  const [from, setFrom] = useState("2026-09-01");
  const [to, setTo] = useState("2026-10-31");
  const [source, setSource] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [reservationStatus, setReservationStatus] = useState("");
  const [method, setMethod] = useState("");
  const [room, setRoom] = useState("");

  const filtered = useMemo(() => revenueRows.filter((row) => {
    const relevantDate = row[dateBy];
    return relevantDate !== null &&
      (!from || relevantDate >= from) &&
      (!to || relevantDate <= to) &&
      (!source || row.source === source) &&
      (!paymentStatus || row.paymentStatus === paymentStatus) &&
      (!reservationStatus || row.status === reservationStatus) &&
      (!method || row.methodGroup === method) &&
      (!room || row.room.toLowerCase().includes(room.toLowerCase()));
  }), [dateBy, from, to, source, paymentStatus, reservationStatus, method, room]);

  const totals = revenueTotals(filtered);
  const sourceRows = revenueSources.map((name) => ({
    name,
    ...revenueTotals(filtered.filter((row) => row.source === name)),
  }));
  const methodRows = revenueMethods.map((name) => ({
    name,
    ...revenueTotals(filtered.filter((row) => row.methodGroup === name)),
  }));

  function reset() {
    setDateBy("bookingDate");
    setFrom("2026-09-01");
    setTo("2026-10-31");
    setSource("");
    setPaymentStatus("");
    setReservationStatus("");
    setMethod("");
    setRoom("");
  }

  return (
    <AdminShell title="Reports" context="Revenue">
      <div className="revenue-report-page">
        <header className="revenue-report-heading">
          <div>
            <h1>Revenue Report</h1>
            <p>Monitor booking value, payments, refunds, outstanding balances, and net collections.</p>
          </div>
          <span>Data demo · statis</span>
        </header>

        <section className="revenue-report-kpis" aria-label="Revenue summary">
          {[
            ["Gross Booking Value", totals.gross, "gross"],
            ["Discount", totals.discount, "discount"],
            ["Net Booking Value", totals.gross - totals.discount, "net"],
            ["Net Collected", totals.paid - totals.refunded, "collected"],
            ["Paid", totals.paid, "paid"],
            ["Refunded", totals.refunded, "refunded"],
            ["Outstanding", totals.outstanding, "outstanding"],
          ].map(([label, value, tone]) => (
            <div className={`revenue-report-kpi revenue-report-kpi--${tone}`} key={label}>
              <span>{label}</span>
              <strong>{money(Number(value))}</strong>
            </div>
          ))}
        </section>
        <p className="revenue-report-disclaimer">
          Security Deposit is excluded from revenue and net collection calculations.
          Diskon belum tersedia pada data statis, sehingga ditampilkan Rp0.
        </p>

        <section className="revenue-report-filters" aria-label="Revenue filters">
          <div className="revenue-report-filter-row">
            <span className="revenue-report-currency">Currency: IDR (Rupiah)</span>
            <label>
              Date By:
              <select value={dateBy} onChange={(event) => setDateBy(event.target.value as DateBy)}>
                <option value="paymentDate">Payment Date</option>
                <option value="bookingDate">Booking Date</option>
                <option value="checkIn">Check-in Date</option>
              </select>
            </label>
            <div className="revenue-report-date-range">
              <input aria-label="From date" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
              <span>–</span>
              <input aria-label="To date" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </div>
          </div>
          <div className="revenue-report-filter-row">
            <select aria-label="Source" value={source} onChange={(event) => setSource(event.target.value)}>
              <option value="">All Sources</option>
              {revenueSources.map((value) => <option key={value}>{value}</option>)}
            </select>
            <select aria-label="Payment status" value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}>
              <option value="">All Payment Status</option>
              {["Unpaid", "Partial", "Paid", "Failed", "Expired", "Refunded"].map((value) => <option key={value}>{value}</option>)}
            </select>
            <select aria-label="Reservation status" value={reservationStatus} onChange={(event) => setReservationStatus(event.target.value)}>
              <option value="">All Resv Status</option>
              {["Pending", "Confirmed", "Checked-in", "Checked-out", "Cancelled", "Expired"].map((value) => <option key={value}>{value}</option>)}
            </select>
            <select aria-label="Payment method" value={method} onChange={(event) => setMethod(event.target.value)}>
              <option value="">All Methods</option>
              {revenueMethods.map((value) => <option key={value}>{value}</option>)}
            </select>
            <select aria-label="Room type" value={room} onChange={(event) => setRoom(event.target.value)}>
              <option value="">All Room Types</option>
              {["Deluxe", "Family", "Suite"].map((value) => <option key={value}>{value}</option>)}
            </select>
            <button type="button" onClick={reset}>Reset</button>
            <button className="revenue-report-export" type="button" onClick={() => exportCsv(filtered)}>↓ Export CSV</button>
          </div>
        </section>

        <section className="revenue-report-panel">
          <header><h2>Revenue by Source</h2><span>{sourceRows.filter((row) => row.reservations > 0).length} Active Channels</span></header>
          <div className="revenue-report-table-scroll">
            <table className="revenue-report-table">
              <thead><tr><th>Source</th><th>Reservations</th><th>Booking Value</th><th>Paid</th><th>Refunded</th><th>Outstanding</th><th>Net Collected</th></tr></thead>
              <tbody>
                {sourceRows.map((row) => (
                  <tr key={row.name}>
                    <td><strong>{row.name}</strong></td><td>{row.reservations}</td><td>{money(row.gross)}</td>
                    <td>{money(row.paid)}</td><td>{money(row.refunded)}</td>
                    <td className={row.outstanding ? "revenue-report-outstanding" : ""}>{money(row.outstanding)}</td>
                    <td>{money(row.paid - row.refunded)}</td>
                  </tr>
                ))}
                <tr className="revenue-report-total"><td>Total</td><td>{totals.reservations}</td><td>{money(totals.gross)}</td><td>{money(totals.paid)}</td><td>{money(totals.refunded)}</td><td>{money(totals.outstanding)}</td><td>{money(totals.paid - totals.refunded)}</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="revenue-report-panel">
          <header><h2>Revenue by Payment Method</h2><span>{methodRows.filter((row) => row.transactions > 0).length} Payment Types</span></header>
          <div className="revenue-report-table-scroll">
            <table className="revenue-report-table revenue-report-table--method">
              <thead><tr><th>Payment Method</th><th>Transactions</th><th>Paid</th><th>Refunded</th><th>Net Collected</th></tr></thead>
              <tbody>
                {methodRows.map((row) => (
                  <tr key={row.name}><td><strong>{row.name}</strong></td><td>{row.transactions}</td><td>{money(row.paid)}</td><td>{money(row.refunded)}</td><td>{money(row.paid - row.refunded)}</td></tr>
                ))}
                <tr className="revenue-report-total"><td>Total</td><td>{totals.transactions}</td><td>{money(totals.paid)}</td><td>{money(totals.refunded)}</td><td>{money(totals.paid - totals.refunded)}</td></tr>
              </tbody>
            </table>
          </div>
        </section>
        <p className="revenue-report-note">Payment Date pada demo memakai tanggal booking untuk transaksi tercatat. Semua angka mengikuti filter aktif.</p>
      </div>
    </AdminShell>
  );
}
