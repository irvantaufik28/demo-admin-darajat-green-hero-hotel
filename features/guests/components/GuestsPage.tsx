"use client";

import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "../../../components/layout/AdminShell";
import { restoreSession } from "../../../lib/auth";
import { getGuests, type Guest } from "../services/guests";
import { guestDate, guestMoney, guestStatus } from "../utils/format";

const pageSize = 20;

export function GuestsPage() {
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
          setError(cause instanceof Error ? cause.message : "Daftar tamu gagal dimuat.");
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
    <AdminShell title="Guests" context="Guest Directory">
      <main className="guests-page">
        <header className="guests-heading">
          <div>
            <span className="roles-eyebrow">GUEST RELATIONSHIPS</span>
            <h1>Guests</h1>
            <p>Profiles and reservation history.</p>
          </div>
        </header>
        <section className="guests-panel">
          <div className="guests-toolbar">
            <h2>Guest List <span>{total} guests</span></h2>
            <div>
              <input aria-label="Search guests" placeholder="Search name, phone, email..."
                value={query} onChange={(event) => setQuery(event.target.value)} />
              <select aria-label="Filter guest status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="blacklisted">Blacklisted</option>
              </select>
            </div>
          </div>
          {error && (
            <div className="guests-message" role="alert">
              {error} <button type="button" onClick={() => setReloadKey((value) => value + 1)}>Retry</button>
            </div>
          )}
          <div className="guests-table-scroll">
            <table className="guests-table">
              <thead><tr>
                <th>Guest Name</th><th>Phone</th><th>Email</th><th>Total Stays</th>
                <th>Last Stay</th><th>Total Nights</th><th>Total Spend</th>
                <th>Guest Status</th><th>Action</th>
              </tr></thead>
              <tbody>
                {!loading && guests.map((guest) => <tr key={guest.id}>
                  <td><strong>{guest.fullName}</strong></td>
                  <td>{guest.phone || "—"}</td><td>{guest.email || "—"}</td>
                  <td>{guest.totalStays}</td><td>{guestDate(guest.lastStay)}</td>
                  <td>{guest.totalNights}</td><td>{guestMoney(guest.totalSpend)}</td>
                  <td><span className={`guests-status guests-status--${guest.status}`}>{guestStatus(guest.status)}</span></td>
                  <td><Link href={`/guests/${guest.id}`}>View</Link></td>
                </tr>)}
                {(loading || !guests.length) && <tr><td colSpan={9} className="guests-empty">
                  {loading ? <LoadingSkeleton /> : error ? "Unable to load guests." : "No guests found."}
                </td></tr>}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="guests-pagination">
              <span>Page {page} of {totalPages}</span>
              <div>
                <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</button>
                <button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>Next</button>
              </div>
            </div>
          )}
        </section>
      </main>
    </AdminShell>
  );
}
