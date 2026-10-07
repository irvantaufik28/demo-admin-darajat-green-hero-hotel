"use client";
import "../styles/rooms.css";

import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { useEffect, useState, type FormEvent } from "react";
import { AdminShell } from "../../../components/layout/AdminShell";
import { restoreSession } from "../../../lib/auth";
import {
  createRoomNumber,
  getRoomNumberOptions,
  getRoomNumbers,
  updateRoomNumber,
  type FloorOption,
  type RoomNumber,
  type RoomNumberInput,
  type RoomOperationalStatus,
  type RoomTypeOption,
} from "../services/room-numbers";
import { useTranslations, type Translate } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

const pageSize = 20;
const statusLabels: Record<RoomOperationalStatus, string> = {
  available: "Available",
  occupied: "Occupied",
  cleaning: "Cleaning",
  maintenance: "Maintenance",
  out_of_service: "Out of Service",
};
const statuses = Object.keys(statusLabels) as RoomOperationalStatus[];

type Draft = RoomNumberInput & { note: string };

const blankDraft: Draft = {
  roomNumber: "",
  roomTypeId: "",
  floorId: null,
  operationalStatus: "available",
  isActive: true,
  note: "",
};

function occupancy(room: Pick<RoomNumber, "operationalStatus" | "isActive">) {
  if (room.operationalStatus === "occupied") return "Occupied";
  return room.isActive && room.operationalStatus === "available"
    ? "Available"
    : "Unavailable";
}

const statusKeys: Record<RoomOperationalStatus, string> = {
  available: "roomNumbers.status.available",
  occupied: "roomNumbers.status.occupied",
  cleaning: "roomNumbers.status.cleaning",
  maintenance: "roomNumbers.status.maintenance",
  out_of_service: "roomNumbers.status.outOfService",
};

const occupancyKeys: Record<string, string> = {
  Available: "roomNumbers.status.available",
  Occupied: "roomNumbers.status.occupied",
  Unavailable: "roomNumbers.status.unavailable",
};

function statusLabel(status: RoomOperationalStatus, t: Translate) {
  return t(statusKeys[status]);
}

function occupancyLabel(value: string, t: Translate) {
  return t(occupancyKeys[value] ?? value);
}

function errorMessage(error: unknown, t: Translate) {
  return error instanceof Error
    ? error.message
    : t("roomNumbers.messages.requestFailed");
}

