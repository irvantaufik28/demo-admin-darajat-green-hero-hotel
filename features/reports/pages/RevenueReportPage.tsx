"use client";
import "../../reservations/styles/reservations.css";
import "../styles/reports.css";

import { useEffect, useRef, useState } from "react";
import { AdminShell } from "../../../components/layout/AdminShell";
import { restoreSession } from "../../../lib/auth";
import { DateRangePicker } from "../../campaigns/components/DateRangePicker";
import {
  getRevenueFilterOptions,
  getRevenueReport,
  type FilterOption,
  type RevenueByMethod,
  type RevenueBySource,
  type RevenueReportDateBy,
  type RevenueReportItem,
  type RevenueReportSource,
  type RevenueReportStatus,
  type RevenueTotals,
} from "../services/revenue-report";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

const money = (value: number) => `Rp${value.toLocaleString("id-ID")}`;

function defaultRevenueDateRange(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)!.value;
  const year = value("year");
  const month = value("month");
  return { from: `${year}-${month}-01`, to: `${year}-${month}-${value("day")}` };
}

const emptyTotals: RevenueTotals = {
  reservations: 0,
  transactions: 0,
  gross: 0,
  discount: 0,
  net: 0,
  paid: 0,
  refunded: 0,
  outstanding: 0,
  netCollected: 0,
};

const sourceLabels: Record<RevenueReportSource, string> = {
  website: "Website",
  phone: "Phone",
  walk_in: "Walk-in",
  ota: "OTA",
};

