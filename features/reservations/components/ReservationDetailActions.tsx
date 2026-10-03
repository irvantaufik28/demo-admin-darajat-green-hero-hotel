"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import {
  cancelReservation,
  checkInReservation,
  checkOutReservation,
  confirmReservation,
  getAvailableRoomUnits,
  getPaymentMethods,
  recordReservationPayment,
  type ApiReservationDetail,
  type PaymentMethodOption,
  type RoomUnitOption,
} from "../services/api";
import { reservationDetailPresentation } from "../utils/detail-rules";
import { getCurrentUser } from "../../../lib/auth";
import { formatStayDate } from "../constants/walk-in-data";

type Action = "confirm" | "payment" | "check_in" | "check_out" | "cancel";
type DepositMode = "defer" | "refund" | "deduct_balance" | "deduct_damage";

const actionLabels: Record<Action, string> = {
  confirm: "Confirm Reservation",
  payment: "Record Payment",
  check_in: "Check-in Guest",
  check_out: "Check Out Guest",
  cancel: "Cancel Reservation",
};

const actionPermissions: Record<Action, string> = {
  confirm: "reservations.confirm",
  payment: "payments.record",
  check_in: "reservations.check_in",
  check_out: "reservations.check_out",
  cancel: "reservations.cancel",
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
  const [roomOptions, setRoomOptions] = useState<Record<string, RoomUnitOption[]>>({});
  const [roomSelections, setRoomSelections] = useState<Record<string, string>>({});
  const [methods, setMethods] = useState<PaymentMethodOption[]>([]);
  const [methodId, setMethodId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState(detail.summary.remainingBalance);
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentKey, setPaymentKey] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [reason, setReason] = useState("");
  const [depositModes, setDepositModes] = useState<Record<string, DepositMode>>({});
  const [depositReferences, setDepositReferences] = useState<Record<string, string>>({});
  const [requireDeposit, setRequireDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState(300000);
  const [depositMethodId, setDepositMethodId] = useState("");
  const [depositNote, setDepositNote] = useState("");

  const presentation = reservationDetailPresentation(detail);
  const userPermissions = getCurrentUser()?.permissions ?? [];
  const canOverrideCheckout = userPermissions.includes("reservations.checkout_outstanding_override");
  const canRefund = userPermissions.includes("payments.refund");
  const activeDeposits = detail.deposits.filter(
    (deposit) => deposit.amountHeld > deposit.amountRefunded + deposit.amountDeducted,
  );
  const isInHouse = detail.reservation.reservationStatus === "checked_in";
  const isPending = detail.reservation.reservationStatus === "pending";
  const hasBalance = detail.summary.remainingBalance > 0;

  async function openAction(next: Action) {
    setAction(next);
    setError("");
    setAcknowledged(false);
    setReason("");
    if (next === "payment") {
      setPaymentAmount(detail.summary.remainingBalance);
      setPaymentNotes("");
      setPaymentKey(crypto.randomUUID());
      try {
        const items = await getPaymentMethods();
        setMethods(items);
        setMethodId(items[0]?.id ?? "");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Metode pembayaran gagal dimuat.");
      }
    }
    if (next === "check_in") {
      setRequireDeposit(detail.deposits.length === 0);
      setDepositAmount(300000);
      setDepositNote("");
      try {
        const roomTypeIds = [...new Set(detail.rooms.map((room) => room.roomTypeId))];
        const [entries, paymentMethods] = await Promise.all([
          Promise.all(roomTypeIds.map(async (id) => [id, await getAvailableRoomUnits(id)] as const)),
          getPaymentMethods(),
        ]);
        const options: Record<string, RoomUnitOption[]> = Object.fromEntries(entries);
        const selected = new Set<string>();
        setRoomSelections(Object.fromEntries(detail.rooms.map((room) => {
          const roomUnitId = room.roomUnitId ?? options[room.roomTypeId]?.find(
            (unit) => !selected.has(unit.id),
          )?.id ?? "";
          if (roomUnitId) selected.add(roomUnitId);
          return [room.id, roomUnitId];
        })));
        setRoomOptions(options);
        setMethods(paymentMethods);
        setDepositMethodId(paymentMethods[0]?.id ?? "");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Nomor kamar gagal dimuat.");
      }
    }
    if (next === "check_out") {
      setDepositModes(Object.fromEntries(activeDeposits.map((deposit) => [deposit.id, "defer"])));
      setDepositReferences({});
    }
  }

  async function submit() {
    if (!action || busy) return;
    const id = detail.reservation.id;
    const balance = detail.summary.remainingBalance;
    setError("");

    if (action === "payment" && (!methodId || paymentAmount < 1 || paymentAmount > balance)) {
      setError("Pilih metode dan isi pembayaran antara Rp1 sampai sisa tagihan.");
      return;
    }
    if (action === "check_in") {
      const selected = detail.rooms.map((room) => roomSelections[room.id]);
      if (selected.some((value) => !value) || new Set(selected).size !== selected.length) {
        setError("Pilih nomor kamar berbeda untuk setiap kamar reservasi.");
        return;
      }
      if (balance > 0 && !acknowledged) {
        setError("Konfirmasi sisa tagihan sebelum check-in.");
        return;
      }
      if (requireDeposit && (depositAmount < 1 || !depositMethodId)) {
        setError("Isi jumlah deposit dan pilih metode pembayaran deposit.");
        return;
      }
    }
    if (action === "check_out") {
      const plannedBalanceDeduction = activeDeposits.reduce(
        (sum, deposit) =>
          sum +
          (depositModes[deposit.id] === "deduct_balance"
            ? deposit.amountHeld - deposit.amountRefunded - deposit.amountDeducted
            : 0),
        0,
      );
      const willRemainOutstanding = balance > plannedBalanceDeduction;
      if (willRemainOutstanding && !canOverrideCheckout) {
        setError("Saldo setelah pemotongan deposit harus lunas, atau checkout dilakukan oleh Owner/Manager.");
        return;
      }
      if (balance > 0 && (!acknowledged || (willRemainOutstanding && !reason.trim()))) {
        setError("Centang konfirmasi dan tulis alasan checkout dengan sisa tagihan.");
        return;
      }
      if (activeDeposits.some((deposit) => depositModes[deposit.id] === "refund" && !depositReferences[deposit.id]?.trim())) {
        setError("Isi referensi refund untuk setiap deposit yang dikembalikan.");
        return;
      }
    }
    if (action === "cancel" && !reason.trim()) {
      setError("Alasan pembatalan wajib diisi.");
      return;
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
          ...(requireDeposit ? { deposit: { amount: depositAmount, methodId: depositMethodId, notes: depositNote.trim() } } : {}),
          rooms: detail.rooms.map((room) => ({
            reservationRoomId: room.id,
            roomUnitId: roomSelections[room.id],
          })),
        });
      }
      if (action === "check_out") {
        let balanceAfterDeductions = balance;
        await checkOutReservation(id, {
          acknowledgeOutstanding: balance > 0,
          outstandingReason: balance > 0 ? reason.trim() : undefined,
          deposits: activeDeposits.map((deposit) => {
            const mode = depositModes[deposit.id] ?? "defer";
            const amount = deposit.amountHeld - deposit.amountRefunded - deposit.amountDeducted;
            const balanceDeduction = mode === "deduct_balance"
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
                    deductionAmount: mode === "deduct_balance" ? balanceDeduction : amount,
                    deductionPurpose: mode === "deduct_balance" ? "balance" as const : "damage" as const,
                    deferRemaining: mode === "deduct_balance" && amount > balanceDeduction,
                    reason: reason.trim() || "Potongan deposit saat checkout",
                  }
                : { depositId: deposit.id, deferRemaining: true };
          }),
        });
      }
      if (action === "cancel") await cancelReservation(id, reason);
      const message = `${actionLabels[action]} berhasil.`;
      setAction(null);
      await onUpdated(message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Aksi gagal. Silakan coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="api-reservation-actions">
        {isPending && hasBalance && <button type="button" className="action-button reservation-detail-main-action" title="Check-in memerlukan status Confirmed dari API">Confirm &amp; Check-in</button>}
        {presentation.actions.filter((item) => userPermissions.includes(actionPermissions[item])).map((item) => {
          return (
            <button
              key={item}
              type="button"
              className={item === "cancel" ? "reservation-secondary-button" : "action-button"}
              onClick={() => void openAction(item)}
            >
              {item === "check_in" && hasBalance ? "Confirm & Check-in" : actionLabels[item]}
            </button>
          );
        })}
        {isInHouse && <>
          <button type="button" className="reservation-secondary-button" title="API Extend Stay belum tersedia">Extend Stay</button>
          <button type="button" className="reservation-secondary-button" title="API Add Experience belum tersedia">Add Experience or Add-on</button>
          <button type="button" className="reservation-secondary-button" title="API Save Bill belum tersedia">Save Bill</button>
        </>}
        {detail.reservation.reservationStatus === "checked_in" && detail.summary.remainingBalance > 0 && !canOverrideCheckout && (
          <p className="reservation-detail-summary-hint">Sisa tagihan harus dilunasi atau dipotong dari deposit. Checkout dengan saldo tersisa memerlukan izin Owner atau Manager.</p>
        )}
      </div>

      {action && createPortal(
        <div className="reservation-operation-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !busy) setAction(null);
        }}>
          <section className={`reservation-operation-modal${action === "check_in" ? "" : " api-reservation-modal"}`} role="dialog" aria-modal="true" aria-labelledby="api-action-title">
            <div className="reservation-operation-header">
              <h2 id="api-action-title">{action === "check_in" && hasBalance ? "Confirm Check-in with Outstanding Balance" : actionLabels[action]}</h2>
              <button type="button" disabled={busy} onClick={() => setAction(null)} aria-label={action === "check_in" && !hasBalance ? "Tutup modal" : "Close modal"}>×</button>
            </div>
            <div className={action === "check_in" ? "reservation-operation-body" : "api-reservation-modal-body"}>
              {action === "check_in" ? (
                <div className="reservation-operation-context">
                  <div><strong>{detail.guest.fullName}</strong><span>{detail.reservation.bookingCode}</span></div>
                  <small>{hasBalance
                    ? `Paid ${rupiah(detail.summary.paidAmount)} · Remaining ${rupiah(detail.summary.remainingBalance)}`
                    : `${detail.rooms.map((room) => room.roomTypeNameSnapshot).join(", ")} · ${formatStayDate(detail.reservation.checkInDate)} → ${formatStayDate(detail.reservation.checkOutDate)} (${detail.summary.nights} ${detail.summary.nights === 1 ? "night" : "nights"})`}
                  </small>
                </div>
              ) : <p>{detail.guest.fullName} · {detail.reservation.bookingCode}</p>}

              {action === "confirm" && <p>Konfirmasi reservasi ini dengan status pembayaran {detail.reservation.paymentStatus}?</p>}

              {action === "payment" && (
                <>
                  <p>Sisa tagihan: <strong>{rupiah(balanceValue(detail))}</strong></p>
                  <label>Jumlah pembayaran (IDR)
                    <input type="number" min={1} max={detail.summary.remainingBalance} value={paymentAmount} onChange={(event) => setPaymentAmount(Number(event.target.value))} />
                  </label>
                  <label>Metode pembayaran
                    <select value={methodId} onChange={(event) => setMethodId(event.target.value)}>
                      {methods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
                    </select>
                  </label>
                  <label>Catatan
                    <textarea value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} rows={2} />
                  </label>
                </>
              )}

              {action === "check_in" && (
                <>
                  <div className="reservation-operation-rooms">
                    {detail.rooms.map((room, index) => {
                      const choices = roomOptions[room.roomTypeId] ?? [];
                      const assigned = room.roomUnitId && !choices.some((unit) => unit.id === room.roomUnitId)
                        ? [{ id: room.roomUnitId, roomNumber: room.roomNumber || "Assigned", roomTypeId: room.roomTypeId }]
                        : [];
                      return <label key={room.id}>
                        Assign {room.roomTypeNameSnapshot}{detail.rooms.length > 1 ? ` #${index + 1}` : ""} <span>*</span>
                        <select value={roomSelections[room.id] ?? ""} onChange={(event) => setRoomSelections((current) => ({ ...current, [room.id]: event.target.value }))}>
                          <option value="">Select room</option>
                          {[...assigned, ...choices].map((unit) => <option key={unit.id} value={unit.id} disabled={detail.rooms.some((other) => other.id !== room.id && roomSelections[other.id] === unit.id)}>{unit.roomNumber} — Available</option>)}
                        </select>
                      </label>;
                    })}
                  </div>
                  {!hasBalance && <p className="reservation-operation-hint">Pilih nomor kamar saat tamu tiba di hotel.</p>}
                  <div className="reservation-operation-deposit">
                    <label className="reservation-operation-check">
                      <input type="checkbox" checked={requireDeposit} onChange={(event) => setRequireDeposit(event.target.checked)} />
                      Require Deposit <span>Security guarantee</span>
                    </label>
                    {requireDeposit && <div className="reservation-operation-deposit-fields">
                      <label>Deposit Amount
                        <input inputMode="numeric" value={rupiah(depositAmount)} onChange={(event) => setDepositAmount(Number(event.target.value.replace(/\D/g, "")) || 0)} />
                      </label>
                      <label>Deposit Method
                        <select value={depositMethodId} onChange={(event) => setDepositMethodId(event.target.value)}>
                          {methods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
                        </select>
                      </label>
                      <label className="reservation-operation-wide">Deposit Note (Optional)
                        <input value={depositNote} onChange={(event) => setDepositNote(event.target.value)} placeholder="e.g. Received at front desk" />
                      </label>
                    </div>}
                  </div>
                  {hasBalance && <label className="partial-check-in-confirmation">
                    <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
                    <span>Saya mengonfirmasi sisa tagihan <strong>{rupiah(detail.summary.remainingBalance)}</strong> telah dijelaskan kepada tamu. Jika belum lunas saat check-out, petugas wajib mencatat konfirmasi dan alasan.</span>
                  </label>}
                </>
              )}

              {action === "check_out" && (
                <>
                  {activeDeposits.map((deposit) => {
                    const amount = deposit.amountHeld - deposit.amountRefunded - deposit.amountDeducted;
                    return <div className="api-reservation-deposit" key={deposit.id}>
                      <strong>Deposit {rupiah(amount)}</strong>
                      <label>Penanganan deposit
                        <select value={depositModes[deposit.id] ?? "defer"} onChange={(event) => setDepositModes((current) => ({ ...current, [deposit.id]: event.target.value as DepositMode }))}>
                          <option value="defer">Bayar / proses nanti</option>
                          {canRefund && <option value="refund">Refund penuh</option>}
                          {detail.summary.remainingBalance > 0 && <option value="deduct_balance">Potong sisa tagihan</option>}
                          <option value="deduct_damage">Potong kerusakan</option>
                        </select>
                      </label>
                      {depositModes[deposit.id] === "refund" && <label>Referensi refund
                        <input value={depositReferences[deposit.id] ?? ""} onChange={(event) => setDepositReferences((current) => ({ ...current, [deposit.id]: event.target.value }))} />
                      </label>}
                    </div>;
                  })}
                  {detail.summary.remainingBalance > 0 && (
                    <>
                      <label>Alasan checkout dengan sisa tagihan
                        <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
                      </label>
                      <label className="api-reservation-checkbox"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /> Saya mengonfirmasi sisa tagihan tetap tercatat di Payments.</label>
                    </>
                  )}
                </>
              )}

              {action === "cancel" && <label>Alasan pembatalan
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
              </label>}

              {error && <p className={action === "check_in" ? "reservation-operation-error" : "api-reservation-error"} role="alert">{error}</p>}
            </div>
            <div className={action === "check_in" ? "reservation-operation-actions" : "api-reservation-modal-footer"}>
              <button type="button" className="reservation-secondary-button" disabled={busy} onClick={() => setAction(null)}>Cancel</button>
              <button type="button" className="action-button" disabled={busy || action === "check_in" && hasBalance && !acknowledged} onClick={() => void submit()}>{busy ? "Menyimpan..." : action === "check_in" ? "Confirm Check-in" : actionLabels[action]}</button>
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
