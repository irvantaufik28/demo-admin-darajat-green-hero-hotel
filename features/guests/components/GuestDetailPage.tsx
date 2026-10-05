"use client";

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

export function GuestDetailPage({ guestKey }: { guestKey: string }) {
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
          setError(cause instanceof Error ? cause.message : "Profil tamu gagal dimuat.");
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
          setHistoryError(cause instanceof Error ? cause.message : "Riwayat reservasi gagal dimuat.");
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
      setNotice("Internal notes saved.");
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Internal notes gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  if (!guest) return (
    <AdminShell title="Guests" context="Guest Profile">
      <main className="guests-page">
        <h1>{loading ? "Loading guest..." : error || "Guest not found"}</h1>
        <Link href="/guests">← All Guests</Link>
      </main>
    </AdminShell>
  );

  return (
    <AdminShell title="Guests" context="Guest Profile">
      <main className="guests-page">
        <Link className="roles-back" href="/guests">← All Guests</Link>
        <header className="guests-heading">
          <div>
            <span className="roles-eyebrow">GUEST PROFILE</span>
            <h1>{guest.fullName}</h1>
            <p>Contact details, stay summary, and reservation history.</p>
          </div>
          <span className={`guests-status guests-status--${guest.status}`}>{guestStatus(guest.status)}</span>
        </header>

        <section className="guests-detail-panel">
          <header><h2>Guest Profile</h2></header>
          <dl className="guests-profile-grid">
            <div><dt>Name</dt><dd>{guest.fullName}</dd></div>
            <div><dt>Phone</dt><dd>{guest.phone || "—"}</dd></div>
            <div><dt>Email</dt><dd>{guest.email || "—"}</dd></div>
            <div><dt>Address</dt><dd>{guest.address || "—"}</dd></div>
            <div className="guests-profile-notes"><dt>Notes</dt><dd>{guest.internalNotes || "—"}</dd></div>
          </dl>
        </section>

        <section className="guests-detail-panel">
          <header><h2>Stay Summary</h2></header>
          <div className="guests-summary-grid">
            <div><span>Total Stays</span><strong>{guest.totalStays}</strong></div>
            <div><span>Total Nights</span><strong>{guest.totalNights}</strong></div>
            <div><span>Total Spend</span><strong>{guestMoney(guest.totalSpend)}</strong></div>
            <div><span>Last Stay</span><strong>{guestDate(guest.lastStay)}</strong></div>
          </div>
        </section>

        <section className="guests-detail-panel">
          <header><h2>Reservation History</h2><span>{historyTotal} bookings</span></header>
          <div className="guests-table-scroll">
            <table className="guests-table">
              <thead><tr>
                <th>Booking ID</th><th>Stay Date</th><th>Room Type</th><th>Source</th>
                <th>Reservation Status</th><th>Booking Total</th>
              </tr></thead>
              <tbody>
                {history.map((row) => <tr key={row.id}>
                  <td><Link href={`/reservations/${row.id}`}>{row.bookingCode}</Link></td>
                  <td>{guestDate(row.checkInDate)} – {guestDate(row.checkOutDate)}</td>
                  <td>{row.roomTypes || "—"}</td><td>{guestSource(row.source)}</td>
                  <td>{reservationStatus(row.reservationStatus)}</td><td>{guestMoney(row.bookingTotal)}</td>
                </tr>)}
                {!history.length && <tr><td colSpan={6} className="guests-empty">
                  {historyLoading ? "Loading reservations..." : historyError || "No reservations found."}
                </td></tr>}
              </tbody>
            </table>
          </div>
          {historyTotal > 20 && (
            <div className="guests-pagination">
              <span>Page {historyPage} of {Math.ceil(historyTotal / 20)}</span>
              <div>
                <button type="button" disabled={historyPage <= 1 || historyLoading} onClick={() => setHistoryPage((value) => value - 1)}>Previous</button>
                <button type="button" disabled={historyPage >= Math.ceil(historyTotal / 20) || historyLoading} onClick={() => setHistoryPage((value) => value + 1)}>Next</button>
              </div>
            </div>
          )}
        </section>

        <section className="guests-detail-panel guests-internal-notes">
          <header><h2>Internal Notes</h2></header>
          <div>
            <label htmlFor="guest-internal-notes">Notes visible to the hotel team</label>
            <textarea id="guest-internal-notes" value={internalNotes} disabled={saving}
              onChange={(event) => { setInternalNotes(event.target.value); setNotice(""); }}
              placeholder="Add an internal note about this guest..." rows={4} />
            <button type="button" disabled={saving || internalNotes === savedNotes} onClick={() => void saveNotes()}>
              {saving ? "Saving..." : "Save Notes"}
            </button>
            {notice && <p role="status">{notice}</p>}
          </div>
        </section>
      </main>
    </AdminShell>
  );
}
