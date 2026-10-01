import { initialReservations, resolveReservationStatus, type ReservationRecord } from "./reservation-list-data";
import { departuresToday } from "./departures-today-data";
import { multiRoomArrivals } from "./arrivals-today-data";
import { roomTypes } from "./walk-in-data";

const reservationsKey = "green-hero-reservations";

export type ReservationOperation = {
  status?: string;
  roomNumbers?: string[];
  depositAmount?: number;
  depositMethod?: string | null;
  depositNote?: string;
  depositRefunded?: number;
  depositDeducted?: number;
  deductionNote?: string;
  checkInAt?: string;
  checkOutAt?: string;
  checkoutOutstandingReason?: string;
  paymentStatus?: string;
  amountPaid?: number;
  paymentMethod?: string;
  paymentTransactions?: PaymentTransaction[];
  cancellationReason?: string;
  cancellationNote?: string;
};

export type PaymentTransaction = {
  amount: number;
  method: string;
  reference: string;
  note: string;
  recordedAt: string;
};

export type ReservationDetail = ReservationRecord & ReservationOperation;

const operations = new Map<string, ReservationOperation>();
let legacyStorageCleared = false;

function clearLegacyStorage() {
  if (legacyStorageCleared) return;
  try {
    localStorage.removeItem("green-hero-reservation-statuses");
    localStorage.removeItem("green-hero-reservation-operations");
    legacyStorageCleared = true;
  } catch {
    // Storage may be unavailable; the demo still uses in-memory operations.
  }
}

function readSavedReservation(bookingId: string): ReservationRecord | null {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(reservationsKey) || "[]");
    if (!Array.isArray(stored)) return null;
    const value = stored.find(item => item && typeof item === "object" && item.bookingId === bookingId);
    if (!value) return null;
    const quantities = value.quantities && typeof value.quantities === "object" ? value.quantities as Record<string, number> : {};
    const room = roomTypes.filter(type => (quantities[type.id] ?? 0) > 0).map(type => type.name).join(", ") || "—";
    return {
      bookingId, guestName: value.guestName || "Guest", whatsapp: value.whatsapp || "—",
      email: value.email, notes: value.notes, source: value.source || "Website",
      channel: value.channel, reference: value.reference,
      checkIn: value.checkIn || "", checkOut: value.checkOut || "", room,
      quantities, assignments: value.assignments, adults: value.adults, children: value.children,
      selectedExtras: value.selectedExtras, extraQuantities: value.extraQuantities, roomExtraBeds: value.roomExtraBeds,
      paymentMethod: value.paymentMethod, paymentStatus: value.paymentStatus || "Unpaid",
      total: value.total, amountPaid: value.amountPaid, status: value.status || "Pending",
      checkInAt: value.checkInAt,
      depositAmount: value.depositAmount, depositMethod: value.depositMethod, depositNote: value.depositNote,
    };
  } catch {
    return null;
  }
}

export function loadReservationDetail(bookingId: string): ReservationDetail | null {
  clearLegacyStorage();
  const base = readSavedReservation(bookingId) ?? initialReservations.find(item => item.bookingId === bookingId) ?? multiRoomArrivals.find(item => item.bookingId === bookingId) ?? departuresToday.find(item => item.bookingId === bookingId);
  if (!base) return null;
  const operation = operations.get(bookingId) ?? {};
  const status = operation.status ?? base.status;
  const assigned = base.assignments ? Object.values(base.assignments).flat() : [];
  const paymentStatus = operation.paymentStatus ?? base.paymentStatus;
  return { ...base, roomNumbers: assigned, ...operation, status: resolveReservationStatus(paymentStatus, status, base.source) };
}

export function loadAllReservationDetails(): ReservationDetail[] {
  const ids = new Set(initialReservations.map(item => item.bookingId));
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(reservationsKey) || "[]");
    if (Array.isArray(stored)) {
      stored.forEach(item => {
        if (item && typeof item === "object" && typeof item.bookingId === "string") ids.add(item.bookingId);
      });
    }
  } catch {
    // Keep the initial records available when stored data cannot be read.
  }
  return [...ids].map(loadReservationDetail).filter((item): item is ReservationDetail => item !== null);
}

export function saveReservationDetail(bookingId: string, status: string, operation: ReservationOperation): ReservationDetail | null {
  clearLegacyStorage();
  operations.set(bookingId, { ...operations.get(bookingId), ...operation, status });
  return loadReservationDetail(bookingId);
}

export function recordReservationPayment(bookingId: string, amount: number, method: string, reference: string, note: string): ReservationDetail | null {
  const current = loadReservationDetail(bookingId);
  if (!current || !["Pending", "Confirmed", "Checked-in", "Checked-out"].includes(current.status) || !["Unpaid", "Partial"].includes(current.paymentStatus)) return null;
  const balance = Math.max(0, (current.total ?? 0) - (current.amountPaid ?? 0));
  if (amount <= 0 || amount > balance) return null;
  const amountPaid = (current.amountPaid ?? 0) + amount;
  const paymentStatus = amountPaid >= (current.total ?? 0) ? "Paid" : "Partial";
  const transaction: PaymentTransaction = { amount, method, reference: reference.trim(), note: note.trim(), recordedAt: new Date().toISOString() };
  return saveReservationDetail(bookingId, current.status, {
    amountPaid, paymentStatus, paymentMethod: method,
    paymentTransactions: [...(current.paymentTransactions ?? []), transaction],
  });
}

export function cancelUnpaidReservation(bookingId: string, reason: string, note: string): ReservationDetail | null {
  const current = loadReservationDetail(bookingId);
  if (!current || current.status !== "Pending" || current.paymentStatus !== "Unpaid") return null;
  return saveReservationDetail(bookingId, "Cancelled", { cancellationReason: reason, cancellationNote: note.trim() });
}
