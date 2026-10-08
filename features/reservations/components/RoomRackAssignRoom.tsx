"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getCurrentUser } from "../../../lib/auth";
import {
  assignReservationRoomsByType,
  getRoomAssignmentOptions,
  type RoomAssignmentOptions,
} from "../services/room-assignment";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

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
  const { t } = useTranslations({ en, id });
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<RoomAssignmentOptions | null>(null);
  const [selectedRoomUnitIds, setSelectedRoomUnitIds] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const allowed = getCurrentUser()?.permissions.includes("reservations.assign_room") ?? false;
  const availableOptions = options?.options.filter((option) => option.canAssign) ?? [];
  const unassignedRooms = options?.rooms ?? [];
  const allSelected = unassignedRooms.length > 0 && unassignedRooms.every((room) => selectedRoomUnitIds[room.id]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setOptions(null);
    setSelectedRoomUnitIds({});
    setError("");
    setLoading(true);
    getRoomAssignmentOptions(reservationId, reservationRoomId, controller.signal)
      .then((response) => { if (!controller.signal.aborted) setOptions(response); })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : t("assignRoom.errors.optionsLoadError"));
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, reservationId, reservationRoomId]);

  async function save() {
    if (!options || !allSelected || saving) return;
    const assignments = unassignedRooms.map((room) => ({
      reservationRoomId: room.id,
      roomUnitId: selectedRoomUnitIds[room.id],
    }));
    if (new Set(assignments.map((item) => item.roomUnitId)).size !== assignments.length) return;
    setSaving(true);
    setError("");
    try {
      await assignReservationRoomsByType(
        reservationId,
        reservationRoomId,
        assignments,
        options.reservation.version,
      );
      setOpen(false);
      await onUpdated(t("assignRoom.successBatch", { count: assignments.length }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("assignRoom.errors.saveFailed"));
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
        title={allowed ? undefined : t("assignRoom.noPermissionTitle")}
        onClick={() => setOpen(true)}
      >
        {t("assignRoom.button")}
      </button>
      {open && createPortal(
        <div className="reservation-operation-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setOpen(false);
        }}>
          <section className="reservation-operation-modal rr-assign-room-modal" role="dialog" aria-modal="true" aria-labelledby="rr-assign-room-title">
            <div className="reservation-operation-header">
              <h2 id="rr-assign-room-title">{t("assignRoom.title")}</h2>
              <button type="button" disabled={saving} aria-label={t("common.closeModal")} onClick={() => setOpen(false)}>×</button>
            </div>
            <div className="api-reservation-modal-body">
              {loading && <p>{t("assignRoom.loading")}</p>}
              {options && (
                <>
                  <div className="rr-assign-room-context">
                    <div>
                      <small>{t("assignRoom.reservation")}</small>
                      <strong>{options.reservation.bookingCode}</strong>
                    </div>
                    <div>
                      <small>{t("assignRoom.roomType")}</small>
                      <strong>{options.room.roomTypeName} · {t("assignRoom.roomCount", { count: unassignedRooms.length })}</strong>
                    </div>
                    <div>
                      <small>{t("assignRoom.stayPeriod")}</small>
                      <strong>{dateLabel(options.reservation.checkInDate)} → {dateLabel(options.reservation.checkOutDate)}</strong>
                    </div>
                  </div>
                  <p className="rr-assign-room-hint">{t("assignRoom.hintBatch")}</p>
                  <div className="rr-assign-room-rows">
                    {unassignedRooms.map((room, index) => (
                      <label key={room.id} className="rr-assign-room-row">
                        <span>
                          <strong>{t("assignRoom.roomIndex", { index: index + 1 })}</strong>
                          <small>{t("assignRoom.guestCount", { adults: room.adults, children: room.children })}</small>
                        </span>
                        <select
                          value={selectedRoomUnitIds[room.id] ?? ""}
                          disabled={saving}
                          onChange={(event) => setSelectedRoomUnitIds((current) => ({ ...current, [room.id]: event.target.value }))}
                        >
                          <option value="">{t("assignRoom.selectRoomNumber")}</option>
                          {availableOptions.map((option) => (
                            <option
                              key={option.id}
                              value={option.id}
                              disabled={Object.entries(selectedRoomUnitIds).some(([roomId, unitId]) => roomId !== room.id && unitId === option.id)}
                            >
                              {t("assignRoom.roomLabel", { roomNumber: option.roomNumber })}{option.floorName ? ` · ${option.floorName}` : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                    {availableOptions.length < unassignedRooms.length && <p className="rr-assign-room-empty">{t("assignRoom.insufficient", { available: availableOptions.length, required: unassignedRooms.length })}</p>}
                  </div>
                </>
              )}
              {error && <p className="api-reservation-error" role="alert">{error}</p>}
            </div>
            <div className="api-reservation-modal-footer">
              <button type="button" className="reservation-secondary-button" disabled={saving} onClick={() => setOpen(false)}>{t("common.cancel")}</button>
              <button type="button" className="action-button" disabled={!options || !allSelected || loading || saving} onClick={() => void save()}>
                {saving ? t("common.saving") : t("assignRoom.saveAssignment")}
              </button>
            </div>
          </section>
        </div>, document.body)}
    </>
  );
}
