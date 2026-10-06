import type { ReservationHistoryItem } from "../services/api";

const statusLabels: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  checked_in: "Checked-in",
  checked_out: "Checked-out",
  cancelled: "Cancelled",
  expired: "Expired",
  unpaid: "Unpaid",
  partial: "Partial",
  paid: "Paid",
  refunded: "Refunded",
  failed: "Failed",
};

const eventLabels: Record<string, string> = {
  "reservation.created": "Reservation created",
  "reservation.confirmed": "Reservation confirmed",
  "reservation.cancelled": "Reservation cancelled",
  "reservation.stay_extended": "Stay extended",
  "reservation.room_changed": "Room changed",
  "reservation.extra_bed_changed": "Extra bed changed",
  "reservation.experience_bill_saved": "Experience bill saved",
  "reservation.early_check_in_charged": "Early check-in charged",
  "reservation.late_checkout_charged": "Late checkout charged",
  "payment.recorded": "Payment recorded",
  "payment.refund_pending": "Refund pending",
  "payment.refunded": "Payment refunded",
  "payment.refund_failed": "Refund failed",
  "payment.no_refund": "No refund",
  "deposit.held": "Deposit held",
  "deposit.settled": "Deposit settled",
  "deposit.deferred": "Deposit deferred",
  "guest.checked_in": "Guest checked in",
  "guest.checked_out": "Guest checked out",
};

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

function eventDetails(event: ReservationHistoryItem): string[] {
  const details = event.details ?? {};
  const lines: string[] = [];
  switch (event.eventType) {
    case "reservation.created":
      if (text(details.bookingCode)) lines.push(`Booking ${text(details.bookingCode)}`);
      if (text(details.source)) lines.push(`Source: ${String(details.source).replaceAll("_", " ")}`);
      if (text(details.roomCount)) lines.push(`${text(details.roomCount)} room(s)`);
      if (amount(details.bookingTotal)) lines.push(`Total ${amount(details.bookingTotal)}`);
      break;
    case "payment.recorded":
    case "payment.refunded":
    case "payment.refund_pending":
    case "deposit.held":
      if (amount(details.amount)) lines.push(`Amount ${amount(details.amount)}`);
      if (text(details.reference)) lines.push(`Reference ${text(details.reference)}`);
      break;
    case "reservation.stay_extended":
      if (date(details.oldCheckOutDate) && date(details.newCheckOutDate)) {
        lines.push(`Check-out ${date(details.oldCheckOutDate)} → ${date(details.newCheckOutDate)}`);
      }
      if (amount(details.extensionTotal)) lines.push(`Extension ${amount(details.extensionTotal)}`);
      break;
    case "reservation.room_changed":
      lines.push(
        `${text(details.oldRoomTypeName) ?? "Room"} ${text(details.oldRoomNumber) ?? ""} → ${text(details.targetRoomTypeName) ?? "Room"} ${text(details.targetRoomNumber) ?? ""}`.trim(),
      );
      if (amount(details.totalDifference)) lines.push(`Price difference ${amount(details.totalDifference)}`);
      break;
    case "reservation.extra_bed_changed":
      if (text(details.previousQuantity) && text(details.quantity)) {
        lines.push(`${text(details.previousQuantity)} → ${text(details.quantity)} extra bed(s)`);
      }
      if (amount(details.difference)) lines.push(`Price difference ${amount(details.difference)}`);
      break;
    case "reservation.experience_bill_saved":
      if (Array.isArray(details.lines)) {
        const names = details.lines
          .map((line) => line && typeof line === "object" && "name" in line ? text(line.name) : null)
          .filter(Boolean);
        if (names.length) lines.push(names.join(", "));
      }
      if (amount(details.addedTotal)) lines.push(`Added ${amount(details.addedTotal)}`);
      break;
    case "guest.checked_in":
      if (roomNumbers(details.rooms)) lines.push(`Room ${roomNumbers(details.rooms)}`);
      if (amount(details.remainingBalance)) lines.push(`Remaining ${amount(details.remainingBalance)}`);
      break;
    case "guest.checked_out":
      if (amount(details.remainingBalance)) lines.push(`Remaining ${amount(details.remainingBalance)}`);
      break;
    case "reservation.cancelled":
    case "payment.no_refund":
    case "payment.refund_failed":
      if (text(details.reason)) lines.push(`Reason: ${text(details.reason)}`);
      break;
    case "reservation.early_check_in_charged":
    case "reservation.late_checkout_charged":
      if (amount(details.amount)) lines.push(`Charge ${amount(details.amount)}`);
      break;
  }

  if (event.reservationStatusBefore && event.reservationStatusAfter &&
      event.reservationStatusBefore !== event.reservationStatusAfter) {
    lines.push(`Reservation: ${statusLabels[event.reservationStatusBefore]} → ${statusLabels[event.reservationStatusAfter]}`);
  }
  if (event.paymentStatusBefore && event.paymentStatusAfter &&
      event.paymentStatusBefore !== event.paymentStatusAfter) {
    lines.push(`Payment: ${statusLabels[event.paymentStatusBefore]} → ${statusLabels[event.paymentStatusAfter]}`);
  }
  return lines;
}

export function ReservationAuditTrail({ history }: { history: ReservationHistoryItem[] }) {
  return (
    <section className="reservation-audit">
      <div className="reservation-detail-section-title"><h2>Audit Trail</h2></div>
      <div className="reservation-audit-scroll">
        <table className="reservation-audit-table">
          <thead><tr>
            <th>Timestamp</th><th>Action / Event</th><th>Domain</th><th>Performed By</th><th>Operational Details &amp; Changes</th>
          </tr></thead>
          <tbody>
            {history.map((event) => {
              const occurredAt = new Date(event.occurredAt);
              const domain = event.eventType.split(".")[0] ?? "reservation";
              const details = eventDetails(event);
              return (
                <tr key={event.id}>
                  <td>
                    <strong>{new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(occurredAt)}</strong>
                    <span>{new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta" }).format(occurredAt)} WIB</span>
                  </td>
                  <td><span className={`reservation-audit-event reservation-audit-event--${domain}`}>{eventLabels[event.eventType] ?? event.eventType.replaceAll("_", " ").replaceAll(".", " · ")}</span></td>
                  <td className="reservation-audit-domain">{domain.charAt(0).toUpperCase() + domain.slice(1)}</td>
                  <td>
                    <strong>{event.actor?.name ?? (event.actorType === "gateway" ? "Payment Gateway" : "System")}</strong>
                    {!event.actor && <span>{event.actorType === "gateway" ? "Automated payment" : "Automated event"}</span>}
                  </td>
                  <td className="reservation-audit-details">{details.length ? details.join(" · ") : "—"}</td>
                </tr>
              );
            })}
            {history.length === 0 && <tr><td colSpan={5} className="reservation-audit-empty">Belum ada riwayat.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
