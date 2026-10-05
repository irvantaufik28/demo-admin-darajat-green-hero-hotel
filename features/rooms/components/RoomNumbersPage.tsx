"use client";

import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { useEffect, useState, type FormEvent } from "react";
import { AdminShell } from "../../../components/layout/AdminShell";
import { restoreSession } from "../../../lib/auth";
import {
  createRoomNumber,
  getRoomNumberOptions,
  getRoomNumbers,
  updateRoomNumber,
  type FloorOption,
  type RoomNumber,
  type RoomNumberInput,
  type RoomOperationalStatus,
  type RoomTypeOption,
} from "../services/room-numbers";

const pageSize = 20;
const statusLabels: Record<RoomOperationalStatus, string> = {
  available: "Available",
  occupied: "Occupied",
  cleaning: "Cleaning",
  maintenance: "Maintenance",
  out_of_service: "Out of Service",
};
const statuses = Object.keys(statusLabels) as RoomOperationalStatus[];

type Draft = RoomNumberInput & { note: string };

const blankDraft: Draft = {
  roomNumber: "",
  roomTypeId: "",
  floorId: null,
  operationalStatus: "available",
  isActive: true,
  note: "",
};

function occupancy(room: Pick<RoomNumber, "operationalStatus" | "isActive">) {
  if (room.operationalStatus === "occupied") return "Occupied";
  return room.isActive && room.operationalStatus === "available"
    ? "Available"
    : "Unavailable";
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Permintaan gagal. Coba lagi.";
}

