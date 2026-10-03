import {
  formatRupiah,
  formatStayDate,
  extraBedRates,
  roomTypes,
  extras,
  getExtraCost,
  type RoomType,
} from "../../lib/walk-in-data";

type Props = {
  mode: "walk-in" | "phone";
  source: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  quantities: Record<RoomType, number>;
  selectedExtras: string[];
  extraQuantities: Record<string, number>;
  roomExtraBeds: Record<string, boolean>;
  total: number;
  deposit: number;
  amountPaid: number;
  paymentStatus: "Paid" | "Partial" | "Unpaid";
  onSave: (checkInGuest: boolean) => void;
  onSaveDraft: () => void;
};

export function BookingSummary({
  mode,
  source,
  checkIn,
  checkOut,
  nights,
  quantities,
  selectedExtras,
  extraQuantities,
  roomExtraBeds,
  total,
  deposit,
  amountPaid,
  paymentStatus,
  onSave,
  onSaveDraft,
}: Props) {
  const isPhone = mode === "phone";
  const remainingBalance = Math.max(0, total - amountPaid);

  return (
    <aside className="booking-summary">
      {/* Header */}
      <div className="booking-summary__header">
        <h2>Booking Summary</h2>
        <span>{source}</span>
      </div>

      {/* Stay dates */}
      <div className="booking-summary__stay">
        <span>Stay</span>
        <strong>
          {formatStayDate(checkIn)} → {formatStayDate(checkOut)} · {nights}{" "}
          {nights === 1 ? "night" : "nights"}
        </strong>
      </div>

      {/* Line items */}
      <div className="booking-summary__lines">
        {roomTypes
          .filter((room) => quantities[room.id] > 0)
          .map((room) => (
            <div key={room.id}>
              <span>
                {room.name} × {quantities[room.id]}
              </span>
              <strong>
                {formatRupiah(room.rate * quantities[room.id] * nights)}
              </strong>
            </div>
          ))}

        {roomTypes.flatMap((room) =>
          Array.from({ length: quantities[room.id] }, (_, index) =>
            roomExtraBeds[`${room.id}-${index}`] ? (
              <div key={`bed-${room.id}-${index}`}>
                <span>↳ Extra Bed · {room.name} #{index + 1} · {nights} malam</span>
                <strong>{formatRupiah(extraBedRates[room.id] * nights)}</strong>
              </div>
            ) : null,
          ),
        )}

        {selectedExtras.map((id) => {
          const extra = extras.find((item) => item.id === id);
          if (!extra) return null;
          return (
            <div key={id}>
              <span>
                {extra.label} × {extraQuantities[id] ?? 1}
                {extra.perNight ? ` · ${nights} malam` : ""}
              </span>
              <strong>
                {formatRupiah(
                  getExtraCost(id, extraQuantities[id] ?? 1, nights),
                )}
              </strong>
            </div>
          );
        })}

        {selectedExtras.length === 0 && !Object.values(roomExtraBeds).some(Boolean) && (
          <div className="booking-summary__empty">Belum ada add-on</div>
        )}
      </div>

      {/* Totals */}
      <div className="booking-summary__totals">
        <div>
          <strong>Booking Total</strong>
          <strong>{formatRupiah(total)}</strong>
        </div>

        {isPhone ? (
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
              <span>{formatRupiah(amountPaid)}</span>
            </div>
            <div className="booking-summary__collected">
              <strong>Remaining Balance</strong>
              <strong>{formatRupiah(remainingBalance)}</strong>
            </div>
          </>
        ) : (
          <>
            <div>
              <span>Deposit</span>
              <span>{formatRupiah(deposit)}</span>
            </div>
            <div className="booking-summary__collected">
              <strong>Total Collected</strong>
              <strong>{formatRupiah(amountPaid + deposit)}</strong>
            </div>
          </>
        )}
      </div>

      {/* Deposit note */}
      {!isPhone && (
        <p className="booking-summary__note">
          Deposit is held separately and is not included in booking revenue.
        </p>
      )}

      {/* Actions */}
      <div className="booking-summary__actions">
        {isPhone ? (
          <>
            <button
              type="button"
              className="action-button"
              onClick={() => onSave(false)}
            >
              Save Reservation
            </button>
            <button
              type="button"
              className="reservation-secondary-button"
              onClick={() => onSave(true)}
            >
              Save &amp; Check-in
            </button>
            <button
              type="button"
              className="reservation-secondary-button"
              onClick={onSaveDraft}
            >
              Save as Draft
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="action-button"
              onClick={() => onSave(true)}
            >
              Save &amp; Check-in
            </button>
            <button
              type="button"
              className="reservation-secondary-button"
              onClick={() => onSave(false)}
            >
              Save Reservation
            </button>
          </>
        )}
      </div>

      {/* Phone mode note */}
      {isPhone && (
        <p className="booking-summary__note booking-summary__note--after">
          Nomor kamar dapat diubah saat tamu tiba. Check-in dengan sisa tagihan
          memerlukan konfirmasi petugas.
        </p>
      )}
    </aside>
  );
}
