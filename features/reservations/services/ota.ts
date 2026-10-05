import { apiRequest } from "../../../lib/api/client";
import { getRoomTypes, type RoomTypeRecord } from "../../rooms/services/room-types";
import { getReservationExperiences, type ExperienceOption, type ReservationQuote } from "./create";

export type OtaChannel = { id: string; name: string; isActive: boolean };
export type OtaRoom = {
  roomTypeId: string;
  otaRatePerNight: number;
  adults: number;
  children: number;
  extraBeds: number;
};
export type OtaExperience = { variantId: string; quantity: number };

export async function getOtaFormOptions(signal?: AbortSignal) {
  const [channels, firstRoomPage, experiences] = await Promise.all([
    apiRequest<{ items: OtaChannel[] }>("master/ota-channels", { signal }),
    getRoomTypes(new URLSearchParams({ page: "1", limit: "100", isActive: "true" }), signal),
    getReservationExperiences(signal),
  ]);
  const remainingRoomPages = await Promise.all(
    Array.from({ length: Math.ceil(firstRoomPage.total / firstRoomPage.limit) - 1 }, (_, index) =>
      getRoomTypes(new URLSearchParams({ page: String(index + 2), limit: "100", isActive: "true" }), signal),
    ),
  );
  return {
    channels: channels.items.filter((item) => item.isActive),
    roomTypes: [firstRoomPage, ...remainingRoomPages].flatMap((page) => page.items) as RoomTypeRecord[],
    experiences: experiences.items as ExperienceOption[],
  };
}

export function quoteOtaReservation(input: {
  checkInDate: string;
  checkOutDate: string;
  rooms: OtaRoom[];
  experiences: OtaExperience[];
}, signal?: AbortSignal) {
  return apiRequest<ReservationQuote>("reservations/quote", {
    method: "POST",
    body: { source: "ota", ...input },
    signal,
  });
}

export function createOtaReservation(input: {
  idempotencyKey: string;
  otaChannelId: string;
  externalReference: string;
  guest: { fullName: string; phone?: string; email?: string };
  checkInDate: string;
  checkOutDate: string;
  rooms: OtaRoom[];
  experiences: OtaExperience[];
  specialRequests?: string;
}) {
  return apiRequest<{ reservation: { id: string; bookingCode: string; reservationStatus: string } }>(
    "reservations",
    { method: "POST", body: { source: "ota", confirm: true, ...input } },
  );
}
