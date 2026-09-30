"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "../layout/AdminShell";
import { Icon } from "../ui/Icon";
import { getAvailability, getDashboardSummary, getRecentReservations, getTodayActivities, type DashboardSummary } from "../../lib/dashboard-data";
import { loadAllReservationDetails } from "../../lib/reservation-detail-data";
import { initialReservations, type ReservationRecord } from "../../lib/reservation-list-data";

function StatusBadge({ value }: { value: string }) {
  const tone = value === "Confirmed" || value === "Paid" ? "success" : value === "Checked-in" || value === "Checked-out" ? "info" : "warning";
  return <span className={"status-badge status-badge--" + tone}>{value}</span>;
}

function SummaryCard({ item }: { item: DashboardSummary }) {
  return (
    <div className="summary-card">
      <span className="summary-card__label">{item.label}</span>
      <div className="summary-card__bottom">
        <strong className={item.tone === "danger" ? "summary-card__value summary-card__value--danger" : "summary-card__value"}>{item.value}</strong>
        <span className={"summary-detail summary-detail--" + item.tone}>{item.detail}</span>
      </div>
    </div>
  );
}

export function DashboardContent() {
  const [message, setMessage] = useState("");
  const [reservationRecords, setReservationRecords] = useState<ReservationRecord[]>(initialReservations);

  useEffect(() => {
    setReservationRecords(loadAllReservationDetails());
  }, []);
  const todayActivities = getTodayActivities(reservationRecords);
  const summaryItems = getDashboardSummary(reservationRecords);
  const reservations = getRecentReservations(reservationRecords);
  const availability = getAvailability(reservationRecords);

  return (
    <AdminShell title="Dashboard" context="Front Desk Overview">
      <div className="dashboard-page">
        <section className="dashboard-title-row">
          <div><h1>Dashboard</h1><p>Ringkasan operasional hari ini</p></div>
          <Link href="/reservations/create-reservation-walkin" className="action-button"><Icon name="plus" />New Reservation</Link>
        </section>

        {message && <div className="dashboard-message" role="status">{message}<button type="button" onClick={() => setMessage("")} aria-label="Tutup pesan">×</button></div>}

        <section className="summary-grid" aria-label="Ringkasan operasional">
          {summaryItems.map(item => <SummaryCard key={item.label} item={item} />)}
        </section>

        <section className="data-panel" aria-labelledby="activity-title">
          <div className="data-panel__header">
            <div><h2 id="activity-title">Today Activity</h2><p>Tamu yang membutuhkan tindakan hari ini</p></div>
            <span className="pending-count"><i />{todayActivities.length} Pending Actions</span>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Guest</th><th>Room</th><th>Type</th><th>Status</th><th className="cell-right">Action</th></tr></thead>
              <tbody>{todayActivities.map(row => (
                <tr key={row.type + "-" + row.bookingId}>
                  <td className="cell-strong">{row.guest}</td><td className="cell-muted">{row.room}</td><td><span className={"activity-type activity-type--" + row.type.toLowerCase()}>{row.type}</span></td>
                  <td><StatusBadge value={row.status} /></td>
                  <td className="cell-right"><button type="button" className="table-action" disabled>View</button></td>
                </tr>
              ))}{todayActivities.length === 0 && <tr><td colSpan={5} className="cell-muted">Belum ada aktivitas yang perlu ditindak.</td></tr>}</tbody>
            </table>
          </div>
        </section>

        <section className="data-panel" aria-labelledby="reservations-title">
          <div className="data-panel__header">
            <div><h2 id="reservations-title">Recent Reservations</h2><p>Reservasi terbaru dari seluruh channel</p></div>
            <Link href="/reservations" className="text-action">View All Reservations <Icon name="arrow" width={15} height={15} /></Link>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Booking</th><th>Guest</th><th>Source</th><th>Stay</th><th>Payment</th><th>Status</th><th className="cell-right">Action</th></tr></thead>
              <tbody>{reservations.map(row => (
                <tr key={row.booking}>
                  <td className="cell-strong numeric">{row.booking}</td><td className="cell-strong">{row.guest}</td><td className="cell-muted">{row.source}</td><td className="cell-muted numeric">{row.stay}</td>
                  <td><StatusBadge value={row.payment} /></td><td><StatusBadge value={row.status} /></td><td className="cell-right"><Link href={"/reservations/" + encodeURIComponent(row.booking)} className="table-action">View</Link></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>

        <section className="availability-strip" aria-label="Ketersediaan kamar hari ini">
          <strong>Today&apos;s Availability</strong>
          <div className="availability-list">{availability.map(item => <div key={item.label}><span>{item.label}:</span><span className={"status-badge status-badge--" + item.tone}>{item.count}</span></div>)}</div>
          <button type="button" className="text-action" onClick={() => setMessage("Pengaturan harga dan stok akan tersedia pada tahap berikutnya.")}>Manage Prices &amp; Stocks <Icon name="arrow" width={15} height={15} /></button>
        </section>
      </div>
    </AdminShell>
  );
}
