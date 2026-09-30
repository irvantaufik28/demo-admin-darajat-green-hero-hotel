"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "../layout/AdminShell";
import { BookingSummary } from "./BookingSummary";
import { QuantityControl } from "./QuantityControl";
import { ReservationField } from "./ReservationField";
import { calculateNights, extras, formatRupiah, getExtraCost, roomTypes, type RoomType } from "../../lib/walk-in-data";
import { resolveReservationStatus } from "../../lib/reservation-list-data";

type PaymentStatus = "Paid" | "Partial" | "Unpaid";
type Quantities = Record<RoomType, number>;
type Assignments = Record<RoomType, string[]>;

const initialQuantities: Quantities = { deluxe: 2, family: 1, suite: 0 };
const initialAssignments: Assignments = { deluxe: ["201", "202"], family: ["105"], suite: [] };
const initialExtras = ["family-grill"];
const initialExtraQuantities: Record<string, number> = { "family-grill": 1 };

function parseCurrency(value: string) {
  return Number(value.replace(/\D/g, "")) || 0;
}

export function ReservationPage({ mode }: { mode: "walk-in" | "phone" }) {
  const isPhone = mode === "phone";
  const source = isPhone ? "Phone" : "Walk-in";
  const initialCheckIn = isPhone ? "2026-10-05" : "2026-09-29";
  const initialCheckOut = isPhone ? "2026-10-07" : "2026-09-30";
  const initialNotes = isPhone ? "Booking received via WhatsApp. Estimated arrival in the afternoon." : "Early check-in requested if possible";
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [quantities, setQuantities] = useState<Quantities>(initialQuantities);
  const [assignments, setAssignments] = useState<Assignments>(initialAssignments);
  const [selectedExtras, setSelectedExtras] = useState<string[]>(initialExtras);
  const [extraQuantities, setExtraQuantities] = useState<Record<string, number>>(initialExtraQuantities);
  const [addingExtra, setAddingExtra] = useState(false);
  const [guestName, setGuestName] = useState("Andi Pratama");
  const [whatsapp, setWhatsapp] = useState("+62 812 3456 7890");
  const [email, setEmail] = useState("andi@email.com");
  const [notes, setNotes] = useState(initialNotes);
  const [paymentMethod, setPaymentMethod] = useState(isPhone ? "Pay Later" : "Cash");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(isPhone ? "Unpaid" : "Paid");
  const [manualAmountPaid, setManualAmountPaid] = useState(0);
  const [requireDeposit, setRequireDeposit] = useState(!isPhone);
  const [depositAmount, setDepositAmount] = useState(500000);
  const [depositMethod, setDepositMethod] = useState("Cash");
  const [depositNote, setDepositNote] = useState("Security guarantee deposit");
  const [feedback, setFeedback] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);
  const [checkInConfirmationOpen, setCheckInConfirmationOpen] = useState(false);
  const [balanceAcknowledged, setBalanceAcknowledged] = useState(false);
  const [confirmationAssignments, setConfirmationAssignments] = useState<Assignments>(initialAssignments);

  const nights = calculateNights(checkIn, checkOut);
  const selectedRooms = Object.values(quantities).reduce((sum, quantity) => sum + quantity, 0);
  const roomTotal = roomTypes.reduce((sum, room) => sum + room.rate * quantities[room.id] * nights, 0);
  const extrasTotal = extras.reduce((sum, extra) => sum + (selectedExtras.includes(extra.id) ? getExtraCost(extra.id, extraQuantities[extra.id] ?? 1, nights) : 0), 0);
  const total = roomTotal + extrasTotal;
  const amountPaid = paymentStatus === "Paid" ? total : paymentStatus === "Unpaid" ? 0 : manualAmountPaid;
  const deposit = !isPhone && requireDeposit ? depositAmount : 0;
  const remainingBalance = Math.max(0, total - amountPaid);

  useEffect(() => {
    if (!checkInConfirmationOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onEscape(event: KeyboardEvent) { if (event.key === "Escape") setCheckInConfirmationOpen(false); }
    window.addEventListener("keydown", onEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onEscape); };
  }, [checkInConfirmationOpen]);

  function updateQuantity(type: RoomType, quantity: number) {
    const room = roomTypes.find(item => item.id === type);
    if (!room || quantity < 0 || quantity > room.available) return;
    const assigned = assignments[type].slice(0, quantity);
    while (assigned.length < quantity) {
      const next = room.numbers.find(number => !assigned.includes(number));
      if (!next) break;
      assigned.push(next);
    }
    setQuantities(current => ({ ...current, [type]: quantity }));
    setAssignments(current => ({ ...current, [type]: assigned }));
    setFeedback(null);
  }

  function updateAssignment(type: RoomType, index: number, number: string) {
    setAssignments(current => ({
      ...current,
      [type]: current[type].map((existing, currentIndex) => currentIndex === index ? number : existing),
    }));
  }

  function resetForm() {
    setCheckIn(initialCheckIn); setCheckOut(initialCheckOut);
    setAdults(2); setChildren(0); setQuantities(initialQuantities);
    setAssignments(initialAssignments); setSelectedExtras(initialExtras); setExtraQuantities(initialExtraQuantities); setAddingExtra(false);
    setGuestName("Andi Pratama"); setWhatsapp("+62 812 3456 7890");
    setEmail("andi@email.com"); setNotes(initialNotes);
    setPaymentMethod(isPhone ? "Pay Later" : "Cash"); setPaymentStatus(isPhone ? "Unpaid" : "Paid"); setManualAmountPaid(0);
    setRequireDeposit(!isPhone); setDepositAmount(500000); setDepositMethod("Cash");
    setDepositNote("Security guarantee deposit"); setFeedback(null);
    setCheckInConfirmationOpen(false); setBalanceAcknowledged(false); setConfirmationAssignments(initialAssignments);
  }

  function saveReservation(checkInGuest: boolean, draft = false, confirmed = false) {
    if (nights < 1) {
      setFeedback({ kind: "error", text: "Tanggal check-out harus setelah check-in." });
      return;
    }
    if (selectedRooms < 1) {
      setFeedback({ kind: "error", text: "Pilih minimal satu kamar." });
      return;
    }
    if (!draft && (!guestName.trim() || !whatsapp.trim())) {
      setFeedback({ kind: "error", text: "Nama tamu dan nomor WhatsApp wajib diisi." });
      return;
    }
    if (!draft && paymentStatus === "Partial" && (amountPaid <= 0 || amountPaid >= total)) {
      setFeedback({ kind: "error", text: "Pembayaran Partial harus lebih dari Rp0 dan kurang dari total reservasi." });
      return;
    }
    if ((extraQuantities["extra-bed"] ?? 0) > selectedRooms || (extraQuantities.breakfast ?? 0) > adults + children) {
      setFeedback({ kind: "error", text: "Jumlah Extra Bed atau Breakfast melebihi kamar atau jumlah tamu." });
      return;
    }
    if (!isPhone && roomTypes.some(room => assignments[room.id].length !== quantities[room.id] || new Set(assignments[room.id]).size !== assignments[room.id].length)) {
      setFeedback({ kind: "error", text: "Pilih nomor kamar yang berbeda untuk setiap kamar." });
      return;
    }
    if (!draft && checkInGuest && (isPhone || paymentStatus !== "Paid") && !confirmed) {
      setConfirmationAssignments({ deluxe: [...assignments.deluxe], family: [...assignments.family], suite: [...assignments.suite] });
      setBalanceAcknowledged(false);
      setFeedback(null);
      setCheckInConfirmationOpen(true);
      return;
    }
    const assignedAtCheckIn = isPhone || paymentStatus !== "Paid" ? confirmationAssignments : assignments;
    if (checkInGuest && roomTypes.some(room => assignedAtCheckIn[room.id].length !== quantities[room.id] || assignedAtCheckIn[room.id].some(number => !number || !room.numbers.includes(number)) || new Set(assignedAtCheckIn[room.id]).size !== assignedAtCheckIn[room.id].length)) {
      setFeedback({ kind: "error", text: "Pilih nomor kamar yang berbeda untuk setiap kamar." });
      return;
    }
    if (checkInGuest && paymentStatus !== "Paid" && !balanceAcknowledged) {
      setFeedback({ kind: "error", text: "Konfirmasi sisa tagihan sebelum check-in." });
      return;
    }
    const bookingId = (isPhone ? "GH-PH-" : "GH-WI-") + Date.now().toString().slice(-8);
    const reservation = {
      bookingId, source, checkIn, checkOut, adults, children, quantities,
      assignments: checkInGuest ? assignedAtCheckIn : isPhone ? null : assignments, selectedExtras, extraQuantities, guestName: guestName.trim(), whatsapp: whatsapp.trim(),
      email: email.trim(), notes: notes.trim(), paymentMethod, paymentStatus,
      amountPaid, requireDeposit: !isPhone && requireDeposit, depositAmount: deposit, depositMethod: isPhone ? null : depositMethod, depositNote: isPhone ? "" : depositNote,
      total, status: draft ? "Draft" : checkInGuest ? "Checked-in" : resolveReservationStatus(paymentStatus, "Pending", source),
      checkInAt: checkInGuest ? new Date().toISOString() : undefined,
    };
    try {
      const stored = JSON.parse(localStorage.getItem("green-hero-reservations") || "[]");
      const reservations = Array.isArray(stored) ? stored : [];
      localStorage.setItem("green-hero-reservations", JSON.stringify([reservation, ...reservations]));
      setCheckInConfirmationOpen(false);
      setFeedback({ kind: "success", text: "Reservasi " + bookingId + (draft ? " disimpan sebagai draft." : checkInGuest ? " disimpan dan tamu berhasil check-in." : " berhasil disimpan.") });
    } catch {
      setFeedback({ kind: "error", text: "Reservasi tidak dapat disimpan di browser ini." });
    }
  }

  return (
    <AdminShell title="Reservations" context="New Reservation" badge={isPhone ? "PHONE MODE" : "WALK-IN MODE"}>
      <div className="walkin-page">
        <div className="walkin-heading">
          <div><h1>Create Reservation – {isPhone ? "Phone" : "Walk In"}</h1><p>{isPhone ? "Buat reservasi via telepon, WhatsApp, atau direct communication" : "Buat reservasi baru untuk tamu"}</p></div>
          <button type="button" className="reservation-secondary-button reset-button" onClick={resetForm}>↻ &nbsp; Reset Form</button>
        </div>
        {feedback && <div className={"reservation-feedback reservation-feedback--" + feedback.kind} role={feedback.kind === "error" ? "alert" : "status"}>{feedback.text}<button type="button" onClick={() => setFeedback(null)} aria-label="Tutup pesan">×</button></div>}

        <div className="walkin-columns">
          <div className="walkin-form-column">
            <section className="reservation-panel reservation-source-panel">
              <h2>Reservation Source</h2>
              <div className="source-tabs" role="group" aria-label="Reservation Source">
                <Link href="/reservations/create-reservation-walkin" className={!isPhone ? "source-tab source-tab--active" : "source-tab"} aria-current={!isPhone ? "page" : undefined}>Walk-in</Link>
                <Link href="/reservations/create-reservation-phone" className={isPhone ? "source-tab source-tab--active" : "source-tab"} aria-current={isPhone ? "page" : undefined}>Phone</Link>
                <Link href="/reservations/create-reservation-ota" className="source-tab">OTA</Link>
              </div>
            </section>

            <section className="reservation-panel">
              <div className="reservation-panel__heading"><h2>Stay</h2><span className="status-badge status-badge--success">{nights} {nights === 1 ? "night" : "nights"}</span></div>
              <div className="stay-fields">
                <ReservationField label="Check-in" htmlFor="check-in"><input id="check-in" type="date" value={checkIn} onChange={event => setCheckIn(event.target.value)} /></ReservationField>
                <ReservationField label="Check-out" htmlFor="check-out"><input id="check-out" type="date" min={checkIn} value={checkOut} onChange={event => setCheckOut(event.target.value)} /></ReservationField>
                <ReservationField label="Adults" htmlFor="adults"><select id="adults" value={adults} onChange={event => setAdults(Number(event.target.value))}>{[1,2,3,4,5,6,7,8].map(value => <option key={value}>{value}</option>)}</select></ReservationField>
                <ReservationField label="Children" htmlFor="children"><select id="children" value={children} onChange={event => setChildren(Number(event.target.value))}>{[0,1,2,3,4].map(value => <option key={value}>{value}</option>)}</select></ReservationField>
                <button type="button" className="reservation-secondary-button availability-check" onClick={() => setFeedback(nights > 0 ? { kind: "info", text: "Ketersediaan kamar telah diperbarui untuk " + nights + " malam." } : { kind: "error", text: "Pilih tanggal menginap yang valid." })}>⌕ &nbsp; Check</button>
              </div>
            </section>

            <section className="reservation-panel">
              <div className="reservation-panel__heading"><h2>Available Rooms</h2><span className="reservation-panel__meta">Terpilih: {selectedRooms} Kamar</span></div>
              <div className="available-rooms">
                {roomTypes.map(room => <div className={quantities[room.id] ? "room-option room-option--selected" : "room-option"} key={room.id}>
                  <div><div className="room-option__name"><strong>{room.name}</strong><span>{room.available} available</span></div><small>{room.capacity}</small></div>
                  <div className="room-option__right"><div className="room-option__rate"><strong>{formatRupiah(room.rate)}</strong><small>/ night</small></div><QuantityControl label={room.name} value={quantities[room.id]} max={room.available} onChange={value => updateQuantity(room.id, value)} /></div>
                </div>)}
              </div>
            </section>

            {!isPhone && <section className="reservation-panel">
              <h2>Assign Rooms</h2>
              <div className="room-assignments">
                {roomTypes.filter(room => quantities[room.id] > 0).map(room => <div className="room-assignment" key={room.id}>
                  <strong>{room.name} × {quantities[room.id]}</strong>
                  {assignments[room.id].map((number, index) => <ReservationField key={index} label={"Room " + (index + 1)} htmlFor={room.id + "-" + index}>
                    <select id={room.id + "-" + index} value={number} onChange={event => updateAssignment(room.id, index, event.target.value)}>
                      {room.numbers.map(option => <option key={option} value={option} disabled={option !== number && assignments[room.id].includes(option)}>Room {option}</option>)}
                    </select>
                  </ReservationField>)}
                </div>)}
                {selectedRooms === 0 && <p className="reservation-empty">Pilih kamar untuk menentukan nomor kamar.</p>}
              </div>
            </section>}

            <section className="reservation-panel">
              <h2>Guest Information</h2>
              <div className="guest-fields">
                <ReservationField label="Full Name" htmlFor="guest-name" required><input id="guest-name" value={guestName} onChange={event => setGuestName(event.target.value)} /></ReservationField>
                <ReservationField label="WhatsApp" htmlFor="whatsapp" required><input id="whatsapp" type="tel" value={whatsapp} onChange={event => setWhatsapp(event.target.value)} /></ReservationField>
                <ReservationField label="Email" htmlFor="email" optional><input id="email" type="email" value={email} onChange={event => setEmail(event.target.value)} /></ReservationField>
                <ReservationField label="Notes" htmlFor="notes" optional><input id="notes" value={notes} onChange={event => setNotes(event.target.value)} /></ReservationField>
              </div>
            </section>

            <section className="reservation-panel">
              <div className="reservation-panel__heading"><h2>Experiences &amp; Add-ons</h2><button type="button" className="reservation-secondary-button reservation-add-button" onClick={() => setAddingExtra(value => !value)}>＋ Add</button></div>
              {addingExtra && <div className="extra-picker"><label htmlFor="extra-choice">Pilih add-on</label><select id="extra-choice" value="" onChange={event => { if (event.target.value) { setSelectedExtras(current => [...current, event.target.value]); setExtraQuantities(current => ({ ...current, [event.target.value]: 1 })); } setAddingExtra(false); }}><option value="">Pilih paket</option>{extras.filter(extra => !selectedExtras.includes(extra.id)).map(extra => <option key={extra.id} value={extra.id}>{extra.label} · {formatRupiah(extra.price)} {extra.unit}</option>)}</select></div>}
              <div className="selected-extras">{selectedExtras.map(id => {
                const extra = extras.find(item => item.id === id);
                if (!extra) return null;
                const count = extraQuantities[id] ?? 1;
                const adjustable = id === "extra-bed" || id === "breakfast";
                const limit = id === "extra-bed" ? Math.max(1, selectedRooms) : Math.max(1, adults + children);
                return <div className="selected-extra" key={id}>
                  <div className="selected-extra__description"><strong>{extra.label}</strong><small>{formatRupiah(extra.price)} {extra.unit}{extra.perNight ? ` · ${nights} malam` : ""}</small></div>
                  <div className="selected-extra__actions">{adjustable && <QuantityControl label={extra.label} value={count} min={1} max={limit} onChange={value => setExtraQuantities(current => ({ ...current, [id]: value }))} />}<strong>{formatRupiah(getExtraCost(id, count, nights))}</strong><button type="button" aria-label={"Hapus " + extra.label} onClick={() => { setSelectedExtras(current => current.filter(value => value !== id)); setExtraQuantities(current => { const next = { ...current }; delete next[id]; return next; }); }}>×</button></div>
                </div>;
              })}{selectedExtras.length === 0 && <p className="reservation-empty">Belum ada add-on.</p>}</div>
            </section>

            <section className="reservation-panel">
              <h2>Payment</h2>
              <div className="payment-fields">
                <ReservationField label="Payment Method" htmlFor="payment-method"><select id="payment-method" value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)}>{(isPhone ? ["Pay Later","Bank Transfer","QRIS","Cash"] : ["Cash","Bank Transfer","QRIS","Payment Gateway"]).map(value => <option key={value}>{value}</option>)}</select></ReservationField>
                <ReservationField label="Payment Status" htmlFor="payment-status"><select id="payment-status" value={paymentStatus} onChange={event => setPaymentStatus(event.target.value as PaymentStatus)}>{["Unpaid","Partial","Paid"].map(value => <option key={value}>{value}</option>)}</select></ReservationField>
                <ReservationField label="Amount Paid" htmlFor="amount-paid"><input id="amount-paid" inputMode="numeric" value={formatRupiah(amountPaid)} disabled={paymentStatus !== "Partial"} onChange={event => setManualAmountPaid(parseCurrency(event.target.value))} /></ReservationField>
              </div>
              {isPhone && <div className="payment-remaining"><span>Remaining Balance:</span><strong>{formatRupiah(remainingBalance)}</strong></div>}
            </section>

            {!isPhone && <section className="reservation-panel">
              <div className="reservation-panel__heading"><h2>Deposit</h2><label className="deposit-checkbox"><input type="checkbox" checked={requireDeposit} onChange={event => setRequireDeposit(event.target.checked)} />Require Deposit</label></div>
              {requireDeposit && <div className="deposit-fields">
                <ReservationField label="Deposit Amount" htmlFor="deposit-amount"><input id="deposit-amount" inputMode="numeric" value={formatRupiah(depositAmount)} onChange={event => setDepositAmount(parseCurrency(event.target.value))} /></ReservationField>
                <ReservationField label="Deposit Method" htmlFor="deposit-method"><select id="deposit-method" value={depositMethod} onChange={event => setDepositMethod(event.target.value)}>{["Cash","Bank Transfer","Pre-authorization"].map(value => <option key={value}>{value}</option>)}</select></ReservationField>
                <ReservationField label="Deposit Note" htmlFor="deposit-note" optional><input id="deposit-note" value={depositNote} onChange={event => setDepositNote(event.target.value)} /></ReservationField>
              </div>}
            </section>}
          </div>
          <BookingSummary mode={mode} source={source} checkIn={checkIn} checkOut={checkOut} nights={nights} quantities={quantities} selectedExtras={selectedExtras} extraQuantities={extraQuantities} total={total} amountPaid={amountPaid} paymentStatus={paymentStatus} deposit={deposit} onSave={saveReservation} onSaveDraft={() => saveReservation(false, true)} />
        </div>
      </div>
      {checkInConfirmationOpen && <div className="reservation-operation-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setCheckInConfirmationOpen(false); }}>
        <section className="reservation-operation-modal" role="dialog" aria-modal="true" aria-labelledby="create-check-in-title">
          <div className="reservation-operation-header"><h2 id="create-check-in-title">Confirm Guest Check-in</h2><button type="button" onClick={() => setCheckInConfirmationOpen(false)} aria-label="Close modal">×</button></div>
          <div className="reservation-operation-body">
            <div className="reservation-operation-context"><div><strong>{guestName}</strong><span>{paymentStatus}</span></div><small>Booking total {formatRupiah(total)} · Paid {formatRupiah(amountPaid)} · Remaining {formatRupiah(remainingBalance)}</small></div>
            <div className="reservation-operation-rooms">{roomTypes.filter(room => quantities[room.id] > 0).flatMap(room => Array.from({ length: quantities[room.id] }, (_, index) => <label key={room.id + "-" + index}>Assign {room.name}{quantities[room.id] > 1 ? " #" + (index + 1) : ""}<select value={confirmationAssignments[room.id][index] ?? ""} onChange={event => setConfirmationAssignments(current => ({ ...current, [room.id]: current[room.id].map((value, roomIndex) => roomIndex === index ? event.target.value : value) }))}><option value="">Select room</option>{room.numbers.map(number => <option key={number} value={number} disabled={confirmationAssignments[room.id].some((selected, selectedIndex) => selectedIndex !== index && selected === number)}>{number} — Available</option>)}</select></label>))}</div>
            {paymentStatus !== "Paid" && <label className="partial-check-in-confirmation"><input type="checkbox" checked={balanceAcknowledged} onChange={event => setBalanceAcknowledged(event.target.checked)} /><span>Saya mengonfirmasi sisa tagihan <strong>{formatRupiah(remainingBalance)}</strong> telah dijelaskan kepada tamu. Pelunasan wajib sebelum check-out.</span></label>}
            {feedback?.kind === "error" && <p className="reservation-operation-error" role="alert">{feedback.text}</p>}
          </div>
          <div className="reservation-operation-actions"><button type="button" className="reservation-secondary-button" onClick={() => setCheckInConfirmationOpen(false)}>Cancel</button><button type="button" className="action-button" onClick={() => saveReservation(true, false, true)} disabled={paymentStatus !== "Paid" && !balanceAcknowledged}>Confirm Check-in</button></div>
        </section>
      </div>}
    </AdminShell>
  );
}
