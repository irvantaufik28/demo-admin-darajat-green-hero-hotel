import type { ReactNode } from "react";
import Link from "next/link";
import { ReservationDetailActions } from "./ReservationDetailActions";
import { RoomRackAssignRoom } from "./RoomRackAssignRoom";
import type { ApiReservationDetail } from "../services/api";
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
  detail: ApiReservationDetail | null;
  loading: boolean;
  error: string;
  onUpdated: (message: string) => Promise<void>;
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
  detail,
  loading,
  error,
  onUpdated,
  onClose,
}: Props) {
  const isMaintenance = reservation.status === "maintenance";
  const nights = detail?.summary.nights ?? nightCount(reservation.checkIn, reservation.checkOut);
  const bookingTotal = detail?.summary.bookingTotal ?? null;
  const paymentStatus = detail?.reservation.paymentStatus ?? reservation.paymentStatus ?? "unpaid";
  const paidAmount = detail?.summary.paidAmount ?? null;
  const remainingBalance = detail?.summary.remainingBalance ?? null;
  const reservationStatus = detail?.reservation.reservationStatus ?? reservation.reservationStatus;
  const checkedIn = reservationStatus === "checked_in";
  const checkedOut = reservationStatus === "checked_out";
  const checkIn = detail?.reservation.checkInDate ?? reservation.checkIn;
  const checkOut = detail?.reservation.checkOutDate ?? reservation.checkOut;
  const operationalStatus = reservation.operationalStatus?.label ?? (checkedIn
    ? checkOut < todayISO
      ? "Overdue"
      : checkOut === todayISO
        ? "Due Out"
        : checkIn === todayISO
          ? "Checked In"
          : "In House"
    : reservationStatus === "checked_out"
      ? "Checked Out"
    : reservationStatus === "pending"
      ? "Awaiting Confirmation"
    : checkIn === todayISO
      ? "Ready to Check-in"
      : "Upcoming");
  const operationalTone =
    operationalStatus.startsWith("Overdue")
      ? "danger"
      : operationalStatus === "Due Out" || operationalStatus === "Checked In"
        ? "info"
        : operationalStatus === "Checked Out"
          ? "neutral"
        : operationalStatus === "Ready to Check-in" || operationalStatus === "Upcoming"
          ? "warning"
          : "success";

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
            <SummaryRow label="Booking ID">{detail?.reservation.bookingCode ?? reservation.id}</SummaryRow>
            <SummaryRow label="Guest">{detail?.guest.fullName ?? reservation.guestName}</SummaryRow>
            <SummaryRow label="Source">{detail?.reservation.source === "ota" && detail.otaChannel ? `OTA · ${detail.otaChannel.name}` : reservation.source}</SummaryRow>
            <SummaryRow label="Stay Period">
              {dateLabel(checkIn)} → {dateLabel(checkOut)}
            </SummaryRow>
            <SummaryRow label="Room Types">{detail ? detail.rooms.map((item) => item.roomTypeNameSnapshot).join(", ") : group.name}</SummaryRow>
            <SummaryRow label="Room Numbers">
              {detail ? detail.rooms.map((item) => item.roomNumber ?? "Not Assigned").join(", ") : room?.number ?? "Not Assigned"}
            </SummaryRow>
            <div className="reservation-detail-summary-divider" />
            <SummaryRow label="Booking Total">
              {bookingTotal == null ? "—" : formatRupiah(bookingTotal)}
            </SummaryRow>
            <SummaryRow label="Paid Amount">{paidAmount == null ? "—" : formatRupiah(paidAmount)}</SummaryRow>
            <SummaryRow label="Remaining Balance">
              {remainingBalance == null ? "—" : formatRupiah(remainingBalance)}
            </SummaryRow>
            {detail && detail.deposits.length > 0 && (
              <SummaryRow label="Deposit Balance">{formatRupiah(detail.summary.depositBalance)}</SummaryRow>
            )}
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
                label={checkedOut ? "Checked-out" : checkedIn ? "Checked-in" : reservationStatus === "pending" ? "Pending" : "Confirmed"}
                tone={checkedOut ? "neutral" : checkedIn ? "info" : reservationStatus === "pending" ? "warning" : "success"}
              />
            </SummaryRow>
            <SummaryRow label="Operational Status">
              <Badge label={operationalStatus} tone={operationalTone} />
            </SummaryRow>
            {detail && detail.rooms.some((item) => !item.roomUnitId) && (
              <p className="pending-detail-summary-warning">
                Nomor kamar perlu ditetapkan sebelum check-in.
              </p>
            )}
            {detail && remainingBalance != null && remainingBalance > 0 && !checkedOut && (
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
          {loading && <p className="rr-detail-panel__message">Loading reservation detail...</p>}
          {error && <p className="rr-detail-panel__message rr-detail-panel__message--error" role="alert">{error}</p>}
          {detail && reservation.reservationRoomId &&
            (detail.reservation.reservationStatus === "pending" || detail.reservation.reservationStatus === "confirmed") &&
            detail.rooms.some((item) => item.id === reservation.reservationRoomId && !item.roomUnitId) && (
              <RoomRackAssignRoom
                reservationId={detail.reservation.id}
                reservationRoomId={reservation.reservationRoomId}
                onUpdated={onUpdated}
              />
            )}
          {detail && <ReservationDetailActions detail={detail} onUpdated={onUpdated} />}
          <Link className="reservation-secondary-button rr-detail-panel__view-link" href={`/reservations/${encodeURIComponent(detail?.reservation.bookingCode ?? reservation.id)}`}>
            View Reservation
          </Link>
        </div>
      )}
    </aside>
  );
}
