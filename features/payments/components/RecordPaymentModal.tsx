"use client";

import type { PaymentMethodOption } from "../../reservations/services/api";

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
  return (
    <div
      className="payment-invoice-overlay"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}
    >
      <section className="payment-invoice-modal payment-record-modal" role="dialog" aria-modal="true" aria-label="Record payment">
        <header>
          <h2>Record Payment</h2>
          <button type="button" aria-label="Close" disabled={saving} onClick={onClose}>×</button>
        </header>
        <div className="payment-record-modal__body">
          <div className="payment-record-modal__balance">
            <span>Remaining Balance</span>
            <strong>{money(balance)}</strong>
          </div>
          <label>
            Amount (IDR)
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
            Payment Method
            <select
              value={methodId}
              disabled={loadingMethods || methods.length === 0}
              onChange={(event) => onMethodChange(event.target.value)}
            >
              <option value="">{loadingMethods ? "Loading methods..." : "Select payment method"}</option>
              {methods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
            </select>
          </label>
          {!loadingMethods && methods.length === 0 && !error && <p className="payment-record-modal__error">No active payment methods are available.</p>}
          {error && <p className="payment-record-modal__error" role="alert">{error}</p>}
        </div>
        <footer className="payment-record-modal__footer">
          <button type="button" disabled={saving} onClick={onClose}>Cancel</button>
          <button type="button" className="payment-record-modal__save" disabled={saving || loadingMethods || !methodId || amount < 1 || amount > balance} onClick={onSave}>
            {saving ? "Saving..." : "Save Payment"}
          </button>
        </footer>
      </section>
    </div>
  );
}
