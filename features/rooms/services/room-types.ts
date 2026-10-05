import { apiRequest } from "../../../lib/api/client";

export type MasterOption = { id: string; name: string; isActive: boolean };
export type CapacityOption = {
  id: string;
  adults: number;
  children: number;
  isActive: boolean;
};
export type RoomTypeImage = {
  url: string;
  altText: string | null;
  isCover: boolean;
  sortOrder: number;
};
export type RoomTypeRecord = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sizeSqm: string | null;
  bedTypeId: string | null;
  bedTypeName: string | null;
  mealTypeId: string | null;
  mealTypeName: string | null;
  viewTypeId: string | null;
  bedCount: number;
  extraBedEnabled: boolean;
  maxExtraBeds: number;
  extraBedPricePerNight: number;
  adultBreakfastPrice: number;
  childBreakfastPrice: number;
  capacityPatternCount: number;
  coverImage?: RoomTypeImage | null;
  amenities?: MasterOption[];
  capacityPatterns?: { capacityPatternId: string; adults: number; children: number; extraBeds: number }[];
  images?: RoomTypeImage[];
};

export type RoomTypeInput = {
  name: string;
  description: string | null;
  sizeSqm: string;
  bedTypeId: string | null;
  mealTypeId: string | null;
  viewTypeId: string | null;
  bedCount: number;
  extraBedEnabled: boolean;
  maxExtraBeds: number;
  extraBedPricePerNight: number;
  adultBreakfastPrice: number;
  childBreakfastPrice: number;
  amenityIds: string[];
  capacityPatterns: { capacityPatternId: string; extraBeds: number }[];
  images: RoomTypeImage[];
  isActive?: boolean;
};

export type RoomTypeOptions = {
  bedTypes: MasterOption[];
  mealTypes: MasterOption[];
  amenities: MasterOption[];
  capacities: CapacityOption[];
};

export function getRoomTypes(query: URLSearchParams, signal?: AbortSignal) {
  return apiRequest<{ items: RoomTypeRecord[]; page: number; limit: number; total: number }>(
    `room-types?${query}`,
    { signal },
  );
}

export function getRoomType(id: string, signal?: AbortSignal) {
  return apiRequest<{ roomType: RoomTypeRecord }>(`room-types/${encodeURIComponent(id)}`, { signal });
}

export async function getRoomTypeOptions(signal?: AbortSignal): Promise<RoomTypeOptions> {
  const [bedTypes, mealTypes, amenities, capacities] = await Promise.all([
    apiRequest<{ items: MasterOption[] }>("master/bed-types", { signal }),
    apiRequest<{ items: MasterOption[] }>("master/meal-types", { signal }),
    apiRequest<{ items: MasterOption[] }>("master/amenities", { signal }),
    apiRequest<{ items: CapacityOption[] }>("master/capacity-patterns", { signal }),
  ]);
  return {
    bedTypes: bedTypes.items.filter((item) => item.isActive),
    mealTypes: mealTypes.items.filter((item) => item.isActive),
    amenities: amenities.items.filter((item) => item.isActive),
    capacities: capacities.items.filter((item) => item.isActive),
  };
}

export function createRoomType(body: RoomTypeInput) {
  return apiRequest<{ roomType: RoomTypeRecord }>("room-types", { method: "POST", body });
}

export function updateRoomType(id: string, body: RoomTypeInput) {
  return apiRequest<{ roomType: RoomTypeRecord }>(`room-types/${encodeURIComponent(id)}`, {
    method: "PUT",
    body,
  });
}
