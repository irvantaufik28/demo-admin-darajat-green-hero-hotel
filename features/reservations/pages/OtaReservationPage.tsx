"use client";
import "../../dashboard/styles/dashboard.css";
import "../styles/reservations.css";

import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AdminShell } from "../../../components/layout/AdminShell";
import { QuantityControl } from "../components/QuantityControl";
import { ReservationField } from "../components/ReservationField";
import { SaveReservationConfirmation } from "../components/SaveReservationConfirmation";
import { ReservationSuccessTransition } from "../components/ReservationSuccessTransition";
import {
  calculateNights,
  formatRupiah,
  formatStayDate,
} from "../constants/walk-in-data";
import { nextStayDate, todayJakarta } from "../utils/stay-dates";
import {
  createOtaReservation,
  getOtaFormOptions,
  quoteOtaReservation,
  type OtaChannel,
  type OtaExperience,
  type OtaRoom,
} from "../services/ota";
import type { ReservationQuote } from "../services/create";
import type { RoomTypeRecord } from "../../rooms/services/room-types";

type RoomConfiguration = { adults: number; children: number; extraBeds: number };
type RoomRow = {
  id: number;
  type: string;
  quantity: number;
  rate: number;
  configurations: RoomConfiguration[];
};
type Feedback = { kind: "success" | "error" | "info"; text: string };

function parseCurrency(value: string) {
  return Number(value.replace(/\D/g, "")) || 0;
}

