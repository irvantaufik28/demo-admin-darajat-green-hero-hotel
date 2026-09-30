export type ReservationRecord = {
  bookingId: string;
  guestName: string;
  whatsapp: string;
  source: string;
  channel?: string;
  reference?: string;
  checkIn: string;
  checkOut: string;
  room: string;
  paymentStatus: string;
  status: string;
  total?: number;
  amountPaid?: number;
  email?: string;
  notes?: string;
  adults?: number;
  children?: number;
  quantities?: Record<string, number>;
  assignments?: Record<string, string[]> | null;
  selectedExtras?: string[];
  extraQuantities?: Record<string, number>;
  paymentMethod?: string;
  depositAmount?: number;
  depositMethod?: string | null;
  depositNote?: string;
  checkInAt?: string;
};

export function isAutoConfirmedSource(source: string) {
  return source === "Website" || source === "OTA";
}

// Website and OTA reservations are confirmed only after full payment or settlement.
// Phone and Walk-in reservations can be confirmed manually at any payment stage.
export function resolveReservationStatus(paymentStatus: string, status: string, source = "") {
  if (isAutoConfirmedSource(source)) {
    if (status === "Pending" && paymentStatus === "Paid") return "Confirmed";
    if (status === "Confirmed" && paymentStatus !== "Paid") return "Pending";
  }
  return status;
}

export const reservationReferenceDate = "2026-09-30";

