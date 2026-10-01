"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminShell } from "../layout/AdminShell";
import { formatStayDate } from "../../lib/walk-in-data";
import { departuresToday } from "../../lib/departures-today-data";

function paymentTone(status: string) {
  if (status === "Paid") return "success";
  if (status === "Unpaid") return "danger";
  return "warning";
}

export function DeparturesTodayPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [payment, setPayment] = useState("all");
  const filtered = departuresToday.filter((item) => {
    const query = search.trim().toLowerCase();
    if (
      query &&
      ![item.guestName, item.bookingId, item.whatsapp].some((value) =>
        value.toLowerCase().includes(query),
      )
    )
      return false;
    if (status !== "all" && item.operationalStatus.toLowerCase() !== status)
      return false;
    if (payment !== "all" && item.paymentStatus.toLowerCase() !== payment)
      return false;
    return true;
  });
  const dueOut = departuresToday.filter(
    (item) => item.operationalStatus === "Due Out",
  ).length;

  return (
    <AdminShell title="Reservations" context="Departures Today">
      <div className="departures-page">
        <div className="departures-heading">
          <div>
            <div className="departures-heading-title">
              <h1>Departures Today</h1>
              <span className="departures-count">
                {departuresToday.length} departures today · {dueOut} belum
                check-out
              </span>
            </div>
            <p>Data demo tamu yang dijadwalkan atau sudah check-out.</p>
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
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search guest or booking ID"
              aria-label="Search guest or booking ID"
            />
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Filter departure status"
            >
              <option value="all">Status: All</option>
              <option value="due out">Due Out</option>
              <option value="checked out">Checked Out</option>
            </select>
            <select
              value={payment}
              onChange={(event) => setPayment(event.target.value)}
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
              }}
            >
              Reset
            </button>
          </div>
          <span>
            Showing {filtered.length} of {departuresToday.length} entries
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
                {filtered.map((item, index) => (
                  <tr
                    key={item.bookingId}
                    className={
                      item.status === "Checked-out"
                        ? "departures-row--complete"
                        : undefined
                    }
                  >
                    <td className="reservations-no">{index + 1}</td>
                    <td>
                      <div className="reservations-guest">
                        <strong>{item.guestName}</strong>
                        <small>{item.whatsapp}</small>
                      </div>
                    </td>
                    <td className="departures-booking">{item.bookingId}</td>
                    <td>{formatStayDate(item.checkOut)}</td>
                    <td className="departures-room">
                      {item.room}
                      {item.assignments
                        ? " · " +
                          Object.values(item.assignments).flat().join(", ")
                        : ""}
                    </td>
                    <td>
                      <span
                        className={
                          "reservations-badge reservations-badge--" +
                          paymentTone(item.paymentStatus)
                        }
                      >
                        {item.paymentStatus}
                      </span>
                    </td>
                    <td>
                      <span
                        className={
                          "reservations-badge reservations-badge--" +
                          (item.status === "Checked-in" ? "info" : "neutral")
                        }
                      >
                        {item.status}
                      </span>
                    </td>
                    <td>
                      <span
                        className={
                          "reservations-badge reservations-badge--" +
                          (item.operationalStatus === "Due Out"
                            ? "warning"
                            : "neutral")
                        }
                      >
                        {item.operationalStatus}
                      </span>
                    </td>
                    <td>
                      {item.depositLabel === "No Deposit" ? (
                        <span className="departures-muted">No Deposit</span>
                      ) : (
                        <span
                          className={
                            "reservations-badge reservations-badge--" +
                            (item.depositLabel === "Held"
                              ? "warning"
                              : "success")
                          }
                        >
                          {item.depositLabel}
                        </span>
                      )}
                    </td>
                    <td>
                      <Link
                        href={
                          "/reservations/" + encodeURIComponent(item.bookingId)
                        }
                        className="departures-view-link"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="departures-empty">
                      Tidak ada tamu yang cocok dengan filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="departures-table-footer">
            <span className="departures-audit-dot" />
            Data demo statis
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
