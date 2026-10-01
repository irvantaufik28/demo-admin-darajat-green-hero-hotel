"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminShell } from "../layout/AdminShell";
import {
  getRoomTypeCatalog,
  initialRoomTypes,
  type RoomTypeEntry,
} from "../../lib/rooms-data";

export function RoomTypesPage() {
  const [catalog, setCatalog] = useState<RoomTypeEntry[]>(initialRoomTypes);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    setCatalog(getRoomTypeCatalog());
  }, []);

  const filtered = useMemo(
    () =>
      catalog.filter((room) => {
        const matchesQuery = room.name.toLowerCase().includes(query.trim().toLowerCase());
        const matchesStatus =
          status === "all" || (status === "active" ? room.active : !room.active);
        return matchesQuery && matchesStatus;
      }),
    [catalog, query, status],
  );

  return (
    <AdminShell title="Rooms" context="Room Types">
      <div className="room-types-page">
        <div className="room-types-heading">
          <div>
            <div className="room-types-breadcrumb">Rooms / Room Types</div>
            <h1>Room Types</h1>
            <p>Kelola tipe kamar, fasilitas, dan pola kapasitas untuk reservasi.</p>
          </div>
          <Link href="/rooms/new" className="action-button">
            ＋ Add Room Type
          </Link>
        </div>

        <div className="room-types-filter-bar">
          <label className="room-types-search">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="10.8" cy="10.8" r="6.8" />
              <path d="m16 16 5 5" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search room type..."
              aria-label="Cari tipe kamar"
            />
          </label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="Filter status tipe kamar"
          >
            <option value="all">Status: All Status</option>
            <option value="active">Status: Active</option>
            <option value="inactive">Status: Inactive</option>
          </select>
          <button
            type="button"
            className="room-types-reset"
            onClick={() => { setQuery(""); setStatus("all"); }}
            disabled={!query && status === "all"}
          >
            Reset
          </button>
          <span className="room-types-total">{catalog.length} Room Types Total</span>
        </div>

        <section className="room-types-panel">
          <div className="room-types-panel-head">
            <h2>All Room Types</h2>
            <p>{filtered.length} tipe kamar ditampilkan</p>
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
                {filtered.map((room, index) => (
                  <tr key={room.id}>
                    <td className="room-types-no">{index + 1}</td>
                    <td>
                      <div className="room-types-name-cell">
                        {room.cover && <img src={room.cover.url} alt="" />}
                        <div>
                          <strong>{room.name}</strong>
                          <small>{room.description}</small>
                        </div>
                      </div>
                    </td>
                    <td>{room.size} m² · {room.bedCount} {room.bedType}</td>
                    <td>{room.mealType}</td>
                    <td>
                      {room.extraBedEnabled
                        ? `${room.maxExtraBeds} bed · Rp${room.extraBedPrice.toLocaleString("id-ID")}`
                        : "Not available"}
                    </td>
                    <td>{room.capacityPatterns.filter((pattern) => pattern.selected).length} patterns</td>
                    <td>
                      <span className={room.active ? "room-types-status room-types-status--active" : "room-types-status"}>
                        {room.active ? "Active" : "Inactive"}
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
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="room-types-empty">Tidak ada tipe kamar yang cocok.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
