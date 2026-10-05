"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function ReservationSuccessTransition({
  bookingId,
  checkedIn,
}: {
  bookingId: string;
  checkedIn: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="reservation-operation-backdrop">
      <section
        className="reservation-operation-modal reservation-success-modal"
        role="status"
        aria-live="polite"
      >
        <span className="reservation-success-icon" aria-hidden="true">
          ✓
        </span>
        <h2>
          {checkedIn
            ? "Reservasi & check-in berhasil"
            : "Reservasi berhasil disimpan"}
        </h2>
        <p>
          Booking ID <strong>{bookingId}</strong>
        </p>
        <button
          type="button"
          className="action-button"
          onClick={() => router.push("/reservations")}
        >
          Lihat daftar reservasi
        </button>
      </section>
    </div>
  );
}
