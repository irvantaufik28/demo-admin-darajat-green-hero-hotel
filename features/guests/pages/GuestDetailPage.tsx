"use client";
import "../../settings/styles/settings.css";
import "../styles/guests.css";

import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "../../../components/layout/AdminShell";
import { restoreSession } from "../../../lib/auth";
import {
  getGuest,
  getGuestReservations,
  updateGuestNotes,
  type Guest,
  type GuestReservation,
} from "../services/guests";
import {
  guestDate,
  guestMoney,
  guestSource,
  guestStatus,
  reservationStatus,
} from "../utils/format";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

export function GuestDetailPage({ guestKey }: { guestKey: string }) {
  const { t } = useTranslations({ en, id });
  const [guest, setGuest] = useState<Guest | null>(null);
  const [history, setHistory] = useState<GuestReservation[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [internalNotes, setInternalNotes] = useState("");
  const [savedNotes, setSavedNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function loadGuest() {
      setLoading(true);
      setError("");
      try {
        if (!(await restoreSession())) return;
        const response = await getGuest(guestKey, controller.signal);
        if (controller.signal.aborted) return;
        setGuest(response.guest);
        setInternalNotes(response.guest.internalNotes ?? "");
        setSavedNotes(response.guest.internalNotes ?? "");
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : t("detail.errors.profileLoadFailed"));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadGuest();
    return () => controller.abort();
  }, [guestKey]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadHistory() {
      setHistoryLoading(true);
      setHistoryError("");
      try {
        if (!(await restoreSession())) return;
        const response = await getGuestReservations(guestKey, historyPage, controller.signal);
        if (controller.signal.aborted) return;
        setHistory(response.items);
        setHistoryTotal(response.total);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setHistory([]);
          setHistoryError(cause instanceof Error ? cause.message : t("detail.errors.historyLoadFailed"));
        }
      } finally {
        if (!controller.signal.aborted) setHistoryLoading(false);
      }
    }
    void loadHistory();
    return () => controller.abort();
  }, [guestKey, historyPage]);

  async function saveNotes() {
    if (!guest || saving || internalNotes === savedNotes) return;
    setSaving(true);
    setNotice("");
    try {
      const response = await updateGuestNotes(guest, internalNotes);
      setGuest(response.guest);
      setInternalNotes(response.guest.internalNotes ?? "");
      setSavedNotes(response.guest.internalNotes ?? "");
      setNotice(t("detail.internalNotes.saved"));
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : t("detail.errors.notesSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (!guest) return (
    <AdminShell title={t("shell.title")} context={t("shell.profileContext")}>
      <main className="guests-page">
        {loading ? <LoadingSkeleton variant="detail" /> : <h1>{error || t("detail.notFound")}</h1>}
        <Link href="/guests">{t("detail.backToAll")}</Link>
      </main>
    </AdminShell>
  );

  return (
    <AdminShell title={t("shell.title")} context={t("shell.profileContext")}>
      <main className="guests-page">
        <Link className="roles-back" href="/guests">{t("detail.backToAll")}</Link>
        <header className="guests-heading">
          <div>
            <span className="roles-eyebrow">{t("detail.eyebrow")}</span>
            <h1>{guest.fullName}</h1>
            <p>{t("detail.description")}</p>
          </div>
          <span className={`guests-status guests-status--${guest.status}`}>{guestStatus(guest.status)}</span>
        </header>

        <section className="guests-detail-panel">
          <header><h2>{t("detail.profile.title")}</h2></header>
          <dl className="guests-profile-grid">
            <div><dt>{t("detail.profile.name")}</dt><dd>{guest.fullName}</dd></div>
            <div><dt>{t("detail.profile.nik")}</dt><dd>{guest.nik || "—"}</dd></div>
            <div><dt>{t("detail.profile.phone")}</dt><dd>{guest.phone || "—"}</dd></div>
            <div><dt>{t("detail.profile.email")}</dt><dd>{guest.email || "—"}</dd></div>
            <div><dt>{t("detail.profile.address")}</dt><dd>{guest.address || "—"}</dd></div>
            <div className="guests-profile-notes"><dt>{t("detail.profile.notes")}</dt><dd>{guest.internalNotes || "—"}</dd></div>
          </dl>
        </section>

        <section className="guests-detail-panel">
          <header><h2>{t("detail.staySummary.title")}</h2></header>
          <div className="guests-summary-grid">
            <div><span>{t("detail.staySummary.totalStays")}</span><strong>{guest.totalStays}</strong></div>
            <div><span>{t("detail.staySummary.totalNights")}</span><strong>{guest.totalNights}</strong></div>
            <div><span>{t("detail.staySummary.totalSpend")}</span><strong>{guestMoney(guest.totalSpend)}</strong></div>
            <div><span>{t("detail.staySummary.lastStay")}</span><strong>{guestDate(guest.lastStay)}</strong></div>
          </div>
        </section>

        <section className="guests-detail-panel">
          <header><h2>{t("detail.history.title")}</h2><span>{t("detail.history.count", { total: historyTotal })}</span></header>
          <div className="guests-table-scroll">
            <table className="guests-table">
              <thead><tr>
                <th>{t("detail.history.table.bookingId")}</th><th>{t("detail.history.table.stayDate")}</th><th>{t("detail.history.table.roomType")}</th><th>{t("detail.history.table.source")}</th>
                <th>{t("detail.history.table.reservationStatus")}</th><th>{t("detail.history.table.bookingTotal")}</th>
              </tr></thead>
              <tbody>
                {!historyLoading && history.map((row) => <tr key={row.id}>
                  <td><Link href={`/reservations/${row.id}`}>{row.bookingCode}</Link></td>
                  <td>{guestDate(row.checkInDate)} – {guestDate(row.checkOutDate)}</td>
                  <td>{row.roomTypes || "—"}</td><td>{guestSource(row.source)}</td>
                  <td>{reservationStatus(row.reservationStatus)}</td><td>{guestMoney(row.bookingTotal)}</td>
                </tr>)}
                {(historyLoading || !history.length) && <tr><td colSpan={6} className="guests-empty">
                  {historyLoading ? <LoadingSkeleton /> : historyError || t("detail.history.empty")}
                </td></tr>}
              </tbody>
            </table>
          </div>
          {historyTotal > 20 && (
            <div className="guests-pagination">
              <span>{t("pagination.pageOf", { page: historyPage, total: Math.ceil(historyTotal / 20) })}</span>
              <div>
                <button type="button" disabled={historyPage <= 1 || historyLoading} onClick={() => setHistoryPage((value) => value - 1)}>{t("pagination.previous")}</button>
                <button type="button" disabled={historyPage >= Math.ceil(historyTotal / 20) || historyLoading} onClick={() => setHistoryPage((value) => value + 1)}>{t("pagination.next")}</button>
              </div>
            </div>
          )}
        </section>

        <section className="guests-detail-panel guests-internal-notes">
          <header><h2>{t("detail.internalNotes.title")}</h2></header>
          <div>
            <label htmlFor="guest-internal-notes">{t("detail.internalNotes.label")}</label>
            <textarea id="guest-internal-notes" value={internalNotes} disabled={saving}
              onChange={(event) => { setInternalNotes(event.target.value); setNotice(""); }}
              placeholder={t("detail.internalNotes.placeholder")} rows={4} />
            <button type="button" disabled={saving || internalNotes === savedNotes} onClick={() => void saveNotes()}>
              {saving ? t("detail.internalNotes.saving") : t("detail.internalNotes.save")}
            </button>
            {notice && <p role="status">{notice}</p>}
          </div>
        </section>
      </main>
    </AdminShell>
  );
}
