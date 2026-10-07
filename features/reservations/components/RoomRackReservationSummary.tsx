import type { ReactNode } from "react";
import {
  RACK_START_DATE,
  formatRupiah,
  type Reservation,
  type RoomTypeGroup,
  type RoomUnit,
} from "../constants/room-rack-data";

type Props = {
  reservation: Reservation;
  room: RoomUnit;
  group: RoomTypeGroup;
  onClose: () => void;
};

function dateLabel(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function nightCount(checkIn: string, checkOut: string): number {
  const start = Date.parse(`${checkIn}T00:00:00Z`);
  const end = Date.parse(`${checkOut}T00:00:00Z`);
  return Math.max(1, Math.round((end - start) / 86_400_000));
}

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="reservation-detail-row">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

function Badge({ label, tone }: { label: string; tone: string }) {
  return <span className={`status-badge status-badge--${tone}`}>{label}</span>;
}

export function RoomRackReservationSummary({
  reservation,
  room,
  group,
  onClose,
}: Props) {
  const isMaintenance = reservation.id.startsWith("MNT");
  const nights = nightCount(reservation.checkIn, reservation.checkOut);
  const bookingTotal = Math.round(group.dailyRates[0] * nights * 1.16);
  const paymentStatus = reservation.paymentStatus ?? "unpaid";
  const paidAmount =
    paymentStatus === "paid"
      ? bookingTotal
      : paymentStatus === "partial"
        ? Math.min(reservation.paidAmount ?? 0, bookingTotal)
        : 0;
  const remainingBalance = Math.max(0, bookingTotal - paidAmount);
  const checkedIn = reservation.reservationStatus === "checked_in";
  const operationalStatus = checkedIn
    ? reservation.checkOut < RACK_START_DATE
      ? "Overdue"
      : reservation.checkOut === RACK_START_DATE
        ? "Due Out"
        : reservation.checkIn === RACK_START_DATE
          ? "Checked In"
          : "In House"
    : reservation.checkIn === RACK_START_DATE
      ? "Ready to Check-in"
      : "Upcoming";
  const operationalTone =
    operationalStatus === "Overdue"
      ? "danger"
      : operationalStatus === "Due Out" || operationalStatus === "Checked In"
        ? "info"
        : operationalStatus === "Ready to Check-in" || operationalStatus === "Upcoming"
          ? "warning"
          : "success";
  const mainAction = checkedIn
    ? "Check Out Guest"
    : remainingBalance > 0
      ? "Confirm & Check-in"
      : "Check-in Guest";

  return (
    <aside
      className="reservation-detail-summary rr-detail-panel"
      aria-label={isMaintenance ? "Room maintenance summary" : "Reservation summary"}
    >
      <div className="reservation-detail-section-title rr-detail-panel__header">
        <div>
          <h2>
            {isMaintenance
              ? "Room Maintenance"
              : checkedIn
                ? "Stay Summary"
                : "Reservation Summary"}
          </h2>
          <span>
            {nights} {nights === 1 ? "Night" : "Nights"}
          </span>
        </div>
        <button
          type="button"
          className="rr-detail__close"
          onClick={onClose}
          aria-label="Close summary"
        >
          ×
        </button>
      </div>

      <div className="reservation-detail-summary-rows">
        {isMaintenance ? (
          <>
            <SummaryRow label="Room">
              {group.name} · Room {room.number}
            </SummaryRow>
            <SummaryRow label="Period">
              {dateLabel(reservation.checkIn)} → {dateLabel(reservation.checkOut)}
            </SummaryRow>
            <SummaryRow label="Status">
              <Badge label="Maintenance" tone="warning" />
            </SummaryRow>
            <SummaryRow label="Reason">
              {room.maintenanceNote || "Scheduled maintenance"}
            </SummaryRow>
          </>
        ) : (
          <>
            <SummaryRow label="Booking ID">{reservation.id}</SummaryRow>
            <SummaryRow label="Guest">{reservation.guestName}</SummaryRow>
            <SummaryRow label="Source">{reservation.source}</SummaryRow>
            <SummaryRow label="Stay Period">
              {dateLabel(reservation.checkIn)} → {dateLabel(reservation.checkOut)}
            </SummaryRow>
            <SummaryRow label="Room Types">{group.name}</SummaryRow>
            <SummaryRow label="Room Numbers">{room.number}</SummaryRow>
            <div className="reservation-detail-summary-divider" />
            <SummaryRow label="Booking Total">
              {formatRupiah(bookingTotal)}
            </SummaryRow>
            <SummaryRow label="Paid Amount">{formatRupiah(paidAmount)}</SummaryRow>
            <SummaryRow label="Remaining Balance">
              {formatRupiah(remainingBalance)}
            </SummaryRow>
            <SummaryRow label="Payment Status">
              <Badge
                label={
                  paymentStatus === "paid"
                    ? "Paid"
                    : paymentStatus === "partial"
                      ? "Partial"
                      : "Unpaid"
                }
                tone={
                  paymentStatus === "paid"
                    ? "success"
                    : paymentStatus === "partial"
                      ? "warning"
                      : "danger"
                }
              />
            </SummaryRow>
            <SummaryRow label="Reservation Status">
              <Badge
                label={checkedIn ? "Checked-in" : "Confirmed"}
                tone={checkedIn ? "info" : "success"}
              />
            </SummaryRow>
            <SummaryRow label="Operational Status">
              <Badge label={operationalStatus} tone={operationalTone} />
            </SummaryRow>
            {remainingBalance > 0 && (
              <p className="pending-detail-summary-warning">
                {checkedIn
                  ? "Tamu sedang menginap dengan sisa tagihan yang perlu ditindaklanjuti."
                  : "Check-in dengan sisa tagihan memerlukan konfirmasi petugas."}
              </p>
            )}
          </>
        )}
      </div>
      {!isMaintenance && (
        <div className="rr-detail-panel__actions">
          <button type="button" className="action-button" disabled>
            {mainAction}
          </button>
          {remainingBalance > 0 && (
            <button type="button" className="action-button" disabled>
              Record Payment
            </button>
          )}
          {!checkedIn && (
            <button type="button" className="reservation-secondary-button" disabled>
              Cancel Reservation
            </button>
          )}
          {checkedIn && (
            <>
              <button type="button" className="reservation-secondary-button" disabled>
                Extend Stay
              </button>
              <button type="button" className="reservation-secondary-button" disabled>
                Add Experience or Add-on
              </button>
              <button type="button" className="reservation-secondary-button" disabled>
                Save Bill
              </button>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
