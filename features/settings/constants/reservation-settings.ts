export type ReservationSettings = {
  checkInTime: string;
  checkOutTime: string;
  autoConfirmWebsite: boolean;
  allowOutstandingCheckIn: boolean;
  allowOutstandingCheckOut: boolean;
  websitePaymentExpiryMinutes: number;
};

export const defaultReservationSettings: ReservationSettings = {
  checkInTime: "14:00",
  checkOutTime: "12:00",
  autoConfirmWebsite: true,
  allowOutstandingCheckIn: true,
  allowOutstandingCheckOut: true,
  websitePaymentExpiryMinutes: 30,
};

const storageKey = "green-hero-reservation-settings";

export function readReservationSettings(): ReservationSettings {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(storageKey) || "null");
    if (!value || typeof value !== "object") return defaultReservationSettings;
    const settings = value as Partial<ReservationSettings>;
    return {
      checkInTime: typeof settings.checkInTime === "string" ? settings.checkInTime : "14:00",
      checkOutTime: typeof settings.checkOutTime === "string" ? settings.checkOutTime : "12:00",
      autoConfirmWebsite: typeof settings.autoConfirmWebsite === "boolean" ? settings.autoConfirmWebsite : true,
      allowOutstandingCheckIn: typeof settings.allowOutstandingCheckIn === "boolean" ? settings.allowOutstandingCheckIn : true,
      allowOutstandingCheckOut: typeof settings.allowOutstandingCheckOut === "boolean" ? settings.allowOutstandingCheckOut : true,
      websitePaymentExpiryMinutes: typeof settings.websitePaymentExpiryMinutes === "number"
        ? settings.websitePaymentExpiryMinutes : 30,
    };
  } catch {
    return defaultReservationSettings;
  }
}

export function saveReservationSettings(settings: ReservationSettings) {
  sessionStorage.setItem(storageKey, JSON.stringify(settings));
}
