"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AdminShell } from "../../../components/layout/AdminShell";
import { QuantityControl } from "./QuantityControl";
import { ReservationField } from "./ReservationField";
import { SaveReservationConfirmation } from "./SaveReservationConfirmation";
import { ReservationSuccessTransition } from "./ReservationSuccessTransition";
import {
  calculateNights,
  formatRupiah,
  formatStayDate,
} from "../constants/walk-in-data";
import { restoreSession } from "../../../lib/auth";
import { nextStayDate, todayJakarta } from "../utils/stay-dates";
import {
  createWalkIn,
  getWalkInAvailability,
  getWalkInExperiences,
  getWalkInPaymentMethods,
  quoteWalkIn,
  type AvailableRoom,
  type ExperienceOption,
  type PaymentMethod,
  type ReservationQuote,
  type SelectedExperience,
  type SelectedRoom,
} from "../services/create";

type RoomEntry = SelectedRoom & { key: string };
type PaymentStatus = "Paid" | "Partial" | "Unpaid";

const unavailableReasonLabels: Record<string, string> = {
  capacity_mismatch: "Kapasitas tamu tidak sesuai",
  not_configured: "Harga atau stok belum diatur",
  stop_sell: "Penjualan dihentikan",
  minimum_nights: "Minimum malam belum terpenuhi",
  sold_out: "Stok kamar habis",
  no_ready_room: "Tidak ada nomor kamar berstatus Available untuk check-in",
};

function money(value: string) {
  return Number(value.replace(/\D/g, "")) || 0;
}

