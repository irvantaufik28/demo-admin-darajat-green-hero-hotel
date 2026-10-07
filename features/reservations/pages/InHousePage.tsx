"use client";
import "../../dashboard/styles/dashboard.css";
import "../styles/reservations.css";

import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "../../../components/layout/AdminShell";
import { formatRupiah, formatStayDate } from "../constants/walk-in-data";
import { restoreSession } from "../../../lib/auth";
import { getInHouse, type InHouseItem } from "../services/api";
import { useOperationalRefresh } from "../hooks/useOperationalRefresh";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

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
  const { t } = useTranslations({ en, id });
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
          setError(cause instanceof Error ? cause.message : t("inHouse.messages.loadError"));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, search ? 300 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [page, search, checkOut, payment, operationalRefresh]);

  return (
    <AdminShell title={t("shell.title")} context={t("shell.inHouse")}>
      <div className="in-house-page">
        <div className="in-house-heading">
          <div>
            <div className="in-house-title">
              <h1>{t("inHouse.heading")}</h1>
              <span>
                {t("inHouse.summary", { guests: summary.guestsInHouse, rooms: summary.roomsOccupied })}
              </span>
            </div>
            <p>{t("inHouse.description")}</p>
          </div>
          <Link
            href="/reservations/create-reservation-walkin"
            className="action-button"
          >
            ＋ {t("inHouse.newReservation")}
          </Link>
        </div>
        <div className="in-house-filters">
          <div className="in-house-filter-controls">
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder={t("inHouse.searchPlaceholder")}
              aria-label={t("inHouse.searchAriaLabel")}
            />
            <select
              value={checkOut}
              onChange={(event) => { setCheckOut(event.target.value); setPage(1); }}
              aria-label={t("inHouse.filters.checkOutAriaLabel")}
            >
              <option value="all">{t("inHouse.filters.checkOutAll")}</option>
              <option value="in_house">{t("inHouse.filters.checkOutLater")}</option>
              <option value="due_out">{t("inHouse.filters.checkOutToday")}</option>
              <option value="overdue">{t("inHouse.filters.checkOutOverdue")}</option>
            </select>
            <select
              value={payment}
              onChange={(event) => { setPayment(event.target.value); setPage(1); }}
              aria-label={t("inHouse.filters.paymentAriaLabel")}
            >
              <option value="all">{t("inHouse.filters.paymentAll")}</option>
              <option value="unpaid">{t("inHouse.filters.paymentUnpaid")}</option>
              <option value="partial">{t("inHouse.filters.paymentPartial")}</option>
              <option value="paid">{t("inHouse.filters.paymentPaid")}</option>
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
              {t("inHouse.filters.reset")}
            </button>
          </div>
          <span>
            {t("inHouse.showingEntries", { count: guests.length, total })}
          </span>
        </div>
        <section className="in-house-table-shell">
          <div className="in-house-table-scroll">
            <table className="in-house-table">
              <thead>
                <tr>
                  <th>{t("inHouse.table.no")}</th>
                  <th>{t("inHouse.table.guest")}</th>
                  <th>{t("inHouse.table.booking")}</th>
                  <th>{t("inHouse.table.room")}</th>
                  <th>{t("inHouse.table.checkOut")}</th>
                  <th>{t("inHouse.table.payment")}</th>
                  <th>{t("inHouse.table.reservationStatus")}</th>
                  <th>{t("inHouse.table.operationalStatus")}</th>
                  <th>{t("inHouse.table.deposit")}</th>
                  <th>{t("inHouse.table.action")}</th>
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
                      {item.roomSummary || t("common.emptyDash")}
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
                        <span className="in-house-muted">{t("inHouse.table.noDeposit")}</span>
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
                        {t("common.view")}
                      </Link>
                    </td>
                  </tr>
                ))}
                {(loading || error || guests.length === 0) && (
                  <tr>
                    <td className="in-house-empty" colSpan={10}>
                      {loading ? <LoadingSkeleton /> : error || t("inHouse.messages.empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="in-house-table-footer">
            <span className="in-house-audit-dot" />
            {t("inHouse.footer", { total })}
            {total > pageSize && (
              <div>
                <button type="button" disabled={page === 1} onClick={() => setPage(value => value - 1)}>{t("common.previous")}</button>
                <span> {t("common.pageInfo", { page, total: Math.ceil(total / pageSize) })} </span>
                <button type="button" disabled={page * pageSize >= total} onClick={() => setPage(value => value + 1)}>{t("common.next")}</button>
              </div>
            )}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
