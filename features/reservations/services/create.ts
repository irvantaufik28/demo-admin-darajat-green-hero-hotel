import { apiRequest } from "../../../lib/api/client";

export type AvailableRoom = {
  roomType: {
    id: string;
    name: string;
    extraBedEnabled: boolean;
    maxExtraBeds: number;
    extraBedPricePerNight: number;
  };
  availableRooms: number;
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
};

export type SelectedExperience = { variantId: string; quantity: number };

export type ExperienceOption = {
  id: string;
  name: string;
  variants: { id: string; subName: string; price: number }[];
};

export type PaymentMethod = { id: string; name: string; isActive: boolean };

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

export function getWalkInAvailability(
  checkInDate: string,
  checkOutDate: string,
  guests: { adults: number; children: number },
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({
    checkInDate,
    checkOutDate,
    adults: String(guests.adults),
    children: String(guests.children),
  });
  return apiRequest<{ items: AvailableRoom[] }>(`reservations/availability?${query}`, { signal });
}

export function getWalkInExperiences(signal?: AbortSignal) {
  return apiRequest<{ items: ExperienceOption[] }>("experiences?isActive=true&limit=100", { signal });
}

export function getWalkInPaymentMethods(signal?: AbortSignal) {
  return apiRequest<{ items: PaymentMethod[] }>("master/payment-methods", { signal });
}

export function quoteWalkIn(input: {
  checkInDate: string;
  checkOutDate: string;
  rooms: SelectedRoom[];
  experiences: SelectedExperience[];
}, signal?: AbortSignal) {
  return apiRequest<ReservationQuote>("reservations/quote", {
    method: "POST",
    body: { source: "walk_in", ...input },
    signal,
  });
}

export function createWalkIn(input: {
  idempotencyKey: string;
  guest: { fullName: string; phone: string; email?: string };
  checkInDate: string;
  checkOutDate: string;
  rooms: SelectedRoom[];
  experiences: SelectedExperience[];
  specialRequests?: string;
  confirm: boolean;
  checkIn: boolean;
  acknowledgeOutstanding?: boolean;
  payment?: { methodId: string; amount: number };
  deposit?: { methodId: string; amount: number; notes?: string };
}) {
  return apiRequest<{ reservation: { id: string; bookingCode: string; reservationStatus: string } }>(
    "reservations",
    { method: "POST", body: { source: "walk_in", ...input } },
  );
}
