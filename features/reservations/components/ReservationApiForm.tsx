"use client";

import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AdminShell } from "../../../components/layout/AdminShell";
import { DateRangePicker } from "../../campaigns/components/DateRangePicker";
import { QuantityControl } from "./QuantityControl";
import { ReservationField } from "./ReservationField";
import { SaveReservationConfirmation } from "./SaveReservationConfirmation";
import { ReservationSuccessTransition } from "./ReservationSuccessTransition";
import { ReservationErrorToast } from "./ReservationErrorToast";
import {
  calculateNights,
  formatRupiah,
  formatStayDate,
} from "../constants/walk-in-data";
import { restoreSession } from "../../../lib/auth";
import {
  listPolicies,
  type PolicyRecord,
  type PolicyRuleRecord,
} from "../../cancellation-policies/services/cancellation-policies";
import { nextStayDate, todayJakarta } from "../utils/stay-dates";
import {
  autoAllocateRooms,
  roomAllocationError,
} from "../utils/room-allocation";
import { isValidGuestNik, normalizeGuestNik } from "../utils/guest-identity";
import {
  createReservation,
  getReservationAvailability,
  getReservationExperiences,
  getReservationPaymentMethods,
  getCreateCheckInContext,
  quoteReservation,
  type AvailableRoom,
  type ExperienceOption,
  type PaymentMethod,
  type ReservationQuote,
  type SelectedExperience,
  type SelectedRoom,
  type ReservationSource,
} from "../services/create";
import type { CheckInContext, EarlyCheckInInput } from "../services/api";
import { useTranslations, type Translate } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

type RoomEntry = SelectedRoom & { key: string };
type PaymentStatus = "Paid" | "Partial" | "Unpaid";

const unavailableReasonKeys: Record<string, string> = {
  capacity_mismatch: "form.unavailableReasons.capacityMismatch",
  capacity_not_configured: "form.unavailableReasons.capacityNotConfigured",
  not_configured: "form.unavailableReasons.notConfigured",
  stop_sell: "form.unavailableReasons.stopSell",
  minimum_nights: "form.unavailableReasons.minimumNights",
  sold_out: "form.unavailableReasons.soldOut",
  no_ready_room: "form.unavailableReasons.noReadyRoom",
};

function money(value: string) {
  return Number(value.replace(/\D/g, "")) || 0;
}

function describeCancellationRule(t: Translate, rule: PolicyRuleRecord) {
  const timing =
    rule.timingType === "more_than"
      ? t("form.cancellationPolicy.ruleMoreThan", { days: rule.daysBefore })
      : t("form.cancellationPolicy.ruleWithin", { days: rule.daysBefore });
  const charge =
    rule.chargeType === "percentage"
      ? rule.chargeValue === 0
        ? t("form.cancellationPolicy.chargeFree")
        : t("form.cancellationPolicy.chargePercentage", {
            value: rule.chargeValue,
          })
      : rule.chargeType === "fixed"
        ? t("form.cancellationPolicy.chargeFixed", {
            amount: formatRupiah(rule.chargeValue),
          })
        : t("form.cancellationPolicy.chargeNights", {
            value: rule.chargeValue,
          });
  return t("form.cancellationPolicy.ruleTemplate", { timing, charge });
}

function describeNoShow(t: Translate, policy: PolicyRecord) {
  if (!policy.noShowChargeType) return null;
  const charge =
    policy.noShowChargeType === "first_night"
      ? t("form.cancellationPolicy.noShowFirstNight")
      : policy.noShowChargeType === "full_stay"
        ? t("form.cancellationPolicy.noShowFullStay")
        : t("form.cancellationPolicy.noShowPercentage", {
            value: policy.noShowChargeValue,
          });
  return t("form.cancellationPolicy.noShowTemplate", { charge });
}