export function RoomNumbersPage() {
  const [rooms, setRooms] = useState<RoomNumber[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomTypeOption[]>([]);
  const [floors, setFloors] = useState<FloorOption[]>([]);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [occupancyFilter, setOccupancyFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [editingOccupied, setEditingOccupied] = useState(false);
  const [draft, setDraft] = useState<Draft>(blankDraft);

  useEffect(() => {
    const controller = new AbortController();
    async function loadOptions() {
      setLoadError("");
      try {
        if (!(await restoreSession())) return;
        const [types, floorList] = await getRoomNumberOptions(
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setRoomTypes(types.items);
        setFloors(floorList.items);
        setReady(true);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setLoadError(errorMessage(cause));
          setLoading(false);
        }
      }
    }
    void loadOptions();
    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(query.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    async function loadRooms() {
      setLoading(true);
      setLoadError("");
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (search) params.set("search", search);
      if (typeFilter) params.set("roomTypeId", typeFilter);
      if (occupancyFilter)
        params.set("occupancy", occupancyFilter.toLowerCase());
      if (statusFilter === "inactive") params.set("isActive", "false");
      else if (statusFilter) {
        params.set("isActive", "true");
        params.set("operationalStatus", statusFilter);
      }
      try {
        const response = await getRoomNumbers(params, controller.signal);
        if (controller.signal.aborted) return;
        setRooms(response.items);
        setTotal(response.total);
      } catch (cause) {
        if (!controller.signal.aborted) setLoadError(errorMessage(cause));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadRooms();
    return () => controller.abort();
  }, [
    ready,
    page,
    search,
    typeFilter,
    statusFilter,
    occupancyFilter,
    reloadKey,
  ]);

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  function openModal(room?: RoomNumber) {
    setEditing(room?.id ?? "");
    setEditingOccupied(room?.operationalStatus === "occupied");
    setDraft(
      room
        ? {
            roomNumber: room.roomNumber,
            roomTypeId: room.roomTypeId,
            floorId: room.floorId,
            operationalStatus: room.operationalStatus,
            isActive: room.isActive,
            note: "",
          }
        : { ...blankDraft },
    );
    setError("");
  }

  async function saveRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingOccupied) {
      setError(
        "Kamar masih ditempati tamu. Perubahan dapat disimpan setelah check-out.",
      );
      return;
    }
    if (!draft.roomNumber.trim() || !draft.roomTypeId) {
      setError("Room number dan room type wajib diisi.");
      return;
    }
    setSaving(true);
    setError("");
    const body: RoomNumberInput = {
      roomNumber: draft.roomNumber.trim(),
      roomTypeId: draft.roomTypeId,
      floorId: draft.floorId,
      operationalStatus: draft.operationalStatus,
      isActive: draft.isActive,
    };
    try {
      if (editing) await updateRoomNumber(editing, body);
      else await createRoomNumber(body);
      setEditing(null);
      setReloadKey((key) => key + 1);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell title="Rooms" context="Room Numbers">
      <div className="room-numbers-page">
        <div className="room-numbers-heading">
          <div>
            <h1>Room Numbers</h1>
            <p>Kelola kamar fisik yang digunakan saat check-in</p>
          </div>
          <button
            className="action-button"
            type="button"
            onClick={() => openModal()}
          >
            ＋ Add Room Number
          </button>
        </div>

        <div className="room-numbers-filters">
          <label className="room-types-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search room number..."
              aria-label="Search room number"
            />
          </label>
          <select
            value={typeFilter}
            onChange={(event) => {
              setTypeFilter(event.target.value);
              setPage(1);
            }}
            aria-label="Filter room type"
          >
            <option value="">Room Type: All Room Types</option>
            {roomTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            aria-label="Filter status"
          >
            <option value="">Status: All Status</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
            <option value="inactive">Inactive</option>
          </select>
          <select
            value={occupancyFilter}
            onChange={(event) => {
              setOccupancyFilter(event.target.value);
              setPage(1);
            }}
            aria-label="Filter occupancy"
          >
            <option value="">Occupancy: All</option>
            <option>Available</option>
            <option>Occupied</option>
          </select>
          <button
            type="button"
            className="room-types-reset"
            onClick={() => {
              setQuery("");
              setTypeFilter("");
              setStatusFilter("");
              setOccupancyFilter("");
              setPage(1);
            }}
          >
            Reset
          </button>
          <span className="room-types-total">
            <strong>{total}</strong> Room Numbers Total
          </span>
        </div>

        <section className="room-numbers-table-wrap">
          {loadError && (
            <p className="room-numbers-error" role="alert">
              {loadError}{" "}
              <button
                type="button"
                onClick={() => setReloadKey((key) => key + 1)}
              >
                Coba lagi
              </button>
            </p>
          )}
          <div className="room-types-table-scroll">
            <table className="room-numbers-table">
              <thead>
                <tr>
                  <th>ROOM NUMBER</th>
                  <th>ROOM TYPE</th>
                  <th>FLOOR</th>
                  <th>OCCUPANCY</th>
                  <th>OPERATIONAL STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {!loading && rooms.map((room) => (
                  <tr key={room.id}>
                    <td className="room-numbers-number">{room.roomNumber}</td>
                    <td>{room.roomTypeName}</td>
                    <td>{room.floorName || "—"}</td>
                    <td>
                      <span
                        className={`room-numbers-badge room-numbers-badge--${occupancy(room).toLowerCase()}`}
                      >
                        {occupancy(room)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`room-numbers-badge room-numbers-badge--${room.isActive ? room.operationalStatus : "inactive"}`}
                      >
                        {room.isActive
                          ? statusLabels[room.operationalStatus]
                          : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="room-types-edit-link"
                        type="button"
                        onClick={() => openModal(room)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && rooms.length === 0 && (
                  <tr>
                    <td colSpan={6} className="room-types-empty">
                      Tidak ada kamar yang cocok.
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan={6} className="room-types-empty">
                      <LoadingSkeleton />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="room-numbers-table-footer">
            <span>
              Showing{" "}
              <strong>
                {from}–{to}
              </strong>{" "}
              of <strong>{total}</strong> room numbers
            </span>
            <div>
              <button
                disabled={page <= 1 || loading}
                type="button"
                onClick={() => setPage((value) => value - 1)}
              >
                ‹ Previous
              </button>
              <span>{page}</span>
              <button
                disabled={page * pageSize >= total || loading}
                type="button"
                onClick={() => setPage((value) => value + 1)}
              >
                Next ›
              </button>
            </div>
          </div>
        </section>
      </div>

      {editing !== null && (
        <div
          className="room-numbers-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving)
              setEditing(null);
          }}
        >
          <form
            className="room-numbers-modal"
            onSubmit={(event) => void saveRoom(event)}
          >
            <div className="room-numbers-modal-head">
              <div>
                <h2>
                  {editingOccupied
                    ? "Room Number Detail"
                    : editing
                      ? "Edit Room Number"
                      : "Add Room Number"}
                </h2>
                <p>
                  {editingOccupied
                    ? "Kamar sedang ditempati tamu"
                    : editing
                      ? "Perbarui informasi kamar fisik"
                      : "Tambahkan kamar fisik baru"}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close modal"
                disabled={saving}
                onClick={() => setEditing(null)}
              >
                ×
              </button>
            </div>
            <div className="room-numbers-modal-body">
              {editing && (
                <div className="room-numbers-occupancy">
                  <div>
                    <strong>Current Occupancy</strong>
                    <small>
                      Status kamar mengikuti status operasional dan proses
                      check-in.
                    </small>
                  </div>
                  <span
                    className={`room-numbers-badge room-numbers-badge--${editingOccupied ? "occupied" : occupancy(draft).toLowerCase()}`}
                  >
                    {editingOccupied ? "Occupied" : occupancy(draft)}
                  </span>
                </div>
              )}
              {editingOccupied && (
                <p className="room-numbers-occupied-notice" role="status">
                  Kamar masih ditempati tamu. Data kamar hanya dapat dilihat dan
                  baru bisa diubah setelah tamu check-out.
                </p>
              )}
              <fieldset
                className="room-numbers-readonly-fields"
                disabled={editingOccupied}
              >
                <div className="room-numbers-fields">
                  <label>
                    Room Number <b>*</b>
                    <input
                      value={draft.roomNumber}
                      onChange={(event) =>
                        setDraft({ ...draft, roomNumber: event.target.value })
                      }
                      placeholder="e.g. 101"
                      required
                    />
                    <small>Nomor unik kamar fisik</small>
                  </label>
                  <label>
                    Floor / Area <em>(Optional)</em>
                    <select
                      value={draft.floorId ?? ""}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          floorId: event.target.value || null,
                        })
                      }
                    >
                      <option value="">Select floor</option>
                      {floors.map((floor) => (
                        <option key={floor.id} value={floor.id}>
                          {floor.name}
                        </option>
                      ))}
                    </select>
                    <small>Lokasi lantai atau blok</small>
                  </label>
                </div>
                <label>
                  Room Type <b>*</b>
                  <select
                    value={draft.roomTypeId}
                    onChange={(event) =>
                      setDraft({ ...draft, roomTypeId: event.target.value })
                    }
                    required
                  >
                    <option value="">Select room type</option>
                    {roomTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </label>
                <fieldset>
                  <legend>
                    Operational Status <b>*</b>
                  </legend>
                  <div className="room-numbers-status-options">
                    {statuses.map((status) => (
                      <label key={status}>
                        <input
                          type="radio"
                          name="operationalStatus"
                          checked={draft.operationalStatus === status}
                          onChange={() =>
                            setDraft({ ...draft, operationalStatus: status })
                          }
                        />
                        {statusLabels[status]}
                      </label>
                    ))}
                  </div>
                  <small>
                    Hanya kamar berstatus Available yang siap ditetapkan saat
                    check-in.
                  </small>
                </fieldset>
                <label>
                  <span>
                    <input
                      type="checkbox"
                      checked={draft.isActive}
                      onChange={(event) =>
                        setDraft({ ...draft, isActive: event.target.checked })
                      }
                    />{" "}
                    Active room number
                  </span>
                </label>
                <label>
                  Internal Note <em>(Optional)</em>
                  <textarea
                    rows={2}
                    value={draft.note}
                    onChange={(event) =>
                      setDraft({ ...draft, note: event.target.value })
                    }
                    placeholder="Catatan internal staf front office atau housekeeping..."
                  />
                  <small>
                    Catatan internal belum didukung API dan belum disimpan.
                  </small>
                </label>
              </fieldset>
              {error && (
                <p className="room-numbers-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <div className="room-numbers-modal-footer">
              <button
                type="button"
                disabled={saving}
                onClick={() => setEditing(null)}
              >
                {editingOccupied ? "Close" : "Cancel"}
              </button>
              {!editingOccupied && (
                <button
                  type="submit"
                  className="action-button"
                  disabled={saving}
                >
                  ✓{" "}
                  {saving
                    ? "Saving..."
                    : editing
                      ? "Save Changes"
                      : "Add Room Number"}
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </AdminShell>
  );
}
