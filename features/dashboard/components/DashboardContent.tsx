"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "../../../components/layout/AdminShell";
import { Icon } from "../../../components/ui/Icon";
import { getDashboard, type DashboardResponse } from "../services/api";
import { restoreSession } from "../../../lib/auth";
import { useOperationalRefresh } from "../../reservations/hooks/useOperationalRefresh";

type SummaryCardItem = {
  label: string;
  value: string;
  detail: string;
  tone: "warning" | "neutral" | "success" | "danger";
};

const reservationLabels: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  checked_in: "Checked-in",
  checked_out: "Checked-out",
  cancelled: "Cancelled",
  expired: "Expired",
  unpaid: "Unpaid",
  partial: "Partial",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
};

const sourceLabels: Record<string, string> = {
  website: "Website",
  phone: "Phone",
  walk_in: "Walk-in",
  ota: "OTA",
};

function formatRupiah(value: number): string {
  return `Rp${new Intl.NumberFormat("id-ID").format(value)}`;
}

function formatStayDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

function summaryCards(summary: DashboardResponse["summary"]): SummaryCardItem[] {
  return [
    {
      label: "Arrivals Today",
      value: String(summary.arrivalsToday),
      detail: `${summary.arrivalsPending} belum check-in`,
      tone: "warning",
    },
    {
      label: "Departures Today",
      value: String(summary.departuresToday),
      detail: `${summary.departuresPending} belum check-out`,
      tone: "neutral",
    },
    {
      label: "In House",
      value: String(summary.inHouse),
      detail: `${summary.inHouse} tamu aktif`,
      tone: "success",
    },
    {
      label: "Pending Payment",
      value: String(summary.pendingPayment),
      detail: formatRupiah(summary.outstandingAmount),
      tone: "danger",
    },
  ];
}

function StatusBadge({ value }: { value: string }) {
  const label = reservationLabels[value] ?? value;
  const tone =
    value === "confirmed" || value === "paid"
      ? "success"
      : value === "checked_in" || value === "checked_out"
        ? "info"
        : value === "cancelled" || value === "expired" || value === "failed"
          ? "danger"
          : "warning";
  return <span className={`status-badge status-badge--${tone}`}>{label}</span>;
}

function SummaryCard({ item }: { item: SummaryCardItem }) {
  return (
    <div className="summary-card">
      <span className="summary-card__label">{item.label}</span>
      <div className="summary-card__bottom">
        <strong
          className={item.tone === "danger" ? "summary-card__value summary-card__value--danger" : "summary-card__value"}
        >
          {item.value}
        </strong>
        <span className={`summary-detail summary-detail--${item.tone}`}>{item.detail}</span>
      </div>
    </div>
  );
}

export function DashboardContent() {
  const operationalRefresh = useOperationalRefresh();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function load() {
      try {
        if (!(await restoreSession())) return;
        const response = await getDashboard(controller.signal);
        if (active) setDashboard(response);
      } catch (cause) {
        if (active && !controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Dashboard gagal dimuat.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [requestKey, operationalRefresh]);

  function retry() {
    setError("");
    setLoading(true);
    setRequestKey((value) => value + 1);
  }

  return (
    <AdminShell title="Dashboard" context="Front Desk Overview">
      <div className="dashboard-page">
        <section className="dashboard-title-row">
          <div>
            <h1>Dashboard</h1>
            <p>Ringkasan operasional hari ini</p>
          </div>
          <Link href="/reservations/create-reservation-walkin" className="action-button">
            <Icon name="plus" /> New Reservation
          </Link>
        </section>

        {error && (
          <div className="dashboard-message" role="alert">
            <span>{error}</span>
            <button type="button" onClick={retry}>Coba lagi</button>
          </div>
        )}

        {loading && <div className="data-panel dashboard-state" role="status">Memuat dashboard...</div>}

        {dashboard && !loading && (
          <>
            <section className="summary-grid" aria-label="Ringkasan operasional">
              {summaryCards(dashboard.summary).map((item) => (
                <SummaryCard key={item.label} item={item} />
              ))}
            </section>

            <section className="data-panel" aria-labelledby="activity-title">
              <div className="data-panel__header">
                <div>
                  <h2 id="activity-title">Today Activity</h2>
                  <p>Tamu yang membutuhkan tindakan hari ini</p>
                </div>
                <span className="pending-count"><i />{dashboard.todayActivity.totalShown} Pending Actions</span>
              </div>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr><th>Guest</th><th>Room</th><th>Type</th><th>Status</th><th className="cell-right">Action</th></tr>
                  </thead>
                  <tbody>
                    {dashboard.todayActivity.items.map((row) => (
                      <tr key={`${row.type}-${row.reservationId}`}>
                        <td className="cell-strong">{row.guestName}</td>
                        <td className="cell-muted">{row.roomSummary || "—"}</td>
                        <td><span className={`activity-type activity-type--${row.type.toLowerCase()}`}>{row.type}</span></td>
                        <td><StatusBadge value={row.status} /></td>
                        <td className="cell-right"><Link href={row.url} className="table-action">View</Link></td>
                      </tr>
                    ))}
                    {dashboard.todayActivity.items.length === 0 && (
                      <tr><td colSpan={5} className="cell-muted">Belum ada aktivitas yang perlu ditindak.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="data-panel" aria-labelledby="reservations-title">
              <div className="data-panel__header">
                <div>
                  <h2 id="reservations-title">Recent Reservations</h2>
                  <p>Reservasi terbaru dari seluruh channel</p>
                </div>
                <Link href="/reservations" className="text-action">
                  View All Reservations <Icon name="arrow" width={15} height={15} />
                </Link>
              </div>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr><th>Booking</th><th>Guest</th><th>Source</th><th>Stay</th><th>Payment</th><th>Status</th><th className="cell-right">Action</th></tr>
                  </thead>
                  <tbody>
                    {dashboard.recentReservations.map((row) => (
                      <tr key={row.reservationId}>
                        <td className="cell-strong numeric">{row.bookingCode}</td>
                        <td className="cell-strong">{row.guestName}</td>
                        <td className="cell-muted">{sourceLabels[row.source] ?? row.source}</td>
                        <td className="cell-muted numeric">{formatStayDate(row.checkInDate)} → {formatStayDate(row.checkOutDate)}</td>
                        <td><StatusBadge value={row.paymentStatus} /></td>
                        <td><StatusBadge value={row.reservationStatus} /></td>
                        <td className="cell-right"><Link href={row.url} className="table-action">View</Link></td>
                      </tr>
                    ))}
                    {dashboard.recentReservations.length === 0 && (
                      <tr><td colSpan={7} className="cell-muted">Belum ada reservasi.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="availability-strip" aria-label="Ketersediaan kamar hari ini">
              <strong>Today&apos;s Availability</strong>
              <div className="availability-list">
                {dashboard.todayAvailability.map((item) => (
                  <div key={item.roomTypeId}>
                    <span>{item.roomTypeName}:</span>
                    <span className={`status-badge status-badge--${item.available === null || item.available <= 1 ? "warning" : "success"}`}>
                      {item.available === null ? "Belum diatur" : `${item.available} available`}
                    </span>
                  </div>
                ))}
                {dashboard.todayAvailability.length === 0 && <span>Belum ada tipe kamar aktif.</span>}
              </div>
              <Link href="/prices-stocks" className="text-action">
                Manage Prices &amp; Stocks <Icon name="arrow" width={15} height={15} />
              </Link>
            </section>
          </>
        )}
      </div>
    </AdminShell>
  );
}