export function WalkInApiForm() {
  const [initialDate, setInitialDate] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [searchAdults, setSearchAdults] = useState(2);
  const [searchChildren, setSearchChildren] = useState(0);
  const [available, setAvailable] = useState<AvailableRoom[]>([]);
  const [experiences, setExperiences] = useState<ExperienceOption[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [rooms, setRooms] = useState<RoomEntry[]>([]);
  const [selectedExperiences, setSelectedExperiences] = useState<
    SelectedExperience[]
  >([]);
  const [addingExperience, setAddingExperience] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("Unpaid");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [partialAmount, setPartialAmount] = useState(0);
  const [requireDeposit, setRequireDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState(500000);
  const [depositMethodId, setDepositMethodId] = useState("");
  const [depositNote, setDepositNote] = useState("");
  const [quote, setQuote] = useState<ReservationQuote | null>(null);
  const [quotedInput, setQuotedInput] = useState("");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [saveConfirmation, setSaveConfirmation] = useState<
    "save" | "check-in" | null
  >(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [saved, setSaved] = useState<{
    bookingId: string;
    checkedIn: boolean;
  } | null>(null);
  const requestKey = useRef<{ body: string; key: string } | null>(null);
  const nights = calculateNights(checkIn, checkOut);
  const selectedRooms = rooms.length;
  const roomAssignmentLabel =
    initialDate && checkIn > initialDate
      ? "nomor kamar dapat ditetapkan"
      : "kamar siap check-in";
  const total = quote?.bookingTotal ?? 0;
  const amountPaid =
    paymentStatus === "Paid"
      ? total
      : paymentStatus === "Partial"
        ? partialAmount
        : 0;
  const balance = Math.max(0, total - amountPaid);
  const currentQuoteInput = JSON.stringify({
    checkIn,
    checkOut,
    rooms,
    selectedExperiences,
  });

  useEffect(() => {
    const date = todayJakarta();
    setInitialDate(date);
    setCheckIn(date);
    setCheckOut(nextStayDate(date));
  }, []);

  const variants = useMemo(
    () =>
      experiences.flatMap((experience) =>
        experience.variants.map((variant) => ({
          ...variant,
          label: `${experience.name} · ${variant.subName}`,
        })),
      ),
    [experiences],
  );

  async function refreshAvailability(signal?: AbortSignal) {
    if (nights < 1) return;
    setAvailabilityLoading(true);
    try {
      if (!(await restoreSession())) return;
      const result = await getWalkInAvailability(
        checkIn,
        checkOut,
        { adults: searchAdults, children: searchChildren },
        signal,
      );
      if (!signal?.aborted) {
        setAvailable(result.items);
        setFeedback("");
      }
    } catch (error) {
      if (!signal?.aborted)
        setFeedback(
          error instanceof Error
            ? error.message
            : "Ketersediaan kamar gagal dimuat.",
        );
    } finally {
      if (!signal?.aborted) setAvailabilityLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void refreshAvailability(controller.signal);
    return () => controller.abort();
    // Availability is refreshed when stay dates or guest capacity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkIn, checkOut, searchAdults, searchChildren]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadOptions() {
      try {
        if (!(await restoreSession())) return;
        const [experienceResult, methodResult] = await Promise.all([
          getWalkInExperiences(controller.signal),
          getWalkInPaymentMethods(controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setExperiences(experienceResult.items);
        const activeMethods = methodResult.items.filter(
          (item) => item.isActive,
        );
        setMethods(activeMethods);
        setPaymentMethodId(activeMethods[0]?.id ?? "");
        setDepositMethodId(activeMethods[0]?.id ?? "");
      } catch (error) {
        if (!controller.signal.aborted)
          setFeedback(
            error instanceof Error
              ? error.message
              : "Pilihan form gagal dimuat.",
          );
      }
    }
    void loadOptions();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    setQuote(null);
    setQuotedInput("");
    if (nights < 1 || rooms.length === 0) {
      setQuoteLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setQuoteLoading(true);
      try {
        const result = await quoteWalkIn(
          {
            checkInDate: checkIn,
            checkOutDate: checkOut,
            rooms: rooms.map(({ key: _key, ...room }) => room),
            experiences: selectedExperiences,
          },
          controller.signal,
        );
        if (!controller.signal.aborted) {
          setQuote(result);
          setQuotedInput(currentQuoteInput);
          setFeedback("");
        }
      } catch (error) {
        if (!controller.signal.aborted)
          setFeedback(
            error instanceof Error
              ? error.message
              : "Harga reservasi gagal dihitung.",
          );
      } finally {
        if (!controller.signal.aborted) setQuoteLoading(false);
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    checkIn,
    checkOut,
    rooms,
    selectedExperiences,
    nights,
    currentQuoteInput,
  ]);

  function setRoomCount(option: AvailableRoom, count: number) {
    const current = rooms.filter(
      (room) => room.roomTypeId === option.roomType.id,
    );
    const difference = count - current.length;
    if (difference > 0) {
      setRooms((previous) => [
        ...previous,
        ...Array.from({ length: difference }, () => ({
          key: crypto.randomUUID(),
          roomTypeId: option.roomType.id,
          adults: searchAdults,
          children: searchChildren,
          extraBeds: 0,
        })),
      ]);
    } else if (difference < 0) {
      const removed = new Set(current.slice(count).map((room) => room.key));
      setRooms((previous) => previous.filter((room) => !removed.has(room.key)));
    }
  }

  function updateRoom(key: string, patch: Partial<RoomEntry>) {
    setRooms((previous) =>
      previous.map((room) => (room.key === key ? { ...room, ...patch } : room)),
    );
  }

  function validate(checkInGuest: boolean) {
    if (!checkIn || (initialDate && checkIn < initialDate))
      return "Tanggal check-in tidak boleh sebelum hari ini.";
    if (checkInGuest && checkIn !== todayJakarta())
      return "Save & Check-in hanya tersedia untuk check-in hari ini. Gunakan Save Reservation untuk tanggal mendatang.";
    if (nights < 1) return "Tanggal check-out harus setelah check-in.";
    if (!rooms.length) return "Pilih minimal satu kamar.";
    if (availabilityLoading) return "Tunggu hasil pencarian kamar selesai.";
    if (rooms.some((room) => !available.find(
      (option) => option.roomType.id === room.roomTypeId && option.bookable,
    ))) return "Kamar yang dipilih tidak tersedia untuk kapasitas atau tanggal ini.";
    if (!quote || quoteLoading || quotedInput !== currentQuoteInput)
      return "Tunggu perhitungan harga dari API selesai.";
    if (!guestName.trim() || !phone.trim())
      return "Nama tamu dan nomor WhatsApp wajib diisi.";
    if (checkInGuest && rooms.some((room) => !room.roomUnitId))
      return "Pilih nomor untuk setiap kamar sebelum check-in.";
    const ids = rooms.map((room) => room.roomUnitId).filter(Boolean);
    if (new Set(ids).size !== ids.length)
      return "Nomor kamar tidak boleh digunakan dua kali.";
    if (
      paymentStatus === "Partial" &&
      (partialAmount < 1 || partialAmount >= total)
    ) {
      return "Pembayaran Partial harus lebih dari Rp0 dan kurang dari total reservasi.";
    }
    if (amountPaid > 0 && !paymentMethodId) return "Pilih metode pembayaran.";
    if (requireDeposit && (depositAmount < 1 || !depositMethodId))
      return "Isi jumlah dan metode deposit.";
    if (checkInGuest && balance > 0 && !acknowledged)
      return "Konfirmasi sisa tagihan sebelum check-in.";
    return "";
  }

  function requestSave(checkInGuest: boolean) {
    if (checkInGuest && checkIn !== todayJakarta()) {
      setFeedback("Save & Check-in hanya tersedia untuk check-in hari ini. Gunakan Save Reservation untuk tanggal mendatang.");
      return;
    }
    const error = validate(false);
    if (error) {
      setFeedback(error);
      return;
    }
    if (checkInGuest && rooms.some((room) => !room.roomUnitId)) {
      setFeedback("Pilih nomor untuk setiap kamar sebelum check-in.");
      return;
    }
    setAcknowledged(false);
    setFeedback("");
    setSaveConfirmation(checkInGuest ? "check-in" : "save");
  }

  async function submit(checkInGuest: boolean) {
    const error = validate(checkInGuest);
    if (error) {
      setFeedback(error);
      return;
    }
    const payload = {
      guest: {
        fullName: guestName.trim(),
        phone: phone.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
      },
      checkInDate: checkIn,
      checkOutDate: checkOut,
      rooms: rooms.map(({ key: _key, ...room }) => room),
      experiences: selectedExperiences,
      ...(notes.trim() ? { specialRequests: notes.trim() } : {}),
      confirm: checkInGuest,
      checkIn: checkInGuest,
      acknowledgeOutstanding: checkInGuest && balance > 0,
      ...(amountPaid > 0
        ? { payment: { methodId: paymentMethodId, amount: amountPaid } }
        : {}),
      ...(requireDeposit
        ? {
            deposit: {
              methodId: depositMethodId,
              amount: depositAmount,
              notes: depositNote.trim(),
            },
          }
        : {}),
    };
    const body = JSON.stringify(payload);
    if (requestKey.current?.body !== body)
      requestKey.current = { body, key: crypto.randomUUID() };
    setSaving(true);
    setFeedback("");
    try {
      const response = await createWalkIn({
        idempotencyKey: requestKey.current.key,
        ...payload,
      });
      setSaveConfirmation(null);
      setSaved({
        bookingId: response.reservation.bookingCode,
        checkedIn: checkInGuest,
      });
      requestKey.current = null;
    } catch (cause) {
      setFeedback(
        cause instanceof Error ? cause.message : "Reservasi gagal disimpan.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell
      title="Reservations"
      context="New Reservation"
      badge="WALK-IN MODE"
    >
      <div className="walkin-page">
        <div className="walkin-heading">
          <div>
            <h1>Create Reservation – Walk In</h1>
            <p>Buat reservasi baru untuk tamu</p>
          </div>
          <button
            type="button"
            className="reservation-secondary-button reset-button"
            onClick={() => {
              setCheckIn(initialDate);
              setCheckOut(nextStayDate(initialDate));
              setSearchAdults(2);
              setSearchChildren(0);
              setRooms([]);
              setSelectedExperiences([]);
              setGuestName("");
              setPhone("");
              setEmail("");
              setNotes("");
              setPaymentStatus("Unpaid");
              setPartialAmount(0);
              setRequireDeposit(false);
              setFeedback("");
            }}
          >
            ↻ &nbsp; Reset Form
          </button>
        </div>
        {feedback && (
          <div
            className="reservation-feedback reservation-feedback--error"
            role="alert"
          >
            {feedback}
            <button
              type="button"
              onClick={() => setFeedback("")}
              aria-label="Tutup pesan"
            >
              ×
            </button>
          </div>
        )}
        <div className="walkin-columns">
          <div className="walkin-form-column">
            <section className="reservation-panel reservation-source-panel">
              <h2>Reservation Source</h2>
              <div
                className="source-tabs"
                role="group"
                aria-label="Reservation Source"
              >
                <Link
                  href="/reservations/create-reservation-walkin"
                  className="source-tab source-tab--active"
                  aria-current="page"
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
                  className="source-tab"
                >
                  OTA
                </Link>
              </div>
            </section>
            <section className="reservation-panel">
              <div className="reservation-panel__heading">
                <h2>Stay</h2>
                <span className="status-badge status-badge--success">
                  {nights} {nights === 1 ? "night" : "nights"}
                </span>
              </div>
              <div className="stay-fields">
                <ReservationField label="Check-in" htmlFor="check-in">
                  <input
                    id="check-in"
                    type="date"
                    min={initialDate || undefined}
                    value={checkIn}
                    onChange={(event) => {
                      const date = event.target.value;
                      if (initialDate && date < initialDate) return;
                      setCheckIn(date);
                      setRooms([]);
                      if (date >= checkOut)
                        setCheckOut(nextStayDate(date));
                    }}
                  />
                </ReservationField>
                <ReservationField label="Check-out" htmlFor="check-out">
                  <input
                    id="check-out"
                    type="date"
                    min={checkIn ? nextStayDate(checkIn) : undefined}
                    value={checkOut}
                    onChange={(event) => {
                      setCheckOut(event.target.value);
                      setRooms([]);
                    }}
                  />
                </ReservationField>
                <ReservationField label="Adults" htmlFor="adults">
                  <select
                    id="adults"
                    value={searchAdults}
                    onChange={(event) =>
                      setSearchAdults(Number(event.target.value))
                    }
                  >
                    {Array.from({ length: 20 }, (_, index) => index + 1).map(
                      (value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ),
                    )}
                  </select>
                </ReservationField>
                <ReservationField label="Children" htmlFor="children">
                  <select
                    id="children"
                    value={searchChildren}
                    onChange={(event) =>
                      setSearchChildren(Number(event.target.value))
                    }
                  >
                    {Array.from({ length: 21 }, (_, index) => index).map(
                      (value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ),
                    )}
                  </select>
                </ReservationField>
                <button
                  type="button"
                  className="reservation-secondary-button availability-check"
                  disabled={availabilityLoading}
                  onClick={() => void refreshAvailability()}
                >
                  ⌕ &nbsp; {availabilityLoading ? "Checking..." : "Check"}
                </button>
              </div>
            </section>
            <section className="reservation-panel">
              <div className="reservation-panel__heading">
                <h2>Available Rooms</h2>
                <span className="reservation-panel__meta">
                  Terpilih: {selectedRooms} Kamar
                </span>
              </div>
              <div className="available-rooms">
                {available.map((option) => {
                  const count = rooms.filter(
                    (room) => room.roomTypeId === option.roomType.id,
                  ).length;
                  const bookableCount = option.bookable ? option.availableRooms : 0;
                  const assignableCount = Math.min(
                    bookableCount,
                    option.assignableRoomUnits.length,
                  );
                  return (
                    <div
                      className={`room-option${count ? " room-option--selected" : ""}${option.bookable ? "" : " room-option--unavailable"}`}
                      key={option.roomType.id}
                    >
                      <div>
                        <div className="room-option__name">
                          <strong>{option.roomType.name}</strong>
                          {!option.bookable && (
                            <span className="room-option__unavailable-badge">
                              Tidak dapat dipilih
                            </span>
                          )}
                        </div>
                        <div className="room-option__availability">
                          <span>
                            {option.availableRooms}{" "}
                            {option.bookable
                              ? "stok reservasi tersedia"
                              : "stok tersisa · tidak dapat dipesan"}
                          </span>
                          <span
                            className={
                              assignableCount === 0
                                ? "room-option__assignment room-option__assignment--empty"
                                : "room-option__assignment"
                            }
                          >
                            {assignableCount} {roomAssignmentLabel}
                          </span>
                        </div>
                        <small className={option.bookable ? undefined : "room-option__reason"}>
                          {option.bookable
                            ? `${option.roomType.maxExtraBeds} extra bed max`
                            : option.unavailableReasons
                                .map((reason) => unavailableReasonLabels[reason] ?? reason)
                                .join(" · ") || "Tidak tersedia untuk pencarian ini"}
                        </small>
                      </div>
                      <div className="room-option__right">
                        <div className="room-option__rate">
                          <strong>
                            {option.totalPrice === null
                              ? "—"
                              : formatRupiah(
                                  Math.round(option.totalPrice / nights),
                                )}
                          </strong>
                          <small>/ night</small>
                        </div>
                        <QuantityControl
                          label={option.roomType.name}
                          value={count}
                          max={
                            option.bookable
                              ? Math.min(
                                  option.availableRooms,
                                  checkIn <= initialDate
                                    ? option.assignableRoomUnits.length
                                    : 20,
                                  20,
                                )
                              : 0
                          }
                          onChange={(value) => setRoomCount(option, value)}
                        />
                      </div>
                    </div>
                  );
                })}
                {!availabilityLoading && available.length === 0 && (
                  <p className="reservation-empty">
                    Tidak ada tipe kamar tersedia untuk tanggal ini.
                  </p>
                )}
              </div>
            </section>
            <section className="reservation-panel">
              <h2>Assign Rooms</h2>
              {rooms.some(
                (room) =>
                  !room.roomUnitId &&
                  available.find((option) => option.roomType.id === room.roomTypeId)
                    ?.assignableRoomUnits.length === 0,
              ) && (
                <p className="assign-rooms-note">
                  Nomor kamar belum tersedia untuk ditetapkan. Reservasi tetap dapat
                  disimpan; Save &amp; Check-in memerlukan nomor kamar tersedia.
                </p>
              )}
              {rooms.length ? (
                <div className="assign-rooms-table-scroll">
                  <table className="assign-rooms-table">
                    <thead>
                      <tr>
                        <th scope="col">Room Type</th>
                        <th scope="col">Room No.</th>
                        <th scope="col">Adults</th>
                        <th scope="col">Children</th>
                        <th scope="col">Extra Bed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rooms.map((room, index) => {
                        const option = available.find(
                          (item) => item.roomType.id === room.roomTypeId,
                        );
                        if (!option) return null;
                        const roomIndex = rooms
                          .slice(0, index + 1)
                          .filter((item) => item.roomTypeId === room.roomTypeId)
                          .length;
                        return (
                          <tr key={room.key}>
                            <th scope="row">
                              <strong>{option.roomType.name}</strong>
                              <small>Room {roomIndex}</small>
                            </th>
                            <td>
                              <select
                                aria-label={`${option.roomType.name} room ${roomIndex} number`}
                                value={room.roomUnitId ?? ""}
                                onChange={(event) =>
                                  updateRoom(room.key, {
                                    roomUnitId: event.target.value || undefined,
                                  })
                                }
                              >
                                <option value="">
                                  {option.assignableRoomUnits.length
                                    ? "Assign at check-in"
                                    : "No available room number"}
                                </option>
                                {option.assignableRoomUnits.map((unit) => (
                                  <option
                                    key={unit.id}
                                    value={unit.id}
                                    disabled={rooms.some(
                                      (other) =>
                                        other.key !== room.key &&
                                        other.roomUnitId === unit.id,
                                    )}
                                  >
                                    Room {unit.roomNumber}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                aria-label={`${option.roomType.name} room ${roomIndex} adults`}
                                type="number"
                                min={0}
                                value={room.adults}
                                onChange={(event) =>
                                  updateRoom(room.key, {
                                    adults: Number(event.target.value),
                                  })
                                }
                              />
                            </td>
                            <td>
                              <input
                                aria-label={`${option.roomType.name} room ${roomIndex} children`}
                                type="number"
                                min={0}
                                value={room.children}
                                onChange={(event) =>
                                  updateRoom(room.key, {
                                    children: Number(event.target.value),
                                  })
                                }
                              />
                            </td>
                            <td>
                              {option.roomType.extraBedEnabled ? (
                                <div className="assign-rooms-extra-bed">
                                  <input
                                    aria-label={`${option.roomType.name} room ${roomIndex} extra beds`}
                                    type="number"
                                    min={0}
                                    max={option.roomType.maxExtraBeds}
                                    value={room.extraBeds}
                                    onChange={(event) =>
                                      updateRoom(room.key, {
                                        extraBeds: Number(event.target.value),
                                      })
                                    }
                                  />
                                  <small>
                                    {formatRupiah(option.roomType.extraBedPricePerNight)} / night
                                  </small>
                                </div>
                              ) : (
                                <span className="assign-rooms-unavailable">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="reservation-empty">
                  Pilih kamar untuk menentukan nomor kamar.
                </p>
              )}
            </section>
            <section className="reservation-panel">
              <h2>Guest Information</h2>
              <div className="guest-fields">
                <ReservationField
                  label="Full Name"
                  htmlFor="guest-name"
                  required
                >
                  <input
                    id="guest-name"
                    value={guestName}
                    onChange={(event) => setGuestName(event.target.value)}
                  />
                </ReservationField>
                <ReservationField label="WhatsApp" htmlFor="whatsapp" required>
                  <input
                    id="whatsapp"
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                </ReservationField>
                <ReservationField label="Email" htmlFor="email" optional>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </ReservationField>
                <ReservationField label="Notes" htmlFor="notes" optional>
                  <input
                    id="notes"
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
                  onClick={() => setAddingExperience((value) => !value)}
                >
                  ＋ Add
                </button>
              </div>
              {addingExperience && (
                <div className="extra-picker">
                  <label htmlFor="extra-choice">Pilih add-on</label>
                  <select
                    id="extra-choice"
                    value=""
                    onChange={(event) => {
                      if (event.target.value)
                        setSelectedExperiences((current) => [
                          ...current,
                          { variantId: event.target.value, quantity: 1 },
                        ]);
                      setAddingExperience(false);
                    }}
                  >
                    <option value="">Pilih paket</option>
                    {variants
                      .filter(
                        (variant) =>
                          !selectedExperiences.some(
                            (item) => item.variantId === variant.id,
                          ),
                      )
                      .map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {variant.label} · {formatRupiah(variant.price)}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              <div className="selected-extras">
                {selectedExperiences.map((item) => {
                  const variant = variants.find(
                    (option) => option.id === item.variantId,
                  );
                  if (!variant) return null;
                  return (
                    <div className="selected-extra" key={item.variantId}>
                      <div className="selected-extra__description">
                        <strong>{variant.label}</strong>
                        <small>{formatRupiah(variant.price)} / paket</small>
                      </div>
                      <div className="selected-extra__actions">
                        <QuantityControl
                          label={variant.label}
                          value={item.quantity}
                          min={1}
                          max={20}
                          onChange={(value) =>
                            setSelectedExperiences((current) =>
                              current.map((entry) =>
                                entry.variantId === item.variantId
                                  ? { ...entry, quantity: value }
                                  : entry,
                              ),
                            )
                          }
                        />
                        <strong>
                          {formatRupiah(variant.price * item.quantity)}
                        </strong>
                        <button
                          type="button"
                          aria-label={`Hapus ${variant.label}`}
                          onClick={() =>
                            setSelectedExperiences((current) =>
                              current.filter(
                                (entry) => entry.variantId !== item.variantId,
                              ),
                            )
                          }
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
                {selectedExperiences.length === 0 && (
                  <p className="reservation-empty">Belum ada add-on.</p>
                )}
              </div>
            </section>
            <section className="reservation-panel">
              <h2>Payment</h2>
              <div className="payment-fields">
                <ReservationField
                  label="Payment Method"
                  htmlFor="payment-method"
                >
                  <select
                    id="payment-method"
                    value={paymentMethodId}
                    onChange={(event) => setPaymentMethodId(event.target.value)}
                  >
                    <option value="">Select method</option>
                    {methods.map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.name}
                      </option>
                    ))}
                  </select>
                </ReservationField>
                <ReservationField
                  label="Payment Status"
                  htmlFor="payment-status"
                >
                  <select
                    id="payment-status"
                    value={paymentStatus}
                    onChange={(event) =>
                      setPaymentStatus(event.target.value as PaymentStatus)
                    }
                  >
                    {["Unpaid", "Partial", "Paid"].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </ReservationField>
                <ReservationField label="Amount Paid" htmlFor="amount-paid">
                  <input
                    id="amount-paid"
                    inputMode="numeric"
                    value={formatRupiah(amountPaid)}
                    disabled={paymentStatus !== "Partial"}
                    onChange={(event) =>
                      setPartialAmount(money(event.target.value))
                    }
                  />
                </ReservationField>
              </div>
            </section>
            <section className="reservation-panel">
              <div className="reservation-panel__heading">
                <h2>Deposit</h2>
                <label className="deposit-checkbox">
                  <input
                    type="checkbox"
                    checked={requireDeposit}
                    onChange={(event) =>
                      setRequireDeposit(event.target.checked)
                    }
                  />{" "}
                  Require Deposit
                </label>
              </div>
              {requireDeposit && (
                <div className="deposit-fields">
                  <ReservationField
                    label="Deposit Amount"
                    htmlFor="deposit-amount"
                  >
                    <input
                      id="deposit-amount"
                      inputMode="numeric"
                      value={formatRupiah(depositAmount)}
                      onChange={(event) =>
                        setDepositAmount(money(event.target.value))
                      }
                    />
                  </ReservationField>
                  <ReservationField
                    label="Deposit Method"
                    htmlFor="deposit-method"
                  >
                    <select
                      id="deposit-method"
                      value={depositMethodId}
                      onChange={(event) =>
                        setDepositMethodId(event.target.value)
                      }
                    >
                      <option value="">Select method</option>
                      {methods.map((method) => (
                        <option key={method.id} value={method.id}>
                          {method.name}
                        </option>
                      ))}
                    </select>
                  </ReservationField>
                  <ReservationField
                    label="Deposit Note"
                    htmlFor="deposit-note"
                    optional
                  >
                    <input
                      id="deposit-note"
                      value={depositNote}
                      onChange={(event) => setDepositNote(event.target.value)}
                    />
                  </ReservationField>
                </div>
              )}
            </section>
          </div>
          <aside className="booking-summary">
            <div className="booking-summary__header">
              <h2>Booking Summary</h2>
              <span>Walk-in</span>
            </div>
            <div className="booking-summary__stay">
              <span>Stay</span>
              <strong>
                {formatStayDate(checkIn)} → {formatStayDate(checkOut)} ·{" "}
                {nights} {nights === 1 ? "night" : "nights"}
              </strong>
            </div>
            <div className="booking-summary__lines">
              {rooms.map((room, index) => {
                const roomDiscount = quote?.rows
                  .filter((row) => row.roomIndex === index)
                  .reduce((sum, row) => sum + row.discountAmount, 0) ?? 0;
                return (
                  <div className="booking-summary__room" key={room.key}>
                    <div>
                      <span>
                        {available.find(
                          (item) => item.roomType.id === room.roomTypeId,
                        )?.roomType.name ?? "Room"}{" "}
                        #{index + 1}
                      </span>
                      <strong>
                        {quote
                          ? formatRupiah(quote.charges.rooms[index]?.subtotal ?? 0)
                          : "—"}
                      </strong>
                    </div>
                    {roomDiscount > 0 && (
                      <div className="booking-summary__discount">
                        <span>Diskon kamar #{index + 1}</span>
                        <span>−{formatRupiah(roomDiscount)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
              {selectedExperiences.map((item) => (
                <div key={item.variantId}>
                  <span>
                    {variants.find((variant) => variant.id === item.variantId)
                      ?.label ?? "Experience"}{" "}
                    × {item.quantity}
                  </span>
                  <strong>
                    {quote
                      ? formatRupiah(
                          quote.charges.experiences.find(
                            (entry) => entry.variantId === item.variantId,
                          )?.amount ?? 0,
                        )
                      : "—"}
                  </strong>
                </div>
              ))}
              {!rooms.length && (
                <div className="booking-summary__empty">Pilih kamar</div>
              )}
            </div>
            {quote && quote.appliedCampaigns.length > 0 && (
              <details className="booking-summary__campaigns">
                <summary>See Campaign</summary>
                <ul>
                  {quote.appliedCampaigns.map((campaign) => (
                    <li key={campaign.id}>
                      <strong>{campaign.name}</strong>
                      <span>
                        Berlaku sampai{" "}
                        {campaign.stayEnd || campaign.bookingEnd
                          ? formatStayDate(campaign.stayEnd ?? campaign.bookingEnd ?? "")
                          : "tanpa batas tanggal"}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <div className="booking-summary__totals">
              {quote && quote.discountTotal > 0 && (
                <>
                  <div>
                    <span>Subtotal sebelum diskon</span>
                    <span>{formatRupiah(total + quote.discountTotal)}</span>
                  </div>
                  <div className="booking-summary__discount">
                    <span>Total Discount</span>
                    <strong>−{formatRupiah(quote.discountTotal)}</strong>
                  </div>
                </>
              )}
              <div>
                <strong>Booking Total</strong>
                <strong>
                  {quoteLoading
                    ? "Menghitung..."
                    : quote
                      ? formatRupiah(total)
                      : "—"}
                </strong>
              </div>
              <div>
                <span>Deposit</span>
                <span>{formatRupiah(requireDeposit ? depositAmount : 0)}</span>
              </div>
              <div className="booking-summary__collected">
                <strong>Total Collected</strong>
                <strong>
                  {quote
                    ? formatRupiah(
                        amountPaid + (requireDeposit ? depositAmount : 0),
                      )
                    : "—"}
                </strong>
              </div>
            </div>
            <p className="booking-summary__note">
              Deposit is held separately and is not included in booking revenue.
            </p>
            <div className="booking-summary__actions">
              {checkIn === initialDate && (
                <button
                  type="button"
                  className="action-button"
                  disabled={saving}
                  onClick={() => requestSave(true)}
                >
                  Save &amp; Check-in
                </button>
              )}
              <button
                type="button"
                className="reservation-secondary-button"
                disabled={saving}
                onClick={() => requestSave(false)}
              >
                Save Reservation
              </button>
            </div>
          </aside>
        </div>
      </div>
      {saveConfirmation && (
        <SaveReservationConfirmation
          guestName={guestName}
          action={saveConfirmation}
          total={total}
          rooms={selectedRooms}
          nights={nights}
          onCancel={() => setSaveConfirmation(null)}
          onConfirm={() => void submit(saveConfirmation === "check-in")}
          outstandingBalance={balance}
          acknowledged={acknowledged}
          onAcknowledgedChange={setAcknowledged}
          busy={saving}
        />
      )}
      {saved && (
        <ReservationSuccessTransition
          bookingId={saved.bookingId}
          checkedIn={saved.checkedIn}
        />
      )}
    </AdminShell>
  );
}
