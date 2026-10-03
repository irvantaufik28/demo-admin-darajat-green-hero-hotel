"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminShell } from "../../../components/layout/AdminShell";
import { formatRupiah, formatStayDate } from "../constants/walk-in-data";
import { inHouseGuests } from "../constants/in-house-data";
function paymentTone(status: string) {
  if (status === "Paid") return "success";
  if (status === "Unpaid") return "danger";
  return "warning";
}

export function InHousePage() {
  const [search, setSearch] = useState("");
  const [checkOut, setCheckOut] = useState("all");
  const [payment, setPayment] = useState("all");

  const filtered = inHouseGuests.filter((item) => {
    const query = search.trim().toLowerCase();
    if (
      query &&
      ![
        item.guestName,
        item.bookingId,
        item.room,
        item.roomNumber,
        ...(item.rooms?.flatMap((room) => [room.room, room.roomNumber]) ?? []),
      ].some((value) => value.toLowerCase().includes(query))
    )
      return false;
    if (checkOut !== "all" && item.operationalStatus.toLowerCase() !== checkOut)
      return false;
    if (payment !== "all" && item.paymentStatus.toLowerCase() !== payment)
      return false;
    return true;
  });
  const roomsOccupied = inHouseGuests.reduce(
    (sum, item) => sum + (item.rooms?.length ?? 1),
    0,
  );

  return (
    <AdminShell title="Reservations" context="In House">
      <div className="in-house-page">
        <div className="in-house-heading">
          <div>
            <div className="in-house-title">
              <h1>In House</h1>
              <span>
                {inHouseGuests.length} guests in house · {roomsOccupied} rooms
                occupied
              </span>
            </div>
            <p>Data demo tamu yang masih berstatus Checked-in.</p>
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
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search guest, room, or booking ID"
              aria-label="Search in-house guests"
            />
            <select
              value={checkOut}
              onChange={(event) => setCheckOut(event.target.value)}
              aria-label="Filter check-out status"
            >
              <option value="all">Check-out: All</option>
              <option value="in house">Check-out: Later</option>
              <option value="due out">Check-out: Today</option>
              <option value="overdue">Check-out: Overdue</option>
            </select>
            <select
              value={payment}
              onChange={(event) => setPayment(event.target.value)}
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
              }}
            >
              Reset
            </button>
          </div>
          <span>
            Showing <strong>{filtered.length}</strong> of{" "}
            <strong>{inHouseGuests.length}</strong> entries
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
                {filtered.map((item, index) => (
                  <tr key={item.bookingId}>
                    <td className="reservations-no">{index + 1}</td>
                    <td>
                      <div className="reservations-guest">
                        <strong>{item.guestName}</strong>
                        <small>{item.whatsapp}</small>
                      </div>
                    </td>
                    <td>
                      <span className="in-house-booking">{item.bookingId}</span>
                    </td>
                    <td className="in-house-room">
                      {item.rooms && item.rooms.length > 1
                        ? `${item.rooms.length} Rooms · ${item.rooms.map((room) => room.roomNumber).join(", ")}`
                        : `${item.room} · ${item.roomNumber}`}
                    </td>
                    <td>{formatStayDate(item.checkOut)}</td>
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
                      <span className="reservations-badge reservations-badge--info">
                        {item.reservationStatus}
                      </span>
                    </td>
                    <td>
                      <span
                        className={
                          "reservations-badge reservations-badge--" +
                          (item.operationalStatus === "Overdue"
                            ? "danger"
                            : item.operationalStatus === "Due Out"
                              ? "warning"
                              : "info")
                        }
                      >
                        {item.operationalStatus}
                      </span>
                    </td>
                    <td>
                      {item.deposit === 0 ? (
                        <span className="in-house-muted">No Deposit</span>
                      ) : (
                        <span className="reservations-badge reservations-badge--warning">
                          {formatRupiah(item.deposit)}
                        </span>
                      )}
                    </td>
                    <td>
                      <Link
                        href={
                          "/reservations/in-house/" +
                          encodeURIComponent(item.bookingId)
                        }
                        className="in-house-view-button"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td className="in-house-empty" colSpan={10}>
                      Tidak ada tamu yang cocok dengan filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="in-house-table-footer">
            <span className="in-house-audit-dot" />
            Data demo statis
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
