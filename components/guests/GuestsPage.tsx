"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminShell } from "../layout/AdminShell";
import { guestDate, guestMoney, guests } from "../../lib/guest-data";

export function GuestsPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const visible = useMemo(() => guests.filter((guest) =>
    (!status || guest.status === status) &&
    (!query || `${guest.name} ${guest.phone} ${guest.email}`
      .toLowerCase().includes(query.toLowerCase())),
  ), [query, status]);

  return (
    <AdminShell title="Guests" context="Guest Directory">
      <main className="guests-page">
        <header className="guests-heading">
          <div>
            <span className="roles-eyebrow">GUEST RELATIONSHIPS</span>
            <h1>Guests</h1>
            <p>Profiles and reservation history from the demo bookings.</p>
          </div>
        </header>
        <section className="guests-panel">
          <div className="guests-toolbar">
            <h2>Guest List <span>{visible.length} guests</span></h2>
            <div>
              <input aria-label="Search guests" placeholder="Search name, phone, email..."
                value={query} onChange={(event) => setQuery(event.target.value)} />
              <select aria-label="Filter guest status" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">All Status</option>
                <option value="Active">Active</option>
                <option value="Blacklisted">Blacklisted</option>
              </select>
            </div>
          </div>
          <div className="guests-table-scroll">
            <table className="guests-table">
              <thead><tr>
                <th>Guest Name</th><th>Phone</th><th>Email</th><th>Total Stays</th>
                <th>Last Stay</th><th>Total Nights</th><th>Total Spend</th>
                <th>Guest Status</th><th>Action</th>
              </tr></thead>
              <tbody>
                {visible.map((guest) => <tr key={guest.key}>
                  <td><strong>{guest.name}</strong></td>
                  <td>{guest.phone}</td><td>{guest.email}</td>
                  <td>{guest.totalStays}</td><td>{guestDate(guest.lastStay)}</td>
                  <td>{guest.totalNights}</td><td>{guestMoney(guest.totalSpend)}</td>
                  <td><span className={`guests-status guests-status--${guest.status.toLowerCase()}`}>{guest.status}</span></td>
                  <td><Link href={`/guests/${guest.key}`}>View</Link></td>
                </tr>)}
                {visible.length === 0 && <tr><td colSpan={9} className="guests-empty">No guests found.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </AdminShell>
  );
}
