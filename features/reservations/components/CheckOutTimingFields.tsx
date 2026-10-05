"use client";

import type { CheckOutContext, LateCheckOutInput } from "../services/api";

export function CheckOutTimingFields({
  context,
  earlyDepartureAcknowledged,
  onEarlyDepartureAcknowledgedChange,
  lateCheckOut,
  onLateCheckOutChange,
  methods,
}: {
  context: CheckOutContext;
  earlyDepartureAcknowledged: boolean;
  onEarlyDepartureAcknowledgedChange: (value: boolean) => void;
  lateCheckOut: LateCheckOutInput;
  onLateCheckOutChange: (value: LateCheckOutInput) => void;
  methods: { id: string; name: string }[];
}) {
  if (context.kind === "normal") return null;

  if (context.kind === "early_departure") {
    return (
      <div className="reservation-operation-deposit">
        <strong>Early departure</strong>
        <p>Tamu keluar sebelum tanggal checkout {context.checkOutDate}. Tidak ada refund otomatis; tagihan reservasi tetap tercatat.</p>
        <label className="partial-check-in-confirmation">
          <input
            type="checkbox"
            checked={earlyDepartureAcknowledged}
            onChange={(event) => onEarlyDepartureAcknowledgedChange(event.target.checked)}
          />
          <span>Saya mengonfirmasi checkout lebih awal tanpa refund otomatis.</span>
        </label>
      </div>
    );
  }

  const overdue = context.serverDate > context.checkOutDate;
  return (
    <div className="reservation-operation-deposit">
      <strong>{overdue ? "Overdue checkout" : "Late checkout"}</strong>
      <p>
        {overdue
          ? `Tanggal checkout terjadwal ${context.checkOutDate} sudah lewat.`
          : `Sekarang ${context.serverTime} WIB, melewati jam checkout standar ${context.standardCheckOutTime} WIB.`}
        {" "}Biaya tambahan boleh Rp0.
      </p>
      <label className="partial-check-in-confirmation">
        <input
          type="checkbox"
          checked={lateCheckOut.acknowledged}
          onChange={(event) => onLateCheckOutChange({ ...lateCheckOut, acknowledged: event.target.checked })}
        />
        <span>Saya mengonfirmasi {overdue ? "checkout yang melewati tanggal" : "late checkout"} ini.</span>
      </label>
      <div className="reservation-operation-deposit-fields">
        <label>
          Biaya late checkout (IDR)
          <input
            inputMode="numeric"
            value={lateCheckOut.chargeAmount === 0 ? "" : String(lateCheckOut.chargeAmount)}
            placeholder="0"
            onChange={(event) => onLateCheckOutChange({ ...lateCheckOut, chargeAmount: Number(event.target.value.replace(/\D/g, "")) || 0 })}
          />
        </label>
        {lateCheckOut.chargeAmount > 0 && (
          <>
            <label>
              Pembayaran biaya
              <select
                value={lateCheckOut.paymentTiming}
                onChange={(event) => onLateCheckOutChange({ ...lateCheckOut, paymentTiming: event.target.value as "now" | "later" })}
              >
                <option value="later">Tagih nanti</option>
                <option value="now">Bayar sekarang</option>
              </select>
            </label>
            {lateCheckOut.paymentTiming === "now" && (
              <label>
                Metode pembayaran
                <select
                  value={lateCheckOut.paymentMethodId ?? ""}
                  onChange={(event) => onLateCheckOutChange({ ...lateCheckOut, paymentMethodId: event.target.value })}
                >
                  <option value="">Pilih metode</option>
                  {methods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
                </select>
              </label>
            )}
          </>
        )}
      </div>
    </div>
  );
}
