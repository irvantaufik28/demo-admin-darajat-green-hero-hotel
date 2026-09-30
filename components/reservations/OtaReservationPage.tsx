"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminShell } from "../layout/AdminShell";
import { QuantityControl } from "./QuantityControl";
import { ReservationField } from "./ReservationField";
import { calculateNights, extras, formatRupiah, formatStayDate, getExtraCost, roomTypes, type RoomType } from "../../lib/walk-in-data";
import { resolveReservationStatus } from "../../lib/reservation-list-data";

type RoomRow = { id: number; type: RoomType; quantity: number; rate: number };
type Feedback = { kind: "success" | "error" | "info"; text: string };

const initialRooms: RoomRow[] = [
  { id: 1, type: "deluxe", quantity: 2, rate: 400000 },
  { id: 2, type: "family", quantity: 1, rate: 650000 },
];
const initialExtraQuantities: Record<string, number> = { "family-grill": 1 };
const channels = ["Agoda", "Traveloka", "Booking.com", "Tiket.com", "Other OTA"];

function parseCurrency(value: string) {
  return Number(value.replace(/\D/g, "")) || 0;
}

export function OtaReservationPage() {
  const [channel, setChannel] = useState("Agoda");
  const [reference, setReference] = useState("AGD-849215763");
  const [checkIn, setCheckIn] = useState("2026-10-05");
  const [checkOut, setCheckOut] = useState("2026-10-07");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [rooms, setRooms] = useState<RoomRow[]>(initialRooms);
  const [nextRoomId, setNextRoomId] = useState(3);
  const [guestName, setGuestName] = useState("Andi Pratama");
  const [whatsapp, setWhatsapp] = useState("+62 812 3456 7890");
  const [email, setEmail] = useState("andi@email.com");
  const [notes, setNotes] = useState("Guest requested early arrival via Agoda message.");
  const [selectedExtras, setSelectedExtras] = useState<string[]>(["family-grill"]);
  const [extraQuantities, setExtraQuantities] = useState<Record<string, number>>(initialExtraQuantities);
  const [addingExtra, setAddingExtra] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const nights = calculateNights(checkIn, checkOut);
  const selectedRooms = rooms.reduce((sum, room) => sum + room.quantity, 0);
  const roomsTotal = rooms.reduce((sum, room) => sum + room.rate * room.quantity * nights, 0);
  const extrasTotal = selectedExtras.reduce((sum, id) => sum + getExtraCost(id, extraQuantities[id] ?? 1, nights), 0);
  const total = roomsTotal + extrasTotal;
  const paymentStatus = "Paid";
  const amountPaid = total;
  const remainingBalance = 0;

  function updateRoom(id: number, changes: Partial<RoomRow>) {
    setRooms(current => current.map(room => room.id === id ? { ...room, ...changes } : room));
    setFeedback(null);
  }

  function addRoomType() {
    const nextType = roomTypes.find(type => !rooms.some(room => room.type === type.id));
    if (!nextType) {
      setFeedback({ kind: "info", text: "Semua tipe kamar sudah tercatat. Gunakan jumlah unit untuk menambah kamar." });
      return;
    }
    setRooms(current => [...current, { id: nextRoomId, type: nextType.id, quantity: 1, rate: nextType.rate }]);
    setNextRoomId(current => current + 1);
    setFeedback(null);
  }

  function resetForm() {
    setChannel("Agoda"); setReference("AGD-849215763");
    setCheckIn("2026-10-05"); setCheckOut("2026-10-07"); setAdults(2); setChildren(0);
    setRooms(initialRooms); setNextRoomId(3);
    setGuestName("Andi Pratama"); setWhatsapp("+62 812 3456 7890");
    setEmail("andi@email.com"); setNotes("Guest requested early arrival via Agoda message.");
    setSelectedExtras(["family-grill"]); setExtraQuantities(initialExtraQuantities); setAddingExtra(false);
    setFeedback(null);
  }

  function saveReservation(draft = false) {
    if (nights < 1) return setFeedback({ kind: "error", text: "Tanggal check-out harus setelah check-in." });
    if (selectedRooms < 1) return setFeedback({ kind: "error", text: "Tambahkan minimal satu kamar dari voucher OTA." });
    if (rooms.some(room => room.rate < 1)) return setFeedback({ kind: "error", text: "Tarif voucher per malam wajib lebih dari Rp0." });
    if (!draft && !reference.trim()) return setFeedback({ kind: "error", text: "Nomor referensi OTA wajib diisi." });
    if (!draft && (!guestName.trim() || !whatsapp.trim())) return setFeedback({ kind: "error", text: "Nama tamu dan nomor WhatsApp wajib diisi." });
    if ((extraQuantities["extra-bed"] ?? 0) > selectedRooms || (extraQuantities.breakfast ?? 0) > adults + children) {
      return setFeedback({ kind: "error", text: "Jumlah Extra Bed atau Breakfast melebihi kamar atau jumlah tamu." });
    }
    const bookingId = "GH-OTA-" + Date.now().toString().slice(-8);
    const quantities = { deluxe: 0, family: 0, suite: 0 };
    rooms.forEach(room => { quantities[room.type] += room.quantity; });
    const reservation = {
      bookingId, source: "OTA", channel, reference: reference.trim(), checkIn, checkOut, adults, children,
      quantities, rooms: rooms.map(({ type, quantity, rate }) => ({ type, quantity, rate })),
      assignments: null, selectedExtras, extraQuantities, guestName: guestName.trim(), whatsapp: whatsapp.trim(),
      email: email.trim(), notes: notes.trim(), paymentMethod: "Prepaid by OTA", paymentStatus, amountPaid,
      requireDeposit: false, depositAmount: 0, depositMethod: null, depositNote: "",
      total, status: draft ? "Draft" : resolveReservationStatus(paymentStatus, "Pending", "OTA"),
    };
    try {
      const stored = JSON.parse(localStorage.getItem("green-hero-reservations") || "[]");
      localStorage.setItem("green-hero-reservations", JSON.stringify([reservation, ...(Array.isArray(stored) ? stored : [])]));
      setFeedback({ kind: "success", text: "Reservasi " + bookingId + (draft ? " disimpan sebagai draft." : " berhasil disimpan.") });
    } catch {
      setFeedback({ kind: "error", text: "Reservasi tidak dapat disimpan di browser ini." });
    }
  }

  return (
    <AdminShell title="Reservations" context="New Reservation" badge="OTA MODE">
      <div className="walkin-page">
        <div className="walkin-heading">
          <div><h1>Create Reservation — OTA</h1><p>Catat reservasi dari Online Travel Agency (Agoda, Traveloka, Booking.com, dll)</p></div>
          <button type="button" className="reservation-secondary-button reset-button" onClick={resetForm}>↻ &nbsp; Reset Form</button>
        </div>
        {feedback && <div className={"reservation-feedback reservation-feedback--" + feedback.kind} role={feedback.kind === "error" ? "alert" : "status"}>{feedback.text}<button type="button" onClick={() => setFeedback(null)} aria-label="Tutup pesan">×</button></div>}
        <div className="walkin-columns">
          <div className="walkin-form-column">
            <section className="reservation-panel ota-source-panel">
              <div className="reservation-panel__heading"><h2>Reservation Source</h2><div className="source-tabs" role="group" aria-label="Reservation Source">
                <Link href="/reservations/create-reservation-walkin" className="source-tab">Walk-in</Link>
                <Link href="/reservations/create-reservation-phone" className="source-tab">Phone</Link>
                <Link href="/reservations/create-reservation-ota" className="source-tab source-tab--active" aria-current="page">OTA</Link>
              </div></div>
              <div className="ota-source-fields">
                <ReservationField label="OTA Channel" htmlFor="ota-channel" required><select id="ota-channel" value={channel} onChange={event => setChannel(event.target.value)}>{channels.map(item => <option key={item}>{item}</option>)}</select></ReservationField>
                <ReservationField label="OTA Booking Reference" htmlFor="ota-reference" required><input id="ota-reference" value={reference} onChange={event => setReference(event.target.value)} placeholder="e.g. AGD-849215763" /></ReservationField>
              </div>
              <p className="ota-field-hint">Nomor referensi atau booking ID dari portal OTA.</p>
            </section>
            <section className="reservation-panel">
              <div className="reservation-panel__heading"><h2>Stay</h2><span className="status-badge status-badge--success">{nights} {nights === 1 ? "night" : "nights"}</span></div>
              <div className="stay-fields">
                <ReservationField label="Check-in" htmlFor="ota-check-in"><input id="ota-check-in" type="date" value={checkIn} onChange={event => setCheckIn(event.target.value)} /></ReservationField>
                <ReservationField label="Check-out" htmlFor="ota-check-out"><input id="ota-check-out" type="date" min={checkIn} value={checkOut} onChange={event => setCheckOut(event.target.value)} /></ReservationField>
                <ReservationField label="Adults" htmlFor="ota-adults"><select id="ota-adults" value={adults} onChange={event => setAdults(Number(event.target.value))}>{[1,2,3,4,5,6,7,8].map(value => <option key={value}>{value}</option>)}</select></ReservationField>
                <ReservationField label="Children" htmlFor="ota-children"><select id="ota-children" value={children} onChange={event => setChildren(Number(event.target.value))}>{[0,1,2,3,4].map(value => <option key={value}>{value}</option>)}</select></ReservationField>
                <button type="button" className="reservation-secondary-button availability-check" onClick={() => setFeedback(nights > 0 ? { kind: "info", text: "Tanggal menginap sesuai voucher OTA: " + nights + " malam. Stok internal tidak diperiksa." } : { kind: "error", text: "Pilih tanggal menginap yang valid." })}>⌕ &nbsp; Check</button>
              </div>
            </section>
            <section className="reservation-panel">
              <div className="reservation-panel__heading ota-rooms-heading"><div><h2>Rooms from OTA Booking</h2><p>Catat tipe kamar dan tarif per malam sesuai konfirmasi voucher OTA.</p></div><span className="status-badge status-badge--success">Terpilih: {rooms.length} Tipe Kamar (Total {selectedRooms} Unit)</span></div>
              <div className="ota-room-list">{rooms.map(room => {
                const type = roomTypes.find(item => item.id === room.type);
                return <div className="ota-room-row" key={room.id}>
                  <ReservationField label="Room Type" htmlFor={"ota-room-" + room.id}><select id={"ota-room-" + room.id} value={room.type} onChange={event => updateRoom(room.id, { type: event.target.value as RoomType })}>{roomTypes.map(item => <option key={item.id} value={item.id} disabled={item.id !== room.type && rooms.some(other => other.type === item.id)}>{item.name}</option>)}</select></ReservationField>
                  <div className="reservation-field"><label>Quantity</label><QuantityControl label={type?.name ?? "Room"} value={room.quantity} min={1} max={20} onChange={value => updateRoom(room.id, { quantity: value })} /></div>
                  <ReservationField label="OTA Rate / Night (Voucher)" htmlFor={"ota-rate-" + room.id}><input id={"ota-rate-" + room.id} inputMode="numeric" value={formatRupiah(room.rate)} onChange={event => updateRoom(room.id, { rate: parseCurrency(event.target.value) })} /></ReservationField>
                  <div className="ota-room-subtotal"><small>Subtotal ({nights} mlm)</small><strong>{formatRupiah(room.rate * room.quantity * nights)}</strong></div>
                  <button type="button" className="ota-remove-room" aria-label={"Hapus " + (type?.name ?? "kamar")} onClick={() => setRooms(current => current.filter(item => item.id !== room.id))}>×</button>
                </div>;
              })}</div>
              <div className="ota-rooms-footer"><button type="button" className="reservation-secondary-button" onClick={addRoomType}>＋ Add Room Type</button><span>Subtotal Kamar OTA: <strong>{formatRupiah(roomsTotal)}</strong></span></div>
              <p className="ota-operational-note">ⓘ &nbsp; OTA reservations record external bookings directly without deducting or validating system inventory.</p>
            </section>
            <section className="reservation-panel"><h2>Guest Information</h2><div className="guest-fields">
              <ReservationField label="Full Name" htmlFor="ota-guest-name" required><input id="ota-guest-name" value={guestName} onChange={event => setGuestName(event.target.value)} /></ReservationField>
              <ReservationField label="WhatsApp" htmlFor="ota-whatsapp" required><input id="ota-whatsapp" type="tel" value={whatsapp} onChange={event => setWhatsapp(event.target.value)} /></ReservationField>
              <ReservationField label="Email" htmlFor="ota-email" optional><input id="ota-email" type="email" value={email} onChange={event => setEmail(event.target.value)} /></ReservationField>
              <ReservationField label="Notes" htmlFor="ota-notes" optional><input id="ota-notes" value={notes} onChange={event => setNotes(event.target.value)} /></ReservationField>
            </div></section>
            <section className="reservation-panel">
              <div className="reservation-panel__heading"><h2>Experiences &amp; Add-ons</h2><button type="button" className="reservation-secondary-button reservation-add-button" onClick={() => setAddingExtra(value => !value)}>＋ Add</button></div>
              {addingExtra && <div className="extra-picker"><label htmlFor="ota-extra-choice">Pilih add-on</label><select id="ota-extra-choice" value="" onChange={event => { if (event.target.value) { setSelectedExtras(current => [...current, event.target.value]); setExtraQuantities(current => ({ ...current, [event.target.value]: 1 })); } setAddingExtra(false); }}><option value="">Pilih paket</option>{extras.filter(extra => !selectedExtras.includes(extra.id)).map(extra => <option key={extra.id} value={extra.id}>{extra.label} · {formatRupiah(extra.price)} {extra.unit}</option>)}</select></div>}
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
            <section className="reservation-panel"><h2>Payment</h2>
              <div className="payment-fields">
                <div className="reservation-field"><label>Payment Type</label><div className="ota-payment-status">Prepaid by OTA</div></div>
                <div className="reservation-field"><label>Payment Status</label><div className={"ota-payment-status ota-payment-status--" + paymentStatus.toLowerCase()}>{paymentStatus}</div></div>
                <div className="reservation-field"><label>Amount Paid</label><div className="ota-payment-status">{formatRupiah(amountPaid)}</div></div>
              </div>
              <p className="ota-settlement-note"><strong>OTA Settlement Note:</strong> Pembayaran telah diselesaikan melalui {channel}. Dana dicairkan sesuai jadwal payout OTA.</p>
            </section>
          </div>
          <aside className="booking-summary">
            <div className="booking-summary__header"><h2>Booking Summary</h2><span>OTA · {channel}</span></div>
            <div className="booking-summary__stay"><span>OTA Reference</span><strong>{reference.trim() || "—"}</strong></div>
            <div className="booking-summary__stay"><span>Stay</span><strong>{formatStayDate(checkIn)} → {formatStayDate(checkOut)} · {nights} nights</strong></div>
            <div className="booking-summary__lines">
              {rooms.map(room => <div key={room.id}><span>{roomTypes.find(type => type.id === room.type)?.name} × {room.quantity} ({nights} nights × {formatRupiah(room.rate)})</span><strong>{formatRupiah(room.rate * room.quantity * nights)}</strong></div>)}
              <div><span>Rooms Total</span><strong>{formatRupiah(roomsTotal)}</strong></div>
              {selectedExtras.map(id => {
                const extra = extras.find(item => item.id === id);
                return extra ? <div key={id}><span>{extra.label} × {extraQuantities[id] ?? 1}</span><strong>{formatRupiah(getExtraCost(id, extraQuantities[id] ?? 1, nights))}</strong></div> : null;
              })}
            </div>
            <div className="booking-summary__totals">
              <div><strong>Booking Total</strong><strong>{formatRupiah(total)}</strong></div>
              <div><span>Payment Arrangement</span><span>Prepaid by OTA</span></div>
              <div><span>Payment Status</span><span className={"status-badge status-badge--" + (paymentStatus === "Paid" ? "success" : "warning")}>{paymentStatus}</span></div>
              <div><span>Amount Paid</span><span>{formatRupiah(amountPaid)}</span></div>
              <div className="booking-summary__collected"><strong>Remaining Balance</strong><strong>{formatRupiah(remainingBalance)}</strong></div>
            </div>
            <div className="booking-summary__actions"><button type="button" className="action-button" onClick={() => saveReservation()}>Save Reservation</button><button type="button" className="reservation-secondary-button" onClick={() => saveReservation(true)}>Save as Draft</button></div>
            <p className="booking-summary__note booking-summary__note--after">Nomor fisik kamar dan uang jaminan (deposit) akan dialokasikan saat tamu hadir dan melakukan check-in di hotel.</p>
          </aside>
        </div>
      </div>
    </AdminShell>
  );
}
