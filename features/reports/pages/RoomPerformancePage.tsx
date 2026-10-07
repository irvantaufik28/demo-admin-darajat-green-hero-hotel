"use client";
import "../../reservations/styles/reservations.css";
import "../styles/reports.css";

import { useEffect, useRef, useState } from "react";
import { AdminShell } from "../../../components/layout/AdminShell";
import { restoreSession } from "../../../lib/auth";
import { getRoomTypes } from "../../rooms/services/room-types";
import {
  getRoomPerformance,
  type RoomPerformanceByRoom,
  type RoomPerformanceDaily,
  type RoomPerformanceMetrics,
  type RoomPerformanceMode,
  type RoomPerformanceResponse,
} from "../services/room-performance";
import { useTranslations, type Translate } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

type Comparison = "previous" | "last-year" | "none";
type RoomOption = { id: string; name: string };

const money = (value: number) => `Rp${Math.round(value).toLocaleString("id-ID")}`;
const percent = (value: number) => `${value.toFixed(1)}%`;
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));

const sourceFilterOptions = [
  { label: "Website", value: "website" },
  { label: "Phone", value: "phone" },
  { label: "Walk-in", value: "walk_in" },
  { label: "OTA", value: "ota" },
];

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function downloadCsv(result: RoomPerformanceResponse) {
  const records: (string | number)[][] = [
    [
      "Room Type",
      "Physical Rooms",
      "Available RN",
      "Sold RN",
      "Unsold RN",
      "Occupancy",
      "ARR",
      "Room Revenue",
      "Cancelled RN",
    ],
    ...result.byRoom.map((row) => [
      row.name,
      row.rooms,
      row.available,
      row.sold,
      row.unsold,
      percent(row.occupancy),
      Math.round(row.arr),
      row.revenue,
      row.cancelled,
    ]),
    [],
    ["Date", "Available RN", "Sold RN", "Occupancy", "ARR", "Room Revenue"],
    ...result.daily.map((day) => [
      day.date,
      day.available,
      day.sold,
      percent(day.occupancy),
      Math.round(day.arr),
      day.revenue,
    ]),
  ];
  const csv = records
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "room-performance-week.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function ComparisonCard({
  label,
  current,
  previous,
  format,
  t,
}: {
  label: string;
  current: number;
  previous: number;
  format: (value: number) => string;
  t: Translate;
}) {
  const change = previous ? ((current - previous) / previous) * 100 : null;
  return (
    <div className="room-performance-compare-card">
      <span>{label}</span>
      <strong>{format(current)}</strong>
      <small>
        {change === null
          ? t("roomPerformance.comparisonSection.noBaseline")
          : t("roomPerformance.comparisonSection.changeVsComparison", { change: `${change >= 0 ? "+" : ""}${percent(change)}` })}
      </small>
    </div>
  );
}

