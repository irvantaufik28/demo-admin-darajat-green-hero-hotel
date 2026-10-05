import { apiRequest } from "../../../lib/api/client";

export type DashboardReservationStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "cancelled"
  | "expired";

export type DashboardPaymentStatus =
  | "unpaid"
  | "partial"
  | "paid"
  | "failed"
  | "expired"
  | "refunded";

type DashboardReservation = {
  reservationId: string;
  bookingCode: string;
  guestName: string;
  source: string;
  checkInDate: string;
  checkOutDate: string;
  reservationStatus: DashboardReservationStatus;
  paymentStatus: DashboardPaymentStatus;
  roomSummary: string;
  url: string;
};

export type DashboardResponse = {
  date: string;
  summary: {
    arrivalsToday: number;
    arrivalsPending: number;
    departuresToday: number;
    departuresPending: number;
    inHouse: number;
    pendingPayment: number;
    overdue: number;
    outstandingAmount: number;
  };
  todayActivity: {
    totalShown: number;
    items: (DashboardReservation & {
      type: "Arrival" | "Departure" | "Payment" | "Overdue";
      status: DashboardReservationStatus | DashboardPaymentStatus;
    })[];
  };
  recentReservations: (DashboardReservation & { createdAt: string })[];
  todayAvailability: {
    roomTypeId: string;
    roomTypeName: string;
    configuredStock: number | null;
    booked: number;
    available: number | null;
    stopSell: boolean;
    isConfigured: boolean;
  }[];
};

export function getDashboard(signal?: AbortSignal): Promise<DashboardResponse> {
  return apiRequest<DashboardResponse>("dashboard", { signal });
}
