"use client";

import { useEffect, useState } from "react";
import { formatRupiah } from "../../lib/walk-in-data";
import { recordReservationPayment, type ReservationDetail } from "../../lib/reservation-detail-data";

type Props = {
  reservation: ReservationDetail;
  onUpdate: (reservation: ReservationDetail, message: string) => void;
};

const methods = ["Bank Transfer (BCA)", "Bank Transfer (Mandiri)", "QRIS", "Payment Gateway", "Cash"];

function parseCurrency(value: string) {
  return Number(value.replace(/\D/g, "")) || 0;
}

export function RecordOutstandingPayment({ reservation, onUpdate }: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState(methods[0]);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const balance = Math.max(0, (reservation.total ?? 0) - (reservation.amountPaid ?? 0));

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onEscape(event: KeyboardEvent) { if (event.key === "Escape") setOpen(false); }
    window.addEventListener("keydown", onEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onEscape); };
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
    if (amount <= 0 || amount > balance) { setError("Jumlah pembayaran harus lebih dari Rp0 dan tidak melebihi sisa tagihan."); return; }
    const updated = recordReservationPayment(reservation.bookingId, amount, method, reference, note);
    if (!updated) { setError("Pembayaran tidak dapat disimpan."); return; }
    setOpen(false);
    onUpdate(updated, updated.paymentStatus === "Paid" ? updated.status === "Checked-in" ? "Sisa pembayaran lunas. Tamu dapat check-out." : "Sisa pembayaran lunas. Status reservasi tetap Confirmed." : "Pembayaran tambahan dicatat. Sisa tagihan tetap harus dilunasi sebelum check-out.");
  }

  return <>
    <button type="button" className="action-button reservation-detail-main-action" onClick={showDialog}>Record Payment</button>
    <p className="reservation-detail-summary-hint">Sisa tagihan {formatRupiah(balance)} wajib dilunasi sebelum check-out.</p>
    {open && <div className="reservation-operation-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="reservation-operation-modal" role="dialog" aria-modal="true" aria-labelledby="outstanding-payment-title">
        <div className="reservation-operation-header"><h2 id="outstanding-payment-title">Record Outstanding Payment</h2><button type="button" onClick={() => setOpen(false)} aria-label="Close modal">×</button></div>
        <div className="pending-detail-modal-body"><div className="reservation-operation-context"><div><strong>{reservation.guestName}</strong><span>Remaining Balance: {formatRupiah(balance)}</span></div></div><label>Amount to Pay (IDR)<input inputMode="numeric" value={formatRupiah(amount)} onChange={event => setAmount(parseCurrency(event.target.value))} /></label><label>Payment Method<select value={method} onChange={event => setMethod(event.target.value)}>{methods.map(value => <option key={value}>{value}</option>)}</select></label><label>Reference / Transaction ID<input value={reference} onChange={event => setReference(event.target.value)} /></label><label>Internal Note (Optional)<textarea rows={2} value={note} onChange={event => setNote(event.target.value)} /></label>{error && <p className="reservation-operation-error" role="alert">{error}</p>}</div>
        <div className="reservation-operation-actions"><button type="button" className="reservation-secondary-button" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="action-button" onClick={savePayment}>Save Payment</button></div>
      </section>
    </div>}
  </>;
}
