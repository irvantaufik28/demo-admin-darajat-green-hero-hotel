import { useEffect, useState } from "react";
import { markRoomAvailable } from "../services/room-rack";

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
        cause instanceof Error ? cause.message : "Status kamar gagal diubah.",
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
            <span className="rr-cleaning-modal__eyebrow">Room status</span>
            <h2 id="rr-cleaning-title">Room {room.number}</h2>
          </div>
          <button
            type="button"
            className="rr-cleaning-modal__close"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="rr-cleaning-modal__body">
          <p className="rr-cleaning-modal__type">{room.groupName}</p>
          <div className="rr-cleaning-modal__transition">
            <span className="rr-cleaning-modal__status rr-cleaning-modal__status--cleaning">
              Cleaning
            </span>
            <span aria-hidden="true">→</span>
            <span className="rr-cleaning-modal__status rr-cleaning-modal__status--available">
              Available
            </span>
          </div>
          <p>
            Pastikan kamar sudah selesai dibersihkan dan siap digunakan sebelum
            mengubah statusnya.
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
            Cancel
          </button>
          <button
            type="button"
            className="rr-cleaning-modal__confirm"
            onClick={confirm}
            disabled={saving}
          >
            {saving ? "Saving…" : "Mark as Available"}
          </button>
        </div>
      </div>
    </div>
  );
}
