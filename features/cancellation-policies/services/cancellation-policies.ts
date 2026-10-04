import { apiRequest } from "../../../lib/api/client";
import { getRoomTypes } from "../../rooms/services/room-types";

export type PolicyTypeOption = { id: string; name: string; isActive: boolean };
export type PolicyRoomTypeOption = { id: string; name: string; isActive: boolean };

export type PolicyRuleRecord = {
  id: string;
  timingType: "more_than" | "within";
  daysBefore: number;
  chargeType: "percentage" | "fixed" | "nights";
  chargeValue: number;
  sortOrder: number;
};

export type PolicyRecord = {
  id: string;
  name: string;
  policyTypeId: string;
  appliesWebsite: boolean;
  appliesPhone: boolean;
  stayStart: string | null;
  stayEnd: string | null;
  noShowChargeType: "percentage" | "first_night" | "full_stay" | null;
  noShowChargeValue: number;
  isActive: boolean;
  roomTypes: { id: string; name: string }[];
  rules: PolicyRuleRecord[];
};

export type PolicyInput = {
  policyTypeId: string;
  appliesWebsite: boolean;
  appliesPhone: boolean;
  stayStart: string | null;
  stayEnd: string | null;
  noShowChargeType: "percentage" | "first_night" | "full_stay" | null;
  noShowChargeValue: number;
  isActive: boolean;
  roomTypeIds: string[];
  rules: {
    timingType: "more_than" | "within";
    daysBefore: number;
    chargeType: "percentage" | "fixed" | "nights";
    chargeValue: number;
    sortOrder: number;
  }[];
};

export function listPolicies(query: URLSearchParams, signal?: AbortSignal) {
  return apiRequest<{
    items: PolicyRecord[];
    page: number;
    limit: number;
    total: number;
    counts: { active: number; inactive: number };
  }>(`cancellation-policies?${query}`, { signal });
}

export function getPolicy(id: string, signal?: AbortSignal) {
  return apiRequest<{ policy: PolicyRecord }>(`cancellation-policies/${encodeURIComponent(id)}`, { signal });
}

export function createPolicy(body: PolicyInput) {
  return apiRequest<{ policy: PolicyRecord }>("cancellation-policies", { method: "POST", body });
}

export function updatePolicy(id: string, body: PolicyInput) {
  return apiRequest<{ policy: PolicyRecord }>(`cancellation-policies/${encodeURIComponent(id)}`, {
    method: "PUT",
    body,
  });
}

export function setPolicyStatus(id: string, isActive: boolean) {
  return apiRequest<{ policy: PolicyRecord }>(`cancellation-policies/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: { isActive },
  });
}

export async function listPolicyTypes(signal?: AbortSignal) {
  const result = await apiRequest<{ items: PolicyTypeOption[] }>("master/cancellation-policy-types", { signal });
  return result.items;
}

export async function listPolicyRoomTypes(signal?: AbortSignal) {
  const first = await getRoomTypes(new URLSearchParams({ page: "1", limit: "100" }), signal);
  const pages = await Promise.all(
    Array.from({ length: Math.ceil(first.total / 100) - 1 }, (_, index) =>
      getRoomTypes(new URLSearchParams({ page: String(index + 2), limit: "100" }), signal),
    ),
  );
  return [first, ...pages].flatMap((page) =>
    page.items.map(({ id, name, isActive }) => ({ id, name, isActive })),
  );
}
