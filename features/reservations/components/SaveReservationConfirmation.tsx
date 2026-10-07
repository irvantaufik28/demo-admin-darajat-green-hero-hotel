"use client";

import { useEffect } from "react";
import { formatRupiah } from "../constants/walk-in-data";
import type { CheckInContext, EarlyCheckInInput } from "../services/api";
import { EarlyCheckInFields } from "./EarlyCheckInFields";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

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
  const { t } = useTranslations({ en, id });
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
            {checkIn ? t("saveConfirmation.checkInTitle") : t("saveConfirmation.saveTitle")}
          </h2>
          <button type="button" onClick={onCancel} aria-label={t("common.closeModal")}>
            ×
          </button>
        </div>
        <div className="reservation-operation-body">
          <p className="reservation-save-confirmation-copy">
            {checkIn
              ? t("saveConfirmation.checkInCopy")
              : t("saveConfirmation.saveCopy")}
          </p>
          <div className="reservation-operation-context">
            <div>
              <strong>{guestName.trim() || t("saveConfirmation.guestNamePlaceholder")}</strong>
              <span>
                {t("saveConfirmation.roomsNights", { rooms, nights })}
              </span>
            </div>
            <small>
              {t("saveConfirmation.bookingTotal", { amount: formatRupiah(total + (checkIn && checkInContext?.required ? earlyCheckIn?.chargeAmount ?? 0 : 0)) })}
              {checkIn && checkInContext?.required && (earlyCheckIn?.chargeAmount ?? 0) > 0 ? t("saveConfirmation.includingEarlyCheckIn") : ""}
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
                {t("saveConfirmation.balanceAcknowledgement", { amount: formatRupiah(outstandingBalance) })}
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
            {t("common.cancel")}
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
              ? t("common.saving")
              : checkIn
                ? t("saveConfirmation.checkInButton")
                : t("saveConfirmation.saveButton")}
          </button>
        </div>
      </section>
    </div>
  );
}
