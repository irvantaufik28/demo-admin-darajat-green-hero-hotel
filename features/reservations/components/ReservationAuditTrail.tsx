"use client";
import type { ReservationHistoryItem } from "../services/api";
import { useTranslations, type Translate } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

const statusKeys: Record<string, string> = {
  pending: "status.pending",
  confirmed: "status.confirmed",
  checked_in: "status.checkedIn",
  checked_out: "status.checkedOut",
  cancelled: "status.cancelled",
  expired: "status.expired",
  unpaid: "status.unpaid",
  partial: "status.partial",
  paid: "status.paid",
  refunded: "status.refunded",
  failed: "status.failed",
};

function statusLabel(t: Translate, value: string): string {
  const key = statusKeys[value];
  return key ? t(key) : value;
}

function text(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function amount(value: unknown): string | null {
  const number = typeof value === "number" ? value : Number(value);
  return value === null || value === undefined || !Number.isFinite(number)
    ? null
    : `Rp${new Intl.NumberFormat("id-ID").format(number)}`;
}

function date(value: unknown): string | null {
  const raw = text(value);
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(`${raw}T12:00:00+07:00`));
}

function roomNumbers(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const numbers = value
    .map((room) =>
      room && typeof room === "object" && "roomNumber" in room
        ? text(room.roomNumber)
        : null,
    )
    .filter((number): number is string => Boolean(number));
  return numbers.length ? numbers.join(", ") : null;
}

function eventDetails(event: ReservationHistoryItem, t: Translate): string[] {
  const details = event.details ?? {};
  const lines: string[] = [];
  switch (event.eventType) {
    case "reservation.created":
      if (text(details.bookingCode)) lines.push(t("audit.lines.booking", { code: text(details.bookingCode)! }));
      if (text(details.source)) lines.push(t("audit.lines.source", { source: String(details.source).replaceAll("_", " ") }));
      if (text(details.roomCount)) lines.push(t("audit.lines.roomCount", { count: text(details.roomCount)! }));
      if (amount(details.bookingTotal)) lines.push(t("audit.lines.total", { amount: amount(details.bookingTotal)! }));
      break;
    case "payment.recorded":
    case "payment.refunded":
    case "payment.refund_pending":
    case "deposit.held":
      if (amount(details.amount)) lines.push(t("audit.lines.amount", { amount: amount(details.amount)! }));
      if (text(details.reference)) lines.push(t("audit.lines.reference", { reference: text(details.reference)! }));
      break;
    case "reservation.stay_extended":
      if (date(details.oldCheckOutDate) && date(details.newCheckOutDate)) {
        lines.push(t("audit.lines.checkOutRange", { from: date(details.oldCheckOutDate)!, to: date(details.newCheckOutDate)! }));
      }
      if (amount(details.extensionTotal)) lines.push(t("audit.lines.extension", { amount: amount(details.extensionTotal)! }));
      break;
    case "reservation.room_changed":
      lines.push(
        `${text(details.oldRoomTypeName) ?? "Room"} ${text(details.oldRoomNumber) ?? ""} → ${text(details.targetRoomTypeName) ?? "Room"} ${text(details.targetRoomNumber) ?? ""}`.trim(),
      );
      if (amount(details.totalDifference)) lines.push(t("audit.lines.priceDifference", { amount: amount(details.totalDifference)! }));
      break;
    case "reservation.extra_bed_changed":
      if (text(details.previousQuantity) && text(details.quantity)) {
        lines.push(t("audit.lines.extraBedChange", { from: text(details.previousQuantity)!, to: text(details.quantity)! }));
      }
      if (amount(details.difference)) lines.push(t("audit.lines.priceDifference", { amount: amount(details.difference)! }));
      break;
    case "reservation.experience_bill_saved":
      if (Array.isArray(details.lines)) {
        const names = details.lines
          .map((line) => line && typeof line === "object" && "name" in line ? text(line.name) : null)
          .filter(Boolean);
        if (names.length) lines.push(names.join(", "));
      }
      if (amount(details.addedTotal)) lines.push(t("audit.lines.amount", { amount: amount(details.addedTotal)! }));
      break;
    case "guest.checked_in":
      if (roomNumbers(details.rooms)) lines.push(t("audit.lines.room", { rooms: roomNumbers(details.rooms)! }));
      if (amount(details.remainingBalance)) lines.push(t("audit.lines.remaining", { amount: amount(details.remainingBalance)! }));
      break;
    case "guest.checked_out":
      if (amount(details.remainingBalance)) lines.push(t("audit.lines.remaining", { amount: amount(details.remainingBalance)! }));
      break;
    case "reservation.cancelled":
    case "payment.no_refund":
    case "payment.refund_failed":
      if (text(details.reason)) lines.push(t("audit.lines.reason", { reason: text(details.reason)! }));
      break;
    case "reservation.early_check_in_charged":
    case "reservation.late_checkout_charged":
      if (amount(details.amount)) lines.push(t("audit.lines.charge", { amount: amount(details.amount)! }));
      break;
  }

  if (event.reservationStatusBefore && event.reservationStatusAfter &&
      event.reservationStatusBefore !== event.reservationStatusAfter) {
    lines.push(t("audit.lines.reservationTransition", { from: statusLabel(t, event.reservationStatusBefore), to: statusLabel(t, event.reservationStatusAfter) }));
  }
  if (event.paymentStatusBefore && event.paymentStatusAfter &&
      event.paymentStatusBefore !== event.paymentStatusAfter) {
    lines.push(t("audit.lines.paymentTransition", { from: statusLabel(t, event.paymentStatusBefore), to: statusLabel(t, event.paymentStatusAfter) }));
  }
  return lines;
}

