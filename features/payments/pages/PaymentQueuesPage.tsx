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
import { useTranslations, type Translate } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

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

const headings: Record<Mode, (t: Translate) => string[]> = {
  refunds: (t) => [
    t("queues.table.booking"), t("queues.table.guest"), t("queues.table.source"),
    t("queues.table.policy"), t("queues.table.paid"), t("queues.table.estimatedRefund"),
    t("queues.table.refunded"), t("queues.table.status"), t("queues.table.action"),
  ],
  outstanding: (t) => [
    t("queues.table.booking"), t("queues.table.guest"), t("queues.table.source"),
    t("queues.table.checkOut"), t("queues.table.bookingTotal"), t("queues.table.paid"),
    t("queues.table.outstanding"), t("queues.table.paymentStatus"), t("queues.table.action"),
  ],
};

function RefundRow({ row, t }: { row: RefundListItem; t: Translate }) {
  return (
    <tr>
      <td><strong className="payments-booking">{row.bookingCode}</strong><small>{dateLabel(row.cancelledAt)}</small></td>
      <td><strong>{row.guest.fullName}</strong><small>{row.guest.phone}</small></td>
      <td>{label(row.source)}</td>
      <td>{row.policy.name ?? t("queues.table.manualReview")}</td>
      <td>{money(row.grossPaidAmount)}</td>
      <td>{row.estimatedRefundAmount === null ? t("queues.table.review") : money(row.estimatedRefundAmount)}</td>
      <td>{money(row.refundedAmount)}</td>
      <td><Badge value={row.status} /></td>
      <td><Link href={`/payments/${row.reservationId}`}>{t("queues.table.view")}</Link></td>
    </tr>
  );
}

function OutstandingRow({ row, t }: { row: OutstandingListItem; t: Translate }) {
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
      <td><Link href={`/payments/${row.id}`}>{t("queues.table.view")}</Link></td>
    </tr>
  );
}

export function PaymentQueuesPage({ mode }: { mode: Mode }) {
  const { t } = useTranslations({ en, id });
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
          setError(cause instanceof Error ? cause.message : t("queues.messages.loadError"));
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

  const title = mode === "refunds" ? t("queues.refunds.title") : t("queues.outstanding.title");
  const description = mode === "refunds"
    ? t("queues.refunds.description")
    : t("queues.outstanding.description");

  return (
    <AdminShell title={t("shell.title")} context={title}>
      <div className="payments-page">
        <div className="payments-heading">
          <div><h1>{title}</h1><p>{description}</p></div>
          {mode === "outstanding" && <strong className="payments-summary-total">{t("queues.outstanding.totalOutstanding", { amount: money(totalOutstanding) })}</strong>}
        </div>
        <div className="payments-filters">
          <input
            aria-label={t("queues.filters.searchAriaLabel")}
            placeholder={t("queues.filters.searchPlaceholder")}
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
          />
          <select aria-label={t("queues.filters.sourceAriaLabel")} value={source} onChange={(event) => { setSource(event.target.value); setPage(1); }}>
            <option value="">{t("queues.filters.sourceAll")}</option>
            {["website", "walk_in", "phone", "ota"].map((value) => <option key={value} value={value}>{label(value)}</option>)}
          </select>
          <button type="button" onClick={() => { setSearch(""); setSource(""); setPage(1); }}>{t("queues.filters.reset")}</button>
        </div>
        <div className="payments-table-shell">
          <div className="payments-table-scroll">
            <table className="payments-table">
              <thead><tr>{headings[mode](t).map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
              <tbody>{!loading && rows.map((row) => mode === "refunds"
                ? <RefundRow key={(row as RefundListItem).reservationId} row={row as RefundListItem} t={t} />
                : <OutstandingRow key={(row as OutstandingListItem).id} row={row as OutstandingListItem} t={t} />
              )}</tbody>
            </table>
            {(loading || error || rows.length === 0) && <div className="payments-empty">{loading ? <LoadingSkeleton /> : error || t("queues.messages.empty")}</div>}
          </div>
          <div className="payments-footer">
            {t("queues.pagination.showing", { count: rows.length, total })}
            {total > pageSize && <span> · <button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>{t("queues.pagination.previous")}</button> {t("queues.pagination.pageInfo", { page, total: Math.ceil(total / pageSize) })} <button type="button" disabled={page * pageSize >= total} onClick={() => setPage((value) => value + 1)}>{t("queues.pagination.next")}</button></span>}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
