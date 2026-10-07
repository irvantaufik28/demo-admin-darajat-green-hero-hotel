"use client";

import { useEffect, useState } from "react";
import {
  completeRefund,
  completeCancellationRefund,
  failRefund,
  getRefundEligibility,
  recordNoRefund,
  type RefundEligibility,
} from "../services/payments";
import { useTranslations, type Translate } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

const money = (amount: number) => `Rp${amount.toLocaleString("id-ID")}`;
type CancellationRule = RefundEligibility["settlement"]["policy"]["appliedRule"];

function ruleLabel(rule: CancellationRule, t: Translate) {
  if (!rule) return t("refundModal.rule.needsManualReview");
  const timing = rule.timingType === "more_than"
    ? t("refundModal.rule.moreThan", { days: rule.daysBefore })
    : t("refundModal.rule.within", { days: rule.daysBefore });
  const charge = rule.chargeType === "percentage"
    ? t("refundModal.rule.percentage", { value: rule.chargeValue })
    : rule.chargeType === "fixed"
      ? money(rule.chargeValue)
      : t("refundModal.rule.nights", { value: rule.chargeValue });
  return t("refundModal.rule.chargeTemplate", { timing, charge });
}

type Props = {
  reservationId: string;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
};

export function RefundModal({ reservationId, canManage, onClose, onChanged }: Props) {
  const { t } = useTranslations({ en, id });
  const [eligibility, setEligibility] = useState<RefundEligibility | null>(null);
  const [reason, setReason] = useState("");
  const [overridePolicy, setOverridePolicy] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [references, setReferences] = useState<Record<string, string>>({});
  const [failReasons, setFailReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    const result = await getRefundEligibility(reservationId);
    setEligibility(result);
  }

  useEffect(() => {
    let active = true;
    getRefundEligibility(reservationId).then((result) => {
      if (!active) return;
      setEligibility(result);
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : t("refundModal.loadError")); });
    return () => { active = false; };
  }, [reservationId]);

  const canOverridePolicy = eligibility?.hasCancellationPolicySnapshot ?? false;
  const estimated = eligibility?.settlement.amounts.estimatedRefundAmount;
  const policyLimit = Math.max(
    0,
    (eligibility?.settlement.amounts.maximumRefundWithoutOverride ?? 0) -
      (eligibility?.pendingRefundAmount ?? 0),
  );
  const refundAmount = overridePolicy && canOverridePolicy
    ? eligibility?.maxRefundWithOverride ?? 0
    : policyLimit;
  const canRecordNoRefund = !eligibility?.noRefundDecision &&
    refundAmount === 0 &&
    (eligibility?.grossPaidAmount ?? 0) > 0 &&
    (eligibility?.pendingRefundAmount ?? 0) === 0 &&
    (eligibility?.refundedAmount ?? 0) === 0;

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      await refresh();
      await onChanged();
      setNotice(message);
      setReason("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("refundModal.errors.processFailed"));
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    if (refundAmount < 1 || (eligibility?.pendingRefundAmount ?? 0) > 0) {
      setError(t("refundModal.errors.noRefundAvailable"));
      return;
    }
    if (!reason.trim()) { setError(t("refundModal.errors.reasonRequired")); return; }
    if (((overridePolicy && canOverridePolicy) || eligibility?.settlement.calculationStatus === "manual_review_required") && !overrideReason.trim()) {
      setError(t("refundModal.errors.overrideReasonRequired"));
      return;
    }
    void run(() => completeCancellationRefund(reservationId, {
      expectedAmount: refundAmount,
      reason: reason.trim(),
      ignoreCancellationPolicy: overridePolicy && canOverridePolicy,
      ...(((overridePolicy && canOverridePolicy) || eligibility?.settlement.calculationStatus === "manual_review_required") ? { settlementOverrideReason: overrideReason.trim() } : {}),
    }), t("refundModal.notices.refundCompleted"));
  }

  function submitNoRefund() {
    if (!reason.trim()) {
      setError(t("refundModal.errors.noRefundReasonRequired"));
      return;
    }
    void run(() => recordNoRefund(reservationId, reason.trim()), t("refundModal.notices.noRefundCompleted"));
  }

  return <div className="payment-invoice-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="payment-invoice-modal payment-refund-modal" role="dialog" aria-modal="true" aria-label={t("refundModal.ariaLabel")}>
      <header><h2>{t("refundModal.title")}</h2><button type="button" aria-label={t("refundModal.closeAriaLabel")} onClick={onClose}>×</button></header>
      <div className="payment-refund-content">
        {!eligibility ? <p>{error || t("refundModal.loading")}</p> : <>
          <div className="payment-refund-summary">
            <div><span>{t("refundModal.summary.booking")}</span><strong>{eligibility.bookingCode}</strong></div>
            <div><span>{t("refundModal.summary.paid")}</span><strong>{money(eligibility.grossPaidAmount)}</strong></div>
            <div><span>{t("refundModal.summary.cancellationPolicy")}</span><strong>{eligibility.settlement.policy.name ?? t("refundModal.summary.manualReview")}</strong></div>
            <div><span>{t("refundModal.summary.cancellationCharge")}</span><strong>{eligibility.settlement.amounts.cancellationCharge === null ? t("refundModal.summary.review") : money(eligibility.settlement.amounts.cancellationCharge)}</strong></div>
            <div><span>{t("refundModal.summary.estimatedRefund")}</span><strong>{estimated == null
              ? eligibility.settlement.amounts.maximumRefundWithoutOverride === null
                ? t("refundModal.summary.review")
                : `${money(eligibility.settlement.amounts.maximumRefundWithoutOverride)} · ${t("refundModal.summary.review")}`
              : money(estimated)}</strong></div>
            <div><span>{t("refundModal.summary.alreadyRefunded")}</span><strong>{money(eligibility.refundedAmount)}</strong></div>
          </div>
          <section className="payment-refund-calculation" aria-label={t("refundModal.calculation.ariaLabel")}>
            <h3>{t("refundModal.calculation.title")}</h3>
            <p>{eligibility.settlement.policy.daysBeforeCheckIn >= 0
              ? t("refundModal.calculation.cancelledDaysBefore", { days: eligibility.settlement.policy.daysBeforeCheckIn })
              : t("refundModal.calculation.cancelledAfterCheckIn")}</p>
            {(eligibility.settlement.policy.rooms ?? []).length > 0 ? (
              <div className="payment-refund-room-list">
                {(eligibility.settlement.policy.rooms ?? []).map((room) => (
                  <div className="payment-refund-room" key={room.roomIndex}>
                    <div><strong>{room.roomTypeName} · {t("refundModal.calculation.room")} {room.roomIndex + 1}</strong><span>{room.policyName ?? t("refundModal.summary.manualReview")}</span></div>
                    <small>{room.appliedRule ? ruleLabel(room.appliedRule, t) : room.policyName === "100% cancellation charge" ? t("refundModal.calculation.nonRefundable") : t("refundModal.calculation.needsManualReview")}</small>
                    <div><span>{t("refundModal.calculation.roomCharge", { amount: money(room.roomTotal) })}</span><strong>{t("refundModal.calculation.cancellationCharge", { amount: room.cancellationCharge === null ? t("refundModal.summary.review") : money(room.cancellationCharge) })}</strong></div>
                  </div>
                ))}
              </div>
            ) : (
              <p>{eligibility.settlement.policy.appliedRule
                ? ruleLabel(eligibility.settlement.policy.appliedRule, t)
                : eligibility.settlement.policy.name === "100% cancellation charge"
                  ? t("refundModal.calculation.nonRefundable")
                  : t("refundModal.calculation.needsManualReview")}</p>
            )}
            <dl className="payment-refund-math">
              <div><dt>{t("refundModal.calculation.roomTotal")}</dt><dd>{money(eligibility.settlement.amounts.roomTotal)}</dd></div>
              <div><dt>{t("refundModal.calculation.otherCharges")}</dt><dd>{money(eligibility.settlement.amounts.otherCharges)}</dd></div>
              <div><dt>{t("refundModal.calculation.bookingTotal")}</dt><dd>{money(eligibility.settlement.amounts.bookingTotal)}</dd></div>
              <div><dt>{t("refundModal.calculation.netPaid")}</dt><dd>{money(eligibility.settlement.amounts.netPaidAmount)}</dd></div>
              <div><dt>{t("refundModal.calculation.totalCancellationCharge")}</dt><dd>{eligibility.settlement.amounts.cancellationCharge === null ? t("refundModal.summary.review") : money(eligibility.settlement.amounts.cancellationCharge)}</dd></div>
              <div className="payment-refund-math__result"><dt>{t("refundModal.calculation.refundLimit")}</dt><dd>{eligibility.settlement.amounts.maximumRefundWithoutOverride === null ? t("refundModal.summary.review") : money(eligibility.settlement.amounts.maximumRefundWithoutOverride)}</dd></div>
              {eligibility.pendingRefundAmount > 0 && <div><dt>{t("refundModal.calculation.pendingRefund")}</dt><dd>−{money(eligibility.pendingRefundAmount)}</dd></div>}
            </dl>
            <small>{t("refundModal.calculation.note")}</small>
          </section>
          {eligibility.settlement.reviewReasons.length > 0 && <p className="payment-refund-warning">{t("refundModal.needsReview", { reasons: eligibility.settlement.reviewReasons.join("; ") })}</p>}
          {canOverridePolicy && estimated === 0 && !overridePolicy && <p className="payment-refund-warning">{t("refundModal.zeroRefundWarning")}</p>}
          {eligibility.noRefundDecision && <p className="payment-refund-notice">{t("refundModal.noRefundCompleted", { reason: eligibility.noRefundDecision.details.reason ?? "—" })}</p>}
          {canManage && eligibility.maxRefundWithOverride > 0 && !eligibility.noRefundDecision && <div className="payment-refund-form">
            <h3>{t("refundModal.form.title")}</h3>
            {eligibility.payments.length > 0 && <p>{t("refundModal.form.fundsNote")}</p>}
            {canOverridePolicy && <label className="payment-refund-checkbox"><input type="checkbox" checked={overridePolicy} onChange={(event) => setOverridePolicy(event.target.checked)} /> {t("refundModal.form.overrideCheckbox")}</label>}
            {canOverridePolicy && overridePolicy && <p className="payment-refund-warning">{t("refundModal.form.overrideWarning")}</p>}
            <label>{t("refundModal.form.refundAmountLabel")}<input type="text" value={money(refundAmount)} readOnly aria-readonly="true" /><small>{overridePolicy && canOverridePolicy ? t("refundModal.form.refundAmountHintWithOverride") : t("refundModal.form.refundAmountHintWithPolicy")}</small></label>
            <label>{canRecordNoRefund ? t("refundModal.form.noRefundReason") : t("refundModal.form.refundReason")}<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} /></label>
            {((canOverridePolicy && overridePolicy) || eligibility.settlement.calculationStatus === "manual_review_required") && <label>{canOverridePolicy && overridePolicy ? t("refundModal.form.overrideReason") : t("refundModal.form.manualReviewReason")}<textarea value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} rows={2} /></label>}
            {canRecordNoRefund
              ? <button type="button" disabled={busy} onClick={submitNoRefund}>{t("refundModal.form.noRefund")}</button>
              : <button type="button" disabled={busy || refundAmount < 1 || eligibility.pendingRefundAmount > 0} onClick={submit}>{t("refundModal.form.completeRefund")}</button>}
          </div>}
          {eligibility.refunds.length > 0 && <div className="payment-refund-history"><h3>{t("refundModal.history.title")}</h3>{eligibility.refunds.map((refund) => <div className="payment-refund-item" key={refund.id}><div><strong>{money(refund.amount)} · {refund.status}</strong><small>{refund.reason ?? "—"}</small>{refund.reference && <small>{t("refundModal.history.reference", { reference: refund.reference })}</small>}</div>{refund.status === "pending" && canManage && <div className="payment-refund-pending"><label>{t("refundModal.history.refundReference")}<input value={references[refund.id] ?? ""} onChange={(event) => setReferences((current) => ({ ...current, [refund.id]: event.target.value }))} /></label><button type="button" disabled={busy || !references[refund.id]?.trim()} onClick={() => void run(() => completeRefund(reservationId, refund.id, references[refund.id].trim()), t("refundModal.notices.refundMarkedCompleted"))}>{t("refundModal.history.markCompleted")}</button><label>{t("refundModal.history.failureReason")}<input value={failReasons[refund.id] ?? ""} onChange={(event) => setFailReasons((current) => ({ ...current, [refund.id]: event.target.value }))} /></label><button type="button" className="payment-refund-fail" disabled={busy || !failReasons[refund.id]?.trim()} onClick={() => void run(() => failRefund(reservationId, refund.id, failReasons[refund.id].trim()), t("refundModal.notices.refundMarkedFailed"))}>{t("refundModal.history.markFailed")}</button></div>}</div>)}</div>}
        </>}
        {notice && <p className="payment-refund-notice" role="status">{notice}</p>}
        {error && eligibility && <p className="payment-refund-error" role="alert">{error}</p>}
      </div>
    </section>
  </div>;
}
