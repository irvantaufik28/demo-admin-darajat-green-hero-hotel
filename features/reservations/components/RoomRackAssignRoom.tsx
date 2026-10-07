"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getCurrentUser } from "../../../lib/auth";
import {
  assignReservationRoom,
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
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : t("assignRoom.errors.optionsLoadError"));
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
      await onUpdated(t("assignRoom.success", { roomNumber: selected.roomNumber }));
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
                      <strong>{options.room.roomTypeName}</strong>
                    </div>
                    <div>
                      <small>{t("assignRoom.stayPeriod")}</small>
                      <strong>{dateLabel(options.reservation.checkInDate)} → {dateLabel(options.reservation.checkOutDate)}</strong>
                    </div>
                  </div>
                  <p className="rr-assign-room-hint">{t("assignRoom.hint")}</p>
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
                          <strong>{t("assignRoom.roomLabel", { roomNumber: option.roomNumber })}</strong>
                          <small>{[option.floorName, option.bedConfiguration].filter(Boolean).join(" · ") || t("assignRoom.roomUnitFallback")}</small>
                        </span>
                        <span className="rr-assign-room-option__status">{t("assignRoom.available")}</span>
                      </label>
                    ))}
                    {availableOptions.length === 0 && <p className="rr-assign-room-empty">{t("assignRoom.empty")}</p>}
                  </div>
                </>
              )}
              {error && <p className="api-reservation-error" role="alert">{error}</p>}
            </div>
            <div className="api-reservation-modal-footer">
              <button type="button" className="reservation-secondary-button" disabled={saving} onClick={() => setOpen(false)}>{t("common.cancel")}</button>
              <button type="button" className="action-button" disabled={!options || !selectedRoomUnitId || loading || saving} onClick={() => void save()}>
                {saving ? t("common.saving") : t("assignRoom.saveAssignment")}
              </button>
            </div>
          </section>
        </div>, document.body)}
    </>
  );
}
