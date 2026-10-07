"use client";

import type { CheckOutContext, LateCheckOutInput } from "../services/api";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

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
  const { t } = useTranslations({ en, id });
  if (context.kind === "normal") return null;

  if (context.kind === "early_departure") {
    return (
      <div className="reservation-operation-deposit">
        <strong>{t("checkOutTiming.earlyDeparture.title")}</strong>
        <p>{t("checkOutTiming.earlyDeparture.description", { checkOutDate: context.checkOutDate })}</p>
        <label className="partial-check-in-confirmation">
          <input
            type="checkbox"
            checked={earlyDepartureAcknowledged}
            onChange={(event) => onEarlyDepartureAcknowledgedChange(event.target.checked)}
          />
          <span>{t("checkOutTiming.earlyDeparture.acknowledge")}</span>
        </label>
      </div>
    );
  }

  const overdue = context.serverDate > context.checkOutDate;
  return (
    <div className="reservation-operation-deposit">
      <strong>{overdue ? t("checkOutTiming.overdueTitle") : t("checkOutTiming.lateTitle")}</strong>
      <p>
        {overdue
          ? t("checkOutTiming.overdueDescription", { checkOutDate: context.checkOutDate })
          : t("checkOutTiming.lateDescription", {
              serverTime: context.serverTime,
              standardTime: context.standardCheckOutTime,
            })}
        {t("checkOutTiming.additionalChargeNote")}
      </p>
      <label className="partial-check-in-confirmation">
        <input
          type="checkbox"
          checked={lateCheckOut.acknowledged}
          onChange={(event) => onLateCheckOutChange({ ...lateCheckOut, acknowledged: event.target.checked })}
        />
        <span>{overdue ? t("checkOutTiming.overdueAcknowledge") : t("checkOutTiming.lateAcknowledge")}</span>
      </label>
      <div className="reservation-operation-deposit-fields">
        <label>
          {t("checkOutTiming.chargeLabel")}
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
              {t("checkOutTiming.paymentLabel")}
              <select
                value={lateCheckOut.paymentTiming}
                onChange={(event) => onLateCheckOutChange({ ...lateCheckOut, paymentTiming: event.target.value as "now" | "later" })}
              >
                <option value="later">{t("checkOutTiming.payLater")}</option>
                <option value="now">{t("checkOutTiming.payNow")}</option>
              </select>
            </label>
            {lateCheckOut.paymentTiming === "now" && (
              <label>
                {t("checkOutTiming.methodLabel")}
                <select
                  value={lateCheckOut.paymentMethodId ?? ""}
                  onChange={(event) => onLateCheckOutChange({ ...lateCheckOut, paymentMethodId: event.target.value })}
                >
                  <option value="">{t("checkOutTiming.selectMethod")}</option>
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
