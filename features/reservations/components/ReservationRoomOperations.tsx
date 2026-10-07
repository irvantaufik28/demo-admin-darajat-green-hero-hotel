"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getCurrentUser } from "../../../lib/auth";
import {
  changeReservationExtraBeds,
  changeReservationRoom,
  getChangeRoomOptions,
  getChangeRoomQuote,
  getExtraBedQuote,
  type ApiReservationDetail,
  type ChangeRoomOption,
  type ChangeRoomQuote,
  type ExtraBedQuote,
} from "../services/api";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

type Room = ApiReservationDetail["rooms"][number];
type Operation = "room" | "bed";

function rupiah(value: number) {
  return `Rp${new Intl.NumberFormat("id-ID").format(value)}`;
}

function dateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

export function ReservationRoomOperations({ detail, room, onUpdated }: {
  detail: ApiReservationDetail;
  room: Room;
  onUpdated: (message: string) => Promise<void>;
}) {
  const { t } = useTranslations({ en, id });
  const [operation, setOperation] = useState<Operation | null>(null);
  const [options, setOptions] = useState<ChangeRoomOption[]>([]);
  const [targetRoomUnitId, setTargetRoomUnitId] = useState("");
  const [roomQuote, setRoomQuote] = useState<ChangeRoomQuote | null>(null);
  const [bedQuote, setBedQuote] = useState<ExtraBedQuote | null>(null);
  const [bedQuantity, setBedQuantity] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const permissions = getCurrentUser()?.permissions ?? [];

  async function open(next: Operation) {
    setOperation(next);
    setError("");
    setRoomQuote(null);
    setBedQuote(null);
    setTargetRoomUnitId("");
    setLoading(true);
    try {
      if (next === "room") {
        const result = await getChangeRoomOptions(detail.reservation.id, room.id);
        setOptions(result.options);
      } else {
        const result = await getExtraBedQuote(detail.reservation.id, room.id, 0);
        setBedQuantity(result.previousQuantity);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("roomOperations.loadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!operation || (operation === "room" && !targetRoomUnitId)) return;
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      const request = operation === "room"
        ? getChangeRoomQuote(detail.reservation.id, room.id, targetRoomUnitId)
        : getExtraBedQuote(detail.reservation.id, room.id, bedQuantity);
      request.then((quote) => {
        if (!active) return;
        if (operation === "room") setRoomQuote(quote as ChangeRoomQuote);
        else setBedQuote(quote as ExtraBedQuote);
        setError("");
      }).catch((cause) => {
        if (!active) return;
        setRoomQuote(null);
        setBedQuote(null);
        setError(cause instanceof Error ? cause.message : t("roomOperations.changeUnavailable"));
      }).finally(() => { if (active) setLoading(false); });
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [operation, targetRoomUnitId, bedQuantity, detail.reservation.id, room.id]);

  async function save() {
    if (saving || loading) return;
    setSaving(true);
    setError("");
    try {
      if (operation === "room" && roomQuote) {
        await changeReservationRoom(detail.reservation.id, room.id, {
          targetRoomUnitId: roomQuote.targetRoomUnitId,
          expectedVersion: roomQuote.version,
        });
        setOperation(null);
        await onUpdated(t("roomOperations.roomChangedSuccess"));
      } else if (operation === "bed" && bedQuote) {
        await changeReservationExtraBeds(detail.reservation.id, room.id, {
          quantity: bedQuote.quantity,
          expectedVersion: bedQuote.version,
        });
        setOperation(null);
        await onUpdated(t("roomOperations.extraBedUpdatedSuccess"));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("roomOperations.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="api-reservation-room-actions">
        <button type="button" className="reservation-secondary-button"
          disabled={!permissions.includes("reservations.change_room")}
          onClick={() => void open("room")}>{t("roomOperations.changeRoom")}</button>
        <button type="button" className="reservation-secondary-button"
          disabled={!permissions.includes("reservations.manage_extra_bed")}
          onClick={() => void open("bed")}>{t("roomOperations.manageExtraBed")}</button>
      </div>
      {operation && createPortal(
        <div className="reservation-operation-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setOperation(null);
        }}>
          <section className="reservation-operation-modal api-reservation-modal api-room-operation-modal"
            role="dialog" aria-modal="true" aria-labelledby="room-operation-title">
            <div className="reservation-operation-header">
              <h2 id="room-operation-title">{operation === "room" ? t("roomOperations.changeRoom") : t("roomOperations.manageExtraBed")}</h2>
              <button type="button" disabled={saving} onClick={() => setOperation(null)} aria-label={t("common.closeModal")}>×</button>
            </div>
            <div className="api-reservation-modal-body">
              <div className="api-room-operation-current">
                <strong>{t("roomOperations.current", { roomType: room.roomTypeNameSnapshot, roomNumber: room.roomNumber ?? t("common.emptyDash") })}</strong>
                <span>{room.adults} {t("common.adults")}{room.children ? ` · ${room.children} ${t("common.children")}` : ""}</span>
              </div>
              {operation === "room" ? (
                <>
                  <p>{t("roomOperations.changeRoomDescription")}</p>
                  <label>{t("roomOperations.availableRoom")}
                    <select value={targetRoomUnitId} onChange={(event) => { setTargetRoomUnitId(event.target.value); setRoomQuote(null); setError(""); }}>
                      <option value="">{t("roomOperations.selectRoom")}</option>
                      {options.map((option) => (
                        <option key={option.id} value={option.id} disabled={!option.available}>
                          {t("roomOperations.roomOption", { roomType: option.roomTypeName, roomNumber: option.roomNumber })}{option.available ? "" : ` — ${option.reason}`}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!loading && !options.some((option) => option.available) && !error && <p>{t("roomOperations.noRoomsAvailable")}</p>}
                  {roomQuote && <div className="api-room-operation-quote">
                    <strong>{t("roomOperations.nightsRange", { from: dateLabel(roomQuote.effectiveDate), to: dateLabel(roomQuote.checkOutDate), nights: roomQuote.nights })}</strong>
                    <div><span>{t("roomOperations.oldRoomRate")}</span><strong>{rupiah(roomQuote.oldRoomAmount)}</strong></div>
                    <div><span>{t("roomOperations.newRoomRate")}</span><strong>{rupiah(roomQuote.newRoomAmount)}</strong></div>
                    {roomQuote.extraBedQuantity > 0 && <div><span>{t("roomOperations.extraBedRateDifference")}</span><strong>{rupiah(roomQuote.extraBedDifference)}</strong></div>}
                    <div className="api-room-operation-total"><span>{t("roomOperations.differenceAdded")}</span><strong>{rupiah(roomQuote.totalDifference)}</strong></div>
                    {roomQuote.totalDifference < 0 && <small>{t("roomOperations.creditNote")}</small>}
                  </div>}
                </>
              ) : (
                <>
                  <p>{t("roomOperations.extraBedDescription")}</p>
                  <label>{t("roomOperations.extraBedsLabel")}
                    <select value={bedQuantity} onChange={(event) => { setBedQuantity(Number(event.target.value)); setBedQuote(null); setError(""); }}>
                      {Array.from({ length: (bedQuote?.maxExtraBeds ?? Math.max(0, bedQuantity)) + 1 }, (_, index) => (
                        <option key={index} value={index}>{index === 1 ? t("roomOperations.bedOptionSingular", { count: index }) : t("roomOperations.bedOption", { count: index })}</option>
                      ))}
                    </select>
                  </label>
                  {bedQuote && <div className="api-room-operation-quote">
                    <strong>{t("roomOperations.nightsRange", { from: dateLabel(bedQuote.effectiveDate), to: dateLabel(bedQuote.checkOutDate), nights: bedQuote.nights })}</strong>
                    <div><span>{t("roomOperations.currentExtraBeds")}</span><strong>{bedQuote.previousQuantity}</strong></div>
                    <div><span>{t("roomOperations.pricePerBedNight")}</span><strong>{rupiah(bedQuote.unitPricePerNight)}</strong></div>
                    <div><span>{t("roomOperations.previouslyBilled")}</span><strong>{rupiah(bedQuote.previousRemainingAmount)}</strong></div>
                    <div><span>{t("roomOperations.newAmount")}</span><strong>{rupiah(bedQuote.newAmount)}</strong></div>
                    <div className="api-room-operation-total"><span>{t("roomOperations.differenceAdded")}</span><strong>{rupiah(bedQuote.difference)}</strong></div>
                  </div>}
                </>
              )}
              {loading && <p>{t("roomOperations.checkingAvailability")}</p>}
              {error && <p className="api-reservation-error" role="alert">{error}</p>}
            </div>
            <div className="api-reservation-modal-footer">
              <button type="button" className="reservation-secondary-button" disabled={saving} onClick={() => setOperation(null)}>{t("common.cancel")}</button>
              <button type="button" className="action-button" disabled={saving || loading || (operation === "room" ? !roomQuote : !bedQuote || (bedQuote.quantity === bedQuote.previousQuantity && bedQuote.difference === 0))}
                onClick={() => void save()}>{saving ? t("common.saving") : t("roomOperations.saveChanges")}</button>
            </div>
          </section>
        </div>, document.body)}
    </>
  );
}
