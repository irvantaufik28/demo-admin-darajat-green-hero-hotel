"use client";
import "../styles/rooms.css";

import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "../../../components/layout/AdminShell";
import { restoreSession } from "../../../lib/auth";
import { getRoomTypes, type RoomTypeRecord } from "../services/room-types";

export function RoomTypesPage() {
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
                : "Gagal memuat tipe kamar.",
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
    <AdminShell title="Rooms" context="Room Types">
      <div className="room-types-page">
        <div className="room-types-heading">
          <div>
            <div className="room-types-breadcrumb">Rooms / Room Types</div>
            <h1>Room Types</h1>
            <p>
              Kelola tipe kamar, fasilitas, dan pola kapasitas untuk reservasi.
            </p>
          </div>
          <Link href="/rooms/new" className="action-button">
            ＋ Add Room Type
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
              placeholder="Search room type..."
              aria-label="Cari tipe kamar"
            />
          </label>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            aria-label="Filter status tipe kamar"
          >
            <option value="all">Status: All Status</option>
            <option value="active">Status: Active</option>
            <option value="inactive">Status: Inactive</option>
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
            Reset
          </button>
          <span className="room-types-total">{total} Room Types Total</span>
        </div>

        <section className="room-types-panel">
          <div className="room-types-panel-head">
            <h2>All Room Types</h2>
            <p>{catalog.length} tipe kamar ditampilkan</p>
          </div>
          <div className="room-types-table-scroll">
            <table className="room-types-table">
              <thead>
                <tr>
                  <th>NO</th>
                  <th>ROOM TYPE</th>
                  <th>SPECIFICATION</th>
                  <th>MEAL TYPE</th>
                  <th>EXTRA BED</th>
                  <th>CAPACITY PATTERNS</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
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
                      {room.bedCount} {room.bedTypeName ?? "bed"}
                    </td>
                    <td>{room.mealTypeName ?? "—"}</td>
                    <td>
                      {room.extraBedEnabled
                        ? `${room.maxExtraBeds} bed · Rp${room.extraBedPricePerNight.toLocaleString("id-ID")}`
                        : "Not available"}
                    </td>
                    <td>{room.capacityPatternCount} patterns</td>
                    <td>
                      <span
                        className={
                          room.isActive
                            ? "room-types-status room-types-status--active"
                            : "room-types-status"
                        }
                      >
                        {room.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/rooms/${encodeURIComponent(room.id)}/edit`}
                        className="room-types-edit-link"
                        aria-label={`Edit ${room.name}`}
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
                {!loading && catalog.length === 0 && (
                  <tr>
                    <td colSpan={8} className="room-types-empty">
                      Tidak ada tipe kamar yang cocok.
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
                ← Previous
              </button>
              <span>
                Page {page} of {Math.ceil(total / 20)}
              </span>
              <button
                type="button"
                className="room-wizard-secondary"
                disabled={page >= Math.ceil(total / 20)}
                onClick={() => setPage((current) => current + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
