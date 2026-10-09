"use client";
import "../styles/prices-stocks.css";

import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdminShell } from "../../../components/layout/AdminShell";
import { Icon } from "../../../components/ui/Icon";
import { restoreSession } from "../../../lib/auth";
import { DateRangePicker } from "../../campaigns/components/DateRangePicker";
import { getRoomTypes, type RoomTypeRecord } from "../../rooms/services/room-types";
import {
  getInventory,
  updateInventoryRange,
  updateInventoryRows,
  type InventoryChange,
  type InventoryItem,
  type InventoryList,
} from "../services/prices-stocks";
import {
  formatStockDate,
  formatStockPrice,
  type PriceStock,
} from "../constants/prices-stocks-data";
import { downloadPricesStocksCsv } from "../utils/export-csv";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

type StockField = "stock" | "price" | "minNight" | "stopSell";
type BulkValues = { stock: number; price: number; minNight: number; stopSell: boolean };
type CustomDayPrice = { id: number; day: string; price: number };
type RoomRows = Record<string, Record<string, PriceStock>>;

const pageSize = 30;
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const emptyBulk: BulkValues = { stock: 0, price: 0, minNight: 0, stopSell: false };
const emptyIncluded: Record<StockField, boolean> = {
  stock: false,
  price: false,
  minNight: false,
  stopSell: false,
};

function jakartaDate(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addDays(date: string, count: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0, 10);
}

function mapInventoryRow(item: InventoryItem): PriceStock {
  return {
    date: item.stayDate,
    day: dayOf(item.stayDate),
    sellableStock: item.sellableStock,
    remainingStock: item.remainingStock,
    availableRooms: item.availableRooms,
    price: item.basePrice,
    websitePromo: item.websitePromo?.name ?? null,
    webPrice: item.webPrice,
    frontDeskPromo: item.frontDeskPromo?.name ?? null,
    frontDeskPrice: item.frontDeskPrice,
    minNight: item.minNights,
    stopSell: item.stopSell,
    version: item.version,
    isConfigured: item.isConfigured,
    bookedRooms: item.bookedRooms,
  };
}

function rangeDates(from: string, to: string): string[] {
  if (!from || !to || from > to) return [];
  const dates: string[] = [];
  const current = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(current.getTime()) || Number.isNaN(end.getTime())) return [];
  if ((end.getTime() - current.getTime()) / 86_400_000 >= 366) return [];
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
    sellableStock: null,
    remainingStock: null,
    availableRooms: null,
    price: null,
    websitePromo: null,
    webPrice: null,
    frontDeskPromo: null,
    frontDeskPrice: null,
    minNight: null,
    stopSell: null,
  };
}

function Toggle({ checked, onChange, label, disabled = false }: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return <label className="ps-toggle" aria-label={label}>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    <span />
  </label>;
}

