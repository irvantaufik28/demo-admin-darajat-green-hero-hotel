"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { getCurrentUser } from "../../../lib/auth";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";
import {
  getRoomAssignmentOptions,
  unassignReservationRoom,
} from "../services/room-assignment";

type Props = {
  reservationId: string;
  reservationRoomId: string;
  roomNumber: string;
  onUpdated: (message: string) => Promise<void>;
};

export function RoomRackUnassignRoom({
  reservationId,
  reservationRoomId,
  roomNumber,
  onUpdated,
}: Props) {
  const { t } = useTranslations({ en, id });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const allowed =
    getCurrentUser()?.permissions.includes("reservations.assign_room") ?? false;

  async function save() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const options = await getRoomAssignmentOptions(
        reservationId,
        reservationRoomId,
      );
      await unassignReservationRoom(
        reservationId,
        reservationRoomId,
        options.reservation.version,
        t("assignRoom.unassignReason"),
      );
      setOpen(false);
      await onUpdated(t("assignRoom.unassignSuccess", { roomNumber }));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("assignRoom.errors.unassignFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="reservation-secondary-button"
        disabled={!allowed}
        title={allowed ? undefined : t("assignRoom.noPermissionTitle")}
        onClick={() => setOpen(true)}
      >
        {t("assignRoom.unassignButton")}
      </button>
      {open &&
        createPortal(
          <div
            className="reservation-operation-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !saving)
                setOpen(false);
            }}
          >
            <section
              className="reservation-operation-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="rr-unassign-room-title"
            >
              <div className="reservation-operation-header">
                <h2 id="rr-unassign-room-title">
                  {t("assignRoom.unassignTitle")}
                </h2>
                <button
                  type="button"
                  disabled={saving}
                  aria-label={t("common.closeModal")}
                  onClick={() => setOpen(false)}
                >
                  ×
                </button>
              </div>
              <div className="api-reservation-modal-body">
                <p>{t("assignRoom.unassignConfirmation", { roomNumber })}</p>
                {error && (
                  <p className="api-reservation-error" role="alert">
                    {error}
                  </p>
                )}
              </div>
              <div className="api-reservation-modal-footer">
                <button
                  type="button"
                  className="reservation-secondary-button"
                  disabled={saving}
                  onClick={() => setOpen(false)}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  className="action-button"
                  disabled={saving}
                  onClick={() => void save()}
                >
                  {saving
                    ? t("common.saving")
                    : t("assignRoom.unassignConfirm")}
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