export function RoomNumbersPage() {
  const { t } = useTranslations({ en, id });
  const [rooms, setRooms] = useState<RoomNumber[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomTypeOption[]>([]);
  const [floors, setFloors] = useState<FloorOption[]>([]);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [occupancyFilter, setOccupancyFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [editingOccupied, setEditingOccupied] = useState(false);
  const [draft, setDraft] = useState<Draft>(blankDraft);

  useEffect(() => {
    const controller = new AbortController();
    async function loadOptions() {
      setLoadError("");
      try {
        if (!(await restoreSession())) return;
        const [types, floorList] = await getRoomNumberOptions(
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setRoomTypes(types.items);
        setFloors(floorList.items);
        setReady(true);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setLoadError(errorMessage(cause, t));
          setLoading(false);
        }
      }
    }
    void loadOptions();
    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(query.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    async function loadRooms() {
      setLoading(true);
      setLoadError("");
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (search) params.set("search", search);
      if (typeFilter) params.set("roomTypeId", typeFilter);
      if (occupancyFilter)
        params.set("occupancy", occupancyFilter.toLowerCase());
      if (statusFilter === "inactive") params.set("isActive", "false");
      else if (statusFilter) {
        params.set("isActive", "true");
        params.set("operationalStatus", statusFilter);
      }
      try {
        const response = await getRoomNumbers(params, controller.signal);
        if (controller.signal.aborted) return;
        setRooms(response.items);
        setTotal(response.total);
      } catch (cause) {
        if (!controller.signal.aborted) setLoadError(errorMessage(cause, t));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadRooms();
    return () => controller.abort();
  }, [
    ready,
    page,
    search,
    typeFilter,
    statusFilter,
    occupancyFilter,
    reloadKey,
  ]);

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  function openModal(room?: RoomNumber) {
    setEditing(room?.id ?? "");
    setEditingOccupied(room?.operationalStatus === "occupied");
    setDraft(
      room
        ? {
            roomNumber: room.roomNumber,
            roomTypeId: room.roomTypeId,
            floorId: room.floorId,
            operationalStatus: room.operationalStatus,
            isActive: room.isActive,
            note: "",
          }
        : { ...blankDraft },
    );
    setError("");
  }

  async function saveRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingOccupied) {
      setError(
        t("roomNumbers.validation.occupiedCannotSave"),
      );
      return;
    }
    if (!draft.roomNumber.trim() || !draft.roomTypeId) {
      setError(t("roomNumbers.validation.requiredFields"));
      return;
    }
    setSaving(true);
    setError("");
    const body: RoomNumberInput = {
      roomNumber: draft.roomNumber.trim(),
      roomTypeId: draft.roomTypeId,
      floorId: draft.floorId,
      operationalStatus: draft.operationalStatus,
      isActive: draft.isActive,
    };
    try {
      if (editing) await updateRoomNumber(editing, body);
      else await createRoomNumber(body);
      setEditing(null);
      setReloadKey((key) => key + 1);
    } catch (cause) {
      setError(errorMessage(cause, t));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell title={t("shell.title")} context={t("shell.roomNumbersContext")}>
      <div className="room-numbers-page">
        <div className="room-numbers-heading">
          <div>
            <h1>{t("roomNumbers.heading")}</h1>
            <p>{t("roomNumbers.description")}</p>
          </div>
          <button
            className="action-button"
            type="button"
            onClick={() => openModal()}
          >
            ＋ {t("roomNumbers.addButton")}
          </button>
        </div>

        <div className="room-numbers-filters">
          <label className="room-types-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("roomNumbers.filters.searchPlaceholder")}
              aria-label={t("roomNumbers.filters.searchAriaLabel")}
            />
          </label>
          <select
            value={typeFilter}
            onChange={(event) => {
              setTypeFilter(event.target.value);
              setPage(1);
            }}
            aria-label={t("roomNumbers.filters.typeAriaLabel")}
          >
            <option value="">{t("roomNumbers.filters.typeAll")}</option>
            {roomTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            aria-label={t("roomNumbers.filters.statusAriaLabel")}
          >
            <option value="">{t("roomNumbers.filters.statusAll")}</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status, t)}
              </option>
            ))}
            <option value="inactive">{t("roomNumbers.filters.statusInactive")}</option>
          </select>
          <select
            value={occupancyFilter}
            onChange={(event) => {
              setOccupancyFilter(event.target.value);
              setPage(1);
            }}
            aria-label={t("roomNumbers.filters.occupancyAriaLabel")}
          >
            <option value="">{t("roomNumbers.filters.occupancyAll")}</option>
            <option value="Available">{t("roomNumbers.filters.occupancyAvailable")}</option>
            <option value="Occupied">{t("roomNumbers.filters.occupancyOccupied")}</option>
          </select>
          <button
            type="button"
            className="room-types-reset"
            onClick={() => {
              setQuery("");
              setTypeFilter("");
              setStatusFilter("");
              setOccupancyFilter("");
              setPage(1);
            }}
          >
            {t("roomNumbers.filters.reset")}
          </button>
          <span className="room-types-total">
            {t("roomNumbers.filters.total", { total })}
          </span>
        </div>

        <section className="room-numbers-table-wrap">
          {loadError && (
            <p className="room-numbers-error" role="alert">
              {loadError}{" "}
              <button
                type="button"
                onClick={() => setReloadKey((key) => key + 1)}
              >
                {t("roomNumbers.messages.retry")}
              </button>
            </p>
          )}
          <div className="room-types-table-scroll">
            <table className="room-numbers-table">
              <thead>
                <tr>
                  <th>{t("roomNumbers.table.roomNumber")}</th>
                  <th>{t("roomNumbers.table.roomType")}</th>
                  <th>{t("roomNumbers.table.floor")}</th>
                  <th>{t("roomNumbers.table.occupancy")}</th>
                  <th>{t("roomNumbers.table.operationalStatus")}</th>
                  <th>{t("roomNumbers.table.action")}</th>
                </tr>
              </thead>
              <tbody>
                {!loading && rooms.map((room) => (
                  <tr key={room.id}>
                    <td className="room-numbers-number">{room.roomNumber}</td>
                    <td>{room.roomTypeName}</td>
                    <td>{room.floorName || "—"}</td>
                    <td>
                      <span
                        className={`room-numbers-badge room-numbers-badge--${occupancy(room).toLowerCase()}`}
                      >
                        {occupancyLabel(occupancy(room), t)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`room-numbers-badge room-numbers-badge--${room.isActive ? room.operationalStatus : "inactive"}`}
                      >
                        {room.isActive
                          ? statusLabel(room.operationalStatus, t)
                          : t("roomNumbers.status.inactive")}
                      </span>
                    </td>
                    <td>
                      <button
                        className="room-types-edit-link"
                        type="button"
                        onClick={() => openModal(room)}
                      >
                        {t("roomNumbers.cell.edit")}
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && rooms.length === 0 && (
                  <tr>
                    <td colSpan={6} className="room-types-empty">
                      {t("roomNumbers.messages.empty")}
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan={6} className="room-types-empty">
                      <LoadingSkeleton />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="room-numbers-table-footer">
            <span>
              {t("roomNumbers.pagination.showing", { from, to, total })}
            </span>
            <div>
              <button
                disabled={page <= 1 || loading}
                type="button"
                onClick={() => setPage((value) => value - 1)}
              >
                ‹ {t("roomNumbers.pagination.previous")}
              </button>
              <span>{page}</span>
              <button
                disabled={page * pageSize >= total || loading}
                type="button"
                onClick={() => setPage((value) => value + 1)}
              >
                {t("roomNumbers.pagination.next")} ›
              </button>
            </div>
          </div>
        </section>
      </div>

      {editing !== null && (
        <div
          className="room-numbers-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving)
              setEditing(null);
          }}
        >
          <form
            className="room-numbers-modal"
            onSubmit={(event) => void saveRoom(event)}
          >
            <div className="room-numbers-modal-head">
              <div>
                <h2>
                  {editingOccupied
                    ? t("roomNumbers.modal.titleDetail")
                    : editing
                      ? t("roomNumbers.modal.titleEdit")
                      : t("roomNumbers.modal.titleAdd")}
                </h2>
                <p>
                  {editingOccupied
                    ? t("roomNumbers.modal.subtitleDetail")
                    : editing
                      ? t("roomNumbers.modal.subtitleEdit")
                      : t("roomNumbers.modal.subtitleAdd")}
                </p>
              </div>
              <button
                type="button"
                aria-label={t("roomNumbers.modal.closeAriaLabel")}
                disabled={saving}
                onClick={() => setEditing(null)}
              >
                ×
              </button>
            </div>
            <div className="room-numbers-modal-body">
              {editing && (
                <div className="room-numbers-occupancy">
                  <div>
                    <strong>{t("roomNumbers.modal.currentOccupancy")}</strong>
                    <small>
                      {t("roomNumbers.modal.currentOccupancyHint")}
                    </small>
                  </div>
                  <span
                    className={`room-numbers-badge room-numbers-badge--${editingOccupied ? "occupied" : occupancy(draft).toLowerCase()}`}
                  >
                    {editingOccupied ? t("roomNumbers.status.occupied") : occupancyLabel(occupancy(draft), t)}
                  </span>
                </div>
              )}
              {editingOccupied && (
                <p className="room-numbers-occupied-notice" role="status">
                  {t("roomNumbers.modal.occupiedNotice")}
                </p>
              )}
              <fieldset
                className="room-numbers-readonly-fields"
                disabled={editingOccupied}
              >
                <div className="room-numbers-fields">
                  <label>
                    {t("roomNumbers.modal.roomNumberLabel")} <b>*</b>
                    <input
                      value={draft.roomNumber}
                      onChange={(event) =>
                        setDraft({ ...draft, roomNumber: event.target.value })
                      }
                      placeholder={t("roomNumbers.modal.roomNumberPlaceholder")}
                      required
                    />
                    <small>{t("roomNumbers.modal.roomNumberHint")}</small>
                  </label>
                  <label>
                    {t("roomNumbers.modal.floorLabel")} <em>{t("roomNumbers.modal.optional")}</em>
                    <select
                      value={draft.floorId ?? ""}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          floorId: event.target.value || null,
                        })
                      }
                    >
                      <option value="">{t("roomNumbers.modal.floorPlaceholder")}</option>
                      {floors.map((floor) => (
                        <option key={floor.id} value={floor.id}>
                          {floor.name}
                        </option>
                      ))}
                    </select>
                    <small>{t("roomNumbers.modal.floorHint")}</small>
                  </label>
                </div>
                <label>
                  {t("roomNumbers.modal.roomTypeLabel")} <b>*</b>
                  <select
                    value={draft.roomTypeId}
                    onChange={(event) =>
                      setDraft({ ...draft, roomTypeId: event.target.value })
                    }
                    required
                  >
                    <option value="">{t("roomNumbers.modal.roomTypePlaceholder")}</option>
                    {roomTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </label>
                <fieldset>
                  <legend>
                    {t("roomNumbers.modal.operationalStatusLabel")} <b>*</b>
                  </legend>
                  <div className="room-numbers-status-options">
                    {statuses.map((status) => (
                      <label key={status}>
                        <input
                          type="radio"
                          name="operationalStatus"
                          checked={draft.operationalStatus === status}
                          onChange={() =>
                            setDraft({ ...draft, operationalStatus: status })
                          }
                        />
                        {statusLabel(status, t)}
                      </label>
                    ))}
                  </div>
                  <small>
                    {t("roomNumbers.modal.operationalStatusHint")}
                  </small>
                </fieldset>
                <label>
                  <span>
                    <input
                      type="checkbox"
                      checked={draft.isActive}
                      onChange={(event) =>
                        setDraft({ ...draft, isActive: event.target.checked })
                      }
                    />{" "}
                    {t("roomNumbers.modal.activeRoomNumber")}
                  </span>
                </label>
                <label>
                  {t("roomNumbers.modal.internalNoteLabel")} <em>{t("roomNumbers.modal.optional")}</em>
                  <textarea
                    rows={2}
                    value={draft.note}
                    onChange={(event) =>
                      setDraft({ ...draft, note: event.target.value })
                    }
                    placeholder={t("roomNumbers.modal.internalNotePlaceholder")}
                  />
                  <small>
                    {t("roomNumbers.modal.internalNoteHint")}
                  </small>
                </label>
              </fieldset>
              {error && (
                <p className="room-numbers-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <div className="room-numbers-modal-footer">
              <button
                type="button"
                disabled={saving}
                onClick={() => setEditing(null)}
              >
                {editingOccupied ? t("roomNumbers.modal.close") : t("roomNumbers.modal.cancel")}
              </button>
              {!editingOccupied && (
                <button
                  type="submit"
                  className="action-button"
                  disabled={saving}
                >
                  ✓{" "}
                  {saving
                    ? t("roomNumbers.modal.saving")
                    : editing
                      ? t("roomNumbers.modal.saveChanges")
                      : t("roomNumbers.modal.addRoomNumber")}
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </AdminShell>
  );
}
