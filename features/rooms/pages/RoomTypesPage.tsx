"use client";
import "../styles/rooms.css";

import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "../../../components/layout/AdminShell";
import { restoreSession } from "../../../lib/auth";
import { getRoomTypes, type RoomTypeRecord } from "../services/room-types";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

export function RoomTypesPage() {
  const { t } = useTranslations({ en, id });
  const [catalog, setCatalog] = useState<RoomTypeRecord[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(
      async () => {
        setLoading(true);
        setError("");
        try {
          if (!(await restoreSession())) return;
          const params = new URLSearchParams({
            page: String(page),
            limit: "20",
          });
          if (query.trim()) params.set("search", query.trim());
          if (status !== "all")
            params.set("isActive", String(status === "active"));
          const result = await getRoomTypes(params, controller.signal);
          setCatalog(result.items);
          setTotal(result.total);
        } catch (caught) {
          if (!controller.signal.aborted)
            setError(
              caught instanceof Error
                ? caught.message
                : t("roomTypes.messages.loadError"),
            );
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      },
      query ? 250 : 0,
    );
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, status, page]);

  return (
    <AdminShell title={t("shell.title")} context={t("shell.roomTypesContext")}>
      <div className="room-types-page">
        <div className="room-types-heading">
          <div>
            <div className="room-types-breadcrumb">{t("roomTypes.breadcrumb")}</div>
            <h1>{t("roomTypes.heading")}</h1>
            <p>
              {t("roomTypes.description")}
            </p>
          </div>
          <Link href="/rooms/new" className="action-button">
            ＋ {t("roomTypes.addButton")}
          </Link>
        </div>

        <div className="room-types-filter-bar">
          <label className="room-types-search">
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="10.8" cy="10.8" r="6.8" />
              <path d="m16 16 5 5" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder={t("roomTypes.filters.searchPlaceholder")}
              aria-label={t("roomTypes.filters.searchAriaLabel")}
            />
          </label>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            aria-label={t("roomTypes.filters.statusAriaLabel")}
          >
            <option value="all">{t("roomTypes.filters.statusAll")}</option>
            <option value="active">{t("roomTypes.filters.statusActive")}</option>
            <option value="inactive">{t("roomTypes.filters.statusInactive")}</option>
          </select>
          <button
            type="button"
            className="room-types-reset"
            onClick={() => {
              setQuery("");
              setStatus("all");
              setPage(1);
            }}
            disabled={!query && status === "all"}
          >
            {t("roomTypes.filters.reset")}
          </button>
          <span className="room-types-total">{t("roomTypes.filters.total", { total })}</span>
        </div>

        <section className="room-types-panel">
          <div className="room-types-panel-head">
            <h2>{t("roomTypes.panel.heading")}</h2>
            <p>{t("roomTypes.panel.shownCount", { count: catalog.length })}</p>
          </div>
          <div className="room-types-table-scroll">
            <table className="room-types-table">
              <thead>
                <tr>
                  <th>{t("roomTypes.table.no")}</th>
                  <th>{t("roomTypes.table.roomType")}</th>
                  <th>{t("roomTypes.table.specification")}</th>
                  <th>{t("roomTypes.table.mealType")}</th>
                  <th>{t("roomTypes.table.extraBed")}</th>
                  <th>{t("roomTypes.table.capacityPatterns")}</th>
                  <th>{t("roomTypes.table.status")}</th>
                  <th>{t("roomTypes.table.action")}</th>
                </tr>
              </thead>
              <tbody>
                {!loading && catalog.map((room, index) => (
                  <tr key={room.id}>
                    <td className="room-types-no">
                      {(page - 1) * 20 + index + 1}
                    </td>
                    <td>
                      <div className="room-types-name-cell">
                        <div>
                          <strong>{room.name}</strong>
                          <small>{room.description ?? "—"}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      {room.sizeSqm ? `${room.sizeSqm} m² · ` : ""}
                      {room.bedCount} {room.bedTypeName ?? t("roomTypes.cell.bed")}
                    </td>
                    <td>{room.mealTypeName ?? "—"}</td>
                    <td>
                      {room.extraBedEnabled
                        ? `${room.maxExtraBeds} ${t("roomTypes.cell.bed")} · Rp${room.extraBedPricePerNight.toLocaleString("id-ID")}`
                        : t("roomTypes.cell.extraBedNotAvailable")}
                    </td>
                    <td>{t("roomTypes.cell.capacityPatterns", { count: room.capacityPatternCount })}</td>
                    <td>
                      <span
                        className={
                          room.isActive
                            ? "room-types-status room-types-status--active"
                            : "room-types-status"
                        }
                      >
                        {room.isActive ? t("roomTypes.status.active") : t("roomTypes.status.inactive")}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/rooms/${encodeURIComponent(room.id)}/edit`}
                        className="room-types-edit-link"
                        aria-label={t("roomTypes.cell.editAriaLabel", { name: room.name })}
                      >
                        {t("roomTypes.cell.edit")}
                      </Link>
                    </td>
                  </tr>
                ))}
                {!loading && catalog.length === 0 && (
                  <tr>
                    <td colSpan={8} className="room-types-empty">
                      {t("roomTypes.messages.empty")}
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan={8} className="room-types-empty">
                      <LoadingSkeleton />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {error && (
            <p className="room-wizard-error" role="alert">
              {error}
            </p>
          )}
          {total > 20 && (
            <div className="room-wizard-footer">
              <button
                type="button"
                className="room-wizard-secondary"
                disabled={page === 1}
                onClick={() => setPage((current) => current - 1)}
              >
                ← {t("roomTypes.pagination.previous")}
              </button>
              <span>
                {t("roomTypes.pagination.pageInfo", { page, total: Math.ceil(total / 20) })}
              </span>
              <button
                type="button"
                className="room-wizard-secondary"
                disabled={page >= Math.ceil(total / 20)}
                onClick={() => setPage((current) => current + 1)}
              >
                {t("roomTypes.pagination.next")} →
              </button>
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
