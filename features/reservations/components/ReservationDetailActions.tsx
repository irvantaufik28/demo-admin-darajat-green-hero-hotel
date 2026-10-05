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

type Action = "confirm" | "payment" | "check_in" | "check_out" | "cancel" | "extend";
type DepositMode = "defer" | "refund" | "deduct_balance" | "deduct_damage";

const actionLabels: Record<Action, string> = {
  confirm: "Confirm Reservation",
  payment: "Record Payment",
  check_in: "Check-in Guest",
  check_out: "Check Out Guest",
  cancel: "Cancel Reservation",
  extend: "Extend Stay",
};

const actionPermissions: Record<Action, string> = {
  confirm: "reservations.confirm",
  payment: "payments.record",
  check_in: "reservations.check_in",
  check_out: "reservations.check_out",
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
  const [checkInContext, setCheckInContext] = useState<CheckInContext | null>(null);
  const [earlyCheckIn, setEarlyCheckIn] = useState<EarlyCheckInInput>({ acknowledged: false, chargeAmount: 0, paymentTiming: "later" });
  const [checkOutContext, setCheckOutContext] = useState<CheckOutContext | null>(null);
  const [earlyDepartureAcknowledged, setEarlyDepartureAcknowledged] = useState(false);
  const [lateCheckOut, setLateCheckOut] = useState<LateCheckOutInput>({ acknowledged: false, chargeAmount: 0, paymentTiming: "later" });
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
  const [extensionQuote, setExtensionQuote] = useState<ExtendStayQuote | null>(null);
  const [extensionLoading, setExtensionLoading] = useState(false);
  const [extensionPaymentTiming, setExtensionPaymentTiming] = useState<"later" | "now">("later");
  const [extensionPaymentAmount, setExtensionPaymentAmount] = useState(0);

  useEffect(() => {
    if (action !== "extend" || !newCheckOutDate || newCheckOutDate <= detail.reservation.checkOutDate) {
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
          setError(cause instanceof Error ? cause.message : "Perpanjangan tidak tersedia.");
        })
        .finally(() => { if (active) setExtensionLoading(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [action, newCheckOutDate, detail.reservation.id, detail.reservation.checkOutDate]);

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
  const checkoutProjectedBalance = detail.summary.remainingBalance +
    (checkOutContext?.kind === "late_checkout" && lateCheckOut.paymentTiming === "later"
      ? lateCheckOut.chargeAmount
      : 0);
  const checkoutDepositDeduction = activeDeposits.reduce(
    (sum, deposit) => sum + (depositModes[deposit.id] === "deduct_balance"
      ? deposit.amountHeld - deposit.amountRefunded - deposit.amountDeducted
      : 0),
    0,
  );
  const checkoutRemainingAfterDeductions = Math.max(0, checkoutProjectedBalance - checkoutDepositDeduction);
  const checkInActionDisabled = !checkInContext ||
    (hasBalance && !acknowledged) ||
    (checkInContext.required && (
      !earlyCheckIn.acknowledged ||
      (earlyCheckIn.chargeAmount > 0 && earlyCheckIn.paymentTiming === "now" && !earlyCheckIn.paymentMethodId)
    ));
  const checkOutActionDisabled = !checkOutContext ||
    (checkOutContext.kind === "early_departure" && !earlyDepartureAcknowledged) ||
    (checkOutContext.kind === "late_checkout" && (
      !lateCheckOut.acknowledged ||
      (lateCheckOut.chargeAmount > 0 && lateCheckOut.paymentTiming === "now" && !lateCheckOut.paymentMethodId)
    )) ||
    (checkoutRemainingAfterDeductions > 0 && (!canOverrideCheckout || !acknowledged || !reason.trim()));

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
        setError(cause instanceof Error ? cause.message : "Metode pembayaran gagal dimuat.");
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
            : "Metode pembayaran gagal dimuat.",
        );
      }
    }
    if (next === "check_in") {
      setCheckInContext(null);
      setEarlyCheckIn({ acknowledged: false, chargeAmount: 0, paymentTiming: "later" });
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
          cause instanceof Error ? cause.message : "Nomor kamar gagal dimuat.",
        );
      }
    }
    if (next === "check_out") {
      setCheckOutContext(null);
      setEarlyDepartureAcknowledged(false);
      setLateCheckOut({ acknowledged: false, chargeAmount: 0, paymentTiming: "later" });
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
        setError(cause instanceof Error ? cause.message : "Aturan checkout gagal dimuat.");
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
      setError(
        "Pilih metode dan isi pembayaran antara Rp1 sampai sisa tagihan.",
      );
      return;
    }
    if (action === "check_in") {
      const selected = detail.rooms.map((room) => roomSelections[room.id]);
      if (
        selected.some((value) => !value) ||
        new Set(selected).size !== selected.length
      ) {
        setError("Pilih nomor kamar berbeda untuk setiap kamar reservasi.");
        return;
      }
      if (balance > 0 && !acknowledged) {
        setError("Konfirmasi sisa tagihan sebelum check-in.");
        return;
      }
      if (!checkInContext || (checkInContext.required && !earlyCheckIn.acknowledged)) {
        setError("Konfirmasi early check-in sebelum melanjutkan.");
        return;
      }
      if (checkInContext.required && earlyCheckIn.chargeAmount > 0 && earlyCheckIn.paymentTiming === "now" && !earlyCheckIn.paymentMethodId) {
        setError("Pilih metode pembayaran biaya early check-in.");
        return;
      }
      if (requireDeposit && (depositAmount < 1 || !depositMethodId)) {
        setError("Isi jumlah deposit dan pilih metode pembayaran deposit.");
        return;
      }
    }
    if (action === "check_out") {
      if (!checkOutContext) {
        setError("Aturan checkout belum dimuat.");
        return;
      }
      if (checkOutContext.kind === "early_departure" && !earlyDepartureAcknowledged) {
        setError("Konfirmasi checkout lebih awal sebelum melanjutkan.");
        return;
      }
      if (checkOutContext.kind === "late_checkout" && !lateCheckOut.acknowledged) {
        setError("Konfirmasi late checkout sebelum melanjutkan.");
        return;
      }
      if (checkOutContext.kind === "late_checkout" && lateCheckOut.chargeAmount > 0 && lateCheckOut.paymentTiming === "now" && !lateCheckOut.paymentMethodId) {
        setError("Pilih metode pembayaran biaya late checkout.");
        return;
      }
      const willRemainOutstanding = checkoutRemainingAfterDeductions > 0;
      if (willRemainOutstanding && !canOverrideCheckout) {
        setError(
          "Saldo setelah pemotongan deposit harus lunas, atau checkout dilakukan oleh Owner/Manager.",
        );
        return;
      }
      if (
        willRemainOutstanding &&
        (!acknowledged || !reason.trim())
      ) {
        setError(
          "Centang konfirmasi dan tulis alasan checkout dengan sisa tagihan.",
        );
        return;
      }
      if (
        activeDeposits.some(
          (deposit) =>
            depositModes[deposit.id] === "refund" &&
            !depositReferences[deposit.id]?.trim(),
        )
      ) {
        setError(
          "Isi referensi refund untuk setiap deposit yang dikembalikan.",
        );
        return;
      }
    }
    if (action === "cancel" && !reason.trim()) {
      setError("Alasan pembatalan wajib diisi.");
      return;
    }
    if (action === "extend") {
      if (!extensionQuote || extensionQuote.newCheckOutDate !== newCheckOutDate) {
        setError("Pilih tanggal dan tunggu rincian perpanjangan tersedia.");
        return;
      }
      if (extensionPaymentTiming === "now" && (!methodId || extensionPaymentAmount < 1 || extensionPaymentAmount > extensionQuote.projectedBalance)) {
        setError("Pilih metode pembayaran dan jumlah yang valid.");
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
          outstandingReason: checkoutRemainingAfterDeductions > 0 ? reason.trim() : undefined,
          ...(checkOutContext?.kind === "early_departure" ? { acknowledgeEarlyDeparture: earlyDepartureAcknowledged } : {}),
          ...(checkOutContext?.kind === "late_checkout" ? { lateCheckOut } : {}),
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
      if (action === "extend") {
        await extendReservationStay(id, {
          newCheckOutDate,
          expectedVersion: extensionQuote!.version,
          ...(extensionPaymentTiming === "now" ? { payment: { methodId, amount: extensionPaymentAmount } } : {}),
        });
      }
      const message = `${actionLabels[action]} berhasil.`;
      setAction(null);
      await onUpdated(message);
    } catch (cause) {
      if (action === "check_out") {
        try {
          setCheckOutContext(await getCheckOutContext(detail.reservation.checkOutDate));
        } catch {
          // Keep the current modal state and show the original checkout error.
        }
      }
      setError(
        cause instanceof Error
          ? cause.message
          : "Aksi gagal. Silakan coba lagi.",
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
            title="Check-in memerlukan status Confirmed dari API"
          >
            Confirm &amp; Check-in
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
                  item === "cancel"
                    ? "reservation-secondary-button"
                    : "action-button"
                }
                onClick={() => void openAction(item)}
              >
                {item === "check_in" && hasBalance
                  ? "Confirm & Check-in"
                  : actionLabels[item]}
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
              Extend Stay
            </button>
            <ReservationExperienceBillActions detail={detail} onUpdated={onUpdated} />
          </>
        )}
        {detail.reservation.reservationStatus === "checked_in" &&
          detail.summary.remainingBalance > 0 &&
          !canOverrideCheckout && (
            <p className="reservation-detail-summary-hint">
              Sisa tagihan harus dilunasi atau dipotong dari deposit. Checkout
              dengan saldo tersisa memerlukan izin Owner atau Manager.
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
                    ? "Confirm Check-in with Outstanding Balance"
                    : actionLabels[action]}
                </h2>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setAction(null)}
                  aria-label={
                    action === "check_in" && !hasBalance
                      ? "Tutup modal"
                      : "Close modal"
                  }
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
                        ? `Paid ${rupiah(detail.summary.paidAmount)} · Remaining ${rupiah(detail.summary.remainingBalance)}`
                        : `${detail.rooms.map((room) => room.roomTypeNameSnapshot).join(", ")} · ${formatStayDate(detail.reservation.checkInDate)} → ${formatStayDate(detail.reservation.checkOutDate)} (${detail.summary.nights} ${detail.summary.nights === 1 ? "night" : "nights"})`}
                    </small>
                  </div>
                ) : (
                  <p>
                    {detail.guest.fullName} · {detail.reservation.bookingCode}
                  </p>
                )}

                {action === "confirm" && (
                  <p>
                    Konfirmasi reservasi ini dengan status pembayaran{" "}
                    {detail.reservation.paymentStatus}?
                  </p>
                )}

                {action === "payment" && (
                  <>
                    <p>
                      Sisa tagihan:{" "}
                      <strong>{rupiah(balanceValue(detail))}</strong>
                    </p>
                    <label>
                      Jumlah pembayaran (IDR)
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
                      Metode pembayaran
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
                      Catatan
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
                    <p>Perpanjang seluruh {detail.rooms.length} kamar dalam reservasi ini.</p>
                    <div className="api-extension-date-field">
                      <span>Periode tambahan · check-out lama → check-out baru</span>
                      <DateRangePicker
                        label="Periode tambahan"
                        start={detail.reservation.checkOutDate}
                        end={newCheckOutDate}
                        minDate={detail.reservation.checkOutDate}
                        minNights={1}
                        fixedStart
                        onChange={(_, end) => { setNewCheckOutDate(end); setExtensionQuote(null); setError(""); }}
                      />
                    </div>
                    {extensionLoading && <p>Menghitung harga dan ketersediaan...</p>}
                    {extensionQuote && (
                      <div className="api-extension-quote">
                        <strong>{extensionQuote.nights} malam tambahan</strong>
                        {extensionQuote.rooms.map((room) => (
                          <div key={room.reservationRoomId} className="api-extension-room">
                            <strong>{room.roomTypeName} · {room.roomNumber ?? "—"}</strong>
                            <span>Harga kamar: {rupiah(room.roomAmount)}</span>
                            {room.nights.map((night) => (
                              <small key={night.stayDate}>{formatStayDate(night.stayDate)} · {rupiah(night.finalPrice)}{night.discountAmount > 0 ? ` (diskon ${rupiah(night.discountAmount)}${night.campaignSnapshot ? ` · ${night.campaignSnapshot.name}` : ""})` : ""}</small>
                            ))}
                            {room.extraBeds && <span>Extra bed {room.extraBeds.quantity} × {extensionQuote.nights} malam: {rupiah(room.extraBeds.amount)}</span>}
                            {room.breakfastAmount > 0 && <span>Breakfast: {rupiah(room.breakfastAmount)}</span>}
                            <strong>Subtotal {rupiah(room.total)}</strong>
                          </div>
                        ))}
                        <p>Diskon malam tambahan: <strong>{rupiah(extensionQuote.discountTotal)}</strong></p>
                        <p>Biaya perpanjangan: <strong>{rupiah(extensionQuote.extensionTotal)}</strong></p>
                        {extensionQuote.existingBalance > 0 && <p className="api-extension-warning">Sisa tagihan sebelumnya: {rupiah(extensionQuote.existingBalance)}</p>}
                        <p>Total tagihan setelah perpanjangan: <strong>{rupiah(extensionQuote.projectedBalance)}</strong></p>
                      </div>
                    )}
                    <label>
                      Pembayaran
                      <select value={extensionPaymentTiming} onChange={(event) => setExtensionPaymentTiming(event.target.value as "later" | "now")}>
                        <option value="later">Jadikan tagihan bayar nanti</option>
                        <option value="now">Record Payment sekarang</option>
                      </select>
                    </label>
                    {extensionPaymentTiming === "now" && extensionQuote && (
                      <>
                        <label>Jumlah pembayaran (IDR)
                          <input type="number" min={1} max={extensionQuote.projectedBalance} value={extensionPaymentAmount}
                            onChange={(event) => setExtensionPaymentAmount(Number(event.target.value))} />
                        </label>
                        <label>Metode pembayaran
                          <select value={methodId} onChange={(event) => setMethodId(event.target.value)}>
                            {methods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
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
                            Assign {room.roomTypeNameSnapshot}
                            {detail.rooms.length > 1
                              ? ` #${index + 1}`
                              : ""}{" "}
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
                              <option value="">Select room</option>
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
                                  {unit.roomNumber} — Available
                                </option>
                              ))}
                            </select>
                          </label>
                        );
                      })}
                    </div>
                    {!hasBalance && (
                      <p className="reservation-operation-hint">
                        Pilih nomor kamar saat tamu tiba di hotel.
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
                        Require Deposit <span>Security guarantee</span>
                      </label>
                      {requireDeposit && (
                        <div className="reservation-operation-deposit-fields">
                          <label>
                            Deposit Amount
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
                            Deposit Method
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
                            Deposit Note (Optional)
                            <input
                              value={depositNote}
                              onChange={(event) =>
                                setDepositNote(event.target.value)
                              }
                              placeholder="e.g. Received at front desk"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                    {checkInContext?.required && (
                      <EarlyCheckInFields context={checkInContext} value={earlyCheckIn} onChange={setEarlyCheckIn} methods={methods} />
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
                          Saya mengonfirmasi sisa tagihan{" "}
                          <strong>
                            {rupiah(detail.summary.remainingBalance)}
                          </strong>{" "}
                          telah dijelaskan kepada tamu. Jika belum lunas saat
                          check-out, petugas wajib mencatat konfirmasi dan
                          alasan.
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
                        onEarlyDepartureAcknowledgedChange={setEarlyDepartureAcknowledged}
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
                          <strong>Deposit {rupiah(amount)}</strong>
                          <label>
                            Penanganan deposit
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
                                Bayar / proses nanti
                              </option>
                              {canRefund && (
                                <option value="refund">Refund penuh</option>
                              )}
                              {checkoutProjectedBalance > 0 && (
                                <option value="deduct_balance">
                                  Potong sisa tagihan
                                </option>
                              )}
                              <option value="deduct_damage">
                                Potong kerusakan
                              </option>
                            </select>
                          </label>
                          {depositModes[deposit.id] === "refund" && (
                            <label>
                              Referensi refund
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
                        <p>Sisa tagihan setelah checkout: <strong>{rupiah(checkoutRemainingAfterDeductions)}</strong></p>
                        <label>
                          Alasan checkout dengan sisa tagihan
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
                          Saya mengonfirmasi sisa tagihan tetap tercatat di
                          Payments.
                        </label>
                      </>
                    )}
                  </>
                )}

                {action === "cancel" && (
                  <label>
                    Alasan pembatalan
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
                  Cancel
                </button>
                <button
                  type="button"
                  className="action-button"
                  disabled={
                    busy ||
                    (action === "check_in" && checkInActionDisabled) ||
                    (action === "check_out" && checkOutActionDisabled)
                    || (action === "extend" && (extensionLoading || !extensionQuote || extensionQuote.newCheckOutDate !== newCheckOutDate))
                  }
                  onClick={() => void submit()}
                >
                  {busy
                    ? "Menyimpan..."
                    : action === "check_in"
                      ? "Confirm Check-in"
                      : actionLabels[action]}
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
