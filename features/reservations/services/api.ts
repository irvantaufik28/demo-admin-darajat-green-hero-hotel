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

export type ArrivalTodayItem = {
  id: string;
  bookingCode: string;
  source: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  reservationStatus: ReservationStatus;
  paymentStatus: PaymentStatus;
  operationalStatus: { code: string; label: string };
  guest: { fullName: string; phone: string };
  otaChannel: { name: string } | null;
  roomSummary: string;
};

export type ArrivalsTodayResponse = {
  date: string;
  items: ArrivalTodayItem[];
  page: number;
  limit: number;
  total: number;
};

export function getArrivalsToday(query: URLSearchParams, signal?: AbortSignal) {
  return apiRequest<ArrivalsTodayResponse>(`reservations/arrivals-today?${query}`, { signal });
}

export type DepartureTodayItem = {
  id: string;
  bookingCode: string;
  checkOutDate: string;
  reservationStatus: ReservationStatus;
  paymentStatus: PaymentStatus;
  operationalStatus: { code: string; label: string };
  guest: { fullName: string; phone: string };
  rooms: { id: string; roomNumber: string | null }[];
  roomSummary: string;
  deposit: {
    amountHeld: number;
    amountRefunded: number;
    amountDeducted: number;
    heldBalance: number;
    label: string;
  };
};

export type DeparturesTodayResponse = {
  date: string;
  summary: { total: number; dueOut: number; overdue: number; checkedOut: number };
  items: DepartureTodayItem[];
  page: number;
  limit: number;
  total: number;
};

export function getDeparturesToday(query: URLSearchParams, signal?: AbortSignal) {
  return apiRequest<DeparturesTodayResponse>(`reservations/departures-today?${query}`, { signal });
}

export type InHouseItem = {
  id: string;
  bookingCode: string;
  checkOutDate: string;
  reservationStatus: ReservationStatus;
  paymentStatus: PaymentStatus;
  operationalStatus: { code: string; label: string };
  guest: { fullName: string; phone: string };
  rooms: { id: string; roomNumber: string | null }[];
  roomSummary: string;
  deposit: { heldBalance: number; label: string };
};

export type InHouseResponse = {
  date: string;
  summary: { guestsInHouse: number; roomsOccupied: number; inHouse: number; dueOut: number; overdue: number };
  items: InHouseItem[];
  page: number;
  limit: number;
  total: number;
};

export function getInHouse(query: URLSearchParams, signal?: AbortSignal) {
  return apiRequest<InHouseResponse>(`reservations/in-house?${query}`, { signal });
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
      discountAmount: number;
      finalPrice: number;
      campaignSnapshot: {
        id: string;
        name: string;
        promoCode: string | null;
        channel: string;
        discountType: string;
        discountValue: number;
        priority: number;
        bookingStart: string | null;
        bookingEnd: string | null;
        stayStart: string | null;
        stayEnd: string | null;
      } | null;
    }[];
    extraBeds: {
      id: string;
      quantity: number;
      dateFrom: string;
      dateTo: string;
      unitPricePerNight: number;
    }[];
  }[];
  appliedCampaigns: {
    id: string;
    name: string;
    promoCode: string | null;
  }[];
  experiences: {
    id: string;
    experienceId: string;
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
    unitAmount: number;
    amount: number;
  }[];
  payments: {
    id: string;
    amount: number;
    status: string;
    paidAt: string | null;
    providerReference: string | null;
    method: { name: string } | null;
    recordedBy: { id: string; name: string } | null;
  }[];
  refunds: {
    id: string;
    amount: number;
    status: string;
    processedAt: string | null;
    providerReference: string | null;
    processedBy: { id: string; name: string } | null;
  }[];
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
    grossPaidAmount: number;
    refundedAmount: number;
    paidAmount: number;
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
  actorType: "user" | "system" | "gateway";
  actor: { id: string; name: string } | null;
  reservationStatusBefore: ReservationStatus | null;
  reservationStatusAfter: ReservationStatus | null;
  paymentStatusBefore: PaymentStatus | null;
  paymentStatusAfter: PaymentStatus | null;
  details?: Record<string, unknown>;
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
    earlyCheckIn?: EarlyCheckInInput;
  },
) {
  return apiRequest(`reservations/${encodeURIComponent(id)}/check-in`, { method: "POST", body: input });
}

export type EarlyCheckInInput = {
  acknowledged: boolean;
  chargeAmount: number;
  paymentTiming: "now" | "later";
  paymentMethodId?: string;
};

export type CheckInContext = {
  checkInDate: string;
  serverDate: string;
  serverTime: string;
  standardCheckInTime: string;
  required: boolean;
};

export function getCheckInContext(checkInDate: string) {
  const query = new URLSearchParams({ checkInDate });
  return apiRequest<CheckInContext>(`reservations/check-in-context?${query}`);
}

