import { formatStayDate } from "../../reservations/constants/walk-in-data";

export type DiscountType = "percent" | "fixed";

export type BlackoutDate = {
  id: string;
  from: string;
  to: string;
  label?: string;
};

export type Campaign = {
  id: string;
  name: string;
  promoCode: string | null; // null = auto-applied, no code required
  requirePromoCode: boolean;
  sources: string[]; // e.g. ["Website", "Walk-in", "Phone", "OTA"]
  roomTypes: string[]; // empty array = all room types
  bookingStart: string;
  bookingEnd: string;
  stayStart: string;
  stayEnd: string;
  applicableDays: string[]; // ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
  discountType: DiscountType;
  discountValue: number; // percent (10) or fixed amount in IDR (200000)
  minNights: number;
  minRooms: number; // optional, default 1
  cancellationPolicy: string;
  blackoutDates: BlackoutDate[];
  priority: number; // 1 = highest
  status: "Active" | "Inactive";
};

export const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type DayKey = (typeof ALL_DAYS)[number];

export const ALL_ROOM_TYPE_OPTIONS = [
  "Deluxe Room",
  "Family Room",
  "Suite Room",
] as const;

export const ALL_SOURCES = ["Website", "Walk-in", "Phone", "OTA"] as const;

export const CANCELLATION_POLICIES = [
  "Flexible Cancellation (Free cancel up to 48 hours before check-in)",
  "Moderate Cancellation (Free cancel up to 7 days before check-in)",
  "Strict Cancellation (Non-refundable within 14 days)",
  "Non Refundable",
] as const;

export const campaigns: Campaign[] = [
  {
    id: "camp-001",
    name: "Weekend Promo",
    promoCode: "WEEKEND10",
    requirePromoCode: true,
    sources: ["Website", "Walk-in"],
    roomTypes: ["Deluxe Room", "Family Room"],
    bookingStart: "2026-09-29",
    bookingEnd: "2026-12-31",
    stayStart: "2026-10-01",
    stayEnd: "2026-12-31",
    applicableDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    discountType: "percent",
    discountValue: 10,
    minNights: 2,
    minRooms: 1,
    cancellationPolicy:
      "Flexible Cancellation (Free cancel up to 48 hours before check-in)",
    blackoutDates: [
      { id: "bd-001-1", from: "2026-12-24", to: "2026-12-26", label: "Christmas peak" },
      { id: "bd-001-2", from: "2026-12-31", to: "2027-01-01", label: "New Year peak" },
    ],
    priority: 1,
    status: "Active",
  },
  {
    id: "camp-002",
    name: "Stay Longer Save More",
    promoCode: null,
    requirePromoCode: false,
    sources: ["Website", "Walk-in", "Phone", "OTA"],
    roomTypes: [],
    bookingStart: "2026-09-29",
    bookingEnd: "2027-03-31",
    stayStart: "2026-10-01",
    stayEnd: "2027-03-31",
    applicableDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    discountType: "fixed",
    discountValue: 200000,
    minNights: 3,
    minRooms: 1,
    cancellationPolicy:
      "Flexible Cancellation (Free cancel up to 48 hours before check-in)",
    blackoutDates: [],
    priority: 2,
    status: "Active",
  },
  {
    id: "camp-003",
    name: "October Flash Sale",
    promoCode: "FLASH15",
    requirePromoCode: true,
    sources: ["Website", "OTA"],
    roomTypes: ["Suite Room"],
    bookingStart: "2026-10-01",
    bookingEnd: "2026-10-07",
    stayStart: "2026-10-01",
    stayEnd: "2026-10-31",
    applicableDays: ["Fri", "Sat", "Sun"],
    discountType: "percent",
    discountValue: 15,
    minNights: 1,
    minRooms: 1,
    cancellationPolicy: "Non Refundable",
    blackoutDates: [],
    priority: 1,
    status: "Inactive",
  },
  {
    id: "camp-004",
    name: "Early Bird 2027",
    promoCode: "EARLY27",
    requirePromoCode: true,
    sources: ["Website", "Phone"],
    roomTypes: ["Deluxe Room", "Suite Room"],
    bookingStart: "2026-10-15",
    bookingEnd: "2026-11-30",
    stayStart: "2027-01-05",
    stayEnd: "2027-04-30",
    applicableDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    discountType: "percent",
    discountValue: 20,
    minNights: 2,
    minRooms: 1,
    cancellationPolicy:
      "Moderate Cancellation (Free cancel up to 7 days before check-in)",
    blackoutDates: [],
    priority: 3,
    status: "Active",
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

export function formatDiscount(campaign: Campaign): string {
  if (campaign.discountType === "percent") {
    return `${campaign.discountValue}% Off`;
  }
  return `Rp ${new Intl.NumberFormat("id-ID").format(campaign.discountValue)} Off`;
}

export function formatBookingPeriod(campaign: Campaign): string {
  return `${formatStayDate(campaign.bookingStart)} — ${formatStayDate(campaign.bookingEnd)}`;
}

export function formatStayPeriod(campaign: Campaign): string {
  return `${formatStayDate(campaign.stayStart)} — ${formatStayDate(campaign.stayEnd)}`;
}

export function formatRoomTypes(campaign: Campaign): string {
  if (campaign.roomTypes.length === 0) return "All Room Types";
  return campaign.roomTypes.join(", ");
}

export function formatMinNights(campaign: Campaign): string {
  return campaign.minNights === 1
    ? "1 Night"
    : `${campaign.minNights} Nights`;
}

export function getCampaignById(id: string): Campaign | undefined {
  return campaigns.find((c) => c.id === id);
}
