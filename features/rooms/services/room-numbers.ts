import { apiRequest } from "../../../lib/api/client";

export type RoomOperationalStatus =
  | "available"
  | "occupied"
  | "cleaning"
  | "maintenance"
  | "out_of_service";

export type RoomNumber = {
  id: string;
  roomNumber: string;
  roomTypeId: string;
  roomTypeName: string;
  floorId: string | null;
  floorName: string | null;
  bedConfiguration: string | null;
  operationalStatus: RoomOperationalStatus;
  isActive: boolean;
};

export type RoomNumberInput = {
  roomNumber: string;
  roomTypeId: string;
  floorId: string | null;
  operationalStatus: RoomOperationalStatus;
  isActive: boolean;
};

export type RoomTypeOption = { id: string; name: string; isActive: boolean };
export type FloorOption = { id: string; name: string; isActive: boolean };

export type RoomNumberList = {
  items: RoomNumber[];
  page: number;
  limit: number;
  total: number;
};

export function getRoomNumbers(query: URLSearchParams, signal?: AbortSignal) {
  return apiRequest<RoomNumberList>(`room-numbers?${query}`, { signal });
}

export function getRoomNumberOptions(signal?: AbortSignal) {
  return Promise.all([
    apiRequest<{ items: RoomTypeOption[] }>("room-types?limit=100", { signal }),
    apiRequest<{ items: FloorOption[] }>("master/floor", { signal }),
  ]);
}

export function createRoomNumber(body: RoomNumberInput) {
  return apiRequest<{ roomNumber: RoomNumber }>("room-numbers", {
    method: "POST",
    body,
  });
}

export function updateRoomNumber(id: string, body: RoomNumberInput) {
  return apiRequest<{ roomNumber: RoomNumber }>(`room-numbers/${id}`, {
    method: "PUT",
    body,
  });
}
