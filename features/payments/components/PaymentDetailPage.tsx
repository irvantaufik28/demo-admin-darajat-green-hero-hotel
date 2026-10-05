"use client";

import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AdminShell } from "../../../components/layout/AdminShell";
import { getCurrentUser, restoreSession } from "../../../lib/auth";
import { RefundModal } from "./RefundModal";
import { RecordPaymentModal } from "./RecordPaymentModal";
import { PaymentInvoicePreview } from "./PaymentInvoicePreview";
import { getRefundEligibility, type RefundEligibility } from "../services/payments";
import {
  getPaymentMethods,
  getReservationDetail,
  recordReservationPayment,
  type ApiReservationDetail,
  type PaymentMethodOption,
} from "../../reservations/services/api";

const money = (value: number) => `Rp${value.toLocaleString("id-ID")}`;

function label(value: string) {
  if (value === "walk_in") return "Walk-in";
  if (value === "ota") return "OTA";
  return value.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join("-");
}

function dateLabel(value: string) {
  const day = value.slice(0, 10);
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(date);
}

function paymentMessage(status: string) {
  switch (status) {
    case "paid": return { title: "Paid in Full", description: "Seluruh tagihan reservasi sudah lunas.", tone: "success" };
    case "partial": return { title: "Partially Paid", description: "Masih ada sisa tagihan yang perlu ditindaklanjuti.", tone: "warning" };
    case "unpaid": return { title: "Awaiting Payment", description: "Belum ada pembayaran yang diterima untuk reservasi ini.", tone: "warning" };
    case "failed": return { title: "Payment Failed", description: "Percobaan pembayaran gagal. Belum ada dana yang diterima.", tone: "danger" };
    case "refunded": return { title: "Refund Completed", description: "Pembayaran telah dikembalikan kepada tamu.", tone: "neutral" };
    default: return { title: label(status), description: "Lihat rincian pembayaran reservasi.", tone: "neutral" };
  }
}

type Charge = { id: string; label: string; detail: string; quantity: number; rate: number; amount: number };

function ChargeTable({ items, empty }: { items: Charge[]; empty: string }) {
  return <div className="payment-detail-table-scroll"><table className="payment-detail-table">
    <thead><tr><th>Item</th><th>Qty</th><th>Nights</th><th>Rate</th><th>Subtotal</th></tr></thead>
    <tbody>{items.length ? items.map((item) => <tr key={item.id}><td><strong>{item.label}</strong><small>{item.detail}</small></td><td>{item.quantity}</td><td>—</td><td>{money(item.rate)}</td><td>{money(item.amount)}</td></tr>) : <tr><td colSpan={5} className="payment-detail-empty">{empty}</td></tr>}</tbody>
  </table></div>;
}

