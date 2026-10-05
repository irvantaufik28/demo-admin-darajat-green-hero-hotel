"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatRupiah, roomTypes } from "../constants/walk-in-data";
import {
  saveReservationDetail,
  type ReservationDetail,
} from "../constants/reservation-detail-data";

type Props = {
  reservation: ReservationDetail;
  onUpdate: (reservation: ReservationDetail, message: string) => void;
};

function parseCurrency(value: string) {
  return Number(value.replace(/\D/g, "")) || 0;
}

export function PendingCheckInAction({ reservation, onUpdate }: Props) {
  const autoOpened = useRef(false);
  const [open, setOpen] = useState(false);
  const [assignedRooms, setAssignedRooms] = useState<string[]>([]);
  const [requireDeposit, setRequireDeposit] = useState(true);
  const [depositAmount, setDepositAmount] = useState(300000);
  const [depositMethod, setDepositMethod] = useState("Cash");
  const [depositNote, setDepositNote] = useState("");
  const [balanceAcknowledged, setBalanceAcknowledged] = useState(false);
  const [error, setError] = useState("");
  const balance = Math.max(
    0,
    (reservation.total ?? 0) - (reservation.amountPaid ?? 0),
  );

  const units = useMemo(() => {
    const selected = roomTypes.flatMap((type) =>
      Array.from(
        {
          length: Math.min(
            Math.max(0, reservation.quantities?.[type.id] ?? 0),
            20,
          ),
        },
        (_, index) => ({ type, index }),
      ),
    );
    if (selected.length) return selected;
    return [
      {
        type:
          roomTypes.find((type) => reservation.room.includes(type.name)) ??
          roomTypes[0],
        index: 0,
      },
    ];
  }, [reservation.quantities, reservation.room]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const openDialog = useCallback(() => {
    const used = new Set<string>();
    setAssignedRooms(
      units.map((unit, index) => {
        const next =
          reservation.roomNumbers?.[index] ||
          unit.type.numbers.find((number) => !used.has(number)) ||
          "";
        used.add(next);
        return next;
      }),
    );
    setRequireDeposit(
      (reservation.depositAmount ?? 0) > 0 ||
        reservation.depositAmount === undefined,
    );
    setDepositAmount(reservation.depositAmount || 300000);
    setDepositMethod(reservation.depositMethod || "Cash");
    setDepositNote(reservation.depositNote || "");
    setBalanceAcknowledged(false);
    setError("");
    setOpen(true);
  }, [
    units,
    reservation.roomNumbers,
    reservation.depositAmount,
    reservation.depositMethod,
    reservation.depositNote,
  ]);

  useEffect(() => {
    if (
      autoOpened.current ||
      reservation.status !== "Confirmed" ||
      window.location.hash !== "#check-in"
    )
      return;
    autoOpened.current = true;
    openDialog();
  }, [reservation.status, openDialog]);

  function confirmCheckIn() {
    if (
      !(
        reservation.status === "Pending" || reservation.status === "Confirmed"
      ) ||
      !(
        reservation.paymentStatus === "Partial" ||
        reservation.paymentStatus === "Unpaid"
      ) ||
      (reservation.paymentStatus === "Partial" &&
        (reservation.amountPaid ?? 0) <= 0) ||
      balance <= 0
    ) {
      setError(
        "Reservasi harus berstatus Unpaid atau Partial dengan sisa tagihan sebelum check-in.",
      );
      return;
    }
    if (
      assignedRooms.length !== units.length ||
      assignedRooms.some((value) => !value) ||
      new Set(assignedRooms).size !== assignedRooms.length
    ) {
      setError("Pilih nomor kamar yang berbeda untuk setiap unit.");
      return;
    }
    if (requireDeposit && depositAmount < 1) {
      setError("Jumlah deposit harus lebih dari Rp0.");
      return;
    }
    if (!balanceAcknowledged) {
      setError(
        "Konfirmasi bahwa petugas telah menjelaskan sisa pembayaran kepada tamu.",
      );
      return;
    }
    const updated = saveReservationDetail(reservation.bookingId, "Checked-in", {
      roomNumbers: assignedRooms,
      depositAmount: requireDeposit ? depositAmount : 0,
      depositMethod: requireDeposit ? depositMethod : "",
      depositNote: requireDeposit ? depositNote.trim() : "",
      checkInAt: new Date().toISOString(),
    });
    if (!updated || updated.status !== "Checked-in") {
      setError("Check-in tidak dapat disimpan.");
      return;
    }
    setOpen(false);
    onUpdate(
      updated,
      "Check-in dengan sisa tagihan berhasil dikonfirmasi. Sisa tagihan tetap harus dilunasi sebelum check-out.",
    );
  }

  return (
    <>
      <button
        type="button"
        className="action-button reservation-detail-main-action"
        onClick={openDialog}
      >
        Confirm &amp; Check-in
      </button>
      {open && (
        <div
          className="reservation-operation-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            className="reservation-operation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="partial-check-in-title"
          >
            <div className="reservation-operation-header">
              <h2 id="partial-check-in-title">
                Confirm Check-in with Outstanding Balance
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>
            <div className="reservation-operation-body">
              <div className="reservation-operation-context">
                <div>
                  <strong>{reservation.guestName}</strong>
                  <span>{reservation.bookingId}</span>
                </div>
                <small>
                  Paid {formatRupiah(reservation.amountPaid ?? 0)} · Remaining{" "}
                  {formatRupiah(balance)}
                </small>
              </div>
              <div className="reservation-operation-rooms">
                {units.map((unit, index) => (
                  <label key={unit.type.id + "-" + unit.index}>
                    Assign {unit.type.name}
                    {units.length > 1 ? " #" + (index + 1) : ""} <span>*</span>
                    <select
                      value={assignedRooms[index] ?? ""}
                      onChange={(event) =>
                        setAssignedRooms((current) =>
                          current.map((value, roomIndex) =>
                            roomIndex === index ? event.target.value : value,
                          ),
                        )
                      }
                    >
                      <option value="">Select room</option>
                      {unit.type.numbers.map((number) => (
                        <option
                          key={number}
                          value={number}
                          disabled={assignedRooms.some(
                            (selected, selectedIndex) =>
                              selectedIndex !== index && selected === number,
                          )}
                        >
                          {number} — Available
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
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
                        value={formatRupiah(depositAmount)}
                        onChange={(event) =>
                          setDepositAmount(parseCurrency(event.target.value))
                        }
                      />
                    </label>
                    <label>
                      Deposit Method
                      <select
                        value={depositMethod}
                        onChange={(event) =>
                          setDepositMethod(event.target.value)
                        }
                      >
                        {["Cash", "Bank Transfer", "QRIS", "Other"].map(
                          (value) => (
                            <option key={value}>{value}</option>
                          ),
                        )}
                      </select>
                    </label>
                    <label className="reservation-operation-wide">
                      Deposit Note (Optional)
                      <input
                        value={depositNote}
                        onChange={(event) => setDepositNote(event.target.value)}
                      />
                    </label>
                  </div>
                )}
              </div>
              <label className="partial-check-in-confirmation">
                <input
                  type="checkbox"
                  checked={balanceAcknowledged}
                  onChange={(event) =>
                    setBalanceAcknowledged(event.target.checked)
                  }
                />
                <span>
                  Saya mengonfirmasi sisa tagihan{" "}
                  <strong>{formatRupiah(balance)}</strong> telah dijelaskan
                  kepada tamu. Pelunasan wajib sebelum check-out.
                </span>
              </label>
              {error && (
                <p className="reservation-operation-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <div className="reservation-operation-actions">
              <button
                type="button"
                className="reservation-secondary-button"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="action-button"
                onClick={confirmCheckIn}
                disabled={!balanceAcknowledged}
              >
                Confirm Check-in
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
