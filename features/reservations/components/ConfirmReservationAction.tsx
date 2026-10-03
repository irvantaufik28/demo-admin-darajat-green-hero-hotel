"use client";

import { useEffect, useState } from "react";
import { formatRupiah } from "../constants/walk-in-data";
import {
  saveReservationDetail,
  type ReservationDetail,
} from "../constants/reservation-detail-data";
import { isAutoConfirmedSource } from "../constants/reservation-list-data";

type Props = {
  reservation: ReservationDetail;
  onUpdate: (reservation: ReservationDetail, message: string) => void;
};

export function ConfirmReservationAction({ reservation, onUpdate }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const balance = Math.max(
    0,
    (reservation.total ?? 0) - (reservation.amountPaid ?? 0),
  );

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  function confirmReservation() {
    if (reservation.status !== "Pending") {
      setError("Hanya reservasi Pending yang dapat dikonfirmasi.");
      return;
    }
    if (isAutoConfirmedSource(reservation.source)) {
      setError(
        "Reservasi Website dan OTA dikonfirmasi otomatis setelah pembayaran lunas.",
      );
      return;
    }
    const updated = saveReservationDetail(
      reservation.bookingId,
      "Confirmed",
      {},
    );
    if (!updated || updated.status !== "Confirmed") {
      setError("Konfirmasi reservasi tidak dapat disimpan.");
      return;
    }
    setOpen(false);
    onUpdate(
      updated,
      "Reservasi dikonfirmasi. Status pembayaran tetap " +
        updated.paymentStatus +
        ".",
    );
  }

  return (
    <>
      <button
        type="button"
        className="action-button reservation-detail-main-action pending-detail-confirm-action"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        Confirm Reservation
      </button>
      {open && (
        <div
          className="reservation-operation-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            className="reservation-operation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-reservation-title"
          >
            <div className="reservation-operation-header">
              <h2 id="confirm-reservation-title">Confirm Reservation</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>
            <div className="reservation-operation-body">
              <div className="reservation-operation-context">
                <div>
                  <strong>{reservation.guestName}</strong>
                  <span>{reservation.bookingId}</span>
                </div>
                <small>
                  Payment: {reservation.paymentStatus} · Remaining balance:{" "}
                  {formatRupiah(balance)}
                </small>
              </div>
              <p className="reservation-operation-hint">
                Konfirmasi mengubah status reservasi menjadi Confirmed. Status
                pembayaran dan sisa tagihan tetap tercatat.
              </p>
              {error && (
                <p className="reservation-operation-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <div className="reservation-operation-actions">
              <button
                type="button"
                className="reservation-secondary-button"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="action-button"
                onClick={confirmReservation}
              >
                Confirm Reservation
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
