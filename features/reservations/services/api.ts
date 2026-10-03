import { apiRequest } from "../../../lib/api/client";

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "cancelled"
  | "expired";

export type PaymentStatus =
  | "unpaid"
  | "partial"
  | "paid"
  | "failed"
  | "expired"
  | "refunded";

export type ReservationListItem = {
  id: string;
  bookingCode: string;
  source: string;
  externalReference: string | null;
  checkInDate: string;
  checkOutDate: string;
  reservationStatus: ReservationStatus;
  paymentStatus: PaymentStatus;
  operationalStatus: {
    code: string;
    label: string;
    description: string;
    daysOverdue?: number;
  } | null;
  guest: { fullName: string; phone: string; email: string | null };
  otaChannel: { name: string } | null;
  rooms: { roomTypeName: string }[];
  bookingTotal: number;
};

export type ReservationListResponse = {
  items: ReservationListItem[];
  page: number;
  limit: number;
  total: number;
};

export function getReservations(query: URLSearchParams, signal?: AbortSignal) {
  return apiRequest<ReservationListResponse>(`reservations?${query}`, { signal });
}

export type ApiReservationDetail = {
  reservation: {
    id: string;
    bookingCode: string;
    source: string;
    reservationStatus: ReservationStatus;
    paymentStatus: PaymentStatus;
    checkInDate: string;
    checkOutDate: string;
    adults: number;
    children: number;
    specialRequests: string | null;
    internalNotes: string | null;
    cancellationReason: string | null;
    checkoutOutstandingReason: string | null;
    createdAt: string;
    confirmedAt: string | null;
    checkedInAt: string | null;
    checkedOutAt: string | null;
  };
  guest: {
    fullName: string;
    phone: string;
    email: string | null;
  };
  otaChannel: { name: string } | null;
  rooms: {
    id: string;
    roomTypeId: string;
    roomTypeNameSnapshot: string;
    roomUnitId: string | null;
    roomNumber: string | null;
    adults: number;
    children: number;
    nights: {
      id: string;
      stayDate: string;
      basePrice: number;
      finalPrice: number;
    }[];
    extraBeds: {
      id: string;
      quantity: number;
      dateFrom: string;
      dateTo: string;
      unitPricePerNight: number;
    }[];
  }[];
  experiences: {
    id: string;
    nameSnapshot: string;
    descriptionSnapshot: string | null;
    quantity: number;
    unitPrice: number;
  }[];
  charges: {
    id: string;
    kind: string;
    description: string;
    quantity: string;
    amount: number;
  }[];
  payments: {
    id: string;
    amount: number;
    status: string;
    paidAt: string | null;
    method: { name: string } | null;
  }[];
  refunds: { id: string; amount: number; status: string }[];
  deposits: {
    id: string;
    amountHeld: number;
    amountRefunded: number;
    amountDeducted: number;
    status: string;
    method: { name: string } | null;
  }[];
  summary: {
    roomCount: number;
    nights: number;
    bookingTotal: number;
    paidAmount: number;
    refundedAmount: number;
    remainingBalance: number;
    depositBalance: number;
  };
};

export type RoomUnitOption = {
  id: string;
  roomNumber: string;
  roomTypeId: string;
};

export type PaymentMethodOption = { id: string; name: string; isActive: boolean };

export type ReservationHistoryItem = {
  id: string;
  sequence: number;
  eventType: string;
  occurredAt: string;
  actor: { id: string; name: string } | null;
  reservationStatusAfter: ReservationStatus | null;
  paymentStatusAfter: PaymentStatus | null;
};

export function getReservationDetail(id: string, signal?: AbortSignal) {
  return apiRequest<ApiReservationDetail>(`reservations/${encodeURIComponent(id)}`, { signal });
}

export async function getReservationHistory(id: string, signal?: AbortSignal) {
  const result = await apiRequest<{ items: ReservationHistoryItem[] }>(
    `reservations/${encodeURIComponent(id)}/history?limit=50`,
    { signal },
  );
  return result.items;
}

export async function getAvailableRoomUnits(roomTypeId: string) {
  const query = new URLSearchParams({ roomTypeId, operationalStatus: "available", isActive: "true", limit: "100" });
  const result = await apiRequest<{ items: RoomUnitOption[] }>(`room-numbers?${query}`);
  return result.items;
}

export async function getPaymentMethods() {
  const result = await apiRequest<{ items: PaymentMethodOption[] }>("master/payment-methods");
  return result.items.filter((item) => item.isActive);
}

export function confirmReservation(id: string) {
  return apiRequest(`reservations/${encodeURIComponent(id)}/confirm`, { method: "POST" });
}

export function checkInReservation(
  id: string,
  input: {
    acknowledgeOutstanding?: boolean;
    rooms: { reservationRoomId: string; roomUnitId: string }[];
    deposit?: { amount: number; methodId: string; notes?: string };
  },
) {
  return apiRequest(`reservations/${encodeURIComponent(id)}/check-in`, { method: "POST", body: input });
}

export function checkOutReservation(
  id: string,
  input: {
    acknowledgeOutstanding?: boolean;
    outstandingReason?: string;
    deposits: {
      depositId: string;
      refundAmount?: number;
      deductionAmount?: number;
      deductionPurpose?: "balance" | "damage";
      deferRemaining?: boolean;
      reason?: string;
      refundReference?: string;
    }[];
  },
) {
  return apiRequest(`reservations/${encodeURIComponent(id)}/check-out`, { method: "POST", body: input });
}

export function recordReservationPayment(
  id: string,
  input: { idempotencyKey: string; methodId: string; amount: number; notes?: string },
) {
  return apiRequest(`reservations/${encodeURIComponent(id)}/payments`, {
    method: "POST",
    body: input,
  });
}

export function cancelReservation(id: string, reason: string) {
  return apiRequest(`reservations/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    body: { reason },
  });
}
