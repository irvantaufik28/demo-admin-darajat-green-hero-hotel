import type { ReservationRecord } from "./reservation-list-data";
import { reservationReferenceDate } from "./reservation-list-data";
import { formatRupiah, formatStayDate, roomTypes } from "./walk-in-data";

export type DashboardActivity = {
  bookingId: string;
  guest: string;
  room: string;
  type: "Arrival" | "Departure" | "Payment" | "Overdue";
  status: string;
};

export function getTodayActivities(
  records: ReservationRecord[],
): DashboardActivity[] {
  const active = records.filter(
    (item) =>
      !["Draft", "Cancelled", "Expired", "Checked-out"].includes(item.status),
  );
  const row = (
    item: ReservationRecord,
    type: DashboardActivity["type"],
  ): DashboardActivity => ({
    bookingId: item.bookingId,
    guest: item.guestName,
    room: item.room,
    type,
    status: type === "Payment" ? item.paymentStatus : item.status,
  });
  return [
    ...active
      .filter(
        (item) =>
          item.checkIn === reservationReferenceDate &&
          item.status === "Confirmed",
      )
      .map((item) => row(item, "Arrival")),
    ...active
      .filter(
        (item) =>
          item.checkOut === reservationReferenceDate &&
          item.status === "Checked-in",
      )
      .map((item) => row(item, "Departure")),
    ...active
      .filter(
        (item) =>
          item.paymentStatus === "Unpaid" || item.paymentStatus === "Partial",
      )
      .map((item) => row(item, "Payment")),
    ...active
      .filter(
        (item) =>
          item.checkOut < reservationReferenceDate &&
          item.status === "Checked-in",
      )
      .map((item) => row(item, "Overdue")),
  ];
}

export type DashboardSummary = {
  label: string;
  value: string;
  detail: string;
  tone: "warning" | "neutral" | "success" | "danger";
};

export function getDashboardSummary(
  records: ReservationRecord[],
): DashboardSummary[] {
  const arrivals = records.filter(
    (item) =>
      item.checkIn === reservationReferenceDate &&
      !["Draft", "Cancelled", "Expired"].includes(item.status),
  );
  const departures = records.filter(
    (item) =>
      item.checkOut === reservationReferenceDate &&
      ["Checked-in", "Checked-out"].includes(item.status),
  );
  const inHouse = records.filter(
    (item) =>
      item.status === "Checked-in" && item.checkIn <= reservationReferenceDate,
  );
  const pendingPayment = records.filter(
    (item) =>
      ["Pending", "Confirmed", "Checked-in"].includes(item.status) &&
      ["Unpaid", "Partial"].includes(item.paymentStatus),
  );
  const outstanding = pendingPayment.reduce(
    (sum, item) =>
      sum + Math.max(0, (item.total ?? 0) - (item.amountPaid ?? 0)),
    0,
  );
  return [
    {
      label: "Arrivals Today",
      value: String(arrivals.length),
      detail: `${arrivals.filter((item) => item.status !== "Checked-in").length} belum check-in`,
      tone: "warning",
    },
    {
      label: "Departures Today",
      value: String(departures.length),
      detail: `${departures.filter((item) => item.status !== "Checked-out").length} belum check-out`,
      tone: "neutral",
    },
    {
      label: "In House",
      value: String(inHouse.length),
      detail: `${inHouse.length} tamu aktif`,
      tone: "success",
    },
    {
      label: "Pending Payment",
      value: String(pendingPayment.length),
      detail: formatRupiah(outstanding),
      tone: "danger",
    },
  ];
}

export function getRecentReservations(records: ReservationRecord[]) {
  return records.slice(0, 5).map((item) => ({
    booking: item.bookingId,
    guest: item.guestName,
    source:
      item.source === "OTA" && item.channel
        ? `OTA · ${item.channel}`
        : item.source,
    stay: `${formatStayDate(item.checkIn)} → ${formatStayDate(item.checkOut)}`,
    payment: item.paymentStatus,
    status: item.status,
  }));
}

export function getAvailability(records: ReservationRecord[]) {
  const occupied = records.filter(
    (item) =>
      item.status === "Checked-in" && item.checkIn <= reservationReferenceDate,
  );
  return roomTypes.map((room) => {
    const count = occupied.reduce(
      (sum, item) =>
        sum +
        (item.quantities?.[room.id] ?? Number(item.room.includes(room.name))),
      0,
    );
    const available = Math.max(0, room.available - count);
    return {
      label: room.name,
      count: `${available} available`,
      tone: available > 1 ? "success" : "warning",
    };
  });
}
