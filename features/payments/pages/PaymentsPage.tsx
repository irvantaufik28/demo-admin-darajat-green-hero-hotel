"use client";
import "../../reservations/styles/reservations.css";
import "../styles/payments.css";

import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "../../../components/layout/AdminShell";
import { restoreSession } from "../../../lib/auth";
import { getPayments, type PaymentListItem } from "../services/payments";
import { useTranslations, type Translate } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

const pageSize = 20;
const money = (value: number) => `Rp${value.toLocaleString("id-ID")}`;
const dateLabel = (value: string) => new Intl.DateTimeFormat("id-ID", {
  day: "numeric", month: "short", timeZone: "UTC",
}).format(new Date(`${value}T00:00:00Z`));

function label(value: string) {
  if (value === "walk_in") return "Walk-in";
  if (value === "ota") return "OTA";
  return value.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join("-");
}

function badgeTone(value: string) {
  if (["Paid", "Confirmed", "Checked-in"].includes(value)) return "success";
  if (["Partial", "Pending", "Unpaid"].includes(value)) return "warning";
  if (["Checked-out", "Refunded", "Expired"].includes(value)) return "neutral";
  return "danger";
}

function csvCell(value: string | number) {
  const text = String(value);
  const safe = /^[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

function exportCsv(rows: PaymentListItem[], t: Translate) {
  const columns = [
    t("csv.columns.booking"), t("csv.columns.guest"), t("csv.columns.source"),
    t("csv.columns.reservationStatus"), t("csv.columns.bookingTotal"),
    t("csv.columns.paid"), t("csv.columns.refunded"), t("csv.columns.remaining"),
    t("csv.columns.paymentStatus"), t("csv.columns.method"),
  ];
  const data = rows.map((row) => [
    row.bookingCode, row.guest.fullName, label(row.source), label(row.reservationStatus),
    row.bookingTotal, row.paidAmount, row.refundedAmount, row.remainingBalance,
    label(row.paymentStatus), row.method?.name ?? "—",
  ]);
  const csv = [columns, ...data].map((cells) => cells.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = t("csv.fileName");
  link.click();
  URL.revokeObjectURL(url);
}

export function PaymentsPage() {
  const { t } = useTranslations({ en, id });
  const [rows, setRows] = useState<PaymentListItem[]>([]);
  const [methods, setMethods] = useState<{ id: string; name: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [reservationStatus, setReservationStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [source, setSource] = useState("");
  const [methodId, setMethodId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const makeQuery = useCallback((nextPage: number, limit: number) => {
    const query = new URLSearchParams({ page: String(nextPage), limit: String(limit) });
    if (search.trim()) query.set("search", search.trim());
    if (reservationStatus) query.set("reservationStatus", reservationStatus);
    if (paymentStatus) query.set("paymentStatus", paymentStatus);
    if (source) query.set("source", source);
    if (methodId) query.set("methodId", methodId);
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    return query;
  }, [search, reservationStatus, paymentStatus, source, methodId, from, to]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        if (!(await restoreSession())) return;
        const result = await getPayments(makeQuery(page, pageSize), controller.signal);
        if (!controller.signal.aborted) {
          setRows(result.items);
          setMethods(result.methods);
          setTotal(result.total);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : t("list.messages.loadError"));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, search ? 300 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [page, search, makeQuery]);

  function reset() {
    setSearch(""); setReservationStatus(""); setPaymentStatus("");
    setSource(""); setMethodId(""); setFrom(""); setTo(""); setPage(1);
  }

  async function exportFilteredCsv() {
    setExporting(true);
    setError("");
    try {
      const allRows: PaymentListItem[] = [];
      let exportPage = 1;
      let count = 0;
      do {
        const result = await getPayments(makeQuery(exportPage, 100));
        allRows.push(...result.items);
        count = result.total;
        if (result.items.length === 0) break;
        exportPage += 1;
      } while (allRows.length < count);
      exportCsv(allRows, t);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("list.messages.exportError"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <AdminShell title={t("shell.title")} context={t("shell.paymentsContext")}>
      <div className="payments-page">
        <div className="payments-heading">
          <div><h1>{t("list.heading")}</h1><p>{t("list.description")}</p></div>
          <button type="button" disabled={exporting} onClick={exportFilteredCsv}>
            {exporting ? t("list.exporting") : `↓ ${t("list.exportCsv")}`}
          </button>
        </div>
        <div className="payments-filters">
          <input aria-label={t("list.filters.searchAriaLabel")} placeholder={t("list.filters.searchPlaceholder")} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
          <select aria-label={t("list.filters.reservationStatusAriaLabel")} value={reservationStatus} onChange={(event) => { setReservationStatus(event.target.value); setPage(1); }}>
            <option value="">{t("list.filters.reservationStatusAll")}</option>
            {["pending", "confirmed", "checked_in", "checked_out", "cancelled", "expired"].map((value) => <option key={value} value={value}>{label(value)}</option>)}
          </select>
          <select aria-label={t("list.filters.paymentStatusAriaLabel")} value={paymentStatus} onChange={(event) => { setPaymentStatus(event.target.value); setPage(1); }}>
            <option value="">{t("list.filters.paymentStatusAll")}</option>
            {["unpaid", "partial", "paid", "failed", "refunded", "expired"].map((value) => <option key={value} value={value}>{label(value)}</option>)}
          </select>
          <select aria-label={t("list.filters.sourceAriaLabel")} value={source} onChange={(event) => { setSource(event.target.value); setPage(1); }}>
            <option value="">{t("list.filters.sourceAll")}</option>
            {["website", "walk_in", "phone", "ota"].map((value) => <option key={value} value={value}>{label(value)}</option>)}
          </select>
          <select aria-label={t("list.filters.methodAriaLabel")} value={methodId} onChange={(event) => { setMethodId(event.target.value); setPage(1); }}>
            <option value="">{t("list.filters.methodAll")}</option>
            {methods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
          </select>
          <div className="payments-date-filter">
            <input aria-label={t("list.filters.fromDateAriaLabel")} type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
            <span>–</span>
            <input aria-label={t("list.filters.toDateAriaLabel")} type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} />
          </div>
          <button type="button" onClick={reset}>{t("list.filters.reset")}</button>
        </div>
        <div className="payments-table-shell">
          <div className="payments-table-scroll">
            <table className="payments-table">
              <thead><tr><th>{t("list.table.booking")}</th><th>{t("list.table.guest")}</th><th>{t("list.table.source")}</th><th>{t("list.table.reservationStatus")}</th><th>{t("list.table.bookingTotal")}</th><th>{t("list.table.paid")}</th><th>{t("list.table.refunded")}</th><th>{t("list.table.remaining")}</th><th>{t("list.table.paymentStatus")}</th><th>{t("list.table.method")}</th><th>{t("list.table.action")}</th></tr></thead>
              <tbody>{!loading && rows.map((row) => <tr key={row.id}>
                <td><strong className="payments-booking">{row.bookingCode}</strong><small>{dateLabel(row.checkInDate)} – {dateLabel(row.checkOutDate)}</small></td>
                <td><strong>{row.guest.fullName}</strong><small>{row.guest.phone}</small></td>
                <td>{row.source === "ota" && row.otaChannel ? `OTA · ${row.otaChannel}` : label(row.source)}</td>
                <td><span className={`reservations-source payments-reservation-status--${row.reservationStatus}`}>{label(row.reservationStatus)}</span></td>
                <td>{money(row.bookingTotal)}</td>
                <td className="payments-paid">{row.paidAmount ? money(row.paidAmount) : t("list.table.emptyCell")}</td>
                <td className={row.refundedAmount ? "payments-refunded" : ""}>{row.refundedAmount ? money(row.refundedAmount) : t("list.table.emptyCell")}</td>
                <td className={row.remainingBalance ? "payments-remaining" : ""}>{money(row.remainingBalance)}</td>
                <td><span className={`reservations-source payments-badge--${badgeTone(label(row.paymentStatus))}`}>{label(row.paymentStatus)}</span></td>
                <td>{row.method?.name ?? t("list.table.emptyCell")}</td>
                <td><Link href={`/payments/${encodeURIComponent(row.id)}`}>{t("list.table.view")}</Link></td>
              </tr>)}</tbody>
            </table>
            {(loading || error || rows.length === 0) && <div className="payments-empty">{loading ? <LoadingSkeleton /> : error || t("list.messages.empty")}</div>}
          </div>
          <div className="payments-footer">
            {t("list.pagination.showing", { count: rows.length, total })}
            {total > pageSize && <span> · <button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>{t("list.pagination.previous")}</button> {t("list.pagination.pageInfo", { page, total: Math.ceil(total / pageSize) })} <button type="button" disabled={page * pageSize >= total} onClick={() => setPage((value) => value + 1)}>{t("list.pagination.next")}</button></span>}
          </div>
        </div>
        <div className="payments-note">{t("list.note")}</div>
      </div>
    </AdminShell>
  );
}
