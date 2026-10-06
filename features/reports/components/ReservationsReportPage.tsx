"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AdminShell } from "../../../components/layout/AdminShell";
import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { restoreSession } from "../../../lib/auth";
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
  cancelled: 0,
  expired: 0,
  roomNights: 0,
};
const emptyFinancial: ReservationReportFinancial = { bookingValue: 0, paid: 0, outstanding: 0 };

const statusFilterOptions: { label: string; value: ReservationReportStatus }[] = [
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Checked-in", value: "checked_in" },
  { label: "Checked-out", value: "checked_out" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Expired", value: "expired" },
];
const sourceFilterOptions: { label: string; value: ReservationReportSource }[] = [
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

function sourceLabel(item: ReservationReportItem) {
  if (item.source === "ota") return item.otaChannel ? `OTA · ${item.otaChannel.name}` : "OTA";
  if (item.source === "walk_in") return "Walk-in";
  return item.source[0].toUpperCase() + item.source.slice(1);
}

function roomLabel(item: ReservationReportItem) {
  return item.roomTypes.join(" / ") || "—";
}

function badgeTone(status: ReservationReportStatus) {
  if (status === "confirmed" || status === "checked_in") return "success";
  if (status === "cancelled" || status === "expired") return "danger";
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
  const [summary, setSummary] = useState<ReservationReportSummary>(emptySummary);
  const [financial, setFinancial] = useState<ReservationReportFinancial>(emptyFinancial);
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
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        if (!(await restoreSession())) return;
        const query = buildQuery({ search, dateBy, from, to, status, source, room, ota });
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
          setError(cause instanceof Error ? cause.message : "Laporan gagal dimuat.");
          setItems([]);
          setTotal(0);
          setSummary(emptySummary);
          setFinancial(emptyFinancial);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, search ? 300 : 0);
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
      const query = buildQuery({ search, dateBy, from, to, status, source, room, ota });
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
        sourceLabel(item),
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
      const csv = [header, ...body].map((cells) => cells.map(csvCell).join(",")).join("\r\n");
      const link = document.createElement("a");
      link.href = URL.createObjectURL(
        new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
      );
      link.download = "reservation-report.csv";
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Export gagal.");
    } finally {
      exportRef.current = false;
      setExporting(false);
    }
  }

  const summaryMetrics: [string, number][] = [
    ["Total Resv", summary.totalReservations],
    ["Confirmed", summary.confirmed],
    ["Checked-in", summary.checkedIn],
    ["Checked-out", summary.checkedOut],
    ["Cancelled", summary.cancelled],
    ["Room Nights", summary.roomNights],
  ];

  return (
    <AdminShell title="Reports" context="Reservations">
      <div className="report-reservations-page">
        <div className="report-reservations-heading">
          <div>
            <h1>Reservations Report</h1>
            <p>
              Monitor reservation activity, stay dates, room nights, booking value, payments, and
              outstanding balances.
            </p>
          </div>
          <span>{total} reservations</span>
        </div>
        <div className="report-reservations-overview">
          <section className="report-reservations-card">
            <h2>▣ &nbsp; Reservation Summary</h2>
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
            <h2>▣ &nbsp; Financial Snapshot</h2>
            <div className="report-reservations-metrics report-reservations-metrics--finance">
              <div>
                <span>Booking Value</span>
                <strong>{money(financial.bookingValue)}</strong>
              </div>
              <div>
                <span>Paid</span>
                <strong>{money(financial.paid)}</strong>
              </div>
              <div>
                <span>Outstanding</span>
                <strong>{money(financial.outstanding)}</strong>
              </div>
            </div>
            <p>Nilai keuangan mencakup reservasi aktif dalam filter. Deposit tidak termasuk.</p>
          </section>
        </div>
        <div className="report-reservations-filters">
          <div className="report-reservations-filter-main">
            <input
              aria-label="Search reservations report"
              placeholder="Search booking ID, guest, or WhatsApp"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            <label>
              Date By
              <select
                value={dateBy}
                onChange={(event) => {
                  setDateBy(event.target.value as ReservationReportDateBy);
                  setPage(1);
                }}
              >
                <option value="booking">Booking Date</option>
                <option value="check_in">Check-in Date</option>
                <option value="check_out">Check-out Date</option>
              </select>
            </label>
            <div className="report-reservations-dates">
              <input
                aria-label="From date"
                type="date"
                value={from}
                onChange={(event) => {
                  setFrom(event.target.value);
                  setPage(1);
                }}
              />
              <span>–</span>
              <input
                aria-label="To date"
                type="date"
                value={to}
                onChange={(event) => {
                  setTo(event.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
          <div className="report-reservations-filter-extra">
            <select
              aria-label="Reservation status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All Status</option>
              {statusFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Source"
              value={source}
              onChange={(event) => {
                setSource(event.target.value);
                setOta("");
                setPage(1);
              }}
            >
              <option value="">All Sources</option>
              {sourceFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Room type"
              value={room}
              onChange={(event) => {
                setRoom(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All Room Types</option>
              {roomOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
            <select
              aria-label="OTA channel"
              value={ota}
              disabled={source !== "ota"}
              onChange={(event) => {
                setOta(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All OTA {source !== "ota" ? "(Inactive)" : ""}</option>
              {otaOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={reset}>
              Reset
            </button>
            <button
              type="button"
              className="report-reservations-export"
              onClick={exportCsv}
              disabled={exporting || total === 0}
            >
              ↓ {exporting ? "Exporting…" : "Export CSV"}
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
                        <Link href={`/reservations/${encodeURIComponent(item.id)}`}>
                          {item.bookingCode}
                        </Link>
                      </td>
                      <td>{dateLabel(item.bookingDate)}</td>
                      <td>{item.guest.fullName}</td>
                      <td>{sourceLabel(item)}</td>
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
                          {statusLabel(item.reservationStatus)}
                        </span>
                      </td>
                      <td>{money(item.bookingTotal)}</td>
                      <td>{money(item.discount)}</td>
                      <td>{money(item.paid)}</td>
                      <td className={item.outstanding ? "report-reservations-outstanding" : ""}>
                        {money(item.outstanding)}
                      </td>
                    </tr>
                  ))}
                {(loading || items.length === 0) && (
                  <tr>
                    <td colSpan={15} className="report-reservations-empty">
                      {loading ? (
                        <LoadingSkeleton />
                      ) : (
                        "Tidak ada reservasi yang sesuai filter."
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="report-reservations-footer">
            <span>
              Showing{" "}
              <strong>
                {total ? (currentPage - 1) * pageSize + 1 : 0}–
                {Math.min(currentPage * pageSize, total)}
              </strong>{" "}
              of <strong>{total}</strong> reservations
            </span>
            <div>
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Prev
              </button>
              <span>
                {currentPage} / {pageCount}
              </span>
              <button
                type="button"
                disabled={currentPage === pageCount}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
        <p className="report-reservations-note">
          All financial figures are in Indonesian Rupiah (IDR). Export CSV follows the active
          filters.
        </p>
      </div>
    </AdminShell>
  );
}
