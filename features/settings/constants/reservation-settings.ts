export type ReservationSettings = {
  checkInTime: string;
  checkOutTime: string;
  autoConfirmWebsiteAfterPayment: boolean;
  allowOutstandingCheckIn: boolean;
  allowOutstandingCheckOut: boolean;
  websitePaymentExpiryMinutes: number;
  noShowMode: "manual" | "automatic";
  noShowCutoffTime: string;
};

export const defaultReservationSettings: ReservationSettings = {
  checkInTime: "14:00",
  checkOutTime: "12:00",
  autoConfirmWebsiteAfterPayment: true,
  allowOutstandingCheckIn: true,
  allowOutstandingCheckOut: true,
  websitePaymentExpiryMinutes: 30,
  noShowMode: "automatic",
  noShowCutoffTime: "06:00",
};
