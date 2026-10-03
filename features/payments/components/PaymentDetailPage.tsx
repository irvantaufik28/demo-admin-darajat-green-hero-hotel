"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AdminShell } from "../../../components/layout/AdminShell";
import { RecordOutstandingPayment } from "../../reservations/components/RecordOutstandingPayment";
import { loadReservationDetail, type ReservationDetail } from "../../reservations/constants/reservation-detail-data";
import { calculateNights, extraBedRates, extras, getExtraCost, roomTypes } from "../../reservations/constants/walk-in-data";

const money = (value: number) => `Rp${value.toLocaleString("id-ID")}`;
const dateLabel = (value: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));

function paymentMessage(status: string) {
  switch (status) {
    case "Paid": return { title: "Paid in Full", description: "Seluruh tagihan reservasi sudah lunas.", tone: "success" };
    case "Partial": return { title: "Partially Paid", description: "Masih ada sisa tagihan yang perlu ditindaklanjuti.", tone: "warning" };
    case "Unpaid": return { title: "Awaiting Payment", description: "Belum ada pembayaran yang diterima untuk reservasi ini.", tone: "warning" };
    case "Failed": return { title: "Payment Failed", description: "Percobaan pembayaran gagal. Belum ada dana yang diterima.", tone: "danger" };
    case "Refunded": return { title: "Refund Completed", description: "Pembayaran telah dikembalikan kepada tamu.", tone: "neutral" };
    case "Expired": return { title: "Payment Expired", description: "Batas pembayaran telah berakhir.", tone: "neutral" };
    default: return { title: status, description: "Lihat rincian pembayaran reservasi.", tone: "neutral" };
  }
}

type Charge = { label: string; detail: string; quantity: number; nights: number | null; rate: number; amount: number };

function chargeItems(row: ReservationDetail, nights: number): { rooms: Charge[]; addons: Charge[]; adjustment: number } {
  const rooms = roomTypes.flatMap((type) => {
    const quantity = row.quantities?.[type.id] ?? 0;
    return quantity ? [{ label: type.name, detail: row.assignments?.[type.id]?.length ? `Room ${row.assignments[type.id].join(", ")}` : "Room number not assigned", quantity, nights, rate: type.rate, amount: quantity * nights * type.rate }] : [];
  });
  const addons: Charge[] = (row.selectedExtras ?? []).flatMap((id) => {
    const extra = extras.find((item) => item.id === id);
    if (!extra) return [];
    const quantity = row.extraQuantities?.[id] ?? 1;
    return [{ label: extra.label, detail: extra.perNight ? "Per night" : "Per package", quantity, nights: extra.perNight ? nights : null, rate: extra.price, amount: getExtraCost(id, quantity, nights) }];
  });
  Object.entries(row.roomExtraBeds ?? {}).forEach(([unit, quantity]) => {
    const type = roomTypes.find((item) => unit.startsWith(`${item.id}-`));
    if (!type || quantity < 1) return;
    const rate = extraBedRates[type.id];
    addons.push({ label: `Extra Bed · ${type.name}`, detail: unit, quantity, nights, rate, amount: quantity * nights * rate });
  });
  const subtotal = [...rooms, ...addons].reduce((sum, item) => sum + item.amount, 0);
  return { rooms, addons, adjustment: (row.total ?? subtotal) - subtotal };
}

function ChargeTable({ items, empty }: { items: Charge[]; empty: string }) {
  return <div className="payment-detail-table-scroll"><table className="payment-detail-table"><thead><tr><th>Item</th><th>Qty</th><th>Nights</th><th>Rate</th><th>Subtotal</th></tr></thead><tbody>{items.length ? items.map((item, index) => <tr key={`${item.label}-${index}`}><td><strong>{item.label}</strong><small>{item.detail}</small></td><td>{item.quantity}</td><td>{item.nights ?? "—"}</td><td>{money(item.rate)}</td><td>{money(item.amount)}</td></tr>) : <tr><td colSpan={5} className="payment-detail-empty">{empty}</td></tr>}</tbody></table></div>;
}

