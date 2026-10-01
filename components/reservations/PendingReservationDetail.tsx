"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { AdminShell } from "../layout/AdminShell";
import {
  calculateNights,
  extraBedRates,
  extras,
  formatRupiah,
  formatStayDate,
  getExtraCost,
  getRoomExtraBedsTotal,
  roomTypes,
} from "../../lib/walk-in-data";
import {
  cancelUnpaidReservation,
  recordReservationPayment,
  type ReservationDetail,
} from "../../lib/reservation-detail-data";
import { PendingCheckInAction } from "./PendingCheckInAction";
import { ConfirmReservationAction } from "./ConfirmReservationAction";
import { isAutoConfirmedSource } from "../../lib/reservation-list-data";

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
  const whatsappMessage = `Halo ${reservation.guestName}, pengingat pembayaran reservasi ${reservation.bookingId} di Green Hero Darajat. Sisa tagihan: ${formatRupiah(balance)}.`;

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
        "Jumlah pembayaran harus lebih dari Rp0 dan tidak melebihi sisa tagihan.",
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
      setError("Pembayaran tidak dapat disimpan. Periksa kembali jumlahnya.");
      return;
    }
    setModal(null);
    onUpdate(
      updated,
      updated.status === "Confirmed" && isPending
        ? "Pembayaran lunas dicatat. Reservasi otomatis dikonfirmasi."
        : updated.paymentStatus === "Paid"
          ? `Pembayaran lunas dicatat. Reservasi tetap ${updated.status}.`
          : `Pembayaran sebagian berhasil dicatat. Reservasi tetap ${updated.status}.`,
    );
  }

  function cancelReservation() {
    const updated = cancelUnpaidReservation(
      reservation.bookingId,
      cancellationReason,
      cancellationNote,
    );
    if (!updated) {
      setError("Hold tidak dapat dilepas untuk reservasi ini.");
      return;
    }
    setModal(null);
    onUpdate(
      updated,
      "Reservasi tanpa pembayaran dibatalkan. Status kini Cancelled / Unpaid.",
    );
  }

  return (
    <AdminShell title="Reservations" context={reservation.bookingId}>
      <div className="pending-detail-page">
        <header className="pending-detail-heading">
          <div>
            <div className="pending-detail-heading-line">
              <h1>Reservation Detail</h1>
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
                ? "Created via Front Desk Phone Log"
                : `Source: ${reservation.source}`}
            </p>
          </div>
          <div className="pending-detail-heading-actions">
            <Link href="/reservations" className="reservation-secondary-button">
              ← All Reservations
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
              aria-label="Tutup pesan"
            >
              ×
            </button>
          </div>
        )}
        {isPending && (
          <div className="pending-detail-hold">
            <div>
              <strong>Hold Reservation Active:</strong> Check-in is available
              after staff confirmation of the outstanding balance.
            </div>
            <span>
              {reservation.paymentStatus === "Unpaid"
                ? "Awaiting Payment"
                : "Partial Payment"}
            </span>
          </div>
        )}
        <div className="pending-detail-columns">
          <div className="pending-detail-main">
            <PendingSection
              title="Guest Information"
              aside={
                <span className="pending-detail-section-tag">
                  Primary Contact
                </span>
              }
            >
              <div className="pending-detail-guest-grid">
                <div>
                  <small>Full Name</small>
                  <strong>{reservation.guestName}</strong>
                </div>
                <div>
                  <small>WhatsApp / Phone</small>
                  <strong>{reservation.whatsapp}</strong>
                </div>
                <div>
                  <small>Email Address</small>
                  <strong>{reservation.email || "—"}</strong>
                </div>
              </div>
              {reservation.notes && (
                <div className="pending-detail-notes">
                  <small>Guest Notes</small>
                  <p>{reservation.notes}</p>
                </div>
              )}
            </PendingSection>
            <PendingSection
              title="Stay Details"
              aside={
                <span>
                  {nights} {nights === 1 ? "Night" : "Nights"} Stay
                </span>
              }
            >
              <div className="pending-detail-stay-grid">
                <div>
                  <small>Check-in</small>
                  <strong>{dateLabel(reservation.checkIn)}</strong>
                  <span>From 14:00 WIB</span>
                </div>
                <div>
                  <small>Check-out</small>
                  <strong>{dateLabel(reservation.checkOut)}</strong>
                  <span>Until 12:00 WIB</span>
                </div>
                <div>
                  <small>Duration</small>
                  <strong>
                    {nights} {nights === 1 ? "Night" : "Nights"}
                  </strong>
                </div>
                <div>
                  <small>Total Guests</small>
                  <strong>{reservation.adults ?? 2} Adults</strong>
                  <span>{reservation.children ?? 0} Children</span>
                </div>
              </div>
            </PendingSection>
            <PendingSection
              title="Room Allocation & Rate"
              aside={<span>Physical room numbers assigned at check-in</span>}
            >
              <div className="pending-detail-lock">
                ⌑ Room numbers are assigned during check-in.
              </div>
              <div className="pending-detail-table-scroll">
                <table className="pending-detail-table">
                  <thead>
                    <tr>
                      <th>Room Type</th>
                      <th>Qty</th>
                      <th>Nights</th>
                      <th>Rate / Night</th>
                      <th>Subtotal</th>
                      <th>Room Assignment</th>
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
                            ⌑ Not Assigned
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4}>
                        Room Total ({roomCount} Units · {nights} Nights)
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
                            ↳ Extra Bed · {type.name} #{index + 1}
                          </span>
                          <strong>
                            1 Bed · {bedNights} Nights @{" "}
                            {formatRupiah(extraBedRates[type.id])} ={" "}
                            {formatRupiah(extraBedRates[type.id] * bedNights)}
                          </strong>
                        </div>
                      ) : null;
                    }),
                  )}
                </div>
              )}
            </PendingSection>
            <PendingSection title="Experiences & Add-ons">
              <div className="pending-detail-table-scroll">
                <table className="pending-detail-table pending-detail-extras-table">
                  <thead>
                    <tr>
                      <th>Experience</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Subtotal</th>
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
                          No experiences or add-ons selected.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3}>Experiences Subtotal</td>
                      <td>{formatRupiah(extrasTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </PendingSection>
            <PendingSection
              title="Charges & Folio"
              aside={<span>Currency: IDR (Rupiah)</span>}
            >
              <div className="pending-detail-charges">
                <Pair
                  label={`Room Charges (${roomCount} ${roomCount === 1 ? "Room" : "Rooms"} · ${nights} ${nights === 1 ? "Night" : "Nights"})`}
                >
                  {formatRupiah(roomTotal)}
                </Pair>
                {extraBedsTotal > 0 && (
                  <Pair label="Extra Bed">{formatRupiah(extraBedsTotal)}</Pair>
                )}
                <Pair label="Experiences & Add-ons">
                  {formatRupiah(extrasTotal)}
                </Pair>
                <div className="pending-detail-divider" />
                <Pair label="Booking Total">{formatRupiah(total)}</Pair>
                <Pair label="Total Paid">{formatRupiah(amountPaid)}</Pair>
                <div className="pending-detail-balance">
                  <span>Remaining Balance (Outstanding)</span>
                  <strong>{formatRupiah(balance)}</strong>
                </div>
              </div>
            </PendingSection>
            <PendingSection
              title="Payment History"
              aside={
                <span>
                  {transactions.length}{" "}
                  {transactions.length === 1 ? "Transaction" : "Transactions"}
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
                      <span>Previous payment</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="pending-detail-payment-empty">
                  <strong>
                    No payment has been recorded for this reservation.
                  </strong>
                  <p>
                    Record a down payment or full payment to keep the
                    reservation active.
                  </p>
                </div>
              )}
            </PendingSection>
            <PendingSection title="Internal Notes">
              <div className="pending-detail-internal-note">
                No internal notes have been recorded.
              </div>
            </PendingSection>
          </div>
          <aside className="pending-detail-aside">
            <div className="pending-detail-summary">
              <div className="pending-detail-summary-header">
                <h2>Reservation Summary</h2>
                <span>
                  {nights} {nights === 1 ? "Night" : "Nights"}
                </span>
              </div>
              <div className="pending-detail-summary-rows">
                <Pair label="Guest">{reservation.guestName}</Pair>
                <Pair label="Stay Period">
                  {formatStayDate(reservation.checkIn)} →{" "}
                  {formatStayDate(reservation.checkOut)}
                </Pair>
                <Pair label="Room Types">
                  {roomRows
                    .map(({ type, quantity }) => `${quantity}x ${type.name}`)
                    .join(", ")}
                </Pair>
                <Pair label="Room Numbers">
                  <span className="pending-detail-locked-badge">
                    Not Assigned
                  </span>
                </Pair>
                <div className="pending-detail-divider" />
                <Pair label="Booking Total">{formatRupiah(total)}</Pair>
                <Pair label="Payment Status">
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
                <Pair label="Remaining Balance">
                  <span className="pending-detail-summary-balance">
                    {formatRupiah(balance)}
                  </span>
                </Pair>
                <Pair label="Reservation Status">
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
                  Reservasi menunggu pembayaran atau konfirmasi sebelum hold
                  berakhir.
                </p>
              ) : (
                <p className="pending-detail-summary-warning">
                  Reservasi telah dikonfirmasi. Sisa tagihan perlu disampaikan
                  sebelum check-in dan dilunasi sebelum check-out.
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
                  Record Payment
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
                    Cancel Reservation
                  </button>
                )}
              </div>
              <div className="pending-detail-disabled-operations">
                <span>Check-out requires full payment</span>
                <span>Room Assignment is completed at check-in</span>
                <span>Stay extension locked until payment is complete</span>
              </div>
            </div>
            <div className="pending-detail-assistance">
              <strong>Need Help with this booking?</strong>
              <p>
                Send a payment reminder via WhatsApp to {reservation.whatsapp}.
              </p>
              {phone ? (
                <a
                  href={`https://wa.me/${phone}?text=${encodeURIComponent(whatsappMessage)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Send WhatsApp Invoice Link
                </a>
              ) : (
                <span>WhatsApp number is unavailable.</span>
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
                    ? "Record Payment"
                    : "Cancel Reservation"}
                </h2>
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  aria-label="Close modal"
                >
                  ×
                </button>
              </div>
              {modal === "payment" ? (
                <div className="pending-detail-modal-body">
                  <div className="reservation-operation-context">
                    <div>
                      <strong>{reservation.guestName}</strong>
                      <span>Remaining Balance: {formatRupiah(balance)}</span>
                    </div>
                  </div>
                  <label>
                    Amount to Pay (IDR)
                    <input
                      inputMode="numeric"
                      value={formatRupiah(paymentAmount)}
                      onChange={(event) =>
                        setPaymentAmount(parseCurrency(event.target.value))
                      }
                    />
                    <small>
                      Enter the full balance or a smaller down payment.
                    </small>
                  </label>
                  <label>
                    Payment Method
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
                    Reference / Transaction ID
                    <input
                      value={paymentReference}
                      onChange={(event) =>
                        setPaymentReference(event.target.value)
                      }
                      placeholder="Transfer receipt reference"
                    />
                  </label>
                  <label>
                    Internal Note (Optional)
                    <textarea
                      value={paymentNote}
                      onChange={(event) => setPaymentNote(event.target.value)}
                      rows={2}
                      placeholder="Payment validation note"
                    />
                  </label>
                  <p className="pending-detail-modal-tip">
                    Payment updates the balance. Reservation remains{" "}
                    {reservation.status}
                    {isPending ? " until staff confirms it" : ""}.
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
                    This reservation has no payment to refund. Cancelling it
                    records <strong>Cancelled / Unpaid</strong>.
                  </p>
                  <label>
                    Reason
                    <select
                      value={cancellationReason}
                      onChange={(event) =>
                        setCancellationReason(event.target.value)
                      }
                    >
                      <option>Guest request</option>
                      <option>Duplicate booking</option>
                      <option>Invalid guest contact details</option>
                    </select>
                  </label>
                  <label>
                    Internal Note
                    <textarea
                      value={cancellationNote}
                      onChange={(event) =>
                        setCancellationNote(event.target.value)
                      }
                      rows={3}
                      placeholder="Optional context"
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
                  {modal === "payment" ? "Cancel" : "Keep Reservation"}
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
                    ? "Save Payment"
                    : "Confirm Cancellation"}
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
