"use client";

import { useEffect, useState } from "react";
import { formatRupiah } from "../constants/walk-in-data";
import {
  recordReservationPayment,
  type ReservationDetail,
} from "../constants/reservation-detail-data";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

type Props = {
  reservation: ReservationDetail;
  onUpdate: (reservation: ReservationDetail, message: string) => void;
};

const methods = [
  "Bank Transfer (BCA)",
  "Bank Transfer (Mandiri)",
  "QRIS",
  "Payment Gateway",
  "Cash",
];

function parseCurrency(value: string) {
  return Number(value.replace(/\D/g, "")) || 0;
}

export function RecordOutstandingPayment({ reservation, onUpdate }: Props) {
  const { t } = useTranslations({ en, id });
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState(methods[0]);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
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

  function showDialog() {
    setAmount(balance);
    setMethod(methods[0]);
    setReference("");
    setNote("");
    setError("");
    setOpen(true);
  }

  function savePayment() {
    if (amount <= 0 || amount > balance) {
      setError(
        t("recordPayment.errors.invalidAmount"),
      );
      return;
    }
    const updated = recordReservationPayment(
      reservation.bookingId,
      amount,
      method,
      reference,
      note,
    );
    if (!updated) {
      setError(t("recordPayment.errors.saveFailed"));
      return;
    }
    setOpen(false);
    onUpdate(
      updated,
      updated.paymentStatus === "Paid"
        ? updated.status === "Checked-in"
          ? t("recordPayment.success.paidCanCheckOut")
          : updated.status === "Checked-out"
            ? t("recordPayment.success.paidAfterCheckOut")
            : t("recordPayment.success.paidSameStatus")
        : t("recordPayment.success.partial"),
    );
  }

  return (
    <>
      <button
        type="button"
        className="action-button reservation-detail-main-action"
        onClick={showDialog}
      >
        {t("recordPayment.button")}
      </button>
      <p className="reservation-detail-summary-hint">
        {t("recordPayment.hint", {
          balance: formatRupiah(balance),
          followUp: reservation.status === "Checked-out" ? t("recordPayment.hintCheckedOut") : t("recordPayment.hintDefault"),
        })}
      </p>
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
            aria-labelledby="outstanding-payment-title"
          >
            <div className="reservation-operation-header">
              <h2 id="outstanding-payment-title">{t("recordPayment.modalTitle")}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("common.closeModal")}
              >
                ×
              </button>
            </div>
            <div className="pending-detail-modal-body">
              <div className="reservation-operation-context">
                <div>
                  <strong>{reservation.guestName}</strong>
                  <span>{t("recordPayment.remainingBalance", { balance: formatRupiah(balance) })}</span>
                </div>
              </div>
              <label>
                {t("recordPayment.amountLabel")}
                <input
                  inputMode="numeric"
                  value={formatRupiah(amount)}
                  onChange={(event) =>
                    setAmount(parseCurrency(event.target.value))
                  }
                />
              </label>
              <label>
                {t("recordPayment.methodLabel")}
                <select
                  value={method}
                  onChange={(event) => setMethod(event.target.value)}
                >
                  {methods.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                {t("recordPayment.referenceLabel")}
                <input
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                />
              </label>
              <label>
                {t("recordPayment.noteLabel")}
                <textarea
                  rows={2}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
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
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="action-button"
                onClick={savePayment}
              >
                {t("recordPayment.savePayment")}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
