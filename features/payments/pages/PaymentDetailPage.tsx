"use client";
import "../../reservations/styles/reservations.css";
import "../styles/payments.css";

import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AdminShell } from "../../../components/layout/AdminShell";
import { getCurrentUser, restoreSession } from "../../../lib/auth";
import { RefundModal } from "../components/RefundModal";
import { RecordPaymentModal } from "../components/RecordPaymentModal";
import { PaymentInvoicePreview } from "../components/PaymentInvoicePreview";
import { getRefundEligibility, type RefundEligibility } from "../services/payments";
import {
  getPaymentMethods,
  getReservationDetail,
  recordReservationPayment,
  type ApiReservationDetail,
  type PaymentMethodOption,
} from "../../reservations/services/api";
import {
  noShowSettlementPresentation,
  reservationDetailPresentation,
} from "../../reservations/utils/detail-rules";
import { useTranslations, type Translate } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

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

function paymentMessage(status: string, t: Translate) {
  switch (status) {
    case "paid": return { title: t("detail.state.paidTitle"), description: t("detail.state.paidDescription"), tone: "success" };
    case "partial": return { title: t("detail.state.partialTitle"), description: t("detail.state.partialDescription"), tone: "warning" };
    case "unpaid": return { title: t("detail.state.unpaidTitle"), description: t("detail.state.unpaidDescription"), tone: "warning" };
    case "failed": return { title: t("detail.state.failedTitle"), description: t("detail.state.failedDescription"), tone: "danger" };
    case "refunded": return { title: t("detail.state.refundedTitle"), description: t("detail.state.refundedDescription"), tone: "neutral" };
    default: return { title: label(status), description: t("detail.state.defaultDescription"), tone: "neutral" };
  }
}

type Charge = { id: string; label: string; detail: string; quantity: number; rate: number; amount: number };

function ChargeTable({ items, empty, t }: { items: Charge[]; empty: string; t: Translate }) {
  return <div className="payment-detail-table-scroll"><table className="payment-detail-table">
    <thead><tr><th>{t("detail.charges.item")}</th><th>{t("detail.charges.qty")}</th><th>{t("detail.charges.nights")}</th><th>{t("detail.charges.rate")}</th><th>{t("detail.charges.subtotal")}</th></tr></thead>
    <tbody>{items.length ? items.map((item) => <tr key={item.id}><td><strong>{item.label}</strong><small>{item.detail}</small></td><td>{item.quantity}</td><td>—</td><td>{money(item.rate)}</td><td>{money(item.amount)}</td></tr>) : <tr><td colSpan={5} className="payment-detail-empty">{empty}</td></tr>}</tbody>
  </table></div>;
}