const sourceFilterOptions: { label: string; value: RevenueReportSource }[] = [
  { label: "Website", value: "website" },
  { label: "Phone", value: "phone" },
  { label: "Walk-in", value: "walk_in" },
  { label: "OTA", value: "ota" },
];
const paymentStatusOptions = [
  { label: "Unpaid", value: "unpaid" },
  { label: "Partial", value: "partial" },
  { label: "Paid", value: "paid" },
  { label: "Failed", value: "failed" },
  { label: "Expired", value: "expired" },
  { label: "Refunded", value: "refunded" },
];
const reservationStatusOptions: {
  label: string;
  value: RevenueReportStatus;
}[] = [
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Checked-in", value: "checked_in" },
  { label: "Checked-out", value: "checked_out" },
  { label: "No-show", value: "no_show" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Expired", value: "expired" },
];

function statusLabel(value: string) {
  return value
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("-");
}

function buildQuery(filters: {
  dateBy: RevenueReportDateBy;
  from: string;
  to: string;
  source: string;
  paymentStatus: string;
  reservationStatus: string;
  method: string;
  room: string;
}) {
  const query = new URLSearchParams();
  query.set("dateBy", filters.dateBy);
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  if (filters.source) query.set("source", filters.source);
  if (filters.paymentStatus) query.set("paymentStatus", filters.paymentStatus);
  if (filters.reservationStatus)
    query.set("reservationStatus", filters.reservationStatus);
  if (filters.method) query.set("methodId", filters.method);
  if (filters.room) query.set("roomType", filters.room);
  return query;
}

function csvCell(value: string | number) {
  const text = String(value ?? "");
  const safe = /^[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

function exportCsv(items: RevenueReportItem[]) {
  const header = [
    "Booking ID",
    "Guest",
    "Source",
    "Reservation Status",
    "Payment Status",
    "Method",
    "Booking Date",
    "Payment Date",
    "Check-in Date",
    "Room Type",
    "Gross Booking Value",
    "Discount",
    "Net Booking Value",
    "Paid",
    "Refunded",
    "Outstanding",
    "Net Collected",
  ];
  const body = items.map((row) => [
    row.bookingCode,
    row.guest.fullName,
    sourceLabels[row.source],
    statusLabel(row.reservationStatus),
    statusLabel(row.paymentStatus),
    row.methodNames.join(" / "),
    row.bookingDate,
    row.paymentDate ?? "",
    row.checkInDate,
    row.roomTypes.join(" / "),
    row.gross,
    row.discount,
    row.net,
    row.paid,
    row.refunded,
    row.outstanding,
    row.netCollected,
  ]);
  const csv = [header, ...body]
    .map((cells) => cells.map(csvCell).join(","))
    .join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(
    new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
  );
  link.download = "revenue-report.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

export function RevenueReportPage() {
  const { t } = useTranslations({ en, id });
  const [dateBy, setDateBy] = useState<RevenueReportDateBy>("booking");
  const [from, setFrom] = useState(() => defaultRevenueDateRange().from);
  const [to, setTo] = useState(() => defaultRevenueDateRange().to);
  const [source, setSource] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [reservationStatus, setReservationStatus] = useState("");
  const [method, setMethod] = useState("");
  const [room, setRoom] = useState("");

  const [totals, setTotals] = useState<RevenueTotals>(emptyTotals);
  const [bySource, setBySource] = useState<RevenueBySource[]>([]);
  const [byMethod, setByMethod] = useState<RevenueByMethod[]>([]);
  const [items, setItems] = useState<RevenueReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [roomOptions, setRoomOptions] = useState<FilterOption[]>([]);
  const [methodOptions, setMethodOptions] = useState<FilterOption[]>([]);
  const exportDisabled = loading || items.length === 0;
  const didLoadOptions = useRef(false);

  useEffect(() => {
    if (didLoadOptions.current) return;
    didLoadOptions.current = true;
    const controller = new AbortController();
    void (async () => {
      try {
        if (!(await restoreSession())) return;
        const options = await getRevenueFilterOptions(controller.signal);
        if (!controller.signal.aborted) {
          setRoomOptions(options.roomTypes);
          setMethodOptions(options.paymentMethods);
        }
      } catch {
        // Filters degrade gracefully to the remaining controls if options fail to load.
      }
    })();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setError("");
      try {
        if (!(await restoreSession())) return;
        const query = buildQuery({
          dateBy,
          from,
          to,
          source,
          paymentStatus,
          reservationStatus,
          method,
          room,
        });
        const result = await getRevenueReport(query, controller.signal);
        if (!controller.signal.aborted) {
          setTotals(result.totals);
          setBySource(result.bySource);
          setByMethod(result.byMethod);
          setItems(result.items);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error ? cause.message : t("common.loadFailed"),
          );
          setTotals(emptyTotals);
          setBySource([]);
          setByMethod([]);
          setItems([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [
    dateBy,
    from,
    to,
    source,
    paymentStatus,
    reservationStatus,
    method,
    room,
  ]);

  function reset() {
    const range = defaultRevenueDateRange();
    setDateBy("booking");
    setFrom(range.from);
    setTo(range.to);
    setSource("");
    setPaymentStatus("");
    setReservationStatus("");
    setMethod("");
    setRoom("");
  }

  const activeChannels = bySource.filter((row) => row.reservations > 0).length;
  const paymentTypes = byMethod.filter((row) => row.transactions > 0).length;

  return (
    <AdminShell title={t("shell.title")} context={t("shell.revenueContext")}>
      <div className="revenue-report-page">
        <header className="revenue-report-heading">
          <div>
            <h1>{t("revenue.title")}</h1>
            <p>{t("revenue.description")}</p>
          </div>
          <span>
            {t("revenue.reservationCount", { total: totals.reservations })}
          </span>
        </header>

        <section
          className="revenue-report-kpis"
          aria-label={t("revenue.kpis.ariaLabel")}
        >
          {(
            [
              [t("revenue.kpis.grossBookingValue"), totals.gross, "gross"],
              [t("revenue.kpis.discount"), totals.discount, "discount"],
              [t("revenue.kpis.netBookingValue"), totals.net, "net"],
              [
                t("revenue.kpis.netCollected"),
                totals.netCollected,
                "collected",
              ],
              [t("revenue.kpis.paid"), totals.paid, "paid"],
              [t("revenue.kpis.refunded"), totals.refunded, "refunded"],
              [
                t("revenue.kpis.outstanding"),
                totals.outstanding,
                "outstanding",
              ],
            ] as [string, number, string][]
          ).map(([label, value, tone]) => (
            <div
              className={`revenue-report-kpi revenue-report-kpi--${tone}`}
              key={tone}
            >
              <span>{label}</span>
              <strong>{money(value)}</strong>
            </div>
          ))}
        </section>
        <p className="revenue-report-disclaimer">{t("revenue.disclaimer")}</p>

        <section
          className="revenue-report-filters"
          aria-label={t("revenue.filters.ariaLabel")}
        >
          <div className="revenue-report-filter-row">
            <span className="revenue-report-currency">
              {t("revenue.filters.currency")}
            </span>
            <label>
              {t("revenue.filters.dateBy")}
              <select
                value={dateBy}
                onChange={(event) =>
                  setDateBy(event.target.value as RevenueReportDateBy)
                }
              >
                <option value="payment">{t("revenue.dateBy.payment")}</option>
                <option value="booking">{t("revenue.dateBy.booking")}</option>
                <option value="check_in">{t("revenue.dateBy.checkIn")}</option>
              </select>
            </label>
            <DateRangePicker
              label={`${t("revenue.filters.fromDate")} – ${t("revenue.filters.toDate")}`}
              start={from}
              end={to}
              numberOfMonths={2}
              onChange={(start, end) => {
                setFrom(start);
                setTo(end);
              }}
            />
          </div>
          <div className="revenue-report-filter-row">
            <select
              aria-label={t("revenue.filters.sourceAriaLabel")}
              value={source}
              onChange={(event) => setSource(event.target.value)}
            >
              <option value="">{t("common.allSources")}</option>
              {sourceFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(`source.${option.value}`)}
                </option>
              ))}
            </select>
            <select
              aria-label={t("revenue.filters.paymentStatusAriaLabel")}
              value={paymentStatus}
              onChange={(event) => setPaymentStatus(event.target.value)}
            >
              <option value="">{t("revenue.filters.allPaymentStatus")}</option>
              {paymentStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(`paymentStatus.${option.value}`)}
                </option>
              ))}
            </select>
            <select
              aria-label={t("revenue.filters.reservationStatusAriaLabel")}
              value={reservationStatus}
              onChange={(event) => setReservationStatus(event.target.value)}
            >
              <option value="">{t("revenue.filters.allResvStatus")}</option>
              {reservationStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(`reservationStatus.${option.value}`)}
                </option>
              ))}
            </select>
            <select
              aria-label={t("revenue.filters.paymentMethodAriaLabel")}
              value={method}
              onChange={(event) => setMethod(event.target.value)}
            >
              <option value="">{t("revenue.filters.allMethods")}</option>
              {methodOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
            <select
              aria-label={t("revenue.filters.roomTypeAriaLabel")}
              value={room}
              onChange={(event) => setRoom(event.target.value)}
            >
              <option value="">{t("common.allRoomTypes")}</option>
              {roomOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={reset}>
              {t("common.reset")}
            </button>
            <button
              className="revenue-report-export"
              type="button"
              onClick={() => exportCsv(items)}
              disabled={exportDisabled}
            >
              ↓ {t("common.exportCsv")}
            </button>
          </div>
        </section>

        {error && (
          <div className="reservation-detail-missing" role="alert">
            {error}
          </div>
        )}

        <section className="revenue-report-panel" aria-busy={loading}>
          <header>
            <h2>{t("revenue.bySource.title")}</h2>
            <span>
              {t("revenue.bySource.activeChannels", { count: activeChannels })}
            </span>
          </header>
          <div className="revenue-report-table-scroll">
            <table className="revenue-report-table">
              <thead>
                <tr>
                  <th>{t("revenue.bySource.table.source")}</th>
                  <th>{t("revenue.bySource.table.reservations")}</th>
                  <th>{t("revenue.bySource.table.bookingValue")}</th>
                  <th>{t("revenue.bySource.table.paid")}</th>
                  <th>{t("revenue.bySource.table.refunded")}</th>
                  <th>{t("revenue.bySource.table.outstanding")}</th>
                  <th>{t("revenue.bySource.table.netCollected")}</th>
                </tr>
              </thead>
              <tbody>
                {bySource.map((row) => (
                  <tr key={row.source}>
                    <td>
                      <strong>{t(`source.${row.source}`)}</strong>
                    </td>
                    <td>{row.reservations}</td>
                    <td>{money(row.gross)}</td>
                    <td>{money(row.paid)}</td>
                    <td>{money(row.refunded)}</td>
                    <td
                      className={
                        row.outstanding ? "revenue-report-outstanding" : ""
                      }
                    >
                      {money(row.outstanding)}
                    </td>
                    <td>{money(row.netCollected)}</td>
                  </tr>
                ))}
                <tr className="revenue-report-total">
                  <td>{t("revenue.bySource.total")}</td>
                  <td>{totals.reservations}</td>
                  <td>{money(totals.gross)}</td>
                  <td>{money(totals.paid)}</td>
                  <td>{money(totals.refunded)}</td>
                  <td>{money(totals.outstanding)}</td>
                  <td>{money(totals.netCollected)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="revenue-report-panel" aria-busy={loading}>
          <header>
            <h2>{t("revenue.byMethod.title")}</h2>
            <span>
              {t("revenue.byMethod.paymentTypes", { count: paymentTypes })}
            </span>
          </header>
          <div className="revenue-report-table-scroll">
            <table className="revenue-report-table revenue-report-table--method">
              <thead>
                <tr>
                  <th>{t("revenue.byMethod.table.paymentMethod")}</th>
                  <th>{t("revenue.byMethod.table.transactions")}</th>
                  <th>{t("revenue.byMethod.table.paid")}</th>
                  <th>{t("revenue.byMethod.table.refunded")}</th>
                  <th>{t("revenue.byMethod.table.netCollected")}</th>
                </tr>
              </thead>
              <tbody>
                {byMethod.length === 0 && (
                  <tr>
                    <td colSpan={5} className="revenue-report-empty">
                      {loading
                        ? t("common.loading")
                        : t("revenue.byMethod.empty")}
                    </td>
                  </tr>
                )}
                {byMethod.map((row) => (
                  <tr key={row.methodId}>
                    <td>
                      <strong>{row.methodName}</strong>
                    </td>
                    <td>{row.transactions}</td>
                    <td>{money(row.paid)}</td>
                    <td>{money(row.refunded)}</td>
                    <td>{money(row.netCollected)}</td>
                  </tr>
                ))}
                <tr className="revenue-report-total">
                  <td>{t("revenue.byMethod.total")}</td>
                  <td>{totals.transactions}</td>
                  <td>{money(totals.paid)}</td>
                  <td>{money(totals.refunded)}</td>
                  <td>{money(totals.netCollected)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <p className="revenue-report-note">{t("revenue.note")}</p>
      </div>
    </AdminShell>
  );
}
