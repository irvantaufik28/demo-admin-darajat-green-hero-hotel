import { apiRequest } from "../../../lib/api/client";
import type {
  Reservation,
  RoomRackSummary,
  RoomStatus,
  RoomTypeGroup,
} from "../constants/room-rack-data";

type RackBooking = {
  reservationRoomId: string;
  reservationId: string;
  roomTypeId: string;
  roomUnitId: string | null;
  bookingCode: string;
  guestName: string;
  source: "website" | "phone" | "walk_in" | "ota";
  otaChannelName: string | null;
  checkInDate: string;
  checkOutDate: string;
  displayCheckOutDate: string;
  reservationStatus: "pending" | "confirmed" | "checked_in" | "checked_out";
  paymentStatus: "unpaid" | "partial" | "paid" | "failed" | "expired" | "refunded";
  operationalStatus: { code: string; label: string } | null;
};

type RackMaintenance = {
  id: string;
  roomUnitId: string;
  startDate: string;
  endDate: string;
  reason: string;
};

type RackInventory = {
  stayDate: string;
  isConfigured: boolean;
  basePrice: number | null;
  availableRooms: number | null;
  stopSell: boolean | null;
  heldForUnassigned: boolean;
  frontDeskPrice: number | null;
};

type RackRoom = {
  id: string;
  roomNumber: string;
  floorName: string | null;
  bedConfiguration: string | null;
  operationalStatus: string;
  isActive: boolean;
  reservations: RackBooking[];
  maintenanceBlocks: RackMaintenance[];
};

type RackGroup = {
  roomType: { id: string; name: string; code: string; bedTypeName: string | null; isActive: boolean };
  rooms: RackRoom[];
  unassignedReservations: RackBooking[];
  inventory: RackInventory[];
};

export type RoomRackResponse = {
  startDate: string;
  endDateExclusive: string;
  days: number;
  dates: string[];
  serverDate: string;
  overdueUnassigned: {
    reservationId: string;
    reservationRoomId: string;
    bookingCode: string;
    guestName: string;
    roomTypeId: string;
    roomTypeName: string;
    source: "website" | "phone" | "walk_in" | "ota";
    paymentStatus: RackBooking["paymentStatus"];
    checkInDate: string;
    checkOutDate: string;
    unassignedRooms: number;
  }[];
  overdueUnassignedHasMore: boolean;
  groups: RackGroup[];
};

export function getRoomRack(startDate: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ startDate, days: "14" });
  return apiRequest<RoomRackResponse>(`reservations/room-rack?${query}`, { signal });
}

export function markRoomAvailable(roomId: string) {
  return apiRequest(`room-numbers/${roomId}/operational-status`, {
    method: "PATCH",
    body: { operationalStatus: "available" },
  });
}

function sourceLabel(booking: RackBooking): string {
  if (booking.source === "walk_in") return "Walk-in";
  if (booking.source === "phone") return "Phone";
  if (booking.source === "website") return "Website";
  return booking.otaChannelName ? `OTA ${booking.otaChannelName}` : "OTA";
}

function toReservation(booking: RackBooking): Reservation {
  const operational = booking.operationalStatus?.code;
  const status: Reservation["status"] =
    booking.reservationStatus === "checked_out"
      ? "checked-out"
      : booking.reservationStatus === "checked_in"
        ? operational === "overdue"
          ? "overdue"
          : operational === "due_out"
            ? "due-out"
            : "in-house"
        : booking.reservationStatus === "pending" ? "awaiting-confirmation" : "confirmed";
  return {
    id: booking.bookingCode,
    reservationId: booking.reservationId,
    reservationRoomId: booking.reservationRoomId,
    guestName: booking.guestName,
    source: sourceLabel(booking),
    status,
    reservationStatus: booking.reservationStatus,
    paymentStatus: booking.paymentStatus,
    operationalStatus: booking.operationalStatus,
    checkIn: booking.checkInDate,
    checkOut: booking.checkOutDate,
    displayCheckOut: booking.displayCheckOutDate,
  };
}

function roomStatus(room: RackRoom): RoomStatus {
  if (!room.isActive) return "out_of_service";
  if (room.operationalStatus === "available") return "vacant";
  if (
    room.operationalStatus === "occupied" ||
    room.operationalStatus === "cleaning" ||
    room.operationalStatus === "maintenance" ||
    room.operationalStatus === "out_of_service"
  ) return room.operationalStatus;
  return "out_of_service";
}

export function toRoomRackGroups(response: RoomRackResponse): RoomTypeGroup[] {
  return response.groups.map((group) => ({
    id: group.roomType.id,
    name: group.roomType.name,
    unitCount: group.rooms.length,
    dailyRates: group.inventory.map((day) => day.frontDeskPrice ?? day.basePrice),
    inventory: group.inventory.map((day) => ({
      stayDate: day.stayDate,
      isConfigured: day.isConfigured,
      availableRooms: day.availableRooms,
      heldForUnassigned: day.heldForUnassigned,
      stopSell: day.stopSell,
    })),
    unassignedReservations: group.unassignedReservations.map(toReservation),
    rooms: group.rooms.map((room) => ({
      id: room.id,
      number: room.roomNumber,
      bedType: group.roomType.bedTypeName ?? "—",
      floor: room.floorName ?? "—",
      status: roomStatus(room),
      isActive: room.isActive,
      reservations: [
        ...room.reservations.map(toReservation),
        ...room.maintenanceBlocks.map((block): Reservation => ({
          id: `MNT-${block.id}`,
          guestName: "Maintenance",
          source: "Direct",
          status: "maintenance",
          maintenanceNote: block.reason,
          checkIn: block.startDate,
          checkOut: block.endDate,
        })),
      ],
    })),
  }));
}

export function summarizeRoomRack(response: RoomRackResponse): RoomRackSummary {
  const date = response.dates.includes(response.serverDate)
    ? response.serverDate
    : response.startDate;
  const bookings = response.groups.flatMap((group) => [
    ...group.rooms.flatMap((room) => room.reservations),
    ...group.unassignedReservations,
  ]);
  return {
    availableRooms: response.groups.reduce(
      (total, group) =>
        total + (group.inventory.find((day) => day.stayDate === date)?.availableRooms ?? 0),
      0,
    ),
    readyToCheckIn: bookings.filter(
      (booking) => booking.reservationStatus === "confirmed" && booking.checkInDate === date,
    ).length,
    inHouse: bookings.filter(
      (booking) => booking.reservationStatus === "checked_in" && booking.checkOutDate > date,
    ).length,
    dueOut: bookings.filter(
      (booking) => booking.reservationStatus === "checked_in" && booking.checkOutDate === date,
    ).length,
    unavailable: response.groups.reduce(
      (total, group) =>
        total + group.rooms.filter((room) =>
          !room.isActive ||
          ["cleaning", "maintenance", "out_of_service"].includes(room.operationalStatus) ||
          room.maintenanceBlocks.some((block) => block.startDate <= date && block.endDate > date),
        ).length,
      0,
    ),
  };
}
