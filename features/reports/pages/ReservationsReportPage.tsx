"use client";
import "../../reservations/styles/reservations.css";
import "../styles/reports.css";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AdminShell } from "../../../components/layout/AdminShell";
import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { restoreSession } from "../../../lib/auth";
import { DateRangePicker } from "../../campaigns/components/DateRangePicker";
import {
  getReportFilterOptions,
  getReservationsReport,
  type FilterOption,
  type ReservationReportDateBy,
  type ReservationReportFinancial,
  type ReservationReportItem,
  type ReservationReportSource,
  type ReservationReportStatus,
  type ReservationReportSummary,
} from "../services/reservations-report";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

const pageSize = 10;
const money = (value: number) => `Rp${value.toLocaleString("id-ID")}`;
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));

const emptySummary: ReservationReportSummary = {
  totalReservations: 0,
  pending: 0,
  confirmed: 0,
  checkedIn: 0,
  checkedOut: 0,
  noShow: 0,
  cancelled: 0,
  expired: 0,
  roomNights: 0,
};
const emptyFinancial: ReservationReportFinancial = {
  bookingValue: 0,
  paid: 0,
  outstanding: 0,
};

const statusFilterOptions: { label: string; value: ReservationReportStatus }[] =
  [
    { label: "Pending", value: "pending" },
    { label: "Confirmed", value: "confirmed" },
    { label: "Checked-in", value: "checked_in" },
    { label: "Checked-out", value: "checked_out" },
    { label: "No-show", value: "no_show" },
    { label: "Cancelled", value: "cancelled" },
    { label: "Expired", value: "expired" },
  ];
const sourceFilterOptions: { label: string; value: ReservationReportSource }[] =
  [
    { label: "Website", value: "website" },
    { label: "Phone", value: "phone" },
    { label: "Walk-in", value: "walk_in" },
    { label: "OTA", value: "ota" },
  ];

function statusLabel(value: ReservationReportStatus) {
  return value
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("-");
}

function sourceLabel(
  item: ReservationReportItem,
  t: ReturnType<typeof useTranslations>["t"],
) {
  if (item.source === "ota")
    return item.otaChannel
      ? `${t("source.ota")} · ${item.otaChannel.name}`
      : t("source.ota");
  return t(`source.${item.source}`);
}

function roomLabel(item: ReservationReportItem) {
  return item.roomTypes.join(" / ") || "—";
}

function badgeTone(status: ReservationReportStatus) {
  if (status === "confirmed" || status === "checked_in") return "success";
  if (status === "no_show" || status === "cancelled" || status === "expired")
    return "danger";
  if (status === "pending") return "warning";
  return "neutral";
}

function buildQuery(filters: {
  search: string;
  dateBy: ReservationReportDateBy;
  from: string;
  to: string;
  status: string;
  source: string;
  room: string;
  ota: string;
}) {
  const query = new URLSearchParams();
  if (filters.search.trim()) query.set("search", filters.search.trim());
  query.set("dateBy", filters.dateBy);
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  if (filters.status) query.set("reservationStatus", filters.status);
  if (filters.source) query.set("source", filters.source);
  if (filters.room) query.set("roomType", filters.room);
  if (filters.ota) query.set("otaChannelId", filters.ota);
  return query;
}

