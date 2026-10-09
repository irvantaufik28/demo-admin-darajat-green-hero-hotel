"use client";

import type { ApiReservationDetail } from "../../reservations/services/api";
import type { RefundEligibility } from "../services/payments";
import { useTranslations, type Translate } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

type Props = {
  detail: ApiReservationDetail;
  refundEligibility: RefundEligibility | null;
  refundLoading: boolean;
  refundError: string;
  onClose: () => void;
};

const money = (amount: number) => `Rp${amount.toLocaleString("id-ID")}`;

function dateLabel(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function cancellationRuleLabel(rule: NonNullable<RefundEligibility["settlement"]["policy"]["appliedRule"]>, t: Translate) {
  const timing = rule.timingType === "more_than"
    ? t("invoice.cancellation.rule.moreThan", { days: rule.daysBefore })
    : t("invoice.cancellation.rule.within", { days: rule.daysBefore });
  const charge = rule.chargeType === "percentage"
    ? t("invoice.cancellation.rule.percentage", { value: rule.chargeValue })
    : rule.chargeType === "fixed"
      ? money(rule.chargeValue)
      : t("invoice.cancellation.rule.nights", { value: rule.chargeValue });
  return t("invoice.cancellation.rule.template", { timing, charge });
}

export function PaymentInvoicePreview({
  detail,
  refundEligibility,
  refundLoading,
  refundError,
  onClose,
}: Props) {
  const { t } = useTranslations({ en, id });
  const { reservation, guest, summary } = detail;
  const cancelled = reservation.reservationStatus === "cancelled";
  const noShow = reservation.reservationStatus === "no_show";
  const settledReservation = cancelled || noShow;
  const settlement = refundEligibility?.settlement;

  return (
    <div className="payment-invoice-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="payment-invoice-modal" role="dialog" aria-modal="true" aria-label={t("invoice.ariaLabel")}>
        <header>
          <h2>{t("invoice.title")}</h2>
          <div>
            <button type="button" disabled={settledReservation && (!settlement || refundLoading)} onClick={() => window.print()}>
              {t("invoice.printSavePdf")}
            </button>
            <button type="button" aria-label={t("invoice.closeAriaLabel")} onClick={onClose}>×</button>
          </div>
        </header>
        <div className="payment-invoice-paper">
          <div className="payment-invoice-brand">
            <div>
              <strong>{t("invoice.brandName")}</strong>
              <span>{t("invoice.brandAddress")}</span>
            </div>
            <div>
              <strong>{t("invoice.invoiceTitle")}</strong>
              <span>INV-{reservation.bookingCode.replace("GH-", "")}</span>
              {cancelled && <span>{t("invoice.reservationCancelled")}</span>}
              {noShow && <span>{t("invoice.reservationNoShow")}</span>}
            </div>
          </div>
          <div className="payment-invoice-info">
            <div>
              <small>{t("invoice.billedTo")}</small>
              <strong>{guest.fullName}</strong>
              <span>{guest.phone}</span>
              <span>{guest.email ?? ""}</span>
            </div>
            <div>
              <small>{t("invoice.bookingRef")}</small>
              <strong>{reservation.bookingCode}</strong>
              <span>{dateLabel(reservation.checkInDate)} – {dateLabel(reservation.checkOutDate)}</span>
              <span>{summary.nights} {summary.nights === 1 ? t("invoice.night") : t("invoice.nights")}</span>
            </div>
          </div>

          <div className="payment-detail-table-scroll">
            <table className="payment-detail-table">
              <thead><tr><th>{t("invoice.table.item")}</th><th>{t("invoice.table.qty")}</th><th>{t("invoice.table.rate")}</th><th>{t("invoice.table.subtotal")}</th></tr></thead>
              <tbody>
                {detail.charges.map((charge) => (
                  <tr key={charge.id}>
                    <td>{charge.description}</td>
                    <td>{charge.quantity}</td>
                    <td>{money(charge.unitAmount)}</td>
                    <td>{money(charge.amount)}</td>
                  </tr>
                ))}
                {detail.charges.length === 0 && <tr><td colSpan={4}>{t("invoice.table.noItems")}</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="payment-invoice-totals">
            <div><span>{t("invoice.totals.totalCharges")}</span><strong>{money(summary.bookingTotal)}</strong></div>
            <div><span>{t("invoice.totals.amountPaid")}</span><strong>{money(summary.grossPaidAmount)}</strong></div>
            {summary.refundedAmount > 0 && <div><span>{t("invoice.totals.refundCompleted")}</span><strong>−{money(summary.refundedAmount)}</strong></div>}
            {settledReservation
              ? <div><span>{t("invoice.totals.netPaidAfterRefund")}</span><strong>{money(summary.grossPaidAmount - summary.refundedAmount)}</strong></div>
              : <div><span>{t("invoice.totals.balanceDue")}</span><strong>{money(summary.remainingBalance)}</strong></div>}
          </div>

          {(detail.payments.length > 0 || detail.refunds.length > 0) && (
            <section className="payment-invoice-history">
              <h3>{t("invoice.transactions.title")}</h3>
              <div className="payment-detail-table-scroll">
                <table className="payment-detail-table">
                  <thead><tr><th>{t("invoice.transactions.type")}</th><th>{t("invoice.transactions.date")}</th><th>{t("invoice.transactions.methodReference")}</th><th>{t("invoice.transactions.status")}</th><th>{t("invoice.transactions.amount")}</th></tr></thead>
                  <tbody>
                    {detail.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{t("invoice.transactions.payment")}</td>
                        <td>{payment.paidAt ? dateLabel(payment.paidAt) : "—"}</td>
                        <td>{payment.method?.name ?? "—"}{payment.providerReference ? ` · ${payment.providerReference}` : ""}</td>
                        <td>{payment.status.replaceAll("_", " ")}</td>
                        <td>{money(payment.amount)}</td>
                      </tr>
                    ))}
                    {detail.refunds.map((refund) => (
                      <tr key={refund.id}>
                        <td>{t("invoice.transactions.refund")}</td>
                        <td>{refund.processedAt ? dateLabel(refund.processedAt) : "—"}</td>
                        <td>{refund.providerReference ?? "—"}</td>
                        <td>{refund.status.replaceAll("_", " ")}</td>
                        <td>{refund.status === "succeeded" ? "−" : ""}{money(refund.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {settledReservation && (
            <section className="payment-invoice-cancellation">
              <h3>{noShow ? t("invoice.cancellation.noShowTitle") : t("invoice.cancellation.title")}</h3>
              {refundLoading && <p>{t("invoice.cancellation.loading")}</p>}
              {refundError && <p role="alert">{t("invoice.cancellation.loadError", { error: refundError })}</p>}
              {settlement && <>
                {!noShow && <p>{settlement.policy.daysBeforeCheckIn >= 0
                  ? t("invoice.cancellation.savedPolicyDaysBefore", { days: settlement.policy.daysBeforeCheckIn })
                  : t("invoice.cancellation.savedPolicyAfterCheckIn")}</p>}
                {settlement.policy.rooms.length > 0 ? (
                  <div className="payment-invoice-policy-rooms">
                    {settlement.policy.rooms.map((room) => (
                      <div key={room.roomIndex}>
                        <strong>{room.roomTypeName} · {t("invoice.cancellation.room")} {room.roomIndex + 1}</strong>
                        <span>{room.policyName ?? t("invoice.cancellation.needsReview")}</span>
                        <small>{room.appliedRule
                          ? cancellationRuleLabel(room.appliedRule, t)
                          : room.policyName === "100% cancellation charge"
                            ? t("invoice.cancellation.nonRefundable")
                            : t("invoice.cancellation.needsManualReview")}</small>
                        <span>{t("invoice.cancellation.roomChargeLine", { roomTotal: money(room.roomTotal), charge: room.cancellationCharge === null ? t("invoice.cancellation.review") : money(room.cancellationCharge) })}</span>
                      </div>
                    ))}
                  </div>
                ) : <p>{settlement.policy.name ?? t("invoice.cancellation.policyNeedsManualReview")}</p>}
                <div className="payment-invoice-cancellation-totals">
                  <div><span>{t("invoice.cancellation.roomCharges")}</span><strong>{money(settlement.amounts.roomTotal)}</strong></div>
                  <div><span>{t("invoice.cancellation.otherCharges")}</span><strong>{money(settlement.amounts.otherCharges)}</strong></div>
                  <div><span>{noShow ? t("invoice.cancellation.noShowPenalty") : t("invoice.cancellation.cancellationCharge")}</span><strong>{settlement.amounts.cancellationCharge === null ? t("invoice.cancellation.review") : money(settlement.amounts.cancellationCharge)}</strong></div>
                  <div><span>{t("invoice.cancellation.refundLimit")}</span><strong>{settlement.amounts.maximumRefundWithoutOverride === null ? t("invoice.cancellation.review") : money(settlement.amounts.maximumRefundWithoutOverride)}</strong></div>
                  {refundEligibility.pendingRefundAmount > 0 && <div><span>{t("invoice.cancellation.refundPending")}</span><strong>{money(refundEligibility.pendingRefundAmount)}</strong></div>}
                  <div><span>{t("invoice.cancellation.refundCompleted")}</span><strong>{money(refundEligibility.refundedAmount)}</strong></div>
                </div>
                {settlement.reviewReasons.length > 0 && <p>{t("invoice.cancellation.reviewReasons", { reasons: settlement.reviewReasons.join("; ") })}</p>}
                <small>{t("invoice.cancellation.note")}</small>
              </>}
            </section>
          )}
          <p>{t("invoice.depositNote")}</p>
        </div>
      </section>
    </div>
  );
}
