"use client";
import "../../dashboard/styles/dashboard.css";
import "../styles/reservations.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminShell } from "../../../components/layout/AdminShell";
import { Icon } from "../../../components/ui/Icon";
import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { restoreSession } from "../../../lib/auth";
import "../components/room-rack.css";
import { RoomRackReservationSummary } from "../components/RoomRackReservationSummary";
import { RoomRackCleaningModal } from "../components/RoomRackCleaningModal";
import { SaveReservationConfirmation } from "../components/SaveReservationConfirmation";
import { ReservationSuccessTransition } from "../components/ReservationSuccessTransition";
import { ReservationErrorToast } from "../components/ReservationErrorToast";
import {
  getReservationDetail,
  type ApiReservationDetail,
} from "../services/api";
import {
  RACK_DAYS,
  buildDateWindow,
  formatDayLabel,
  formatDateNumber,
  formatMonthLabel,
  formatRangeLabel,
  formatRupiah,
  isWeekend,
  sourceShort,
  toISODate,
  type Reservation,
  type RoomTypeGroup,
  type RoomUnit,
} from "../constants/room-rack-data";
import { formatStayDate } from "../constants/walk-in-data";
import {
  listPolicies,
  type PolicyRecord,
} from "../../cancellation-policies/services/cancellation-policies";
import {
  createReservation,
  getCreateCheckInContext,
  getReservationAvailability,
  getReservationExperiences,
  getReservationPaymentMethods,
  quoteReservation,
  type AvailableRoom,
  type ExperienceOption,
  type PaymentMethod,
  type ReservationQuote,
  type ReservationSource,
} from "../services/create";
import type { CheckInContext, EarlyCheckInInput } from "../services/api";
import {
  getRoomRack,
  summarizeRoomRack,
  toRoomRackGroups,
  type RoomRackResponse,
} from "../services/room-rack";
import { todayJakarta } from "../utils/stay-dates";
import { isValidGuestNik, normalizeGuestNik } from "../utils/guest-identity";
import { useTranslations, type Translate } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

const CHECKOUT_TIME = "12:00";
const CHECKIN_TIME = "14:00";

// Map a reservation status to a bar modifier, factoring in the room status
// (e.g. an in-house guest in a due-out room renders as the "due-out" style).
function barModifier(res: Reservation, room: RoomUnit): string {
  if (res.status === "maintenance") return "maintenance";
  if (res.status === "in-house" && room.status === "due-out") return "due-out";
  return res.status;
}

type BarGeom = { startIdx: number; span: number };

