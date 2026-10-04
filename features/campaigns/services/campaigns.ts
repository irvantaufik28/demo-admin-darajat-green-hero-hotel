import { apiRequest } from "../../../lib/api/client";
import { getRoomTypes } from "../../rooms/services/room-types";

export type CampaignChannel = "website" | "front_desk";
export type CampaignRecord = {
  id: string;
  name: string;
  promoCode: string | null;
  requiresCode: boolean;
  bookingStart: string | null;
  bookingEnd: string | null;
  stayStart: string | null;
  stayEnd: string | null;
  discountType: "percent" | "fixed";
  discountValue: number;
  minNights: number;
  minRooms: number;
  priority: number;
  cancellationPolicyId: string | null;
  isActive: boolean;
  channel: CampaignChannel;
  roomTypeIds: string[];
};

export type CampaignDetail = Omit<CampaignRecord, "roomTypeIds"> & {
  roomTypes: { id: string; code: string; name: string }[];
  weekdays: number[];
  blackoutDates: {
    id: string;
    dateFrom: string;
    dateTo: string;
    label: string | null;
  }[];
};

export type CampaignInput = {
  name: string;
  promoCode: string | null;
  requiresCode: boolean;
  bookingStart: string | null;
  bookingEnd: string | null;
  stayStart: string | null;
  stayEnd: string | null;
  discountType: "percent" | "fixed";
  discountValue: number;
  minNights: number;
  minRooms: number;
  priority: number;
  cancellationPolicyId: string | null;
  isActive: boolean;
  channel: CampaignChannel;
  roomTypeIds: string[];
  weekdays: number[];
  blackoutDates: { dateFrom: string; dateTo: string; label: string | null }[];
};

export type CancellationPolicyOption = {
  id: string;
  name: string;
  isActive: boolean;
  appliesWebsite: boolean;
  appliesPhone: boolean;
};

export type CampaignRoomTypeOption = {
  id: string;
  name: string;
  isActive: boolean;
};

export async function listCampaignRoomTypes(signal?: AbortSignal) {
  const first = await getRoomTypes(new URLSearchParams({ page: "1", limit: "100" }), signal);
  const pages = await Promise.all(
    Array.from({ length: Math.ceil(first.total / 100) - 1 }, (_, index) =>
      getRoomTypes(
        new URLSearchParams({ page: String(index + 2), limit: "100" }),
        signal,
      ),
    ),
  );
  return [first, ...pages].flatMap((page) =>
    page.items.map(({ id, name, isActive }) => ({ id, name, isActive })),
  );
}

export function listCampaigns(query: URLSearchParams, signal?: AbortSignal) {
  return apiRequest<{
    items: CampaignRecord[];
    page: number;
    limit: number;
    total: number;
  }>(`campaigns?${query}`, { signal });
}

export function getCampaign(id: string, signal?: AbortSignal) {
  return apiRequest<{ campaign: CampaignDetail }>(
    `campaigns/${encodeURIComponent(id)}`,
    { signal },
  );
}

export function createCampaign(body: CampaignInput) {
  return apiRequest<{ campaign: CampaignDetail }>("campaigns", {
    method: "POST",
    body,
  });
}

export function updateCampaign(id: string, body: CampaignInput) {
  return apiRequest<{ campaign: CampaignDetail }>(
    `campaigns/${encodeURIComponent(id)}`,
    { method: "PUT", body },
  );
}

export function setCampaignStatus(id: string, isActive: boolean) {
  return apiRequest<{ campaign: CampaignRecord }>(
    `campaigns/${encodeURIComponent(id)}/status`,
    { method: "PATCH", body: { isActive } },
  );
}

export function deleteCampaign(id: string) {
  return apiRequest<void>(`campaigns/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function listCancellationPolicyOptions(signal?: AbortSignal) {
  const first = await apiRequest<{
    items: CancellationPolicyOption[];
    total: number;
  }>("cancellation-policies?page=1&limit=100", { signal });
  const pages = await Promise.all(
    Array.from({ length: Math.ceil(first.total / 100) - 1 }, (_, index) =>
      apiRequest<{ items: CancellationPolicyOption[] }>(
        `cancellation-policies?page=${index + 2}&limit=100`,
        { signal },
      ),
    ),
  );
  return [first, ...pages].flatMap((page) => page.items);
}
