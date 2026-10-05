"use client";

import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "../../../components/layout/AdminShell";
import { formatStayDate } from "../constants/walk-in-data";
import { getArrivalsToday, type ArrivalTodayItem } from "../services/api";
import { restoreSession } from "../../../lib/auth";

const pageSize = 20;

function label(value: string) {
  if (value === "walk_in") return "Walk-in";
  if (value === "ota") return "OTA";
  return value.split("_").map(part => part[0].toUpperCase() + part.slice(1)).join("-");
}

function sourceLabel(item: ArrivalTodayItem) {
  return item.source === "ota" && item.otaChannel?.name
    ? `OTA · ${item.otaChannel.name}`
    : label(item.source);
}

function statusTone(value: string) {
  if (value === "Paid" || value === "Confirmed") return "success";
  if (value === "Checked-in" || value === "Checked In") return "info";
  if (value === "Ready to Check-in") return "success";
  return "warning";
}

export function ArrivalsTodayPage() {
  const [arrivals, setArrivals] = useState<ArrivalTodayItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("all");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        if (!(await restoreSession())) return;
        const query = new URLSearchParams({ page: String(page), limit: String(pageSize) });
        if (search.trim()) query.set("search", search.trim());
        if (source !== "all") query.set("source", source);
        const response = await getArrivalsToday(query, controller.signal);
        if (!controller.signal.aborted) {
          setArrivals(response.items);
          setTotal(response.total);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Data kedatangan gagal dimuat.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, search ? 300 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [page, search, source]);

  return (
    <AdminShell title="Reservations" context="Arrivals Today">
      <div className="arrivals-page">
        <div className="arrivals-heading">
          <div>
            <span className="arrivals-eyebrow">FRONT DESK · ARRIVALS</span>
            <h1>Arrivals Today</h1>
            <p>Reservasi yang dijadwalkan tiba hari ini dan tamu yang sudah check-in.</p>
          </div>
          <Link href="/reservations/create-reservation-walkin" className="action-button">
            ＋ New Reservation
          </Link>
        </div>

        <section className="arrivals-panel">
          <div className="arrivals-panel-header">
            <div>
              <h2>Today&apos;s Arrival List</h2>
              <p>{total} reservasi</p>
            </div>
            <div className="arrivals-panel-actions">
              <Link href="/reservations" className="reservation-secondary-button">
                All Reservations
              </Link>
            </div>
          </div>

          <div className="arrivals-filters">
            <input
              value={search}
              onChange={event => { setSearch(event.target.value); setPage(1); }}
              placeholder="Search booking ID, guest, or WhatsApp"
              aria-label="Cari kedatangan"
            />
            <select
              value={source}
              onChange={event => { setSource(event.target.value); setPage(1); }}
              aria-label="Filter sumber reservasi"
            >
              <option value="all">All Sources</option>
              <option value="website">Website</option>
              <option value="walk_in">Walk-in</option>
              <option value="phone">Phone</option>
              <option value="ota">OTA</option>
            </select>
          </div>

          <div className="arrivals-table-scroll">
            <table className="arrivals-table">
              <thead>
                <tr>
                  <th>NO</th>
                  <th>BOOKING</th>
                  <th>GUEST</th>
                  <th>SOURCE</th>
                  <th>STAY</th>
                  <th>ROOM</th>
                  <th>PAYMENT</th>
                  <th>STATUS</th>
                  <th>OPERATIONAL STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {!loading && arrivals.map((item, index) => (
                  <tr key={item.id}>
                    <td className="reservations-no">{(page - 1) * pageSize + index + 1}</td>
                    <td className="reservations-booking">{item.bookingCode}</td>
                    <td>
                      <div className="reservations-guest">
                        <strong>{item.guest.fullName}</strong>
                        <small>{item.guest.phone}</small>
                      </div>
                    </td>
                    <td>
                      <span className="reservations-source">{sourceLabel(item)}</span>
                    </td>
                    <td>
                      <div className="reservations-stay">
                        <strong>
                          {formatStayDate(item.checkInDate)} → {formatStayDate(item.checkOutDate)}
                        </strong>
                        <small>{item.nights} {item.nights === 1 ? "night" : "nights"}</small>
                      </div>
                    </td>
                    <td>{item.roomSummary || "—"}</td>
                    <td>
                      <span className={"reservations-badge reservations-badge--" + statusTone(label(item.paymentStatus))}>
                        {label(item.paymentStatus)}
                      </span>
                    </td>
                    <td>
                      <span className={"reservations-badge reservations-badge--" + statusTone(label(item.reservationStatus))}>
                        {label(item.reservationStatus)}
                      </span>
                    </td>
                    <td>
                      <span className={"reservations-badge reservations-badge--" + statusTone(item.operationalStatus.label)}>
                        {item.operationalStatus.label}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={"/reservations/" + encodeURIComponent(item.id)}
                        className="reservations-view-link"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
                {(loading || error || arrivals.length === 0) && (
                  <tr>
                    <td className="arrivals-empty" colSpan={10}>
                      {loading ? <LoadingSkeleton /> : error || "Tidak ada kedatangan yang cocok dengan filter."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="arrivals-table-footer">
            Showing {arrivals.length} of {total} arrivals
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
