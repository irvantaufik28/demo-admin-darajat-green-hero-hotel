export type DiscountType = "percent" | "fixed";

export type BlackoutDate = {
  id: string;
  from: string;
  to: string;
  label?: string;
};

export const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
