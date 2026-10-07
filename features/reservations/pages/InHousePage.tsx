"use client";
import "../styles/reservations.css";

import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "../../../components/layout/AdminShell";
import { formatRupiah, formatStayDate } from "../constants/walk-in-data";
import { restoreSession } from "../../../lib/auth";
import { getInHouse, type InHouseItem } from "../services/api";
import { useOperationalRefresh } from "../hooks/useOperationalRefresh";

const pageSize = 20;

function label(value: string) {
  return value.split("_").map(part => part[0].toUpperCase() + part.slice(1)).join("-");
}

function paymentTone(status: string) {
  if (status === "Paid") return "success";
  if (status === "Unpaid") return "danger";
  return "warning";
}

export function InHousePage() {
  const operationalRefresh = useOperationalRefresh();
  const [guests, setGuests] = useState<InHouseItem[]>([]);
  const [summary, setSummary] = useState({ guestsInHouse: 0, roomsOccupied: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [checkOut, setCheckOut] = useState("all");
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
        if (checkOut !== "all") query.set("operationalStatus", checkOut);
        if (payment !== "all") query.set("paymentStatus", payment);
        const response = await getInHouse(query, controller.signal);
        if (!controller.signal.aborted) {
          setGuests(response.items);
          setSummary(response.summary);
          setTotal(response.total);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Data tamu menginap gagal dimuat.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, search ? 300 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [page, search, checkOut, payment, operationalRefresh]);

  return (
    <AdminShell title="Reservations" context="In House">
      <div className="in-house-page">
        <div className="in-house-heading">
          <div>
            <div className="in-house-title">
              <h1>In House</h1>
              <span>
                {summary.guestsInHouse} guests in house · {summary.roomsOccupied} rooms
                occupied
              </span>
            </div>
            <p>Tamu yang masih berstatus Checked-in.</p>
          </div>
          <Link
            href="/reservations/create-reservation-walkin"
            className="action-button"
          >
            ＋ New Reservation
          </Link>
        </div>
        <div className="in-house-filters">
          <div className="in-house-filter-controls">
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Search guest, room, or booking ID"
              aria-label="Search in-house guests"
            />
            <select
              value={checkOut}
              onChange={(event) => { setCheckOut(event.target.value); setPage(1); }}
              aria-label="Filter check-out status"
            >
              <option value="all">Check-out: All</option>
              <option value="in_house">Check-out: Later</option>
              <option value="due_out">Check-out: Today</option>
              <option value="overdue">Check-out: Overdue</option>
            </select>
            <select
              value={payment}
              onChange={(event) => { setPayment(event.target.value); setPage(1); }}
              aria-label="Filter payment status"
            >
              <option value="all">Payment: All Payments</option>
              <option value="unpaid">Payment: Unpaid</option>
              <option value="partial">Payment: Partial</option>
              <option value="paid">Payment: Paid</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setCheckOut("all");
                setPayment("all");
                setPage(1);
              }}
            >
              Reset
            </button>
          </div>
          <span>
            Showing <strong>{guests.length}</strong> of{" "}
            <strong>{total}</strong> entries
          </span>
        </div>
        <section className="in-house-table-shell">
          <div className="in-house-table-scroll">
            <table className="in-house-table">
              <thead>
                <tr>
                  <th>NO</th>
                  <th>GUEST</th>
                  <th>BOOKING</th>
                  <th>ROOM</th>
                  <th>CHECK-OUT</th>
                  <th>PAYMENT</th>
                  <th>RESERVATION STATUS</th>
                  <th>OPERATIONAL STATUS</th>
                  <th>DEPOSIT</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {!loading && guests.map((item, index) => (
                  <tr key={item.id}>
                    <td className="reservations-no">{(page - 1) * pageSize + index + 1}</td>
                    <td>
                      <div className="reservations-guest">
                        <strong>{item.guest.fullName}</strong>
                        <small>{item.guest.phone}</small>
                      </div>
                    </td>
                    <td>
                      <span className="in-house-booking">{item.bookingCode}</span>
                    </td>
                    <td className="in-house-room">
                      {item.roomSummary || "—"}
                      {item.rooms.some(room => room.roomNumber)
                        ? ` · ${item.rooms.map(room => room.roomNumber).filter(Boolean).join(", ")}`
                        : ""}
                    </td>
                    <td>{formatStayDate(item.checkOutDate)}</td>
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
                      <span className="reservations-badge reservations-badge--info">
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
                              : "info")
                        }
                      >
                        {item.operationalStatus.label}
                      </span>
                    </td>
                    <td>
                      {item.deposit.heldBalance === 0 ? (
                        <span className="in-house-muted">No Deposit</span>
                      ) : (
                        <span className="reservations-badge reservations-badge--warning">
                          {formatRupiah(item.deposit.heldBalance)}
                        </span>
                      )}
                    </td>
                    <td>
                      <Link
                        href={
                          "/reservations/" +
                          encodeURIComponent(item.id)
                        }
                        className="in-house-view-button"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
                {(loading || error || guests.length === 0) && (
                  <tr>
                    <td className="in-house-empty" colSpan={10}>
                      {loading ? <LoadingSkeleton /> : error || "Tidak ada tamu yang cocok dengan filter."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="in-house-table-footer">
            <span className="in-house-audit-dot" />
            {total} guests in house
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
