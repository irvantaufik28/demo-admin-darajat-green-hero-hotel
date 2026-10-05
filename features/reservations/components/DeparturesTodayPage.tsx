"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "../../../components/layout/AdminShell";
import { formatStayDate } from "../constants/walk-in-data";
import { restoreSession } from "../../../lib/auth";
import { getDeparturesToday, type DepartureTodayItem } from "../services/api";
import { useOperationalRefresh } from "../hooks/useOperationalRefresh";

const pageSize = 20;

function label(value: string) {
  return value.split("_").map(part => part[0].toUpperCase() + part.slice(1)).join("-");
}

function depositLabel(item: DepartureTodayItem) {
  if (item.deposit.heldBalance > 0) {
    return `Rp${new Intl.NumberFormat("id-ID").format(item.deposit.heldBalance)}`;
  }
  return item.deposit.label;
}

function paymentTone(status: string) {
  if (status === "Paid") return "success";
  if (status === "Unpaid") return "danger";
  return "warning";
}

export function DeparturesTodayPage() {
  const [departures, setDepartures] = useState<DepartureTodayItem[]>([]);
  const [summary, setSummary] = useState({ total: 0, dueOut: 0, overdue: 0, checkedOut: 0 });
  const operationalRefresh = useOperationalRefresh();
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [payment, setPayment] = useState("all");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        if (!(await restoreSession())) return;
        const query = new URLSearchParams({ page: String(page), limit: String(pageSize) });
        if (search.trim()) query.set("search", search.trim());
        if (status !== "all") query.set("operationalStatus", status);
        if (payment !== "all") query.set("paymentStatus", payment);
        const response = await getDeparturesToday(query, controller.signal);
        if (!controller.signal.aborted) {
          setDepartures(response.items);
          setSummary(response.summary);
          setTotal(response.total);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Data keberangkatan gagal dimuat.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, search ? 300 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [page, search, status, payment, operationalRefresh]);

  return (
    <AdminShell title="Reservations" context="Departures Today">
      <div className="departures-page">
        <div className="departures-heading">
          <div>
            <div className="departures-heading-title">
              <h1>Departures Today</h1>
              <span className="departures-count">
                {summary.total} departures today · {summary.dueOut} Due Out · {summary.overdue} Overdue
              </span>
            </div>
            <p>Tamu yang dijadwalkan atau sudah check-out hari ini.</p>
          </div>
          <Link
            href="/reservations/create-reservation-walkin"
            className="action-button"
          >
            ＋ New Reservation
          </Link>
        </div>
        <div className="departures-filters">
          <div className="departures-filter-controls">
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Search guest or booking ID"
              aria-label="Search guest or booking ID"
            />
            <select
              value={status}
              onChange={(event) => { setStatus(event.target.value); setPage(1); }}
              aria-label="Filter departure status"
            >
              <option value="all">Status: All</option>
              <option value="due_out">Due Out</option>
              <option value="overdue">Overdue</option>
              <option value="checked_out">Checked Out</option>
            </select>
            <select
              value={payment}
              onChange={(event) => { setPayment(event.target.value); setPage(1); }}
              aria-label="Filter payment status"
            >
              <option value="all">Payment: All Payments</option>
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatus("all");
                setPayment("all");
                setPage(1);
              }}
            >
              Reset
            </button>
          </div>
          <span>
            Showing {departures.length} of {total} entries
          </span>
        </div>
        <section className="departures-table-shell">
          <div className="departures-table-scroll">
            <table className="departures-table">
              <thead>
                <tr>
                  <th>NO</th>
                  <th>GUEST</th>
                  <th>BOOKING</th>
                  <th>CHECK-OUT</th>
                  <th>ROOM</th>
                  <th>PAYMENT</th>
                  <th>RESERVATION STATUS</th>
                  <th>OPERATIONAL STATUS</th>
                  <th>DEPOSIT</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {departures.map((item, index) => (
                  <tr
                    key={item.id}
                    className={
                      item.reservationStatus === "checked_out"
                        ? "departures-row--complete"
                        : undefined
                    }
                  >
                    <td className="reservations-no">{(page - 1) * pageSize + index + 1}</td>
                    <td>
                      <div className="reservations-guest">
                        <strong>{item.guest.fullName}</strong>
                        <small>{item.guest.phone}</small>
                      </div>
                    </td>
                    <td className="departures-booking">{item.bookingCode}</td>
                    <td>{formatStayDate(item.checkOutDate)}</td>
                    <td className="departures-room">
                      {item.roomSummary || "—"}
                      {item.rooms.some(room => room.roomNumber)
                        ? " · " + item.rooms.map(room => room.roomNumber).filter(Boolean).join(", ")
                        : ""}
                    </td>
                    <td>
                      <span
                        className={
                          "reservations-badge reservations-badge--" +
                          paymentTone(label(item.paymentStatus))
                        }
                      >
                        {label(item.paymentStatus)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={
                          "reservations-badge reservations-badge--" +
                          (item.reservationStatus === "checked_in" ? "info" : "neutral")
                        }
                      >
                        {label(item.reservationStatus)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={
                          "reservations-badge reservations-badge--" +
                          (item.operationalStatus.code === "overdue"
                            ? "danger"
                            : item.operationalStatus.code === "due_out"
                              ? "warning"
                              : "neutral")
                        }
                      >
                        {item.operationalStatus.label}
                      </span>
                    </td>
                    <td>
                      {item.deposit.label === "No Deposit" ? (
                        <span className="departures-muted">No Deposit</span>
                      ) : (
                        <span
                          className={
                            "reservations-badge reservations-badge--" +
                            (item.deposit.heldBalance > 0
                              ? "warning"
                              : "success")
                          }
                        >
                          {depositLabel(item)}
                        </span>
                      )}
                    </td>
                    <td>
                      <Link
                        href={
                          "/reservations/" + encodeURIComponent(item.id)
                        }
                        className="departures-view-link"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
                {(loading || error || departures.length === 0) && (
                  <tr>
                    <td colSpan={10} className="departures-empty">
                      {loading ? "Memuat keberangkatan..." : error || "Tidak ada tamu yang cocok dengan filter."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="departures-table-footer">
            <span className="departures-audit-dot" />
            {total} departures today
            {total > pageSize && (
              <div>
                <button type="button" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Previous</button>
                <span> Page {page} of {Math.ceil(total / pageSize)} </span>
                <button type="button" disabled={page * pageSize >= total} onClick={() => setPage(value => value + 1)}>Next</button>
              </div>
            )}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
