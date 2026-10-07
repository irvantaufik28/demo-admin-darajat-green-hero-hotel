"use client";
import "../styles/dashboard.css";

import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "../../../components/layout/AdminShell";
import { Icon } from "../../../components/ui/Icon";
import { getDashboard, type DashboardResponse } from "../services/api";
import { restoreSession } from "../../../lib/auth";
import { useOperationalRefresh } from "../../reservations/hooks/useOperationalRefresh";
import { useTranslations, type Translate } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

type SummaryCardItem = {
  label: string;
  value: string;
  detail: string;
  tone: "warning" | "neutral" | "success" | "danger";
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

function summaryCards(summary: DashboardResponse["summary"], t: Translate): SummaryCardItem[] {
  return [
    {
      label: t("summary.arrivalsToday"),
      value: String(summary.arrivalsToday),
      detail: t("summary.arrivalsPending", { count: summary.arrivalsPending }),
      tone: "warning",
    },
    {
      label: t("summary.departuresToday"),
      value: String(summary.departuresToday),
      detail: t("summary.departuresPending", { count: summary.departuresPending }),
      tone: "neutral",
    },
    {
      label: t("summary.inHouse"),
      value: String(summary.inHouse),
      detail: t("summary.inHouseDetail", { count: summary.inHouse }),
      tone: "success",
    },
    {
      label: t("summary.pendingPayment"),
      value: String(summary.pendingPayment),
      detail: formatRupiah(summary.outstandingAmount),
      tone: "danger",
    },
  ];
}

function StatusBadge({ value, t }: { value: string; t: Translate }) {
  const label = t(`reservationStatus.${value}`);
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
  const { t } = useTranslations({ en, id });
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
          setError(cause instanceof Error ? cause.message : t("errors.loadFailed"));
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
    <AdminShell title={t("shell.title")} context={t("shell.context")}>
      <div className="dashboard-page">
        <section className="dashboard-title-row">
          <div>
            <h1>{t("header.title")}</h1>
            <p>{t("header.description")}</p>
          </div>
          <Link href="/reservations/create-reservation-walkin" className="action-button">
            <Icon name="plus" /> {t("header.newReservation")}
          </Link>
        </section>

        {error && (
          <div className="dashboard-message" role="alert">
            <span>{error}</span>
            <button type="button" onClick={retry}>{t("errors.retry")}</button>
          </div>
        )}

        {loading && <LoadingSkeleton variant="dashboard" />}

        {dashboard && !loading && (
          <>
            <section className="summary-grid" aria-label={t("summary.ariaLabel")}>
              {summaryCards(dashboard.summary, t).map((item) => (
                <SummaryCard key={item.label} item={item} />
              ))}
            </section>

            <section className="data-panel" aria-labelledby="activity-title">
              <div className="data-panel__header">
                <div>
                  <h2 id="activity-title">{t("todayActivity.title")}</h2>
                  <p>{t("todayActivity.description")}</p>
                </div>
                <span className="pending-count"><i />{t("todayActivity.pendingActions", { count: dashboard.todayActivity.totalShown })}</span>
              </div>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr><th>{t("todayActivity.table.guest")}</th><th>{t("todayActivity.table.room")}</th><th>{t("todayActivity.table.type")}</th><th>{t("todayActivity.table.status")}</th><th className="cell-right">{t("todayActivity.table.action")}</th></tr>
                  </thead>
                  <tbody>
                    {dashboard.todayActivity.items.map((row) => (
                      <tr key={`${row.type}-${row.reservationId}`}>
                        <td className="cell-strong">{row.guestName}</td>
                        <td className="cell-muted">{row.roomSummary || "—"}</td>
                        <td><span className={`activity-type activity-type--${row.type.toLowerCase()}`}>{row.type}</span></td>
                        <td><StatusBadge value={row.status} t={t} /></td>
                        <td className="cell-right"><Link href={row.url} className="table-action">{t("todayActivity.view")}</Link></td>
                      </tr>
                    ))}
                    {dashboard.todayActivity.items.length === 0 && (
                      <tr><td colSpan={5} className="cell-muted">{t("todayActivity.empty")}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="data-panel" aria-labelledby="reservations-title">
              <div className="data-panel__header">
                <div>
                  <h2 id="reservations-title">{t("recentReservations.title")}</h2>
                  <p>{t("recentReservations.description")}</p>
                </div>
                <Link href="/reservations" className="text-action">
                  {t("recentReservations.viewAll")} <Icon name="arrow" width={15} height={15} />
                </Link>
              </div>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr><th>{t("recentReservations.table.booking")}</th><th>{t("recentReservations.table.guest")}</th><th>{t("recentReservations.table.source")}</th><th>{t("recentReservations.table.stay")}</th><th>{t("recentReservations.table.payment")}</th><th>{t("recentReservations.table.status")}</th><th className="cell-right">{t("recentReservations.table.action")}</th></tr>
                  </thead>
                  <tbody>
                    {dashboard.recentReservations.map((row) => (
                      <tr key={row.reservationId}>
                        <td className="cell-strong numeric">{row.bookingCode}</td>
                        <td className="cell-strong">{row.guestName}</td>
                        <td className="cell-muted">{t(`source.${row.source}`)}</td>
                        <td className="cell-muted numeric">{formatStayDate(row.checkInDate)} → {formatStayDate(row.checkOutDate)}</td>
                        <td><StatusBadge value={row.paymentStatus} t={t} /></td>
                        <td><StatusBadge value={row.reservationStatus} t={t} /></td>
                        <td className="cell-right"><Link href={row.url} className="table-action">{t("recentReservations.view")}</Link></td>
                      </tr>
                    ))}
                    {dashboard.recentReservations.length === 0 && (
                      <tr><td colSpan={7} className="cell-muted">{t("recentReservations.empty")}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="availability-strip" aria-label={t("availability.ariaLabel")}>
              <strong>{t("availability.title")}</strong>
              <div className="availability-list">
                {dashboard.todayAvailability.map((item) => (
                  <div key={item.roomTypeId}>
                    <span>{item.roomTypeName}:</span>
                    <span className={`status-badge status-badge--${item.available === null || item.available <= 1 ? "warning" : "success"}`}>
                      {item.available === null ? t("availability.notSet") : t("availability.available", { count: item.available })}
                    </span>
                  </div>
                ))}
                {dashboard.todayAvailability.length === 0 && <span>{t("availability.empty")}</span>}
              </div>
              <Link href="/prices-stocks" className="text-action">
                {t("availability.manage")} <Icon name="arrow" width={15} height={15} />
              </Link>
            </section>
          </>
        )}
      </div>
    </AdminShell>
  );
}
