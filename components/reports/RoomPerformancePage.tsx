"use client";

import { useMemo, useState } from "react";
import { AdminShell } from "../layout/AdminShell";
import { initialReservations } from "../../lib/reservation-list-data";
import {
  averageRate,
  occupancy,
  shiftDate,
  summarizePerformance,
  weekDates,
  type OccupancyMode,
  type PerformanceRow,
} from "../../lib/room-performance-data";
import { roomTypes } from "../../lib/walk-in-data";

type Comparison = "previous" | "last-year" | "none";
const money = (value: number) => `Rp${Math.round(value).toLocaleString("id-ID")}`;
const percent = (value: number) => `${value.toFixed(1)}%`;
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));

function downloadCsv(rows: PerformanceRow[], daily: ReturnType<typeof summarizePerformance>["daily"]) {
  const records = [
    ["Room Type", "Physical Rooms", "Available RN", "Sold RN", "Unsold RN", "Occupancy", "ARR", "Room Revenue", "Cancelled RN"],
    ...rows.map((row) => [row.name, row.rooms, row.available, row.sold,
      row.available - row.sold, percent(occupancy(row)), Math.round(averageRate(row)),
      row.revenue, row.cancelled]),
    [],
    ["Date", "Available RN", "Sold RN", "Occupancy", "ARR", "Room Revenue"],
    ...daily.map((day) => [day.date, day.total.available, day.total.sold,
      percent(occupancy(day.total)), Math.round(averageRate(day.total)), day.total.revenue]),
  ];
  const csv = records.map((row) =>
    row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
  ).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "room-performance-week.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function ComparisonCard({ label, current, previous, format }: {
  label: string;
  current: number;
  previous: number;
  format: (value: number) => string;
}) {
  const change = previous ? ((current - previous) / previous) * 100 : null;
  return (
    <div className="room-performance-compare-card">
      <span>{label}</span>
      <strong>{format(current)}</strong>
      <small>{change === null ? "— no baseline data" :
        `${change >= 0 ? "+" : ""}${percent(change)} vs comparison week`}</small>
    </div>
  );
}