export function ReservationApiForm({ source }: { source: ReservationSource }) {
  const { t } = useTranslations({ en, id });
  const isPhone = source === "phone";
  const [initialDate, setInitialDate] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [searchAdults, setSearchAdults] = useState(2);
  const [searchChildren, setSearchChildren] = useState(0);
  const [available, setAvailable] = useState<AvailableRoom[]>([]);
  const [experiences, setExperiences] = useState<ExperienceOption[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [policies, setPolicies] = useState<PolicyRecord[]>([]);
  const [rooms, setRooms] = useState<RoomEntry[]>([]);
  const [selectedExperiences, setSelectedExperiences] = useState<
    SelectedExperience[]
  >([]);
  const [addingExperience, setAddingExperience] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestNik, setGuestNik] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [roomPolicySelections, setRoomPolicySelections] = useState<
    Record<string, string>
  >({});
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
  const [validationMode, setValidationMode] = useState<
    "save" | "check-in" | null
  >(null);
  const [saveConfirmation, setSaveConfirmation] = useState<
    "save" | "check-in" | null
  >(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [checkInContext, setCheckInContext] = useState<CheckInContext | null>(
    null,
  );
  const [earlyCheckIn, setEarlyCheckIn] = useState<EarlyCheckInInput>({
    acknowledged: false,
    chargeAmount: 0,
    paymentTiming: "later",
  });
  const [saved, setSaved] = useState<{
    bookingId: string;
    checkedIn: boolean;
  } | null>(null);
  const requestKey = useRef<{ body: string; key: string } | null>(null);
  const nights = calculateNights(checkIn, checkOut);
  const selectedRooms = rooms.length;
  const allocationError = rooms.length
    ? roomAllocationError(rooms, available, searchAdults, searchChildren)
    : "";
  const allocatedAdults = rooms.reduce((sum, room) => sum + room.adults, 0);
  const allocatedChildren = rooms.reduce((sum, room) => sum + room.children, 0);
  const roomAssignmentFuture = Boolean(initialDate && checkIn > initialDate);
  const total = quote?.bookingTotal ?? 0;
  const amountPaid =
    paymentStatus === "Paid"
      ? total
      : paymentStatus === "Partial"
        ? partialAmount
        : 0;
  const balance = Math.max(0, total - amountPaid);
  const lastStayDate = checkOut
    ? new Date(Date.parse(`${checkOut}T00:00:00Z`) - 86_400_000)
        .toISOString()
        .slice(0, 10)
    : "";
  const stayPolicies = policies.filter(
    (policy) =>
      nights > 0 &&
      (!policy.stayStart || policy.stayStart <= checkIn) &&
      (!policy.stayEnd || policy.stayEnd >= lastStayDate),
  );
  const policiesForRoom = (room: RoomEntry) =>
    stayPolicies.filter(
      (policy) =>
        policy.roomTypes.length === 0 ||
        policy.roomTypes.some((linked) => linked.id === room.roomTypeId),
    );
  const selectedPolicyForRoom = (room: RoomEntry) => {
    const options = policiesForRoom(room);
    return (
      options.find((policy) => policy.id === roomPolicySelections[room.key]) ??
      options[0]
    );
  };
  const currentQuoteInput = JSON.stringify({
    checkIn,
    checkOut,
    totalAdults: searchAdults,
    totalChildren: searchChildren,
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
      const result = await getReservationAvailability(
        checkIn,
        checkOut,
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
            : t("form.errors.availabilityLoadError"),
        );
    } finally {
      if (!signal?.aborted) setAvailabilityLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void refreshAvailability(controller.signal);
    return () => controller.abort();
    // Availability depends on dates. Guest capacity is validated per selected room.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkIn, checkOut]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadOptions() {
      try {
        if (!(await restoreSession())) return;
        const [experienceResult, methodResult] = await Promise.all([
          getReservationExperiences(controller.signal),
          getReservationPaymentMethods(controller.signal),
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
              : t("form.errors.optionsLoadError"),
          );
      }
    }
    void loadOptions();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!isPhone) return;
    const controller = new AbortController();
    const query = new URLSearchParams({
      source: "phone",
      isActive: "true",
      limit: "100",
    });
    listPolicies(query, controller.signal)
      .then(async (result) => {
        const pages = await Promise.all(
          Array.from(
            { length: Math.ceil(result.total / result.limit) - 1 },
            (_, index) => {
              const pageQuery = new URLSearchParams(query);
              pageQuery.set("page", String(index + 2));
              return listPolicies(pageQuery, controller.signal);
            },
          ),
        );
        if (!controller.signal.aborted)
          setPolicies([result, ...pages].flatMap((page) => page.items));
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setFeedback(
            error instanceof Error
              ? error.message
              : t("form.errors.policiesLoadError"),
          );
      });
    return () => controller.abort();
  }, [isPhone]);

  useEffect(() => {
    setQuote(null);
    setQuotedInput("");
    if (nights < 1 || rooms.length === 0 || allocationError) {
      setQuoteLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setQuoteLoading(true);
      try {
        const result = await quoteReservation(
          source,
          {
            checkInDate: checkIn,
            checkOutDate: checkOut,
            totalAdults: searchAdults,
            totalChildren: searchChildren,
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
              : t("form.errors.quoteError"),
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
    allocationError,
    source,
  ]);

  function setRoomCount(option: AvailableRoom, count: number) {
    const current = rooms.filter(
      (room) => room.roomTypeId === option.roomType.id,
    );
    const difference = count - current.length;
    if (difference > 0) {
      setRooms((previous) =>
        autoAllocateRooms(
          [
            ...previous,
            ...Array.from({ length: difference }, () => ({
              key: crypto.randomUUID(),
              roomTypeId: option.roomType.id,
              adults: 0,
              children: 0,
              extraBeds: 0,
            })),
          ],
          available,
          searchAdults,
          searchChildren,
        ),
      );
    } else if (difference < 0) {
      const removed = new Set(current.slice(count).map((room) => room.key));
      setRooms((previous) =>
        autoAllocateRooms(
          previous.filter((room) => !removed.has(room.key)),
          available,
          searchAdults,
          searchChildren,
        ),
      );
    }
  }

  function updateRoom(key: string, patch: Partial<RoomEntry>) {
    setRooms((previous) =>
      previous.map((room) => (room.key === key ? { ...room, ...patch } : room)),
    );
  }

  function validate(checkInGuest: boolean) {
    if (!checkIn || (initialDate && checkIn < initialDate))
      return t("form.errors.checkInBeforeToday");
    if (!isPhone && checkIn !== todayJakarta())
      return t("form.errors.walkInToday");
    if (checkInGuest && checkIn !== todayJakarta())
      return t("form.errors.checkInTodayOnly");
    if (nights < 1) return t("form.errors.checkOutAfterCheckIn");
    if (!rooms.length) return t("form.errors.selectRoom");
    if (availabilityLoading) return t("form.errors.waitAvailability");
    if (
      rooms.some(
        (room) =>
          !available.find(
            (option) =>
              option.roomType.id === room.roomTypeId && option.bookable,
          ),
      )
    )
      return t("form.errors.roomsUnavailable");
    if (allocationError) return allocationError;
    if (!quote || quoteLoading || quotedInput !== currentQuoteInput)
      return t("form.errors.waitQuote");
    if (!guestName.trim() || !phone.trim())
      return t("form.errors.guestRequired");
    if (checkInGuest && !isValidGuestNik(guestNik))
      return t("form.errors.guestNikRequired");
    if (checkInGuest && rooms.some((room) => !room.roomUnitId))
      return t("form.errors.roomNumbersRequired");
    const ids = rooms.map((room) => room.roomUnitId).filter(Boolean);
    if (new Set(ids).size !== ids.length)
      return t("form.errors.duplicateRoomNumbers");
    if (
      paymentStatus === "Partial" &&
      (partialAmount < 1 || partialAmount >= total)
    ) {
      return t("form.errors.partialInvalid");
    }
    if (amountPaid > 0 && !paymentMethodId)
      return t("form.errors.methodRequired");
    if (requireDeposit && (depositAmount < 1 || !depositMethodId))
      return t("form.errors.depositRequired");
    if (checkInGuest && balance > 0 && !acknowledged)
      return t("form.errors.balanceConfirmRequired");
    return "";
  }

  async function requestSave(checkInGuest: boolean) {
    setValidationMode(checkInGuest ? "check-in" : "save");
    if (checkInGuest && checkIn !== todayJakarta()) {
      setFeedback(t("form.errors.checkInTodayOnly"));
      return;
    }
    if (checkInGuest && !isValidGuestNik(guestNik)) {
      setFeedback(t("form.errors.guestNikRequired"));
      return;
    }
    const error = validate(false);
    if (error) {
      setFeedback(error);
      return;
    }
    if (checkInGuest && rooms.some((room) => !room.roomUnitId)) {
      setFeedback(t("form.errors.roomNumbersRequired"));
      return;
    }
    setAcknowledged(false);
    setFeedback("");
    setCheckInContext(null);
    setEarlyCheckIn({
      acknowledged: false,
      chargeAmount: 0,
      paymentTiming: "later",
    });
    if (checkInGuest) {
      try {
        setCheckInContext(await getCreateCheckInContext(checkIn));
      } catch (cause) {
        setFeedback(
          cause instanceof Error
            ? cause.message
            : t("form.errors.checkInTimeLoadError"),
        );
        return;
      }
    }
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
        ...(guestNik ? { nik: guestNik } : {}),
        phone: phone.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
      },
      checkInDate: checkIn,
      checkOutDate: checkOut,
      totalAdults: searchAdults,
      totalChildren: searchChildren,
      rooms: rooms.map(({ key, ...room }) => ({
        ...room,
        ...(isPhone
          ? {
              cancellationPolicyId:
                selectedPolicyForRoom({ key, ...room })?.id ?? null,
            }
          : {}),
      })),
      experiences: selectedExperiences,
      ...(notes.trim() ? { specialRequests: notes.trim() } : {}),
      ...(isPhone ? { cancellationPolicyId: null } : {}),
      confirm: checkInGuest,
      checkIn: checkInGuest,
      acknowledgeOutstanding: checkInGuest && balance > 0,
      ...(checkInGuest && checkInContext?.required ? { earlyCheckIn } : {}),
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
    const body = JSON.stringify({ source, ...payload });
    if (requestKey.current?.body !== body)
      requestKey.current = { body, key: crypto.randomUUID() };
    setSaving(true);
    setFeedback("");
    try {
      const response = await createReservation(source, {
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
        cause instanceof Error ? cause.message : t("form.errors.saveError"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell
      title={t("shell.title")}
      context={t("shell.newReservation")}
      badge={isPhone ? t("shell.phoneMode") : t("shell.walkInMode")}
    >
      <div className="walkin-page">
        {feedback && (
          <ReservationErrorToast
            message={feedback}
            title={t("common.errorToastTitle")}
            closeLabel={t("common.closeMessage")}
            onClose={() => setFeedback("")}
          />
        )}
        <div className="walkin-heading">
          <div>
            <h1>{isPhone ? t("form.phoneTitle") : t("form.walkInTitle")}</h1>
            <p>{t("form.description")}</p>
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
              setGuestNik("");
              setPhone("");
              setEmail("");
              setNotes("");
              setRoomPolicySelections({});
              setPaymentStatus("Unpaid");
              setPartialAmount(0);
              setRequireDeposit(false);
              setFeedback("");
              setValidationMode(null);
            }}
          >
            ↻ &nbsp; {t("form.resetForm")}
          </button>
        </div>
        <div className="walkin-columns">
          <div className="walkin-form-column">
            <section className="reservation-panel reservation-source-panel">
              <h2>{t("form.sections.reservationSource")}</h2>
              <div
                className="source-tabs"
                role="group"
                aria-label={t("form.sections.reservationSource")}
              >
                <Link
                  href="/reservations/create-reservation-walkin"
                  className={
                    isPhone ? "source-tab" : "source-tab source-tab--active"
                  }
                  aria-current={isPhone ? undefined : "page"}
                >
                  {t("form.sourceTabs.walkIn")}
                </Link>
                <Link
                  href="/reservations/create-reservation-phone"
                  className={
                    isPhone ? "source-tab source-tab--active" : "source-tab"
                  }
                  aria-current={isPhone ? "page" : undefined}
                >
                  {t("form.sourceTabs.phone")}
                </Link>
                <Link
                  href="/reservations/create-reservation-ota"
                  className="source-tab"
                >
                  {t("form.sourceTabs.ota")}
                </Link>
              </div>
            </section>
            <section className="reservation-panel">
              <div className="reservation-panel__heading">
                <h2>{t("form.sections.stay")}</h2>
                <span className="status-badge status-badge--success">
                  {nights === 1
                    ? t("form.stay.nightBadge", { nights })
                    : t("form.stay.nightsBadge", { nights })}
                </span>
              </div>
              <div className="stay-fields stay-fields--date-range">
                <ReservationField
                  label={t("form.stay.dateRangeLabel")}
                  htmlFor="stay-date-range"
                  required
                  invalid={validationMode !== null && nights < 1}
                >
                  <DateRangePicker
                    id="stay-date-range"
                    label={t("form.stay.dateRangePickerLabel")}
                    start={checkIn}
                    end={checkOut}
                    minDate={initialDate || undefined}
                    minNights={1}
                    fixedStart={!isPhone}
                    onChange={(start, end) => {
                      setCheckIn(start);
                      setCheckOut(end);
                      setRooms([]);
                    }}
                  />
                </ReservationField>
                <ReservationField
                  label={t("form.stay.adultsLabel")}
                  htmlFor="adults"
                >
                  <select
                    id="adults"
                    value={searchAdults}
                    onChange={(event) => {
                      const adults = Number(event.target.value);
                      setSearchAdults(adults);
                      setRooms((previous) =>
                        autoAllocateRooms(
                          previous,
                          available,
                          adults,
                          searchChildren,
                        ),
                      );
                    }}
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
                <ReservationField
                  label={t("form.stay.childrenLabel")}
                  htmlFor="children"
                >
                  <select
                    id="children"
                    value={searchChildren}
                    onChange={(event) => {
                      const children = Number(event.target.value);
                      setSearchChildren(children);
                      setRooms((previous) =>
                        autoAllocateRooms(
                          previous,
                          available,
                          searchAdults,
                          children,
                        ),
                      );
                    }}
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
                  ⌕ &nbsp;{" "}
                  {availabilityLoading
                    ? t("form.stay.checking")
                    : t("form.stay.check")}
                </button>
              </div>
            </section>
            <section className="reservation-panel">
              <div className="reservation-panel__heading">
                <h2>{t("form.sections.availableRooms")}</h2>
                <span className="reservation-panel__meta">
                  {t("form.availableRooms.selectedMeta", {
                    count: selectedRooms,
                  })}
                </span>
              </div>
              <div className="available-rooms">
                <p className="room-allocation-guidance">
                  {t("form.availableRooms.allocationGuidance", {
                    adults: searchAdults,
                    children: searchChildren,
                  })}
                </p>
                {availabilityLoading && <LoadingSkeleton rows={3} />}
                {!availabilityLoading &&
                  available.map((option) => {
                    const count = rooms.filter(
                      (room) => room.roomTypeId === option.roomType.id,
                    ).length;
                    const bookableCount = option.bookable
                      ? option.availableRooms
                      : 0;
                    const assignableCount = Math.min(
                      bookableCount,
                      option.assignableRoomUnits.length,
                    );
                    const maxAdults = Math.max(
                      0,
                      ...option.capacityPatterns.map(
                        (pattern) => pattern.adults,
                      ),
                    );
                    const maxChildren = Math.max(
                      0,
                      ...option.capacityPatterns.map(
                        (pattern) => pattern.children,
                      ),
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
                                {t("form.availableRooms.cannotSelectBadge")}
                              </span>
                            )}
                          </div>
                          <div className="room-option__availability">
                            <span>
                              {option.bookable
                                ? t("form.availableRooms.stockAvailable", {
                                    count: option.availableRooms,
                                  })
                                : t("form.availableRooms.stockUnavailable", {
                                    count: option.availableRooms,
                                  })}
                            </span>
                            <span
                              className={
                                assignableCount === 0
                                  ? "room-option__assignment room-option__assignment--empty"
                                  : "room-option__assignment"
                              }
                            >
                              {roomAssignmentFuture
                                ? t(
                                    "form.availableRooms.assignmentReadyFuture",
                                    { count: assignableCount },
                                  )
                                : t("form.availableRooms.assignmentReady", {
                                    count: assignableCount,
                                  })}
                            </span>
                          </div>
                          <small
                            className={
                              option.bookable
                                ? undefined
                                : "room-option__reason"
                            }
                          >
                            {option.bookable
                              ? t("form.availableRooms.perRoomCapacity", {
                                  adults: maxAdults,
                                  children: maxChildren
                                    ? t("form.availableRooms.perRoomChildren", {
                                        count: maxChildren,
                                      })
                                    : "",
                                  extraBeds: option.roomType.maxExtraBeds,
                                })
                              : option.unavailableReasons
                                  .map((reason) =>
                                    t(unavailableReasonKeys[reason] ?? reason),
                                  )
                                  .join(" · ") ||
                                t("form.availableRooms.notAvailableForSearch")}
                          </small>
                        </div>
                        <div className="room-option__right">
                          <div className="room-option__rate">
                            <strong>
                              {option.totalPrice === null
                                ? t("common.emptyDash")
                                : formatRupiah(
                                    Math.round(option.totalPrice / nights),
                                  )}
                            </strong>
                            <small>{t("form.availableRooms.perNight")}</small>
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
                    {t("form.availableRooms.empty")}
                  </p>
                )}
              </div>
            </section>
            <section className="reservation-panel">
              <h2>{t("form.sections.assignRooms")}</h2>
              {rooms.length > 0 && (
                <p
                  className={
                    allocationError
                      ? "room-allocation-status room-allocation-status--error"
                      : "room-allocation-status"
                  }
                >
                  {t("form.assignRooms.allocationStatus", {
                    allocatedAdults,
                    adults: searchAdults,
                    allocatedChildren,
                    children: searchChildren,
                  })}
                  {allocationError
                    ? ` ${allocationError}`
                    : t("form.assignRooms.allocationComplete")}
                </p>
              )}
              {rooms.some(
                (room) =>
                  !room.roomUnitId &&
                  available.find(
                    (option) => option.roomType.id === room.roomTypeId,
                  )?.assignableRoomUnits.length === 0,
              ) && (
                <p className="assign-rooms-note">
                  {t("form.assignRooms.noRoomNumberNote")}
                </p>
              )}
              {rooms.length ? (
                <div className="assign-rooms-table-scroll">
                  <table className="assign-rooms-table">
                    <thead>
                      <tr>
                        <th scope="col">{t("form.assignRooms.roomType")}</th>
                        <th scope="col">{t("form.assignRooms.roomNo")}</th>
                        <th scope="col">{t("form.assignRooms.adults")}</th>
                        <th scope="col">{t("form.assignRooms.children")}</th>
                        <th scope="col">{t("form.assignRooms.extraBed")}</th>
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
                          .filter(
                            (item) => item.roomTypeId === room.roomTypeId,
                          ).length;
                        return (
                          <tr key={room.key}>
                            <th scope="row">
                              <strong>{option.roomType.name}</strong>
                              <small>
                                {t("form.assignRooms.room", {
                                  index: roomIndex,
                                })}
                              </small>
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
                                    ? t("form.assignRooms.assignAtCheckIn")
                                    : t("form.assignRooms.noAvailableNumber")}
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
                                    {t("form.assignRooms.roomNumberOption", {
                                      roomNumber: unit.roomNumber,
                                    })}
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
                                    {t("form.assignRooms.perNight", {
                                      price: formatRupiah(
                                        option.roomType.extraBedPricePerNight,
                                      ),
                                    })}
                                  </small>
                                </div>
                              ) : (
                                <span className="assign-rooms-unavailable">
                                  {t("common.emptyDash")}
                                </span>
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
                  {t("form.assignRooms.selectRoomsFirst")}
                </p>
              )}
            </section>
            <section className="reservation-panel">
              <h2>{t("form.sections.guestInformation")}</h2>
              <div className="guest-fields">
                <ReservationField
                  label={t("form.guest.fullName")}
                  htmlFor="guest-name"
                  required
                  invalid={validationMode !== null && !guestName.trim()}
                >
                  <input
                    id="guest-name"
                    value={guestName}
                    onChange={(event) => setGuestName(event.target.value)}
                  />
                </ReservationField>
                <ReservationField
                  label={t("form.guest.whatsapp")}
                  htmlFor="whatsapp"
                  required
                  invalid={validationMode !== null && !phone.trim()}
                >
                  <input
                    id="whatsapp"
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                </ReservationField>
                <ReservationField
                  label={t("form.guest.nik")}
                  htmlFor="guest-nik"
                  required={validationMode === "check-in"}
                  invalid={
                    validationMode === "check-in" && !isValidGuestNik(guestNik)
                  }
                >
                  <input
                    id="guest-nik"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={16}
                    value={guestNik}
                    onChange={(event) =>
                      setGuestNik(normalizeGuestNik(event.target.value))
                    }
                    placeholder="3200xxxxxxxxxxxx"
                  />
                </ReservationField>
                <ReservationField
                  label={t("form.guest.email")}
                  htmlFor="email"
                  optional
                >
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </ReservationField>
                <ReservationField
                  label={t("form.guest.notes")}
                  htmlFor="notes"
                  optional
                >
                  <input
                    id="notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </ReservationField>
              </div>
            </section>
            {isPhone && (
              <section className="reservation-panel">
                <h2>{t("form.sections.cancellationPolicy")}</h2>
                {rooms.length === 0 ? (
                  <p className="reservation-policy-empty">
                    {t("form.cancellationPolicy.selectRoomsFirst")}
                  </p>
                ) : (
                  <div className="reservation-policy-rooms">
                    {rooms.map((room, index) => {
                      const roomType = available.find(
                        (option) => option.roomType.id === room.roomTypeId,
                      );
                      const roomIndex = rooms
                        .slice(0, index + 1)
                        .filter(
                          (item) => item.roomTypeId === room.roomTypeId,
                        ).length;
                      const roomNumber = roomType?.assignableRoomUnits.find(
                        (unit) => unit.id === room.roomUnitId,
                      )?.roomNumber;
                      const roomPolicies = policiesForRoom(room);
                      const selectedPolicy = selectedPolicyForRoom(room);
                      const roomTypeName =
                        roomType?.roomType.name ??
                        t("detail.rooms.notAssigned");
                      return (
                        <div className="reservation-policy-room" key={room.key}>
                          <div className="reservation-policy-room__heading">
                            <strong>
                              {roomNumber
                                ? t(
                                    "form.cancellationPolicy.roomHeadingWithNumber",
                                    {
                                      roomType: roomTypeName,
                                      index: roomIndex,
                                      number: roomNumber,
                                    },
                                  )
                                : t("form.cancellationPolicy.roomHeading", {
                                    roomType: roomTypeName,
                                    index: roomIndex,
                                  })}
                            </strong>
                            <span>
                              {selectedPolicy
                                ? t("form.cancellationPolicy.policyApplies")
                                : t("form.cancellationPolicy.default")}
                            </span>
                          </div>
                          <div
                            className="reservation-policy-options"
                            role="group"
                            aria-label={t(
                              "form.cancellationPolicy.groupLabel",
                              { roomType: roomTypeName, index: roomIndex },
                            )}
                          >
                            {roomPolicies.length === 0 && (
                              <div className="reservation-policy-option reservation-policy-option--fallback">
                                <input
                                  type="checkbox"
                                  checked
                                  readOnly
                                  aria-label={t(
                                    "form.cancellationPolicy.default",
                                  )}
                                />
                                <span className="reservation-policy-copy">
                                  <strong>
                                    {t("form.cancellationPolicy.fallbackName")}
                                  </strong>
                                  <small>
                                    {t(
                                      "form.cancellationPolicy.fallbackDescription",
                                    )}
                                  </small>
                                </span>
                                <span className="reservation-policy-default">
                                  {t("form.cancellationPolicy.default")}
                                </span>
                              </div>
                            )}
                            {roomPolicies.map((policy) => (
                              <label
                                className="reservation-policy-option"
                                key={policy.id}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedPolicy?.id === policy.id}
                                  onChange={(event) =>
                                    setRoomPolicySelections((current) => ({
                                      ...current,
                                      [room.key]: event.target.checked
                                        ? policy.id
                                        : "",
                                    }))
                                  }
                                />
                                <span className="reservation-policy-copy">
                                  <strong>{policy.name}</strong>
                                  {policy.rules.length ? (
                                    [...policy.rules]
                                      .sort(
                                        (first, second) =>
                                          first.sortOrder - second.sortOrder,
                                      )
                                      .map((rule) => (
                                        <small key={rule.id}>
                                          {describeCancellationRule(t, rule)}
                                        </small>
                                      ))
                                  ) : (
                                    <small>
                                      {t(
                                        "form.cancellationPolicy.rulesUndefined",
                                      )}
                                    </small>
                                  )}
                                  {describeNoShow(t, policy) && (
                                    <small>{describeNoShow(t, policy)}</small>
                                  )}
                                </span>
                                {selectedPolicy?.id === policy.id &&
                                  !roomPolicySelections[room.key] && (
                                    <span className="reservation-policy-default">
                                      {t(
                                        "form.cancellationPolicy.autoSelected",
                                      )}
                                    </span>
                                  )}
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
            <section className="reservation-panel">
              <div className="reservation-panel__heading">
                <h2>{t("form.sections.experiencesAddOns")}</h2>
                <button
                  type="button"
                  className="reservation-secondary-button reservation-add-button"
                  onClick={() => setAddingExperience((value) => !value)}
                >
                  ＋ {t("form.experiences.add")}
                </button>
              </div>
              {addingExperience && (
                <div className="extra-picker">
                  <label htmlFor="extra-choice">
                    {t("form.experiences.pickAddOn")}
                  </label>
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
                    <option value="">
                      {t("form.experiences.selectPackage")}
                    </option>
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
                        <small>
                          {formatRupiah(variant.price)}{" "}
                          {t("form.experiences.perPackage")}
                        </small>
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
                          aria-label={t("ota.rooms.removeAriaLabel", {
                            name: variant.label,
                          })}
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
                  <p className="reservation-empty">
                    {t("form.experiences.empty")}
                  </p>
                )}
              </div>
            </section>
            <section className="reservation-panel">
              <h2>{t("form.sections.payment")}</h2>
              <div className="payment-fields">
                <ReservationField
                  label={t("form.payment.methodLabel")}
                  htmlFor="payment-method"
                  required={amountPaid > 0}
                  invalid={
                    validationMode !== null &&
                    amountPaid > 0 &&
                    !paymentMethodId
                  }
                >
                  <select
                    id="payment-method"
                    value={paymentMethodId}
                    onChange={(event) => setPaymentMethodId(event.target.value)}
                  >
                    <option value="">{t("form.payment.selectMethod")}</option>
                    {methods.map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.name}
                      </option>
                    ))}
                  </select>
                </ReservationField>
                <ReservationField
                  label={t("form.payment.statusLabel")}
                  htmlFor="payment-status"
                >
                  <select
                    id="payment-status"
                    value={paymentStatus}
                    onChange={(event) =>
                      setPaymentStatus(event.target.value as PaymentStatus)
                    }
                  >
                    {(
                      [
                        ["Unpaid", "status.unpaid"],
                        ["Partial", "status.partial"],
                        ["Paid", "status.paid"],
                      ] as const
                    ).map(([value, key]) => (
                      <option key={value} value={value}>
                        {t(key)}
                      </option>
                    ))}
                  </select>
                </ReservationField>
                <ReservationField
                  label={t("form.payment.amountPaidLabel")}
                  htmlFor="amount-paid"
                >
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
                <h2>{t("form.sections.deposit")}</h2>
                <label className="deposit-checkbox">
                  <input
                    type="checkbox"
                    checked={requireDeposit}
                    onChange={(event) =>
                      setRequireDeposit(event.target.checked)
                    }
                  />{" "}
                  {t("form.deposit.requireDeposit")}
                </label>
              </div>
              {requireDeposit && (
                <div className="deposit-fields">
                  <ReservationField
                    label={t("form.deposit.amountLabel")}
                    htmlFor="deposit-amount"
                    required
                    invalid={validationMode !== null && depositAmount < 1}
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
                    label={t("form.deposit.methodLabel")}
                    htmlFor="deposit-method"
                    required
                    invalid={validationMode !== null && !depositMethodId}
                  >
                    <select
                      id="deposit-method"
                      value={depositMethodId}
                      onChange={(event) =>
                        setDepositMethodId(event.target.value)
                      }
                    >
                      <option value="">{t("form.deposit.selectMethod")}</option>
                      {methods.map((method) => (
                        <option key={method.id} value={method.id}>
                          {method.name}
                        </option>
                      ))}
                    </select>
                  </ReservationField>
                  <ReservationField
                    label={t("form.deposit.noteLabel")}
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
              <h2>{t("form.summary.title")}</h2>
              <span>
                {isPhone ? t("form.summary.phone") : t("form.summary.walkIn")}
              </span>
            </div>
            <div className="booking-summary__stay">
              <span>{t("form.summary.stay")}</span>
              <strong>
                {t("form.summary.stayValue", {
                  from: formatStayDate(checkIn),
                  to: formatStayDate(checkOut),
                  nights,
                })}
              </strong>
            </div>
            <div className="booking-summary__lines">
              {rooms.map((room, index) => {
                const roomDiscount =
                  quote?.rows
                    .filter((row) => row.roomIndex === index)
                    .reduce((sum, row) => sum + row.discountAmount, 0) ?? 0;
                return (
                  <div className="booking-summary__room" key={room.key}>
                    <div>
                      <span>
                        {t("form.summary.room", {
                          roomType:
                            available.find(
                              (item) => item.roomType.id === room.roomTypeId,
                            )?.roomType.name ?? t("detail.rooms.notAssigned"),
                          index: index + 1,
                        })}
                      </span>
                      <strong>
                        {quote
                          ? formatRupiah(
                              quote.charges.rooms[index]?.subtotal ?? 0,
                            )
                          : t("common.emptyDash")}
                      </strong>
                    </div>
                    {roomDiscount > 0 && (
                      <div className="booking-summary__discount">
                        <span>
                          {t("form.summary.roomDiscount", { index: index + 1 })}
                        </span>
                        <span>−{formatRupiah(roomDiscount)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
              {selectedExperiences.map((item) => (
                <div key={item.variantId}>
                  <span>
                    {t("form.summary.experience", {
                      label:
                        variants.find(
                          (variant) => variant.id === item.variantId,
                        )?.label ?? t("form.sections.experiencesAddOns"),
                      quantity: item.quantity,
                    })}
                  </span>
                  <strong>
                    {quote
                      ? formatRupiah(
                          quote.charges.experiences.find(
                            (entry) => entry.variantId === item.variantId,
                          )?.amount ?? 0,
                        )
                      : t("common.emptyDash")}
                  </strong>
                </div>
              ))}
              {!rooms.length && (
                <div className="booking-summary__empty">
                  {t("form.summary.selectRooms")}
                </div>
              )}
            </div>
            {quote && quote.appliedCampaigns.length > 0 && (
              <details className="booking-summary__campaigns">
                <summary>{t("form.summary.seeCampaign")}</summary>
                <ul>
                  {quote.appliedCampaigns.map((campaign) => (
                    <li key={campaign.id}>
                      <strong>{campaign.name}</strong>
                      <span>
                        {campaign.stayEnd || campaign.bookingEnd
                          ? t("form.summary.campaignValidUntil", {
                              date: formatStayDate(
                                campaign.stayEnd ?? campaign.bookingEnd ?? "",
                              ),
                            })
                          : t("form.summary.campaignValidUntil", {
                              date: t("form.summary.campaignNoLimit"),
                            })}
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
                    <span>{t("form.summary.subtotalBeforeDiscount")}</span>
                    <span>{formatRupiah(total + quote.discountTotal)}</span>
                  </div>
                  <div className="booking-summary__discount">
                    <span>{t("form.summary.totalDiscount")}</span>
                    <strong>−{formatRupiah(quote.discountTotal)}</strong>
                  </div>
                </>
              )}
              <div>
                <strong>{t("form.summary.bookingTotal")}</strong>
                <strong>
                  {quoteLoading ? (
                    <LoadingSkeleton variant="inline" />
                  ) : quote ? (
                    formatRupiah(total)
                  ) : (
                    t("common.emptyDash")
                  )}
                </strong>
              </div>
              <div>
                <span>{t("form.summary.deposit")}</span>
                <span>{formatRupiah(requireDeposit ? depositAmount : 0)}</span>
              </div>
              <div className="booking-summary__collected">
                <strong>{t("form.summary.totalCollected")}</strong>
                <strong>
                  {quote
                    ? formatRupiah(
                        amountPaid + (requireDeposit ? depositAmount : 0),
                      )
                    : t("common.emptyDash")}
                </strong>
              </div>
            </div>
            <p className="booking-summary__note">
              {t("form.summary.depositNote")}
            </p>
            <div className="booking-summary__actions">
              {checkIn === initialDate && (
                <button
                  type="button"
                  className="action-button"
                  disabled={saving}
                  onClick={() => requestSave(true)}
                >
                  {t("form.summary.saveAndCheckIn")}
                </button>
              )}
              <button
                type="button"
                className="reservation-secondary-button"
                disabled={saving}
                onClick={() => requestSave(false)}
              >
                {t("form.summary.saveReservation")}
              </button>
              {isPhone && (
                <button
                  type="button"
                  className="reservation-secondary-button"
                  disabled
                  title={t("form.summary.draftUnavailable")}
                >
                  {t("form.summary.saveAsDraft")}
                </button>
              )}
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
          checkInContext={checkInContext}
          earlyCheckIn={earlyCheckIn}
          onEarlyCheckInChange={setEarlyCheckIn}
          paymentMethods={methods}
          error={feedback}
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
