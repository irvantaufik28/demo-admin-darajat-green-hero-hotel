"use client";
import {
  formatRupiah,
  formatStayDate,
  extraBedRates,
  roomTypes,
  extras,
  getExtraCost,
  type RoomType,
} from "../constants/walk-in-data";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

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
  const { t } = useTranslations({ en, id });
  const isPhone = mode === "phone";
  const remainingBalance = Math.max(0, total - amountPaid);

  return (
    <aside className="booking-summary">
      {/* Header */}
      <div className="booking-summary__header">
        <h2>{t("form.summary.title")}</h2>
        <span>{source}</span>
      </div>

      {/* Stay dates */}
      <div className="booking-summary__stay">
        <span>{t("form.summary.stay")}</span>
        <strong>
          {formatStayDate(checkIn)} → {formatStayDate(checkOut)} · {nights}{" "}
          {nights === 1 ? t("common.nightLower") : t("common.nightsLower")}
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
                <span>{t("form.summary.extraBedLine", { roomType: room.name, index: index + 1, nights })}</span>
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
                {extra.perNight ? ` · ${nights} ${t("common.nightsLower")}` : ""}
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
          <div className="booking-summary__empty">{t("form.summary.addOnsEmpty")}</div>
        )}
      </div>

      {/* Totals */}
      <div className="booking-summary__totals">
        <div>
          <strong>{t("form.summary.bookingTotal")}</strong>
          <strong>{formatRupiah(total)}</strong>
        </div>

        {isPhone ? (
          <>
            <div>
              <span>{t("form.summary.paymentStatus")}</span>
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
              <span>{t("form.summary.amountPaid")}</span>
              <span>{formatRupiah(amountPaid)}</span>
            </div>
            <div className="booking-summary__collected">
              <strong>{t("form.summary.remainingBalance")}</strong>
              <strong>{formatRupiah(remainingBalance)}</strong>
            </div>
          </>
        ) : (
          <>
            <div>
              <span>{t("form.summary.deposit")}</span>
              <span>{formatRupiah(deposit)}</span>
            </div>
            <div className="booking-summary__collected">
              <strong>{t("form.summary.totalCollected")}</strong>
              <strong>{formatRupiah(amountPaid + deposit)}</strong>
            </div>
          </>
        )}
      </div>

      {/* Deposit note */}
      {!isPhone && (
        <p className="booking-summary__note">
          {t("form.summary.depositNote")}
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
              {t("form.summary.saveReservation")}
            </button>
            <button
              type="button"
              className="reservation-secondary-button"
              onClick={() => onSave(true)}
            >
              {t("form.summary.saveAndCheckIn")}
            </button>
            <button
              type="button"
              className="reservation-secondary-button"
              onClick={onSaveDraft}
            >
              {t("form.summary.saveAsDraft")}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="action-button"
              onClick={() => onSave(true)}
            >
              {t("form.summary.saveAndCheckIn")}
            </button>
            <button
              type="button"
              className="reservation-secondary-button"
              onClick={() => onSave(false)}
            >
              {t("form.summary.saveReservation")}
            </button>
          </>
        )}
      </div>

      {/* Phone mode note */}
      {isPhone && (
        <p className="booking-summary__note booking-summary__note--after">
          {t("form.summary.phoneNote")}
        </p>
      )}
    </aside>
  );
}
