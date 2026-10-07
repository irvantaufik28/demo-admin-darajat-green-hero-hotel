"use client";

import type { PaymentMethodOption } from "../../reservations/services/api";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

type Props = {
  balance: number;
  amount: number;
  methodId: string;
  methods: PaymentMethodOption[];
  loadingMethods: boolean;
  saving: boolean;
  error: string;
  onAmountChange: (value: number) => void;
  onMethodChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
};

const money = (value: number) => `Rp${value.toLocaleString("id-ID")}`;

export function RecordPaymentModal({
  balance,
  amount,
  methodId,
  methods,
  loadingMethods,
  saving,
  error,
  onAmountChange,
  onMethodChange,
  onClose,
  onSave,
}: Props) {
  const { t } = useTranslations({ en, id });
  return (
    <div
      className="payment-invoice-overlay"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}
    >
      <section className="payment-invoice-modal payment-record-modal" role="dialog" aria-modal="true" aria-label={t("recordPaymentModal.ariaLabel")}>
        <header>
          <h2>{t("recordPaymentModal.title")}</h2>
          <button type="button" aria-label={t("recordPaymentModal.close")} disabled={saving} onClick={onClose}>×</button>
        </header>
        <div className="payment-record-modal__body">
          <div className="payment-record-modal__balance">
            <span>{t("recordPaymentModal.remainingBalance")}</span>
            <strong>{money(balance)}</strong>
          </div>
          <label>
            {t("recordPaymentModal.amountLabel")}
            <input
              type="number"
              min="1"
              max={balance}
              step="1"
              value={amount || ""}
              onChange={(event) => onAmountChange(Number(event.target.value))}
            />
          </label>
          <label>
            {t("recordPaymentModal.methodLabel")}
            <select
              value={methodId}
              disabled={loadingMethods || methods.length === 0}
              onChange={(event) => onMethodChange(event.target.value)}
            >
              <option value="">{loadingMethods ? t("recordPaymentModal.loadingMethods") : t("recordPaymentModal.selectMethod")}</option>
              {methods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
            </select>
          </label>
          {!loadingMethods && methods.length === 0 && !error && <p className="payment-record-modal__error">{t("recordPaymentModal.noMethods")}</p>}
          {error && <p className="payment-record-modal__error" role="alert">{error}</p>}
        </div>
        <footer className="payment-record-modal__footer">
          <button type="button" disabled={saving} onClick={onClose}>{t("recordPaymentModal.cancel")}</button>
          <button type="button" className="payment-record-modal__save" disabled={saving || loadingMethods || !methodId || amount < 1 || amount > balance} onClick={onSave}>
            {saving ? t("recordPaymentModal.saving") : t("recordPaymentModal.savePayment")}
          </button>
        </footer>
      </section>
    </div>
  );
}
