"use client";
import "../styles/reservations.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminShell } from "../../../components/layout/AdminShell";
import { Icon } from "../../../components/ui/Icon";
import "../components/room-rack.css";
import { RoomRackReservationSummary } from "../components/RoomRackReservationSummary";
import {
  RACK_START_DATE,
  RACK_DAYS,
  buildDateWindow,
  formatDayLabel,
  formatDateNumber,
  formatMonthLabel,
  formatRangeLabel,
  formatRupiah,
  isWeekend,
  roomRackSummary,
  roomTypeGroups,
  sourceShort,
  toISODate,
  type Reservation,
  type RoomTypeGroup,
  type RoomUnit,
} from "../constants/room-rack-data";
import { extras as addonOptions, getExtraCost, formatStayDate } from "../constants/walk-in-data";

const CHECKOUT_TIME = "12:00";
const CHECKIN_TIME = "14:00";

// Map a reservation status to a bar modifier, factoring in the room status
// (e.g. an in-house guest in a due-out room renders as the "due-out" style).
function barModifier(res: Reservation, room: RoomUnit): string {
  if (res.id.startsWith("MNT")) return "maintenance";
  if (res.status === "in-house" && room.status === "due-out") return "due-out";
  return res.status;
}

type BarGeom = { startIdx: number; span: number };