export function PaymentDetailPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [reservation, setReservation] = useState<ReservationDetail | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  useEffect(() => { setReservation(loadReservationDetail(bookingId)); setLoaded(true); }, [bookingId]);
  const nights = reservation ? Math.max(1, calculateNights(reservation.checkIn, reservation.checkOut)) : 1;
  const charges = useMemo(() => reservation ? chargeItems(reservation, nights) : null, [reservation, nights]);

  if (!loaded) return <AdminShell title="Payments" context="Payment Detail"><div className="payment-detail-loading">Memuat detail pembayaran...</div></AdminShell>;
  if (!reservation || !charges) return <AdminShell title="Payments" context="Payment Detail"><div className="payment-detail-loading">Data pembayaran tidak ditemukan. <Link href="/payments">Kembali ke Payments</Link></div></AdminShell>;

  const total = reservation.total ?? 0;
  const paid = reservation.paymentStatus === "Refunded" ? total : reservation.amountPaid ?? 0;
  const refunded = reservation.paymentStatus === "Refunded" ? total : 0;
  const remaining = reservation.paymentStatus === "Refunded" ? 0 : Math.max(0, total - paid);
  const message = paymentMessage(reservation.paymentStatus);
  const roomSubtotal = charges.rooms.reduce((sum, item) => sum + item.amount, 0);
  const addonsSubtotal = charges.addons.reduce((sum, item) => sum + item.amount, 0);
  const transactions = reservation.paymentTransactions ?? [];
  const paymentHistory = transactions.length ? transactions.map((item) => ({ date: dateLabel(item.recordedAt.slice(0, 10)), amount: item.amount, method: item.method, reference: item.reference || "—", by: "Front Office" })) : paid > 0 ? [{ date: dateLabel(`20${reservation.bookingId.slice(3, 5)}-${reservation.bookingId.slice(5, 7)}-${reservation.bookingId.slice(7, 9)}`), amount: paid, method: reservation.paymentMethod ?? "—", reference: reservation.reference ?? "—", by: reservation.source === "Website" || reservation.source === "OTA" ? "Online" : "Front Office" }] : [];

  return <AdminShell title="Payments" context={reservation.bookingId}>
    <div className="payment-detail-page">
      <div className="payment-detail-heading"><div><nav><Link href="/payments">Payments</Link><span>/</span>{reservation.bookingId}</nav><h1>Payment Detail <span className={`payment-detail-state payment-detail-state--${message.tone}`}>{message.title}</span></h1><p>Detail booking dan riwayat pembayaran</p></div><button type="button" onClick={() => setInvoiceOpen(true)}>▣ Print Invoice</button></div>
      <div className={`payment-detail-banner payment-detail-banner--${message.tone}`}><strong>{message.title}</strong><span>{message.description}</span></div>
      <div className="payment-detail-grid"><div className="payment-detail-main">
        <section className="payment-detail-card"><header><h2>Booking &amp; Guest</h2><span className={`reservations-badge reservations-badge--${reservation.status === "Cancelled" || reservation.status === "Expired" ? "danger" : "success"}`}>{reservation.status}</span></header><div className="payment-detail-facts"><div><span>Booking ID</span><strong>{reservation.bookingId}</strong></div><div><span>Guest</span><strong>{reservation.guestName}</strong></div><div><span>Source</span><strong>{reservation.source === "OTA" && reservation.channel ? `OTA · ${reservation.channel}` : reservation.source}</strong></div><div><span>WhatsApp</span><strong>{reservation.whatsapp}</strong></div><div><span>Check-in</span><strong>{dateLabel(reservation.checkIn)}</strong></div><div><span>Email</span><strong>{reservation.email ?? "—"}</strong></div><div><span>Check-out</span><strong>{dateLabel(reservation.checkOut)}</strong></div><div><span>Duration &amp; Guests</span><strong>{nights} Night{nights > 1 ? "s" : ""} · {reservation.adults ?? 2} Adults{reservation.children ? `, ${reservation.children} Children` : ""}</strong></div></div></section>
        <section className="payment-detail-card"><header><h2>Rooms</h2></header><ChargeTable items={charges.rooms} empty="Rincian kamar belum tersedia." /></section>
        <section className="payment-detail-card"><header><h2>Add-ons</h2></header><ChargeTable items={charges.addons} empty="Tidak ada add-on untuk reservasi ini." /></section>
        <section className="payment-detail-card"><header><h2>Charges &amp; Payments</h2></header><div className="payment-detail-charges"><div><span>Rooms Subtotal</span><strong>{money(roomSubtotal)}</strong></div><div><span>Add-ons</span><strong>{money(addonsSubtotal)}</strong></div>{charges.adjustment !== 0 && <div><span>Rate Adjustment / Discount</span><strong>{charges.adjustment < 0 ? "−" : "+"}{money(Math.abs(charges.adjustment))}</strong></div>}<div className="payment-detail-total"><span>Booking Total</span><strong>{money(total)}</strong></div></div></section>
        <section className="payment-detail-card"><header><h2>Payment History</h2></header><div className="payment-detail-table-scroll"><table className="payment-detail-table"><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th><th>Recorded By</th></tr></thead><tbody>{paymentHistory.map((item, index) => <tr key={index}><td>{item.date}</td><td className="payment-detail-positive">{money(item.amount)}</td><td>{item.method}</td><td>{item.reference}</td><td>{item.by}</td></tr>)}{refunded > 0 && <tr><td>{dateLabel(reservation.checkOut)}</td><td className="payment-detail-negative">−{money(refunded)}</td><td>Refund</td><td>—</td><td>Front Office</td></tr>}{paymentHistory.length === 0 && refunded === 0 && <tr><td colSpan={5} className="payment-detail-empty">{reservation.paymentStatus === "Failed" ? "Pembayaran gagal; belum ada transaksi berhasil." : "Belum ada pembayaran yang tercatat."}</td></tr>}</tbody></table></div></section>
        {Boolean(reservation.depositAmount) && <div className="payment-detail-deposit"><strong>Security Deposit: {money(reservation.depositAmount ?? 0)}</strong><span>Dicatat terpisah dari total reservasi.</span></div>}
      </div><aside className="payment-detail-summary"><div className="payment-detail-card"><header><h2>Payment Summary</h2><span className={`reservations-badge reservations-badge--${message.tone}`}>{reservation.paymentStatus}</span></header><div className="payment-detail-summary-body"><div><span>Booking Total</span><strong>{money(total)}</strong></div><div><span>Paid</span><strong className="payment-detail-positive">{money(paid)}</strong></div>{refunded > 0 && <div><span>Refunded</span><strong className="payment-detail-negative">{money(refunded)}</strong></div>}<div className="payment-detail-summary-balance"><span>Remaining</span><strong className={remaining ? "payment-detail-negative" : ""}>{money(remaining)}</strong></div>{Boolean(reservation.depositAmount) && <div><span>Security Deposit</span><strong>{money(reservation.depositAmount ?? 0)}</strong></div>}<p>{message.description}</p>{reservation.checkoutOutstandingReason && <p>Alasan check-out dengan sisa tagihan: {reservation.checkoutOutstandingReason}</p>}{["Unpaid", "Partial"].includes(reservation.paymentStatus) && ["Pending", "Confirmed", "Checked-in", "Checked-out"].includes(reservation.status) && <RecordOutstandingPayment reservation={reservation} onUpdate={(updated) => setReservation(updated)} />}<button type="button" onClick={() => setInvoiceOpen(true)}>▣ Print Invoice</button><Link href="/payments">← Back to Payments</Link></div></div></aside></div>
    </div>
    {invoiceOpen && <div className="payment-invoice-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setInvoiceOpen(false); }}><section className="payment-invoice-modal" role="dialog" aria-modal="true" aria-label="Invoice preview"><header><h2>Official Guest Invoice Preview</h2><div><button type="button" onClick={() => window.print()}>Print / Save PDF</button><button type="button" aria-label="Close invoice" onClick={() => setInvoiceOpen(false)}>×</button></div></header><div className="payment-invoice-paper"><div className="payment-invoice-brand"><div><strong>Green Hero Darajat</strong><span>Jl. Raya Kamojang - Darajat, Samarang, Garut, Jawa Barat 44161</span></div><div><strong>INVOICE</strong><span>INV-{reservation.bookingId.replace("GH-", "")}</span><span className={`payment-detail-state payment-detail-state--${message.tone}`}>{message.title}</span></div></div><div className="payment-invoice-info"><div><small>Billed To</small><strong>{reservation.guestName}</strong><span>{reservation.whatsapp}</span><span>{reservation.email ?? ""}</span></div><div><small>Booking Ref</small><strong>{reservation.bookingId}</strong><span>{dateLabel(reservation.checkIn)} – {dateLabel(reservation.checkOut)}</span><span>{nights} night{nights > 1 ? "s" : ""}</span></div></div><ChargeTable items={[...charges.rooms, ...charges.addons]} empty="Tidak ada item." /><div className="payment-invoice-totals"><div><span>Subtotal</span><strong>{money(roomSubtotal + addonsSubtotal)}</strong></div>{charges.adjustment !== 0 && <div><span>Rate Adjustment / Discount</span><strong>{charges.adjustment < 0 ? "−" : "+"}{money(Math.abs(charges.adjustment))}</strong></div>}<div><span>Total Charges</span><strong>{money(total)}</strong></div><div><span>Amount Paid</span><strong>{money(paid)}</strong></div>{refunded > 0 && <div><span>Refunded</span><strong>{money(refunded)}</strong></div>}<div><span>Balance Due</span><strong>{money(remaining)}</strong></div></div><p>Deposit jaminan dicatat terpisah dari tagihan reservasi.</p></div></section></div>}
  </AdminShell>;
}
