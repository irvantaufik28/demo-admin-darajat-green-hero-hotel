"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  cancelReservation,
  checkInReservation,
  checkOutReservation,
  confirmReservation,
  getAvailableRoomUnits,
  getCheckInContext,
  getCheckOutContext,
  getPaymentMethods,
  getExtendStayQuote,
  markReservationNoShow,
  extendReservationStay,
  recordReservationPayment,
  type ApiReservationDetail,
  type PaymentMethodOption,
  type RoomUnitOption,
  type CheckInContext,
  type EarlyCheckInInput,
  type CheckOutContext,
  type ExtendStayQuote,
  type LateCheckOutInput,
} from "../services/api";
import { EarlyCheckInFields } from "./EarlyCheckInFields";
import { CheckOutTimingFields } from "./CheckOutTimingFields";
import { ReservationExperienceBillActions } from "./ReservationExperienceBillActions";
import { DateRangePicker } from "../../campaigns/components/DateRangePicker";
import { reservationDetailPresentation } from "../utils/detail-rules";
import { getCurrentUser } from "../../../lib/auth";
import { formatStayDate } from "../constants/walk-in-data";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import idLocale from "../locales/id.json";

type Action =
  | "confirm"
  | "payment"
  | "check_in"
  | "check_out"
  | "no_show"
  | "cancel"
  | "extend";
type DepositMode = "defer" | "refund" | "deduct_balance" | "deduct_damage";

const actionLabelKeys: Record<Action, string> = {
  confirm: "detailActions.labels.confirm",
  payment: "detailActions.labels.payment",
  check_in: "detailActions.labels.checkIn",
  check_out: "detailActions.labels.checkOut",
  no_show: "detailActions.labels.noShow",
  cancel: "detailActions.labels.cancel",
  extend: "detailActions.labels.extend",
};

const actionPermissions: Record<Action, string> = {
  confirm: "reservations.confirm",
  payment: "payments.record",
  check_in: "reservations.check_in",
  check_out: "reservations.check_out",
  no_show: "reservations.cancel",
  cancel: "reservations.cancel",
  extend: "reservations.extend_stay",
};

function rupiah(value: number) {
  return `Rp${new Intl.NumberFormat("id-ID").format(value)}`;
}

