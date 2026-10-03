import { initialReservations, type ReservationRecord } from "../../reservations/constants/reservation-list-data";

export type RevenueRow = ReservationRecord & {
  bookingDate: string;
  paymentDate: string | null;
  methodGroup: string;
  gross: number;
  discount: number;
  paid: number;
  refunded: number;
  outstanding: number;
};

export const revenueSources = ["Website", "Phone", "Walk-in", "OTA"];
export const revenueMethods = [
  "Payment Gateway",
  "Bank Transfer",
  "Cash",
  "QRIS",
  "OTA Prepaid",
  "Pay at Hotel",
];

function bookingDate(bookingId: string, fallback: string) {
  const match = bookingId.match(/^GH-(\d{2})(\d{2})(\d{2})-/);
  return match ? `20${match[1]}-${match[2]}-${match[3]}` : fallback;
}

function methodGroup(method?: string) {
  if (!method || method === "Pay Later") return "Pay at Hotel";
  if (method.includes("OTA")) return "OTA Prepaid";
  if (method.includes("Bank Transfer")) return "Bank Transfer";
  if (method.includes("QRIS")) return "QRIS";
  if (method.includes("Cash")) return "Cash";
  return "Payment Gateway";
}

export const revenueRows: RevenueRow[] = initialReservations.map((row) => {
  const gross = row.total ?? 0;
  const refunded = row.paymentStatus === "Refunded" ? gross : 0;
  const paid = row.paymentStatus === "Refunded" ? gross : row.amountPaid ?? 0;
  const date = bookingDate(row.bookingId, row.checkIn);

  return {
    ...row,
    bookingDate: date,
    paymentDate: paid > 0 ? date : null,
    methodGroup: methodGroup(row.paymentMethod),
    gross,
    discount: 0,
    paid,
    refunded,
    outstanding: ["Cancelled", "Expired"].includes(row.status)
      ? 0
      : Math.max(0, gross - paid),
  };
});

export function revenueTotals(rows: RevenueRow[]) {
  return rows.reduce(
    (total, row) => ({
      reservations: total.reservations + 1,
      gross: total.gross + row.gross,
      discount: total.discount + row.discount,
      paid: total.paid + row.paid,
      refunded: total.refunded + row.refunded,
      outstanding: total.outstanding + row.outstanding,
      transactions: total.transactions + (row.paid > 0 ? 1 : 0),
    }),
    { reservations: 0, gross: 0, discount: 0, paid: 0, refunded: 0, outstanding: 0, transactions: 0 },
  );
}