export function PaymentDetailPage() {
  const { bookingId: reservationId } = useParams<{ bookingId: string }>();
  const [detail, setDetail] = useState<ApiReservationDetail | null>(null);
  const [methods, setMethods] = useState<PaymentMethodOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceRefund, setInvoiceRefund] = useState<RefundEligibility | null>(null);
  const [invoiceRefundLoading, setInvoiceRefundLoading] = useState(false);
  const [invoiceRefundError, setInvoiceRefundError] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [methodsLoading, setMethodsLoading] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [methodId, setMethodId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!(await restoreSession())) return;
    const record = await getReservationDetail(reservationId, signal);
    if (!signal?.aborted) {
      setDetail(record);
    }
  }, [reservationId]);

  async function openPaymentModal() {
    if (!detail) return;
    setAmount(detail.summary.remainingBalance);
    setError("");
    setPaymentOpen(true);
    setMethodsLoading(true);
    try {
      const options = await getPaymentMethods();
      setMethods(options);
      setMethodId(options[0]?.id ?? "");
    } catch (cause) {
      setMethods([]);
      setMethodId("");
      setError(cause instanceof Error ? cause.message : "Metode pembayaran gagal dimuat.");
    } finally {
      setMethodsLoading(false);
    }
  }

  useEffect(() => {
    if (!invoiceOpen || detail?.reservation.reservationStatus !== "cancelled") return;
    let active = true;
    setInvoiceRefund(null);
    setInvoiceRefundError("");
    setInvoiceRefundLoading(true);
    getRefundEligibility(reservationId)
      .then((result) => { if (active) setInvoiceRefund(result); })
      .catch((cause) => {
        if (active) setInvoiceRefundError(cause instanceof Error ? cause.message : "Perhitungan pembatalan gagal dimuat.");
      })
      .finally(() => { if (active) setInvoiceRefundLoading(false); });
    return () => { active = false; };
  }, [invoiceOpen, detail?.reservation.reservationStatus, reservationId]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    load(controller.signal).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Detail pembayaran gagal dimuat.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load]);

  async function savePayment() {
    if (!detail || !methodId || amount <= 0 || amount > detail.summary.remainingBalance) {
      setError("Jumlah pembayaran harus lebih dari Rp0 dan tidak melebihi sisa tagihan.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await recordReservationPayment(reservationId, { idempotencyKey: crypto.randomUUID(), methodId, amount });
      await load();
      setPaymentOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pembayaran gagal dicatat.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AdminShell title="Payments" context="Payment Detail"><LoadingSkeleton variant="detail" /></AdminShell>;
  if (!detail) return <AdminShell title="Payments" context="Payment Detail"><div className="payment-detail-loading">{error || "Data pembayaran tidak ditemukan."} <Link href="/payments">Kembali ke Payments</Link></div></AdminShell>;

  const { reservation, guest, summary } = detail;
  const bookingCode = reservation.bookingCode;
  const message = paymentMessage(reservation.paymentStatus);
  const charges: Charge[] = detail.charges.map((charge) => ({
    id: charge.id,
    label: charge.description,
    detail: charge.kind === "room" ? "Room charge" : label(charge.kind),
    quantity: Number(charge.quantity),
    rate: charge.unitAmount,
    amount: charge.amount,
  }));
  const roomCharges = charges.filter((_, index) => detail.charges[index].kind === "room");
  const otherCharges = charges.filter((_, index) => detail.charges[index].kind !== "room");
  const roomSubtotal = roomCharges.reduce((sum, charge) => sum + charge.amount, 0);
  const addonsSubtotal = otherCharges.reduce((sum, charge) => sum + charge.amount, 0);
  const successfulPayments = detail.payments.filter((payment) => ["succeeded", "partially_refunded", "refunded"].includes(payment.status));
  const source = reservation.source === "ota" && detail.otaChannel ? `OTA · ${detail.otaChannel.name}` : label(reservation.source);
  const canManageRefund = getCurrentUser()?.permissions.includes("payments.refund") ?? false;

  return <AdminShell title="Payments" context={bookingCode}>
    <div className="payment-detail-page">
      <div className="payment-detail-heading"><div><nav><Link href="/payments">Payments</Link><span>/</span>{bookingCode}</nav><h1>Payment Detail <span className={`payment-detail-state payment-detail-state--${message.tone}`}>{message.title}</span></h1><p>Detail booking dan riwayat pembayaran</p></div><button type="button" onClick={() => setInvoiceOpen(true)}>▣ Print Invoice</button></div>
      <div className={`payment-detail-banner payment-detail-banner--${message.tone}`}><strong>{message.title}</strong><span>{message.description}</span></div>
      <div className="payment-detail-grid"><div className="payment-detail-main">
        <section className="payment-detail-card"><header><h2>Booking &amp; Guest</h2><span className={`reservations-badge reservations-badge--${["cancelled", "expired"].includes(reservation.reservationStatus) ? "danger" : "success"}`}>{label(reservation.reservationStatus)}</span></header><div className="payment-detail-facts"><div><span>Booking ID</span><strong>{bookingCode}</strong></div><div><span>Guest</span><strong>{guest.fullName}</strong></div><div><span>Source</span><strong>{source}</strong></div><div><span>WhatsApp</span><strong>{guest.phone}</strong></div><div><span>Check-in</span><strong>{dateLabel(reservation.checkInDate)}</strong></div><div><span>Email</span><strong>{guest.email ?? "—"}</strong></div><div><span>Check-out</span><strong>{dateLabel(reservation.checkOutDate)}</strong></div><div><span>Duration &amp; Guests</span><strong>{summary.nights} Night{summary.nights === 1 ? "" : "s"} · {reservation.adults} Adults{reservation.children ? `, ${reservation.children} Children` : ""}</strong></div></div></section>
        <section className="payment-detail-card"><header><h2>Rooms</h2></header><ChargeTable items={roomCharges} empty="Rincian kamar belum tersedia." /></section>
        <section className="payment-detail-card"><header><h2>Add-ons</h2></header><ChargeTable items={otherCharges} empty="Tidak ada add-on untuk reservasi ini." /></section>
        <section className="payment-detail-card"><header><h2>Charges &amp; Payments</h2></header><div className="payment-detail-charges"><div><span>Rooms Subtotal</span><strong>{money(roomSubtotal)}</strong></div><div><span>Add-ons &amp; Adjustments</span><strong>{money(addonsSubtotal)}</strong></div><div className="payment-detail-total"><span>Booking Total</span><strong>{money(summary.bookingTotal)}</strong></div></div></section>
        <section className="payment-detail-card"><header><h2>Payment History</h2></header><div className="payment-detail-table-scroll"><table className="payment-detail-table"><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th><th>Recorded By</th></tr></thead><tbody>{successfulPayments.map((payment) => <tr key={payment.id}><td>{payment.paidAt ? dateLabel(payment.paidAt) : "—"}</td><td className="payment-detail-positive">{money(payment.amount)}</td><td>{payment.method?.name ?? "—"}</td><td>{payment.providerReference ?? "—"}</td><td>{payment.recordedBy?.name ?? "—"}</td></tr>)}{detail.refunds.filter((refund) => refund.status === "succeeded").map((refund) => <tr key={refund.id}><td>{refund.processedAt ? dateLabel(refund.processedAt) : "—"}</td><td className="payment-detail-negative">−{money(refund.amount)}</td><td>Refund</td><td>{refund.providerReference ?? "—"}</td><td>{refund.processedBy?.name ?? "—"}</td></tr>)}{successfulPayments.length === 0 && summary.refundedAmount === 0 && <tr><td colSpan={5} className="payment-detail-empty">Belum ada pembayaran yang tercatat.</td></tr>}</tbody></table></div></section>
        {summary.depositBalance > 0 && <div className="payment-detail-deposit"><strong>Security Deposit: {money(summary.depositBalance)}</strong><span>Dicatat terpisah dari total reservasi.</span></div>}
      </div><aside className="payment-detail-summary"><div className="payment-detail-card"><header><h2>Payment Summary</h2><span className={`reservations-badge reservations-badge--${message.tone}`}>{label(reservation.paymentStatus)}</span></header><div className="payment-detail-summary-body"><div><span>Booking Total</span><strong>{money(summary.bookingTotal)}</strong></div><div><span>Paid</span><strong className="payment-detail-positive">{money(summary.grossPaidAmount)}</strong></div>{summary.refundedAmount > 0 && <div><span>Refunded</span><strong className="payment-detail-negative">{money(summary.refundedAmount)}</strong></div>}<div className="payment-detail-summary-balance"><span>Remaining</span><strong className={summary.remainingBalance ? "payment-detail-negative" : ""}>{money(summary.remainingBalance)}</strong></div>{summary.depositBalance > 0 && <div><span>Security Deposit</span><strong>{money(summary.depositBalance)}</strong></div>}<p>{message.description}</p>{reservation.checkoutOutstandingReason && <p>Alasan check-out dengan sisa tagihan: {reservation.checkoutOutstandingReason}</p>}{summary.remainingBalance > 0 && ["pending", "confirmed", "checked_in", "checked_out"].includes(reservation.reservationStatus) && <button type="button" onClick={openPaymentModal}>Record Payment</button>}{reservation.reservationStatus === "cancelled" && summary.grossPaidAmount > 0 && <button type="button" onClick={() => setRefundOpen(true)}>View Refund</button>}<button type="button" onClick={() => setInvoiceOpen(true)}>▣ Print Invoice</button><Link href="/payments">← Back to Payments</Link></div></div></aside></div>
    </div>
    {paymentOpen && <RecordPaymentModal balance={summary.remainingBalance} amount={amount} methodId={methodId} methods={methods} loadingMethods={methodsLoading} saving={saving} error={error} onAmountChange={setAmount} onMethodChange={setMethodId} onClose={() => setPaymentOpen(false)} onSave={savePayment} />}
    {refundOpen && <RefundModal reservationId={reservationId} canManage={canManageRefund} onClose={() => setRefundOpen(false)} onChanged={() => load()} />}
    {invoiceOpen && (
      <PaymentInvoicePreview
        detail={detail}
        refundEligibility={invoiceRefund}
        refundLoading={invoiceRefundLoading}
        refundError={invoiceRefundError}
        onClose={() => setInvoiceOpen(false)}
      />
    )}
  </AdminShell>;
}
