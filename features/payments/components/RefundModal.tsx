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

const money = (amount: number) => `Rp${amount.toLocaleString("id-ID")}`;
type CancellationRule = RefundEligibility["settlement"]["policy"]["appliedRule"];

function ruleLabel(rule: CancellationRule) {
  if (!rule) return "Aturan memerlukan peninjauan manual";
  const timing = rule.timingType === "more_than"
    ? `Lebih dari ${rule.daysBefore} hari sebelum check-in`
    : `Dalam ${rule.daysBefore} hari sebelum check-in`;
  const charge = rule.chargeType === "percentage"
    ? `${rule.chargeValue}% dari harga kamar`
    : rule.chargeType === "fixed"
      ? money(rule.chargeValue)
      : `${rule.chargeValue} malam`;
  return `${timing} · biaya ${charge}`;
}

type Props = {
  reservationId: string;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
};

export function RefundModal({ reservationId, canManage, onClose, onChanged }: Props) {
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
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Data refund gagal dimuat."); });
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
      setError(cause instanceof Error ? cause.message : "Proses refund gagal.");
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    if (refundAmount < 1 || (eligibility?.pendingRefundAmount ?? 0) > 0) {
      setError("Tidak ada refund yang dapat diselesaikan. Selesaikan refund pending terlebih dahulu.");
      return;
    }
    if (!reason.trim()) { setError("Alasan refund wajib diisi."); return; }
    if (((overridePolicy && canOverridePolicy) || eligibility?.settlement.calculationStatus === "manual_review_required") && !overrideReason.trim()) {
      setError("Alasan pengecualian atau peninjauan manual wajib diisi.");
      return;
    }
    void run(() => completeCancellationRefund(reservationId, {
      expectedAmount: refundAmount,
      reason: reason.trim(),
      ignoreCancellationPolicy: overridePolicy && canOverridePolicy,
      ...(((overridePolicy && canOverridePolicy) || eligibility?.settlement.calculationStatus === "manual_review_required") ? { settlementOverrideReason: overrideReason.trim() } : {}),
    }), "Refund selesai dan tercatat dalam riwayat pembayaran.");
  }

  function submitNoRefund() {
    if (!reason.trim()) {
      setError("Alasan No Refund wajib diisi.");
      return;
    }
    void run(() => recordNoRefund(reservationId, reason.trim()), "No Refund selesai dan tercatat dalam audit trail.");
  }

  return <div className="payment-invoice-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="payment-invoice-modal payment-refund-modal" role="dialog" aria-modal="true" aria-label="Manage refund">
      <header><h2>Manual Refund</h2><button type="button" aria-label="Close refund" onClick={onClose}>×</button></header>
      <div className="payment-refund-content">
        {!eligibility ? <p>{error || "Memuat kelayakan refund..."}</p> : <>
          <div className="payment-refund-summary">
            <div><span>Booking</span><strong>{eligibility.bookingCode}</strong></div>
            <div><span>Paid</span><strong>{money(eligibility.grossPaidAmount)}</strong></div>
            <div><span>Cancellation policy</span><strong>{eligibility.settlement.policy.name ?? "Manual review"}</strong></div>
            <div><span>Cancellation charge</span><strong>{eligibility.settlement.amounts.cancellationCharge === null ? "Review" : money(eligibility.settlement.amounts.cancellationCharge)}</strong></div>
            <div><span>Estimated refund</span><strong>{estimated == null
              ? eligibility.settlement.amounts.maximumRefundWithoutOverride === null
                ? "Review"
                : `${money(eligibility.settlement.amounts.maximumRefundWithoutOverride)} · Review`
              : money(estimated)}</strong></div>
            <div><span>Already refunded</span><strong>{money(eligibility.refundedAmount)}</strong></div>
          </div>
          <section className="payment-refund-calculation" aria-label="Rincian perhitungan pembatalan">
            <h3>Cancellation calculation</h3>
            <p>Dibatalkan {eligibility.settlement.policy.daysBeforeCheckIn >= 0
              ? `${eligibility.settlement.policy.daysBeforeCheckIn} hari sebelum check-in`
              : "setelah tanggal check-in"}.</p>
            {(eligibility.settlement.policy.rooms ?? []).length > 0 ? (
              <div className="payment-refund-room-list">
                {(eligibility.settlement.policy.rooms ?? []).map((room) => (
                  <div className="payment-refund-room" key={room.roomIndex}>
                    <div><strong>{room.roomTypeName} · Room {room.roomIndex + 1}</strong><span>{room.policyName ?? "Manual review"}</span></div>
                    <small>{room.appliedRule ? ruleLabel(room.appliedRule) : room.policyName === "100% cancellation charge" ? "Non-refundable · 100% biaya kamar" : "Aturan memerlukan peninjauan manual"}</small>
                    <div><span>Harga kamar {money(room.roomTotal)}</span><strong>Biaya pembatalan {room.cancellationCharge === null ? "Review" : money(room.cancellationCharge)}</strong></div>
                  </div>
                ))}
              </div>
            ) : (
              <p>{eligibility.settlement.policy.appliedRule
                ? ruleLabel(eligibility.settlement.policy.appliedRule)
                : eligibility.settlement.policy.name === "100% cancellation charge"
                  ? "Non-refundable · 100% biaya kamar"
                  : "Aturan memerlukan peninjauan manual"}</p>
            )}
            <dl className="payment-refund-math">
              <div><dt>Harga seluruh kamar</dt><dd>{money(eligibility.settlement.amounts.roomTotal)}</dd></div>
              <div><dt>Extra bed, breakfast, experience, dan biaya lain</dt><dd>{money(eligibility.settlement.amounts.otherCharges)}</dd></div>
              <div><dt>Total booking</dt><dd>{money(eligibility.settlement.amounts.bookingTotal)}</dd></div>
              <div><dt>Pembayaran bersih setelah refund sebelumnya</dt><dd>{money(eligibility.settlement.amounts.netPaidAmount)}</dd></div>
              <div><dt>Total biaya pembatalan kamar</dt><dd>{eligibility.settlement.amounts.cancellationCharge === null ? "Review" : money(eligibility.settlement.amounts.cancellationCharge)}</dd></div>
              <div className="payment-refund-math__result"><dt>Batas refund menurut kebijakan</dt><dd>{eligibility.settlement.amounts.maximumRefundWithoutOverride === null ? "Review" : money(eligibility.settlement.amounts.maximumRefundWithoutOverride)}</dd></div>
              {eligibility.pendingRefundAmount > 0 && <div><dt>Refund yang masih diproses</dt><dd>−{money(eligibility.pendingRefundAmount)}</dd></div>}
            </dl>
            <small>Biaya lain memerlukan peninjauan manual. Nominal refund mengikuti hasil perhitungan kebijakan dan tidak dapat diubah.</small>
          </section>
          {eligibility.settlement.reviewReasons.length > 0 && <p className="payment-refund-warning">Perlu ditinjau: {eligibility.settlement.reviewReasons.join("; ")}</p>}
          {canOverridePolicy && estimated === 0 && !overridePolicy && <p className="payment-refund-warning">Kebijakan pembatalan menghasilkan refund Rp0. Catat No Refund, atau centang pengecualian kebijakan jika staf memutuskan mengembalikan dana.</p>}
          {eligibility.noRefundDecision && <p className="payment-refund-notice">No Refund selesai. Alasan: {eligibility.noRefundDecision.details.reason ?? "—"}</p>}
          {canManage && eligibility.maxRefundWithOverride > 0 && !eligibility.noRefundDecision && <div className="payment-refund-form">
            <h3>Refund</h3>
            {eligibility.payments.length > 0 && <p>Dana dikembalikan dari transaksi pembayaran yang tersedia, dimulai dari transaksi paling awal.</p>}
            {canOverridePolicy && <label className="payment-refund-checkbox"><input type="checkbox" checked={overridePolicy} onChange={(event) => setOverridePolicy(event.target.checked)} /> Abaikan kebijakan pembatalan yang berlaku saat reservasi</label>}
            {canOverridePolicy && overridePolicy && <p className="payment-refund-warning">Refund dapat melebihi hasil kebijakan, maksimal sebesar pembayaran yang belum dikembalikan. Keputusan ini dicatat di audit trail.</p>}
            <label>Refund amount (IDR)<input type="text" value={money(refundAmount)} readOnly aria-readonly="true" /><small>Nominal pasti {overridePolicy && canOverridePolicy ? "tanpa kebijakan pembatalan" : "sesuai kebijakan pembatalan"}; tidak dapat dikurangi atau ditambah.</small></label>
            <label>{canRecordNoRefund ? "No Refund reason" : "Refund reason"}<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} /></label>
            {((canOverridePolicy && overridePolicy) || eligibility.settlement.calculationStatus === "manual_review_required") && <label>{canOverridePolicy && overridePolicy ? "Override reason" : "Manual review reason"}<textarea value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} rows={2} /></label>}
            {canRecordNoRefund
              ? <button type="button" disabled={busy} onClick={submitNoRefund}>No Refund</button>
              : <button type="button" disabled={busy || refundAmount < 1 || eligibility.pendingRefundAmount > 0} onClick={submit}>Refund Selesai</button>}
          </div>}
          {eligibility.refunds.length > 0 && <div className="payment-refund-history"><h3>Refund History</h3>{eligibility.refunds.map((refund) => <div className="payment-refund-item" key={refund.id}><div><strong>{money(refund.amount)} · {refund.status}</strong><small>{refund.reason ?? "—"}</small>{refund.reference && <small>Reference: {refund.reference}</small>}</div>{refund.status === "pending" && canManage && <div className="payment-refund-pending"><label>Refund reference<input value={references[refund.id] ?? ""} onChange={(event) => setReferences((current) => ({ ...current, [refund.id]: event.target.value }))} /></label><button type="button" disabled={busy || !references[refund.id]?.trim()} onClick={() => void run(() => completeRefund(reservationId, refund.id, references[refund.id].trim()), "Refund berhasil diselesaikan.")}>Mark Completed</button><label>Failure reason<input value={failReasons[refund.id] ?? ""} onChange={(event) => setFailReasons((current) => ({ ...current, [refund.id]: event.target.value }))} /></label><button type="button" className="payment-refund-fail" disabled={busy || !failReasons[refund.id]?.trim()} onClick={() => void run(() => failRefund(reservationId, refund.id, failReasons[refund.id].trim()), "Refund ditandai gagal.")}>Mark Failed</button></div>}</div>)}</div>}
        </>}
        {notice && <p className="payment-refund-notice" role="status">{notice}</p>}
        {error && eligibility && <p className="payment-refund-error" role="alert">{error}</p>}
      </div>
    </section>
  </div>;
}