export function OtaReservationPage() {
  const [minimumCheckIn, setMinimumCheckIn] = useState("");
  const [channels, setChannels] = useState<OtaChannel[]>([]);
  const [roomTypeOptions, setRoomTypeOptions] = useState<RoomTypeRecord[]>([]);
  const [experienceOptions, setExperienceOptions] = useState<{
    id: string; label: string; price: number; unit: string;
  }[]>([]);
  const [channel, setChannel] = useState("");
  const [reference, setReference] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [nextRoomId, setNextRoomId] = useState(2);
  const [guestName, setGuestName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [extraQuantities, setExtraQuantities] = useState<
    Record<string, number>
  >({});
  const [addingExtra, setAddingExtra] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [saveConfirmationOpen, setSaveConfirmationOpen] = useState(false);
  const [savedBookingId, setSavedBookingId] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [quoteState, setQuoteState] = useState<{ key: string; value: ReservationQuote } | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const idempotency = useRef<{ key: string; value: string } | null>(null);

  const nights = calculateNights(checkIn, checkOut);
  const selectedRooms = rooms.reduce((sum, room) => sum + room.quantity, 0);
  const channelName = channels.find((item) => item.id === channel)?.name ?? "OTA";
  const getExtraCost = (id: string, quantity: number) =>
    (experienceOptions.find((item) => item.id === id)?.price ?? 0) * quantity;
  const roomSelections: OtaRoom[] = rooms.flatMap((room) =>
    room.configurations.slice(0, room.quantity).map((configuration) => ({
      roomTypeId: room.type,
      otaRatePerNight: room.rate,
      adults: configuration.adults,
      children: configuration.children,
      extraBeds: configuration.extraBeds,
    })),
  );
  const experienceSelections: OtaExperience[] = selectedExtras.map((variantId) => ({
    variantId,
    quantity: extraQuantities[variantId] ?? 1,
  }));
  const quoteKey = JSON.stringify({ checkIn, checkOut, roomSelections, experienceSelections });
  const requestKey = JSON.stringify({ quoteKey, channel, reference, guestName, whatsapp, email, notes });
  const quote = quoteState?.key === quoteKey ? quoteState.value : null;
  const roomsTotal = rooms.reduce(
    (sum, room) => sum + room.rate * room.quantity * nights,
    0,
  );
  const extrasTotal = selectedExtras.reduce(
    (sum, id) => sum + getExtraCost(id, extraQuantities[id] ?? 1),
    0,
  );
  const extraBedsTotal = rooms.reduce((sum, room) => {
    const roomType = roomTypeOptions.find((item) => item.id === room.type);
    const beds = room.configurations.reduce((total, configuration) => total + configuration.extraBeds, 0);
    return sum + (roomType?.extraBedPricePerNight ?? 0) * beds * nights;
  }, 0);
  const total = quote?.bookingTotal ?? roomsTotal + extraBedsTotal + extrasTotal;
  const paymentStatus = "Paid";
  const amountPaid = total;
  const remainingBalance = 0;

  useEffect(() => {
    const today = todayJakarta();
    setMinimumCheckIn(today);
    setCheckIn(today);
    setCheckOut(nextStayDate(today));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    getOtaFormOptions(controller.signal).then((result) => {
      setChannels(result.channels);
      setRoomTypeOptions(result.roomTypes);
      setExperienceOptions(result.experiences.flatMap((experience) =>
        experience.variants.map((variant) => ({
          id: variant.id,
          label: `${experience.name} – ${variant.subName}`,
          price: variant.price,
          unit: "/ paket",
        })),
      ));
      setChannel((current) => current || result.channels[0]?.id || "");
      setRooms((current) => current.length ? current : result.roomTypes[0]
        ? [{ id: 1, type: result.roomTypes[0].id, quantity: 1, rate: 0, configurations: [{ adults: 2, children: 0, extraBeds: 0 }] }]
        : []);
    }).catch((cause) => {
      if (!controller.signal.aborted) setFeedback({ kind: "error", text: cause instanceof Error ? cause.message : "Pilihan OTA gagal dimuat." });
    }).finally(() => { if (!controller.signal.aborted) setOptionsLoading(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!checkIn || nights < 1 || roomSelections.length < 1 ||
      roomSelections.some((room) => !room.roomTypeId || room.otaRatePerNight < 1)) {
      setQuoteBusy(false);
      setQuoteError("");
      return;
    }
    const controller = new AbortController();
    setQuoteBusy(true);
    setQuoteError("");
    const timer = window.setTimeout(() => {
      quoteOtaReservation({
        checkInDate: checkIn,
        checkOutDate: checkOut,
        rooms: roomSelections,
        experiences: experienceSelections,
      }, controller.signal).then((value) => setQuoteState({ key: quoteKey, value }))
        .catch((cause) => {
          if (!controller.signal.aborted) setQuoteError(cause instanceof Error ? cause.message : "Quote OTA gagal dimuat.");
        }).finally(() => { if (!controller.signal.aborted) setQuoteBusy(false); });
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [quoteKey, checkIn, checkOut, nights]);

  function updateRoom(id: number, changes: Partial<RoomRow>) {
    setRooms((current) =>
      current.map((room) => {
        if (room.id !== id) return room;
        const quantity = changes.quantity ?? room.quantity;
        const configurations = changes.type && changes.type !== room.type
          ? room.configurations.map((configuration) => ({ ...configuration, extraBeds: 0 }))
          : room.configurations;
        return {
          ...room,
          ...changes,
          configurations: Array.from({ length: quantity }, (_, index) =>
            configurations[index] ?? { adults, children, extraBeds: 0 },
          ),
        };
      }),
    );
    setFeedback(null);
  }

  function updateRoomConfiguration(id: number, index: number, changes: Partial<RoomConfiguration>) {
    setRooms((current) => current.map((room) => room.id === id
      ? { ...room, configurations: room.configurations.map((configuration, position) =>
          position === index ? { ...configuration, ...changes } : configuration) }
      : room));
  }

  function addRoomType() {
    const nextType = roomTypeOptions.find(
      (type) => !rooms.some((room) => room.type === type.id),
    );
    if (!nextType) {
      setFeedback({
        kind: "info",
        text: "Semua tipe kamar sudah tercatat. Gunakan jumlah unit untuk menambah kamar.",
      });
      return;
    }
    setRooms((current) => [
      ...current,
      { id: nextRoomId, type: nextType.id, quantity: 1, rate: 0, configurations: [{ adults, children, extraBeds: 0 }] },
    ]);
    setNextRoomId((current) => current + 1);
    setFeedback(null);
  }

  function resetForm() {
    setChannel(channels[0]?.id ?? "");
    setReference("");
    const resetCheckIn = minimumCheckIn || todayJakarta();
    setCheckIn(resetCheckIn);
    setCheckOut(nextStayDate(resetCheckIn));
    setAdults(2);
    setChildren(0);
    setRooms(roomTypeOptions[0]
      ? [{ id: 1, type: roomTypeOptions[0].id, quantity: 1, rate: 0, configurations: [{ adults: 2, children: 0, extraBeds: 0 }] }]
      : []);
    setNextRoomId(2);
    setGuestName("");
    setWhatsapp("");
    setEmail("");
    setNotes("");
    setSelectedExtras([]);
    setExtraQuantities({});
    setAddingExtra(false);
    setFeedback(null);
    setSaveConfirmationOpen(false);
    setSavedBookingId(null);
    setQuoteState(null);
    idempotency.current = null;
  }

  async function saveReservation() {
    if (minimumCheckIn && checkIn < minimumCheckIn)
      return setFeedback({ kind: "error", text: "Tanggal check-in tidak boleh sebelum hari ini." });
    if (nights < 1)
      return setFeedback({
        kind: "error",
        text: "Tanggal check-out harus setelah check-in.",
      });
    if (selectedRooms < 1)
      return setFeedback({
        kind: "error",
        text: "Tambahkan minimal satu kamar dari voucher OTA.",
      });
    if (selectedRooms > 20)
      return setFeedback({ kind: "error", text: "Maksimal 20 kamar dalam satu reservasi." });
    if (rooms.some((room) => room.rate < 1))
      return setFeedback({
        kind: "error",
        text: "Tarif voucher per malam wajib lebih dari Rp0.",
      });
    if (!channel)
      return setFeedback({ kind: "error", text: "Pilih channel OTA yang aktif." });
    if (!reference.trim())
      return setFeedback({
        kind: "error",
        text: "Nomor referensi OTA wajib diisi.",
      });
    if (!guestName.trim() || !whatsapp.trim())
      return setFeedback({
        kind: "error",
        text: "Nama tamu dan nomor WhatsApp wajib diisi.",
      });
    if (!quote || quoteBusy || quoteError)
      return setFeedback({ kind: "error", text: quoteError || "Tunggu hingga total voucher selesai dihitung oleh API." });
    if (!idempotency.current || idempotency.current.key !== requestKey) {
      idempotency.current = { key: requestKey, value: crypto.randomUUID() };
    }
    setSaveBusy(true);
    setFeedback(null);
    try {
      const result = await createOtaReservation({
        idempotencyKey: idempotency.current.value,
        otaChannelId: channel,
        externalReference: reference.trim(),
        guest: {
          fullName: guestName.trim(),
          phone: whatsapp.trim(),
          ...(email.trim() ? { email: email.trim() } : {}),
        },
        checkInDate: checkIn,
        checkOutDate: checkOut,
        rooms: roomSelections,
        experiences: experienceSelections,
        ...(notes.trim() ? { specialRequests: notes.trim() } : {}),
      });
      setSavedBookingId(result.reservation.bookingCode);
    } catch (cause) {
      setFeedback({
        kind: "error",
        text: cause instanceof Error ? cause.message : "Reservasi OTA gagal disimpan.",
      });
    } finally {
      setSaveBusy(false);
    }
  }

  return (
    <AdminShell title="Reservations" context="New Reservation" badge="OTA MODE">
      <div className="walkin-page">
        <div className="walkin-heading">
          <div>
            <h1>Create Reservation — OTA</h1>
            <p>
              Catat reservasi dari Online Travel Agency (Agoda, Traveloka,
              Booking.com, dll)
            </p>
          </div>
          <button
            type="button"
            className="reservation-secondary-button reset-button"
            onClick={resetForm}
          >
            ↻ &nbsp; Reset Form
          </button>
        </div>
        {feedback && (
          <div
            className={
              "reservation-feedback reservation-feedback--" + feedback.kind
            }
            role={feedback.kind === "error" ? "alert" : "status"}
          >
            {feedback.text}
            <button
              type="button"
              onClick={() => setFeedback(null)}
              aria-label="Tutup pesan"
            >
              ×
            </button>
          </div>
        )}
        {quoteError && <div className="reservation-feedback reservation-feedback--error" role="alert">{quoteError}</div>}
        {optionsLoading ? <LoadingSkeleton variant="form" rows={8} /> : <div className="walkin-columns">
          <div className="walkin-form-column">
            <section className="reservation-panel ota-source-panel">
              <div className="reservation-panel__heading">
                <h2>Reservation Source</h2>
                <div
                  className="source-tabs"
                  role="group"
                  aria-label="Reservation Source"
                >
                  <Link
                    href="/reservations/create-reservation-walkin"
                    className="source-tab"
                  >
                    Walk-in
                  </Link>
                  <Link
                    href="/reservations/create-reservation-phone"
                    className="source-tab"
                  >
                    Phone
                  </Link>
                  <Link
                    href="/reservations/create-reservation-ota"
                    className="source-tab source-tab--active"
                    aria-current="page"
                  >
                    OTA
                  </Link>
                </div>
              </div>
              <div className="ota-source-fields">
                <ReservationField
                  label="OTA Channel"
                  htmlFor="ota-channel"
                  required
                >
                  <select
                    id="ota-channel"
                    value={channel}
                    onChange={(event) => setChannel(event.target.value)}
                  >
                    <option value="">Pilih OTA channel</option>
                    {channels.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </ReservationField>
                <ReservationField
                  label="OTA Booking Reference"
                  htmlFor="ota-reference"
                  required
                >
                  <input
                    id="ota-reference"
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    placeholder="e.g. AGD-849215763"
                  />
                </ReservationField>
              </div>
              <p className="ota-field-hint">
                Nomor referensi atau booking ID dari portal OTA.
              </p>
            </section>
            <section className="reservation-panel">
              <div className="reservation-panel__heading">
                <h2>Stay</h2>
                <span className="status-badge status-badge--success">
                  {nights} {nights === 1 ? "night" : "nights"}
                </span>
              </div>
              <div className="stay-fields">
                <ReservationField label="Check-in" htmlFor="ota-check-in">
                  <input
                    id="ota-check-in"
                    type="date"
                    min={minimumCheckIn || undefined}
                    value={checkIn}
                    onChange={(event) => {
                      const date = event.target.value;
                      if (minimumCheckIn && date < minimumCheckIn) return;
                      setCheckIn(date);
                      if (date >= checkOut) setCheckOut(nextStayDate(date));
                    }}
                  />
                </ReservationField>
                <ReservationField label="Check-out" htmlFor="ota-check-out">
                  <input
                    id="ota-check-out"
                    type="date"
                    min={checkIn ? nextStayDate(checkIn) : undefined}
                    value={checkOut}
                    onChange={(event) => setCheckOut(event.target.value)}
                  />
                </ReservationField>
                <ReservationField label="Default Adults / Room" htmlFor="ota-adults">
                  <select
                    id="ota-adults"
                    value={adults}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setAdults(value);
                      setRooms((current) => current.map((room) => ({
                        ...room,
                        configurations: room.configurations.map((configuration) => ({ ...configuration, adults: value })),
                      })));
                    }}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </ReservationField>
                <ReservationField label="Default Children / Room" htmlFor="ota-children">
                  <select
                    id="ota-children"
                    value={children}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setChildren(value);
                      setRooms((current) => current.map((room) => ({
                        ...room,
                        configurations: room.configurations.map((configuration) => ({ ...configuration, children: value })),
                      })));
                    }}
                  >
                    {[0, 1, 2, 3, 4].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </ReservationField>
                <button
                  type="button"
                  className="reservation-secondary-button availability-check"
                  onClick={() =>
                    setFeedback(
                      nights > 0
                        ? {
                            kind: "info",
                            text:
                              "Tanggal menginap sesuai voucher OTA: " +
                              nights +
                              " malam. Stok internal tidak diperiksa.",
                          }
                        : {
                            kind: "error",
                            text: "Pilih tanggal menginap yang valid.",
                          },
                    )
                  }
                >
                  ⌕ &nbsp; Check
                </button>
              </div>
            </section>
            <section className="reservation-panel">
              <div className="reservation-panel__heading ota-rooms-heading">
                <div>
                  <h2>Rooms from OTA Booking</h2>
                  <p>
                    Catat tipe kamar dan tarif per malam sesuai konfirmasi
                    voucher OTA.
                  </p>
                </div>
                <span className="status-badge status-badge--success">
                  Terpilih: {rooms.length} Tipe Kamar (Total {selectedRooms}{" "}
                  Unit)
                </span>
              </div>
              <div className="ota-room-list">
                {rooms.map((room) => {
                  const type = roomTypeOptions.find((item) => item.id === room.type);
                  return (
                    <div className="ota-room-row" key={room.id}>
                      <ReservationField
                        label="Room Type"
                        htmlFor={"ota-room-" + room.id}
                      >
                        <select
                          id={"ota-room-" + room.id}
                          value={room.type}
                          onChange={(event) =>
                            updateRoom(room.id, {
                              type: event.target.value,
                            })
                          }
                        >
                          {roomTypeOptions.map((item) => (
                            <option
                              key={item.id}
                              value={item.id}
                              disabled={
                                item.id !== room.type &&
                                rooms.some((other) => other.type === item.id)
                              }
                            >
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </ReservationField>
                      <div className="reservation-field">
                        <label>Quantity</label>
                        <QuantityControl
                          label={type?.name ?? "Room"}
                          value={room.quantity}
                          min={1}
                          max={20}
                          onChange={(value) =>
                            updateRoom(room.id, { quantity: value })
                          }
                        />
                      </div>
                      <ReservationField
                        label="OTA Rate / Night (Voucher)"
                        htmlFor={"ota-rate-" + room.id}
                      >
                        <input
                          id={"ota-rate-" + room.id}
                          inputMode="numeric"
                          value={room.rate > 0 ? formatRupiah(room.rate) : ""}
                          placeholder="Rp"
                          onChange={(event) =>
                            updateRoom(room.id, {
                              rate: parseCurrency(event.target.value),
                            })
                          }
                        />
                      </ReservationField>
                      <div className="ota-room-subtotal">
                        <small>Subtotal ({nights} mlm)</small>
                        <strong>
                          {formatRupiah(room.rate * room.quantity * nights)}
                        </strong>
                      </div>
                      <button
                        type="button"
                        className="ota-remove-room"
                        aria-label={"Hapus " + (type?.name ?? "kamar")}
                        onClick={() =>
                          setRooms((current) =>
                            current.filter((item) => item.id !== room.id),
                          )
                        }
                      >
                        ×
                      </button>
                      <div className="ota-room-unit-configs">
                        {room.configurations.map((configuration, index) => (
                          <div className="ota-room-unit-config" key={`${room.id}-${index}`}>
                            <strong>Room {index + 1}</strong>
                            <label>Adults
                              <select value={configuration.adults} onChange={(event) => updateRoomConfiguration(room.id, index, { adults: Number(event.target.value) })}>
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((value) => <option key={value} value={value}>{value}</option>)}
                              </select>
                            </label>
                            <label>Children
                              <select value={configuration.children} onChange={(event) => updateRoomConfiguration(room.id, index, { children: Number(event.target.value) })}>
                                {[0, 1, 2, 3, 4].map((value) => <option key={value} value={value}>{value}</option>)}
                              </select>
                            </label>
                            {type?.extraBedEnabled && type.maxExtraBeds > 0 && (
                              <div className="reservation-field">
                                <label>Extra Bed · {formatRupiah(type.extraBedPricePerNight)} / night</label>
                                <QuantityControl
                                  label={`Extra bed room ${index + 1}`}
                                  value={configuration.extraBeds}
                                  min={0}
                                  max={type.maxExtraBeds}
                                  onChange={(value) => updateRoomConfiguration(room.id, index, { extraBeds: value })}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="ota-rooms-footer">
                <button
                  type="button"
                  className="reservation-secondary-button"
                  onClick={addRoomType}
                >
                  ＋ Add Room Type
                </button>
                <span>
                  Subtotal Kamar OTA:{" "}
                  <strong>{formatRupiah(roomsTotal)}</strong>
                </span>
              </div>
              <p className="ota-operational-note">
                ⓘ &nbsp; Reservasi OTA dicatat dari voucher. Tarif voucher digunakan
                untuk total booking dan reservasi ikut tercatat dalam kamar terjual.
              </p>
            </section>
            <section className="reservation-panel">
              <h2>Guest Information</h2>
              <div className="guest-fields">
                <ReservationField
                  label="Full Name"
                  htmlFor="ota-guest-name"
                  required
                >
                  <input
                    id="ota-guest-name"
                    value={guestName}
                    onChange={(event) => setGuestName(event.target.value)}
                  />
                </ReservationField>
                <ReservationField
                  label="WhatsApp"
                  htmlFor="ota-whatsapp"
                  required
                >
                  <input
                    id="ota-whatsapp"
                    type="tel"
                    value={whatsapp}
                    onChange={(event) => setWhatsapp(event.target.value)}
                  />
                </ReservationField>
                <ReservationField label="Email" htmlFor="ota-email" optional>
                  <input
                    id="ota-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </ReservationField>
                <ReservationField label="Notes" htmlFor="ota-notes" optional>
                  <input
                    id="ota-notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </ReservationField>
              </div>
            </section>
            <section className="reservation-panel">
              <div className="reservation-panel__heading">
                <h2>Experiences &amp; Add-ons</h2>
                <button
                  type="button"
                  className="reservation-secondary-button reservation-add-button"
                  onClick={() => setAddingExtra((value) => !value)}
                >
                  ＋ Add
                </button>
              </div>
              {addingExtra && (
                <div className="extra-picker">
                  <label htmlFor="ota-extra-choice">Pilih add-on</label>
                  <select
                    id="ota-extra-choice"
                    value=""
                    onChange={(event) => {
                      if (event.target.value) {
                        setSelectedExtras((current) => [
                          ...current,
                          event.target.value,
                        ]);
                        setExtraQuantities((current) => ({
                          ...current,
                          [event.target.value]: 1,
                        }));
                      }
                      setAddingExtra(false);
                    }}
                  >
                    <option value="">Pilih paket</option>
                    {experienceOptions
                      .filter((extra) => !selectedExtras.includes(extra.id))
                      .map((extra) => (
                        <option key={extra.id} value={extra.id}>
                          {extra.label} · {formatRupiah(extra.price)}{" "}
                          {extra.unit}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              <div className="selected-extras">
                {selectedExtras.map((id) => {
                  const extra = experienceOptions.find((item) => item.id === id);
                  if (!extra) return null;
                  const count = extraQuantities[id] ?? 1;
                  return (
                    <div className="selected-extra" key={id}>
                      <div className="selected-extra__description">
                        <strong>{extra.label}</strong>
                        <small>
                          {formatRupiah(extra.price)} {extra.unit}
                        </small>
                      </div>
                      <div className="selected-extra__actions">
                        <QuantityControl
                          label={extra.label}
                          value={count}
                          min={1}
                          max={20}
                          onChange={(value) =>
                            setExtraQuantities((current) => ({ ...current, [id]: value }))
                          }
                        />
                        <strong>
                          {formatRupiah(getExtraCost(id, count))}
                        </strong>
                        <button
                          type="button"
                          aria-label={"Hapus " + extra.label}
                          onClick={() => {
                            setSelectedExtras((current) =>
                              current.filter((value) => value !== id),
                            );
                            setExtraQuantities((current) => {
                              const next = { ...current };
                              delete next[id];
                              return next;
                            });
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
                {selectedExtras.length === 0 && (
                  <p className="reservation-empty">Belum ada add-on.</p>
                )}
              </div>
            </section>
            <section className="reservation-panel">
              <h2>Payment</h2>
              <div className="payment-fields">
                <div className="reservation-field">
                  <label>Payment Type</label>
                  <div className="ota-payment-status">Prepaid by OTA</div>
                </div>
                <div className="reservation-field">
                  <label>Payment Status</label>
                  <div
                    className={
                      "ota-payment-status ota-payment-status--" +
                      paymentStatus.toLowerCase()
                    }
                  >
                    {paymentStatus}
                  </div>
                </div>
                <div className="reservation-field">
                  <label>Amount Paid</label>
                  <div className="ota-payment-status">
                    {formatRupiah(amountPaid)}
                  </div>
                </div>
              </div>
              <p className="ota-settlement-note">
                <strong>OTA Settlement Note:</strong> Pembayaran telah
                diselesaikan melalui {channelName}. Dana dicairkan sesuai jadwal
                payout OTA.
              </p>
            </section>
          </div>
          <aside className="booking-summary">
            <div className="booking-summary__header">
              <h2>Booking Summary</h2>
              <span>OTA · {channelName}</span>
            </div>
            <div className="booking-summary__stay">
              <span>OTA Reference</span>
              <strong>{reference.trim() || "—"}</strong>
            </div>
            <div className="booking-summary__stay">
              <span>Stay</span>
              <strong>
                {formatStayDate(checkIn)} → {formatStayDate(checkOut)} ·{" "}
                {nights} nights
              </strong>
            </div>
            <div className="booking-summary__lines">
              {rooms.map((room) => (
                <div key={room.id}>
                  <span>
                    {roomTypeOptions.find((type) => type.id === room.type)?.name} ×{" "}
                    {room.quantity} ({nights} nights × {formatRupiah(room.rate)}
                    )
                  </span>
                  <strong>
                    {formatRupiah(room.rate * room.quantity * nights)}
                  </strong>
                </div>
              ))}
              <div>
                <span>Rooms Total</span>
                <strong>{formatRupiah(roomsTotal)}</strong>
              </div>
              {rooms.flatMap((room) => room.configurations.map((configuration, index) =>
                configuration.extraBeds > 0 ? (
                  <div key={`bed-${room.id}-${index}`}>
                    <span>Extra Bed ({roomTypeOptions.find((type) => type.id === room.type)?.name}, Room {index + 1}) × {configuration.extraBeds} · {nights} nights</span>
                    <strong>{formatRupiah((roomTypeOptions.find((type) => type.id === room.type)?.extraBedPricePerNight ?? 0) * configuration.extraBeds * nights)}</strong>
                  </div>
                ) : null,
              ))}
              {selectedExtras.map((id) => {
                const extra = experienceOptions.find((item) => item.id === id);
                return extra ? (
                  <div key={id}>
                    <span>
                      {extra.label} × {extraQuantities[id] ?? 1}
                    </span>
                    <strong>
                      {formatRupiah(
                        getExtraCost(id, extraQuantities[id] ?? 1),
                      )}
                    </strong>
                  </div>
                ) : null;
              })}
            </div>
            <div className="booking-summary__totals">
              {quoteBusy && <LoadingSkeleton variant="inline" />}
              <div>
                <strong>Booking Total</strong>
                <strong>{formatRupiah(total)}</strong>
              </div>
              <div>
                <span>Payment Arrangement</span>
                <span>Prepaid by OTA</span>
              </div>
              <div>
                <span>Payment Status</span>
                <span
                  className={
                    "status-badge status-badge--" +
                    (paymentStatus === "Paid" ? "success" : "warning")
                  }
                >
                  {paymentStatus}
                </span>
              </div>
              <div>
                <span>Amount Paid</span>
                <span>{formatRupiah(amountPaid)}</span>
              </div>
              <div className="booking-summary__collected">
                <strong>Remaining Balance</strong>
                <strong>{formatRupiah(remainingBalance)}</strong>
              </div>
            </div>
            <div className="booking-summary__actions">
              <button
                type="button"
                className="action-button"
                disabled={saveBusy || quoteBusy || !quote || Boolean(quoteError)}
                onClick={() => setSaveConfirmationOpen(true)}
              >
                Save Reservation
              </button>
              <button
                type="button"
                className="reservation-secondary-button"
                disabled
                title="Draft OTA belum tersedia di API"
              >
                Save as Draft
              </button>
            </div>
            <p className="booking-summary__note booking-summary__note--after">
              Nomor fisik kamar dan uang jaminan (deposit) akan dialokasikan
              saat tamu hadir dan melakukan check-in di hotel.
            </p>
          </aside>
        </div>}
      </div>
      {saveConfirmationOpen && (
        <SaveReservationConfirmation
          guestName={guestName}
          action="save"
          total={total}
          rooms={selectedRooms}
          nights={nights}
          onCancel={() => setSaveConfirmationOpen(false)}
          onConfirm={() => { setSaveConfirmationOpen(false); void saveReservation(); }}
          busy={saveBusy}
        />
      )}
      {savedBookingId && <ReservationSuccessTransition bookingId={savedBookingId} checkedIn={false} />}
    </AdminShell>
  );
}
