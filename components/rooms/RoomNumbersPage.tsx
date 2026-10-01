"use client";

import { useMemo, useState } from "react";
import { AdminShell } from "../layout/AdminShell";
import { initialRoomTypes } from "../../lib/rooms-data";

type Status = "Active" | "Maintenance" | "Inactive";
type Occupancy = "Available" | "Occupied";
type RoomNumber = { number: string; type: string; floor: string; occupancy: Occupancy; status: Status; note: string };

const initialRooms: RoomNumber[] = [
  { number: "101", type: "Family Room", floor: "Floor 1", occupancy: "Available", status: "Active", note: "" },
  { number: "102", type: "Family Room", floor: "Floor 1", occupancy: "Occupied", status: "Active", note: "" },
  { number: "201", type: "Deluxe Room", floor: "Floor 2", occupancy: "Available", status: "Active", note: "Dekat tangga darurat, pemandangan kebun timur." },
  { number: "202", type: "Deluxe Room", floor: "Floor 2", occupancy: "Occupied", status: "Active", note: "" },
  { number: "203", type: "Deluxe Room", floor: "Floor 2", occupancy: "Available", status: "Maintenance", note: "" },
  { number: "204", type: "Deluxe Room", floor: "Floor 2", occupancy: "Available", status: "Inactive", note: "" },
  { number: "301", type: "Suite Room", floor: "Floor 3", occupancy: "Available", status: "Active", note: "" },
];

const blankRoom: RoomNumber = { number: "", type: "", floor: "", occupancy: "Available", status: "Active", note: "" };
const statuses: Status[] = ["Active", "Maintenance", "Inactive"];
const roomTypes = Array.from(new Set([...initialRoomTypes.map((room) => room.name), "Deluxe Room", "Family Room", "Suite Room"]));

