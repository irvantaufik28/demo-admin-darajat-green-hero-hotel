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
import { ReservationErrorToast } from "../components/ReservationErrorToast";
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
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

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
  const { t } = useTranslations({ en, id });
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
  const [validationAttempted, setValidationAttempted] = useState(false);
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
          unit: t("form.experiences.perPackage"),
        })),
      ));
      setChannel((current) => current || result.channels[0]?.id || "");
      setRooms((current) => current.length ? current : result.roomTypes[0]
        ? [{ id: 1, type: result.roomTypes[0].id, quantity: 1, rate: 0, configurations: [{ adults: 2, children: 0, extraBeds: 0 }] }]
        : []);
    }).catch((cause) => {
      if (!controller.signal.aborted) setFeedback({ kind: "error", text: cause instanceof Error ? cause.message : t("ota.feedback.optionsLoadError") });
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
          if (!controller.signal.aborted) setQuoteError(cause instanceof Error ? cause.message : t("ota.feedback.quoteLoadError"));
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
    setValidationAttempted(false);
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
        text: t("ota.feedback.allRoomsRecorded"),
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
    setValidationAttempted(true);
    if (minimumCheckIn && checkIn < minimumCheckIn)
      return setFeedback({ kind: "error", text: t("ota.feedback.checkInBeforeToday") });
    if (nights < 1)
      return setFeedback({
        kind: "error",
        text: t("ota.feedback.checkOutAfterCheckIn"),
      });
    if (selectedRooms < 1)
      return setFeedback({
        kind: "error",
        text: t("ota.feedback.selectRoom"),
      });
    if (selectedRooms > 20)
      return setFeedback({ kind: "error", text: t("ota.feedback.maxRooms") });
    if (rooms.some((room) => room.rate < 1))
      return setFeedback({
        kind: "error",
        text: t("ota.feedback.rateRequired"),
      });
    if (!channel)
      return setFeedback({ kind: "error", text: t("ota.feedback.channelRequired") });
    if (!reference.trim())
      return setFeedback({
        kind: "error",
        text: t("ota.feedback.referenceRequired"),
      });
    if (!guestName.trim() || !whatsapp.trim())
      return setFeedback({
        kind: "error",
        text: t("ota.feedback.guestRequired"),
      });
    if (!quote || quoteBusy || quoteError)
      return setFeedback({ kind: "error", text: quoteError || t("ota.feedback.waitQuote") });
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
        text: cause instanceof Error ? cause.message : t("ota.feedback.saveError"),
      });
    } finally {
      setSaveBusy(false);
    }
  }

  return (
    <AdminShell title={t("shell.title")} context={t("shell.newReservation")} badge={t("shell.otaMode")}>
      <div className="walkin-page">
        {(feedback?.kind === "error" || quoteError) && (
          <ReservationErrorToast
            message={quoteError || feedback?.text || ""}
            title={t("common.errorToastTitle")}
            closeLabel={t("common.closeMessage")}
            onClose={() => {
              setQuoteError("");
              if (feedback?.kind === "error") setFeedback(null);
            }}
          />
        )}
        <div className="walkin-heading">
          <div>
            <h1>{t("ota.title")}</h1>
            <p>
              {t("ota.description")}
            </p>
          </div>
          <button
            type="button"
            className="reservation-secondary-button reset-button"
            onClick={resetForm}
          >
            ↻ &nbsp; {t("ota.resetForm")}
          </button>
        </div>
        {feedback && feedback.kind !== "error" && (
          <div
            className={
              "reservation-feedback reservation-feedback--" + feedback.kind
            }
            role="status"
          >
            {feedback.text}
            <button
              type="button"
              onClick={() => setFeedback(null)}
              aria-label={t("common.closeMessage")}
            >
              ×
            </button>
          </div>
        )}
        {optionsLoading ? <LoadingSkeleton variant="form" rows={8} /> : <div className="walkin-columns">
          <div className="walkin-form-column">
            <section className="reservation-panel ota-source-panel">
              <div className="reservation-panel__heading">
                <h2>{t("ota.sourceSection")}</h2>
                <div
                  className="source-tabs"
                  role="group"
                  aria-label={t("ota.sourceSection")}
                >
                  <Link
                    href="/reservations/create-reservation-walkin"
                    className="source-tab"
                  >
                    {t("form.sourceTabs.walkIn")}
                  </Link>
                  <Link
                    href="/reservations/create-reservation-phone"
                    className="source-tab"
                  >
                    {t("form.sourceTabs.phone")}
                  </Link>
                  <Link
                    href="/reservations/create-reservation-ota"
                    className="source-tab source-tab--active"
                    aria-current="page"
                  >
                    {t("form.sourceTabs.ota")}
                  </Link>
                </div>
              </div>
              <div className="ota-source-fields">
                <ReservationField
                  label={t("ota.channelLabel")}
                  htmlFor="ota-channel"
                  required
                  invalid={validationAttempted && !channel}
                >
                  <select
                    id="ota-channel"
                    value={channel}
                    onChange={(event) => setChannel(event.target.value)}
                  >
                    <option value="">{t("ota.channelPlaceholder")}</option>
                    {channels.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </ReservationField>
                <ReservationField
                  label={t("ota.referenceLabel")}
                  htmlFor="ota-reference"
                  required
                  invalid={validationAttempted && !reference.trim()}
                >
                  <input
                    id="ota-reference"
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    placeholder={t("ota.referencePlaceholder")}
                  />
                </ReservationField>
              </div>
              <p className="ota-field-hint">
                {t("ota.referenceHint")}
              </p>
            </section>
            <section className="reservation-panel">
              <div className="reservation-panel__heading">
                <h2>{t("ota.stay.title")}</h2>
                <span className="status-badge status-badge--success">
                  {nights === 1 ? t("ota.stay.nightBadge", { nights }) : t("ota.stay.nightsBadge", { nights })}
                </span>
              </div>
              <div className="stay-fields">
                <ReservationField
                  label={t("ota.stay.checkIn")}
                  htmlFor="ota-check-in"
                  required
                  invalid={
                    validationAttempted &&
                    (!checkIn ||
                      Boolean(minimumCheckIn && checkIn < minimumCheckIn))
                  }
                >
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
                <ReservationField
                  label={t("ota.stay.checkOut")}
                  htmlFor="ota-check-out"
                  required
                  invalid={validationAttempted && nights < 1}
                >
                  <input
                    id="ota-check-out"
                    type="date"
                    min={checkIn ? nextStayDate(checkIn) : undefined}
                    value={checkOut}
                    onChange={(event) => setCheckOut(event.target.value)}
                  />
                </ReservationField>
                <ReservationField label={t("ota.stay.defaultAdults")} htmlFor="ota-adults">
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
                <ReservationField label={t("ota.stay.defaultChildren")} htmlFor="ota-children">
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
                              t("ota.feedback.availabilityOk", { nights }),
                          }
                        : {
                            kind: "error",
                            text: t("ota.feedback.availabilityInvalid"),
                          },
                    )
                  }
                >
                  ⌕ &nbsp; {t("ota.stay.check")}
                </button>
              </div>
            </section>
            <section className="reservation-panel">
              <div className="reservation-panel__heading ota-rooms-heading">
                <div>
                  <h2>{t("ota.rooms.title")}</h2>
                  <p>
                    {t("ota.rooms.description")}
                  </p>
                </div>
                <span className="status-badge status-badge--success">
                  {t("ota.rooms.selectedBadge", { types: rooms.length, units: selectedRooms })}
                </span>
              </div>
              <div className="ota-room-list">
                {rooms.map((room) => {
                  const type = roomTypeOptions.find((item) => item.id === room.type);
                  return (
                    <div className="ota-room-row" key={room.id}>
                      <ReservationField
                        label={t("ota.rooms.roomType")}
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
                        <label>{t("ota.rooms.quantity")}</label>
                        <QuantityControl
                          label={type?.name ?? t("ota.rooms.roomDefault")}
                          value={room.quantity}
                          min={1}
                          max={20}
                          onChange={(value) =>
                            updateRoom(room.id, { quantity: value })
                          }
                        />
                      </div>
                      <ReservationField
                        label={t("ota.rooms.rateLabel")}
                        htmlFor={"ota-rate-" + room.id}
                        required
                        invalid={validationAttempted && room.rate < 1}
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
                        <small>{t("ota.rooms.subtotal", { nights })}</small>
                        <strong>
                          {formatRupiah(room.rate * room.quantity * nights)}
                        </strong>
                      </div>
                      <button
                        type="button"
                        className="ota-remove-room"
                        aria-label={t("ota.rooms.removeAriaLabel", { name: type?.name ?? t("ota.rooms.roomDefault") })}
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
                            <strong>{t("ota.rooms.unitRoom", { index: index + 1 })}</strong>
                            <label>{t("ota.rooms.adults")}
                              <select value={configuration.adults} onChange={(event) => updateRoomConfiguration(room.id, index, { adults: Number(event.target.value) })}>
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((value) => <option key={value} value={value}>{value}</option>)}
                              </select>
                            </label>
                            <label>{t("ota.rooms.children")}
                              <select value={configuration.children} onChange={(event) => updateRoomConfiguration(room.id, index, { children: Number(event.target.value) })}>
                                {[0, 1, 2, 3, 4].map((value) => <option key={value} value={value}>{value}</option>)}
                              </select>
                            </label>
                            {type?.extraBedEnabled && type.maxExtraBeds > 0 && (
                              <div className="reservation-field">
                                <label>{t("ota.rooms.extraBedLabel", { price: formatRupiah(type.extraBedPricePerNight) })}</label>
                                <QuantityControl
                                  label={t("ota.rooms.extraBedAriaLabel", { index: index + 1 })}
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
                  ＋ {t("ota.rooms.addRoomType")}
                </button>
                <span>
                  {t("ota.rooms.subtotalOta", { amount: formatRupiah(roomsTotal) })}
                </span>
              </div>
              <p className="ota-operational-note">
                ⓘ &nbsp; {t("ota.rooms.operationalNote")}
              </p>
            </section>
            <section className="reservation-panel">
              <h2>{t("ota.guest.title")}</h2>
              <div className="guest-fields">
                <ReservationField
                  label={t("ota.guest.fullName")}
                  htmlFor="ota-guest-name"
                  required
                  invalid={validationAttempted && !guestName.trim()}
                >
                  <input
                    id="ota-guest-name"
                    value={guestName}
                    onChange={(event) => setGuestName(event.target.value)}
                  />
                </ReservationField>
                <ReservationField
                  label={t("ota.guest.whatsapp")}
                  htmlFor="ota-whatsapp"
                  required
                  invalid={validationAttempted && !whatsapp.trim()}
                >
                  <input
                    id="ota-whatsapp"
                    type="tel"
                    value={whatsapp}
                    onChange={(event) => setWhatsapp(event.target.value)}
                  />
                </ReservationField>
                <ReservationField label={t("ota.guest.email")} htmlFor="ota-email" optional>
                  <input
                    id="ota-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </ReservationField>
                <ReservationField label={t("ota.guest.notes")} htmlFor="ota-notes" optional>
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
                <h2>{t("ota.experiences.title")}</h2>
                <button
                  type="button"
                  className="reservation-secondary-button reservation-add-button"
                  onClick={() => setAddingExtra((value) => !value)}
                >
                  ＋ {t("ota.experiences.add")}
                </button>
              </div>
              {addingExtra && (
                <div className="extra-picker">
                  <label htmlFor="ota-extra-choice">{t("ota.experiences.pickAddOn")}</label>
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
                    <option value="">{t("ota.experiences.selectPackage")}</option>
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
                          aria-label={t("ota.rooms.removeAriaLabel", { name: extra.label })}
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
                  <p className="reservation-empty">{t("ota.experiences.empty")}</p>
                )}
              </div>
            </section>
            <section className="reservation-panel">
              <h2>{t("ota.payment.title")}</h2>
              <div className="payment-fields">
                <div className="reservation-field">
                  <label>{t("ota.payment.typeLabel")}</label>
                  <div className="ota-payment-status">{t("ota.payment.prepaidByOta")}</div>
                </div>
                <div className="reservation-field">
                  <label>{t("ota.payment.statusLabel")}</label>
                  <div
                    className={
                      "ota-payment-status ota-payment-status--" +
                      paymentStatus.toLowerCase()
                    }
                  >
                    {t("status.paid")}
                  </div>
                </div>
                <div className="reservation-field">
                  <label>{t("ota.payment.amountPaidLabel")}</label>
                  <div className="ota-payment-status">
                    {formatRupiah(amountPaid)}
                  </div>
                </div>
              </div>
              <p className="ota-settlement-note">
                <strong>{t("ota.payment.settlementNote")}</strong>{t("ota.payment.settlementNoteBody", { channel: channelName })}
              </p>
            </section>
          </div>
          <aside className="booking-summary">
            <div className="booking-summary__header">
              <h2>{t("ota.summary.title")}</h2>
              <span>{t("ota.summary.sourceLabel", { channel: channelName })}</span>
            </div>
            <div className="booking-summary__stay">
              <span>{t("ota.summary.otaReference")}</span>
              <strong>{reference.trim() || t("common.emptyDash")}</strong>
            </div>
            <div className="booking-summary__stay">
              <span>{t("ota.summary.stay")}</span>
              <strong>
                {t("ota.summary.stayValue", { from: formatStayDate(checkIn), to: formatStayDate(checkOut), nights })}
              </strong>
            </div>
            <div className="booking-summary__lines">
              {rooms.map((room) => (
                <div key={room.id}>
                  <span>
                    {t("ota.summary.roomLine", { roomType: roomTypeOptions.find((type) => type.id === room.type)?.name ?? t("ota.rooms.roomDefault"), quantity: room.quantity, nights, rate: formatRupiah(room.rate) })}
                  </span>
                  <strong>
                    {formatRupiah(room.rate * room.quantity * nights)}
                  </strong>
                </div>
              ))}
              <div>
                <span>{t("ota.summary.roomsTotal")}</span>
                <strong>{formatRupiah(roomsTotal)}</strong>
              </div>
              {rooms.flatMap((room) => room.configurations.map((configuration, index) =>
                configuration.extraBeds > 0 ? (
                  <div key={`bed-${room.id}-${index}`}>
                    <span>{t("ota.summary.extraBedLine", { roomType: roomTypeOptions.find((type) => type.id === room.type)?.name ?? t("ota.rooms.roomDefault"), index: index + 1, quantity: configuration.extraBeds, nights })}</span>
                    <strong>{formatRupiah((roomTypeOptions.find((type) => type.id === room.type)?.extraBedPricePerNight ?? 0) * configuration.extraBeds * nights)}</strong>
                  </div>
                ) : null,
              ))}
              {selectedExtras.map((id) => {
                const extra = experienceOptions.find((item) => item.id === id);
                return extra ? (
                  <div key={id}>
                    <span>
                      {t("ota.summary.experience", { label: extra.label, quantity: extraQuantities[id] ?? 1 })}
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
                <strong>{t("ota.summary.bookingTotal")}</strong>
                <strong>{formatRupiah(total)}</strong>
              </div>
              <div>
                <span>{t("ota.summary.paymentArrangement")}</span>
                <span>{t("ota.payment.prepaidByOta")}</span>
              </div>
              <div>
                <span>{t("ota.summary.paymentStatus")}</span>
                <span
                  className={
                    "status-badge status-badge--" +
                    (paymentStatus === "Paid" ? "success" : "warning")
                  }
                >
                  {t("status.paid")}
                </span>
              </div>
              <div>
                <span>{t("ota.summary.amountPaid")}</span>
                <span>{formatRupiah(amountPaid)}</span>
              </div>
              <div className="booking-summary__collected">
                <strong>{t("ota.summary.remainingBalance")}</strong>
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
                {t("ota.summary.saveReservation")}
              </button>
              <button
                type="button"
                className="reservation-secondary-button"
                disabled
                title={t("ota.summary.draftUnavailable")}
              >
                {t("ota.summary.saveAsDraft")}
              </button>
            </div>
            <p className="booking-summary__note booking-summary__note--after">
              {t("ota.summary.note")}
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