// Compute the position of a reservation within the 14-day window.
function barGeometry(res: Reservation, window: Date[]): BarGeom | null {
  const windowStart = window[0];
  const windowEnd = window[window.length - 1];
  const [ciY, ciM, ciD] = res.checkIn.split("-").map(Number);
  const [coY, coM, coD] = (res.displayCheckOut ?? res.checkOut)
    .split("-")
    .map(Number);
  const checkIn = new Date(ciY, ciM - 1, ciD);
  const checkOut = new Date(coY, coM - 1, coD);
  if (checkOut <= checkIn) return null;

  // A stay occupies nights from check-in up to (but not including) check-out.
  const lastNight = new Date(checkOut);
  lastNight.setDate(checkOut.getDate() - 1);

  if (lastNight < windowStart || checkIn > windowEnd) return null;

  const visibleStart = checkIn < windowStart ? windowStart : checkIn;
  const visibleEnd = lastNight > windowEnd ? windowEnd : lastNight;

  const startIdx = window.findIndex(
    (d) => toISODate(d) === toISODate(visibleStart),
  );
  const endIdx = window.findIndex(
    (d) => toISODate(d) === toISODate(visibleEnd),
  );
  if (startIdx === -1 || endIdx === -1) return null;

  return { startIdx, span: endIdx - startIdx + 1 };
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatHuman(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${formatDayLabel(date)}, ${formatDateNumber(date)} ${formatMonthLabel(date)} ${date.getFullYear()}`;
}

type Selected = {
  res: Reservation;
  room: RoomUnit | null;
  group: RoomTypeGroup;
};

type DragState = {
  roomNumber: string;
  groupName: string;
  startIdx: number;
  endIdx: number;
};

type NewBookingDraft = {
  roomTypeId: string;
  roomUnitId: string;
  roomNumber: string;
  roomBedType: string;
  roomFloor: string;
  groupName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
};

/** Check whether a given day index overlaps any existing reservation in the room. */
function isDayOccupied(
  room: RoomUnit,
  dayIdx: number,
  window: Date[],
): boolean {
  const dayISO = toISODate(window[dayIdx]);
  return room.reservations.some((res) => {
    if (res.reservationStatus === "checked_out") return false;
    const ci = res.checkIn;
    const [coY, coM, coD] = (res.displayCheckOut ?? res.checkOut)
      .split("-")
      .map(Number);
    const lastNight = new Date(coY, coM - 1, coD);
    lastNight.setDate(lastNight.getDate() - 1);
    const lastNightISO = toISODate(lastNight);
    return dayISO >= ci && dayISO <= lastNightISO;
  });
}

function isHeldForUnassigned(
  group: RoomTypeGroup,
  room: RoomUnit,
  dayIdx: number,
  window: Date[],
): boolean {
  if (isDayOccupied(room, dayIdx, window)) return false;

  const stayDate = toISODate(window[dayIdx]);
  const inventoryDay = group.inventory?.find(
    (day) => day.stayDate === stayDate,
  );
  if (inventoryDay) return inventoryDay.heldForUnassigned;
  const unassignedCount = group.unassignedReservations.filter(
    (reservation) =>
      reservation.checkIn <= stayDate && stayDate < reservation.checkOut,
  ).length;
  if (unassignedCount === 0) return false;

  const freeRoomCount = group.rooms.filter(
    (candidate) => !isDayOccupied(candidate, dayIdx, window),
  ).length;
  return freeRoomCount <= unassignedCount;
}

function isDayBookable(
  group: RoomTypeGroup,
  room: RoomUnit,
  dayIdx: number,
  window: Date[],
  todayISO: string,
): boolean {
  const stayDate = toISODate(window[dayIdx]);
  if (stayDate < todayISO) return false;
  const inventory = group.inventory?.find((day) => day.stayDate === stayDate);
  if (
    room.isActive === false ||
    room.status === "maintenance" ||
    room.status === "out_of_service" ||
    (stayDate <= todayISO &&
      room.status !== "vacant" &&
      room.status !== "reserved") ||
    (inventory &&
      (!inventory.isConfigured ||
        inventory.stopSell ||
        (inventory.availableRooms ?? 0) < 1))
  )
    return false;
  return (
    !isDayOccupied(room, dayIdx, window) &&
    !isHeldForUnassigned(group, room, dayIdx, window)
  );
}

function shiftDate(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function RoomRackPage() {
  const { t } = useTranslations({ en, id });
  const [startDate, setStartDate] = useState<string | null>(null);
  const [rack, setRack] = useState<RoomRackResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [detail, setDetail] = useState<ApiReservationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [roomTypeFilter, setRoomTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [miniView, setMiniView] = useState(true);
  const window = useMemo(
    () => (startDate ? buildDateWindow(startDate, RACK_DAYS) : []),
    [startDate],
  );
  const todayISO = rack?.serverDate ?? startDate ?? "";
  const roomTypeGroups = useMemo(
    () => (rack ? toRoomRackGroups(rack) : []),
    [rack],
  );
  const roomRackSummary = useMemo(
    () => (rack ? summarizeRoomRack(rack) : null),
    [rack],
  );

  useEffect(() => setStartDate(todayJakarta()), []);
  useEffect(() => {
    if (!startDate) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setRack(null);
    setSelected(null);
    setPending(null);
    setDrag(null);
    async function load() {
      try {
        if (!(await restoreSession())) return;
        const result = await getRoomRack(startDate!, controller.signal);
        if (!controller.signal.aborted) setRack(result);
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error ? cause.message : t("roomRack.loadError"),
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [startDate, refreshKey]);

  const [selected, setSelected] = useState<Selected | null>(null);
  const [search, setSearch] = useState("");
  const [drag, setDrag] = useState<DragState | null>(null);
  const [pending, setPending] = useState<NewBookingDraft | null>(null);
  const [booking, setBooking] = useState<NewBookingDraft | null>(null);
  const [cleaningRoom, setCleaningRoom] = useState<{
    id: string;
    number: string;
    groupName: string;
  } | null>(null);
  const isDragging = useRef(false);

  useEffect(() => {
    const reservationId = selected?.res.reservationId;
    if (!reservationId) {
      setDetail(null);
      setDetailError("");
      setDetailLoading(false);
      return;
    }
    const controller = new AbortController();
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    getReservationDetail(reservationId, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) setDetail(response);
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setDetailError(
            cause instanceof Error ? cause.message : t("detail.loadError"),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    return () => controller.abort();
  }, [selected?.res.reservationId]);

  async function onReservationUpdated(message: string) {
    setActionNotice(message);
    setSelected(null);
    setRefreshKey((value) => value + 1);
  }

  function openOverdueUnassigned(
    item: NonNullable<RoomRackResponse["overdueUnassigned"]>[number],
  ) {
    const group = roomTypeGroups.find(
      (candidate) => candidate.id === item.roomTypeId,
    );
    if (!group) return;
    const source =
      item.source === "walk_in"
        ? "Walk-in"
        : item.source === "phone"
          ? "Phone"
          : item.source === "website"
            ? "Website"
            : "OTA";
    setSelected({
      res: {
        id: item.bookingCode,
        reservationId: item.reservationId,
        reservationRoomId: item.reservationRoomId,
        guestName: item.guestName,
        source,
        status: "confirmed",
        reservationStatus: "confirmed",
        paymentStatus: item.paymentStatus,
        operationalStatus: {
          code: "missed_arrival",
          label: t("roomRack.missedArrival"),
        },
        checkIn: item.checkInDate,
        checkOut: item.checkOutDate,
      },
      room: null,
      group,
    });
  }

  const visibleGroups =
    roomTypeFilter === "all"
      ? roomTypeGroups
      : roomTypeGroups.filter((group) => group.id === roomTypeFilter);
  const matchesReservation = useCallback(
    (reservation: Reservation, roomNumber?: string) => {
      if (statusFilter !== "all" && reservation.status !== statusFilter)
        return false;
      if (sourceFilter !== "all") {
        const source = reservation.source.toLowerCase();
        if (
          sourceFilter === "ota"
            ? !source.startsWith("ota")
            : source !== sourceFilter
        )
          return false;
      }
      const term = search.trim().toLowerCase();
      return (
        !term ||
        reservation.guestName.toLowerCase().includes(term) ||
        reservation.id.toLowerCase().includes(term) ||
        roomNumber?.toLowerCase().includes(term) === true
      );
    },
    [search, sourceFilter, statusFilter],
  );

  /** Find room and group by room number. */
  const findRoom = useCallback(
    (roomNum: string) => {
      for (const g of roomTypeGroups) {
        const r = g.rooms.find((rm) => rm.number === roomNum);
        if (r) return { room: r, group: g };
      }
      return null;
    },
    [roomTypeGroups],
  );

  /** Start dragging from an empty day cell. */
  const handleDragStart = useCallback(
    (roomNumber: string, groupName: string, dayIdx: number) => {
      const found = findRoom(roomNumber);
      if (!found) return;
      if (!isDayBookable(found.group, found.room, dayIdx, window, todayISO))
        return;
      isDragging.current = true;
      // New drag clears old pending placeholder.
      setPending(null);
      setDrag({ roomNumber, groupName, startIdx: dayIdx, endIdx: dayIdx });
    },
    [findRoom, window, todayISO],
  );

  /** Extend drag selection as mouse moves. */
  const handleDragMove = useCallback(
    (dayIdx: number) => {
      if (!isDragging.current || !drag) return;
      const found = findRoom(drag.roomNumber);
      if (!found) return;
      const lo = Math.min(drag.startIdx, dayIdx);
      const hi = Math.max(drag.startIdx, dayIdx);
      for (let i = lo; i <= hi; i++) {
        if (!isDayBookable(found.group, found.room, i, window, todayISO))
          return;
      }
      setDrag((prev) => (prev ? { ...prev, endIdx: dayIdx } : null));
    },
    [drag, findRoom, window, todayISO],
  );

  /** End drag → create a pending placeholder (not the modal yet). */
  const handleDragEnd = useCallback(() => {
    if (!isDragging.current || !drag) {
      isDragging.current = false;
      setDrag(null);
      return;
    }
    isDragging.current = false;
    const lo = Math.min(drag.startIdx, drag.endIdx);
    const hi = Math.max(drag.startIdx, drag.endIdx);
    const nightsCount = hi - lo + 1;
    if (nightsCount >= 1) {
      const checkInDate = window[lo];
      const checkOutDate = new Date(window[hi]);
      checkOutDate.setDate(checkOutDate.getDate() + 1);
      const found = findRoom(drag.roomNumber);
      setPending({
        roomTypeId: found?.group.id ?? "",
        roomUnitId: found?.room.id ?? "",
        roomNumber: drag.roomNumber,
        roomBedType: found?.room.bedType ?? "",
        roomFloor: found?.room.floor ?? "",
        groupName: drag.groupName,
        checkIn: toISODate(checkInDate),
        checkOut: toISODate(checkOutDate),
        nights: nightsCount,
      });
    }
    setDrag(null);
  }, [drag, findRoom, window]);

  // Global mouseup to stop drag even when released outside the grid.
  useEffect(() => {
    const onGlobalUp = () => handleDragEnd();
    document.addEventListener("mouseup", onGlobalUp);
    return () => document.removeEventListener("mouseup", onGlobalUp);
  }, [handleDragEnd]);

  const metrics = [
    {
      key: "available",
      tone: "success",
      value: roomRackSummary?.availableRooms,
      label: t("roomRack.metrics.available"),
      glyph: "✓",
    },
    {
      key: "ready",
      tone: "warning",
      value: roomRackSummary?.readyToCheckIn,
      label: t("roomRack.metrics.ready"),
      glyph: "◷",
    },
    {
      key: "in-house",
      tone: "primary",
      value: roomRackSummary?.inHouse,
      label: t("roomRack.metrics.inHouse"),
      glyph: "●",
    },
    {
      key: "due-out",
      tone: "info",
      value: roomRackSummary?.dueOut,
      label: t("roomRack.metrics.dueOut"),
      glyph: "↩",
    },
    {
      key: "unavailable",
      tone: "maintenance",
      value: roomRackSummary?.unavailable,
      label: t("roomRack.metrics.unavailable"),
      glyph: "⚠",
    },
  ] as const;

  const rangeLabel = window.length
    ? formatRangeLabel(window[0], window[window.length - 1])
    : "—";

  return (
    <AdminShell title="Reservations" context="Room Rack">
      <div className={`room-rack${miniView ? " room-rack--mini" : ""}`}>
        {/* Heading */}
        <div className="room-rack__heading">
          <div>
            <span className="room-rack__eyebrow">FRONT DESK · TAPE CHART</span>
            <h1>Room Rack</h1>
            <p>
              Visual 14-day availability grid for arrivals, in-house stays, and
              blocks.
            </p>
          </div>
        </div>

        {/* Metrics */}
        {actionNotice && (
          <div className="rr-action-notice" role="status">
            {actionNotice}
          </div>
        )}
        {!miniView && (
          <div className="room-rack__metrics">
            {metrics.map((m) => (
              <div key={m.key} className={`rr-metric rr-metric--${m.tone}`}>
                <span className="rr-metric__icon" aria-hidden="true">
                  {m.glyph}
                </span>
                <div>
                  <div className="rr-metric__value">{m.value ?? "—"}</div>
                  <div className="rr-metric__label">{m.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Toolbar */}
        {!miniView && (
          <div className="room-rack__toolbar">
            <div className="rr-pager" role="group" aria-label="Date navigation">
              <button
                type="button"
                disabled={!startDate || loading}
                onClick={() =>
                  startDate && setStartDate(shiftDate(startDate, -RACK_DAYS))
                }
              >
                <Icon name="chevronLeft" width={14} height={14} />
                Prev 14 Days
              </button>
              <button
                type="button"
                className="rr-pager--today"
                onClick={() => {
                  setStartDate(todayJakarta());
                  setRefreshKey((value) => value + 1);
                }}
              >
                Today (
                {todayISO
                  ? formatDateNumber(buildDateWindow(todayISO, 1)[0])
                  : "—"}{" "}
                {todayISO
                  ? formatMonthLabel(buildDateWindow(todayISO, 1)[0])
                  : ""}
                )
              </button>
              <button
                type="button"
                disabled={!startDate || loading}
                onClick={() =>
                  startDate && setStartDate(shiftDate(startDate, RACK_DAYS))
                }
              >
                Next 14 Days
                <Icon name="chevronRight" width={14} height={14} />
              </button>
            </div>
            <span className="rr-range-label">{rangeLabel}</span>

            <span className="rr-toolbar-spacer" />

            <span className="rr-search">
              <Icon name="search" width={15} height={15} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search guest or RES#..."
                aria-label="Search guest or reservation number"
              />
            </span>
            <select
              aria-label="Filter room type"
              value={roomTypeFilter}
              onChange={(event) => setRoomTypeFilter(event.target.value)}
            >
              <option value="all">
                All Room Types ({roomTypeGroups.length})
              </option>
              {roomTypeGroups.map((g) => (
                <option key={g.id ?? g.name} value={g.id ?? g.name}>
                  {g.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="in-house">In-House</option>
              <option value="confirmed">Confirmed</option>
              <option value="awaiting-confirmation">
                Awaiting Confirmation
              </option>
              <option value="due-out">Due Out</option>
              <option value="overdue">Overdue</option>
              <option value="checked-out">Checked Out</option>
              <option value="maintenance">Maintenance</option>
            </select>
            <select
              aria-label="Filter source"
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
            >
              <option value="all">All Sources</option>
              <option value="walk-in">Walk-in</option>
              <option value="website">Website</option>
              <option value="ota">OTA</option>
              <option value="phone">Phone</option>
            </select>
            <button
              type="button"
              className="rr-refresh"
              disabled={loading}
              onClick={() => setRefreshKey((value) => value + 1)}
            >
              <Icon name="reset" width={15} height={15} />
              Refresh
            </button>
          </div>
        )}

        {/* Legend */}
        {!miniView && (
          <div className="room-rack__legend">
            <strong>Reservation</strong>
            <span className="rr-legend-item">
              <span className="rr-legend-swatch rr-legend-swatch--warning" />{" "}
              Upcoming / Ready to Check-in
            </span>
            <span className="rr-legend-item">
              <span className="rr-legend-swatch rr-legend-swatch--awaiting" />{" "}
              Awaiting Confirmation
            </span>
            <span className="rr-legend-item">
              <span className="rr-legend-swatch rr-legend-swatch--success" /> In
              House
            </span>
            <span className="rr-legend-item">
              <span className="rr-legend-swatch rr-legend-swatch--info" /> Due
              Out
            </span>
            <span className="rr-legend-item">
              <span className="rr-legend-swatch rr-legend-swatch--danger" />{" "}
              Overdue
            </span>
            <span className="rr-legend-item">
              <span className="rr-legend-swatch rr-legend-swatch--checked-out" />{" "}
              Checked Out
            </span>
            <span className="rr-legend-item">
              <span className="rr-legend-swatch rr-legend-swatch--unassigned" />{" "}
              Unassigned
            </span>
            <span className="rr-legend-divider" aria-hidden="true" />
            <strong>Room</strong>
            <span className="rr-legend-item">
              <span className="rr-legend-swatch rr-legend-swatch--available" />{" "}
              Available
            </span>
            <span className="rr-legend-item">
              <span className="rr-legend-swatch rr-legend-swatch--success" />{" "}
              Occupied
            </span>
            <span className="rr-legend-item">
              <span className="rr-legend-swatch rr-legend-swatch--cleaning" />{" "}
              Cleaning
            </span>
            <span className="rr-legend-item">
              <span className="rr-legend-swatch rr-legend-swatch--maintenance" />{" "}
              Maintenance
            </span>
            <span className="rr-legend-item">
              <span className="rr-legend-swatch rr-legend-swatch--danger" /> Out
              of Service
            </span>
          </div>
        )}

        {error && (
          <div className="rr-load-error" role="alert">
            {error}{" "}
            <button
              type="button"
              onClick={() => setRefreshKey((value) => value + 1)}
            >
              Try again
            </button>
          </div>
        )}

        {!miniView && !!rack?.overdueUnassigned?.length && (
          <section
            className="rr-overdue-unassigned"
            aria-labelledby="rr-overdue-unassigned-title"
          >
            <div className="rr-overdue-unassigned__heading">
              <h2 id="rr-overdue-unassigned-title">
                {t("roomRack.overdueUnassignedTitle")}
              </h2>
              <p>{t("roomRack.overdueUnassignedDescription")}</p>
            </div>
            <div className="rr-overdue-unassigned__list">
              {rack.overdueUnassigned.map((item) => (
                <button
                  key={`${item.reservationId}:${item.roomTypeId}`}
                  type="button"
                  onClick={() => openOverdueUnassigned(item)}
                >
                  <strong>
                    {item.bookingCode} · {item.guestName}
                  </strong>
                  <span>
                    {item.roomTypeName} ·{" "}
                    {t("roomRack.unassignedCount", {
                      count: item.unassignedRooms,
                    })}{" "}
                    · {item.checkInDate} → {item.checkOutDate}
                  </span>
                  <b>{t("roomRack.reviewReservation")}</b>
                </button>
              ))}
            </div>
            {rack.overdueUnassignedHasMore && (
              <p className="rr-overdue-unassigned__more">
                {t("roomRack.overdueUnassignedMore")}
              </p>
            )}
          </section>
        )}

        {/* Body: chart + detail */}
        <div
          className={
            selected
              ? "room-rack__body"
              : "room-rack__body room-rack__body--full"
          }
        >
          <div className="rr-chart" aria-busy={loading}>
            {loading && (
              <div className="rr-load-state">
                <LoadingSkeleton />
              </div>
            )}
            {!loading && !error && rack && (
              <div className="rr-chart__scroll">
                <div className="rr-grid">
                  {/* Header row */}
                  <div className="rr-head-cell rr-head-cell--room">
                    <div className="rr-head-cell__room-label">
                      <span className="rr-head-cell__eyebrow">Room</span>
                      <span className="rr-head-cell__title">Unit / Type</span>
                    </div>
                    <button
                      type="button"
                      className="rr-controls-toggle"
                      aria-pressed={miniView}
                      onClick={() => setMiniView((value) => !value)}
                    >
                      {miniView
                        ? t("roomRack.showControls")
                        : t("roomRack.hideControls")}
                    </button>
                  </div>
                  {window.map((date) => {
                    const iso = toISODate(date);
                    const classes = [
                      "rr-head-cell",
                      isWeekend(date) ? "rr-head-cell--weekend" : "",
                      iso === todayISO ? "rr-head-cell--today" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");
                    return (
                      <div key={iso} className={classes}>
                        <div className="rr-head-cell__day">
                          {formatDayLabel(date)}
                        </div>
                        <div className="rr-head-cell__num">
                          {formatDateNumber(date)}
                        </div>
                        <div className="rr-head-cell__mon">
                          {formatMonthLabel(date)}
                        </div>
                      </div>
                    );
                  })}

                  {/* Groups */}
                  {visibleGroups.map((group) => (
                    <RoomGroup
                      key={group.id ?? group.name}
                      t={t}
                      group={group}
                      window={window}
                      todayISO={todayISO}
                      selectedId={
                        selected?.res.reservationRoomId ??
                        selected?.res.id ??
                        null
                      }
                      onSelect={(res, room) =>
                        setSelected({ res, room, group })
                      }
                      matchesReservation={matchesReservation}
                      drag={drag}
                      onDragStart={handleDragStart}
                      onDragMove={handleDragMove}
                      onDragEnd={handleDragEnd}
                      pending={pending}
                      onPendingClick={(draft) => setBooking(draft)}
                      onCleaningClick={(room) => {
                        if (room.id)
                          setCleaningRoom({
                            id: room.id,
                            number: room.number,
                            groupName: group.name,
                          });
                      }}
                    />
                  ))}
                  {visibleGroups.length === 0 && (
                    <div className="rr-empty-state">No room types found.</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {selected && (
            <RoomRackReservationSummary
              reservation={selected.res}
              room={selected.room}
              group={selected.group}
              todayISO={todayISO}
              detail={
                detail?.reservation.id === selected.res.reservationId
                  ? detail
                  : null
              }
              loading={detailLoading}
              error={detailError}
              onUpdated={onReservationUpdated}
              onClose={() => setSelected(null)}
            />
          )}
        </div>

        {/* Drag-to-create booking form */}
        {booking && (
          <NewBookingForm
            draft={booking}
            onClose={() => setBooking(null)}
            onComplete={() => {
              setBooking(null);
              setPending(null);
              setRefreshKey((value) => value + 1);
            }}
          />
        )}
        {cleaningRoom && (
          <RoomRackCleaningModal
            room={cleaningRoom}
            onClose={() => setCleaningRoom(null)}
            onSaved={() => {
              setCleaningRoom(null);
              setActionNotice(
                t("roomRack.roomNowAvailable", { room: cleaningRoom.number }),
              );
              setRefreshKey((value) => value + 1);
            }}
          />
        )}
      </div>
    </AdminShell>
  );
}

function RoomGroup({
  t,
  group,
  window,
  todayISO,
  selectedId,
  onSelect,
  matchesReservation,
  drag,
  onDragStart,
  onDragMove,
  onDragEnd,
  pending,
  onPendingClick,
  onCleaningClick,
}: {
  t: Translate;
  group: RoomTypeGroup;
  window: Date[];
  todayISO: string;
  selectedId: string | null;
  onSelect: (res: Reservation, room: RoomUnit | null) => void;
  matchesReservation: (res: Reservation, roomNumber?: string) => boolean;
  drag: DragState | null;
  onDragStart: (roomNumber: string, groupName: string, dayIdx: number) => void;
  onDragMove: (dayIdx: number) => void;
  onDragEnd: () => void;
  pending: NewBookingDraft | null;
  onPendingClick: (draft: NewBookingDraft) => void;
  onCleaningClick: (room: RoomUnit) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const unassignedByBooking = new Map<string, Reservation[]>();
  for (const reservation of group.unassignedReservations.filter((item) =>
    matchesReservation(item),
  )) {
    const key = reservation.reservationId ?? reservation.id;
    const rooms = unassignedByBooking.get(key) ?? [];
    rooms.push(reservation);
    unassignedByBooking.set(key, rooms);
  }

  return (
    <>
      {/* Category header */}
      <div className="rr-cat-cell">
        <div className="rr-cat-cell__label">
          <button
            type="button"
            className="rr-cat-cell__toggle"
            aria-expanded={!collapsed}
            aria-label={`${collapsed ? "Expand" : "Minimize"} ${group.name}`}
            onClick={() => setCollapsed((current) => !current)}
          >
            <span
              className={`rr-cat-cell__chevron${collapsed ? " rr-cat-cell__chevron--collapsed" : ""}`}
              aria-hidden="true"
            />
            <span>{group.name}</span>
            <span className="rr-cat-cell__count">{group.unitCount} units</span>
          </button>
        </div>
        {window.map((date, i) => {
          const iso = toISODate(date);
          const classes = [
            "rr-cat-cell__rate",
            isWeekend(date) ? "rr-cat-cell__rate--weekend" : "",
            iso === todayISO ? "rr-cat-cell__rate--today" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div key={iso} className={classes}>
              {group.dailyRates[i] == null
                ? "—"
                : formatRupiah(group.dailyRates[i])}
            </div>
          );
        })}
      </div>

      {/* Rooms */}
      {group.rooms.map((room) => {
        // Calculate drag highlight range for this room.
        const dragLo =
          drag && drag.roomNumber === room.number
            ? Math.min(drag.startIdx, drag.endIdx)
            : -1;
        const dragHi =
          drag && drag.roomNumber === room.number
            ? Math.max(drag.startIdx, drag.endIdx)
            : -1;

        return (
          <div
            className={`rr-room-row${collapsed ? " rr-room-row--collapsed" : ""}`}
            key={room.number}
            style={{ display: "contents" }}
            aria-hidden={collapsed}
            inert={collapsed}
          >
            <div className="rr-room-cell">
              <div className="rr-room-cell__top">
                <span className="rr-room-cell__num">{room.number}</span>
                <span className="rr-room-cell__bed">{room.bedType}</span>
              </div>
              <span className="rr-room-cell__floor">{room.floor}</span>
            </div>

            <div className="rr-lane">
              {window.map((date, dayIdx) => {
                const iso = toISODate(date);
                const isDragHighlight = dayIdx >= dragLo && dayIdx <= dragHi;
                const heldForUnassigned = isHeldForUnassigned(
                  group,
                  room,
                  dayIdx,
                  window,
                );
                const cleaningToday =
                  room.status === "cleaning" && iso === todayISO;
                const bookable = isDayBookable(
                  group,
                  room,
                  dayIdx,
                  window,
                  todayISO,
                );
                const classes = [
                  "rr-day-cell",
                  isWeekend(date) ? "rr-day-cell--weekend" : "",
                  iso === todayISO ? "rr-day-cell--today" : "",
                  isDragHighlight ? "rr-day-cell--drag" : "",
                  heldForUnassigned ? "rr-day-cell--held" : "",
                  cleaningToday ? "rr-day-cell--cleaning" : "",
                  !bookable ? "rr-day-cell--unavailable" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <div
                    key={iso}
                    className={classes}
                    title={
                      cleaningToday && heldForUnassigned
                        ? "Cleaning · Held for Unassigned. Kamar belum siap dan dialokasikan untuk reservasi tanpa nomor kamar."
                        : cleaningToday
                          ? "Cleaning. Kamar belum siap dipakai."
                          : heldForUnassigned
                            ? "Kamar tersisa dialokasikan untuk reservasi Unassigned"
                            : undefined
                    }
                    onMouseDown={(e) => {
                      if (!bookable) return;
                      e.preventDefault();
                      onDragStart(room.number, group.name, dayIdx);
                    }}
                    onMouseEnter={() => onDragMove(dayIdx)}
                    onMouseUp={onDragEnd}
                  >
                    {cleaningToday && room.id && (
                      <button
                        type="button"
                        className="rr-day-cell__cleaning"
                        aria-label={`Room ${room.number} Cleaning. Ubah menjadi Available`}
                        onClick={() => onCleaningClick(room)}
                      >
                        Cleaning
                      </button>
                    )}
                    {heldForUnassigned &&
                      !isDayOccupied(room, dayIdx, window) && (
                        <span className="rr-day-cell__held">
                          Held for
                          <br />
                          Unassigned
                        </span>
                      )}
                    {!isDragHighlight && bookable && (
                      <span className="rr-day-cell__add" aria-hidden="true">
                        <Icon name="plus" width={14} height={14} />
                      </span>
                    )}
                    {isDragHighlight && (
                      <span
                        className="rr-day-cell__drag-label"
                        aria-hidden="true"
                      >
                        {dayIdx === dragLo ? `${dragHi - dragLo + 1}N` : ""}
                      </span>
                    )}
                  </div>
                );
              })}

              {room.reservations
                .filter((res) => matchesReservation(res, room.number))
                .map((res) => {
                  const geom = barGeometry(res, window);
                  if (!geom) return null;
                  const modifier = barModifier(res, room);
                  const isMaintenance = modifier === "maintenance";
                  const style = {
                    left: `calc(${geom.startIdx} * var(--rr-day-col) + 3px)`,
                    width: `calc(${geom.span} * var(--rr-day-col) - 6px)`,
                  } as const;
                  return (
                    <button
                      type="button"
                      key={res.reservationRoomId ?? res.id}
                      className={[
                        "rr-bar",
                        `rr-bar--${modifier}`,
                        selectedId === (res.reservationRoomId ?? res.id)
                          ? "rr-bar--selected"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={style}
                      onClick={() => {
                        if (!isMaintenance) onSelect(res, room);
                      }}
                      aria-label={`${res.guestName} ${res.checkIn} to ${res.checkOut}`}
                    >
                      <span className="rr-bar__name">{res.guestName}</span>
                      <span className="rr-bar__meta">
                        {isMaintenance ? (
                          <>
                            {res.maintenanceNote ??
                              room.maintenanceNote ??
                              "Blocked"}
                          </>
                        ) : (
                          <>
                            {sourceShort[res.source] ?? res.source}
                            {modifier === "due-out" && (
                              <span className="rr-bar__badge">
                                out {CHECKOUT_TIME}
                              </span>
                            )}
                          </>
                        )}
                      </span>
                    </button>
                  );
                })}

              {/* Pending placeholder bar from drag-to-create */}
              {pending &&
                pending.roomNumber === room.number &&
                (() => {
                  const ciIdx = window.findIndex(
                    (d) => toISODate(d) === pending.checkIn,
                  );
                  if (ciIdx === -1) return null;
                  const span = pending.nights;
                  const style = {
                    left: `calc(${ciIdx} * var(--rr-day-col) + 3px)`,
                    width: `calc(${span} * var(--rr-day-col) - 6px)`,
                  };
                  return (
                    <button
                      type="button"
                      className="rr-bar rr-bar--pending"
                      style={style}
                      onClick={() => onPendingClick(pending)}
                      aria-label={`New booking: Room ${pending.roomNumber}, ${pending.nights} night(s). Click to fill details.`}
                    >
                      <span className="rr-bar__name">+ New Reservation</span>
                      <span className="rr-bar__meta">
                        {pending.nights}N · Click to fill details
                      </span>
                    </button>
                  );
                })()}
            </div>
          </div>
        );
      })}
      {[...unassignedByBooking].map(([bookingKey, rooms]) => {
        const reservation = rooms[0];
        const geometry = barGeometry(reservation, window);
        if (!geometry) return null;
        return (
          <div
            key={bookingKey}
            className={`rr-room-row${collapsed ? " rr-room-row--collapsed" : ""}`}
            style={{ display: "contents" }}
            aria-hidden={collapsed}
            inert={collapsed}
          >
            <div className="rr-room-cell rr-room-cell--unassigned">
              <div className="rr-room-cell__top">
                <span className="rr-room-cell__num">
                  {t("roomRack.unassignedLabel")}
                </span>
                <span className="rr-room-cell__unassigned-count">
                  {rooms.length}
                </span>
              </div>
              <span className="rr-room-cell__floor">{reservation.id}</span>
            </div>
            <div className="rr-lane rr-lane--unassigned">
              {window.map((date) => (
                <div
                  key={toISODate(date)}
                  className={`rr-day-cell${isWeekend(date) ? " rr-day-cell--weekend" : ""}${toISODate(date) === todayISO ? " rr-day-cell--today" : ""}`}
                />
              ))}
              <button
                type="button"
                className={`rr-bar rr-bar--${reservation.status} rr-bar--unassigned${rooms.some((room) => selectedId === (room.reservationRoomId ?? room.id)) ? " rr-bar--selected" : ""}`}
                style={{
                  left: `calc(${geometry.startIdx} * var(--rr-day-col) + 3px)`,
                  width: `calc(${geometry.span} * var(--rr-day-col) - 6px)`,
                }}
                onClick={() => onSelect(reservation, null)}
                aria-label={t("roomRack.unassignedAria", {
                  guest: reservation.guestName,
                  count: rooms.length,
                  checkIn: reservation.checkIn,
                  checkOut: reservation.checkOut,
                })}
              >
                <span className="rr-bar__name">{reservation.guestName}</span>
                <span className="rr-bar__meta">
                  {sourceShort[reservation.source] ?? reservation.source} ·{" "}
                  {t("roomRack.unassignedCount", { count: rooms.length })}
                </span>
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}

function NewBookingForm({
  draft,
  onClose,
  onComplete,
}: {
  draft: NewBookingDraft;
  onClose: () => void;
  onComplete: () => void;
}) {
  const { t } = useTranslations({ en, id });
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [extraBed, setExtraBed] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestNik, setGuestNik] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [guestNotes, setGuestNotes] = useState("");
  const [source, setSource] = useState<ReservationSource>(
    draft.checkIn === todayJakarta() ? "walk_in" : "phone",
  );
  const [addons, setAddons] = useState<
    { variantId: string; quantity: number }[]
  >([]);
  const [addingAddon, setAddingAddon] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<
    "Unpaid" | "Partial" | "Paid"
  >("Unpaid");
  const [amountPaid, setAmountPaid] = useState(0);
  const [requireDeposit, setRequireDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState(500000);
  const [depositMethod, setDepositMethod] = useState("");
  const [depositNote, setDepositNote] = useState("");
  const [availability, setAvailability] = useState<AvailableRoom | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [experiences, setExperiences] = useState<ExperienceOption[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [policies, setPolicies] = useState<PolicyRecord[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState("");
  const [quote, setQuote] = useState<ReservationQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [validationMode, setValidationMode] = useState<
    "save" | "check-in" | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [confirmation, setConfirmation] = useState<"save" | "check-in" | null>(
    null,
  );
  const [acknowledged, setAcknowledged] = useState(false);
  const [checkInContext, setCheckInContext] = useState<CheckInContext | null>(
    null,
  );
  const [earlyCheckIn, setEarlyCheckIn] = useState<EarlyCheckInInput>({
    acknowledged: false,
    chargeAmount: 0,
    paymentTiming: "later",
  });
  const [saved, setSaved] = useState<{
    bookingId: string;
    checkedIn: boolean;
  } | null>(null);
  const requestKey = useRef<{ body: string; key: string } | null>(null);

  const variants = experiences.flatMap((experience) =>
    experience.variants.map((variant) => ({
      ...variant,
      label: `${experience.name} · ${variant.subName}`,
    })),
  );
  const selectedRoom = {
    roomTypeId: draft.roomTypeId,
    roomUnitId: draft.roomUnitId,
    adults,
    children,
    extraBeds: extraBed ? 1 : 0,
  };
  const roomReady = Boolean(
    availability?.bookable &&
    availability.assignableRoomUnits.some(
      (room) => room.id === draft.roomUnitId,
    ),
  );
  const total = quote?.bookingTotal ?? 0;
  const amountCollected =
    paymentStatus === "Paid"
      ? total
      : paymentStatus === "Partial"
        ? amountPaid
        : 0;
  const remaining = Math.max(0, total - amountCollected);
  const roomCharge =
    (quote?.charges.rooms[0]?.roomAmount ?? 0) + (quote?.discountTotal ?? 0);
  const extraBedCharge = quote?.charges.extraBedTotal ?? 0;
  const roomDiscount = quote?.discountTotal ?? 0;
  const lastStayDate = shiftDate(draft.checkOut, -1);
  const applicablePolicies = policies.filter(
    (policy) =>
      (!policy.stayStart || policy.stayStart <= draft.checkIn) &&
      (!policy.stayEnd || policy.stayEnd >= lastStayDate) &&
      (policy.roomTypes.length === 0 ||
        policy.roomTypes.some((room) => room.id === draft.roomTypeId)),
  );
  const policyId = applicablePolicies.some(
    (policy) => policy.id === selectedPolicyId,
  )
    ? selectedPolicyId
    : (applicablePolicies[0]?.id ?? "");
  const activePolicy = applicablePolicies.find(
    (policy) => policy.id === policyId,
  );

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setAvailabilityLoading(true);
      try {
        if (!(await restoreSession())) return;
        const [available, experienceResult, methodResult] = await Promise.all([
          getReservationAvailability(
            draft.checkIn,
            draft.checkOut,
            controller.signal,
          ),
          getReservationExperiences(controller.signal),
          getReservationPaymentMethods(controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setAvailability(
          available.items.find(
            (item) => item.roomType.id === draft.roomTypeId,
          ) ?? null,
        );
        setExperiences(experienceResult.items);
        setMethods(methodResult.items.filter((item) => item.isActive));
      } catch (cause) {
        if (!controller.signal.aborted)
          setFeedback(
            cause instanceof Error
              ? cause.message
              : "Pilihan reservasi gagal dimuat.",
          );
      } finally {
        if (!controller.signal.aborted) setAvailabilityLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [draft.checkIn, draft.checkOut, draft.roomTypeId]);

  useEffect(() => {
    if (source !== "phone") return;
    const controller = new AbortController();
    const query = new URLSearchParams({
      source: "phone",
      isActive: "true",
      limit: "100",
    });
    listPolicies(query, controller.signal)
      .then(async (response) => {
        const pages = await Promise.all(
          Array.from(
            { length: Math.ceil(response.total / response.limit) - 1 },
            (_, index) => {
              const pageQuery = new URLSearchParams(query);
              pageQuery.set("page", String(index + 2));
              return listPolicies(pageQuery, controller.signal);
            },
          ),
        );
        if (!controller.signal.aborted)
          setPolicies([response, ...pages].flatMap((page) => page.items));
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setFeedback(
            cause instanceof Error
              ? cause.message
              : "Kebijakan pembatalan gagal dimuat.",
          );
      });
    return () => controller.abort();
  }, [source]);

  useEffect(() => {
    setQuote(null);
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setQuoteLoading(true);
      quoteReservation(
        source,
        {
          checkInDate: draft.checkIn,
          checkOutDate: draft.checkOut,
          totalAdults: adults,
          totalChildren: children,
          rooms: [selectedRoom],
          experiences: addons,
        },
        controller.signal,
      )
        .then((response) => {
          if (!controller.signal.aborted) {
            setQuote(response);
            setFeedback("");
          }
        })
        .catch((cause) => {
          if (!controller.signal.aborted)
            setFeedback(
              cause instanceof Error
                ? cause.message
                : "Quote reservasi gagal dihitung.",
            );
        })
        .finally(() => {
          if (!controller.signal.aborted) setQuoteLoading(false);
        });
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    source,
    draft.checkIn,
    draft.checkOut,
    draft.roomTypeId,
    draft.roomUnitId,
    adults,
    children,
    extraBed,
    addons,
  ]);

  async function requestSave(checkInGuest: boolean) {
    if (saving) return;
    setValidationMode(checkInGuest ? "check-in" : "save");
    if (!draft.roomTypeId || !draft.roomUnitId || !roomReady) {
      setFeedback(
        "Nomor kamar ini tidak tersedia. Muat ulang Room Rack dan pilih kamar lain.",
      );
      return;
    }
    if (source === "walk_in" && draft.checkIn !== todayJakarta()) {
      setFeedback(
        "Walk-in hanya tersedia untuk check-in hari ini. Pilih Phone untuk tanggal mendatang.",
      );
      return;
    }
    if (checkInGuest && draft.checkIn !== todayJakarta()) {
      setFeedback("Check-in hanya tersedia pada tanggal check-in hari ini.");
      return;
    }
    if (!guestName.trim() || !phone.trim()) {
      setFeedback("Nama dan nomor WhatsApp tamu wajib diisi.");
      return;
    }
    if (checkInGuest && !isValidGuestNik(guestNik)) {
      setFeedback(
        "NIK tamu pemesan wajib diisi dengan 16 digit sebelum check-in.",
      );
      return;
    }
    if (!quote || quoteLoading) {
      setFeedback("Tunggu quote reservasi dari API selesai.");
      return;
    }
    if (
      paymentStatus === "Partial" &&
      (amountPaid < 1 || amountPaid >= total)
    ) {
      setFeedback(
        "Pembayaran partial harus lebih dari Rp0 dan kurang dari total reservasi.",
      );
      return;
    }
    if (amountCollected > 0 && !paymentMethod) {
      setFeedback("Pilih metode pembayaran.");
      return;
    }
    if (requireDeposit && (depositAmount < 1 || !depositMethod)) {
      setFeedback("Isi nominal dan metode deposit.");
      return;
    }
    setFeedback("");
    setAcknowledged(false);
    setCheckInContext(null);
    setEarlyCheckIn({
      acknowledged: false,
      chargeAmount: 0,
      paymentTiming: "later",
    });
    if (checkInGuest) {
      try {
        setCheckInContext(await getCreateCheckInContext(draft.checkIn));
      } catch (cause) {
        setFeedback(
          cause instanceof Error ? cause.message : "Jam check-in gagal dimuat.",
        );
        return;
      }
    }
    setConfirmation(checkInGuest ? "check-in" : "save");
  }

  async function submit() {
    if (!confirmation || !quote || saving) return;
    const checkInGuest = confirmation === "check-in";
    const payload = {
      guest: {
        fullName: guestName.trim(),
        ...(guestNik ? { nik: guestNik } : {}),
        phone: phone.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
      },
      checkInDate: draft.checkIn,
      checkOutDate: draft.checkOut,
      totalAdults: adults,
      totalChildren: children,
      rooms: [
        {
          ...selectedRoom,
          ...(source === "phone"
            ? { cancellationPolicyId: policyId || null }
            : {}),
        },
      ],
      experiences: addons,
      ...(guestNotes.trim() ? { specialRequests: guestNotes.trim() } : {}),
      confirm: checkInGuest,
      checkIn: checkInGuest,
      acknowledgeOutstanding: checkInGuest && remaining > 0,
      ...(checkInGuest && checkInContext?.required ? { earlyCheckIn } : {}),
      ...(amountCollected > 0
        ? { payment: { methodId: paymentMethod, amount: amountCollected } }
        : {}),
      ...(requireDeposit
        ? {
            deposit: {
              methodId: depositMethod,
              amount: depositAmount,
              notes: depositNote.trim(),
            },
          }
        : {}),
    };
    const body = JSON.stringify({ source, ...payload });
    if (requestKey.current?.body !== body)
      requestKey.current = { body, key: crypto.randomUUID() };
    setSaving(true);
    setFeedback("");
    try {
      const result = await createReservation(source, {
        idempotencyKey: requestKey.current.key,
        ...payload,
      });
      setConfirmation(null);
      setSaved({
        bookingId: result.reservation.bookingCode,
        checkedIn: checkInGuest,
      });
      requestKey.current = null;
    } catch (cause) {
      setFeedback(
        cause instanceof Error ? cause.message : "Reservasi gagal disimpan.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="rr-drawer-overlay"
      onClick={(event) => {
        if (
          event.target === event.currentTarget &&
          !saving &&
          !confirmation &&
          !saved
        )
          onClose();
      }}
    >
      {feedback && (
        <ReservationErrorToast
          message={feedback}
          title={t("common.errorToastTitle")}
          closeLabel={t("common.closeMessage")}
          onClose={() => setFeedback("")}
        />
      )}
      <aside
        className="rr-drawer"
        onClick={(e) => e.stopPropagation()}
        aria-label="New Reservation"
      >
        {/* Header */}
        <div className="rr-drawer__header">
          <div>
            <h2>New Reservation</h2>
            <span className="rr-drawer__sub">Room Rack · Drag-to-Book</span>
          </div>
          <button
            type="button"
            className="rr-detail__close"
            onClick={onClose}
            disabled={saving || Boolean(confirmation) || Boolean(saved)}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Scrollable body: form + summary */}
        <div className="rr-drawer__body">
          {/* LEFT: Form sections */}
          <div className="rr-drawer__form">
            {/* Source */}
            <section className="rr-drawer-section">
              <h3>Reservation Source</h3>
              <div className="rr-drawer-tabs">
                <button
                  type="button"
                  className={
                    source === "walk_in"
                      ? "rr-drawer-tab rr-drawer-tab--active"
                      : "rr-drawer-tab"
                  }
                  disabled={draft.checkIn !== todayJakarta()}
                  onClick={() => setSource("walk_in")}
                >
                  Walk-in
                </button>
                <button
                  type="button"
                  className={
                    source === "phone"
                      ? "rr-drawer-tab rr-drawer-tab--active"
                      : "rr-drawer-tab"
                  }
                  onClick={() => setSource("phone")}
                >
                  Phone
                </button>
              </div>
            </section>

            {/* Stay */}
            <section className="rr-drawer-section">
              <div className="rr-drawer-section__head">
                <h3>Stay</h3>
                <span className="rr-drawer-badge">
                  {draft.nights} {draft.nights === 1 ? "night" : "nights"}
                </span>
              </div>
              <div className="rr-drawer-dates">
                <div className="rr-drawer-date-col">
                  <label>Check-In</label>
                  <strong>{formatHuman(draft.checkIn)}</strong>
                  <span>{CHECKIN_TIME}</span>
                </div>
                <span className="rr-drawer-arrow">→</span>
                <div className="rr-drawer-date-col">
                  <label>Check-Out</label>
                  <strong>{formatHuman(draft.checkOut)}</strong>
                  <span>{CHECKOUT_TIME}</span>
                </div>
              </div>
              {/* Room + guests */}
              <div className="rr-drawer-room-block">
                <div className="rr-drawer-room-info">
                  <strong>Room {draft.roomNumber}</strong>
                  <span>
                    {draft.groupName} · {draft.roomBedType} · {draft.roomFloor}
                  </span>
                </div>
                <div className="rr-drawer-fields rr-drawer-fields--3col">
                  <div className="rr-drawer-field">
                    <label htmlFor="rr-adults">Adults</label>
                    <select
                      id="rr-adults"
                      value={adults}
                      onChange={(e) => setAdults(Number(e.target.value))}
                    >
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="rr-drawer-field">
                    <label htmlFor="rr-children">Children</label>
                    <select
                      id="rr-children"
                      value={children}
                      onChange={(e) => setChildren(Number(e.target.value))}
                    >
                      {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="rr-drawer-field">
                    <label htmlFor="rr-extra-bed">Extra Bed</label>
                    <select
                      id="rr-extra-bed"
                      value={extraBed ? "1" : "0"}
                      onChange={(e) => setExtraBed(e.target.value === "1")}
                    >
                      <option value="0">No</option>
                      <option
                        value="1"
                        disabled={!availability?.roomType.extraBedEnabled}
                      >
                        Yes (+
                        {formatRupiah(
                          availability?.roomType.extraBedPricePerNight ?? 0,
                        )}
                        /night)
                      </option>
                    </select>
                  </div>
                </div>
              </div>
            </section>

            {source === "phone" && (
              <section className="rr-drawer-section">
                <h3>Cancellation Policy</h3>
                <div className="rr-drawer-field">
                  <label htmlFor="rr-policy">
                    Policy for {draft.groupName}
                  </label>
                  <select
                    id="rr-policy"
                    value={policyId}
                    onChange={(event) =>
                      setSelectedPolicyId(event.target.value)
                    }
                  >
                    {applicablePolicies.length === 0 && (
                      <option value="">
                        100% cancellation charge · Non-refundable
                      </option>
                    )}
                    {applicablePolicies.map((policy) => (
                      <option key={policy.id} value={policy.id}>
                        {policy.name}
                      </option>
                    ))}
                  </select>
                  {activePolicy && (
                    <div className="rr-drawer-policy-rules">
                      {activePolicy.rules.map((rule) => (
                        <p key={rule.id}>
                          {rule.timingType === "more_than"
                            ? "Lebih dari"
                            : "Dalam"}{" "}
                          {rule.daysBefore} hari sebelum check-in:{" "}
                          {rule.chargeType === "percentage"
                            ? `${rule.chargeValue}%`
                            : rule.chargeType === "fixed"
                              ? formatRupiah(rule.chargeValue)
                              : `${rule.chargeValue} malam`}{" "}
                          biaya pembatalan.
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Guest Information */}
            <section className="rr-drawer-section">
              <h3>Guest Information</h3>
              <div className="rr-drawer-fields">
                <div className="rr-drawer-field">
                  <label htmlFor="rr-guest-name">
                    Full Name <span className="rr-required">*</span>
                  </label>
                  <input
                    id="rr-guest-name"
                    autoFocus
                    aria-invalid={
                      validationMode !== null && !guestName.trim()
                    }
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Guest full name"
                  />
                </div>
                <div className="rr-drawer-field">
                  <label htmlFor="rr-phone">
                    WhatsApp <span className="rr-required">*</span>
                  </label>
                  <input
                    id="rr-phone"
                    type="tel"
                    aria-invalid={validationMode !== null && !phone.trim()}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+62 812-xxxx-xxxx"
                  />
                </div>
                <div className="rr-drawer-field">
                  <label htmlFor="rr-guest-nik">
                    NIK{" "}
                    <span className="rr-optional">(Wajib saat check-in)</span>
                  </label>
                  <input
                    id="rr-guest-nik"
                    inputMode="numeric"
                    aria-invalid={
                      validationMode === "check-in" &&
                      !isValidGuestNik(guestNik)
                    }
                    autoComplete="off"
                    maxLength={16}
                    value={guestNik}
                    onChange={(event) =>
                      setGuestNik(normalizeGuestNik(event.target.value))
                    }
                    placeholder="3200xxxxxxxxxxxx"
                  />
                </div>
                <div className="rr-drawer-field">
                  <label htmlFor="rr-email">
                    Email <span className="rr-optional">(Optional)</span>
                  </label>
                  <input
                    id="rr-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="guest@example.com"
                  />
                </div>
                <div className="rr-drawer-field">
                  <label htmlFor="rr-notes">
                    Special Requests{" "}
                    <span className="rr-optional">(Optional)</span>
                  </label>
                  <textarea
                    id="rr-notes"
                    rows={2}
                    value={guestNotes}
                    onChange={(e) => setGuestNotes(e.target.value)}
                    placeholder="Extra pillows, late check-in, etc."
                  />
                </div>
              </div>
            </section>

            {/* Experiences & Add-ons */}
            <section className="rr-drawer-section">
              <div className="rr-drawer-section__head">
                <h3>Experiences &amp; Add-ons</h3>
                <button
                  type="button"
                  className="rr-drawer-add-btn"
                  onClick={() => setAddingAddon((v) => !v)}
                >
                  ＋ Add
                </button>
              </div>
              {addingAddon && (
                <div className="rr-drawer-field">
                  <label htmlFor="rr-addon-pick">Pilih add-on</label>
                  <select
                    id="rr-addon-pick"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        setAddons((prev) => [
                          ...prev,
                          { variantId: e.target.value, quantity: 1 },
                        ]);
                      }
                      setAddingAddon(false);
                    }}
                  >
                    <option value="">Pilih paket</option>
                    {variants
                      .filter(
                        (variant) =>
                          !addons.some((item) => item.variantId === variant.id),
                      )
                      .map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {variant.label} · {formatRupiah(variant.price)}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              <div className="rr-drawer-addons">
                {addons.map((item) => {
                  const opt = variants.find(
                    (variant) => variant.id === item.variantId,
                  );
                  if (!opt) return null;
                  const cost =
                    quote?.charges.experiences.find(
                      (charge) => charge.variantId === item.variantId,
                    )?.amount ?? opt.price * item.quantity;
                  return (
                    <div className="rr-drawer-addon" key={item.variantId}>
                      <div className="rr-drawer-addon__info">
                        <strong>{opt.label}</strong>
                        <small>{formatRupiah(opt.price)} / package</small>
                      </div>
                      <div className="rr-drawer-addon__controls">
                        <div className="rr-drawer-qty">
                          <button
                            type="button"
                            onClick={() =>
                              setAddons((prev) =>
                                prev.map((a) =>
                                  a.variantId === item.variantId
                                    ? {
                                        ...a,
                                        quantity: Math.max(1, a.quantity - 1),
                                      }
                                    : a,
                                ),
                              )
                            }
                          >
                            −
                          </button>
                          <span>{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setAddons((prev) =>
                                prev.map((a) =>
                                  a.variantId === item.variantId
                                    ? {
                                        ...a,
                                        quantity: Math.min(20, a.quantity + 1),
                                      }
                                    : a,
                                ),
                              )
                            }
                          >
                            +
                          </button>
                        </div>
                        <strong className="rr-drawer-addon__total">
                          {formatRupiah(cost)}
                        </strong>
                        <button
                          type="button"
                          className="rr-drawer-addon__remove"
                          aria-label={`Hapus ${opt.label}`}
                          onClick={() =>
                            setAddons((prev) =>
                              prev.filter(
                                (a) => a.variantId !== item.variantId,
                              ),
                            )
                          }
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
                {addons.length === 0 && (
                  <p className="rr-drawer-empty">Belum ada add-on.</p>
                )}
              </div>
            </section>

            {/* Payment */}
            <section className="rr-drawer-section">
              <h3>Payment</h3>
              <div className="rr-drawer-fields rr-drawer-fields--grid">
                <div className="rr-drawer-field">
                  <label htmlFor="rr-pay-method">Payment Method</label>
                  <select
                    id="rr-pay-method"
                    aria-invalid={
                      validationMode !== null &&
                      amountCollected > 0 &&
                      !paymentMethod
                    }
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="">Select method</option>
                    {methods.map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rr-drawer-field">
                  <label htmlFor="rr-pay-status">Payment Status</label>
                  <select
                    id="rr-pay-status"
                    value={paymentStatus}
                    onChange={(e) =>
                      setPaymentStatus(e.target.value as typeof paymentStatus)
                    }
                  >
                    <option value="Unpaid">Unpaid</option>
                    <option value="Partial">Partial</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>
                <div className="rr-drawer-field">
                  <label htmlFor="rr-amount-paid">Amount Paid</label>
                  <input
                    id="rr-amount-paid"
                    inputMode="numeric"
                    disabled={paymentStatus !== "Partial"}
                    value={formatRupiah(amountCollected)}
                    onChange={(e) =>
                      setAmountPaid(
                        Number(e.target.value.replace(/\D/g, "")) || 0,
                      )
                    }
                  />
                </div>
              </div>
            </section>

            {/* Deposit */}
            <section className="rr-drawer-section">
              <div className="rr-drawer-section__head">
                <h3>Deposit</h3>
                <label className="rr-drawer-toggle">
                  <input
                    type="checkbox"
                    checked={requireDeposit}
                    onChange={(e) => setRequireDeposit(e.target.checked)}
                  />{" "}
                  Require Deposit
                </label>
              </div>
              {requireDeposit && (
                <div className="rr-drawer-fields rr-drawer-fields--grid">
                  <div className="rr-drawer-field">
                    <label htmlFor="rr-dep-amount">Deposit Amount</label>
                    <input
                      id="rr-dep-amount"
                      inputMode="numeric"
                      value={formatRupiah(depositAmount)}
                      onChange={(e) =>
                        setDepositAmount(
                          Number(e.target.value.replace(/\D/g, "")) || 0,
                        )
                      }
                    />
                  </div>
                  <div className="rr-drawer-field">
                    <label htmlFor="rr-dep-method">Deposit Method</label>
                    <select
                      id="rr-dep-method"
                      aria-invalid={
                        validationMode !== null && !depositMethod
                      }
                      value={depositMethod}
                      onChange={(e) => setDepositMethod(e.target.value)}
                    >
                      <option value="">Select method</option>
                      {methods.map((method) => (
                        <option key={method.id} value={method.id}>
                          {method.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="rr-drawer-field rr-drawer-field--full">
                    <label htmlFor="rr-dep-note">
                      Deposit Note{" "}
                      <span className="rr-optional">(Optional)</span>
                    </label>
                    <input
                      id="rr-dep-note"
                      value={depositNote}
                      onChange={(e) => setDepositNote(e.target.value)}
                      placeholder="Reference number, remarks"
                    />
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* RIGHT: Booking Summary — same markup as /create-reservation-walkin */}
          <div className="rr-drawer__summary">
            <aside className="booking-summary">
              {/* Header */}
              <div className="booking-summary__header">
                <h2>Booking Summary</h2>
                <span>{source === "walk_in" ? "Walk-in" : "Phone"}</span>
              </div>

              {/* Stay dates */}
              <div className="booking-summary__stay">
                <span>Stay</span>
                <strong>
                  {formatStayDate(draft.checkIn)} →{" "}
                  {formatStayDate(draft.checkOut)} · {draft.nights}{" "}
                  {draft.nights === 1 ? "night" : "nights"}
                </strong>
              </div>

              {/* Line items */}
              <div className="booking-summary__lines">
                <div>
                  <span>{draft.groupName} × 1</span>
                  <strong>{quote ? formatRupiah(roomCharge) : "—"}</strong>
                </div>

                {extraBed && (
                  <div>
                    <span>↳ Extra Bed · {draft.nights} malam</span>
                    <strong>
                      {quote ? formatRupiah(extraBedCharge) : "—"}
                    </strong>
                  </div>
                )}

                {roomDiscount > 0 && (
                  <div>
                    <span>Campaign discount</span>
                    <strong>−{formatRupiah(roomDiscount)}</strong>
                  </div>
                )}

                {addons.map((item) => {
                  const opt = variants.find(
                    (variant) => variant.id === item.variantId,
                  );
                  if (!opt) return null;
                  const cost =
                    quote?.charges.experiences.find(
                      (charge) => charge.variantId === item.variantId,
                    )?.amount ?? opt.price * item.quantity;
                  return (
                    <div key={item.variantId}>
                      <span>
                        {opt.label} × {item.quantity}
                      </span>
                      <strong>{formatRupiah(cost)}</strong>
                    </div>
                  );
                })}

                {addons.length === 0 && (
                  <div className="booking-summary__empty">Belum ada add-on</div>
                )}
              </div>

              {quote && quote.appliedCampaigns.length > 0 && (
                <details className="booking-summary__campaigns">
                  <summary>See Campaign</summary>
                  <ul>
                    {quote.appliedCampaigns.map((campaign) => (
                      <li key={campaign.id}>
                        <strong>{campaign.name}</strong>
                        <span>
                          Berlaku sampai{" "}
                          {campaign.stayEnd || campaign.bookingEnd
                            ? formatStayDate(
                                campaign.stayEnd ?? campaign.bookingEnd ?? "",
                              )
                            : "tanpa batas tanggal"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {/* Totals */}
              <div className="booking-summary__totals">
                <div>
                  <strong>Booking Total</strong>
                  <strong>
                    {quote
                      ? formatRupiah(total)
                      : quoteLoading
                        ? "Calculating…"
                        : "—"}
                  </strong>
                </div>

                {source === "phone" ? (
                  <>
                    <div>
                      <span>Payment Status</span>
                      <span
                        className={
                          "status-badge status-badge--" +
                          (paymentStatus === "Paid" ? "success" : "warning")
                        }
                      >
                        {paymentStatus}
                      </span>
                    </div>
                    <div>
                      <span>Amount Paid</span>
                      <span>{formatRupiah(amountCollected)}</span>
                    </div>
                    <div className="booking-summary__collected">
                      <strong>Remaining Balance</strong>
                      <strong>{formatRupiah(remaining)}</strong>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span>Deposit</span>
                      <span>
                        {formatRupiah(requireDeposit ? depositAmount : 0)}
                      </span>
                    </div>
                    <div className="booking-summary__collected">
                      <strong>Total Collected</strong>
                      <strong>
                        {formatRupiah(
                          amountCollected +
                            (requireDeposit ? depositAmount : 0),
                        )}
                      </strong>
                    </div>
                  </>
                )}
              </div>

              {/* Deposit note */}
              {source !== "phone" && (
                <p className="booking-summary__note">
                  Deposit is held separately and is not included in booking
                  revenue.
                </p>
              )}

              {/* Actions */}
              <div className="booking-summary__actions">
                {source === "phone" ? (
                  <>
                    <button
                      type="button"
                      className="action-button"
                      disabled={
                        saving ||
                        availabilityLoading ||
                        !roomReady ||
                        quoteLoading ||
                        !quote
                      }
                      onClick={() => void requestSave(false)}
                    >
                      Save Reservation
                    </button>
                    {draft.checkIn === todayJakarta() && (
                      <button
                        type="button"
                        className="reservation-secondary-button"
                        disabled={
                          saving ||
                          availabilityLoading ||
                          !roomReady ||
                          quoteLoading ||
                          !quote
                        }
                        onClick={() => void requestSave(true)}
                      >
                        Save &amp; Check-in
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="action-button"
                      disabled={
                        saving ||
                        availabilityLoading ||
                        !roomReady ||
                        quoteLoading ||
                        !quote
                      }
                      onClick={() => void requestSave(true)}
                    >
                      Save &amp; Check-in
                    </button>
                    <button
                      type="button"
                      className="reservation-secondary-button"
                      disabled={
                        saving ||
                        availabilityLoading ||
                        !roomReady ||
                        quoteLoading ||
                        !quote
                      }
                      onClick={() => void requestSave(false)}
                    >
                      Save Reservation
                    </button>
                  </>
                )}
              </div>

              {/* Phone mode note */}
              {source === "phone" && (
                <p className="booking-summary__note booking-summary__note--after">
                  Nomor kamar dapat diubah saat tamu tiba. Check-in dengan sisa
                  tagihan memerlukan konfirmasi petugas.
                </p>
              )}
            </aside>
          </div>
        </div>
      </aside>
      {confirmation && (
        <SaveReservationConfirmation
          guestName={guestName}
          action={confirmation}
          total={total}
          rooms={1}
          nights={draft.nights}
          onCancel={() => {
            if (!saving) setConfirmation(null);
          }}
          onConfirm={() => void submit()}
          outstandingBalance={remaining}
          acknowledged={acknowledged}
          onAcknowledgedChange={setAcknowledged}
          checkInContext={checkInContext}
          earlyCheckIn={earlyCheckIn}
          onEarlyCheckInChange={setEarlyCheckIn}
          paymentMethods={methods}
          error={feedback}
          busy={saving}
        />
      )}
      {saved && (
        <ReservationSuccessTransition
          bookingId={saved.bookingId}
          checkedIn={saved.checkedIn}
          onContinue={onComplete}
        />
      )}
    </div>
  );
}