export function ReservationDetailActions({
  detail,
  onUpdated,
}: {
  detail: ApiReservationDetail;
  onUpdated: (message: string) => Promise<void>;
}) {
  const { t } = useTranslations({ en, id: idLocale });
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [roomOptions, setRoomOptions] = useState<
    Record<string, RoomUnitOption[]>
  >({});
  const [roomSelections, setRoomSelections] = useState<Record<string, string>>(
    {},
  );
  const [methods, setMethods] = useState<PaymentMethodOption[]>([]);
  const [methodId, setMethodId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState(
    detail.summary.remainingBalance,
  );
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentKey, setPaymentKey] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [checkInContext, setCheckInContext] = useState<CheckInContext | null>(
    null,
  );
  const [earlyCheckIn, setEarlyCheckIn] = useState<EarlyCheckInInput>({
    acknowledged: false,
    chargeAmount: 0,
    paymentTiming: "later",
  });
  const [checkOutContext, setCheckOutContext] =
    useState<CheckOutContext | null>(null);
  const [earlyDepartureAcknowledged, setEarlyDepartureAcknowledged] =
    useState(false);
  const [lateCheckOut, setLateCheckOut] = useState<LateCheckOutInput>({
    acknowledged: false,
    chargeAmount: 0,
    paymentTiming: "later",
  });
  const [reason, setReason] = useState("");
  const [depositModes, setDepositModes] = useState<Record<string, DepositMode>>(
    {},
  );
  const [depositReferences, setDepositReferences] = useState<
    Record<string, string>
  >({});
  const [requireDeposit, setRequireDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState(300000);
  const [depositMethodId, setDepositMethodId] = useState("");
  const [depositNote, setDepositNote] = useState("");
  const [newCheckOutDate, setNewCheckOutDate] = useState("");
  const [extensionQuote, setExtensionQuote] = useState<ExtendStayQuote | null>(
    null,
  );
  const [extensionLoading, setExtensionLoading] = useState(false);
  const [extensionPaymentTiming, setExtensionPaymentTiming] = useState<
    "later" | "now"
  >("later");
  const [extensionPaymentAmount, setExtensionPaymentAmount] = useState(0);

  useEffect(() => {
    if (
      action !== "extend" ||
      !newCheckOutDate ||
      newCheckOutDate <= detail.reservation.checkOutDate
    ) {
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      setExtensionLoading(true);
      getExtendStayQuote(detail.reservation.id, newCheckOutDate)
        .then((quote) => {
          if (!active) return;
          setExtensionQuote(quote);
          setExtensionPaymentAmount(quote.extensionTotal);
          setError("");
        })
        .catch((cause) => {
          if (!active) return;
          setExtensionQuote(null);
          setError(
            cause instanceof Error
              ? cause.message
              : t("detailActions.errors.extensionDateRequired"),
          );
        })
        .finally(() => {
          if (active) setExtensionLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    action,
    newCheckOutDate,
    detail.reservation.id,
    detail.reservation.checkOutDate,
  ]);

  const presentation = reservationDetailPresentation(detail);
  const userPermissions = getCurrentUser()?.permissions ?? [];
  const canOverrideCheckout = userPermissions.includes(
    "reservations.checkout_outstanding_override",
  );
  const canRefund = userPermissions.includes("payments.refund");
  const activeDeposits = detail.deposits.filter(
    (deposit) =>
      deposit.amountHeld > deposit.amountRefunded + deposit.amountDeducted,
  );
  const isInHouse = detail.reservation.reservationStatus === "checked_in";
  const isPending = detail.reservation.reservationStatus === "pending";
  const hasBalance = detail.summary.remainingBalance > 0;
  const checkoutProjectedBalance =
    detail.summary.remainingBalance +
    (checkOutContext?.kind === "late_checkout" &&
    lateCheckOut.paymentTiming === "later"
      ? lateCheckOut.chargeAmount
      : 0);
  const checkoutDepositDeduction = activeDeposits.reduce(
    (sum, deposit) =>
      sum +
      (depositModes[deposit.id] === "deduct_balance"
        ? deposit.amountHeld - deposit.amountRefunded - deposit.amountDeducted
        : 0),
    0,
  );
  const checkoutRemainingAfterDeductions = Math.max(
    0,
    checkoutProjectedBalance - checkoutDepositDeduction,
  );
  const checkInActionDisabled =
    !checkInContext ||
    (hasBalance && !acknowledged) ||
    (checkInContext.required &&
      (!earlyCheckIn.acknowledged ||
        (earlyCheckIn.chargeAmount > 0 &&
          earlyCheckIn.paymentTiming === "now" &&
          !earlyCheckIn.paymentMethodId)));
  const checkOutActionDisabled =
    !checkOutContext ||
    (checkOutContext.kind === "early_departure" &&
      !earlyDepartureAcknowledged) ||
    (checkOutContext.kind === "late_checkout" &&
      (!lateCheckOut.acknowledged ||
        (lateCheckOut.chargeAmount > 0 &&
          lateCheckOut.paymentTiming === "now" &&
          !lateCheckOut.paymentMethodId))) ||
    (checkoutRemainingAfterDeductions > 0 &&
      (!canOverrideCheckout || !acknowledged || !reason.trim()));

  async function openAction(next: Action) {
    setAction(next);
    setError("");
    setAcknowledged(false);
    setReason("");
    if (next === "extend") {
      setNewCheckOutDate("");
      setExtensionQuote(null);
      setExtensionPaymentTiming("later");
      setExtensionPaymentAmount(0);
      try {
        const items = await getPaymentMethods();
        setMethods(items);
        setMethodId(items[0]?.id ?? "");
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : t("detailActions.errors.methodsLoadError"),
        );
      }
    }
    if (next === "payment") {
      setPaymentAmount(detail.summary.remainingBalance);
      setPaymentNotes("");
      setPaymentKey(crypto.randomUUID());
      try {
        const items = await getPaymentMethods();
        setMethods(items);
        setMethodId(items[0]?.id ?? "");
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : t("detailActions.errors.methodsLoadError"),
        );
      }
    }
    if (next === "check_in") {
      setCheckInContext(null);
      setEarlyCheckIn({
        acknowledged: false,
        chargeAmount: 0,
        paymentTiming: "later",
      });
      setRequireDeposit(detail.deposits.length === 0);
      setDepositAmount(300000);
      setDepositNote("");
      try {
        const roomTypeIds = [
          ...new Set(detail.rooms.map((room) => room.roomTypeId)),
        ];
        const [entries, paymentMethods, context] = await Promise.all([
          Promise.all(
            roomTypeIds.map(
              async (id) => [id, await getAvailableRoomUnits(id)] as const,
            ),
          ),
          getPaymentMethods(),
          getCheckInContext(detail.reservation.checkInDate),
        ]);
        setCheckInContext(context);
        const options: Record<string, RoomUnitOption[]> =
          Object.fromEntries(entries);
        const selected = new Set<string>();
        setRoomSelections(
          Object.fromEntries(
            detail.rooms.map((room) => {
              const roomUnitId =
                room.roomUnitId ??
                options[room.roomTypeId]?.find((unit) => !selected.has(unit.id))
                  ?.id ??
                "";
              if (roomUnitId) selected.add(roomUnitId);
              return [room.id, roomUnitId];
            }),
          ),
        );
        setRoomOptions(options);
        setMethods(paymentMethods);
        setDepositMethodId(paymentMethods[0]?.id ?? "");
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : t("detailActions.errors.roomsLoadError"),
        );
      }
    }
    if (next === "check_out") {
      setCheckOutContext(null);
      setEarlyDepartureAcknowledged(false);
      setLateCheckOut({
        acknowledged: false,
        chargeAmount: 0,
        paymentTiming: "later",
      });
      setDepositModes(
        Object.fromEntries(
          activeDeposits.map((deposit) => [deposit.id, "defer"]),
        ),
      );
      setDepositReferences({});
      try {
        const [context, paymentMethods] = await Promise.all([
          getCheckOutContext(detail.reservation.checkOutDate),
          getPaymentMethods(),
        ]);
        setCheckOutContext(context);
        setMethods(paymentMethods);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : t("detailActions.errors.checkoutRulesLoadError"),
        );
      }
    }
  }

  async function submit() {
    if (!action || busy) return;
    const id = detail.reservation.id;
    const balance = detail.summary.remainingBalance;
    setError("");

    if (
      action === "payment" &&
      (!methodId || paymentAmount < 1 || paymentAmount > balance)
    ) {
      setError(t("detailActions.errors.paymentInvalid"));
      return;
    }
    if (action === "check_in") {
      const selected = detail.rooms.map((room) => roomSelections[room.id]);
      if (
        selected.some((value) => !value) ||
        new Set(selected).size !== selected.length
      ) {
        setError(t("detailActions.errors.roomsRequired"));
        return;
      }
      if (balance > 0 && !acknowledged) {
        setError(t("detailActions.errors.balanceConfirmRequired"));
        return;
      }
      if (
        !checkInContext ||
        (checkInContext.required && !earlyCheckIn.acknowledged)
      ) {
        setError(t("detailActions.errors.earlyCheckInRequired"));
        return;
      }
      if (
        checkInContext.required &&
        earlyCheckIn.chargeAmount > 0 &&
        earlyCheckIn.paymentTiming === "now" &&
        !earlyCheckIn.paymentMethodId
      ) {
        setError(t("detailActions.errors.earlyCheckInMethodRequired"));
        return;
      }
      if (requireDeposit && (depositAmount < 1 || !depositMethodId)) {
        setError(t("detailActions.errors.depositRequired"));
        return;
      }
    }
    if (action === "check_out") {
      if (!checkOutContext) {
        setError(t("detailActions.errors.checkoutRulesNotLoaded"));
        return;
      }
      if (
        checkOutContext.kind === "early_departure" &&
        !earlyDepartureAcknowledged
      ) {
        setError(t("detailActions.errors.earlyDepartureRequired"));
        return;
      }
      if (
        checkOutContext.kind === "late_checkout" &&
        !lateCheckOut.acknowledged
      ) {
        setError(t("detailActions.errors.lateCheckoutRequired"));
        return;
      }
      if (
        checkOutContext.kind === "late_checkout" &&
        lateCheckOut.chargeAmount > 0 &&
        lateCheckOut.paymentTiming === "now" &&
        !lateCheckOut.paymentMethodId
      ) {
        setError(t("detailActions.errors.lateCheckoutMethodRequired"));
        return;
      }
      const willRemainOutstanding = checkoutRemainingAfterDeductions > 0;
      if (willRemainOutstanding && !canOverrideCheckout) {
        setError(t("detailActions.errors.checkoutOverrideRequired"));
        return;
      }
      if (willRemainOutstanding && (!acknowledged || !reason.trim())) {
        setError(t("detailActions.errors.checkoutReasonRequired"));
        return;
      }
      if (
        activeDeposits.some(
          (deposit) =>
            depositModes[deposit.id] === "refund" &&
            !depositReferences[deposit.id]?.trim(),
        )
      ) {
        setError(t("detailActions.errors.refundReferenceRequired"));
        return;
      }
    }
    if ((action === "cancel" || action === "no_show") && !reason.trim()) {
      setError(
        t(
          action === "no_show"
            ? "detailActions.errors.noShowReasonRequired"
            : "detailActions.errors.cancelReasonRequired",
        ),
      );
      return;
    }
    if (action === "extend") {
      if (
        !extensionQuote ||
        extensionQuote.newCheckOutDate !== newCheckOutDate
      ) {
        setError(t("detailActions.errors.extensionNotReady"));
        return;
      }
      if (
        extensionPaymentTiming === "now" &&
        (!methodId ||
          extensionPaymentAmount < 1 ||
          extensionPaymentAmount > extensionQuote.projectedBalance)
      ) {
        setError(t("detailActions.errors.extensionPaymentInvalid"));
        return;
      }
    }

    setBusy(true);
    try {
      if (action === "confirm") await confirmReservation(id);
      if (action === "payment") {
        await recordReservationPayment(id, {
          idempotencyKey: paymentKey,
          methodId,
          amount: paymentAmount,
          notes: paymentNotes.trim(),
        });
      }
      if (action === "check_in") {
        await checkInReservation(id, {
          acknowledgeOutstanding: balance > 0,
          ...(checkInContext?.required ? { earlyCheckIn } : {}),
          ...(requireDeposit
            ? {
                deposit: {
                  amount: depositAmount,
                  methodId: depositMethodId,
                  notes: depositNote.trim(),
                },
              }
            : {}),
          rooms: detail.rooms.map((room) => ({
            reservationRoomId: room.id,
            roomUnitId: roomSelections[room.id],
          })),
        });
      }
      if (action === "check_out") {
        let balanceAfterDeductions = checkoutProjectedBalance;
        await checkOutReservation(id, {
          acknowledgeOutstanding: checkoutRemainingAfterDeductions > 0,
          outstandingReason:
            checkoutRemainingAfterDeductions > 0 ? reason.trim() : undefined,
          ...(checkOutContext?.kind === "early_departure"
            ? { acknowledgeEarlyDeparture: earlyDepartureAcknowledged }
            : {}),
          ...(checkOutContext?.kind === "late_checkout"
            ? { lateCheckOut }
            : {}),
          deposits: activeDeposits.map((deposit) => {
            const mode = depositModes[deposit.id] ?? "defer";
            const amount =
              deposit.amountHeld -
              deposit.amountRefunded -
              deposit.amountDeducted;
            const balanceDeduction =
              mode === "deduct_balance"
                ? Math.min(amount, balanceAfterDeductions)
                : 0;
            balanceAfterDeductions -= balanceDeduction;
            return mode === "refund"
              ? {
                  depositId: deposit.id,
                  refundAmount: amount,
                  refundReference: depositReferences[deposit.id].trim(),
                  reason: "Deposit dikembalikan saat checkout",
                }
              : mode === "deduct_balance" || mode === "deduct_damage"
                ? {
                    depositId: deposit.id,
                    deductionAmount:
                      mode === "deduct_balance" ? balanceDeduction : amount,
                    deductionPurpose:
                      mode === "deduct_balance"
                        ? ("balance" as const)
                        : ("damage" as const),
                    deferRemaining:
                      mode === "deduct_balance" && amount > balanceDeduction,
                    reason: reason.trim() || "Potongan deposit saat checkout",
                  }
                : { depositId: deposit.id, deferRemaining: true };
          }),
        });
      }
      if (action === "cancel") await cancelReservation(id, reason);
      if (action === "no_show") await markReservationNoShow(id, reason);
      if (action === "extend") {
        await extendReservationStay(id, {
          newCheckOutDate,
          expectedVersion: extensionQuote!.version,
          ...(extensionPaymentTiming === "now"
            ? { payment: { methodId, amount: extensionPaymentAmount } }
            : {}),
        });
      }
      const message = t("detailActions.errors.actionSuccess", {
        action: t(actionLabelKeys[action]),
      });
      setAction(null);
      await onUpdated(message);
    } catch (cause) {
      if (action === "check_out") {
        try {
          setCheckOutContext(
            await getCheckOutContext(detail.reservation.checkOutDate),
          );
        } catch {
          // Keep the current modal state and show the original checkout error.
        }
      }
      setError(
        cause instanceof Error
          ? cause.message
          : t("detailActions.errors.actionFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="api-reservation-actions">
        {isPending && hasBalance && (
          <button
            type="button"
            className="action-button reservation-detail-main-action"
            title={t("detailActions.checkInNeedsConfirmed")}
          >
            {t("detailActions.confirmAndCheckIn")}
          </button>
        )}
        {presentation.actions
          .filter((item) => userPermissions.includes(actionPermissions[item]))
          .map((item) => {
            return (
              <button
                key={item}
                type="button"
                className={
                  item === "cancel" || item === "no_show"
                    ? "reservation-secondary-button"
                    : "action-button"
                }
                onClick={() => void openAction(item)}
              >
                {item === "check_in" && hasBalance
                  ? t("detailActions.confirmAndCheckIn")
                  : t(actionLabelKeys[item])}
              </button>
            );
          })}
        {isInHouse && (
          <>
            <button
              type="button"
              className="reservation-secondary-button"
              onClick={() => void openAction("extend")}
              disabled={!userPermissions.includes("reservations.extend_stay")}
            >
              {t("detailActions.extendStay")}
            </button>
            <ReservationExperienceBillActions
              detail={detail}
              onUpdated={onUpdated}
            />
          </>
        )}
        {detail.reservation.reservationStatus === "checked_in" &&
          detail.summary.remainingBalance > 0 &&
          !canOverrideCheckout && (
            <p className="reservation-detail-summary-hint">
              {t("detailActions.checkoutHint")}
            </p>
          )}
      </div>

      {action &&
        createPortal(
          <div
            className="reservation-operation-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !busy)
                setAction(null);
            }}
          >
            <section
              className={`reservation-operation-modal${action === "check_in" ? "" : " api-reservation-modal"}${action === "extend" ? " api-extension-modal" : ""}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="api-action-title"
            >
              <div className="reservation-operation-header">
                <h2 id="api-action-title">
                  {action === "check_in" && hasBalance
                    ? t("detailActions.modal.checkInWithBalanceTitle")
                    : t(actionLabelKeys[action])}
                </h2>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setAction(null)}
                  aria-label={t("common.closeModal")}
                >
                  ×
                </button>
              </div>
              <div
                className={
                  action === "check_in"
                    ? "reservation-operation-body"
                    : "api-reservation-modal-body"
                }
              >
                {action === "check_in" ? (
                  <div className="reservation-operation-context">
                    <div>
                      <strong>{detail.guest.fullName}</strong>
                      <span>{detail.reservation.bookingCode}</span>
                    </div>
                    <small>
                      {hasBalance
                        ? t("detailActions.modal.paidRemaining", {
                            paid: rupiah(detail.summary.paidAmount),
                            remaining: rupiah(detail.summary.remainingBalance),
                          })
                        : `${detail.rooms.map((room) => room.roomTypeNameSnapshot).join(", ")} · ${formatStayDate(detail.reservation.checkInDate)} → ${formatStayDate(detail.reservation.checkOutDate)} (${detail.summary.nights} ${detail.summary.nights === 1 ? t("common.nightLower") : t("common.nightsLower")})`}
                    </small>
                  </div>
                ) : (
                  <p>
                    {detail.guest.fullName} · {detail.reservation.bookingCode}
                  </p>
                )}

                {action === "confirm" && (
                  <p>
                    {t("detailActions.modal.confirmQuestion", {
                      status: detail.reservation.paymentStatus,
                    })}
                  </p>
                )}

                {action === "payment" && (
                  <>
                    <p>
                      {t("detailActions.modal.paymentRemaining", {
                        amount: rupiah(balanceValue(detail)),
                      })}
                    </p>
                    <label>
                      {t("detailActions.modal.paymentAmountLabel")}
                      <input
                        type="number"
                        min={1}
                        max={detail.summary.remainingBalance}
                        value={paymentAmount}
                        onChange={(event) =>
                          setPaymentAmount(Number(event.target.value))
                        }
                      />
                    </label>
                    <label>
                      {t("detailActions.modal.paymentMethodLabel")}
                      <select
                        value={methodId}
                        onChange={(event) => setMethodId(event.target.value)}
                      >
                        {methods.map((method) => (
                          <option key={method.id} value={method.id}>
                            {method.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {t("detailActions.modal.notesLabel")}
                      <textarea
                        value={paymentNotes}
                        onChange={(event) =>
                          setPaymentNotes(event.target.value)
                        }
                        rows={2}
                      />
                    </label>
                  </>
                )}

                {action === "extend" && (
                  <>
                    <p>
                      {t("detailActions.modal.extendRoomsNote", {
                        count: detail.rooms.length,
                      })}
                    </p>
                    <div className="api-extension-date-field">
                      <span>
                        {t("detailActions.modal.extensionPeriodLabel")}
                      </span>
                      <DateRangePicker
                        label={t(
                          "detailActions.modal.extensionPeriodPickerLabel",
                        )}
                        start={detail.reservation.checkOutDate}
                        end={newCheckOutDate}
                        minDate={detail.reservation.checkOutDate}
                        minNights={1}
                        fixedStart
                        onChange={(_, end) => {
                          setNewCheckOutDate(end);
                          setExtensionQuote(null);
                          setError("");
                        }}
                      />
                    </div>
                    {extensionLoading && (
                      <p>{t("detailActions.modal.calculating")}</p>
                    )}
                    {extensionQuote && (
                      <div className="api-extension-quote">
                        <strong>
                          {t("detailActions.modal.extraNights", {
                            nights: extensionQuote.nights,
                          })}
                        </strong>
                        {extensionQuote.rooms.map((room) => (
                          <div
                            key={room.reservationRoomId}
                            className="api-extension-room"
                          >
                            <strong>
                              {room.roomTypeName} ·{" "}
                              {room.roomNumber ?? t("common.emptyDash")}
                            </strong>
                            <span>
                              {t("detailActions.modal.roomRate", {
                                amount: rupiah(room.roomAmount),
                              })}
                            </span>
                            {room.nights.map((night) => (
                              <small key={night.stayDate}>
                                {t("detailActions.modal.nightLine", {
                                  date: formatStayDate(night.stayDate),
                                  price: rupiah(night.finalPrice),
                                })}
                                {night.discountAmount > 0
                                  ? t("detailActions.modal.nightDiscount", {
                                      amount: rupiah(night.discountAmount),
                                      campaign: night.campaignSnapshot
                                        ? t(
                                            "detailActions.modal.campaignSuffix",
                                            {
                                              name: night.campaignSnapshot.name,
                                            },
                                          )
                                        : "",
                                    })
                                  : ""}
                              </small>
                            ))}
                            {room.extraBeds && (
                              <span>
                                {t("detailActions.modal.extraBedLine", {
                                  quantity: room.extraBeds.quantity,
                                  nights: extensionQuote.nights,
                                  amount: rupiah(room.extraBeds.amount),
                                })}
                              </span>
                            )}
                            {room.breakfastAmount > 0 && (
                              <span>
                                {t("detailActions.modal.breakfastLine", {
                                  amount: rupiah(room.breakfastAmount),
                                })}
                              </span>
                            )}
                            <strong>
                              {t("detailActions.modal.subtotal", {
                                amount: rupiah(room.total),
                              })}
                            </strong>
                          </div>
                        ))}
                        <p>
                          {t("detailActions.modal.additionalNightDiscount", {
                            amount: rupiah(extensionQuote.discountTotal),
                          })}
                        </p>
                        <p>
                          {t("detailActions.modal.extensionCharge", {
                            amount: rupiah(extensionQuote.extensionTotal),
                          })}
                        </p>
                        {extensionQuote.existingBalance > 0 && (
                          <p className="api-extension-warning">
                            {t("detailActions.modal.existingBalance", {
                              amount: rupiah(extensionQuote.existingBalance),
                            })}
                          </p>
                        )}
                        <p>
                          {t("detailActions.modal.projectedBalance", {
                            amount: rupiah(extensionQuote.projectedBalance),
                          })}
                        </p>
                      </div>
                    )}
                    <label>
                      {t("detailActions.modal.paymentTimingLabel")}
                      <select
                        value={extensionPaymentTiming}
                        onChange={(event) =>
                          setExtensionPaymentTiming(
                            event.target.value as "later" | "now",
                          )
                        }
                      >
                        <option value="later">
                          {t("detailActions.modal.paymentTimingLater")}
                        </option>
                        <option value="now">
                          {t("detailActions.modal.paymentTimingNow")}
                        </option>
                      </select>
                    </label>
                    {extensionPaymentTiming === "now" && extensionQuote && (
                      <>
                        <label>
                          {t("detailActions.modal.paymentAmountLabel")}
                          <input
                            type="number"
                            min={1}
                            max={extensionQuote.projectedBalance}
                            value={extensionPaymentAmount}
                            onChange={(event) =>
                              setExtensionPaymentAmount(
                                Number(event.target.value),
                              )
                            }
                          />
                        </label>
                        <label>
                          {t("detailActions.modal.paymentMethodLabel")}
                          <select
                            value={methodId}
                            onChange={(event) =>
                              setMethodId(event.target.value)
                            }
                          >
                            {methods.map((method) => (
                              <option key={method.id} value={method.id}>
                                {method.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </>
                    )}
                  </>
                )}

                {action === "check_in" && (
                  <>
                    <div className="reservation-operation-rooms">
                      {detail.rooms.map((room, index) => {
                        const choices = roomOptions[room.roomTypeId] ?? [];
                        const assigned =
                          room.roomUnitId &&
                          !choices.some((unit) => unit.id === room.roomUnitId)
                            ? [
                                {
                                  id: room.roomUnitId,
                                  roomNumber: room.roomNumber || "Assigned",
                                  roomTypeId: room.roomTypeId,
                                },
                              ]
                            : [];
                        return (
                          <label key={room.id}>
                            {t("detailActions.modal.assignRoom", {
                              roomType: room.roomTypeNameSnapshot,
                            })}
                            {detail.rooms.length > 1 ? ` #${index + 1}` : ""}{" "}
                            <span>*</span>
                            <select
                              value={roomSelections[room.id] ?? ""}
                              onChange={(event) =>
                                setRoomSelections((current) => ({
                                  ...current,
                                  [room.id]: event.target.value,
                                }))
                              }
                            >
                              <option value="">
                                {t("detailActions.modal.selectRoom")}
                              </option>
                              {[...assigned, ...choices].map((unit) => (
                                <option
                                  key={unit.id}
                                  value={unit.id}
                                  disabled={detail.rooms.some(
                                    (other) =>
                                      other.id !== room.id &&
                                      roomSelections[other.id] === unit.id,
                                  )}
                                >
                                  {t("detailActions.modal.roomAvailable", {
                                    roomNumber: unit.roomNumber,
                                  })}
                                </option>
                              ))}
                            </select>
                          </label>
                        );
                      })}
                    </div>
                    {!hasBalance && (
                      <p className="reservation-operation-hint">
                        {t("detailActions.modal.assignAtArrival")}
                      </p>
                    )}
                    <div className="reservation-operation-deposit">
                      <label className="reservation-operation-check">
                        <input
                          type="checkbox"
                          checked={requireDeposit}
                          onChange={(event) =>
                            setRequireDeposit(event.target.checked)
                          }
                        />
                        {t("detailActions.modal.requireDeposit")}{" "}
                        <span>
                          {t("detailActions.modal.securityGuarantee")}
                        </span>
                      </label>
                      {requireDeposit && (
                        <div className="reservation-operation-deposit-fields">
                          <label>
                            {t("detailActions.modal.depositAmount")}
                            <input
                              inputMode="numeric"
                              value={rupiah(depositAmount)}
                              onChange={(event) =>
                                setDepositAmount(
                                  Number(
                                    event.target.value.replace(/\D/g, ""),
                                  ) || 0,
                                )
                              }
                            />
                          </label>
                          <label>
                            {t("detailActions.modal.depositMethod")}
                            <select
                              value={depositMethodId}
                              onChange={(event) =>
                                setDepositMethodId(event.target.value)
                              }
                            >
                              {methods.map((method) => (
                                <option key={method.id} value={method.id}>
                                  {method.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="reservation-operation-wide">
                            {t("detailActions.modal.depositNoteOptional")}
                            <input
                              value={depositNote}
                              onChange={(event) =>
                                setDepositNote(event.target.value)
                              }
                              placeholder={t(
                                "detailActions.modal.depositNotePlaceholder",
                              )}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                    {checkInContext?.required && (
                      <EarlyCheckInFields
                        context={checkInContext}
                        value={earlyCheckIn}
                        onChange={setEarlyCheckIn}
                        methods={methods}
                      />
                    )}
                    {hasBalance && (
                      <label className="partial-check-in-confirmation">
                        <input
                          type="checkbox"
                          checked={acknowledged}
                          onChange={(event) =>
                            setAcknowledged(event.target.checked)
                          }
                        />
                        <span>
                          {t("detailActions.modal.balanceAcknowledgement", {
                            amount: rupiah(detail.summary.remainingBalance),
                          })}
                        </span>
                      </label>
                    )}
                  </>
                )}

                {action === "check_out" && (
                  <>
                    {checkOutContext && (
                      <CheckOutTimingFields
                        context={checkOutContext}
                        earlyDepartureAcknowledged={earlyDepartureAcknowledged}
                        onEarlyDepartureAcknowledgedChange={
                          setEarlyDepartureAcknowledged
                        }
                        lateCheckOut={lateCheckOut}
                        onLateCheckOutChange={setLateCheckOut}
                        methods={methods}
                      />
                    )}
                    {activeDeposits.map((deposit) => {
                      const amount =
                        deposit.amountHeld -
                        deposit.amountRefunded -
                        deposit.amountDeducted;
                      return (
                        <div
                          className="api-reservation-deposit"
                          key={deposit.id}
                        >
                          <strong>
                            {t("detailActions.modal.depositLabel", {
                              amount: rupiah(amount),
                            })}
                          </strong>
                          <label>
                            {t("detailActions.modal.depositHandling")}
                            <select
                              value={depositModes[deposit.id] ?? "defer"}
                              onChange={(event) =>
                                setDepositModes((current) => ({
                                  ...current,
                                  [deposit.id]: event.target
                                    .value as DepositMode,
                                }))
                              }
                            >
                              <option value="defer">
                                {t("detailActions.modal.depositDefer")}
                              </option>
                              {canRefund && (
                                <option value="refund">
                                  {t("detailActions.modal.depositRefundFull")}
                                </option>
                              )}
                              {checkoutProjectedBalance > 0 && (
                                <option value="deduct_balance">
                                  {t(
                                    "detailActions.modal.depositDeductBalance",
                                  )}
                                </option>
                              )}
                              <option value="deduct_damage">
                                {t("detailActions.modal.depositDeductDamage")}
                              </option>
                            </select>
                          </label>
                          {depositModes[deposit.id] === "refund" && (
                            <label>
                              {t("detailActions.modal.refundReference")}
                              <input
                                value={depositReferences[deposit.id] ?? ""}
                                onChange={(event) =>
                                  setDepositReferences((current) => ({
                                    ...current,
                                    [deposit.id]: event.target.value,
                                  }))
                                }
                              />
                            </label>
                          )}
                        </div>
                      );
                    })}
                    {checkoutRemainingAfterDeductions > 0 && (
                      <>
                        <p>
                          {t("detailActions.modal.remainingAfterCheckout", {
                            amount: rupiah(checkoutRemainingAfterDeductions),
                          })}
                        </p>
                        <label>
                          {t("detailActions.modal.outstandingReasonLabel")}
                          <textarea
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            rows={3}
                          />
                        </label>
                        <label className="api-reservation-checkbox">
                          <input
                            type="checkbox"
                            checked={acknowledged}
                            onChange={(event) =>
                              setAcknowledged(event.target.checked)
                            }
                          />{" "}
                          {t("detailActions.modal.outstandingAcknowledge")}
                        </label>
                      </>
                    )}
                  </>
                )}

                {(action === "cancel" || action === "no_show") && (
                  <label>
                    {t(
                      action === "no_show"
                        ? "detailActions.modal.noShowReasonLabel"
                        : "detailActions.modal.cancelReasonLabel",
                    )}
                    <textarea
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      rows={3}
                    />
                  </label>
                )}

                {error && (
                  <p
                    className={
                      action === "check_in"
                        ? "reservation-operation-error"
                        : "api-reservation-error"
                    }
                    role="alert"
                  >
                    {error}
                  </p>
                )}
              </div>
              <div
                className={
                  action === "check_in"
                    ? "reservation-operation-actions"
                    : "api-reservation-modal-footer"
                }
              >
                <button
                  type="button"
                  className="reservation-secondary-button"
                  disabled={busy}
                  onClick={() => setAction(null)}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  className="action-button"
                  disabled={
                    busy ||
                    (action === "check_in" && checkInActionDisabled) ||
                    (action === "check_out" && checkOutActionDisabled) ||
                    (action === "extend" &&
                      (extensionLoading ||
                        !extensionQuote ||
                        extensionQuote.newCheckOutDate !== newCheckOutDate))
                  }
                  onClick={() => void submit()}
                >
                  {busy
                    ? t("common.saving")
                    : action === "check_in"
                      ? t("detailActions.modal.confirmCheckIn")
                      : t(actionLabelKeys[action])}
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}

function balanceValue(detail: ApiReservationDetail) {
  return detail.summary.remainingBalance;
}
