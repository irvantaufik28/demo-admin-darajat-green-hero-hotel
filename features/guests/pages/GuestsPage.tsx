"use client";
import "../../settings/styles/settings.css";
import "../styles/guests.css";

import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "../../../components/layout/AdminShell";
import { restoreSession } from "../../../lib/auth";
import { getGuests, type Guest } from "../services/guests";
import { guestDate, guestMoney, guestStatus } from "../utils/format";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

const pageSize = 20;

export function GuestsPage() {
  const { t } = useTranslations({ en, id });
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(query.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        if (!(await restoreSession())) return;
        const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
        if (search) params.set("search", search);
        if (status) params.set("status", status);
        const response = await getGuests(params, controller.signal);
        if (controller.signal.aborted) return;
        setGuests(response.items);
        setTotal(response.total);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setGuests([]);
          setError(cause instanceof Error ? cause.message : t("list.errors.loadFailed"));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [page, search, status, reloadKey]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <AdminShell title={t("shell.title")} context={t("shell.listContext")}>
      <main className="guests-page">
        <header className="guests-heading">
          <div>
            <span className="roles-eyebrow">{t("list.eyebrow")}</span>
            <h1>{t("list.title")}</h1>
            <p>{t("list.description")}</p>
          </div>
        </header>
        <section className="guests-panel">
          <div className="guests-toolbar">
            <h2>{t("list.panelTitle")} <span>{t("list.count", { total })}</span></h2>
            <div>
              <input aria-label={t("list.searchAriaLabel")} placeholder={t("list.searchPlaceholder")}
                value={query} onChange={(event) => setQuery(event.target.value)} />
              <select aria-label={t("list.statusFilterAriaLabel")} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
                <option value="">{t("list.statusOptions.all")}</option>
                <option value="active">{t("list.statusOptions.active")}</option>
                <option value="blacklisted">{t("list.statusOptions.blacklisted")}</option>
              </select>
            </div>
          </div>
          {error && (
            <div className="guests-message" role="alert">
              {error} <button type="button" onClick={() => setReloadKey((value) => value + 1)}>{t("list.retry")}</button>
            </div>
          )}
          <div className="guests-table-scroll">
            <table className="guests-table">
              <thead><tr>
                <th>{t("list.table.guestName")}</th><th>{t("list.table.phone")}</th><th>{t("list.table.email")}</th><th>{t("list.table.totalStays")}</th>
                <th>{t("list.table.lastStay")}</th><th>{t("list.table.totalNights")}</th><th>{t("list.table.totalSpend")}</th>
                <th>{t("list.table.guestStatus")}</th><th>{t("list.table.action")}</th>
              </tr></thead>
              <tbody>
                {!loading && guests.map((guest) => <tr key={guest.id}>
                  <td><strong>{guest.fullName}</strong></td>
                  <td>{guest.phone || "—"}</td><td>{guest.email || "—"}</td>
                  <td>{guest.totalStays}</td><td>{guestDate(guest.lastStay)}</td>
                  <td>{guest.totalNights}</td><td>{guestMoney(guest.totalSpend)}</td>
                  <td><span className={`guests-status guests-status--${guest.status}`}>{guestStatus(guest.status)}</span></td>
                  <td><Link href={`/guests/${guest.id}`}>{t("list.view")}</Link></td>
                </tr>)}
                {(loading || !guests.length) && <tr><td colSpan={9} className="guests-empty">
                  {loading ? <LoadingSkeleton /> : error ? t("list.errors.unableToLoad") : t("list.empty")}
                </td></tr>}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="guests-pagination">
              <span>{t("pagination.pageOf", { page, total: totalPages })}</span>
              <div>
                <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>{t("pagination.previous")}</button>
                <button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>{t("pagination.next")}</button>
              </div>
            </div>
          )}
        </section>
      </main>
    </AdminShell>
  );
}