function csvCell(value: string | number) {
  const text = String(value ?? "");
  const safe = /^[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function ReservationsReportPage() {
  const { t } = useTranslations({ en, id });
  const [search, setSearch] = useState("");
  const [dateBy, setDateBy] = useState<ReservationReportDateBy>("booking");
  const [from, setFrom] = useState("2026-09-01");
  const [to, setTo] = useState("2026-10-31");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [room, setRoom] = useState("");
  const [ota, setOta] = useState("");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<ReservationReportItem[]>([]);
  const [summary, setSummary] =
    useState<ReservationReportSummary>(emptySummary);
  const [financial, setFinancial] =
    useState<ReservationReportFinancial>(emptyFinancial);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const [roomOptions, setRoomOptions] = useState<FilterOption[]>([]);
  const [otaOptions, setOtaOptions] = useState<FilterOption[]>([]);
  const exportRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        if (!(await restoreSession())) return;
        const options = await getReportFilterOptions(controller.signal);
        if (!controller.signal.aborted) {
          setRoomOptions(options.roomTypes);
          setOtaOptions(options.otaChannels);
        }
      } catch {
        // Filters degrade gracefully to the free-text/date filters if options fail.
      }
    })();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(
      async () => {
        setLoading(true);
        setError("");
        try {
          if (!(await restoreSession())) return;
          const query = buildQuery({
            search,
            dateBy,
            from,
            to,
            status,
            source,
            room,
            ota,
          });
          query.set("page", String(page));
          query.set("limit", String(pageSize));
          const result = await getReservationsReport(query, controller.signal);
          if (!controller.signal.aborted) {
            setItems(result.items);
            setSummary(result.summary);
            setFinancial(result.financial);
            setTotal(result.total);
          }
        } catch (cause) {
          if (!controller.signal.aborted) {
            setError(
              cause instanceof Error ? cause.message : t("common.loadFailed"),
            );
            setItems([]);
            setTotal(0);
            setSummary(emptySummary);
            setFinancial(emptyFinancial);
          }
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      },
      search ? 300 : 0,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search, dateBy, from, to, status, source, room, ota, page]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);

  function reset() {
    setSearch("");
    setDateBy("booking");
    setFrom("2026-09-01");
    setTo("2026-10-31");
    setStatus("");
    setSource("");
    setRoom("");
    setOta("");
    setPage(1);
  }

  async function exportCsv() {
    if (exportRef.current) return;
    exportRef.current = true;
    setExporting(true);
    try {
      if (!(await restoreSession())) return;
      const query = buildQuery({
        search,
        dateBy,
        from,
        to,
        status,
        source,
        room,
        ota,
      });
      query.set("page", "1");
      query.set("limit", "1000");
      const result = await getReservationsReport(query);
      const header = [
        "Booking ID",
        "Booking Date",
        "Guest",
        "Source",
        "Room Type",
        "Room Qty",
        "Check-in",
        "Check-out",
        "Nights",
        "Room Nights",
        "Reservation Status",
        "Booking Total",
        "Discount",
        "Paid",
        "Outstanding",
      ];
      const body = result.items.map((item) => [
        item.bookingCode,
        item.bookingDate,
        item.guest.fullName,
        sourceLabel(item, t),
        roomLabel(item),
        item.roomQuantity,
        item.checkInDate,
        item.checkOutDate,
        item.nights,
        item.roomNights,
        statusLabel(item.reservationStatus),
        item.bookingTotal,
        item.discount,
        item.paid,
        item.outstanding,
      ]);
      const csv = [header, ...body]
        .map((cells) => cells.map(csvCell).join(","))
        .join("\r\n");
      const link = document.createElement("a");
      link.href = URL.createObjectURL(
        new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
      );
      link.download = "reservation-report.csv";
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t("common.exportFailed"),
      );
    } finally {
      exportRef.current = false;
      setExporting(false);
    }
  }

  const summaryMetrics: [string, number][] = [
    [t("reservations.summary.totalResv"), summary.totalReservations],
    [t("reservations.summary.confirmed"), summary.confirmed],
    [t("reservations.summary.checkedIn"), summary.checkedIn],
    [t("reservations.summary.checkedOut"), summary.checkedOut],
    [t("reservations.summary.noShow"), summary.noShow],
    [t("reservations.summary.cancelled"), summary.cancelled],
    [t("reservations.summary.roomNights"), summary.roomNights],
  ];

  return (
    <AdminShell
      title={t("shell.title")}
      context={t("shell.reservationsContext")}
    >
      <div className="report-reservations-page">
        <div className="report-reservations-heading">
          <div>
            <h1>{t("reservations.title")}</h1>
            <p>{t("reservations.description")}</p>
          </div>
          <span>{t("reservations.reservationCount", { total })}</span>
        </div>
        <div className="report-reservations-overview">
          <section className="report-reservations-card">
            <h2>{t("reservations.summary.title")}</h2>
            <div className="report-reservations-metrics">
              {summaryMetrics.map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </section>
          <section className="report-reservations-card">
            <h2>{t("reservations.financial.title")}</h2>
            <div className="report-reservations-metrics report-reservations-metrics--finance">
              <div>
                <span>{t("reservations.financial.bookingValue")}</span>
                <strong>{money(financial.bookingValue)}</strong>
              </div>
              <div>
                <span>{t("reservations.financial.paid")}</span>
                <strong>{money(financial.paid)}</strong>
              </div>
              <div>
                <span>{t("reservations.financial.outstanding")}</span>
                <strong>{money(financial.outstanding)}</strong>
              </div>
            </div>
            <p>{t("reservations.financial.note")}</p>
          </section>
        </div>
        <div className="report-reservations-filters">
          <div className="report-reservations-filter-main">
            <input
              aria-label={t("reservations.filters.searchAriaLabel")}
              placeholder={t("reservations.filters.searchPlaceholder")}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            <label>
              {t("reservations.filters.dateBy")}
              <select
                value={dateBy}
                onChange={(event) => {
                  setDateBy(event.target.value as ReservationReportDateBy);
                  setPage(1);
                }}
              >
                <option value="booking">
                  {t("reservations.dateBy.booking")}
                </option>
                <option value="check_in">
                  {t("reservations.dateBy.checkIn")}
                </option>
                <option value="check_out">
                  {t("reservations.dateBy.checkOut")}
                </option>
              </select>
            </label>
            <DateRangePicker
              label={`${t("reservations.filters.fromDate")} – ${t("reservations.filters.toDate")}`}
              start={from}
              end={to}
              numberOfMonths={2}
              onChange={(start, end) => {
                setFrom(start);
                setTo(end);
                setPage(1);
              }}
            />
          </div>
          <div className="report-reservations-filter-extra">
            <select
              aria-label={t("reservations.filters.reservationStatusAriaLabel")}
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("reservations.filters.allStatus")}</option>
              {statusFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(`reservationStatus.${option.value}`)}
                </option>
              ))}
            </select>
            <select
              aria-label={t("reservations.filters.sourceAriaLabel")}
              value={source}
              onChange={(event) => {
                setSource(event.target.value);
                setOta("");
                setPage(1);
              }}
            >
              <option value="">{t("common.allSources")}</option>
              {sourceFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(`source.${option.value}`)}
                </option>
              ))}
            </select>
            <select
              aria-label={t("reservations.filters.roomTypeAriaLabel")}
              value={room}
              onChange={(event) => {
                setRoom(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("common.allRoomTypes")}</option>
              {roomOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
            <select
              aria-label={t("reservations.filters.otaChannelAriaLabel")}
              value={ota}
              disabled={source !== "ota"}
              onChange={(event) => {
                setOta(event.target.value);
                setPage(1);
              }}
            >
              <option value="">
                {source !== "ota"
                  ? t("reservations.filters.allOtaInactive")
                  : t("reservations.filters.allOta")}
              </option>
              {otaOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={reset}>
              {t("common.reset")}
            </button>
            <button
              type="button"
              className="report-reservations-export"
              onClick={exportCsv}
              disabled={exporting || total === 0}
            >
              ↓ {exporting ? t("common.exporting") : t("common.exportCsv")}
            </button>
          </div>
        </div>
        {error && (
          <div className="reservation-detail-missing" role="alert">
            {error}
          </div>
        )}
        <div className="report-reservations-table-shell" aria-busy={loading}>
          <div className="report-reservations-table-scroll">
            <table className="report-reservations-table">
              <thead>
                <tr>
                  {[
                    t("reservations.table.bookingId"),
                    t("reservations.table.bookingDate"),
                    t("reservations.table.guest"),
                    t("reservations.table.source"),
                    t("reservations.table.roomType"),
                    t("reservations.table.roomQty"),
                    t("reservations.table.checkIn"),
                    t("reservations.table.checkOut"),
                    t("reservations.table.nights"),
                    t("reservations.table.roomNights"),
                    t("reservations.table.reservationStatus"),
                    t("reservations.table.bookingTotal"),
                    t("reservations.table.discount"),
                    t("reservations.table.paid"),
                    t("reservations.table.outstanding"),
                  ].map((heading) => (
                    <th key={heading}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!loading &&
                  items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <Link
                          href={`/reservations/${encodeURIComponent(item.id)}`}
                        >
                          {item.bookingCode}
                        </Link>
                      </td>
                      <td>{dateLabel(item.bookingDate)}</td>
                      <td>{item.guest.fullName}</td>
                      <td>{sourceLabel(item, t)}</td>
                      <td>{roomLabel(item)}</td>
                      <td>{item.roomQuantity}</td>
                      <td>{dateLabel(item.checkInDate)}</td>
                      <td>{dateLabel(item.checkOutDate)}</td>
                      <td>{item.nights}</td>
                      <td>{item.roomNights}</td>
                      <td>
                        <span
                          className={`reservations-badge reservations-badge--${badgeTone(item.reservationStatus)}`}
                        >
                          {t(`reservationStatus.${item.reservationStatus}`)}
                        </span>
                      </td>
                      <td>{money(item.bookingTotal)}</td>
                      <td>{money(item.discount)}</td>
                      <td>{money(item.paid)}</td>
                      <td
                        className={
                          item.outstanding
                            ? "report-reservations-outstanding"
                            : ""
                        }
                      >
                        {money(item.outstanding)}
                      </td>
                    </tr>
                  ))}
                {(loading || items.length === 0) && (
                  <tr>
                    <td colSpan={15} className="report-reservations-empty">
                      {loading ? <LoadingSkeleton /> : t("reservations.empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="report-reservations-footer">
            <span>
              {t("reservations.pagination.showing", {
                start: total ? (currentPage - 1) * pageSize + 1 : 0,
                end: Math.min(currentPage * pageSize, total),
                total,
              })}
            </span>
            <div>
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setPage((value) => value - 1)}
              >
                {t("reservations.pagination.prev")}
              </button>
              <span>
                {t("reservations.pagination.pageOf", {
                  page: currentPage,
                  total: pageCount,
                })}
              </span>
              <button
                type="button"
                disabled={currentPage === pageCount}
                onClick={() => setPage((value) => value + 1)}
              >
                {t("reservations.pagination.next")}
              </button>
            </div>
          </div>
        </div>
        <p className="report-reservations-note">{t("reservations.note")}</p>
      </div>
    </AdminShell>
  );
}
