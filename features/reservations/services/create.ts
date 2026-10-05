import { apiRequest } from "../../../lib/api/client";
import type { EarlyCheckInInput, CheckInContext } from "./api";

export type AvailableRoom = {
  roomType: {
    id: string;
    name: string;
    extraBedEnabled: boolean;
    maxExtraBeds: number;
    extraBedPricePerNight: number;
  };
  availableRooms: number;
  capacityPatterns: { adults: number; children: number; extraBeds: number }[];
  bookable: boolean;
  unavailableReasons: string[];
  totalPrice: number | null;
  assignableRoomUnits: { id: string; roomNumber: string }[];
};

export type SelectedRoom = {
  roomTypeId: string;
  roomUnitId?: string;
  adults: number;
  children: number;
  extraBeds: number;
  cancellationPolicyId?: string | null;
};

export type SelectedExperience = { variantId: string; quantity: number };

export type ExperienceOption = {
  id: string;
  name: string;
  variants: { id: string; subName: string; price: number }[];
};

export type PaymentMethod = { id: string; name: string; isActive: boolean };
export type ReservationSource = "walk_in" | "phone";

export type ReservationQuote = {
  bookingTotal: number;
  roomTotal: number;
  discountTotal: number;
  rows: {
    roomIndex: number;
    discountAmount: number;
  }[];
  appliedCampaigns: {
    id: string;
    name: string;
    bookingEnd: string | null;
    stayEnd: string | null;
  }[];
  charges: {
    rooms: {
      roomIndex: number;
      roomAmount: number;
      extraBedAmount: number;
      subtotal: number;
    }[];
    experiences: { variantId: string; amount: number }[];
    extraBedTotal: number;
    breakfastTotal: number;
    experienceTotal: number;
  };
};

export function getReservationAvailability(
  checkInDate: string,
  checkOutDate: string,
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({
    checkInDate,
    checkOutDate,
  });
  return apiRequest<{ items: AvailableRoom[] }>(`reservations/availability?${query}`, { signal });
}

export function getReservationExperiences(signal?: AbortSignal) {
  return apiRequest<{ items: ExperienceOption[] }>("experiences?isActive=true&limit=100", { signal });
}

export function getReservationPaymentMethods(signal?: AbortSignal) {
  return apiRequest<{ items: PaymentMethod[] }>("master/payment-methods", { signal });
}

export function quoteReservation(source: ReservationSource, input: {
  checkInDate: string;
  checkOutDate: string;
  totalAdults: number;
  totalChildren: number;
  rooms: SelectedRoom[];
  experiences: SelectedExperience[];
}, signal?: AbortSignal) {
  return apiRequest<ReservationQuote>("reservations/quote", {
    method: "POST",
    body: { source, ...input },
    signal,
  });
}

export function createReservation(source: ReservationSource, input: {
  idempotencyKey: string;
  guest: { fullName: string; phone: string; email?: string };
  checkInDate: string;
  checkOutDate: string;
  totalAdults: number;
  totalChildren: number;
  rooms: SelectedRoom[];
  experiences: SelectedExperience[];
  specialRequests?: string;
  cancellationPolicyId?: string | null;
  confirm: boolean;
  checkIn: boolean;
  acknowledgeOutstanding?: boolean;
  earlyCheckIn?: EarlyCheckInInput;
  payment?: { methodId: string; amount: number };
  deposit?: { methodId: string; amount: number; notes?: string };
}) {
  return apiRequest<{ reservation: { id: string; bookingCode: string; reservationStatus: string } }>(
    "reservations",
    { method: "POST", body: { source, ...input } },
  );
}

export function getCreateCheckInContext(checkInDate: string) {
  const query = new URLSearchParams({ checkInDate });
  return apiRequest<CheckInContext>(`reservations/check-in-context?${query}`);
}