export function RoomNumbersPage() {
  const [rooms, setRooms] = useState(initialRooms);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [occupancyFilter, setOccupancyFilter] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<RoomNumber>(blankRoom);
  const [error, setError] = useState("");

  const filtered = useMemo(() => rooms.filter((room) =>
    room.number.toLowerCase().includes(query.trim().toLowerCase()) &&
    (!typeFilter || room.type === typeFilter) &&
    (!statusFilter || room.status === statusFilter) &&
    (!occupancyFilter || room.occupancy === occupancyFilter)
  ), [rooms, query, typeFilter, statusFilter, occupancyFilter]);

  function openModal(room?: RoomNumber) {
    setEditing(room?.number ?? "");
    setDraft(room ? { ...room } : { ...blankRoom });
    setError("");
  }

  function saveRoom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const number = draft.number.trim();
    if (!number || !draft.type) return setError("Room number dan room type wajib diisi.");
    if (rooms.some((room) => room.number === number && room.number !== editing)) return setError("Room number sudah digunakan.");
    const updated = { ...draft, number, floor: draft.floor.trim(), note: draft.note.trim() };
    setRooms((current) => editing ? current.map((room) => room.number === editing ? updated : room) : [...current, updated]);
    setEditing(null);
  }

  return <AdminShell title="Rooms" context="Room Numbers">
    <div className="room-numbers-page">
      <div className="room-numbers-heading">
        <div><h1>Room Numbers</h1><p>Kelola kamar fisik yang digunakan saat check-in</p></div>
        <button className="action-button" type="button" onClick={() => openModal()}>＋ Add Room Number</button>
      </div>

      <div className="room-numbers-filters">
        <label className="room-types-search"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search room number..." aria-label="Search room number" /></label>
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Filter room type"><option value="">Room Type: All Room Types</option>{roomTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter status"><option value="">Status: All Status</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select>
        <select value={occupancyFilter} onChange={(event) => setOccupancyFilter(event.target.value)} aria-label="Filter occupancy"><option value="">Occupancy: All</option><option>Available</option><option>Occupied</option></select>
        <button type="button" className="room-types-reset" onClick={() => { setQuery(""); setTypeFilter(""); setStatusFilter(""); setOccupancyFilter(""); }}>Reset</button>
        <span className="room-types-total"><strong>{rooms.length}</strong> Room Numbers Total</span>
      </div>

      <section className="room-numbers-table-wrap">
        <div className="room-types-table-scroll"><table className="room-numbers-table"><thead><tr><th>ROOM NUMBER</th><th>ROOM TYPE</th><th>FLOOR</th><th>OCCUPANCY</th><th>OPERATIONAL STATUS</th><th>ACTION</th></tr></thead><tbody>
          {filtered.map((room) => <tr key={room.number}><td className="room-numbers-number">{room.number}</td><td>{room.type}</td><td>{room.floor || "—"}</td><td><span className={`room-numbers-badge room-numbers-badge--${room.occupancy.toLowerCase()}`}>{room.occupancy}</span></td><td><span className={`room-numbers-badge room-numbers-badge--${room.status.toLowerCase()}`}>{room.status}</span></td><td><button className="room-types-edit-link" type="button" onClick={() => openModal(room)}>Edit</button></td></tr>)}
          {filtered.length === 0 && <tr><td colSpan={6} className="room-types-empty">Tidak ada kamar yang cocok.</td></tr>}
        </tbody></table></div>
        <div className="room-numbers-table-footer"><span>Showing <strong>{filtered.length ? `1–${filtered.length}` : "0"}</strong> of <strong>{filtered.length}</strong> room numbers</span><div><button disabled type="button">‹ Previous</button><span>1</span><button disabled type="button">Next ›</button></div></div>
      </section>
    </div>

    {editing !== null && <div className="room-numbers-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}><form className="room-numbers-modal" onSubmit={saveRoom}>
      <div className="room-numbers-modal-head"><div><h2>{editing ? "Edit Room Number" : "Add Room Number"}</h2><p>{editing ? "Perbarui informasi kamar fisik" : "Tambahkan kamar fisik baru"}</p></div><button type="button" aria-label="Close modal" onClick={() => setEditing(null)}>×</button></div>
      <div className="room-numbers-modal-body">
        {editing && <div className="room-numbers-occupancy"><div><strong>Current Occupancy</strong><small>Status okupansi dikelola otomatis oleh sistem reservasi &amp; check-in.</small></div><span className={`room-numbers-badge room-numbers-badge--${draft.occupancy.toLowerCase()}`}>{draft.occupancy}</span></div>}
        <div className="room-numbers-fields"><label>Room Number <b>*</b><input value={draft.number} onChange={(event) => setDraft({ ...draft, number: event.target.value })} placeholder="e.g. 101" required /><small>Nomor unik kamar fisik</small></label><label>Floor / Area <em>(Optional)</em><input value={draft.floor} onChange={(event) => setDraft({ ...draft, floor: event.target.value })} placeholder="e.g. Floor 2, Villa Area" /><small>Lokasi lantai atau blok</small></label></div>
        <label>Room Type <b>*</b><select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })} required><option value="">Select room type</option>{roomTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
        <fieldset><legend>Operational Status <b>*</b></legend><div className="room-numbers-status-options">{statuses.map((status) => <label key={status}><input type="radio" name="operationalStatus" checked={draft.status === status} onChange={() => setDraft({ ...draft, status })} />{status}</label>)}</div><small>{draft.status === "Active" ? "Active: Kamar siap dialokasikan dan tersedia saat proses check-in tamu." : draft.status === "Maintenance" ? "Maintenance: Kamar sedang dalam perawatan." : "Inactive: Kamar tidak tersedia untuk dialokasikan."}</small></fieldset>
        <label>Internal Note <em>(Optional)</em><textarea rows={2} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="Catatan internal staf front office atau housekeeping..." /></label>
        {error && <p className="room-numbers-error" role="alert">{error}</p>}
      </div>
      <div className="room-numbers-modal-footer"><button type="button" onClick={() => setEditing(null)}>Cancel</button><button type="submit" className="action-button">✓ {editing ? "Save Changes" : "Add Room Number"}</button></div>
    </form></div>}
  </AdminShell>;
}
