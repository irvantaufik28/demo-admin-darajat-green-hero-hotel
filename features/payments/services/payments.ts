import { apiRequest } from "../../../lib/api/client";

export type PaymentListItem = {
  id: string;
  bookingCode: string;
  source: "website" | "walk_in" | "phone" | "ota";
  otaChannel: string | null;
  checkInDate: string;
  checkOutDate: string;
  reservationStatus: string;
  paymentStatus: string;
  guest: { fullName: string; phone: string };
  bookingTotal: number;
  paidAmount: number;
  refundedAmount: number;
  remainingBalance: number;
  method: { id: string; name: string } | null;
};

export type PaymentListResponse = {
  items: PaymentListItem[];
  methods: { id: string; name: string }[];
  page: number;
  limit: number;
  total: number;
};

export function getPayments(query: URLSearchParams, signal?: AbortSignal) {
  return apiRequest<PaymentListResponse>(`payments?${query}`, { signal });
}

export type PaymentTransaction = {
  id: string;
  reservationId: string;
  bookingCode: string;
  source: string;
  reservationStatus: string;
  paymentStatus: string;
  guest: { fullName: string; phone: string };
  amount: number;
  status: string;
  provider: string | null;
  providerReference: string | null;
  paidAt: string | null;
  createdAt: string;
  method: { id: string; name: string };
  refundedAmount: number;
  pendingRefundAmount: number;
};

export type RefundListItem = {
  reservationId: string;
  bookingCode: string;
  source: string;
  guest: { fullName: string; phone: string };
  cancelledAt: string | null;
  paymentStatus: string;
  status: string;
  grossPaidAmount: number;
  refundedAmount: number;
  pendingRefundAmount: number;
  netPaidAmount: number;
  estimatedRefundAmount: number | null;
  maxRefundWithOverride: number;
  settlementCalculationStatus: string;
  policy: { name: string | null };
  reviewReasons: string[];
};

export type OutstandingListItem = {
  id: string;
  bookingCode: string;
  source: string;
  checkInDate: string;
  checkOutDate: string;
  checkedOutAt: string | null;
  paymentStatus: string;
  checkoutOutstandingReason: string | null;
  guest: { fullName: string; phone: string };
  bookingTotal: number;
  grossPaid: number;
  refundedAmount: number;
  remainingBalance: number;
};

export type PagedPayments<T> = { items: T[]; page: number; limit: number; total: number };

export function getPaymentTransactions(query: URLSearchParams, signal?: AbortSignal) {
  return apiRequest<PagedPayments<PaymentTransaction>>(`payments/transactions?${query}`, { signal });
}

export function getRefunds(query: URLSearchParams, signal?: AbortSignal) {
  return apiRequest<PagedPayments<RefundListItem>>(`payments/refunds?${query}`, { signal });
}

export function getOutstandingBalances(query: URLSearchParams, signal?: AbortSignal) {
  return apiRequest<PagedPayments<OutstandingListItem> & { summary: { total: number; totalOutstanding: number } }>(`payments/outstanding?${query}`, { signal });
}

export type RefundEligibility = {
  reservationId: string;
  bookingCode: string;
  hasCancellationPolicySnapshot: boolean;
  noRefundDecision: { occurredAt: string; details: { reason?: string } } | null;
  settlement: {
    calculationStatus: string;
    reviewReasons: string[];
    policy: {
      name: string | null;
      daysBeforeCheckIn: number;
      appliedRule: {
        timingType: "more_than" | "within";
        daysBefore: number;
        chargeType: "percentage" | "fixed" | "nights";
        chargeValue: number;
      } | null;
      rooms: {
        roomIndex: number;
        roomTypeName: string;
        policyName: string | null;
        appliedRule: {
          timingType: "more_than" | "within";
          daysBefore: number;
          chargeType: "percentage" | "fixed" | "nights";
          chargeValue: number;
        } | null;
        roomTotal: number;
        cancellationCharge: number | null;
      }[];
    };
    amounts: {
      bookingTotal: number;
      roomTotal: number;
      otherCharges: number;
      netPaidAmount: number;
      cancellationCharge: number | null;
      maximumRefundWithoutOverride: number | null;
      estimatedRefundAmount: number | null;
    };
  };
  grossPaidAmount: number;
  refundedAmount: number;
  pendingRefundAmount: number;
  maxRefundWithOverride: number;
  refunds: { id: string; paymentId: string; amount: number; status: string; reason: string | null; reference: string | null; processedAt: string | null }[];
  payments: { id: string; methodName: string | null; paidAt: string | null; amount: number; refundedAmount: number; pendingAmount: number; refundableRemaining: number }[];
};

export function getRefundEligibility(reservationId: string) {
  return apiRequest<RefundEligibility>(`reservations/${reservationId}/refund-eligibility`);
}

export function completeCancellationRefund(reservationId: string, input: {
  expectedAmount: number;
  reason: string;
  ignoreCancellationPolicy: boolean;
  settlementOverrideReason?: string;
}) {
  return apiRequest(`reservations/${reservationId}/refunds/complete-settlement`, {
    method: "POST",
    body: input,
  });
}

export function recordNoRefund(reservationId: string, reason: string) {
  return apiRequest(`reservations/${reservationId}/refunds/no-refund`, {
    method: "POST",
    body: { reason },
  });
}

export type PrepareRefundInput = {
  paymentId: string;
  amount: number;
  reason: string;
  ignoreCancellationPolicy: boolean;
  settlementOverrideReason?: string;
};

export function prepareRefund(reservationId: string, input: PrepareRefundInput) {
  return apiRequest(`reservations/${reservationId}/refunds/prepare`, { method: "POST", body: input });
}

export function completeRefund(reservationId: string, refundId: string, reference: string) {
  return apiRequest(`reservations/${reservationId}/refunds/${refundId}/complete`, { method: "POST", body: { reference } });
}

export function failRefund(reservationId: string, refundId: string, reason: string) {
  return apiRequest(`reservations/${reservationId}/refunds/${refundId}/fail`, { method: "POST", body: { reason } });
}
