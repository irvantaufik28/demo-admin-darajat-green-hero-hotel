import { apiRequest } from "../../../lib/api/client";

export type SelectableRoomType = {
  id: string;
  name: string;
  description: string | null;
  coverImage: { url: string; altText: string | null } | null;
};

export type FavoriteRoom = {
  roomTypeId: string;
  sortOrder: number;
  isActive: boolean;
  roomTypeIsActive: boolean;
  slug: string;
  name: string;
  description: string | null;
  sizeSqm: string | null;
  maxGuests: number | null;
  coverImage: { url: string; altText: string | null } | null;
  startingPrice: number | null;
};

export function getFavoriteRooms(signal?: AbortSignal) {
  return apiRequest<{ items: FavoriteRoom[] }>("featured-rooms", { signal });
}

export function saveFavoriteRooms(items: Pick<FavoriteRoom, "roomTypeId" | "isActive">[]) {
  return apiRequest<{ items: FavoriteRoom[] }>("featured-rooms", {
    method: "PUT",
    body: { items },
  });
}

export function getActiveRoomTypes(signal?: AbortSignal) {
  return apiRequest<{ items: SelectableRoomType[] }>("featured-rooms/room-types", { signal });
}
