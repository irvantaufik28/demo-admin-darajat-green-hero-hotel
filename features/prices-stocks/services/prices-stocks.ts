import { apiRequest } from "../../../lib/api/client";

export type InventoryItem = {
  id: string | null;
  roomTypeId: string;
  stayDate: string;
  basePrice: number | null;
  sellableStock: number | null;
  minNights: number | null;
  stopSell: boolean | null;
  version: number | null;
  isConfigured: boolean;
  bookedRooms: number;
  remainingStock: number | null;
  availableRooms: number | null;
  websitePromo: { id: string; name: string } | null;
  webPrice: number | null;
  frontDeskPromo: { id: string; name: string } | null;
  frontDeskPrice: number | null;
};

export type InventoryList = {
  roomType: { id: string; name: string; isActive: boolean };
  totalRoomCount: number;
  stockLimit: number;
  operationalRoomCount: number;
  items: InventoryItem[];
  page: number;
  limit: number;
  total: number;
};

export type InventoryChange = {
  stayDate: string;
  expectedVersion: number | null;
  basePrice?: number;
  sellableStock?: number;
  minNights?: number;
  stopSell?: boolean;
};

export type InventoryFields = Omit<InventoryChange, "stayDate" | "expectedVersion">;

export type InventoryRangeUpdate = {
  roomTypeId: string;
  startDate: string;
  endDate: string;
  fields: InventoryFields;
  applicableWeekdays?: number[];
  customDayPrices?: { weekday: number; basePrice: number }[];
};

export function getInventory(query: URLSearchParams, signal?: AbortSignal) {
  return apiRequest<InventoryList>(`prices-stocks?${query}`, { signal });
}

export function updateInventoryRows(roomTypeId: string, changes: InventoryChange[]) {
  return apiRequest<{ updated: number }>("prices-stocks/bulk/rows", {
    method: "PUT",
    body: { roomTypeId, changes },
  });
}

export function updateInventoryRange(body: InventoryRangeUpdate) {
  return apiRequest<{ updated: number; startDate: string; endDate: string }>("prices-stocks/bulk", {
    method: "PUT",
    body,
  });
}