// One record for each supported reservation/payment combination, plus one
// Paid / Confirmed record per automatic confirmation channel.
// Other pages derive their reservation data from this list and browser-created records.
export const initialReservations: ReservationRecord[] = [
  { bookingId: "GH-260929-101", guestName: "Nabila Putri", whatsapp: "+62 857 1122 3344", source: "Phone", checkIn: "2026-09-30", checkOut: "2026-10-01", room: "Deluxe Room", quantities: { deluxe: 1 }, paymentMethod: "Pay Later", paymentStatus: "Unpaid", status: "Pending", total: 850000, amountPaid: 0 },
  { bookingId: "GH-260929-102", guestName: "Ayu Lestari", whatsapp: "+62 812 7788 9900", source: "Phone", checkIn: "2026-09-30", checkOut: "2026-10-01", room: "Family Room", quantities: { family: 1 }, paymentMethod: "Bank Transfer", paymentStatus: "Partial", status: "Pending", total: 1250000, amountPaid: 500000 },
  { bookingId: "GH-260929-103", guestName: "Imran Hakim", whatsapp: "+62 812 3311 2203", source: "Phone", checkIn: "2026-10-01", checkOut: "2026-10-02", room: "Suite Room", quantities: { suite: 1 }, paymentMethod: "Bank Transfer", paymentStatus: "Paid", status: "Pending", total: 1650000, amountPaid: 1650000 },
  { bookingId: "GH-260929-104", guestName: "Sari Wulandari", whatsapp: "+62 812 3311 2204", source: "Phone", checkIn: "2026-09-30", checkOut: "2026-10-01", room: "Deluxe Room", quantities: { deluxe: 1 }, paymentMethod: "Pay Later", paymentStatus: "Unpaid", status: "Confirmed", total: 850000, amountPaid: 0 },
  { bookingId: "GH-260929-105", guestName: "Rafi Nugraha", whatsapp: "+62 812 3311 2205", source: "Phone", checkIn: "2026-09-30", checkOut: "2026-10-01", room: "Family Room", quantities: { family: 1 }, paymentMethod: "Bank Transfer", paymentStatus: "Partial", status: "Confirmed", total: 1250000, amountPaid: 600000 },
  { bookingId: "GH-260929-106", guestName: "Faya Kusuma", whatsapp: "+62 852 9988 7766", source: "Walk-in", checkIn: "2026-09-30", checkOut: "2026-10-02", room: "Suite Room", quantities: { suite: 1 }, paymentMethod: "Cash", paymentStatus: "Paid", status: "Confirmed", total: 3300000, amountPaid: 3300000 },
  { bookingId: "GH-260929-107", guestName: "Dimas Prakoso", whatsapp: "+62 812 3311 2207", source: "Walk-in", checkIn: "2026-09-29", checkOut: "2026-10-01", room: "Deluxe Room", quantities: { deluxe: 1 }, assignments: { deluxe: ["201"] }, paymentMethod: "Pay Later", paymentStatus: "Unpaid", status: "Checked-in", total: 1700000, amountPaid: 0, checkInAt: "2026-09-29T14:00:00+07:00" },
  { bookingId: "GH-260929-108", guestName: "Rizky Firmansyah", whatsapp: "+62 813 7788 9901", source: "Walk-in", checkIn: "2026-09-29", checkOut: "2026-09-30", room: "Deluxe Room", quantities: { deluxe: 1 }, assignments: { deluxe: ["202"] }, paymentMethod: "Cash", paymentStatus: "Partial", status: "Checked-in", total: 850000, amountPaid: 400000, checkInAt: "2026-09-29T15:00:00+07:00" },
  { bookingId: "GH-260929-109", guestName: "Andi Pratama", whatsapp: "+62 812 3456 7890", source: "Website", checkIn: "2026-09-29", checkOut: "2026-09-30", room: "Family Room", quantities: { family: 1 }, assignments: { family: ["105"] }, paymentMethod: "Payment Gateway", paymentStatus: "Paid", status: "Checked-in", total: 1250000, amountPaid: 1250000, checkInAt: "2026-09-29T14:30:00+07:00", depositAmount: 300000, depositMethod: "Cash" },
  { bookingId: "GH-260929-110", guestName: "Rina Dewi", whatsapp: "+62 878 1234 5678", source: "Phone", checkIn: "2026-09-29", checkOut: "2026-09-30", room: "Deluxe Room", quantities: { deluxe: 1 }, assignments: { deluxe: ["203"] }, paymentMethod: "Bank Transfer", paymentStatus: "Paid", status: "Checked-out", total: 850000, amountPaid: 850000, checkInAt: "2026-09-29T14:00:00+07:00" },
  { bookingId: "GH-260929-111", guestName: "Lina Maharani", whatsapp: "+62 814 7788 9902", source: "Phone", checkIn: "2026-10-02", checkOut: "2026-10-03", room: "Deluxe Room", quantities: { deluxe: 1 }, paymentMethod: "Pay Later", paymentStatus: "Unpaid", status: "Cancelled", total: 850000, amountPaid: 0 },
  { bookingId: "GH-260929-112", guestName: "Bagas Aditya", whatsapp: "+62 812 3311 2212", source: "Phone", checkIn: "2026-10-02", checkOut: "2026-10-03", room: "Family Room", quantities: { family: 1 }, paymentMethod: "Bank Transfer", paymentStatus: "Partial", status: "Cancelled", total: 1250000, amountPaid: 500000 },
  { bookingId: "GH-260929-113", guestName: "Citra Amalia", whatsapp: "+62 812 3311 2213", source: "OTA", channel: "Agoda", checkIn: "2026-10-02", checkOut: "2026-10-03", room: "Suite Room", quantities: { suite: 1 }, paymentMethod: "Payment Gateway", paymentStatus: "Paid", status: "Cancelled", total: 1650000, amountPaid: 1650000 },
  { bookingId: "GH-260929-114", guestName: "Farhan Yusuf", whatsapp: "+62 812 3311 2214", source: "Website", checkIn: "2026-10-02", checkOut: "2026-10-03", room: "Deluxe Room", quantities: { deluxe: 1 }, paymentMethod: "Payment Gateway", paymentStatus: "Refunded", status: "Cancelled", total: 850000, amountPaid: 0 },
  { bookingId: "GH-260929-115", guestName: "Tono Saputra", whatsapp: "+62 815 7788 9903", source: "Phone", checkIn: "2026-10-02", checkOut: "2026-10-03", room: "Deluxe Room", quantities: { deluxe: 1 }, paymentMethod: "Pay Later", paymentStatus: "Unpaid", status: "Expired", total: 850000, amountPaid: 0 },
  { bookingId: "GH-260929-116", guestName: "Putri Anggraini", whatsapp: "+62 812 3311 2216", source: "Phone", checkIn: "2026-10-02", checkOut: "2026-10-03", room: "Family Room", quantities: { family: 1 }, paymentMethod: "Bank Transfer", paymentStatus: "Failed", status: "Expired", total: 1250000, amountPaid: 0 },
  { bookingId: "GH-260929-117", guestName: "Dewi Kartika", whatsapp: "+62 812 3311 2217", source: "Website", checkIn: "2026-09-30", checkOut: "2026-10-01", room: "Deluxe Room", quantities: { deluxe: 1 }, paymentMethod: "Payment Gateway", paymentStatus: "Paid", status: "Confirmed", total: 850000, amountPaid: 850000 },
  { bookingId: "GH-260929-118", guestName: "Bima Santoso", whatsapp: "+62 812 3311 2218", source: "OTA", channel: "Traveloka", reference: "TVLK-260929-118", checkIn: "2026-09-30", checkOut: "2026-10-01", room: "Family Room", quantities: { family: 1 }, paymentMethod: "Prepaid by OTA", paymentStatus: "Paid", status: "Confirmed", total: 1250000, amountPaid: 1250000 },
];