export function PaymentDetailPage() {
  const { t } = useTranslations({ en, id });
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
      setError(cause instanceof Error ? cause.message : t("detail.messages.methodsLoadError"));
    } finally {
      setMethodsLoading(false);
    }
  }

  async function openInvoicePreview() {
    setInvoiceRefund(null);
    setInvoiceRefundError("");
    setInvoiceOpen(true);
    if (
      !["cancelled", "no_show"].includes(
        detail?.reservation.reservationStatus ?? "",
      )
    )
      return;
    setInvoiceRefundLoading(true);
    try {
      setInvoiceRefund(await getRefundEligibility(reservationId));
    } catch (cause) {
      setInvoiceRefundError(
        cause instanceof Error
          ? cause.message
          : t("detail.messages.refundCalcLoadError"),
      );
    } finally {
      setInvoiceRefundLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve()
      .then(() => load(controller.signal))
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : t("detail.messages.detailLoadError"),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [load, t]);

  async function savePayment() {
    if (!detail || !methodId || amount <= 0 || amount > detail.summary.remainingBalance) {
      setError(t("detail.messages.amountInvalid"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await recordReservationPayment(reservationId, { idempotencyKey: crypto.randomUUID(), methodId, amount });
      await load();
      setPaymentOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("detail.messages.recordError"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AdminShell title={t("shell.title")} context={t("detail.shellContext")}><LoadingSkeleton variant="detail" /></AdminShell>;
  if (!detail) return <AdminShell title={t("shell.title")} context={t("detail.shellContext")}><div className="payment-detail-loading">{error || t("detail.messages.notFound")} <Link href="/payments">{t("detail.backToPaymentsLink")}</Link></div></AdminShell>;

  const { reservation, guest, summary } = detail;
  const bookingCode = reservation.bookingCode;
  const message =
    reservation.reservationStatus === "no_show"
      ? reservationDetailPresentation(detail)
      : paymentMessage(reservation.paymentStatus, t);
  const noShowSettlement =
    reservation.reservationStatus === "no_show"
      ? noShowSettlementPresentation(detail)
      : null;
  const charges: Charge[] = detail.charges.map((charge) => ({
    id: charge.id,
    label: charge.description,
    detail: charge.kind === "room" ? t("detail.charges.roomCharge") : label(charge.kind),
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

  return <AdminShell title={t("shell.title")} context={bookingCode}>
    <div className="payment-detail-page">
      <div className="payment-detail-heading"><div><nav><Link href="/payments">{t("detail.breadcrumb")}</Link><span>/</span>{bookingCode}</nav><h1>{t("detail.title")} <span className={`payment-detail-state payment-detail-state--${message.tone}`}>{message.title}</span></h1><p>{t("detail.subtitle")}</p></div><button type="button" onClick={openInvoicePreview}>▣ {t("detail.printInvoice")}</button></div>
      <div className={`payment-detail-banner payment-detail-banner--${message.tone}`}><strong>{message.title}</strong><span>{message.description}</span></div>
      <div className="payment-detail-grid"><div className="payment-detail-main">
        <section className="payment-detail-card"><header><h2>{t("detail.cards.bookingGuest")}</h2><span className={`reservations-badge reservations-badge--${["cancelled", "expired"].includes(reservation.reservationStatus) ? "danger" : "success"}`}>{label(reservation.reservationStatus)}</span></header><div className="payment-detail-facts"><div><span>{t("detail.facts.bookingId")}</span><strong>{bookingCode}</strong></div><div><span>{t("detail.facts.guest")}</span><strong>{guest.fullName}</strong></div><div><span>{t("detail.facts.source")}</span><strong>{source}</strong></div><div><span>{t("detail.facts.whatsapp")}</span><strong>{guest.phone}</strong></div><div><span>{t("detail.facts.checkIn")}</span><strong>{dateLabel(reservation.checkInDate)}</strong></div><div><span>{t("detail.facts.email")}</span><strong>{guest.email ?? "—"}</strong></div><div><span>{t("detail.facts.checkOut")}</span><strong>{dateLabel(reservation.checkOutDate)}</strong></div><div><span>{t("detail.facts.durationGuests")}</span><strong>{summary.nights} {summary.nights === 1 ? t("detail.facts.night") : t("detail.facts.nights")} · {reservation.adults} {t("detail.facts.adults")}{reservation.children ? `, ${reservation.children} ${t("detail.facts.children")}` : ""}</strong></div></div></section>
        <section className="payment-detail-card"><header><h2>{t("detail.cards.rooms")}</h2></header><ChargeTable items={roomCharges} empty={t("detail.charges.roomsEmpty")} t={t} /></section>
        <section className="payment-detail-card"><header><h2>{t("detail.cards.addOns")}</h2></header><ChargeTable items={otherCharges} empty={t("detail.charges.addOnsEmpty")} t={t} /></section>
        <section className="payment-detail-card"><header><h2>{t("detail.cards.chargesPayments")}</h2></header><div className="payment-detail-charges"><div><span>{t("detail.charges.roomsSubtotal")}</span><strong>{money(roomSubtotal)}</strong></div><div><span>{t("detail.charges.addOnsAdjustments")}</span><strong>{money(addonsSubtotal)}</strong></div><div className="payment-detail-total"><span>{t("detail.charges.bookingTotal")}</span><strong>{money(summary.bookingTotal)}</strong></div></div></section>
        <section className="payment-detail-card"><header><h2>{t("detail.cards.paymentHistory")}</h2></header><div className="payment-detail-table-scroll"><table className="payment-detail-table"><thead><tr><th>{t("detail.history.date")}</th><th>{t("detail.history.amount")}</th><th>{t("detail.history.method")}</th><th>{t("detail.history.reference")}</th><th>{t("detail.history.recordedBy")}</th></tr></thead><tbody>{successfulPayments.map((payment) => <tr key={payment.id}><td>{payment.paidAt ? dateLabel(payment.paidAt) : "—"}</td><td className="payment-detail-positive">{money(payment.amount)}</td><td>{payment.method?.name ?? "—"}</td><td>{payment.providerReference ?? "—"}</td><td>{payment.recordedBy?.name ?? "—"}</td></tr>)}{detail.refunds.filter((refund) => refund.status === "succeeded").map((refund) => <tr key={refund.id}><td>{refund.processedAt ? dateLabel(refund.processedAt) : "—"}</td><td className="payment-detail-negative">−{money(refund.amount)}</td><td>{t("detail.history.refund")}</td><td>{refund.providerReference ?? "—"}</td><td>{refund.processedBy?.name ?? "—"}</td></tr>)}{successfulPayments.length === 0 && summary.refundedAmount === 0 && <tr><td colSpan={5} className="payment-detail-empty">{t("detail.history.empty")}</td></tr>}</tbody></table></div></section>
        {summary.depositBalance > 0 && <div className="payment-detail-deposit"><strong>{t("detail.summary.securityDeposit")}: {money(summary.depositBalance)}</strong><span>{t("detail.summary.securityDepositNote")}</span></div>}
      </div><aside className="payment-detail-summary"><div className="payment-detail-card"><header><h2>{t("detail.cards.paymentSummary")}</h2><span className={`reservations-badge reservations-badge--${message.tone}`}>{label(reservation.paymentStatus)}</span></header><div className="payment-detail-summary-body"><div><span>{t("detail.summary.bookingTotal")}</span><strong>{money(summary.bookingTotal)}</strong></div><div><span>{t("detail.summary.paid")}</span><strong className="payment-detail-positive">{money(summary.grossPaidAmount)}</strong></div>{summary.refundedAmount > 0 && <div><span>{t("detail.summary.refunded")}</span><strong className="payment-detail-negative">{money(summary.refundedAmount)}</strong></div>}<div className="payment-detail-summary-balance"><span>{t("detail.summary.remaining")}</span><strong className={summary.remainingBalance ? "payment-detail-negative" : ""}>{money(summary.remainingBalance)}</strong></div>{summary.depositBalance > 0 && <div><span>{t("detail.summary.securityDeposit")}</span><strong>{money(summary.depositBalance)}</strong></div>}{noShowSettlement && <div><span>{t("detail.summary.settlement")}</span><strong>{noShowSettlement.label}</strong></div>}<p>{message.description}</p>{reservation.checkoutOutstandingReason && <p>{t("detail.summary.checkoutOutstandingReason", { reason: reservation.checkoutOutstandingReason })}</p>}{summary.remainingBalance > 0 && ["pending", "confirmed", "checked_in", "checked_out"].includes(reservation.reservationStatus) && <button type="button" onClick={openPaymentModal}>{t("detail.summary.recordPayment")}</button>}{((reservation.reservationStatus === "cancelled" && summary.grossPaidAmount > 0) || (reservation.reservationStatus === "no_show" && noShowSettlement?.status !== "settled" && (summary.grossPaidAmount > 0 || summary.depositBalance > 0))) && <button type="button" onClick={() => setRefundOpen(true)}>{t("detail.summary.viewRefund")}</button>}<button type="button" onClick={openInvoicePreview}>▣ {t("detail.printInvoice")}</button><Link href="/payments">← {t("detail.backToPayments")}</Link></div></div></aside></div>
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
