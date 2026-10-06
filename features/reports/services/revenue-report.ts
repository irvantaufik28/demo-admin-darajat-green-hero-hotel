import { apiRequest } from "../../../lib/api/client";
import { getRoomTypes } from "../../rooms/services/room-types";

export type RevenueReportSource = "website" | "phone" | "walk_in" | "ota";
export type RevenueReportDateBy = "payment" | "booking" | "check_in";

export type RevenueReportStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "cancelled"
  | "expired";

export type RevenueTotals = {
  reservations: number;
  transactions: number;
  gross: number;
  discount: number;
  net: number;
  paid: number;
  refunded: number;
  outstanding: number;
  netCollected: number;
};

export type RevenueBySource = {
  source: RevenueReportSource;
  reservations: number;
  gross: number;
  paid: number;
  refunded: number;
  outstanding: number;
  netCollected: number;
};

export type RevenueByMethod = {
  methodId: string;
  methodName: string;
  transactions: number;
  paid: number;
  refunded: number;
  netCollected: number;
};

export type RevenueReportItem = {
  id: string;
  bookingCode: string;
  guest: { fullName: string; phone: string | null };
  source: RevenueReportSource;
  reservationStatus: RevenueReportStatus;
  paymentStatus: string;
  methodNames: string[];
  bookingDate: string;
  paymentDate: string | null;
  checkInDate: string;
  roomTypes: string[];
  gross: number;
  discount: number;
  net: number;
  paid: number;
  refunded: number;
  outstanding: number;
  netCollected: number;
};

export type RevenueReportResponse = {
  totals: RevenueTotals;
  bySource: RevenueBySource[];
  byMethod: RevenueByMethod[];
  items: RevenueReportItem[];
};

export type FilterOption = { id: string; name: string };

export function getRevenueReport(query: URLSearchParams, signal?: AbortSignal) {
  return apiRequest<RevenueReportResponse>(`reports/revenue?${query}`, { signal });
}

// Dropdown options for the room type and payment method filters, sourced from master data.
export async function getRevenueFilterOptions(
  signal?: AbortSignal,
): Promise<{ roomTypes: FilterOption[]; paymentMethods: FilterOption[] }> {
  const [methods, firstRoomPage] = await Promise.all([
    apiRequest<{ items: { id: string; name: string; isActive: boolean }[] }>(
      "master/payment-methods",
      { signal },
    ),
    getRoomTypes(new URLSearchParams({ page: "1", limit: "100" }), signal),
  ]);
  const remainingRoomPages = await Promise.all(
    Array.from(
      { length: Math.max(0, Math.ceil(firstRoomPage.total / firstRoomPage.limit) - 1) },
      (_, index) =>
        getRoomTypes(new URLSearchParams({ page: String(index + 2), limit: "100" }), signal),
    ),
  );
  const roomTypes = [firstRoomPage, ...remainingRoomPages]
    .flatMap((page) => page.items)
    .map((item) => ({ id: item.id, name: item.name }));
  return {
    roomTypes,
    paymentMethods: methods.items
      .filter((item) => item.isActive)
      .map((item) => ({ id: item.id, name: item.name })),
  };
}
