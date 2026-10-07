import type { ReactNode } from "react";
import {
  formatRupiah,
  type Reservation,
  type RoomTypeGroup,
  type RoomUnit,
} from "../constants/room-rack-data";

type Props = {
  reservation: Reservation;
  room: RoomUnit | null;
  group: RoomTypeGroup;
  todayISO: string;
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
  todayISO,
  onClose,
}: Props) {
  const isMaintenance = reservation.status === "maintenance";
  const nights = nightCount(reservation.checkIn, reservation.checkOut);
  const bookingTotal = reservation.bookingTotal ?? null;
  const paymentStatus = reservation.paymentStatus ?? "unpaid";
  const paidAmount = reservation.paidAmount ?? null;
  const remainingBalance = bookingTotal != null && paidAmount != null
    ? Math.max(0, bookingTotal - paidAmount)
    : null;
  const checkedIn = reservation.reservationStatus === "checked_in";
  const checkedOut = reservation.reservationStatus === "checked_out";
  const operationalStatus = reservation.operationalStatus?.label ?? (checkedIn
    ? reservation.checkOut < todayISO
      ? "Overdue"
      : reservation.checkOut === todayISO
        ? "Due Out"
        : reservation.checkIn === todayISO
          ? "Checked In"
          : "In House"
    : reservation.reservationStatus === "checked_out"
      ? "Checked Out"
    : reservation.reservationStatus === "pending"
      ? "Awaiting Confirmation"
    : reservation.checkIn === todayISO
      ? "Ready to Check-in"
      : "Upcoming");
  const operationalTone =
    operationalStatus === "Overdue"
      ? "danger"
      : operationalStatus === "Due Out" || operationalStatus === "Checked In"
        ? "info"
        : operationalStatus === "Ready to Check-in" || operationalStatus === "Upcoming"
          ? "warning"
          : "success";
  const mainAction = !room
    ? "Assign Room"
    : checkedIn
      ? "Check Out Guest"
      : checkedOut
        ? "View Reservation"
      : paymentStatus !== "paid"
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
              {group.name} · Room {room?.number ?? "—"}
            </SummaryRow>
            <SummaryRow label="Period">
              {dateLabel(reservation.checkIn)} → {dateLabel(reservation.checkOut)}
            </SummaryRow>
            <SummaryRow label="Status">
              <Badge label="Maintenance" tone="warning" />
            </SummaryRow>
            <SummaryRow label="Reason">
              {reservation.maintenanceNote || room?.maintenanceNote || "Scheduled maintenance"}
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
            <SummaryRow label="Room Numbers">
              {room?.number ?? "Not Assigned"}
            </SummaryRow>
            <div className="reservation-detail-summary-divider" />
            <SummaryRow label="Booking Total">
              {bookingTotal == null ? "—" : formatRupiah(bookingTotal)}
            </SummaryRow>
            <SummaryRow label="Paid Amount">{paidAmount == null ? "—" : formatRupiah(paidAmount)}</SummaryRow>
            <SummaryRow label="Remaining Balance">
              {remainingBalance == null ? "—" : formatRupiah(remainingBalance)}
            </SummaryRow>
            <SummaryRow label="Payment Status">
              <Badge
                label={paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1)}
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
                label={reservation.reservationStatus === "checked_out" ? "Checked-out" : checkedIn ? "Checked-in" : reservation.reservationStatus === "pending" ? "Pending" : "Confirmed"}
                tone={checkedIn ? "info" : reservation.reservationStatus === "pending" ? "warning" : "success"}
              />
            </SummaryRow>
            <SummaryRow label="Operational Status">
              <Badge label={operationalStatus} tone={operationalTone} />
            </SummaryRow>
            {!room && (
              <p className="pending-detail-summary-warning">
                Nomor kamar perlu ditetapkan sebelum check-in.
              </p>
            )}
            {paymentStatus !== "paid" && !checkedOut && (
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
          {paymentStatus !== "paid" && !checkedOut && (
            <button type="button" className="action-button" disabled>
              Record Payment
            </button>
          )}
          {!checkedIn && !checkedOut && (
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