export function PricesStocksPage() {
  const { t } = useTranslations({ en, id });
  const [roomTypes, setRoomTypes] = useState<RoomTypeRecord[]>([]);
  const [roomId, setRoomId] = useState("");
  const [allRows, setAllRows] = useState<RoomRows>({});
  const originalRows = useRef<RoomRows>({});
  const [totalRoomCount, setTotalRoomCount] = useState<number | null>(null);
  const [stockLimit, setStockLimit] = useState(0);
  const [operationalRooms, setOperationalRooms] = useState(0);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [changed, setChanged] = useState<string[]>([]);
  const [bulkPending, setBulkPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataReady, setDataReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [notice, setNotice] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [saveModal, setSaveModal] = useState<"confirm" | "success" | null>(null);
  const [bulkFrom, setBulkFrom] = useState(fromDate);
  const [bulkTo, setBulkTo] = useState(toDate);
  const [bulk, setBulk] = useState<BulkValues>({ ...emptyBulk });
  const [modalInputs, setModalInputs] = useState({ stock: "0", price: "0", minNight: "0" });
  const [included, setIncluded] = useState<Record<StockField, boolean>>({ ...emptyIncluded });
  const [customDays, setCustomDays] = useState<CustomDayPrice[]>([]);
  const [applicableDays, setApplicableDays] = useState<string[]>(weekdays);
  const customPriceBaseline = useRef<Record<string, number | null>>({});
  const bulkBaseline = useRef<Record<string, PriceStock>>({});

  const roomType = roomTypes.find((item) => item.id === roomId);
  const room = { name: roomType?.name ?? t("roomTypeFallback"), units: stockLimit };
  const dates = useMemo(() => rangeDates(fromDate, toDate), [fromDate, toDate]);
  const pageCount = Math.max(1, Math.ceil(dates.length / pageSize));
  const pageDates = dates.slice((page - 1) * pageSize, page * pageSize);
  const dirtyDates = changed.filter((key) => {
    const date = key.slice(roomId.length + 1);
    const before = originalRows.current[roomId]?.[date] ?? emptyRow(date);
    const after = allRows[roomId]?.[date] ?? before;
    return after.sellableStock !== before.sellableStock ||
      after.price !== before.price ||
      after.minNight !== before.minNight ||
      (after.stopSell === true) !== (before.stopSell === true);
  });

  useEffect(() => {
    const today = jakartaDate();
    setFromDate(today);
    setToDate(addDays(today, 29));
  }, []);

  useEffect(() => {
    let active = true;
    async function loadRoomTypes() {
      try {
        if (!(await restoreSession())) return;
        const first = await getRoomTypes(new URLSearchParams({ page: "1", limit: "100" }));
        const pages = await Promise.all(
          Array.from({ length: Math.ceil(first.total / 100) - 1 }, (_, index) =>
            getRoomTypes(new URLSearchParams({ page: String(index + 2), limit: "100" })),
          ),
        );
        if (!active) return;
        const items = [first, ...pages].flatMap((result) => result.items).filter((item) => item.isActive);
        setRoomTypes(items);
        setRoomId((current) => current || items[0]?.id || "");
        if (!items.length) setNotice(t("messages.noActiveRoomType"));
      } catch (caught) {
        if (active) setNotice(caught instanceof Error ? caught.message : t("messages.roomTypesLoadFailed"));
      } finally {
        if (active && !roomId) setLoading(false);
      }
    }
    void loadRoomTypes();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!roomId || !fromDate || !toDate || dates.length === 0 || dates.length > 366) return;
    const controller = new AbortController();
    async function loadRows() {
      setLoading(true);
      setDataReady(false);
      setTotalRoomCount(null);
      setNotice("");
      try {
        if (!(await restoreSession())) return;
        const query = (targetPage: number) => new URLSearchParams({
          roomTypeId: roomId,
          startDate: fromDate,
          endDate: toDate,
          page: String(targetPage),
          limit: String(pageSize),
        });
        const first = await getInventory(query(1), controller.signal);
        const pages: InventoryList[] = [];
        for (let nextPage = 2; nextPage <= Math.ceil(first.total / pageSize); nextPage += 1) {
          pages.push(await getInventory(query(nextPage), controller.signal));
        }
        if (controller.signal.aborted) return;
        const rows = Object.fromEntries([first, ...pages]
          .flatMap((result) => result.items)
          .map((item) => [item.stayDate, mapInventoryRow(item)]));
        originalRows.current = { [roomId]: rows };
        setAllRows({ [roomId]: rows });
        setTotalRoomCount(first.totalRoomCount ?? null);
        setStockLimit(first.stockLimit);
        setOperationalRooms(first.operationalRoomCount);
        setDataReady(true);
        setChanged([]);
        setBulkPending(false);
        setBulk({ ...emptyBulk });
        setIncluded({ ...emptyIncluded });
      } catch (caught) {
        if (!controller.signal.aborted) {
          setAllRows({});
          setNotice(caught instanceof Error ? caught.message : t("messages.inventoryLoadFailed"));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadRows();
    return () => controller.abort();
  }, [roomId, fromDate, toDate, reloadKey]);

  function markChanged(targetDates: string[], asBulk = false) {
    setChanged((current) => [...new Set([...current, ...targetDates.map((date) => `${roomId}:${date}`)])]);
    if (asBulk) setBulkPending(true);
    setNotice("");
  }

  function updateDates(targetDates: string[], patch: (date: string, row: PriceStock) => Partial<PriceStock>, asBulk = false) {
    if (targetDates.length === 0) return;
    setAllRows((current) => {
      const nextRoom = { ...(current[roomId] ?? {}) };
      targetDates.forEach((date) => {
        const existing = nextRoom[date] ?? emptyRow(date);
        const updated = { ...existing, ...patch(date, existing) };
        const stockUpdated = updated.sellableStock !== existing.sellableStock || updated.stopSell !== existing.stopSell;
        const withStock = stockUpdated
          ? {
              ...updated,
              remainingStock: updated.sellableStock === null ? null : Math.max(0, updated.sellableStock - (updated.bookedRooms ?? 0)),
              availableRooms: updated.sellableStock === null ? null : updated.stopSell ? 0 : Math.max(0, Math.min(updated.sellableStock, operationalRooms) - (updated.bookedRooms ?? 0)),
            }
          : updated;
        nextRoom[date] = withStock.price !== existing.price
          ? {
              ...withStock,
              webPrice: null,
              frontDeskPrice: null,
            }
          : withStock;
      });
      return { ...current, [roomId]: nextRoom };
    });
    markChanged(targetDates, asBulk);
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
    if (!inModal) {
      setBulkFrom(fromDate);
      setBulkTo(toDate);
      setApplicableDays(weekdays);
      setCustomDays([]);
    }
    updateDates(targetDates, (date) => {
      if (field === "price" && inModal) {
        const custom = customDays.findLast((item) => item.day === dayOf(date) && item.price > 0);
        return { price: custom?.price ?? Number(normalized) };
      }
      return field === "stock" ? { sellableStock: Number(normalized) } : { [field]: normalized };
    }, true);
  }

  function updateBulk(field: StockField, value: number | boolean, inModal: boolean) {
    const nextValue = included[field] ? normalizedValue(field, value) : value;
    setBulk((current) => ({ ...current, [field]: nextValue }));
    if (included[field]) writeBulkField(field, nextValue, inModal);
  }

  function updateModalInput(field: "stock" | "price" | "minNight", raw: string) {
    const value = raw === "" ? "" : String(Number(raw));
    setModalInputs((current) => ({ ...current, [field]: value }));
    if (value !== "") updateBulk(field, Number(value), true);
  }

  function toggleBulkField(field: StockField, enabled: boolean, inModal: boolean) {
    setIncluded((current) => ({ ...current, [field]: enabled }));
    if (enabled) {
      const value = normalizedValue(field, bulk[field]);
      setBulk((current) => ({ ...current, [field]: value }));
      if (inModal && field !== "stopSell") {
        setModalInputs((current) => ({ ...current, [field]: String(value) }));
      }
      writeBulkField(field, value, inModal);
      return;
    }
    if (!bulkPending) return;
    const key = field === "stock" ? "sellableStock" : field === "price" ? "price" : field === "minNight" ? "minNight" : "stopSell";
    updateDates(bulkDates(inModal), (date) => {
      const original = originalRows.current[roomId]?.[date] ?? emptyRow(date);
      if (field === "price") {
        const custom = customDays.findLast((item) => item.day === dayOf(date) && item.price > 0);
        if (custom) return { price: custom.price };
      }
      return { [key]: original[key] };
    }, true);
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
    }, true);
  }

  function toggleApplicableDay(day: string, enabled: boolean) {
    if (!enabled && customDays.some((item) => item.day === day)) return;
    setApplicableDays((current) => enabled ? [...current, day] : current.filter((item) => item !== day));
    const targetDates = rangeDates(bulkFrom, bulkTo).filter((date) => dayOf(date) === day);
    if (!enabled) {
      updateDates(targetDates, (date) => bulkBaseline.current[date] ?? emptyRow(date), true);
      return;
    }
    updateDates(targetDates, (date) => {
      const custom = customDays.findLast((item) => item.day === dayOf(date) && item.price > 0);
      return {
        ...(included.stock ? { sellableStock: Math.min(bulk.stock, room.units) } : {}),
        ...(included.price || custom ? { price: custom?.price ?? bulk.price } : {}),
        ...(included.minNight ? { minNight: bulk.minNight } : {}),
        ...(included.stopSell ? { stopSell: bulk.stopSell } : {}),
      };
    }, true);
  }

  function cancelBulk() {
    setAllRows((current) => ({ ...current, [roomId]: { ...(originalRows.current[roomId] ?? {}) } }));
    setChanged([]);
    setBulkPending(false);
    setBulk({ ...emptyBulk });
    setModalInputs({ stock: "0", price: "0", minNight: "0" });
    setIncluded({ ...emptyIncluded });
    setCustomDays([]);
    setBulkOpen(false);
    setNotice("");
  }

  function openBulk() {
    if (dirtyDates.length || bulkPending) {
      setNotice(t("messages.saveBeforeBulk"));
      return;
    }
    setBulkFrom(fromDate);
    setBulkTo(toDate);
    setBulk({ ...emptyBulk });
    setModalInputs({ stock: "0", price: "0", minNight: "0" });
    setIncluded({ ...emptyIncluded });
    setCustomDays([]);
    setApplicableDays(weekdays);
    customPriceBaseline.current = {};
    bulkBaseline.current = { ...(allRows[roomId] ?? {}) };
    setBulkOpen(true);
  }

  async function saveChanges() {
    if (!roomId || saving) return;
    setSaving(true);
    setNotice("");
    try {
      if (bulkPending) {
        if (new Set(customDays.map((item) => item.day)).size !== customDays.length) {
          throw new Error(t("messages.duplicateCustomDay"));
        }
        if (applicableDays.length === 0) {
          throw new Error(t("messages.requireApplicableDay"));
        }
        const fields = {
          ...(included.stock ? { sellableStock: Math.min(bulk.stock, stockLimit) } : {}),
          ...(included.price ? { basePrice: bulk.price } : {}),
          ...(included.minNight ? { minNights: bulk.minNight } : {}),
          ...(included.stopSell ? { stopSell: bulk.stopSell } : {}),
        };
        const dayNumber = (day: string) => weekdays.indexOf(day) || 7;
        if (Object.keys(fields).length === 0 && !customDays.some((item) => item.price > 0)) {
          throw new Error(t("messages.requireFieldOrCustom"));
        }
        await updateInventoryRange({
          roomTypeId: roomId,
          startDate: bulkFrom,
          endDate: bulkTo,
          fields,
          applicableWeekdays: applicableDays.map(dayNumber),
          customDayPrices: customDays.filter((item) => item.price > 0).map((item) => ({
            weekday: dayNumber(item.day),
            basePrice: item.price,
          })),
        });
      } else {
        const changes: InventoryChange[] = dirtyDates.map((key) => {
          const date = key.slice(roomId.length + 1);
          const before = originalRows.current[roomId]?.[date] ?? emptyRow(date);
          const after = allRows[roomId]?.[date] ?? before;
          if (after.price === null || after.sellableStock === null || after.minNight === null && before.isConfigured) {
            throw new Error(t("messages.requireRowFields", { date }));
          }
          const change: InventoryChange = { stayDate: date, expectedVersion: before.version ?? null };
          if (after.price !== before.price && after.price !== null) change.basePrice = after.price;
          if (after.sellableStock !== before.sellableStock && after.sellableStock !== null) change.sellableStock = after.sellableStock;
          if (after.minNight !== before.minNight && after.minNight !== null) change.minNights = after.minNight;
          if (after.stopSell !== before.stopSell && after.stopSell !== null) change.stopSell = after.stopSell;
          if (change.expectedVersion === null) {
            if (after.price === null || after.sellableStock === null) {
              throw new Error(t("messages.requireRowBasics", { date }));
            }
            change.basePrice = after.price;
            change.sellableStock = after.sellableStock;
          }
          return change;
        }).filter((change) => Object.keys(change).length > 2);
        if (changes.length > 300) {
          throw new Error(t("messages.tooManyChanges"));
        }
        if (changes.length) await updateInventoryRows(roomId, changes);
      }
      setChanged([]);
      setBulkPending(false);
      setBulk({ ...emptyBulk });
      setIncluded({ ...emptyIncluded });
      setSaveModal("success");
      setReloadKey((current) => current + 1);
    } catch (caught) {
      setSaveModal(null);
      setNotice(caught instanceof Error ? caught.message : t("messages.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return <AdminShell title={t("shell.title")} context={t("shell.context")}>
    <div className="ps-page">
      <div className="ps-heading">
        <div><h1>{t("page.title")}</h1><p>{t("page.description")}</p></div>
        <div className="ps-heading-actions">
          <span className="ps-unsaved"><i />{t("heading.unsavedChanges", { count: dirtyDates.length })}</span>
          <button type="button" className="ps-button ps-button--outline" disabled={!roomId || loading || !dataReady || dates.length === 0 || dirtyDates.length > 0 || bulkPending} onClick={() => downloadPricesStocksCsv({ roomName: room.name, fromDate, toDate, dates, rows: originalRows.current[roomId] ?? {} })}>{t("actions.exportCsv")}</button>
          {bulkPending && <button type="button" className="ps-button ps-button--outline" onClick={cancelBulk}>{t("actions.cancelBulk")}</button>}
          <button type="button" className="ps-button ps-button--outline" onClick={openBulk} disabled={!roomId || loading || !dataReady || dirtyDates.length > 0 || bulkPending}>{t("actions.bulkUpdate")}</button>
          <button type="button" className="ps-button ps-button--primary" onClick={() => setSaveModal("confirm")} disabled={dirtyDates.length === 0 || saving || loading || !dataReady}>{t("actions.saveChanges")}</button>
        </div>
      </div>

      <div className="ps-toolbar">
        <div className="ps-toolbar-controls">
          <label>{t("toolbar.roomType")} <select value={roomId} disabled={dirtyDates.length > 0 || bulkPending || loading} onChange={(event) => { setRoomId(event.target.value); setPage(1); }}><option value="">{t("toolbar.selectRoomType")}</option>{roomTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <span className="ps-toolbar-divider" />
          <div className="ps-date-controls">
            <span>{t("toolbar.dateRange")}</span>
            <DateRangePicker
              label={t("toolbar.dateRange")}
              start={fromDate}
              end={toDate}
              numberOfMonths={2}
              disabled={dirtyDates.length > 0 || bulkPending || loading}
              onChange={(start, end) => {
                setFromDate(start);
                setToDate(end);
                setPage(1);
              }}
            />
          </div>
        </div>
        <span className="ps-record-count">{t("toolbar.recordCount", { count: dates.length })}</span>
      </div>

      {roomId && (
        <section className="ps-room-capacity" aria-label={t("capacity.ariaLabel")}>
          <div><span>{t("capacity.totalRooms")}</span><strong>{dataReady ? totalRoomCount ?? "—" : "—"}</strong><small>{t("capacity.totalRoomsHint")}</small></div>
          <div><span>{t("capacity.activeRooms")}</span><strong>{dataReady ? stockLimit : "—"}</strong><small>{t("capacity.activeRoomsHint")}</small></div>
          <div><span>{t("capacity.operationalRooms")}</span><strong>{dataReady ? operationalRooms : "—"}</strong><small>{t("capacity.operationalRoomsHint")}</small></div>
        </section>
      )}

      {dates.length === 0 ? <div className="ps-empty">{t("empty.noDates")}</div> : <>
        {loading ? <LoadingSkeleton rows={8} /> : <>
        <div className="ps-table-scroll"><table className="ps-table">
          <thead><tr><th>{t("table.day")}</th><th>{t("table.date")}</th><th>{t("table.sellableStock")}</th><th title={t("table.soldTitle")}>{t("table.sold")}</th><th>{t("table.remainingStock")}</th><th>{t("table.availableRooms")}</th><th>{t("table.price")}</th><th>{t("table.websitePromo")}</th><th>{t("table.webPrice")}</th><th>{t("table.frontDeskPromo")}</th><th>{t("table.frontDeskPrice")}</th><th>{t("table.minNight")}</th><th>{t("table.stopSell")}</th></tr></thead>
          <tbody>
            <tr className="ps-bulk-row">
              <td>⚙</td><td><strong>{t("bulkRow.label")}</strong></td>
              <td><div className="ps-bulk-cell"><input type="checkbox" aria-label={t("bulkRow.includeStockAria")} checked={included.stock} disabled={!roomId || loading || !dataReady || dirtyDates.length > 0 && !bulkPending} onChange={(event) => toggleBulkField("stock", event.target.checked, false)} /><input type="number" min={0} max={room.units} value={Math.min(bulk.stock, room.units)} disabled={!roomId || loading || !dataReady || dirtyDates.length > 0 && !bulkPending} onChange={(event) => updateBulk("stock", Number(event.target.value), false)} /></div></td>
              <td>—</td><td>—</td><td>—</td>
              <td><div className="ps-bulk-cell"><input type="checkbox" aria-label={t("bulkRow.includePriceAria")} checked={included.price} disabled={!roomId || loading || !dataReady || dirtyDates.length > 0 && !bulkPending} onChange={(event) => toggleBulkField("price", event.target.checked, false)} /><div className="ps-price-input"><span>Rp</span><input inputMode="numeric" value={bulk.price.toLocaleString("id-ID")} disabled={!roomId || loading || !dataReady || dirtyDates.length > 0 && !bulkPending} onChange={(event) => updateBulk("price", Number(event.target.value.replace(/\D/g, "")), false)} /></div></div></td>
              <td>—</td><td>—</td><td>—</td><td>—</td>
              <td><div className="ps-bulk-cell"><input type="checkbox" aria-label={t("bulkRow.includeMinNightAria")} checked={included.minNight} disabled={!roomId || loading || !dataReady || dirtyDates.length > 0 && !bulkPending} onChange={(event) => toggleBulkField("minNight", event.target.checked, false)} /><input type="number" min={included.minNight ? 1 : 0} max={14} value={bulk.minNight} disabled={!roomId || loading || !dataReady || dirtyDates.length > 0 && !bulkPending} onChange={(event) => updateBulk("minNight", Number(event.target.value), false)} /></div></td>
              <td><div className="ps-bulk-cell"><input type="checkbox" aria-label={t("bulkRow.includeStopSellAria")} checked={included.stopSell} disabled={!roomId || loading || !dataReady || dirtyDates.length > 0 && !bulkPending} onChange={(event) => toggleBulkField("stopSell", event.target.checked, false)} /><Toggle checked={bulk.stopSell} onChange={(value) => updateBulk("stopSell", value, false)} label={t("bulkRow.stopSellLabel")} disabled={!roomId || loading || !dataReady || dirtyDates.length > 0 && !bulkPending} /></div></td>
            </tr>
            {pageDates.map((date) => {
              const stored = allRows[roomId]?.[date];
              const row = stored ?? emptyRow(date);
              const isUnconfigured = !row.isConfigured;
              const original = originalRows.current[roomId]?.[date] ?? emptyRow(date);
              const stockDirty = row.sellableStock !== original.sellableStock;
              const priceDirty = row.price !== original.price;
              const minNightDirty = row.minNight !== original.minNight;
              const stopSellDirty = (row.stopSell === true) !== (original.stopSell === true);
              return <tr key={date} className={row.stopSell ? "ps-stop-row" : ""}>
                <td className="ps-day">{row.day}</td><td className="ps-date">{formatStockDate(date)}</td>
                <td className={stockDirty ? "ps-cell-unsaved" : undefined}><input className={row.sellableStock === 0 ? "ps-stock-zero" : ""} type="number" min={0} max={room.units} value={row.sellableStock ?? ""} placeholder="—" aria-label={t("cell.sellableStockAria", { date })} disabled={loading || !dataReady || bulkPending} onChange={(event) => updateRow(date, { sellableStock: event.target.value === "" ? null : Math.max(0, Math.min(room.units, Number(event.target.value))) })} /></td>
                <td>{row.bookedRooms ?? "—"}</td>
                <td>{row.remainingStock ?? "—"}</td>
                <td>{row.availableRooms ?? "—"}</td>
                <td className={priceDirty ? "ps-cell-unsaved" : undefined}><div className="ps-price-input"><span>Rp</span><input inputMode="numeric" value={row.price === null ? "" : row.price.toLocaleString("id-ID")} placeholder="—" aria-label={t("cell.priceAria", { date })} disabled={loading || !dataReady || bulkPending} onChange={(event) => updateRow(date, { price: event.target.value === "" ? null : Number(event.target.value.replace(/\D/g, "")) })} /></div></td>
                <td>{isUnconfigured ? <span className="ps-no-promo">—</span> : row.websitePromo ? <span className="ps-promo">◇ {row.websitePromo}</span> : <span className="ps-no-promo">{t("cell.noPromo")}</span>}</td>
                <td>{row.webPrice !== null ? <strong className="ps-promo-price">{formatStockPrice(row.webPrice)}</strong> : <span className="ps-no-promo">—</span>}</td>
                <td>{isUnconfigured ? <span className="ps-no-promo">—</span> : row.frontDeskPromo ? <span className="ps-promo">◇ {row.frontDeskPromo}</span> : <span className="ps-no-promo">{t("cell.noPromo")}</span>}</td>
                <td>{row.frontDeskPrice !== null ? <strong className="ps-promo-price">{formatStockPrice(row.frontDeskPrice)}</strong> : <span className="ps-no-promo">—</span>}</td>
                <td className={minNightDirty ? "ps-cell-unsaved" : undefined}><input type="number" min={1} max={14} value={row.minNight ?? ""} placeholder="—" aria-label={t("cell.minNightAria", { date })} disabled={loading || !dataReady || bulkPending} onChange={(event) => updateRow(date, { minNight: event.target.value === "" ? null : Math.max(1, Number(event.target.value)) })} /></td>
                <td className={stopSellDirty ? "ps-cell-unsaved" : undefined}><Toggle checked={row.stopSell === true} onChange={(value) => updateRow(date, { stopSell: value })} label={t("cell.stopSellAria", { date })} disabled={loading || !dataReady || bulkPending} /></td>
              </tr>;
            })}
          </tbody>
        </table></div>
        <div className="ps-pagination"><span>{t("pagination.showing", { from: (page - 1) * pageSize + 1, to: Math.min(page * pageSize, dates.length), total: dates.length })}</span><div><button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>{t("actions.previous")}</button><span>{t("pagination.pageOf", { page, pageCount })}</span><button type="button" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}>{t("actions.next")}</button></div></div>
        </>}
      </>}

      <div className="ps-helper"><Icon name="info" width={18} height={18} /><p>{t("helper.body", { roomName: room.name, stockLimit })} {bulkPending && t("helper.bulkPending")}</p></div>
      {notice && <div className="ps-notice" role="status">{notice}{roomId && !loading && !dataReady && <button type="button" className="ps-button ps-button--outline" onClick={() => setReloadKey((current) => current + 1)}>{t("actions.retry")}</button>}</div>}
    </div>

    {bulkOpen && <div className="ps-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) cancelBulk(); }}>
      <section className="ps-modal" role="dialog" aria-modal="true" aria-labelledby="ps-bulk-title">
        <div className="ps-modal-head"><h2 id="ps-bulk-title">{t("bulkModal.title")}</h2><button type="button" aria-label={t("bulkModal.closeAria")} onClick={cancelBulk}>×</button></div>
        <div className="ps-modal-body">
          <div className="ps-target"><span>{t("bulkModal.targetRoom")}</span><strong>{t("bulkModal.targetRoomValue", { roomName: room.name, units: room.units })}</strong></div>
          <div className="ps-modal-dates"><label>{t("bulkModal.from")}<input type="date" value={bulkFrom} disabled={bulkPending} onChange={(event) => setBulkFrom(event.target.value)} /></label><label>{t("bulkModal.to")}<input type="date" value={bulkTo} disabled={bulkPending} onChange={(event) => setBulkTo(event.target.value)} /></label></div>
          <div className="ps-applicable-days"><strong>{t("bulkModal.applicableDays")}</strong><div className="ps-day-options">{weekdays.map((day) => {
            const locked = customDays.some((item) => item.day === day);
            return <label key={day} title={locked ? t("bulkModal.applicableDaysLockedTitle", { day }) : undefined}><input type="checkbox" checked={applicableDays.includes(day)} disabled={locked} onChange={(event) => toggleApplicableDay(day, event.target.checked)} />{day}</label>;
          })}</div><p>{t("bulkModal.applicableDaysNote")}</p></div>
          <div className="ps-modal-fields"><strong>{t("bulkModal.fieldChanges")}</strong>{(["stock", "price", "minNight", "stopSell"] as StockField[]).map((field) => <div key={field} className="ps-modal-field"><label><input type="checkbox" checked={included[field]} onChange={(event) => toggleBulkField(field, event.target.checked, true)} />{field === "minNight" ? t("bulkModal.fields.minNight") : field === "stopSell" ? t("bulkModal.fields.stopSell") : field === "price" ? t("bulkModal.fields.price") : t("bulkModal.fields.stock")}</label>{field === "stopSell" ? <select value={bulk.stopSell ? "on" : "off"} onChange={(event) => updateBulk(field, event.target.value === "on", true)}><option value="off">{t("bulkModal.fields.stopSellOff")}</option><option value="on">{t("bulkModal.fields.stopSellOn")}</option></select> : <input type="number" min={field === "minNight" ? 1 : 0} max={field === "stock" ? room.units : field === "minNight" ? 14 : undefined} value={modalInputs[field]} onChange={(event) => updateModalInput(field, event.target.value)} onBlur={() => { if (modalInputs[field] !== "") setModalInputs((current) => ({ ...current, [field]: String(bulk[field]) })); }} />}</div>)}</div>
          <div className="ps-custom-days"><strong>{t("bulkModal.customDays")}</strong><p>{t("bulkModal.customDaysNote")}</p>{customDays.map((item, index) => <div className="ps-custom-day-row" key={item.id}><select aria-label={t("bulkModal.customDayAria", { index: index + 1 })} value={item.day} onChange={(event) => { const day = event.target.value; setApplicableDays((current) => current.includes(day) ? current : [...current, day]); setCustomPrices(customDays.map((current) => current.id === item.id ? { ...current, day } : current), customDays); }}>{weekdays.filter((day) => day === item.day || !customDays.some((other) => other.day === day)).map((day) => <option key={day} value={day}>{day}</option>)}</select><div className="ps-price-input"><span>Rp</span><input inputMode="numeric" aria-label={t("bulkModal.customPriceAria", { index: index + 1 })} value={item.price ? item.price.toLocaleString("id-ID") : ""} placeholder="0" onChange={(event) => setCustomPrices(customDays.map((current) => current.id === item.id ? { ...current, price: Number(event.target.value.replace(/\D/g, "")) } : current), customDays)} /></div><button type="button" aria-label={t("bulkModal.removeCustomDayAria", { index: index + 1 })} onClick={() => setCustomPrices(customDays.filter((current) => current.id !== item.id), customDays)}>×</button></div>)}<button type="button" className="ps-custom-day-add" disabled={customDays.length >= 7} onClick={() => { const day = weekdays.find((candidate) => !customDays.some((item) => item.day === candidate)); if (!day) return; setApplicableDays((current) => current.includes(day) ? current : [...current, day]); setCustomDays((current) => [...current, { id: Date.now() + current.length, day, price: 0 }]); }}>{t("bulkModal.addCustomDay")}</button></div>
          <p className="ps-modal-hint">{t("bulkModal.hint")}</p>
        </div>
        <div className="ps-modal-footer"><button type="button" className="ps-button ps-button--outline" onClick={cancelBulk}>{t("bulkModal.actions.cancel")}</button><button type="button" className="ps-button ps-button--primary" disabled={dirtyDates.length === 0 || (["stock", "price", "minNight"] as const).some((field) => included[field] && modalInputs[field] === "")} onClick={() => { setBulkOpen(false); setSaveModal("confirm"); }}>{t("bulkModal.actions.saveChanges")}</button></div>
      </section>
    </div>}

    {saveModal && <div className="ps-overlay"><section className="ps-modal ps-save-modal" role="dialog" aria-modal="true" aria-labelledby="ps-save-title"><div className="ps-modal-head"><h2 id="ps-save-title">{saveModal === "confirm" ? t("saveModal.confirmTitle") : t("saveModal.successTitle")}</h2></div><div className="ps-modal-body"><p>{saveModal === "confirm" ? t("saveModal.confirmBody", { count: dirtyDates.length }) : t("saveModal.successBody")}</p></div><div className="ps-modal-footer">{saveModal === "confirm" ? <><button type="button" className="ps-button ps-button--outline" disabled={saving} onClick={() => setSaveModal(null)}>{t("saveModal.cancel")}</button><button type="button" className="ps-button ps-button--primary" disabled={saving} onClick={() => void saveChanges()}>{saving ? t("saveModal.saving") : t("saveModal.confirmSave")}</button></> : <button type="button" className="ps-button ps-button--primary" onClick={() => setSaveModal(null)}>{t("saveModal.done")}</button>}</div></section></div>}
  </AdminShell>;
}
