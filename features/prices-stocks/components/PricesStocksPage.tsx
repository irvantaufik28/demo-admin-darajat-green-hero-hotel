"use client";

import { useMemo, useRef, useState } from "react";
import { AdminShell } from "../../../components/layout/AdminShell";
import { Icon } from "../../../components/ui/Icon";
import {
  formatStockDate,
  formatStockPrice,
  initialPriceStocks,
  priceStockRoomTypes,
  type PriceStock,
} from "../constants/prices-stocks-data";

type RoomId = (typeof priceStockRoomTypes)[number]["id"];
type StockField = "stock" | "price" | "minNight" | "stopSell";
type BulkValues = { stock: number; price: number; minNight: number; stopSell: boolean };
type CustomDayPrice = { id: number; day: string; price: number };
type RoomRows = Record<RoomId, Record<string, PriceStock>>;

const pageSize = 30;
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function initialRows(): RoomRows {
  return Object.fromEntries(priceStockRoomTypes.map((room) => [
    room.id,
    Object.fromEntries(initialPriceStocks.map((row) => [row.date, {
      ...row,
      stock: Math.min(row.stock ?? 0, room.units),
      price: (row.price ?? 0) + room.basePrice - 1500000,
    }])),
  ])) as RoomRows;
}

function rangeDates(from: string, to: string): string[] {
  if (!from || !to || from > to) return [];
  const dates: string[] = [];
  const current = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function dayOf(date: string): string {
  return weekdays[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

function emptyRow(date: string): PriceStock {
  return {
    date,
    day: dayOf(date),
    stock: null,
    price: null,
    webPromo: null,
    webDiscount: 0,
    walkInPromo: null,
    walkInDiscount: 0,
    minNight: null,
    stopSell: null,
  };
}

function Toggle({ checked, onChange, label }: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return <label className="ps-toggle" aria-label={label}>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    <span />
  </label>;
}

export function PricesStocksPage() {
  const [roomId, setRoomId] = useState<RoomId>("deluxe");
  const [allRows, setAllRows] = useState<RoomRows>(initialRows);
  const [fromDate, setFromDate] = useState("2026-09-29");
  const [toDate, setToDate] = useState("2026-10-28");
  const [page, setPage] = useState(1);
  const [changed, setChanged] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [saveModal, setSaveModal] = useState<"confirm" | "success" | null>(null);
  const [bulkFrom, setBulkFrom] = useState(fromDate);
  const [bulkTo, setBulkTo] = useState(toDate);
  const [bulk, setBulk] = useState<BulkValues>({ stock: 5, price: 1500000, minNight: 1, stopSell: false });
  const [included, setIncluded] = useState<Record<StockField, boolean>>({ stock: true, price: true, minNight: false, stopSell: false });
  const [customDays, setCustomDays] = useState<CustomDayPrice[]>([]);
  const [applicableDays, setApplicableDays] = useState<string[]>(weekdays);
  const customPriceBaseline = useRef<Record<string, number | null>>({});
  const bulkBaseline = useRef<Record<string, PriceStock>>({});

  const room = priceStockRoomTypes.find((item) => item.id === roomId)!;
  const dates = useMemo(() => rangeDates(fromDate, toDate), [fromDate, toDate]);
  const pageCount = Math.max(1, Math.ceil(dates.length / pageSize));
  const pageDates = dates.slice((page - 1) * pageSize, page * pageSize);
  const lastInitialDate = initialPriceStocks[initialPriceStocks.length - 1].date;

  function markChanged(targetDates: string[]) {
    setChanged((current) => [...new Set([...current, ...targetDates.map((date) => `${roomId}:${date}`)])]);
    setNotice("");
  }

  function updateDates(targetDates: string[], patch: (date: string, row: PriceStock) => Partial<PriceStock>) {
    if (targetDates.length === 0) return;
    setAllRows((current) => {
      const nextRoom = { ...current[roomId] };
      targetDates.forEach((date) => {
        const existing = nextRoom[date] ?? emptyRow(date);
        nextRoom[date] = { ...existing, ...patch(date, existing) };
      });
      return { ...current, [roomId]: nextRoom };
    });
    markChanged(targetDates);
  }

  function updateRow(date: string, patch: Partial<PriceStock>) {
    updateDates([date], () => patch);
  }

  function bulkDates(inModal: boolean) {
    return inModal ? rangeDates(bulkFrom, bulkTo).filter((date) => applicableDays.includes(dayOf(date))) : dates;
  }

  function normalizedValue(field: StockField, value: number | boolean) {
    if (field === "stock") return Math.max(0, Math.min(room.units, Number(value)));
    if (field === "minNight") return Math.max(1, Math.min(14, Number(value)));
    if (field === "price") return Math.max(0, Number(value));
    return Boolean(value);
  }

  function writeBulkField(field: StockField, value: number | boolean, inModal: boolean) {
    const targetDates = bulkDates(inModal);
    const normalized = normalizedValue(field, value);
    updateDates(targetDates, (date) => {
      if (field === "price" && inModal) {
        const custom = customDays.findLast((item) => item.day === dayOf(date) && item.price > 0);
        return { price: custom?.price ?? Number(normalized) };
      }
      return { [field]: normalized };
    });
  }

  function updateBulk(field: StockField, value: number | boolean, inModal: boolean) {
    setBulk((current) => ({ ...current, [field]: value }));
    if (included[field]) writeBulkField(field, value, inModal);
  }

  function toggleBulkField(field: StockField, enabled: boolean, inModal: boolean) {
    setIncluded((current) => ({ ...current, [field]: enabled }));
    if (enabled) writeBulkField(field, bulk[field], inModal);
  }

  function setCustomPrices(next: CustomDayPrice[], previous: CustomDayPrice[]) {
    setCustomDays(next);
    const targetDates = rangeDates(bulkFrom, bulkTo).filter((date) => (applicableDays.includes(dayOf(date)) || next.some((item) => item.day === dayOf(date))) && (
      next.some((item) => item.day === dayOf(date) && item.price > 0) ||
      previous.some((item) => item.day === dayOf(date) && item.price > 0)),
    );
    targetDates.forEach((date) => {
      if (!(date in customPriceBaseline.current)) {
        customPriceBaseline.current[date] = allRows[roomId][date]?.price ?? null;
      }
    });
    updateDates(targetDates, (date) => {
      const match = next.findLast((item) => item.day === dayOf(date) && item.price > 0);
      if (match) return { price: match.price };
      if (included.price) return { price: bulk.price };
      return { price: customPriceBaseline.current[date] ?? null };
    });
  }

  function toggleApplicableDay(day: string, enabled: boolean) {
    if (!enabled && customDays.some((item) => item.day === day)) return;
    setApplicableDays((current) => enabled ? [...current, day] : current.filter((item) => item !== day));
    const targetDates = rangeDates(bulkFrom, bulkTo).filter((date) => dayOf(date) === day);
    if (!enabled) {
      updateDates(targetDates, (date) => bulkBaseline.current[date] ?? emptyRow(date));
      return;
    }
    updateDates(targetDates, (date) => {
      const custom = customDays.findLast((item) => item.day === dayOf(date) && item.price > 0);
      return {
        ...(included.stock ? { stock: Math.min(bulk.stock, room.units) } : {}),
        ...(included.price || custom ? { price: custom?.price ?? bulk.price } : {}),
        ...(included.minNight ? { minNight: bulk.minNight } : {}),
        ...(included.stopSell ? { stopSell: bulk.stopSell } : {}),
      };
    });
  }

  function openBulk() {
    setBulkFrom(fromDate);
    setBulkTo(toDate);
    setCustomDays([]);
    setApplicableDays(weekdays);
    customPriceBaseline.current = {};
    bulkBaseline.current = { ...allRows[roomId] };
    setBulkOpen(true);
  }

  function saveChanges() {
    setChanged([]);
    setSaveModal("success");
  }

  return <AdminShell title="Prices & Stocks" context="Prices & Stocks">
    <div className="ps-page">
      <div className="ps-heading">
        <div><h1>Prices &amp; Stocks</h1><p>Kelola harga, stok, minimum stay, dan ketersediaan kamar per tanggal</p></div>
        <div className="ps-heading-actions">
          <span className="ps-unsaved"><i />{changed.length} unsaved changes</span>
          <button type="button" className="ps-button ps-button--outline" onClick={openBulk}>▦ Bulk Update</button>
          <button type="button" className="ps-button ps-button--primary" onClick={() => setSaveModal("confirm")} disabled={changed.length === 0}>✓ Save Changes</button>
        </div>
      </div>

      <div className="ps-toolbar">
        <div className="ps-toolbar-controls">
          <label>Room Type: <select value={roomId} onChange={(event) => { setRoomId(event.target.value as RoomId); setPage(1); }}>{priceStockRoomTypes.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.units} Units)</option>)}</select></label>
          <span className="ps-toolbar-divider" />
          <div className="ps-date-controls"><span>Date Range:</span><input aria-label="From date" type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(1); }} /><span>—</span><input aria-label="To date" type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setPage(1); }} /></div>
        </div>
        <span className="ps-record-count">{dates.length} dates</span>
      </div>

      {dates.length === 0 ? <div className="ps-empty">Pilih rentang tanggal yang valid.</div> : <>
        <div className="ps-table-scroll"><table className="ps-table">
          <thead><tr><th>Day</th><th>Date</th><th>Stock</th><th>Price (IDR)</th><th>Website Promo</th><th>Web Price</th><th>Walk-in Promo</th><th>Walk-in Price</th><th>Min. Night</th><th>Stop Sell</th></tr></thead>
          <tbody>
            <tr className="ps-bulk-row">
              <td>⚙</td><td><strong>Bulk</strong></td>
              <td><div className="ps-bulk-cell"><input type="checkbox" aria-label="Include stock" checked={included.stock} onChange={(event) => toggleBulkField("stock", event.target.checked, false)} /><input type="number" min={0} max={room.units} value={Math.min(bulk.stock, room.units)} onChange={(event) => updateBulk("stock", Number(event.target.value), false)} /></div></td>
              <td><div className="ps-bulk-cell"><input type="checkbox" aria-label="Include price" checked={included.price} onChange={(event) => toggleBulkField("price", event.target.checked, false)} /><div className="ps-price-input"><span>Rp</span><input inputMode="numeric" value={bulk.price.toLocaleString("id-ID")} onChange={(event) => updateBulk("price", Number(event.target.value.replace(/\D/g, "")), false)} /></div></div></td>
              <td>—</td><td>—</td><td>—</td><td>—</td>
              <td><div className="ps-bulk-cell"><input type="checkbox" aria-label="Include minimum nights" checked={included.minNight} onChange={(event) => toggleBulkField("minNight", event.target.checked, false)} /><input type="number" min={1} max={14} value={bulk.minNight} onChange={(event) => updateBulk("minNight", Number(event.target.value), false)} /></div></td>
              <td><div className="ps-bulk-cell"><input type="checkbox" aria-label="Include stop sell" checked={included.stopSell} onChange={(event) => toggleBulkField("stopSell", event.target.checked, false)} /><Toggle checked={bulk.stopSell} onChange={(value) => updateBulk("stopSell", value, false)} label="Bulk stop sell" /></div></td>
            </tr>
            {pageDates.map((date) => {
              const stored = allRows[roomId][date];
              const row = stored ?? emptyRow(date);
              const isUnconfigured = date < initialPriceStocks[0].date || date > lastInitialDate;
              return <tr key={date} className={row.stopSell ? "ps-stop-row" : ""}>
                <td className="ps-day">{row.day}</td><td className="ps-date">{formatStockDate(date)}</td>
                <td><input className={row.stock === 0 ? "ps-stock-zero" : ""} type="number" min={0} max={room.units} value={row.stock ?? ""} placeholder="—" aria-label={`Stock ${date}`} onChange={(event) => updateRow(date, { stock: event.target.value === "" ? null : Math.max(0, Math.min(room.units, Number(event.target.value))) })} /></td>
                <td><div className="ps-price-input"><span>Rp</span><input inputMode="numeric" value={row.price === null ? "" : row.price.toLocaleString("id-ID")} placeholder="—" aria-label={`Price ${date}`} onChange={(event) => updateRow(date, { price: event.target.value === "" ? null : Number(event.target.value.replace(/\D/g, "")) })} /></div></td>
                <td>{isUnconfigured ? <span className="ps-no-promo">—</span> : row.webPromo ? <span className="ps-promo">◇ {row.webPromo}</span> : <span className="ps-no-promo">No Promo</span>}</td>
                <td>{row.webPromo && row.price !== null ? <strong className="ps-promo-price">{formatStockPrice(Math.round(row.price * (1 - row.webDiscount / 100)))}</strong> : <span className="ps-no-promo">—</span>}</td>
                <td>{isUnconfigured ? <span className="ps-no-promo">—</span> : row.walkInPromo ? <span className="ps-promo">◇ {row.walkInPromo}</span> : <span className="ps-no-promo">No Promo</span>}</td>
                <td>{row.walkInPromo && row.price !== null ? <strong className="ps-promo-price">{formatStockPrice(Math.round(row.price * (1 - row.walkInDiscount / 100)))}</strong> : <span className="ps-no-promo">—</span>}</td>
                <td><input type="number" min={1} max={14} value={row.minNight ?? ""} placeholder="—" aria-label={`Minimum nights ${date}`} onChange={(event) => updateRow(date, { minNight: event.target.value === "" ? null : Math.max(1, Number(event.target.value)) })} /></td>
                <td><Toggle checked={row.stopSell === true} onChange={(value) => updateRow(date, { stopSell: value })} label={`Stop sell ${date}`} /></td>
              </tr>;
            })}
          </tbody>
        </table></div>
        <div className="ps-pagination"><span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, dates.length)} of {dates.length} dates</span><div><button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>‹ Previous</button><span>Page {page} of {pageCount}</span><button type="button" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}>Next ›</button></div></div>
      </>}

      <div className="ps-helper"><Icon name="info" width={18} height={18} /><p><strong>Kapasitas Fisik {room.name}:</strong> {room.units} kamar aktif ({room.numbers}). Data awal tersedia untuk 30 tanggal. Tanggal lain menampilkan “—” sampai harga dan stok diatur. Promo Website dan Walk-in menunggu pengaturan Campaigns &amp; Promotions.</p></div>
      {notice && <div className="ps-notice" role="status">{notice}</div>}
    </div>

    {bulkOpen && <div className="ps-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setBulkOpen(false); }}>
      <section className="ps-modal" role="dialog" aria-modal="true" aria-labelledby="ps-bulk-title">
        <div className="ps-modal-head"><h2 id="ps-bulk-title">▦ Bulk Update Prices &amp; Stocks</h2><button type="button" aria-label="Close modal" onClick={() => setBulkOpen(false)}>×</button></div>
        <div className="ps-modal-body">
          <div className="ps-target"><span>Target Kamar:</span><strong>{room.name} ({room.units} Unit Kapasitas)</strong></div>
          <div className="ps-modal-dates"><label>From<input type="date" value={bulkFrom} onChange={(event) => setBulkFrom(event.target.value)} /></label><label>To<input type="date" value={bulkTo} onChange={(event) => setBulkTo(event.target.value)} /></label></div>
          <div className="ps-applicable-days"><strong>Applicable Days</strong><div className="ps-day-options">{weekdays.map((day) => {
            const locked = customDays.some((item) => item.day === day);
            return <label key={day} title={locked ? `${day} digunakan Custom Day Price` : undefined}><input type="checkbox" checked={applicableDays.includes(day)} disabled={locked} onChange={(event) => toggleApplicableDay(day, event.target.checked)} />{day}</label>;
          })}</div><p>Hari yang dipakai Custom Day Price harus tetap dipilih dan tidak dapat dihapus centangnya.</p></div>
          <div className="ps-modal-fields"><strong>Field Changes</strong>{(["stock", "price", "minNight", "stopSell"] as StockField[]).map((field) => <div key={field} className="ps-modal-field"><label><input type="checkbox" checked={included[field]} onChange={(event) => toggleBulkField(field, event.target.checked, true)} />{field === "minNight" ? "Min. Night" : field === "stopSell" ? "Stop Sell" : field === "price" ? "Price (IDR)" : "Stock"}</label>{field === "stopSell" ? <select value={bulk.stopSell ? "on" : "off"} onChange={(event) => updateBulk(field, event.target.value === "on", true)}><option value="off">Off (Open)</option><option value="on">On (Close)</option></select> : <input type="number" min={field === "minNight" ? 1 : 0} max={field === "stock" ? room.units : field === "minNight" ? 14 : undefined} value={bulk[field]} onChange={(event) => updateBulk(field, Number(event.target.value), true)} />}</div>)}</div>
          <div className="ps-custom-days"><strong>Custom Day Price</strong><p>Tetapkan harga khusus untuk hari tertentu dalam rentang tanggal di atas.</p>{customDays.map((item, index) => <div className="ps-custom-day-row" key={item.id}><select aria-label={`Custom day ${index + 1}`} value={item.day} onChange={(event) => { const day = event.target.value; setApplicableDays((current) => current.includes(day) ? current : [...current, day]); setCustomPrices(customDays.map((current) => current.id === item.id ? { ...current, day } : current), customDays); }}>{weekdays.map((day) => <option key={day} value={day}>{day}</option>)}</select><div className="ps-price-input"><span>Rp</span><input inputMode="numeric" aria-label={`Custom price ${index + 1}`} value={item.price ? item.price.toLocaleString("id-ID") : ""} placeholder="0" onChange={(event) => setCustomPrices(customDays.map((current) => current.id === item.id ? { ...current, price: Number(event.target.value.replace(/\D/g, "")) } : current), customDays)} /></div><button type="button" aria-label={`Remove custom day ${index + 1}`} onClick={() => setCustomPrices(customDays.filter((current) => current.id !== item.id), customDays)}>×</button></div>)}<button type="button" className="ps-custom-day-add" onClick={() => { setApplicableDays((current) => current.includes("Mon") ? current : [...current, "Mon"]); setCustomDays((current) => [...current, { id: Date.now() + current.length, day: "Mon", price: 0 }]); }}>＋ Add Custom Day Price</button></div>
          <p className="ps-modal-hint">Perubahan field terpilih dan harga khusus langsung diperbarui. Simpan setelah selesai mengatur.</p>
        </div>
        <div className="ps-modal-footer"><button type="button" className="ps-button ps-button--outline" onClick={() => setBulkOpen(false)}>Close</button><button type="button" className="ps-button ps-button--primary" disabled={changed.length === 0} onClick={() => { setBulkOpen(false); setSaveModal("confirm"); }}>✓ Save Changes</button></div>
      </section>
    </div>}

    {saveModal && <div className="ps-overlay"><section className="ps-modal ps-save-modal" role="dialog" aria-modal="true" aria-labelledby="ps-save-title"><div className="ps-modal-head"><h2 id="ps-save-title">{saveModal === "confirm" ? "Confirm Changes" : "Changes Saved"}</h2></div><div className="ps-modal-body"><p>{saveModal === "confirm" ? `Simpan perubahan harga dan stok pada ${changed.length} baris?` : "Perubahan harga dan stok berhasil disimpan untuk sesi demo ini."}</p></div><div className="ps-modal-footer">{saveModal === "confirm" ? <><button type="button" className="ps-button ps-button--outline" onClick={() => setSaveModal(null)}>Cancel</button><button type="button" className="ps-button ps-button--primary" onClick={saveChanges}>Confirm Save</button></> : <button type="button" className="ps-button ps-button--primary" onClick={() => setSaveModal(null)}>Done</button>}</div></section></div>}
  </AdminShell>;
}
