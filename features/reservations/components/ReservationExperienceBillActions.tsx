"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { getCurrentUser } from "../../../lib/auth";
import {
  getReservationExperienceOptions,
  quoteReservationExperienceBill,
  saveReservationExperienceBill,
  type ApiReservationDetail,
  type ExperienceBillItem,
  type ExperienceBillQuote,
  type ReservationExperienceOption,
} from "../services/api";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

type PendingItem = ExperienceBillItem & {
  experienceId: string;
  name: string;
  unitPrice: number;
};

function rupiah(value: number) {
  return `Rp${new Intl.NumberFormat("id-ID").format(value)}`;
}

export function ReservationExperienceBillActions({ detail, onUpdated }: {
  detail: ApiReservationDetail;
  onUpdated: (message: string) => Promise<void>;
}) {
  const { t } = useTranslations({ en, id });
  const [modal, setModal] = useState<"add" | "bill" | null>(null);
  const [catalog, setCatalog] = useState<ReservationExperienceOption[]>([]);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [serviceDate, setServiceDate] = useState("");
  const [quote, setQuote] = useState<ExperienceBillQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canAdd = getCurrentUser()?.permissions.includes("reservations.add_experience") ?? false;
  const variants = catalog.flatMap((experience) => experience.variants.map((variant) => ({
    ...variant,
    experienceId: experience.id,
    experienceName: experience.name,
    maxQuantity: experience.maxQuantity,
    categoryName: experience.category.name,
  })));
  const selected = variants.find((item) => item.id === variantId);
  const pendingTotal = pending.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  async function openAdd() {
    setModal("add");
    setError("");
    setBusy(true);
    try {
      const items = await getReservationExperienceOptions();
      setCatalog(items);
      const first = items.flatMap((item) => item.variants)[0];
      setVariantId(first?.id ?? "");
      setQuantity(1);
      setServiceDate("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("experienceBill.errors.loadError"));
    } finally {
      setBusy(false);
    }
  }

  function addPending() {
    if (!selected || !Number.isInteger(quantity) || quantity < 1) {
      setError(t("experienceBill.errors.selectValid"));
      return;
    }
    const existingQuantity = detail.experiences
      .filter((item) => item.experienceId === selected.experienceId)
      .reduce((sum, item) => sum + item.quantity, 0);
    const stagedQuantity = pending.filter((item) => item.experienceId === selected.experienceId)
      .reduce((sum, item) => sum + item.quantity, 0);
    if (existingQuantity + stagedQuantity + quantity > selected.maxQuantity) {
      setError(t("experienceBill.errors.maxQuantity", { max: selected.maxQuantity, name: selected.experienceName }));
      return;
    }
    if (serviceDate && (serviceDate < detail.reservation.checkInDate || serviceDate >= detail.reservation.checkOutDate)) {
      setError(t("experienceBill.errors.serviceDateRange"));
      return;
    }
    setPending((current) => [...current, {
      variantId: selected.id,
      experienceId: selected.experienceId,
      name: `${selected.experienceName} · ${selected.subName}`,
      quantity,
      unitPrice: selected.price,
      ...(serviceDate ? { serviceDate } : {}),
    }]);
    setError("");
    setModal(null);
  }

  async function loadBillQuote(items: PendingItem[]) {
    setError("");
    setQuote(null);
    if (!items.length) return;
    setBusy(true);
    try {
      setQuote(await quoteReservationExperienceBill(detail.reservation.id, items.map(({ variantId, quantity, serviceDate }) => ({ variantId, quantity, ...(serviceDate ? { serviceDate } : {}) }))));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("experienceBill.errors.quoteError"));
    } finally {
      setBusy(false);
    }
  }

  async function openBill() {
    setModal("bill");
    await loadBillQuote(pending);
  }

  async function saveBill() {
    if (!quote || busy) return;
    setBusy(true);
    setError("");
    try {
      await saveReservationExperienceBill(detail.reservation.id, {
        expectedVersion: quote.version,
        expectedAddedTotal: quote.addedTotal,
        items: pending.map(({ variantId, quantity, serviceDate }) => ({ variantId, quantity, ...(serviceDate ? { serviceDate } : {}) })),
      });
      setPending([]);
      setQuote(null);
      setModal(null);
      await onUpdated(t("experienceBill.savedSuccess"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("experienceBill.errors.saveError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="reservation-secondary-button" disabled={!canAdd}
        onClick={() => void openAdd()}>{t("experienceBill.addButton")}</button>
      <button type="button" className="reservation-secondary-button" disabled={!canAdd}
        onClick={() => void openBill()}>{pending.length ? t("experienceBill.saveBillCount", { count: pending.length }) : t("experienceBill.saveBill")}</button>
      {pending.length > 0 && <p className="reservation-detail-summary-hint">
        {t("experienceBill.pendingHint", { count: pending.length, total: rupiah(pendingTotal) })}
      </p>}

      {modal && createPortal(
        <div className="reservation-operation-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !busy) setModal(null);
        }}>
          <section className="reservation-operation-modal api-reservation-modal api-experience-bill-modal"
            role="dialog" aria-modal="true" aria-labelledby="experience-bill-title">
            <div className="reservation-operation-header">
              <h2 id="experience-bill-title">{modal === "add" ? t("experienceBill.addTitle") : t("experienceBill.saveTitle")}</h2>
              <button type="button" disabled={busy} onClick={() => setModal(null)} aria-label={t("common.closeModal")}>×</button>
            </div>
            <div className="api-reservation-modal-body">
              {modal === "add" ? (
                <>
                  <p>{t("experienceBill.addDescription")}</p>
                  <label>{t("experienceBill.experienceLabel")}
                    <select value={variantId} onChange={(event) => { setVariantId(event.target.value); setQuantity(1); setError(""); }}>
                      {variants.map((item) => <option value={item.id} key={item.id}>
                        {item.categoryName} · {item.experienceName} · {item.subName} — {rupiah(item.price)}
                      </option>)}
                    </select>
                  </label>
                  {selected && <div className="api-experience-selection">
                    <strong>{selected.experienceName} · {selected.subName}</strong>
                    {selected.description && <span>{selected.description}</span>}
                    <span>{t("experienceBill.unitPriceMax", { price: rupiah(selected.price), max: selected.maxQuantity })}</span>
                  </div>}
                  <label>{t("experienceBill.quantityLabel")}
                    <input type="number" min={1} max={selected?.maxQuantity ?? 1} value={quantity}
                      onChange={(event) => setQuantity(Number(event.target.value))} />
                  </label>
                  <label>{t("experienceBill.serviceDateLabel")}
                    <input type="date" min={detail.reservation.checkInDate} value={serviceDate}
                      onChange={(event) => setServiceDate(event.target.value)} />
                  </label>
                  <p>{t("experienceBill.additional", { amount: rupiah((selected?.price ?? 0) * (Number.isFinite(quantity) ? quantity : 0)) })}</p>
                </>
              ) : (
                <>
                  {!pending.length && <p>{t("experienceBill.billEmpty")}</p>}
                  {pending.map((item, index) => <div className="api-experience-bill-line" key={`${item.variantId}-${index}`}>
                    <span>{item.name} · {item.quantity} × {rupiah(item.unitPrice)}{item.serviceDate ? ` · ${item.serviceDate}` : ""}</span>
                    <strong>{rupiah(item.quantity * item.unitPrice)}</strong>
                    <button type="button" className="reservation-secondary-button" disabled={busy}
                      onClick={() => {
                        const remaining = pending.filter((_, itemIndex) => itemIndex !== index);
                        setPending(remaining);
                        void loadBillQuote(remaining);
                      }}>
                      {t("experienceBill.remove")}
                    </button>
                  </div>)}
                  {quote && <div className="api-experience-bill-summary">
                    {quote.lines.map((line, index) => <div key={`${line.variantId}-${index}`}><span>{line.name} × {line.quantity}</span><strong>{rupiah(line.amount)}</strong></div>)}
                    <div><span>{t("experienceBill.addedToBill")}</span><strong>{rupiah(quote.addedTotal)}</strong></div>
                    <div><span>{t("experienceBill.newBookingTotal")}</span><strong>{rupiah(quote.bookingTotalAfter)}</strong></div>
                    <div><span>{t("experienceBill.remainingAfterSave")}</span><strong>{rupiah(quote.remainingBalanceAfter)}</strong></div>
                    {quote.addedTotal !== pendingTotal && <small>{t("experienceBill.priceChanged")}</small>}
                    <small>{t("experienceBill.paymentHint")}</small>
                  </div>}
                </>
              )}
              {busy && <p>{modal === "bill" ? t("experienceBill.calculating") : t("experienceBill.loadingExperiences")}</p>}
              {error && <p className="api-reservation-error" role="alert">{error}</p>}
            </div>
            <div className="api-reservation-modal-footer">
              <button type="button" className="reservation-secondary-button" disabled={busy} onClick={() => setModal(null)}>{t("common.cancel")}</button>
              {modal === "add" ? (
                <button type="button" className="action-button" disabled={busy || !selected}
                  onClick={addPending}>{t("experienceBill.addToBill")}</button>
              ) : (
                <button type="button" className="action-button" disabled={busy || !quote || !pending.length}
                  onClick={() => void saveBill()}>{t("experienceBill.confirmSaveBill")}</button>
              )}
            </div>
          </section>
        </div>, document.body)}
    </>
  );
}
