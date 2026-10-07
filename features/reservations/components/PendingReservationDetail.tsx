"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { AdminShell } from "../../../components/layout/AdminShell";
import {
  calculateNights,
  extraBedRates,
  extras,
  formatRupiah,
  formatStayDate,
  getExtraCost,
  getRoomExtraBedsTotal,
  roomTypes,
} from "../constants/walk-in-data";
import {
  cancelUnpaidReservation,
  recordReservationPayment,
  type ReservationDetail,
} from "../constants/reservation-detail-data";
import { PendingCheckInAction } from "./PendingCheckInAction";
import { ConfirmReservationAction } from "./ConfirmReservationAction";
import { isAutoConfirmedSource } from "../constants/reservation-list-data";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

type Props = {
  reservation: ReservationDetail;
  notice: string;
  onDismissNotice: () => void;
  onUpdate: (reservation: ReservationDetail, message: string) => void;
};

function parseCurrency(value: string) {
  return Number(value.replace(/\D/g, "")) || 0;
}

function dateLabel(value: string) {
  const date = new Date(value + "T00:00:00");
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date);
}

function PendingSection({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="pending-detail-section">
      <div className="pending-detail-section-header">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Pair({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pending-detail-pair">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

const paymentMethods = [
  "Bank Transfer (BCA)",
  "Bank Transfer (Mandiri)",
  "QRIS",
  "Payment Gateway",
  "Cash",
];

export function PendingReservationDetail({
  reservation,
  notice,
  onDismissNotice,
  onUpdate,
}: Props) {
  const { t } = useTranslations({ en, id });
  const [modal, setModal] = useState<"payment" | "release" | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0]);
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [cancellationReason, setCancellationReason] = useState("Guest request");
  const [cancellationNote, setCancellationNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!modal) return;
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setModal(null);
    }
    window.addEventListener("keydown", onEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [modal]);

  const nights = calculateNights(reservation.checkIn, reservation.checkOut);
  const selectedExtras = reservation.selectedExtras ?? [];
  const extrasTotal = selectedExtras.reduce(
    (sum, id) =>
      sum + getExtraCost(id, reservation.extraQuantities?.[id] ?? 1, nights),
    0,
  );
  const extraBedsTotal = getRoomExtraBedsTotal(reservation.roomExtraBeds);
  const total = reservation.total ?? 0;
  const amountPaid = reservation.amountPaid ?? 0;
  const balance = Math.max(0, total - amountPaid);
  const isPending = reservation.status === "Pending";
  const roomTotal = Math.max(0, total - extrasTotal - extraBedsTotal);
  const roomRows = useMemo(() => {
    const selected = roomTypes
      .filter((type) => (reservation.quantities?.[type.id] ?? 0) > 0)
      .map((type) => ({
        type,
        quantity: reservation.quantities?.[type.id] ?? 0,
      }));
    if (selected.length) return selected;
    const fallback =
      roomTypes.find((type) => reservation.room.includes(type.name)) ??
      roomTypes[0];
    return [{ type: fallback, quantity: 1 }];
  }, [reservation.quantities, reservation.room]);
  const roomCount = roomRows.reduce((sum, row) => sum + row.quantity, 0);
  const transactions = reservation.paymentTransactions ?? [];
  const phone = reservation.whatsapp.replace(/\D/g, "").replace(/^0/, "62");
  const whatsappMessage = t("pendingDetail.whatsappMessage", { guest: reservation.guestName, bookingId: reservation.bookingId, balance: formatRupiah(balance) });

  function openPayment() {
    setPaymentAmount(balance);
    setPaymentMethod(paymentMethods[0]);
    setPaymentReference("");
    setPaymentNote("");
    setError("");
    setModal("payment");
  }

  function savePayment() {
    if (paymentAmount <= 0 || paymentAmount > balance) {
      setError(
        t("pendingDetail.errors.invalidAmount"),
      );
      return;
    }
    const updated = recordReservationPayment(
      reservation.bookingId,
      paymentAmount,
      paymentMethod,
      paymentReference,
      paymentNote,
    );
    if (!updated) {
      setError(t("pendingDetail.errors.paymentSaveFailed"));
      return;
    }
    setModal(null);
    onUpdate(
      updated,
      updated.status === "Confirmed" && isPending
        ? t("pendingDetail.success.paidAutoConfirmed")
        : updated.paymentStatus === "Paid"
          ? t("pendingDetail.success.paidSameStatus", { status: updated.status })
          : t("pendingDetail.success.partial", { status: updated.status }),
    );
  }

  function cancelReservation() {
    const updated = cancelUnpaidReservation(
      reservation.bookingId,
      cancellationReason,
      cancellationNote,
    );
    if (!updated) {
      setError(t("pendingDetail.errors.releaseFailed"));
      return;
    }
    setModal(null);
    onUpdate(
      updated,
      t("pendingDetail.success.cancelled"),
    );
  }

  return (
    <AdminShell title={t("shell.title")} context={reservation.bookingId}>
      <div className="pending-detail-page">
        <header className="pending-detail-heading">
          <div>
            <div className="pending-detail-heading-line">
              <h1>{t("pendingDetail.reservationDetail")}</h1>
              <span
                className={
                  "reservations-badge reservations-badge--" +
                  (isPending ? "warning" : "success")
                }
              >
                {reservation.status}
              </span>
              <span
                className={
                  "reservations-badge reservations-badge--" +
                  (reservation.paymentStatus === "Unpaid"
                    ? "danger"
                    : "warning")
                }
              >
                {reservation.paymentStatus}
              </span>
              <span className="reservations-source">
                {reservation.source === "OTA" && reservation.channel
                  ? `OTA · ${reservation.channel}`
                  : reservation.source}
              </span>
            </div>
            <p>
              <strong>{reservation.bookingId}</strong> ·{" "}
              {reservation.source === "Phone"
                ? t("pendingDetail.createdViaPhone")
                : t("pendingDetail.sourcePrefix", { source: reservation.source })}
            </p>
          </div>
          <div className="pending-detail-heading-actions">
            <Link href="/reservations" className="reservation-secondary-button">
              ← {t("pendingDetail.allReservations")}
            </Link>
          </div>
        </header>
        {notice && (
          <div
            className="reservation-feedback reservation-feedback--success"
            role="status"
          >
            {notice}
            <button
              type="button"
              onClick={onDismissNotice}
              aria-label={t("common.closeMessage")}
            >
              ×
            </button>
          </div>
        )}
        {isPending && (
          <div className="pending-detail-hold">
            <div>
              <strong>{t("pendingDetail.holdActive")}</strong>{t("pendingDetail.holdActiveMessage")}
            </div>
            <span>
              {reservation.paymentStatus === "Unpaid"
                ? t("pendingDetail.awaitingPayment")
                : t("pendingDetail.partialPayment")}
            </span>
          </div>
        )}
        <div className="pending-detail-columns">
          <div className="pending-detail-main">
            <PendingSection
              title={t("pendingDetail.guestInformation")}
              aside={
                <span className="pending-detail-section-tag">
                  {t("pendingDetail.primaryContact")}
                </span>
              }
            >
              <div className="pending-detail-guest-grid">
                <div>
                  <small>{t("pendingDetail.fullName")}</small>
                  <strong>{reservation.guestName}</strong>
                </div>
                <div>
                  <small>{t("pendingDetail.whatsappPhone")}</small>
                  <strong>{reservation.whatsapp}</strong>
                </div>
                <div>
                  <small>{t("pendingDetail.emailAddress")}</small>
                  <strong>{reservation.email || t("common.emptyDash")}</strong>
                </div>
              </div>
              {reservation.notes && (
                <div className="pending-detail-notes">
                  <small>{t("pendingDetail.guestNotes")}</small>
                  <p>{reservation.notes}</p>
                </div>
              )}
            </PendingSection>
            <PendingSection
              title={t("pendingDetail.stayDetails")}
              aside={
                <span>
                  {nights === 1 ? t("pendingDetail.nightStay", { nights }) : t("pendingDetail.nightsStay", { nights })}
                </span>
              }
            >
              <div className="pending-detail-stay-grid">
                <div>
                  <small>{t("pendingDetail.checkIn")}</small>
                  <strong>{dateLabel(reservation.checkIn)}</strong>
                  <span>{t("pendingDetail.fromTime")}</span>
                </div>
                <div>
                  <small>{t("pendingDetail.checkOut")}</small>
                  <strong>{dateLabel(reservation.checkOut)}</strong>
                  <span>{t("pendingDetail.untilTime")}</span>
                </div>
                <div>
                  <small>{t("pendingDetail.duration")}</small>
                  <strong>
                    {nights} {nights === 1 ? t("common.night") : t("common.nights")}
                  </strong>
                </div>
                <div>
                  <small>{t("pendingDetail.totalGuests")}</small>
                  <strong>{t("pendingDetail.adults", { count: reservation.adults ?? 2 })}</strong>
                  <span>{t("pendingDetail.children", { count: reservation.children ?? 0 })}</span>
                </div>
              </div>
            </PendingSection>
            <PendingSection
              title={t("pendingDetail.roomAllocationRate")}
              aside={<span>{t("pendingDetail.roomNumbersAside")}</span>}
            >
              <div className="pending-detail-lock">
                {t("pendingDetail.roomsLocked")}
              </div>
              <div className="pending-detail-table-scroll">
                <table className="pending-detail-table">
                  <thead>
                    <tr>
                      <th>{t("pendingDetail.roomType")}</th>
                      <th>{t("pendingDetail.qty")}</th>
                      <th>{t("pendingDetail.nights")}</th>
                      <th>{t("pendingDetail.ratePerNight")}</th>
                      <th>{t("pendingDetail.subtotal")}</th>
                      <th>{t("pendingDetail.roomAssignment")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roomRows.map(({ type, quantity }) => (
                      <tr key={type.id}>
                        <td>{type.name}</td>
                        <td>{quantity}</td>
                        <td>{nights}</td>
                        <td>{formatRupiah(type.rate)}</td>
                        <td>{formatRupiah(type.rate * quantity * nights)}</td>
                        <td>
                          <span className="pending-detail-locked-badge">
                            {t("pendingDetail.notAssignedLocked")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4}>
                        {t("pendingDetail.roomTotal", { units: roomCount, nights })}
                      </td>
                      <td>{formatRupiah(roomTotal)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              {extraBedsTotal > 0 && (
                <div className="reservation-detail-room-beds">
                  {roomRows.flatMap(({ type, quantity }) =>
                    Array.from({ length: quantity }, (_, index) => {
                      const bedNights =
                        reservation.roomExtraBeds?.[`${type.id}-${index}`] ?? 0;
                      return bedNights > 0 ? (
                        <div key={`${type.id}-${index}`}>
                          <span>
                            {t("pendingDetail.extraBedLine", { roomType: type.name, index: index + 1 })}
                          </span>
                          <strong>
                            {t("pendingDetail.extraBedDetail", { nights: bedNights, rate: formatRupiah(extraBedRates[type.id]), total: formatRupiah(extraBedRates[type.id] * bedNights) })}
                          </strong>
                        </div>
                      ) : null;
                    }),
                  )}
                </div>
              )}
            </PendingSection>
            <PendingSection title={t("pendingDetail.experiencesAddOns")}>
              <div className="pending-detail-table-scroll">
                <table className="pending-detail-table pending-detail-extras-table">
                  <thead>
                    <tr>
                      <th>{t("pendingDetail.experience")}</th>
                      <th>{t("pendingDetail.qty")}</th>
                      <th>{t("pendingDetail.unitPrice")}</th>
                      <th>{t("pendingDetail.subtotal")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedExtras.map((id) => {
                      const extra = extras.find((item) => item.id === id);
                      if (!extra) return null;
                      const quantity = reservation.extraQuantities?.[id] ?? 1;
                      const subtotal = getExtraCost(id, quantity, nights);
                      return (
                        <tr key={id}>
                          <td>{extra.label}</td>
                          <td>{quantity}</td>
                          <td>
                            {formatRupiah(Math.round(subtotal / quantity))}
                          </td>
                          <td>{formatRupiah(subtotal)}</td>
                        </tr>
                      );
                    })}
                    {selectedExtras.length === 0 && (
                      <tr>
                        <td colSpan={4} className="pending-detail-table-empty">
                          {t("pendingDetail.experiencesEmpty")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3}>{t("pendingDetail.experiencesSubtotal")}</td>
                      <td>{formatRupiah(extrasTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </PendingSection>
            <PendingSection
              title={t("pendingDetail.chargesFolio")}
              aside={<span>{t("pendingDetail.currencyAside")}</span>}
            >
              <div className="pending-detail-charges">
                <Pair
                  label={t("pendingDetail.roomCharges", {
                    rooms: roomCount === 1 ? t("pendingDetail.roomsSingular", { count: roomCount }) : t("pendingDetail.roomsPlural", { count: roomCount }),
                    nights: nights === 1 ? t("pendingDetail.nightSingular", { count: nights }) : t("pendingDetail.nightPlural", { count: nights }),
                  })}
                >
                  {formatRupiah(roomTotal)}
                </Pair>
                {extraBedsTotal > 0 && (
                  <Pair label={t("pendingDetail.extraBed")}>{formatRupiah(extraBedsTotal)}</Pair>
                )}
                <Pair label={t("pendingDetail.experiencesAddOns")}>
                  {formatRupiah(extrasTotal)}
                </Pair>
                <div className="pending-detail-divider" />
                <Pair label={t("pendingDetail.bookingTotal")}>{formatRupiah(total)}</Pair>
                <Pair label={t("pendingDetail.totalPaid")}>{formatRupiah(amountPaid)}</Pair>
                <div className="pending-detail-balance">
                  <span>{t("pendingDetail.remainingBalanceOutstanding")}</span>
                  <strong>{formatRupiah(balance)}</strong>
                </div>
              </div>
            </PendingSection>
            <PendingSection
              title={t("pendingDetail.paymentHistory")}
              aside={
                <span>
                  {transactions.length === 1 ? t("pendingDetail.transaction", { count: transactions.length }) : t("pendingDetail.transactions", { count: transactions.length })}
                </span>
              }
            >
              {transactions.length ? (
                <div className="pending-detail-history">
                  {transactions.map((item, index) => (
                    <div key={index}>
                      <div>
                        <strong>{formatRupiah(item.amount)}</strong>
                        <span>{item.method}</span>
                      </div>
                      <small>
                        {new Intl.DateTimeFormat("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(item.recordedAt))}
                        {item.reference ? ` · ${item.reference}` : ""}
                      </small>
                    </div>
                  ))}
                </div>
              ) : amountPaid > 0 ? (
                <div className="pending-detail-history">
                  <div>
                    <div>
                      <strong>{formatRupiah(amountPaid)}</strong>
                      <span>{t("pendingDetail.previousPayment")}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="pending-detail-payment-empty">
                  <strong>
                    {t("pendingDetail.paymentEmptyTitle")}
                  </strong>
                  <p>
                    {t("pendingDetail.paymentEmptyBody")}
                  </p>
                </div>
              )}
            </PendingSection>
            <PendingSection title={t("pendingDetail.internalNotes")}>
              <div className="pending-detail-internal-note">
                {t("pendingDetail.internalNotesEmpty")}
              </div>
            </PendingSection>
          </div>
          <aside className="pending-detail-aside">
            <div className="pending-detail-summary">
              <div className="pending-detail-summary-header">
                <h2>{t("pendingDetail.reservationSummary")}</h2>
                <span>
                  {nights} {nights === 1 ? t("common.night") : t("common.nights")}
                </span>
              </div>
              <div className="pending-detail-summary-rows">
                <Pair label={t("pendingDetail.guest")}>{reservation.guestName}</Pair>
                <Pair label={t("pendingDetail.stayPeriod")}>
                  {formatStayDate(reservation.checkIn)} →{" "}
                  {formatStayDate(reservation.checkOut)}
                </Pair>
                <Pair label={t("pendingDetail.roomTypes")}>
                  {roomRows
                    .map(({ type, quantity }) => `${quantity}x ${type.name}`)
                    .join(", ")}
                </Pair>
                <Pair label={t("pendingDetail.roomNumbers")}>
                  <span className="pending-detail-locked-badge">
                    {t("pendingDetail.notAssigned")}
                  </span>
                </Pair>
                <div className="pending-detail-divider" />
                <Pair label={t("pendingDetail.bookingTotal")}>{formatRupiah(total)}</Pair>
                <Pair label={t("pendingDetail.paymentStatus")}>
                  <span
                    className={
                      "reservations-badge reservations-badge--" +
                      (reservation.paymentStatus === "Unpaid"
                        ? "danger"
                        : "warning")
                    }
                  >
                    {reservation.paymentStatus}
                  </span>
                </Pair>
                <Pair label={t("pendingDetail.remainingBalance")}>
                  <span className="pending-detail-summary-balance">
                    {formatRupiah(balance)}
                  </span>
                </Pair>
                <Pair label={t("pendingDetail.reservationStatus")}>
                  <span
                    className={
                      "reservations-badge reservations-badge--" +
                      (isPending ? "warning" : "success")
                    }
                  >
                    {reservation.status}
                  </span>
                </Pair>
              </div>
              {isPending ? (
                <p className="pending-detail-summary-warning">
                  {t("pendingDetail.summaryWarningPending")}
                </p>
              ) : (
                <p className="pending-detail-summary-warning">
                  {t("pendingDetail.summaryWarningConfirmed")}
                </p>
              )}
              <div className="pending-detail-summary-actions">
                <PendingCheckInAction
                  reservation={reservation}
                  onUpdate={onUpdate}
                />
                {isPending && !isAutoConfirmedSource(reservation.source) && (
                  <ConfirmReservationAction
                    reservation={reservation}
                    onUpdate={onUpdate}
                  />
                )}
                <button
                  type="button"
                  className="action-button pending-detail-payment-action"
                  onClick={openPayment}
                >
                  {t("pendingDetail.recordPayment")}
                </button>
                {isPending && (
                  <button
                    type="button"
                    className="pending-detail-release-button"
                    onClick={() => {
                      setError("");
                      setModal("release");
                    }}
                    disabled={reservation.paymentStatus !== "Unpaid"}
                  >
                    {t("pendingDetail.cancelReservation")}
                  </button>
                )}
              </div>
              <div className="pending-detail-disabled-operations">
                <span>{t("pendingDetail.checkoutRequiresPayment")}</span>
                <span>{t("pendingDetail.roomAssignmentAtCheckIn")}</span>
                <span>{t("pendingDetail.stayExtensionLocked")}</span>
              </div>
            </div>
            <div className="pending-detail-assistance">
              <strong>{t("pendingDetail.needHelp")}</strong>
              <p>
                {t("pendingDetail.sendReminder", { phone: reservation.whatsapp })}
              </p>
              {phone ? (
                <a
                  href={`https://wa.me/${phone}?text=${encodeURIComponent(whatsappMessage)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("pendingDetail.sendWhatsapp")}
                </a>
              ) : (
                <span>{t("pendingDetail.whatsappUnavailable")}</span>
              )}
            </div>
          </aside>
        </div>
        {modal && (
          <div
            className="reservation-operation-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setModal(null);
            }}
          >
            <section
              className="reservation-operation-modal pending-detail-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="pending-modal-title"
            >
              <div className="reservation-operation-header">
                <h2 id="pending-modal-title">
                  {modal === "payment"
                    ? t("pendingDetail.modal.recordPaymentTitle")
                    : t("pendingDetail.modal.cancelReservationTitle")}
                </h2>
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  aria-label={t("common.closeModal")}
                >
                  ×
                </button>
              </div>
              {modal === "payment" ? (
                <div className="pending-detail-modal-body">
                  <div className="reservation-operation-context">
                    <div>
                      <strong>{reservation.guestName}</strong>
                      <span>{t("pendingDetail.modal.remainingBalance", { balance: formatRupiah(balance) })}</span>
                    </div>
                  </div>
                  <label>
                    {t("pendingDetail.modal.amountToPay")}
                    <input
                      inputMode="numeric"
                      value={formatRupiah(paymentAmount)}
                      onChange={(event) =>
                        setPaymentAmount(parseCurrency(event.target.value))
                      }
                    />
                    <small>
                      {t("pendingDetail.modal.amountHint")}
                    </small>
                  </label>
                  <label>
                    {t("pendingDetail.modal.paymentMethod")}
                    <select
                      value={paymentMethod}
                      onChange={(event) => setPaymentMethod(event.target.value)}
                    >
                      {paymentMethods.map((method) => (
                        <option key={method}>{method}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("pendingDetail.modal.reference")}
                    <input
                      value={paymentReference}
                      onChange={(event) =>
                        setPaymentReference(event.target.value)
                      }
                      placeholder={t("pendingDetail.modal.referencePlaceholder")}
                    />
                  </label>
                  <label>
                    {t("pendingDetail.modal.internalNote")}
                    <textarea
                      value={paymentNote}
                      onChange={(event) => setPaymentNote(event.target.value)}
                      rows={2}
                      placeholder={t("pendingDetail.modal.notePlaceholder")}
                    />
                  </label>
                  <p className="pending-detail-modal-tip">
                    {t("pendingDetail.modal.paymentTip", { status: reservation.status, suffix: isPending ? t("pendingDetail.modal.paymentTipSuffix") : "" })}
                  </p>
                  {error && (
                    <p className="reservation-operation-error" role="alert">
                      {error}
                    </p>
                  )}
                </div>
              ) : (
                <div className="pending-detail-modal-body">
                  <p>
                    {t("pendingDetail.modal.cancelCopy")}
                  </p>
                  <label>
                    {t("pendingDetail.modal.reason")}
                    <select
                      value={cancellationReason}
                      onChange={(event) =>
                        setCancellationReason(event.target.value)
                      }
                    >
                      <option value="Guest request">{t("pendingDetail.modal.reasonGuestRequest")}</option>
                      <option value="Duplicate booking">{t("pendingDetail.modal.reasonDuplicate")}</option>
                      <option value="Invalid guest contact details">{t("pendingDetail.modal.reasonInvalidContact")}</option>
                    </select>
                  </label>
                  <label>
                    {t("pendingDetail.modal.internalNoteLabel")}
                    <textarea
                      value={cancellationNote}
                      onChange={(event) =>
                        setCancellationNote(event.target.value)
                      }
                      rows={3}
                      placeholder={t("pendingDetail.modal.cancelNotePlaceholder")}
                    />
                  </label>
                  {error && (
                    <p className="reservation-operation-error" role="alert">
                      {error}
                    </p>
                  )}
                </div>
              )}
              <div className="reservation-operation-actions">
                <button
                  type="button"
                  className="reservation-secondary-button"
                  onClick={() => setModal(null)}
                >
                  {modal === "payment" ? t("common.cancel") : t("pendingDetail.modal.keepReservation")}
                </button>
                <button
                  type="button"
                  className={
                    modal === "payment"
                      ? "action-button"
                      : "pending-detail-release-button"
                  }
                  onClick={
                    modal === "payment" ? savePayment : cancelReservation
                  }
                >
                  {modal === "payment"
                    ? t("pendingDetail.modal.savePayment")
                    : t("pendingDetail.modal.confirmCancellation")}
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