export function ReservationAuditTrail({ history }: { history: ReservationHistoryItem[] }) {
  const { t } = useTranslations({ en, id });
  return (
    <section className="reservation-audit">
      <div className="reservation-detail-section-title"><h2>{t("audit.title")}</h2></div>
      <div className="reservation-audit-scroll">
        <table className="reservation-audit-table">
          <thead><tr>
            <th>{t("audit.headers.timestamp")}</th><th>{t("audit.headers.event")}</th><th>{t("audit.headers.domain")}</th><th>{t("audit.headers.performedBy")}</th><th>{t("audit.headers.details")}</th>
          </tr></thead>
          <tbody>
            {history.map((event) => {
              const occurredAt = new Date(event.occurredAt);
              const domain = event.eventType.split(".")[0] ?? "reservation";
              const details = eventDetails(event, t);
              return (
                <tr key={event.id}>
                  <td>
                    <strong>{new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(occurredAt)}</strong>
                    <span>{new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta" }).format(occurredAt)}{t("audit.timeSuffix")}</span>
                  </td>
                  <td><span className={`reservation-audit-event reservation-audit-event--${domain}`}>{t("audit.events." + event.eventType) !== "audit.events." + event.eventType ? t("audit.events." + event.eventType) : event.eventType.replaceAll("_", " ").replaceAll(".", " · ")}</span></td>
                  <td className="reservation-audit-domain">{domain.charAt(0).toUpperCase() + domain.slice(1)}</td>
                  <td>
                    <strong>{event.actor?.name ?? (event.actorType === "gateway" ? t("audit.actor.gateway") : t("audit.actor.system"))}</strong>
                    {!event.actor && <span>{event.actorType === "gateway" ? t("audit.actor.automatedPayment") : t("audit.actor.automatedEvent")}</span>}
                  </td>
                  <td className="reservation-audit-details">{details.length ? details.join(" · ") : t("common.emptyDash")}</td>
                </tr>
              );
            })}
            {history.length === 0 && <tr><td colSpan={5} className="reservation-audit-empty">{t("audit.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
