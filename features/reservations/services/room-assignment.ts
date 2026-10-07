import { apiRequest } from "../../../lib/api/client";

export type RoomAssignmentOption = {
  id: string;
  roomNumber: string;
  floorName: string | null;
  bedConfiguration: string | null;
  operationalStatus: string;
  isActive: boolean;
  isCurrent: boolean;
  canAssign: boolean;
  unavailableReasons: string[];
};

export type RoomAssignmentOptions = {
  reservation: {
    id: string;
    bookingCode: string;
    reservationStatus: string;
    version: number;
    checkInDate: string;
    checkOutDate: string;
  };
  room: {
    id: string;
    roomTypeId: string;
    roomTypeName: string;
    roomUnitId: string | null;
  };
  options: RoomAssignmentOption[];
};

function assignmentPath(reservationId: string, reservationRoomId: string): string {
  return `reservations/${encodeURIComponent(reservationId)}/rooms/${encodeURIComponent(reservationRoomId)}`;
}

export function getRoomAssignmentOptions(
  reservationId: string,
  reservationRoomId: string,
  signal?: AbortSignal,
) {
  return apiRequest<RoomAssignmentOptions>(
    `${assignmentPath(reservationId, reservationRoomId)}/assignment-options`,
    { signal },
  );
}

export function assignReservationRoom(
  reservationId: string,
  reservationRoomId: string,
  roomUnitId: string,
  expectedVersion: number,
) {
  return apiRequest(
    `${assignmentPath(reservationId, reservationRoomId)}/assignment`,
    { method: "PATCH", body: { roomUnitId, expectedVersion } },
  );
}
