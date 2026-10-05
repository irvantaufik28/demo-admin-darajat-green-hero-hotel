"use client";

import type { CheckInContext, EarlyCheckInInput } from "../services/api";

type PaymentMethod = { id: string; name: string };

export function EarlyCheckInFields({
  context,
  value,
  onChange,
  methods,
}: {
  context: CheckInContext;
  value: EarlyCheckInInput;
  onChange: (value: EarlyCheckInInput) => void;
  methods: PaymentMethod[];
}) {
  if (!context.required) return null;

  return (
    <div className="reservation-operation-deposit">
      <strong>Early check-in</strong>
      <p>
        Sekarang {context.serverTime} WIB, sebelum jam check-in standar {context.standardCheckInTime} WIB.
        Biaya tambahan boleh Rp0.
      </p>
      <label className="partial-check-in-confirmation">
        <input
          type="checkbox"
          checked={value.acknowledged}
          onChange={(event) => onChange({ ...value, acknowledged: event.target.checked })}
        />
        <span>Saya mengonfirmasi early check-in untuk tamu ini.</span>
      </label>
      <div className="reservation-operation-deposit-fields">
        <label>
          Biaya early check-in (IDR)
          <input
            inputMode="numeric"
            value={value.chargeAmount === 0 ? "" : String(value.chargeAmount)}
            placeholder="0"
            onChange={(event) => onChange({ ...value, chargeAmount: Number(event.target.value.replace(/\D/g, "")) || 0 })}
          />
        </label>
        {value.chargeAmount > 0 && (
          <>
            <label>
              Pembayaran biaya
              <select
                value={value.paymentTiming}
                onChange={(event) => onChange({ ...value, paymentTiming: event.target.value as "now" | "later" })}
              >
                <option value="later">Tagih nanti</option>
                <option value="now">Bayar sekarang</option>
              </select>
            </label>
            {value.paymentTiming === "now" && (
              <label>
                Metode pembayaran
                <select
                  value={value.paymentMethodId ?? ""}
                  onChange={(event) => onChange({ ...value, paymentMethodId: event.target.value })}
                >
                  <option value="">Pilih metode</option>
                  {methods.map((method) => (
                    <option key={method.id} value={method.id}>{method.name}</option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}
      </div>
    </div>
  );
}
