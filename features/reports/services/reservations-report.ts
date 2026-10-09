import { apiRequest } from "../../../lib/api/client";
import { getRoomTypes } from "../../rooms/services/room-types";

export type ReservationReportSource = "website" | "phone" | "walk_in" | "ota";
export type ReservationReportDateBy = "booking" | "check_in" | "check_out";
export type ReservationReportSort =
  "newest" | "booking_code_asc" | "booking_code_desc";

export type ReservationReportStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "no_show"
  | "cancelled"
  | "expired";

export type ReservationReportItem = {
  id: string;
  bookingCode: string;
  bookingDate: string;
  guest: { fullName: string; phone: string | null };
  source: ReservationReportSource;
  otaChannel: { id: string; name: string } | null;
  roomTypes: string[];
  roomQuantity: number;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  roomNights: number;
  reservationStatus: ReservationReportStatus;
  paymentStatus: string;
  bookingTotal: number;
  discount: number;
  paid: number;
  outstanding: number;
};

export type ReservationReportSummary = {
  totalReservations: number;
  pending: number;
  confirmed: number;
  checkedIn: number;
  checkedOut: number;
  noShow: number;
  cancelled: number;
  expired: number;
  roomNights: number;
};

export type ReservationReportFinancial = {
  bookingValue: number;
  paid: number;
  outstanding: number;
};

export type ReservationReportResponse = {
  items: ReservationReportItem[];
  summary: ReservationReportSummary;
  financial: ReservationReportFinancial;
  page: number;
  limit: number;
  total: number;
};

export type FilterOption = { id: string; name: string };

export function getReservationsReport(
  query: URLSearchParams,
  signal?: AbortSignal,
) {
  return apiRequest<ReservationReportResponse>(
    `reports/reservations?${query}`,
    { signal },
  );
}

// Dropdown options for the room type and OTA channel filters, sourced from master data.
export async function getReportFilterOptions(
  signal?: AbortSignal,
): Promise<{ roomTypes: FilterOption[]; otaChannels: FilterOption[] }> {
  const [channels, firstRoomPage] = await Promise.all([
    apiRequest<{ items: { id: string; name: string; isActive: boolean }[] }>(
      "master/ota-channels",
      { signal },
    ),
    getRoomTypes(new URLSearchParams({ page: "1", limit: "100" }), signal),
  ]);
  const remainingRoomPages = await Promise.all(
    Array.from(
      {
        length: Math.max(
          0,
          Math.ceil(firstRoomPage.total / firstRoomPage.limit) - 1,
        ),
      },
      (_, index) =>
        getRoomTypes(
          new URLSearchParams({ page: String(index + 2), limit: "100" }),
          signal,
        ),
    ),
  );
  const roomTypes = [firstRoomPage, ...remainingRoomPages]
    .flatMap((page) => page.items)
    .map((item) => ({ id: item.id, name: item.name }));
  return {
    roomTypes,
    otaChannels: channels.items
      .filter((item) => item.isActive)
      .map((item) => ({ id: item.id, name: item.name })),
  };
}