export function checkOutReservation(
  id: string,
  input: {
    acknowledgeOutstanding?: boolean;
    outstandingReason?: string;
    acknowledgeEarlyDeparture?: boolean;
    lateCheckOut?: LateCheckOutInput;
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

export type ExtendStayQuote = {
  reservationId: string;
  oldCheckOutDate: string;
  newCheckOutDate: string;
  nights: number;
  version: number;
  rooms: {
    reservationRoomId: string;
    roomTypeName: string;
    roomNumber: string | null;
    roomAmount: number;
    extraBeds: { quantity: number; unitPricePerNight: number; amount: number } | null;
    breakfasts: { description: string; quantityPerNight: number; unitAmount: number }[];
    breakfastAmount: number;
    total: number;
    nights: { stayDate: string; basePrice: number; discountAmount: number; finalPrice: number; campaignSnapshot: { name: string } | null }[];
  }[];
  discountTotal: number;
  extensionTotal: number;
  existingBalance: number;
  projectedBalance: number;
};

export function getExtendStayQuote(id: string, newCheckOutDate: string) {
  const query = new URLSearchParams({ newCheckOutDate });
  return apiRequest<ExtendStayQuote>(`reservations/${encodeURIComponent(id)}/extend-stay/quote?${query}`);
}

export function extendReservationStay(id: string, input: {
  newCheckOutDate: string;
  expectedVersion: number;
  payment?: { methodId: string; amount: number };
}) {
  return apiRequest(`reservations/${encodeURIComponent(id)}/extend-stay`, { method: "POST", body: input });
}

export type ChangeRoomOption = {
  id: string;
  roomNumber: string;
  roomTypeId: string;
  roomTypeName: string;
  available: boolean;
  reason: string | null;
};

export type ChangeRoomQuote = {
  reservationRoomId: string;
  oldRoomNumber: string | null;
  oldRoomTypeName: string;
  targetRoomUnitId: string;
  targetRoomNumber: string;
  targetRoomTypeName: string;
  effectiveDate: string;
  checkOutDate: string;
  nights: number;
  oldRoomAmount: number;
  newRoomAmount: number;
  roomDifference: number;
  extraBedQuantity: number;
  oldExtraBedAmount: number;
  newExtraBedAmount: number;
  extraBedDifference: number;
  totalDifference: number;
  version: number;
  newNights: { stayDate: string; finalPrice: number; discountAmount: number; campaignSnapshot: { name: string } | null }[];
};

export type ExtraBedQuote = {
  reservationRoomId: string;
  roomTypeName: string;
  effectiveDate: string;
  checkOutDate: string;
  nights: number;
  previousQuantity: number;
  quantity: number;
  unitPricePerNight: number;
  maxExtraBeds: number;
  previousRemainingAmount: number;
  newAmount: number;
  difference: number;
  version: number;
};

function roomOperationPath(id: string, roomId: string) {
  return `reservations/${encodeURIComponent(id)}/rooms/${encodeURIComponent(roomId)}`;
}

export function getChangeRoomOptions(id: string, roomId: string) {
  return apiRequest<{ options: ChangeRoomOption[]; effectiveDate: string; checkOutDate: string }>(`${roomOperationPath(id, roomId)}/change-options`);
}

export function getChangeRoomQuote(id: string, roomId: string, targetRoomUnitId: string) {
  const query = new URLSearchParams({ targetRoomUnitId });
  return apiRequest<ChangeRoomQuote>(`${roomOperationPath(id, roomId)}/change-room/quote?${query}`);
}

export function changeReservationRoom(id: string, roomId: string, input: { targetRoomUnitId: string; expectedVersion: number }) {
  return apiRequest(`${roomOperationPath(id, roomId)}/change-room`, { method: "POST", body: input });
}

export function getExtraBedQuote(id: string, roomId: string, quantity: number) {
  const query = new URLSearchParams({ quantity: String(quantity) });
  return apiRequest<ExtraBedQuote>(`${roomOperationPath(id, roomId)}/extra-beds/quote?${query}`);
}

export function changeReservationExtraBeds(id: string, roomId: string, input: { quantity: number; expectedVersion: number }) {
  return apiRequest(`${roomOperationPath(id, roomId)}/extra-beds`, { method: "POST", body: input });
}

export type ReservationExperienceOption = {
  id: string;
  name: string;
  description: string | null;
  maxQuantity: number;
  isActive: boolean;
  category: { id: string; name: string };
  variants: {
    id: string;
    subName: string;
    description: string | null;
    price: number;
  }[];
};

export type ExperienceBillItem = { variantId: string; quantity: number; serviceDate?: string };

export type ExperienceBillQuote = {
  version: number;
  lines: { variantId: string; name: string; quantity: number; unitPrice: number; amount: number; serviceDate: string | null }[];
  addedTotal: number;
  bookingTotalBefore: number;
  bookingTotalAfter: number;
  paidAmount: number;
  remainingBalanceAfter: number;
};

export async function getReservationExperienceOptions() {
  const result = await apiRequest<{ items: ReservationExperienceOption[] }>("experiences?isActive=true&limit=100");
  return result.items.filter((item) => item.isActive && item.variants.length > 0);
}

export function quoteReservationExperienceBill(id: string, items: ExperienceBillItem[]) {
  return apiRequest<ExperienceBillQuote>(`reservations/${encodeURIComponent(id)}/experience-bill/quote`, {
    method: "POST", body: { items },
  });
}

export function saveReservationExperienceBill(id: string, input: { expectedVersion: number; expectedAddedTotal: number; items: ExperienceBillItem[] }) {
  return apiRequest(`reservations/${encodeURIComponent(id)}/experience-bill`, {
    method: "POST", body: input,
  });
}

export type LateCheckOutInput = {
  acknowledged: boolean;
  chargeAmount: number;
  paymentTiming: "now" | "later";
  paymentMethodId?: string;
};

export type CheckOutContext = {
  checkOutDate: string;
  serverDate: string;
  serverTime: string;
  standardCheckOutTime: string;
  kind: "normal" | "early_departure" | "late_checkout";
};

export function getCheckOutContext(checkOutDate: string) {
  const query = new URLSearchParams({ checkOutDate });
  return apiRequest<CheckOutContext>(`reservations/check-out-context?${query}`);
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
