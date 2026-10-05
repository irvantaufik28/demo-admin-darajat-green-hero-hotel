import { apiRequest } from "../../../lib/api/client";
import type { ReservationSettings } from "../constants/reservation-settings";

type ReservationSettingsResponse = {
  settings: ReservationSettings;
  noShowMode: "manual";
  updatedAt: string | null;
  updatedByUserId: string | null;
};

export function getReservationSettings(signal?: AbortSignal) {
  return apiRequest<ReservationSettingsResponse>("settings/reservations", { signal });
}

export function updateReservationSettings(settings: ReservationSettings) {
  return apiRequest<ReservationSettingsResponse>("settings/reservations", {
    method: "PUT",
    body: settings,
  });
}