export function RoomPerformancePage() {
  const { t } = useTranslations({ en, id });
  const [weekStart, setWeekStart] = useState("2026-09-29");
  const [roomId, setRoomId] = useState("");
  const [source, setSource] = useState("");
  const [mode, setMode] = useState<RoomPerformanceMode>("actual");
  const [comparison, setComparison] = useState<Comparison>("previous");

  const [result, setResult] = useState<RoomPerformanceResponse | null>(null);
  const [baseline, setBaseline] = useState<RoomPerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roomOptions, setRoomOptions] = useState<RoomOption[]>([]);
  const didLoadOptions = useRef(false);

  const comparisonStart =
    comparison === "last-year" ? shiftDate(weekStart, -364) : shiftDate(weekStart, -7);

  useEffect(() => {
    if (didLoadOptions.current) return;
    didLoadOptions.current = true;
    const controller = new AbortController();
    void (async () => {
      try {
        if (!(await restoreSession())) return;
        const first = await getRoomTypes(
          new URLSearchParams({ page: "1", limit: "100" }),
          controller.signal,
        );
        const rest = await Promise.all(
          Array.from({ length: Math.max(0, Math.ceil(first.total / first.limit) - 1) }, (_, i) =>
            getRoomTypes(new URLSearchParams({ page: String(i + 2), limit: "100" }), controller.signal),
          ),
        );
        if (!controller.signal.aborted) {
          setRoomOptions(
            [first, ...rest]
              .flatMap((page) => page.items)
              .map((item) => ({ id: item.id, name: item.name })),
          );
        }
      } catch {
        // Room type filter stays empty if options fail to load.
      }
    })();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setError("");
      try {
        if (!(await restoreSession())) return;
        const params = { from: weekStart, roomType: roomId, source, mode };
        const [main, base] = await Promise.all([
          getRoomPerformance(params, controller.signal),
          comparison === "none"
            ? Promise.resolve(null)
            : getRoomPerformance({ ...params, from: comparisonStart }, controller.signal),
        ]);
        if (!controller.signal.aborted) {
          setResult(main);
          setBaseline(base);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : t("common.loadFailed"));
          setResult(null);
          setBaseline(null);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [weekStart, roomId, source, mode, comparison, comparisonStart]);

  const total: RoomPerformanceMetrics = result?.total ?? {
    rooms: 0,
    available: 0,
    sold: 0,
    unsold: 0,
    cancelled: 0,
    revenue: 0,
    occupancy: 0,
    arr: 0,
  };
  const byRoom: RoomPerformanceByRoom[] = result?.byRoom ?? [];
  const daily: RoomPerformanceDaily[] = result?.daily ?? [];
  const dates = result?.dates ?? [weekStart, shiftDate(weekStart, 6)];
  const totalRooms = result?.totalRooms ?? 0;
  const baseTotal = baseline?.total;

  return (
    <AdminShell title={t("shell.title")} context={t("shell.roomPerformanceContext")}>
      <main className="room-performance-page">
        <header className="room-performance-heading">
          <div>
            <h1>{t("roomPerformance.title")}</h1>
            <p>{t("roomPerformance.description")}</p>
          </div>
          <div className="room-performance-actions">
            <button type="button" onClick={() => window.print()}>
              {t("roomPerformance.printAuditSheet")}
            </button>
            <button
              type="button"
              onClick={() => result && downloadCsv(result)}
              disabled={!result || loading}
            >
              {t("common.exportCsv")}
            </button>
          </div>
        </header>

        <section className="room-performance-filters" aria-label={t("roomPerformance.filters.ariaLabel")}>
          <label>
            {t("roomPerformance.filters.weekStarting")}
            <input
              type="date"
              value={weekStart}
              onChange={(event) => setWeekStart(event.target.value || "2026-09-29")}
            />
          </label>
          <label>
            {t("roomPerformance.filters.roomType")}
            <select value={roomId} onChange={(event) => setRoomId(event.target.value)}>
              <option value="">{t("common.allRoomTypes")}</option>
              {roomOptions.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("roomPerformance.filters.source")}
            <select value={source} onChange={(event) => setSource(event.target.value)}>
              <option value="">{t("common.allSources")}</option>
              {sourceFilterOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {t(`source.${item.value}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("roomPerformance.filters.occupancyMode")}
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as RoomPerformanceMode)}
            >
              <option value="actual">{t("roomPerformance.occupancyMode.actual")}</option>
              <option value="projected">{t("roomPerformance.occupancyMode.projected")}</option>
            </select>
          </label>
          <label>
            {t("roomPerformance.filters.compareWith")}
            <select
              value={comparison}
              onChange={(event) => setComparison(event.target.value as Comparison)}
            >
              <option value="previous">{t("roomPerformance.comparison.previous")}</option>
              <option value="last-year">{t("roomPerformance.comparison.lastYear")}</option>
              <option value="none">{t("roomPerformance.comparison.none")}</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setWeekStart("2026-09-29");
              setRoomId("");
              setSource("");
              setMode("actual");
              setComparison("previous");
            }}
          >
            {t("common.reset")}
          </button>
        </section>

        <p className="room-performance-period">
          {t("roomPerformance.period", {
            start: dateLabel(dates[0]),
            end: dateLabel(dates[dates.length - 1]),
            rooms: totalRooms,
          })}
        </p>

        {error && (
          <div className="reservation-detail-missing" role="alert">
            {error}
          </div>
        )}

        <section className="room-performance-kpis" aria-label={t("roomPerformance.kpis.ariaLabel")} aria-busy={loading}>
          {(
            [
              [t("roomPerformance.kpis.availableRoomNights"), total.available.toLocaleString("id-ID")],
              [t("roomPerformance.kpis.soldRoomNights"), total.sold.toLocaleString("id-ID")],
              [t("roomPerformance.kpis.occupancyRate"), percent(total.occupancy)],
              [t("roomPerformance.kpis.arr"), money(total.arr)],
              [t("roomPerformance.kpis.totalRoomRevenue"), money(total.revenue)],
            ] as [string, string][]
          ).map(([label, value]) => (
            <div className="room-performance-kpi" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </section>

        <section className="room-performance-panel">
          <header>
            <h2>{t("roomPerformance.byRoomType.title")}</h2>
            <span>{t("roomPerformance.byRoomType.subtitle")}</span>
          </header>
          <div className="room-performance-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("roomPerformance.byRoomType.table.roomType")}</th>
                  <th>{t("roomPerformance.byRoomType.table.physicalRooms")}</th>
                  <th>{t("roomPerformance.byRoomType.table.availableRN")}</th>
                  <th>{t("roomPerformance.byRoomType.table.soldRN")}</th>
                  <th>{t("roomPerformance.byRoomType.table.unsoldRN")}</th>
                  <th>{t("roomPerformance.byRoomType.table.occupancy")}</th>
                  <th>{t("roomPerformance.byRoomType.table.arr")}</th>
                  <th>{t("roomPerformance.byRoomType.table.roomRevenue")}</th>
                  <th>{t("roomPerformance.byRoomType.table.cancelledRN")}</th>
                </tr>
              </thead>
              <tbody>
                {byRoom.map((row) => (
                  <tr key={row.roomTypeId}>
                    <td>
                      <strong>{row.name}</strong>
                    </td>
                    <td>{row.rooms}</td>
                    <td>{row.available}</td>
                    <td>{row.sold}</td>
                    <td>{row.unsold}</td>
                    <td>{percent(row.occupancy)}</td>
                    <td>{money(row.arr)}</td>
                    <td>{money(row.revenue)}</td>
                    <td>{row.cancelled}</td>
                  </tr>
                ))}
                <tr className="room-performance-total">
                  <td>
                    <strong>{t("roomPerformance.byRoomType.total")}</strong>
                  </td>
                  <td>{totalRooms}</td>
                  <td>{total.available}</td>
                  <td>{total.sold}</td>
                  <td>{total.unsold}</td>
                  <td>{percent(total.occupancy)}</td>
                  <td>{money(total.arr)}</td>
                  <td>{money(total.revenue)}</td>
                  <td>{total.cancelled}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {comparison !== "none" && baseTotal && (
          <section className="room-performance-comparison">
            <header>
              <h2>{t("roomPerformance.comparisonSection.title")}</h2>
              <span>
                {t("roomPerformance.comparisonSection.subtitle", {
                  comparison: comparison === "previous" ? t("roomPerformance.comparison.previous") : t("roomPerformance.comparison.lastYear"),
                  start: dateLabel(comparisonStart),
                  end: dateLabel(shiftDate(comparisonStart, 6)),
                })}
              </span>
            </header>
            <div className="room-performance-compare-grid">
              <ComparisonCard
                label={t("roomPerformance.comparisonSection.cards.occupancyRate")}
                current={total.occupancy}
                previous={baseTotal.occupancy}
                format={percent}
                t={t}
              />
              <ComparisonCard
                label={t("roomPerformance.comparisonSection.cards.soldRoomNights")}
                current={total.sold}
                previous={baseTotal.sold}
                format={String}
                t={t}
              />
              <ComparisonCard
                label={t("roomPerformance.comparisonSection.cards.averageRoomRate")}
                current={total.arr}
                previous={baseTotal.arr}
                format={money}
                t={t}
              />
              <ComparisonCard
                label={t("roomPerformance.comparisonSection.cards.roomRevenue")}
                current={total.revenue}
                previous={baseTotal.revenue}
                format={money}
                t={t}
              />
            </div>
          </section>
        )}

        <section className="room-performance-panel">
          <header>
            <h2>{t("roomPerformance.dailyBreakdown.title")}</h2>
            <span>{t("roomPerformance.dailyBreakdown.subtitle")}</span>
          </header>
          <div className="room-performance-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("roomPerformance.dailyBreakdown.table.date")}</th>
                  <th>{t("roomPerformance.dailyBreakdown.table.physicalRooms")}</th>
                  <th>{t("roomPerformance.dailyBreakdown.table.availableRN")}</th>
                  <th>{t("roomPerformance.dailyBreakdown.table.soldRN")}</th>
                  <th>{t("roomPerformance.dailyBreakdown.table.occupancy")}</th>
                  <th>{t("roomPerformance.dailyBreakdown.table.arr")}</th>
                  <th>{t("roomPerformance.dailyBreakdown.table.roomRevenue")}</th>
                  <th>{t("roomPerformance.dailyBreakdown.table.status")}</th>
                </tr>
              </thead>
              <tbody>
                {daily.map((day) => (
                  <tr key={day.date}>
                    <td>
                      <strong>{dateLabel(day.date)}</strong>
                    </td>
                    <td>{totalRooms}</td>
                    <td>{day.available}</td>
                    <td>{day.sold}</td>
                    <td>{percent(day.occupancy)}</td>
                    <td>{money(day.arr)}</td>
                    <td>{money(day.revenue)}</td>
                    <td>{t("roomPerformance.dailyBreakdown.recorded")}</td>
                  </tr>
                ))}
                {daily.length === 0 && (
                  <tr>
                    <td colSpan={8} className="room-performance-empty">
                      {loading ? t("common.loading") : t("roomPerformance.dailyBreakdown.empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <p className="room-performance-note">
          {t("roomPerformance.note")}
        </p>
      </main>
    </AdminShell>
  );
}
