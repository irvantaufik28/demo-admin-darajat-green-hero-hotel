"use client";
import { useEffect, useState } from "react";
import { markRoomAvailable } from "../services/room-rack";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

type CleaningRoom = {
  id: string;
  number: string;
  groupName: string;
};

export function RoomRackCleaningModal({
  room,
  onClose,
  onSaved,
}: {
  room: CleaningRoom;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslations({ en, id });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, saving]);

  async function confirm() {
    setSaving(true);
    setError("");
    try {
      await markRoomAvailable(room.id);
      onSaved();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t("cleaningModal.error"),
      );
      setSaving(false);
    }
  }

  return (
    <div
      className="rr-cleaning-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div
        className="rr-cleaning-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rr-cleaning-title"
      >
        <div className="rr-cleaning-modal__header">
          <div>
            <span className="rr-cleaning-modal__eyebrow">{t("cleaningModal.eyebrow")}</span>
            <h2 id="rr-cleaning-title">{t("cleaningModal.roomTitle", { number: room.number })}</h2>
          </div>
          <button
            type="button"
            className="rr-cleaning-modal__close"
            onClick={onClose}
            disabled={saving}
            aria-label={t("cleaningModal.close")}
          >
            ×
          </button>
        </div>
        <div className="rr-cleaning-modal__body">
          <p className="rr-cleaning-modal__type">{room.groupName}</p>
          <div className="rr-cleaning-modal__transition">
            <span className="rr-cleaning-modal__status rr-cleaning-modal__status--cleaning">
              {t("cleaningModal.cleaning")}
            </span>
            <span aria-hidden="true">→</span>
            <span className="rr-cleaning-modal__status rr-cleaning-modal__status--available">
              {t("cleaningModal.available")}
            </span>
          </div>
          <p>
            {t("cleaningModal.description")}
          </p>
          {error && (
            <p className="rr-cleaning-modal__error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="rr-cleaning-modal__actions">
          <button
            type="button"
            className="rr-cleaning-modal__cancel"
            onClick={onClose}
            disabled={saving}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="rr-cleaning-modal__confirm"
            onClick={confirm}
            disabled={saving}
          >
            {saving ? t("common.saving") : t("cleaningModal.markAsAvailable")}
          </button>
        </div>
      </div>
    </div>
  );
}
