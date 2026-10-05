import { apiRequest } from "../../../lib/api/client";

export type Guest = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  nationality: string | null;
  address: string | null;
  internalNotes: string | null;
  status: "active" | "blacklisted";
  totalStays: number;
  totalNights: number;
  totalSpend: number;
  lastStay: string | null;
};

export type GuestReservation = {
  id: string;
  bookingCode: string;
  checkInDate: string;
  checkOutDate: string;
  source: string;
  reservationStatus: string;
  paymentStatus: string;
  roomTypes: string | null;
  bookingTotal: number;
};

export type GuestPage<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
};

export function getGuests(query: URLSearchParams, signal?: AbortSignal) {
  return apiRequest<GuestPage<Guest>>(`guests?${query}`, { signal });
}

export function getGuest(id: string, signal?: AbortSignal) {
  return apiRequest<{ guest: Guest }>(`guests/${encodeURIComponent(id)}`, { signal });
}

export function getGuestReservations(id: string, page: number, signal?: AbortSignal) {
  return apiRequest<GuestPage<GuestReservation>>(
    `guests/${encodeURIComponent(id)}/reservations?page=${page}&limit=20`,
    { signal },
  );
}

export function updateGuestNotes(guest: Guest, internalNotes: string) {
  return apiRequest<{ guest: Guest }>(`guests/${encodeURIComponent(guest.id)}`, {
    method: "PUT",
    body: {
      fullName: guest.fullName,
      phone: guest.phone,
      email: guest.email,
      nationality: guest.nationality,
      address: guest.address,
      internalNotes,
      status: guest.status,
    },
  });
}
