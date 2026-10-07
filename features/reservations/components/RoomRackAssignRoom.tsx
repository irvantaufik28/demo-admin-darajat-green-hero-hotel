"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getCurrentUser } from "../../../lib/auth";
import {
  assignReservationRoom,
  getRoomAssignmentOptions,
  type RoomAssignmentOptions,
} from "../services/room-assignment";

type Props = {
  reservationId: string;
  reservationRoomId: string;
  onUpdated: (message: string) => Promise<void>;
};

function dateLabel(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function RoomRackAssignRoom({ reservationId, reservationRoomId, onUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<RoomAssignmentOptions | null>(null);
  const [selectedRoomUnitId, setSelectedRoomUnitId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const allowed = getCurrentUser()?.permissions.includes("reservations.assign_room") ?? false;
  const availableOptions = options?.options.filter((option) => option.canAssign) ?? [];

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setOptions(null);
    setSelectedRoomUnitId("");
    setError("");
    setLoading(true);
    getRoomAssignmentOptions(reservationId, reservationRoomId, controller.signal)
      .then((response) => { if (!controller.signal.aborted) setOptions(response); })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Pilihan kamar gagal dimuat.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, reservationId, reservationRoomId]);

  async function save() {
    if (!options || !selectedRoomUnitId || saving) return;
    const selected = options.options.find((option) => option.id === selectedRoomUnitId);
    if (!selected?.canAssign) return;
    setSaving(true);
    setError("");
    try {
      await assignReservationRoom(
        reservationId,
        reservationRoomId,
        selectedRoomUnitId,
        options.reservation.version,
      );
      setOpen(false);
      await onUpdated(`Room ${selected.roomNumber} berhasil ditetapkan. Room Rack diperbarui.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Penetapan kamar gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="action-button"
        disabled={!allowed}
        title={allowed ? undefined : "Anda tidak memiliki izin Assign Room"}
        onClick={() => setOpen(true)}
      >
        Assign Room
      </button>
      {open && createPortal(
        <div className="reservation-operation-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setOpen(false);
        }}>
          <section className="reservation-operation-modal rr-assign-room-modal" role="dialog" aria-modal="true" aria-labelledby="rr-assign-room-title">
            <div className="reservation-operation-header">
              <h2 id="rr-assign-room-title">Assign Room</h2>
              <button type="button" disabled={saving} aria-label="Close modal" onClick={() => setOpen(false)}>×</button>
            </div>
            <div className="api-reservation-modal-body">
              {loading && <p>Loading available rooms...</p>}
              {options && (
                <>
                  <div className="rr-assign-room-context">
                    <div>
                      <small>Reservation</small>
                      <strong>{options.reservation.bookingCode}</strong>
                    </div>
                    <div>
                      <small>Room Type</small>
                      <strong>{options.room.roomTypeName}</strong>
                    </div>
                    <div>
                      <small>Stay Period</small>
                      <strong>{dateLabel(options.reservation.checkInDate)} → {dateLabel(options.reservation.checkOutDate)}</strong>
                    </div>
                  </div>
                  <p className="rr-assign-room-hint">Pilih kamar yang siap digunakan untuk periode menginap ini.</p>
                  <div className="rr-assign-room-options">
                    {availableOptions.map((option) => (
                      <label key={option.id} className="rr-assign-room-option">
                        <input
                          type="radio"
                          name="rr-assign-room-unit"
                          value={option.id}
                          checked={selectedRoomUnitId === option.id}
                          disabled={saving}
                          onChange={() => setSelectedRoomUnitId(option.id)}
                        />
                        <span className="rr-assign-room-option__details">
                          <strong>Room {option.roomNumber}</strong>
                          <small>{[option.floorName, option.bedConfiguration].filter(Boolean).join(" · ") || "Room unit"}</small>
                        </span>
                        <span className="rr-assign-room-option__status">Available</span>
                      </label>
                    ))}
                    {availableOptions.length === 0 && <p className="rr-assign-room-empty">Tidak ada kamar yang tersedia untuk periode menginap ini.</p>}
                  </div>
                </>
              )}
              {error && <p className="api-reservation-error" role="alert">{error}</p>}
            </div>
            <div className="api-reservation-modal-footer">
              <button type="button" className="reservation-secondary-button" disabled={saving} onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" className="action-button" disabled={!options || !selectedRoomUnitId || loading || saving} onClick={() => void save()}>
                {saving ? "Saving..." : "Save Assignment"}
              </button>
            </div>
          </section>
        </div>, document.body)}
    </>
  );
}
