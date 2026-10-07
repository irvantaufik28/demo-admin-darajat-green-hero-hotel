"use client";
import "../../reservations/styles/reservations.css";
import "../styles/payments.css";

import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "../../../components/layout/AdminShell";
import { restoreSession } from "../../../lib/auth";
import {
  getOutstandingBalances,
  getRefunds,
  type OutstandingListItem,
  type RefundListItem,
} from "../services/payments";

type Mode = "refunds" | "outstanding";
const pageSize = 20;
const money = (amount: number) => `Rp${amount.toLocaleString("id-ID")}`;
const label = (value: string) =>
  value === "walk_in"
    ? "Walk-in"
    : value.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
const dateLabel = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta",
      }).format(new Date(value))
    : "—";

function Badge({ value }: { value: string }) {
  const tone = ["succeeded", "completed", "paid", "no_refund"].includes(value)
    ? "success"
    : ["processing", "partially_refunded", "action_required", "partial", "pending", "review_required"].includes(value)
      ? "warning"
      : ["failed", "expired"].includes(value) ? "danger" : "neutral";
  return <span className={`reservations-source payments-badge--${tone}`}>{label(value)}</span>;
}

const headings: Record<Mode, string[]> = {
  refunds: ["Booking", "Guest", "Source", "Policy", "Paid", "Estimated Refund", "Refunded", "Status", "Action"],
  outstanding: ["Booking", "Guest", "Source", "Check-out", "Booking Total", "Paid", "Outstanding", "Payment Status", "Action"],
};

function RefundRow({ row }: { row: RefundListItem }) {
  return (
    <tr>
      <td><strong className="payments-booking">{row.bookingCode}</strong><small>{dateLabel(row.cancelledAt)}</small></td>
      <td><strong>{row.guest.fullName}</strong><small>{row.guest.phone}</small></td>
      <td>{label(row.source)}</td>
      <td>{row.policy.name ?? "Manual review"}</td>
      <td>{money(row.grossPaidAmount)}</td>
      <td>{row.estimatedRefundAmount === null ? "Review" : money(row.estimatedRefundAmount)}</td>
      <td>{money(row.refundedAmount)}</td>
      <td><Badge value={row.status} /></td>
      <td><Link href={`/payments/${row.reservationId}`}>View</Link></td>
    </tr>
  );
}

function OutstandingRow({ row }: { row: OutstandingListItem }) {
  return (
    <tr>
      <td><strong className="payments-booking">{row.bookingCode}</strong><small>{dateLabel(row.checkedOutAt)}</small></td>
      <td><strong>{row.guest.fullName}</strong><small>{row.guest.phone}</small></td>
      <td>{label(row.source)}</td>
      <td>{dateLabel(row.checkOutDate)}</td>
      <td>{money(row.bookingTotal)}</td>
      <td>{money(row.grossPaid)}</td>
      <td className="payments-remaining">{money(row.remainingBalance)}</td>
      <td><Badge value={row.paymentStatus} /></td>
      <td><Link href={`/payments/${row.id}`}>View</Link></td>
    </tr>
  );
}

export function PaymentQueuesPage({ mode }: { mode: Mode }) {
  const [rows, setRows] = useState<(RefundListItem | OutstandingListItem)[]>([]);
  const [total, setTotal] = useState(0);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        if (!(await restoreSession())) return;
        const query = new URLSearchParams({ page: String(page), limit: String(pageSize) });
        if (search.trim()) query.set("search", search.trim());
        if (source) query.set("source", source);
        const result = mode === "refunds"
          ? await getRefunds(query, controller.signal)
          : await getOutstandingBalances(query, controller.signal);
        if (!controller.signal.aborted) {
          setRows(result.items);
          setTotal(result.total);
          setTotalOutstanding("summary" in result ? result.summary.totalOutstanding : 0);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Data pembayaran gagal dimuat.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, search ? 300 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [mode, page, search, source]);

  const title = mode === "refunds" ? "Refunds" : "Outstanding Balance";
  const description = mode === "refunds"
    ? "Reservasi yang dibatalkan dengan pembayaran dan penyelesaian refund."
    : "Sisa tagihan reservasi yang sudah check-out.";

  return (
    <AdminShell title="Payments" context={title}>
      <div className="payments-page">
        <div className="payments-heading">
          <div><h1>{title}</h1><p>{description}</p></div>
          {mode === "outstanding" && <strong className="payments-summary-total">Total outstanding: {money(totalOutstanding)}</strong>}
        </div>
        <div className="payments-filters">
          <input
            aria-label="Search payments"
            placeholder="Search booking, guest, or WhatsApp"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
          />
          <select aria-label="Source" value={source} onChange={(event) => { setSource(event.target.value); setPage(1); }}>
            <option value="">Source: All</option>
            {["website", "walk_in", "phone", "ota"].map((value) => <option key={value} value={value}>{label(value)}</option>)}
          </select>
          <button type="button" onClick={() => { setSearch(""); setSource(""); setPage(1); }}>Reset</button>
        </div>
        <div className="payments-table-shell">
          <div className="payments-table-scroll">
            <table className="payments-table">
              <thead><tr>{headings[mode].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
              <tbody>{!loading && rows.map((row) => mode === "refunds"
                ? <RefundRow key={(row as RefundListItem).reservationId} row={row as RefundListItem} />
                : <OutstandingRow key={(row as OutstandingListItem).id} row={row as OutstandingListItem} />
              )}</tbody>
            </table>
            {(loading || error || rows.length === 0) && <div className="payments-empty">{loading ? <LoadingSkeleton /> : error || "Tidak ada data yang sesuai filter."}</div>}
          </div>
          <div className="payments-footer">
            Menampilkan <strong>{rows.length}</strong> dari <strong>{total}</strong> data
            {total > pageSize && <span> · <button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</button> Page {page} of {Math.ceil(total / pageSize)} <button type="button" disabled={page * pageSize >= total} onClick={() => setPage((value) => value + 1)}>Next</button></span>}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