export function RoomPerformancePage() {
  const [weekStart, setWeekStart] = useState("2026-09-29");
  const [roomId, setRoomId] = useState("");
  const [source, setSource] = useState("");
  const [mode, setMode] = useState<OccupancyMode>("actual");
  const [comparison, setComparison] = useState<Comparison>("previous");
  const dates = useMemo(() => weekDates(weekStart), [weekStart]);
  const result = useMemo(
    () => summarizePerformance(dates, roomId, source, mode),
    [dates, roomId, source, mode],
  );
  const comparisonStart = comparison === "last-year"
    ? shiftDate(weekStart, -364)
    : shiftDate(weekStart, -7);
  const baseline = useMemo(
    () => summarizePerformance(weekDates(comparisonStart), roomId, source, mode),
    [comparisonStart, roomId, source, mode],
  );
  const sources = [...new Set(initialReservations.map((row) => row.source))].sort();
  const totalRooms = result.byRoom.reduce((sum, row) => sum + row.rooms, 0);

  return (
    <AdminShell title="Reports" context="Room Performance">
      <main className="room-performance-page">
        <header className="room-performance-heading">
          <div>
            <h1>Room Performance</h1>
            <p>Occupancy, room nights, and room revenue by room type for a seven-day period.</p>
          </div>
          <div className="room-performance-actions">
            <button type="button" onClick={() => window.print()}>Print Audit Sheet</button>
            <button type="button" onClick={() => downloadCsv(result.byRoom, result.daily)}>Export CSV</button>
          </div>
        </header>

        <section className="room-performance-filters" aria-label="Report filters">
          <label>Week starting
            <input type="date" value={weekStart} onChange={(event) => setWeekStart(event.target.value || "2026-09-29")} />
          </label>
          <label>Room Type
            <select value={roomId} onChange={(event) => setRoomId(event.target.value)}>
              <option value="">All Room Types</option>
              {roomTypes.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
            </select>
          </label>
          <label>Source
            <select value={source} onChange={(event) => setSource(event.target.value)}>
              <option value="">All Sources</option>
              {sources.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>Occupancy Mode
            <select value={mode} onChange={(event) => setMode(event.target.value as OccupancyMode)}>
              <option value="actual">Actual Occupied</option>
              <option value="projected">Actual + Confirmed</option>
            </select>
          </label>
          <label>Compare With
            <select value={comparison} onChange={(event) => setComparison(event.target.value as Comparison)}>
              <option value="previous">Previous Week</option>
              <option value="last-year">Same Week Last Year</option>
              <option value="none">No Comparison</option>
            </select>
          </label>
          <button type="button" onClick={() => {
            setWeekStart("2026-09-29"); setRoomId(""); setSource("");
            setMode("actual"); setComparison("previous");
          }}>Reset</button>
        </section>

        <p className="room-performance-period">
          {dateLabel(dates[0])} – {dateLabel(dates[6])} · {totalRooms} physical rooms · 7 nights
        </p>

        <section className="room-performance-kpis" aria-label="Performance summary">
          {[
            ["Available Room Nights", result.total.available.toLocaleString("id-ID")],
            ["Sold Room Nights", result.total.sold.toLocaleString("id-ID")],
            ["Occupancy Rate", percent(occupancy(result.total))],
            ["Average Room Rate (ARR)", money(averageRate(result.total))],
            ["Total Room Revenue", money(result.total.revenue)],
          ].map(([label, value]) => <div className="room-performance-kpi" key={label}>
            <span>{label}</span><strong>{value}</strong>
          </div>)}
        </section>

        <section className="room-performance-panel">
          <header><h2>Performance by Room Type</h2><span>Room nights and catalog room rates</span></header>
          <div className="room-performance-scroll">
            <table><thead><tr>
              <th>Room Type</th><th>Physical Rooms</th><th>Available RN</th>
              <th>Sold RN</th><th>Unsold RN</th><th>Occupancy</th>
              <th>ARR</th><th>Room Revenue</th><th>Cancelled RN</th>
            </tr></thead><tbody>
              {[...result.byRoom, result.total].map((row) => <tr key={row.name} className={row.name === "Total" ? "room-performance-total" : ""}>
                <td><strong>{row.name}</strong></td><td>{row.name === "Total" ? totalRooms : row.rooms}</td>
                <td>{row.available}</td><td>{row.sold}</td><td>{row.available - row.sold}</td>
                <td>{percent(occupancy(row))}</td><td>{money(averageRate(row))}</td>
                <td>{money(row.revenue)}</td><td>{row.cancelled}</td>
              </tr>)}
            </tbody></table>
          </div>
        </section>

        {comparison !== "none" && <section className="room-performance-comparison">
          <header><h2>Week Comparison</h2><span>vs {comparison === "previous" ? "Previous Week" : "Same Week Last Year"} ({dateLabel(comparisonStart)} – {dateLabel(shiftDate(comparisonStart, 6))})</span></header>
          <div className="room-performance-compare-grid">
            <ComparisonCard label="Occupancy Rate" current={occupancy(result.total)} previous={occupancy(baseline.total)} format={percent} />
            <ComparisonCard label="Sold Room Nights" current={result.total.sold} previous={baseline.total.sold} format={String} />
            <ComparisonCard label="Average Room Rate" current={averageRate(result.total)} previous={averageRate(baseline.total)} format={money} />
            <ComparisonCard label="Room Revenue" current={result.total.revenue} previous={baseline.total.revenue} format={money} />
          </div>
        </section>}

        <section className="room-performance-panel">
          <header><h2>Daily Occupancy Breakdown</h2><span>Seven-day view</span></header>
          <div className="room-performance-scroll">
            <table><thead><tr>
              <th>Date</th><th>Physical Rooms</th><th>Available RN</th><th>Sold RN</th>
              <th>Occupancy</th><th>ARR</th><th>Room Revenue</th><th>Status</th>
            </tr></thead><tbody>
              {result.daily.map((day) => <tr key={day.date}>
                <td><strong>{dateLabel(day.date)}</strong></td><td>{totalRooms}</td>
                <td>{day.total.available}</td><td>{day.total.sold}</td>
                <td>{percent(occupancy(day.total))}</td><td>{money(averageRate(day.total))}</td>
                <td>{money(day.total.revenue)}</td><td>Recorded</td>
              </tr>)}
            </tbody></table>
          </div>
        </section>
        <p className="room-performance-note">
          Demo figures use static reservations and catalog room rates. Revenue excludes deposits and add-ons.
          Room availability has no maintenance adjustment.
        </p>
      </main>
    </AdminShell>
  );
}
