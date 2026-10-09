"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { ReservationDetailActions } from "./ReservationDetailActions";
import { RoomRackAssignRoom } from "./RoomRackAssignRoom";
import { RoomRackUnassignRoom } from "./RoomRackUnassignRoom";
import type { ApiReservationDetail } from "../services/api";
import { noShowSettlementPresentation } from "../utils/detail-rules";
import {
  formatRupiah,
  type Reservation,
  type RoomTypeGroup,
  type RoomUnit,
} from "../constants/room-rack-data";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

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
  const { t } = useTranslations({ en, id });
  const isMaintenance = reservation.status === "maintenance";
  const nights =
    detail?.summary.nights ??
    nightCount(reservation.checkIn, reservation.checkOut);
  const bookingTotal = detail?.summary.bookingTotal ?? null;
  const paymentStatus =
    detail?.reservation.paymentStatus ?? reservation.paymentStatus ?? "unpaid";
  const paidAmount = detail?.summary.paidAmount ?? null;
  const remainingBalance = detail?.summary.remainingBalance ?? null;
  const reservationStatus =
    detail?.reservation.reservationStatus ?? reservation.reservationStatus;
  const checkedIn = reservationStatus === "checked_in";
  const checkedOut = reservationStatus === "checked_out";
  const noShow = reservationStatus === "no_show";
  const noShowSettlement =
    detail && noShow ? noShowSettlementPresentation(detail) : null;
  const checkIn = detail?.reservation.checkInDate ?? reservation.checkIn;
  const checkOut = detail?.reservation.checkOutDate ?? reservation.checkOut;
  const operationalStatus =
    reservation.operationalStatus?.label ??
    (checkedIn
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
    reservation.operationalStatus?.code === "missed_arrival" ||
    operationalStatus.startsWith("Overdue")
      ? "danger"
      : operationalStatus === "Due Out" || operationalStatus === "Checked In"
        ? "info"
        : operationalStatus === "Checked Out"
          ? "neutral"
          : operationalStatus === "Ready to Check-in" ||
              operationalStatus === "Upcoming"
            ? "warning"
            : "success";

  return (
    <aside
      className="reservation-detail-summary rr-detail-panel"
      aria-label={
        isMaintenance
          ? t("roomRack.summary.ariaMaintenance")
          : t("roomRack.summary.ariaReservation")
      }
    >
      <div className="reservation-detail-section-title rr-detail-panel__header">
        <div>
          <h2>
            {isMaintenance
              ? t("roomRack.summary.roomMaintenance")
              : checkedIn
                ? t("roomRack.summary.staySummary")
                : t("roomRack.summary.reservationSummary")}
          </h2>
          <span>
            {nights === 1
              ? t("roomRack.summary.nightLabel", { count: nights })
              : t("roomRack.summary.nightsLabel", { count: nights })}
          </span>
        </div>
        <button
          type="button"
          className="rr-detail__close"
          onClick={onClose}
          aria-label={t("roomRack.summary.close")}
        >
          ×
        </button>
      </div>

      <div className="reservation-detail-summary-rows">
        {isMaintenance ? (
          <>
            <SummaryRow label={t("roomRack.summary.room")}>
              {group.name} · Room {room?.number ?? t("common.emptyDash")}
            </SummaryRow>
            <SummaryRow label={t("roomRack.summary.period")}>
              {dateLabel(reservation.checkIn)} →{" "}
              {dateLabel(reservation.checkOut)}
            </SummaryRow>
            <SummaryRow label={t("roomRack.summary.status")}>
              <Badge label={t("roomRack.summary.maintenance")} tone="warning" />
            </SummaryRow>
            <SummaryRow label={t("roomRack.summary.reason")}>
              {reservation.maintenanceNote ||
                room?.maintenanceNote ||
                t("roomRack.summary.scheduledMaintenance")}
            </SummaryRow>
          </>
        ) : (
          <>
            <SummaryRow label={t("roomRack.summary.bookingId")}>
              {detail?.reservation.bookingCode ?? reservation.id}
            </SummaryRow>
            <SummaryRow label={t("roomRack.summary.guest")}>
              {detail?.guest.fullName ?? reservation.guestName}
            </SummaryRow>
            <SummaryRow label={t("roomRack.summary.source")}>
              {detail?.reservation.source === "ota" && detail.otaChannel
                ? `OTA · ${detail.otaChannel.name}`
                : reservation.source}
            </SummaryRow>
            <SummaryRow label={t("roomRack.summary.stayPeriod")}>
              {dateLabel(checkIn)} → {dateLabel(checkOut)}
            </SummaryRow>
            <SummaryRow label={t("roomRack.summary.roomTypes")}>
              {detail
                ? detail.rooms
                    .map((item) => item.roomTypeNameSnapshot)
                    .join(", ")
                : group.name}
            </SummaryRow>
            <SummaryRow label={t("roomRack.summary.roomNumbers")}>
              {detail
                ? detail.rooms
                    .map(
                      (item) =>
                        item.roomNumber ?? t("roomRack.summary.notAssigned"),
                    )
                    .join(", ")
                : (room?.number ?? t("roomRack.summary.notAssigned"))}
            </SummaryRow>
            <div className="reservation-detail-summary-divider" />
            <SummaryRow label={t("roomRack.summary.bookingTotal")}>
              {bookingTotal == null
                ? t("common.emptyDash")
                : formatRupiah(bookingTotal)}
            </SummaryRow>
            <SummaryRow label={t("roomRack.summary.paidAmount")}>
              {paidAmount == null
                ? t("common.emptyDash")
                : formatRupiah(paidAmount)}
            </SummaryRow>
            <SummaryRow label={t("roomRack.summary.remainingBalance")}>
              {remainingBalance == null
                ? t("common.emptyDash")
                : formatRupiah(remainingBalance)}
            </SummaryRow>
            {detail && detail.deposits.length > 0 && (
              <SummaryRow label={t("detail.fields.depositBalance")}>
                {formatRupiah(detail.summary.depositBalance)}
              </SummaryRow>
            )}
            <SummaryRow label={t("roomRack.summary.paymentStatus")}>
              <Badge
                label={
                  paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1)
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
            <SummaryRow label={t("roomRack.summary.reservationStatus")}>
              <Badge
                label={
                  checkedOut
                    ? "Checked-out"
                    : checkedIn
                      ? "Checked-in"
                      : noShow
                        ? "No Show"
                      : reservationStatus === "pending"
                        ? "Pending"
                        : "Confirmed"
                }
                tone={
                  checkedOut
                    ? "neutral"
                    : checkedIn
                      ? "info"
                      : noShow
                        ? "danger"
                      : reservationStatus === "pending"
                        ? "warning"
                        : "success"
                }
              />
            </SummaryRow>
            {noShowSettlement && (
              <SummaryRow label={t("detail.fields.settlement")}>
                {noShowSettlement.label}
              </SummaryRow>
            )}
            <SummaryRow label={t("roomRack.summary.operationalStatus")}>
              <Badge label={operationalStatus} tone={operationalTone} />
            </SummaryRow>
            {detail && detail.rooms.some((item) => !item.roomUnitId) && (
              <p className="pending-detail-summary-warning">
                {t("roomRack.summary.assignRoomWarning")}
              </p>
            )}
            {detail &&
              remainingBalance != null &&
              remainingBalance > 0 &&
              !checkedOut && (
                <p className="pending-detail-summary-warning">
                  {checkedIn
                    ? t("roomRack.summary.checkedInBalanceWarning")
                    : t("roomRack.summary.checkInBalanceWarning")}
                </p>
              )}
          </>
        )}
      </div>
      {!isMaintenance && (
        <div className="rr-detail-panel__actions">
          {loading && (
            <p className="rr-detail-panel__message">
              {t("roomRack.summary.loadingDetail")}
            </p>
          )}
          {error && (
            <p
              className="rr-detail-panel__message rr-detail-panel__message--error"
              role="alert"
            >
              {error}
            </p>
          )}
          {detail &&
            reservation.reservationRoomId &&
            (detail.reservation.reservationStatus === "pending" ||
              detail.reservation.reservationStatus === "confirmed") &&
            detail.rooms.some(
              (item) =>
                item.id === reservation.reservationRoomId && !item.roomUnitId,
            ) && (
              <RoomRackAssignRoom
                reservationId={detail.reservation.id}
                reservationRoomId={reservation.reservationRoomId}
                onUpdated={onUpdated}
              />
            )}
          {detail &&
            reservation.reservationRoomId &&
            (detail.reservation.reservationStatus === "pending" ||
              detail.reservation.reservationStatus === "confirmed") &&
            detail.rooms
              .filter(
                (item) =>
                  item.id === reservation.reservationRoomId && item.roomUnitId,
              )
              .map((item) => (
                <RoomRackUnassignRoom
                  key={item.id}
                  reservationId={detail.reservation.id}
                  reservationRoomId={item.id}
                  roomNumber={item.roomNumber ?? t("common.emptyDash")}
                  onUpdated={onUpdated}
                />
              ))}
          {detail && (
            <ReservationDetailActions
              detail={detail}
              onUpdated={onUpdated}
              todayISO={todayISO}
            />
          )}
          <Link
            className="reservation-secondary-button rr-detail-panel__view-link"
            href={`/reservations/${encodeURIComponent(detail?.reservation.bookingCode ?? reservation.id)}`}
          >
            {t("roomRack.summary.viewReservation")}
          </Link>
        </div>
      )}
    </aside>
  );
}
