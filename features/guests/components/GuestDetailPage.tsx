"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "../../../components/layout/AdminShell";
import { guestDate, guestMoney, guests } from "../constants/guest-data";

export function GuestDetailPage({ guestKey }: { guestKey: string }) {
  const guest = guests.find((item) => item.key === guestKey);
  const [internalNotes, setInternalNotes] = useState(guest?.notes ?? "");
  const [savedNotes, setSavedNotes] = useState(guest?.notes ?? "");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!guest) return;
    const stored = sessionStorage.getItem(`green-hero-guest-notes-${guest.key}`);
    if (stored !== null) {
      setInternalNotes(stored);
      setSavedNotes(stored);
    }
  }, [guest]);

  if (!guest) return (
    <AdminShell title="Guests" context="Guest Profile">
      <main className="guests-page"><h1>Guest not found</h1><Link href="/guests">← All Guests</Link></main>
    </AdminShell>
  );

  return (
    <AdminShell title="Guests" context="Guest Profile">
      <main className="guests-page">
        <Link className="roles-back" href="/guests">← All Guests</Link>
        <header className="guests-heading">
          <div>
            <span className="roles-eyebrow">GUEST PROFILE</span>
            <h1>{guest.name}</h1>
            <p>Contact details, stay summary, and reservation history.</p>
          </div>
          <span className={`guests-status guests-status--${guest.status.toLowerCase()}`}>{guest.status}</span>
        </header>

        <section className="guests-detail-panel">
          <header><h2>Guest Profile</h2></header>
          <dl className="guests-profile-grid">
            <div><dt>Name</dt><dd>{guest.name}</dd></div>
            <div><dt>Phone</dt><dd>{guest.phone}</dd></div>
            <div><dt>Email</dt><dd>{guest.email}</dd></div>
            <div><dt>Address</dt><dd>{guest.address}</dd></div>
            <div className="guests-profile-notes"><dt>Notes</dt><dd>{guest.notes || "—"}</dd></div>
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
          <header><h2>Reservation History</h2><span>{guest.history.length} bookings</span></header>
          <div className="guests-table-scroll">
            <table className="guests-table">
              <thead><tr>
                <th>Booking ID</th><th>Stay Date</th><th>Room Type</th><th>Source</th>
                <th>Reservation Status</th><th>Booking Total</th>
              </tr></thead>
              <tbody>{guest.history.map((row) => <tr key={row.bookingId}>
                <td><Link href={`/reservations/${row.bookingId}`}>{row.bookingId}</Link></td>
                <td>{guestDate(row.checkIn)} – {guestDate(row.checkOut)}</td>
                <td>{row.room}</td><td>{row.source}</td>
                <td>{row.status}</td><td>{guestMoney(row.total ?? 0)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </section>

        <section className="guests-detail-panel guests-internal-notes">
          <header><h2>Internal Notes</h2></header>
          <div>
            <label htmlFor="guest-internal-notes">Notes visible to the hotel team</label>
            <textarea id="guest-internal-notes" value={internalNotes}
              onChange={(event) => { setInternalNotes(event.target.value); setNotice(""); }}
              placeholder="Add an internal note about this guest..." rows={4} />
            <button type="button" disabled={internalNotes === savedNotes} onClick={() => {
              sessionStorage.setItem(`green-hero-guest-notes-${guest.key}`, internalNotes);
              setSavedNotes(internalNotes);
              setNotice("Internal notes saved for this demo session.");
            }}>Save Notes</button>
            {notice && <p role="status">{notice}</p>}
          </div>
        </section>
      </main>
    </AdminShell>
  );
}
