"use client";

import type { CheckInContext, EarlyCheckInInput } from "../services/api";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

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
  const { t } = useTranslations({ en, id });
  if (!context.required) return null;

  return (
    <div className="reservation-operation-deposit">
      <strong>{t("earlyCheckIn.title")}</strong>
      <p>
        {t("earlyCheckIn.description", {
          serverTime: context.serverTime,
          standardTime: context.standardCheckInTime,
        })}
      </p>
      <label className="partial-check-in-confirmation">
        <input
          type="checkbox"
          checked={value.acknowledged}
          onChange={(event) => onChange({ ...value, acknowledged: event.target.checked })}
        />
        <span>{t("earlyCheckIn.acknowledge")}</span>
      </label>
      <div className="reservation-operation-deposit-fields">
        <label>
          {t("earlyCheckIn.chargeLabel")}
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
              {t("earlyCheckIn.paymentLabel")}
              <select
                value={value.paymentTiming}
                onChange={(event) => onChange({ ...value, paymentTiming: event.target.value as "now" | "later" })}
              >
                <option value="later">{t("earlyCheckIn.payLater")}</option>
                <option value="now">{t("earlyCheckIn.payNow")}</option>
              </select>
            </label>
            {value.paymentTiming === "now" && (
              <label>
                {t("earlyCheckIn.methodLabel")}
                <select
                  value={value.paymentMethodId ?? ""}
                  onChange={(event) => onChange({ ...value, paymentMethodId: event.target.value })}
                >
                  <option value="">{t("earlyCheckIn.selectMethod")}</option>
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