// Compute the position of a reservation within the 14-day window.
function barGeometry(res: Reservation, window: Date[]): BarGeom | null {
  const windowStart = window[0];
  const windowEnd = window[window.length - 1];
  const [ciY, ciM, ciD] = res.checkIn.split("-").map(Number);
  const [coY, coM, coD] = res.checkOut.split("-").map(Number);
  const checkIn = new Date(ciY, ciM - 1, ciD);
  const checkOut = new Date(coY, coM - 1, coD);

  // A stay occupies nights from check-in up to (but not including) check-out.
  const lastNight = new Date(checkOut);
  lastNight.setDate(checkOut.getDate() - 1);

  if (lastNight < windowStart || checkIn > windowEnd) return null;

  const visibleStart = checkIn < windowStart ? windowStart : checkIn;
  const visibleEnd = lastNight > windowEnd ? windowEnd : lastNight;

  const startIdx = window.findIndex((d) => toISODate(d) === toISODate(visibleStart));
  const endIdx = window.findIndex((d) => toISODate(d) === toISODate(visibleEnd));
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

type Selected = { res: Reservation; room: RoomUnit; group: RoomTypeGroup };

type DragState = {
  roomNumber: string;
  groupName: string;
  startIdx: number;
  endIdx: number;
};

type NewBookingDraft = {
  roomNumber: string;
  roomBedType: string;
  roomFloor: string;
  groupName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
};

// Default selection: Hendra Pratama / RES-10492 (room 101).
function findInitialSelected(): Selected | null {
  for (const group of roomTypeGroups) {
    for (const room of group.rooms) {
      const res = room.reservations.find((r) => r.id === "RES-10492");
      if (res) return { res, room, group };
    }
  }
  return null;
}

/** Check whether a given day index overlaps any existing reservation in the room. */
function isDayOccupied(room: RoomUnit, dayIdx: number, window: Date[]): boolean {
  const dayISO = toISODate(window[dayIdx]);
  return room.reservations.some((res) => {
    const ci = res.checkIn;
    const [coY, coM, coD] = res.checkOut.split("-").map(Number);
    const lastNight = new Date(coY, coM - 1, coD);
    lastNight.setDate(lastNight.getDate() - 1);
    const lastNightISO = toISODate(lastNight);
    return dayISO >= ci && dayISO <= lastNightISO;
  });
}

export function RoomRackPage() {
  const window = useMemo(() => buildDateWindow(RACK_START_DATE, RACK_DAYS), []);
  const todayISO = RACK_START_DATE;

  const [selected, setSelected] = useState<Selected | null>(null);
  const [search, setSearch] = useState("");
  const [drag, setDrag] = useState<DragState | null>(null);
  const [pending, setPending] = useState<NewBookingDraft | null>(null);
  const [booking, setBooking] = useState<NewBookingDraft | null>(null);
  const isDragging = useRef(false);

  /** Find room and group by room number. */
  const findRoom = useCallback((roomNum: string) => {
    for (const g of roomTypeGroups) {
      const r = g.rooms.find((rm) => rm.number === roomNum);
      if (r) return { room: r, group: g };
    }
    return null;
  }, []);

  /** Start dragging from an empty day cell. */
  const handleDragStart = useCallback(
    (roomNumber: string, groupName: string, dayIdx: number) => {
      const found = findRoom(roomNumber);
      if (!found) return;
      if (isDayOccupied(found.room, dayIdx, window)) return;
      isDragging.current = true;
      // New drag clears old pending placeholder.
      setPending(null);
      setDrag({ roomNumber, groupName, startIdx: dayIdx, endIdx: dayIdx });
    },
    [findRoom, window],
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
        if (isDayOccupied(found.room, i, window)) return;
      }
      setDrag((prev) => (prev ? { ...prev, endIdx: dayIdx } : null));
    },
    [drag, findRoom, window],
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
    { key: "available", tone: "success", value: roomRackSummary.availableRooms, label: "Available Rooms", glyph: "✓" },
    { key: "ready", tone: "warning", value: roomRackSummary.readyToCheckIn, label: "Ready to Check-in", glyph: "◷" },
    { key: "in-house", tone: "primary", value: roomRackSummary.inHouse, label: "In House", glyph: "●" },
    { key: "due-out", tone: "info", value: roomRackSummary.dueOut, label: "Due Out", glyph: "↩" },
    { key: "unavailable", tone: "maintenance", value: roomRackSummary.unavailable, label: "Unavailable Rooms", glyph: "⚠" },
  ] as const;

  const rangeLabel = formatRangeLabel(window[0], window[window.length - 1]);

  return (
    <AdminShell title="Reservations" context="Room Rack">
      <div className="room-rack">
        {/* Heading */}
        <div className="room-rack__heading">
          <div>
            <span className="room-rack__eyebrow">FRONT DESK · TAPE CHART</span>
            <h1>Room Rack</h1>
            <p>Visual 14-day availability grid for arrivals, in-house stays, and blocks.</p>
          </div>
        </div>

        {/* Metrics */}
        <div className="room-rack__metrics">
          {metrics.map((m) => (
            <div key={m.key} className={`rr-metric rr-metric--${m.tone}`}>
              <span className="rr-metric__icon" aria-hidden="true">{m.glyph}</span>
              <div>
                <div className="rr-metric__value">{m.value}</div>
                <div className="rr-metric__label">{m.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="room-rack__toolbar">
          <div className="rr-pager" role="group" aria-label="Date navigation">
            <button type="button">
              <Icon name="chevronLeft" width={14} height={14} />
              Prev 14 Days
            </button>
            <button type="button" className="rr-pager--today">
              Today ({formatDateNumber(window[0])} {formatMonthLabel(window[0])})
            </button>
            <button type="button">
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
          <select aria-label="Filter room type" defaultValue="all">
            <option value="all">All Room Types (9)</option>
            {roomTypeGroups.map((g) => (
              <option key={g.name} value={g.name}>{g.name}</option>
            ))}
          </select>
          <select aria-label="Filter status" defaultValue="all">
            <option value="all">All Statuses</option>
            <option value="in-house">In-House</option>
            <option value="confirmed">Confirmed</option>
            <option value="due-out">Due Out</option>
            <option value="maintenance">Maintenance</option>
          </select>
          <select aria-label="Filter source" defaultValue="all">
            <option value="all">All Sources</option>
            <option value="walk-in">Walk-in</option>
            <option value="website">Website</option>
            <option value="ota">OTA</option>
            <option value="phone">Phone</option>
          </select>
          <button type="button" className="rr-refresh">
            <Icon name="reset" width={15} height={15} />
            Refresh
          </button>
        </div>

        {/* Legend */}
        <div className="room-rack__legend">
          <strong>Reservation</strong>
          <span className="rr-legend-item">
            <span className="rr-legend-swatch rr-legend-swatch--warning" /> Upcoming / Ready to Check-in
          </span>
          <span className="rr-legend-item">
            <span className="rr-legend-swatch rr-legend-swatch--success" /> In House
          </span>
          <span className="rr-legend-item">
            <span className="rr-legend-swatch rr-legend-swatch--info" /> Due Out
          </span>
          <span className="rr-legend-item">
            <span className="rr-legend-swatch rr-legend-swatch--danger" /> Overdue
          </span>
          <span className="rr-legend-divider" aria-hidden="true" />
          <strong>Room</strong>
          <span className="rr-legend-item">
            <span className="rr-legend-swatch rr-legend-swatch--available" /> Available
          </span>
          <span className="rr-legend-item">
            <span className="rr-legend-swatch rr-legend-swatch--success" /> Occupied
          </span>
          <span className="rr-legend-item">
            <span className="rr-legend-swatch rr-legend-swatch--cleaning" /> Cleaning
          </span>
          <span className="rr-legend-item">
            <span className="rr-legend-swatch rr-legend-swatch--maintenance" /> Maintenance
          </span>
          <span className="rr-legend-item">
            <span className="rr-legend-swatch rr-legend-swatch--danger" /> Out of Service
          </span>
        </div>

        {/* Body: chart + detail */}
        <div className={selected ? "room-rack__body" : "room-rack__body room-rack__body--full"}>
          <div className="rr-chart">
            <div className="rr-chart__scroll">
              <div className="rr-grid">
                {/* Header row */}
                <div className="rr-head-cell rr-head-cell--room">
                  <span className="rr-head-cell__eyebrow">Room</span>
                  <span className="rr-head-cell__title">Unit / Type</span>
                </div>
                {window.map((date) => {
                  const iso = toISODate(date);
                  const classes = [
                    "rr-head-cell",
                    isWeekend(date) ? "rr-head-cell--weekend" : "",
                    iso === todayISO ? "rr-head-cell--today" : "",
                  ].filter(Boolean).join(" ");
                  return (
                    <div key={iso} className={classes}>
                      <div className="rr-head-cell__day">{formatDayLabel(date)}</div>
                      <div className="rr-head-cell__num">{formatDateNumber(date)}</div>
                      <div className="rr-head-cell__mon">{formatMonthLabel(date)}</div>
                    </div>
                  );
                })}

                {/* Groups */}
                {roomTypeGroups.map((group) => (
                  <RoomGroup
                    key={group.name}
                    group={group}
                    window={window}
                    todayISO={todayISO}
                    selectedId={selected?.res.id ?? null}
                    onSelect={(res, room) => setSelected({ res, room, group })}
                    drag={drag}
                    onDragStart={handleDragStart}
                    onDragMove={handleDragMove}
                    onDragEnd={handleDragEnd}
                    pending={pending}
                    onPendingClick={(draft) => setBooking(draft)}
                  />
                ))}
              </div>
            </div>
          </div>

          {selected && (
            <RoomRackReservationSummary
              reservation={selected.res}
              room={selected.room}
              group={selected.group}
              onClose={() => setSelected(null)}
            />
          )}
        </div>

        {/* Drag-to-create booking form */}
        {booking && (
          <NewBookingForm draft={booking} onClose={() => setBooking(null)} />
        )}
      </div>
    </AdminShell>
  );
}

function RoomGroup({
  group,
  window,
  todayISO,
  selectedId,
  onSelect,
  drag,
  onDragStart,
  onDragMove,
  onDragEnd,
  pending,
  onPendingClick,
}: {
  group: RoomTypeGroup;
  window: Date[];
  todayISO: string;
  selectedId: string | null;
  onSelect: (res: Reservation, room: RoomUnit) => void;
  drag: DragState | null;
  onDragStart: (roomNumber: string, groupName: string, dayIdx: number) => void;
  onDragMove: (dayIdx: number) => void;
  onDragEnd: () => void;
  pending: NewBookingDraft | null;
  onPendingClick: (draft: NewBookingDraft) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

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
          ].filter(Boolean).join(" ");
          return (
            <div key={iso} className={classes}>
              {(group.dailyRates[i] / 1000).toFixed(0)}k
            </div>
          );
        })}
      </div>

      {/* Rooms */}
      {group.rooms.map((room) => {
        // Calculate drag highlight range for this room.
        const dragLo = drag && drag.roomNumber === room.number ? Math.min(drag.startIdx, drag.endIdx) : -1;
        const dragHi = drag && drag.roomNumber === room.number ? Math.max(drag.startIdx, drag.endIdx) : -1;

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
              const classes = [
                "rr-day-cell",
                isWeekend(date) ? "rr-day-cell--weekend" : "",
                iso === todayISO ? "rr-day-cell--today" : "",
                isDragHighlight ? "rr-day-cell--drag" : "",
              ].filter(Boolean).join(" ");
              return (
                <div
                  key={iso}
                  className={classes}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onDragStart(room.number, group.name, dayIdx);
                  }}
                  onMouseEnter={() => onDragMove(dayIdx)}
                  onMouseUp={onDragEnd}
                >
                  {!isDragHighlight && (
                    <span className="rr-day-cell__add" aria-hidden="true">
                      <Icon name="plus" width={14} height={14} />
                    </span>
                  )}
                  {isDragHighlight && (
                    <span className="rr-day-cell__drag-label" aria-hidden="true">
                      {dayIdx === dragLo ? `${dragHi - dragLo + 1}N` : ""}
                    </span>
                  )}
                </div>
              );
            })}

            {room.reservations.map((res) => {
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
                  key={res.id}
                  className={[
                    "rr-bar",
                    `rr-bar--${modifier}`,
                    selectedId === res.id ? "rr-bar--selected" : "",
                  ].filter(Boolean).join(" ")}
                  style={style}
                  onClick={() => { if (!isMaintenance) onSelect(res, room); }}
                  aria-label={`${res.guestName} ${res.checkIn} to ${res.checkOut}`}
                >
                  <span className="rr-bar__name">{res.guestName}</span>
                  <span className="rr-bar__meta">
                    {isMaintenance ? (
                      <>{room.maintenanceNote ?? "Blocked"}</>
                    ) : (
                      <>
                        {sourceShort[res.source]}
                        {modifier === "due-out" && (
                          <span className="rr-bar__badge">out {CHECKOUT_TIME}</span>
                        )}
                      </>
                    )}
                  </span>
                </button>
              );
            })}

            {/* Pending placeholder bar from drag-to-create */}
            {pending && pending.roomNumber === room.number && (() => {
              const ciIdx = window.findIndex((d) => toISODate(d) === pending.checkIn);
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
    </>
  );
}

function NewBookingForm({
  draft,
  onClose,
}: {
  draft: NewBookingDraft;
  onClose: () => void;
}) {
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [extraBed, setExtraBed] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [guestNotes, setGuestNotes] = useState("");
  const [source, setSource] = useState<string>("Walk-in");
  const [addons, setAddons] = useState<{ id: string; quantity: number }[]>([]);
  const [addingAddon, setAddingAddon] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"Unpaid" | "Partial" | "Paid">("Unpaid");
  const [amountPaid, setAmountPaid] = useState(0);
  const [requireDeposit, setRequireDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState(500000);
  const [depositMethod, setDepositMethod] = useState("");
  const [depositNote, setDepositNote] = useState("");

  // Look up the group to get the rate.
  const group = roomTypeGroups.find((g) => g.name === draft.groupName);
  const ratePerNight = group?.dailyRates[0] ?? 0;
  const roomCharge = ratePerNight * draft.nights;
  const extraBedRate = 250000;
  const extraBedCharge = extraBed ? extraBedRate * draft.nights : 0;
  const addonsTotal = addons.reduce((sum, a) => sum + getExtraCost(a.id, a.quantity, draft.nights), 0);
  const subtotal = roomCharge + extraBedCharge + addonsTotal;
  const tax = Math.round(subtotal * 0.11);
  const service = Math.round(subtotal * 0.05);
  const total = subtotal + tax + service;
  const remaining = Math.max(0, total - amountPaid - (requireDeposit ? depositAmount : 0));

  const handleSubmit = () => {
    console.log("New booking:", { ...draft, guestName, phone, email, guestNotes, source, adults, children, paymentMethod, paymentStatus, amountPaid, requireDeposit, depositAmount, depositMethod, depositNote });
    onClose();
  };

  return (
    <div className="rr-drawer-overlay" onClick={onClose}>
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
          <button type="button" className="rr-detail__close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {/* Scrollable body: form + summary */}
        <div className="rr-drawer__body">
          {/* LEFT: Form sections */}
          <div className="rr-drawer__form">
            {/* Source */}
            <section className="rr-drawer-section">
              <h3>Reservation Source</h3>
              <div className="rr-drawer-tabs">
                {["Walk-in", "Phone"].map((s) => (
                  <button key={s} type="button" className={source === s ? "rr-drawer-tab rr-drawer-tab--active" : "rr-drawer-tab"} onClick={() => setSource(s)}>{s}</button>
                ))}
              </div>
            </section>

            {/* Stay */}
            <section className="rr-drawer-section">
              <div className="rr-drawer-section__head">
                <h3>Stay</h3>
                <span className="rr-drawer-badge">{draft.nights} {draft.nights === 1 ? "night" : "nights"}</span>
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
                  <span>{draft.groupName} · {draft.roomBedType} · {draft.roomFloor}</span>
                </div>
                <div className="rr-drawer-fields rr-drawer-fields--3col">
                  <div className="rr-drawer-field">
                    <label htmlFor="rr-adults">Adults</label>
                    <select id="rr-adults" value={adults} onChange={(e) => setAdults(Number(e.target.value))}>
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div className="rr-drawer-field">
                    <label htmlFor="rr-children">Children</label>
                    <select id="rr-children" value={children} onChange={(e) => setChildren(Number(e.target.value))}>
                      {Array.from({ length: 11 }, (_, i) => i).map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div className="rr-drawer-field">
                    <label htmlFor="rr-extra-bed">Extra Bed</label>
                    <select id="rr-extra-bed" value={extraBed ? "1" : "0"} onChange={(e) => setExtraBed(e.target.value === "1")}>
                      <option value="0">No</option>
                      <option value="1">Yes (+{formatRupiah(extraBedRate)}/night)</option>
                    </select>
                  </div>
                </div>
              </div>
            </section>

            {/* Guest Information */}
            <section className="rr-drawer-section">
              <h3>Guest Information</h3>
              <div className="rr-drawer-fields">
                <div className="rr-drawer-field">
                  <label htmlFor="rr-guest-name">Full Name <span className="rr-required">*</span></label>
                  <input id="rr-guest-name" autoFocus value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Guest full name" />
                </div>
                <div className="rr-drawer-field">
                  <label htmlFor="rr-phone">WhatsApp <span className="rr-required">*</span></label>
                  <input id="rr-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+62 812-xxxx-xxxx" />
                </div>
                <div className="rr-drawer-field">
                  <label htmlFor="rr-email">Email <span className="rr-optional">(Optional)</span></label>
                  <input id="rr-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="guest@example.com" />
                </div>
                <div className="rr-drawer-field">
                  <label htmlFor="rr-notes">Special Requests <span className="rr-optional">(Optional)</span></label>
                  <textarea id="rr-notes" rows={2} value={guestNotes} onChange={(e) => setGuestNotes(e.target.value)} placeholder="Extra pillows, late check-in, etc." />
                </div>
              </div>
            </section>

            {/* Experiences & Add-ons */}
            <section className="rr-drawer-section">
              <div className="rr-drawer-section__head">
                <h3>Experiences &amp; Add-ons</h3>
                <button type="button" className="rr-drawer-add-btn" onClick={() => setAddingAddon((v) => !v)}>＋ Add</button>
              </div>
              {addingAddon && (
                <div className="rr-drawer-field">
                  <label htmlFor="rr-addon-pick">Pilih add-on</label>
                  <select
                    id="rr-addon-pick"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        setAddons((prev) => [...prev, { id: e.target.value, quantity: 1 }]);
                      }
                      setAddingAddon(false);
                    }}
                  >
                    <option value="">Pilih paket</option>
                    {addonOptions.filter((opt) => !addons.some((a) => a.id === opt.id)).map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.label} · {formatRupiah(opt.price)}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="rr-drawer-addons">
                {addons.map((item) => {
                  const opt = addonOptions.find((o) => o.id === item.id);
                  if (!opt) return null;
                  const cost = getExtraCost(item.id, item.quantity, draft.nights);
                  return (
                    <div className="rr-drawer-addon" key={item.id}>
                      <div className="rr-drawer-addon__info">
                        <strong>{opt.label}</strong>
                        <small>{formatRupiah(opt.price)} {opt.unit}</small>
                      </div>
                      <div className="rr-drawer-addon__controls">
                        <div className="rr-drawer-qty">
                          <button type="button" onClick={() => setAddons((prev) => prev.map((a) => a.id === item.id ? { ...a, quantity: Math.max(1, a.quantity - 1) } : a))}>−</button>
                          <span>{item.quantity}</span>
                          <button type="button" onClick={() => setAddons((prev) => prev.map((a) => a.id === item.id ? { ...a, quantity: Math.min(20, a.quantity + 1) } : a))}>+</button>
                        </div>
                        <strong className="rr-drawer-addon__total">{formatRupiah(cost)}</strong>
                        <button type="button" className="rr-drawer-addon__remove" aria-label={`Hapus ${opt.label}`} onClick={() => setAddons((prev) => prev.filter((a) => a.id !== item.id))}>×</button>
                      </div>
                    </div>
                  );
                })}
                {addons.length === 0 && <p className="rr-drawer-empty">Belum ada add-on.</p>}
              </div>
            </section>

            {/* Payment */}
            <section className="rr-drawer-section">
              <h3>Payment</h3>
              <div className="rr-drawer-fields rr-drawer-fields--grid">
                <div className="rr-drawer-field">
                  <label htmlFor="rr-pay-method">Payment Method</label>
                  <select id="rr-pay-method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                    <option value="">Select method</option>
                    <option value="cash">Cash</option>
                    <option value="bca-va">BCA Virtual Account</option>
                    <option value="bca-qris">BCA QRIS</option>
                    <option value="mandiri">Mandiri Transfer</option>
                    <option value="credit-card">Credit Card</option>
                  </select>
                </div>
                <div className="rr-drawer-field">
                  <label htmlFor="rr-pay-status">Payment Status</label>
                  <select id="rr-pay-status" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as typeof paymentStatus)}>
                    <option value="Unpaid">Unpaid</option>
                    <option value="Partial">Partial</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>
                <div className="rr-drawer-field">
                  <label htmlFor="rr-amount-paid">Amount Paid</label>
                  <input id="rr-amount-paid" inputMode="numeric" disabled={paymentStatus !== "Partial"} value={formatRupiah(amountPaid)} onChange={(e) => setAmountPaid(Number(e.target.value.replace(/\D/g, "")) || 0)} />
                </div>
              </div>
            </section>

            {/* Deposit */}
            <section className="rr-drawer-section">
              <div className="rr-drawer-section__head">
                <h3>Deposit</h3>
                <label className="rr-drawer-toggle"><input type="checkbox" checked={requireDeposit} onChange={(e) => setRequireDeposit(e.target.checked)} /> Require Deposit</label>
              </div>
              {requireDeposit && (
                <div className="rr-drawer-fields rr-drawer-fields--grid">
                  <div className="rr-drawer-field">
                    <label htmlFor="rr-dep-amount">Deposit Amount</label>
                    <input id="rr-dep-amount" inputMode="numeric" value={formatRupiah(depositAmount)} onChange={(e) => setDepositAmount(Number(e.target.value.replace(/\D/g, "")) || 0)} />
                  </div>
                  <div className="rr-drawer-field">
                    <label htmlFor="rr-dep-method">Deposit Method</label>
                    <select id="rr-dep-method" value={depositMethod} onChange={(e) => setDepositMethod(e.target.value)}>
                      <option value="">Select method</option>
                      <option value="cash">Cash</option>
                      <option value="bca-va">BCA Virtual Account</option>
                      <option value="bca-qris">BCA QRIS</option>
                    </select>
                  </div>
                  <div className="rr-drawer-field rr-drawer-field--full">
                    <label htmlFor="rr-dep-note">Deposit Note <span className="rr-optional">(Optional)</span></label>
                    <input id="rr-dep-note" value={depositNote} onChange={(e) => setDepositNote(e.target.value)} placeholder="Reference number, remarks" />
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
                <span>{source}</span>
              </div>

              {/* Stay dates */}
              <div className="booking-summary__stay">
                <span>Stay</span>
                <strong>{formatStayDate(draft.checkIn)} → {formatStayDate(draft.checkOut)} · {draft.nights} {draft.nights === 1 ? "night" : "nights"}</strong>
              </div>

              {/* Line items */}
              <div className="booking-summary__lines">
                <div>
                  <span>{draft.groupName} × 1</span>
                  <strong>{formatRupiah(roomCharge)}</strong>
                </div>

                {extraBed && (
                  <div>
                    <span>↳ Extra Bed · {draft.nights} malam</span>
                    <strong>{formatRupiah(extraBedCharge)}</strong>
                  </div>
                )}

                {addons.map((item) => {
                  const opt = addonOptions.find((o) => o.id === item.id);
                  if (!opt) return null;
                  const cost = getExtraCost(item.id, item.quantity, draft.nights);
                  return (
                    <div key={item.id}>
                      <span>{opt.label} × {item.quantity}{opt.perNight ? ` · ${draft.nights} malam` : ""}</span>
                      <strong>{formatRupiah(cost)}</strong>
                    </div>
                  );
                })}

                {addons.length === 0 && (
                  <div className="booking-summary__empty">Belum ada add-on</div>
                )}
              </div>

              {/* Totals */}
              <div className="booking-summary__totals">
                <div>
                  <strong>Booking Total</strong>
                  <strong>{formatRupiah(total)}</strong>
                </div>

                {source === "Phone" ? (
                  <>
                    <div>
                      <span>Payment Status</span>
                      <span className={"status-badge status-badge--" + (paymentStatus === "Paid" ? "success" : "warning")}>{paymentStatus}</span>
                    </div>
                    <div>
                      <span>Amount Paid</span>
                      <span>{formatRupiah(amountPaid)}</span>
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
                      <span>{formatRupiah(requireDeposit ? depositAmount : 0)}</span>
                    </div>
                    <div className="booking-summary__collected">
                      <strong>Total Collected</strong>
                      <strong>{formatRupiah(amountPaid + (requireDeposit ? depositAmount : 0))}</strong>
                    </div>
                  </>
                )}
              </div>

              {/* Deposit note */}
              {source !== "Phone" && (
                <p className="booking-summary__note">
                  Deposit is held separately and is not included in booking revenue.
                </p>
              )}

              {/* Actions */}
              <div className="booking-summary__actions">
                {source === "Phone" ? (
                  <>
                    <button type="button" className="action-button" onClick={() => handleSubmit()}>Save Reservation</button>
                    <button type="button" className="reservation-secondary-button" onClick={() => handleSubmit()}>Save &amp; Check-in</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="action-button" onClick={() => handleSubmit()}>Save &amp; Check-in</button>
                    <button type="button" className="reservation-secondary-button" onClick={() => handleSubmit()}>Save Reservation</button>
                  </>
                )}
              </div>

              {/* Phone mode note */}
              {source === "Phone" && (
                <p className="booking-summary__note booking-summary__note--after">
                  Nomor kamar dapat diubah saat tamu tiba. Check-in dengan sisa tagihan memerlukan konfirmasi petugas.
                </p>
              )}
            </aside>
          </div>
        </div>
      </aside>
    </div>
  );
}
