"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

export function ReservationSuccessTransition({
  bookingId,
  checkedIn,
}: {
  bookingId: string;
  checkedIn: boolean;
}) {
  const { t } = useTranslations({ en, id });
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
            ? t("successTransition.checkedInTitle")
            : t("successTransition.savedTitle")}
        </h2>
        <p>
          {t("successTransition.bookingIdLabel")}<strong>{bookingId}</strong>
        </p>
        <button
          type="button"
          className="action-button"
          onClick={() => router.push("/reservations")}
        >
          {t("successTransition.viewList")}
        </button>
      </section>
    </div>
  );
}
