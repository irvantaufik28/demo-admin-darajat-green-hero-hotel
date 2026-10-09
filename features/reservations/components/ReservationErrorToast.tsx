"use client";

import { useEffect } from "react";

export function ReservationErrorToast({
  message,
  title,
  closeLabel,
  onClose,
}: {
  message: string;
  title: string;
  closeLabel: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 8000);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);

  return (
    <div className="reservation-error-toast" role="alert" aria-live="assertive">
      <span className="reservation-error-toast__icon" aria-hidden="true">
        !
      </span>
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      <button type="button" onClick={onClose} aria-label={closeLabel}>
        ×
      </button>
    </div>
  );
}
