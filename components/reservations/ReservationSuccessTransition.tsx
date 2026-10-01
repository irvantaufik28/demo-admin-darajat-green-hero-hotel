"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function ReservationSuccessTransition({ bookingId, checkedIn }: { bookingId: string; checkedIn: boolean }) {
  const router = useRouter();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => router.push("/reservations"), 1500);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
    };
  }, [router]);

  return (
    <div className="reservation-operation-backdrop">
      <section className="reservation-operation-modal reservation-success-modal" role="status" aria-live="polite">
        <span className="reservation-success-icon" aria-hidden="true">✓</span>
        <h2>{checkedIn ? "Reservasi & check-in berhasil" : "Reservasi berhasil disimpan"}</h2>
        <p>Booking ID <strong>{bookingId}</strong></p>
        <div className="reservation-success-loading"><span className="button-spinner" aria-hidden="true" /> Membuka daftar reservasi...</div>
      </section>
    </div>
  );
}
