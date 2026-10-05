"use client";

import type { ApiReservationDetail } from "../../reservations/services/api";
import type { RefundEligibility } from "../services/payments";

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

function cancellationRuleLabel(rule: NonNullable<RefundEligibility["settlement"]["policy"]["appliedRule"]>) {
  const timing = rule.timingType === "more_than"
    ? `Lebih dari ${rule.daysBefore} hari sebelum check-in`
    : `Dalam ${rule.daysBefore} hari sebelum check-in`;
  const charge = rule.chargeType === "percentage"
    ? `${rule.chargeValue}% harga kamar`
    : rule.chargeType === "fixed"
      ? money(rule.chargeValue)
      : `${rule.chargeValue} malam`;
  return `${timing} · ${charge}`;
}

export function PaymentInvoicePreview({
  detail,
  refundEligibility,
  refundLoading,
  refundError,
  onClose,
}: Props) {
  const { reservation, guest, summary } = detail;
  const cancelled = reservation.reservationStatus === "cancelled";
  const settlement = refundEligibility?.settlement;

  return (
    <div className="payment-invoice-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="payment-invoice-modal" role="dialog" aria-modal="true" aria-label="Invoice preview">
        <header>
          <h2>Guest Invoice Preview</h2>
          <div>
            <button type="button" disabled={cancelled && (!settlement || refundLoading)} onClick={() => window.print()}>
              Print / Save PDF
            </button>
            <button type="button" aria-label="Close invoice" onClick={onClose}>×</button>
          </div>
        </header>
        <div className="payment-invoice-paper">
          <div className="payment-invoice-brand">
            <div>
              <strong>Green Hero Darajat</strong>
              <span>Jl. Raya Kamojang - Darajat, Samarang, Garut, Jawa Barat 44161</span>
            </div>
            <div>
              <strong>INVOICE</strong>
              <span>INV-{reservation.bookingCode.replace("GH-", "")}</span>
              {cancelled && <span>Reservation Cancelled</span>}
            </div>
          </div>
          <div className="payment-invoice-info">
            <div>
              <small>Billed To</small>
              <strong>{guest.fullName}</strong>
              <span>{guest.phone}</span>
              <span>{guest.email ?? ""}</span>
            </div>
            <div>
              <small>Booking Ref</small>
              <strong>{reservation.bookingCode}</strong>
              <span>{dateLabel(reservation.checkInDate)} – {dateLabel(reservation.checkOutDate)}</span>
              <span>{summary.nights} night{summary.nights === 1 ? "" : "s"}</span>
            </div>
          </div>

          <div className="payment-detail-table-scroll">
            <table className="payment-detail-table">
              <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Subtotal</th></tr></thead>
              <tbody>
                {detail.charges.map((charge) => (
                  <tr key={charge.id}>
                    <td>{charge.description}</td>
                    <td>{charge.quantity}</td>
                    <td>{money(charge.unitAmount)}</td>
                    <td>{money(charge.amount)}</td>
                  </tr>
                ))}
                {detail.charges.length === 0 && <tr><td colSpan={4}>Tidak ada item.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="payment-invoice-totals">
            <div><span>Total Charges</span><strong>{money(summary.bookingTotal)}</strong></div>
            <div><span>Amount Paid</span><strong>{money(summary.grossPaidAmount)}</strong></div>
            {summary.refundedAmount > 0 && <div><span>Refund Completed</span><strong>−{money(summary.refundedAmount)}</strong></div>}
            {cancelled
              ? <div><span>Net Paid After Refund</span><strong>{money(summary.grossPaidAmount - summary.refundedAmount)}</strong></div>
              : <div><span>Balance Due</span><strong>{money(summary.remainingBalance)}</strong></div>}
          </div>

          {(detail.payments.length > 0 || detail.refunds.length > 0) && (
            <section className="payment-invoice-history">
              <h3>Payment &amp; Refund Transactions</h3>
              <div className="payment-detail-table-scroll">
                <table className="payment-detail-table">
                  <thead><tr><th>Type</th><th>Date</th><th>Method / Reference</th><th>Status</th><th>Amount</th></tr></thead>
                  <tbody>
                    {detail.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>Payment</td>
                        <td>{payment.paidAt ? dateLabel(payment.paidAt) : "—"}</td>
                        <td>{payment.method?.name ?? "—"}{payment.providerReference ? ` · ${payment.providerReference}` : ""}</td>
                        <td>{payment.status.replaceAll("_", " ")}</td>
                        <td>{money(payment.amount)}</td>
                      </tr>
                    ))}
                    {detail.refunds.map((refund) => (
                      <tr key={refund.id}>
                        <td>Refund</td>
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

          {cancelled && (
            <section className="payment-invoice-cancellation">
              <h3>Cancellation &amp; Refund</h3>
              {refundLoading && <p>Memuat perhitungan pembatalan...</p>}
              {refundError && <p role="alert">Perhitungan pembatalan gagal dimuat: {refundError}</p>}
              {settlement && <>
                <p>Kebijakan yang tersimpan saat reservasi dibuat, dihitung berdasarkan pembatalan {settlement.policy.daysBeforeCheckIn >= 0
                  ? `${settlement.policy.daysBeforeCheckIn} hari sebelum check-in`
                  : "setelah tanggal check-in"}.</p>
                {settlement.policy.rooms.length > 0 ? (
                  <div className="payment-invoice-policy-rooms">
                    {settlement.policy.rooms.map((room) => (
                      <div key={room.roomIndex}>
                        <strong>{room.roomTypeName} · Room {room.roomIndex + 1}</strong>
                        <span>{room.policyName ?? "Perlu ditinjau"}</span>
                        <small>{room.appliedRule
                          ? cancellationRuleLabel(room.appliedRule)
                          : room.policyName === "100% cancellation charge"
                            ? "Non-refundable · 100% harga kamar"
                            : "Aturan memerlukan peninjauan manual"}</small>
                        <span>Harga kamar {money(room.roomTotal)} · Biaya pembatalan {room.cancellationCharge === null ? "Review" : money(room.cancellationCharge)}</span>
                      </div>
                    ))}
                  </div>
                ) : <p>{settlement.policy.name ?? "Kebijakan memerlukan peninjauan manual"}</p>}
                <div className="payment-invoice-cancellation-totals">
                  <div><span>Room Charges</span><strong>{money(settlement.amounts.roomTotal)}</strong></div>
                  <div><span>Other Charges</span><strong>{money(settlement.amounts.otherCharges)}</strong></div>
                  <div><span>Cancellation Charge</span><strong>{settlement.amounts.cancellationCharge === null ? "Review" : money(settlement.amounts.cancellationCharge)}</strong></div>
                  <div><span>Remaining Refund Limit Under Policy</span><strong>{settlement.amounts.maximumRefundWithoutOverride === null ? "Review" : money(settlement.amounts.maximumRefundWithoutOverride)}</strong></div>
                  {refundEligibility.pendingRefundAmount > 0 && <div><span>Refund Pending</span><strong>{money(refundEligibility.pendingRefundAmount)}</strong></div>}
                  <div><span>Refund Completed</span><strong>{money(refundEligibility.refundedAmount)}</strong></div>
                </div>
                {settlement.reviewReasons.length > 0 && <p>Perhitungan memerlukan peninjauan: {settlement.reviewReasons.join("; ")}.</p>}
                <small>Refund yang selesai dicatat terpisah dari batas menurut kebijakan. Pengecualian kebijakan dapat menghasilkan jumlah refund yang berbeda.</small>
              </>}
            </section>
          )}
          <p>Deposit jaminan dicatat terpisah dari tagihan reservasi.</p>
        </div>
      </section>
    </div>
  );
}
