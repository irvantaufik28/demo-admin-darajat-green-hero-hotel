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
      setError(cause instanceof Error ? cause.message : "Experience gagal dimuat.");
    } finally {
      setBusy(false);
    }
  }

  function addPending() {
    if (!selected || !Number.isInteger(quantity) || quantity < 1) {
      setError("Pilih item dan jumlah yang valid.");
      return;
    }
    const existingQuantity = detail.experiences
      .filter((item) => item.experienceId === selected.experienceId)
      .reduce((sum, item) => sum + item.quantity, 0);
    const stagedQuantity = pending.filter((item) => item.experienceId === selected.experienceId)
      .reduce((sum, item) => sum + item.quantity, 0);
    if (existingQuantity + stagedQuantity + quantity > selected.maxQuantity) {
      setError(`Maksimum ${selected.maxQuantity} item untuk ${selected.experienceName} dalam reservasi ini.`);
      return;
    }
    if (serviceDate && (serviceDate < detail.reservation.checkInDate || serviceDate >= detail.reservation.checkOutDate)) {
      setError("Tanggal layanan harus berada dalam periode menginap.");
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
      setError(cause instanceof Error ? cause.message : "Tagihan gagal dihitung.");
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
      await onUpdated("Tagihan Experience berhasil disimpan di Charges & Payments.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Tagihan gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="reservation-secondary-button" disabled={!canAdd}
        onClick={() => void openAdd()}>Add Experience or Add-on</button>
      <button type="button" className="reservation-secondary-button" disabled={!canAdd}
        onClick={() => void openBill()}>Save Bill{pending.length ? ` (${pending.length})` : ""}</button>
      {pending.length > 0 && <p className="reservation-detail-summary-hint">
        {pending.length} item belum disimpan · {rupiah(pendingTotal)}. Tekan Save Bill untuk menambahkannya ke tagihan.
      </p>}

      {modal && createPortal(
        <div className="reservation-operation-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !busy) setModal(null);
        }}>
          <section className="reservation-operation-modal api-reservation-modal api-experience-bill-modal"
            role="dialog" aria-modal="true" aria-labelledby="experience-bill-title">
            <div className="reservation-operation-header">
              <h2 id="experience-bill-title">{modal === "add" ? "Add Experience or Add-on" : "Save Bill"}</h2>
              <button type="button" disabled={busy} onClick={() => setModal(null)} aria-label="Close modal">×</button>
            </div>
            <div className="api-reservation-modal-body">
              {modal === "add" ? (
                <>
                  <p>Tambahkan item ke tagihan sementara. Extra bed dikelola dari kamar masing-masing.</p>
                  <label>Experience / Add-on
                    <select value={variantId} onChange={(event) => { setVariantId(event.target.value); setQuantity(1); setError(""); }}>
                      {variants.map((item) => <option value={item.id} key={item.id}>
                        {item.categoryName} · {item.experienceName} · {item.subName} — {rupiah(item.price)}
                      </option>)}
                    </select>
                  </label>
                  {selected && <div className="api-experience-selection">
                    <strong>{selected.experienceName} · {selected.subName}</strong>
                    {selected.description && <span>{selected.description}</span>}
                    <span>Harga satuan {rupiah(selected.price)} · maks. {selected.maxQuantity}</span>
                  </div>}
                  <label>Quantity
                    <input type="number" min={1} max={selected?.maxQuantity ?? 1} value={quantity}
                      onChange={(event) => setQuantity(Number(event.target.value))} />
                  </label>
                  <label>Service date (optional)
                    <input type="date" min={detail.reservation.checkInDate} value={serviceDate}
                      onChange={(event) => setServiceDate(event.target.value)} />
                  </label>
                  <p>Tambahan: <strong>{rupiah((selected?.price ?? 0) * (Number.isFinite(quantity) ? quantity : 0))}</strong></p>
                </>
              ) : (
                <>
                  {!pending.length && <p>Belum ada item yang perlu disimpan. Pilih Add Experience or Add-on terlebih dahulu.</p>}
                  {pending.map((item, index) => <div className="api-experience-bill-line" key={`${item.variantId}-${index}`}>
                    <span>{item.name} · {item.quantity} × {rupiah(item.unitPrice)}{item.serviceDate ? ` · ${item.serviceDate}` : ""}</span>
                    <strong>{rupiah(item.quantity * item.unitPrice)}</strong>
                    <button type="button" className="reservation-secondary-button" disabled={busy}
                      onClick={() => {
                        const remaining = pending.filter((_, itemIndex) => itemIndex !== index);
                        setPending(remaining);
                        void loadBillQuote(remaining);
                      }}>
                      Remove
                    </button>
                  </div>)}
                  {quote && <div className="api-experience-bill-summary">
                    {quote.lines.map((line, index) => <div key={`${line.variantId}-${index}`}><span>{line.name} × {line.quantity}</span><strong>{rupiah(line.amount)}</strong></div>)}
                    <div><span>Added to bill</span><strong>{rupiah(quote.addedTotal)}</strong></div>
                    <div><span>New booking total</span><strong>{rupiah(quote.bookingTotalAfter)}</strong></div>
                    <div><span>Remaining balance after Save Bill</span><strong>{rupiah(quote.remainingBalanceAfter)}</strong></div>
                    {quote.addedTotal !== pendingTotal && <small>Harga katalog berubah. Gunakan rincian terbaru di atas.</small>}
                    <small>Pembayaran dapat dicatat melalui Record Payment di Summary setelah tagihan disimpan.</small>
                  </div>}
                </>
              )}
              {busy && <p>{modal === "bill" ? "Menghitung tagihan..." : "Memuat experience..."}</p>}
              {error && <p className="api-reservation-error" role="alert">{error}</p>}
            </div>
            <div className="api-reservation-modal-footer">
              <button type="button" className="reservation-secondary-button" disabled={busy} onClick={() => setModal(null)}>Cancel</button>
              {modal === "add" ? (
                <button type="button" className="action-button" disabled={busy || !selected}
                  onClick={addPending}>Add to Bill</button>
              ) : (
                <button type="button" className="action-button" disabled={busy || !quote || !pending.length}
                  onClick={() => void saveBill()}>Confirm Save Bill</button>
              )}
            </div>
          </section>
        </div>, document.body)}
    </>
  );
}
