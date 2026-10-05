"use client";

import { useEffect } from "react";
import { formatRupiah } from "../constants/walk-in-data";
import type { CheckInContext, EarlyCheckInInput } from "../services/api";
import { EarlyCheckInFields } from "./EarlyCheckInFields";

type Props = {
  guestName: string;
  action: "save" | "check-in";
  total: number;
  rooms: number;
  nights: number;
  onCancel: () => void;
  onConfirm: () => void;
  outstandingBalance?: number;
  acknowledged?: boolean;
  onAcknowledgedChange?: (value: boolean) => void;
  busy?: boolean;
  checkInContext?: CheckInContext | null;
  earlyCheckIn?: EarlyCheckInInput;
  onEarlyCheckInChange?: (value: EarlyCheckInInput) => void;
  paymentMethods?: { id: string; name: string }[];
  error?: string;
};

export function SaveReservationConfirmation({
  guestName,
  action,
  total,
  rooms,
  nights,
  onCancel,
  onConfirm,
  outstandingBalance = 0,
  acknowledged = false,
  onAcknowledgedChange,
  busy = false,
  checkInContext,
  earlyCheckIn,
  onEarlyCheckInChange,
  paymentMethods = [],
  error,
}: Props) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onCancel]);

  const checkIn = action === "check-in";
  return (
    <div
      className="reservation-operation-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        className="reservation-operation-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-reservation-title"
      >
        <div className="reservation-operation-header">
          <h2 id="save-reservation-title">
            {checkIn ? "Confirm Save & Check-in" : "Confirm Save Reservation"}
          </h2>
          <button type="button" onClick={onCancel} aria-label="Close modal">
            ×
          </button>
        </div>
        <div className="reservation-operation-body">
          <p className="reservation-save-confirmation-copy">
            {checkIn
              ? "Simpan reservasi dan lakukan check-in tamu ini?"
              : "Simpan reservasi tamu ini?"}
          </p>
          <div className="reservation-operation-context">
            <div>
              <strong>{guestName.trim() || "Nama tamu belum diisi"}</strong>
              <span>
                {rooms} kamar · {nights} malam
              </span>
            </div>
            <small>
              Booking total {formatRupiah(total + (checkIn && checkInContext?.required ? earlyCheckIn?.chargeAmount ?? 0 : 0))}
              {checkIn && checkInContext?.required && (earlyCheckIn?.chargeAmount ?? 0) > 0 ? " termasuk biaya early check-in" : ""}
            </small>
          </div>
          {checkIn && outstandingBalance > 0 && onAcknowledgedChange && (
            <label className="partial-check-in-confirmation">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => onAcknowledgedChange(event.target.checked)}
              />
              <span>
                Saya mengonfirmasi sisa tagihan{" "}
                <strong>{formatRupiah(outstandingBalance)}</strong> telah
                dijelaskan kepada tamu. Jika belum lunas saat check-out, petugas
                wajib mencatat konfirmasi dan alasan.
              </span>
            </label>
          )}
          {checkIn && checkInContext?.required && earlyCheckIn && onEarlyCheckInChange && (
            <EarlyCheckInFields context={checkInContext} value={earlyCheckIn} onChange={onEarlyCheckInChange} methods={paymentMethods} />
          )}
          {error && <p className="reservation-operation-error" role="alert">{error}</p>}
        </div>
        <div className="reservation-operation-actions">
          <button
            type="button"
            className="reservation-secondary-button"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="action-button"
            disabled={
              busy || (checkIn && (!checkInContext || (outstandingBalance > 0 && !acknowledged) || (checkInContext.required && (!earlyCheckIn?.acknowledged || (earlyCheckIn.chargeAmount > 0 && earlyCheckIn.paymentTiming === "now" && !earlyCheckIn.paymentMethodId)))))
            }
            onClick={onConfirm}
          >
            {busy
              ? "Menyimpan..."
              : checkIn
                ? "Confirm Save & Check-in"
                : "Confirm Save Reservation"}
          </button>
        </div>
      </section>
    </div>
  );
}
