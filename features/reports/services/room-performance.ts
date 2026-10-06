import { apiRequest } from "../../../lib/api/client";

export type RoomPerformanceSource = "website" | "phone" | "walk_in" | "ota";
export type RoomPerformanceMode = "actual" | "projected";

export type RoomPerformanceMetrics = {
  rooms: number;
  available: number;
  sold: number;
  unsold: number;
  cancelled: number;
  revenue: number;
  occupancy: number;
  arr: number;
};

export type RoomPerformanceByRoom = RoomPerformanceMetrics & {
  roomTypeId: string;
  name: string;
};

export type RoomPerformanceDaily = RoomPerformanceMetrics & {
  date: string;
};

export type RoomPerformanceResponse = {
  weekStart: string;
  dates: string[];
  nights: number;
  totalRooms: number;
  total: RoomPerformanceMetrics;
  byRoom: RoomPerformanceByRoom[];
  daily: RoomPerformanceDaily[];
};

export type RoomPerformanceParams = {
  from: string;
  roomType?: string;
  source?: string;
  mode: RoomPerformanceMode;
};

export function getRoomPerformance(params: RoomPerformanceParams, signal?: AbortSignal) {
  const query = new URLSearchParams({ from: params.from, mode: params.mode });
  if (params.roomType) query.set("roomType", params.roomType);
  if (params.source) query.set("source", params.source);
  return apiRequest<RoomPerformanceResponse>(`reports/room-performance?${query}`, { signal });
}
