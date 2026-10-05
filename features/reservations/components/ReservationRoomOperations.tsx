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
      setError(cause instanceof Error ? cause.message : "Data kamar gagal dimuat.");
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
        setError(cause instanceof Error ? cause.message : "Perubahan tidak tersedia.");
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
        await onUpdated("Kamar berhasil diganti. Selisih biaya tercatat di Charges & Payments.");
      } else if (operation === "bed" && bedQuote) {
        await changeReservationExtraBeds(detail.reservation.id, room.id, {
          quantity: bedQuote.quantity,
          expectedVersion: bedQuote.version,
        });
        setOperation(null);
        await onUpdated("Extra bed berhasil diperbarui. Selisih biaya tercatat di Charges & Payments.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Perubahan gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="api-reservation-room-actions">
        <button type="button" className="reservation-secondary-button"
          disabled={!permissions.includes("reservations.change_room")}
          onClick={() => void open("room")}>Change Room</button>
        <button type="button" className="reservation-secondary-button"
          disabled={!permissions.includes("reservations.manage_extra_bed")}
          onClick={() => void open("bed")}>Manage Extra Bed</button>
      </div>
      {operation && createPortal(
        <div className="reservation-operation-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setOperation(null);
        }}>
          <section className="reservation-operation-modal api-reservation-modal api-room-operation-modal"
            role="dialog" aria-modal="true" aria-labelledby="room-operation-title">
            <div className="reservation-operation-header">
              <h2 id="room-operation-title">{operation === "room" ? "Change Room" : "Manage Extra Bed"}</h2>
              <button type="button" disabled={saving} onClick={() => setOperation(null)} aria-label="Close modal">×</button>
            </div>
            <div className="api-reservation-modal-body">
              <div className="api-room-operation-current">
                <strong>{room.roomTypeNameSnapshot} · Room {room.roomNumber ?? "—"}</strong>
                <span>{room.adults} Adults{room.children ? ` · ${room.children} Children` : ""}</span>
              </div>
              {operation === "room" ? (
                <>
                  <p>Pilih kamar untuk sisa masa inap. Kamar lama akan berstatus Cleaning.</p>
                  <label>Available room
                    <select value={targetRoomUnitId} onChange={(event) => { setTargetRoomUnitId(event.target.value); setRoomQuote(null); setError(""); }}>
                      <option value="">Select room</option>
                      {options.map((option) => (
                        <option key={option.id} value={option.id} disabled={!option.available}>
                          {option.roomTypeName} · Room {option.roomNumber}{option.available ? "" : ` — ${option.reason}`}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!loading && !options.some((option) => option.available) && !error && <p>No rooms available for the remaining stay.</p>}
                  {roomQuote && <div className="api-room-operation-quote">
                    <strong>{dateLabel(roomQuote.effectiveDate)} – {dateLabel(roomQuote.checkOutDate)} · {roomQuote.nights} nights</strong>
                    <div><span>Old room rate</span><strong>{rupiah(roomQuote.oldRoomAmount)}</strong></div>
                    <div><span>New room rate</span><strong>{rupiah(roomQuote.newRoomAmount)}</strong></div>
                    {roomQuote.extraBedQuantity > 0 && <div><span>Extra bed rate difference</span><strong>{rupiah(roomQuote.extraBedDifference)}</strong></div>}
                    <div className="api-room-operation-total"><span>Difference added to Charges & Payments</span><strong>{rupiah(roomQuote.totalDifference)}</strong></div>
                    {roomQuote.totalDifference < 0 && <small>Credit reduces the outstanding balance. Any excess refund needs separate handling.</small>}
                  </div>}
                </>
              ) : (
                <>
                  <p>Jumlah extra bed berlaku mulai hari ini sampai tanggal check-out.</p>
                  <label>Extra beds for this room
                    <select value={bedQuantity} onChange={(event) => { setBedQuantity(Number(event.target.value)); setBedQuote(null); setError(""); }}>
                      {Array.from({ length: (bedQuote?.maxExtraBeds ?? Math.max(0, bedQuantity)) + 1 }, (_, index) => (
                        <option key={index} value={index}>{index} bed{index === 1 ? "" : "s"}</option>
                      ))}
                    </select>
                  </label>
                  {bedQuote && <div className="api-room-operation-quote">
                    <strong>{dateLabel(bedQuote.effectiveDate)} – {dateLabel(bedQuote.checkOutDate)} · {bedQuote.nights} nights</strong>
                    <div><span>Current extra beds</span><strong>{bedQuote.previousQuantity}</strong></div>
                    <div><span>Price per bed / night</span><strong>{rupiah(bedQuote.unitPricePerNight)}</strong></div>
                    <div><span>Previously billed for remaining nights</span><strong>{rupiah(bedQuote.previousRemainingAmount)}</strong></div>
                    <div><span>New amount for remaining nights</span><strong>{rupiah(bedQuote.newAmount)}</strong></div>
                    <div className="api-room-operation-total"><span>Difference added to Charges & Payments</span><strong>{rupiah(bedQuote.difference)}</strong></div>
                  </div>}
                </>
              )}
              {loading && <p>Checking availability and charges...</p>}
              {error && <p className="api-reservation-error" role="alert">{error}</p>}
            </div>
            <div className="api-reservation-modal-footer">
              <button type="button" className="reservation-secondary-button" disabled={saving} onClick={() => setOperation(null)}>Cancel</button>
              <button type="button" className="action-button" disabled={saving || loading || (operation === "room" ? !roomQuote : !bedQuote || (bedQuote.quantity === bedQuote.previousQuantity && bedQuote.difference === 0))}
                onClick={() => void save()}>{saving ? "Saving..." : "Save Changes"}</button>
            </div>
          </section>
        </div>, document.body)}
    </>
  );
}
