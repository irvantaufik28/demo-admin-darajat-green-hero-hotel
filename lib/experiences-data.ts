export type ExperienceType = "Dining" | "Celebrate";
export type PricingType = "Per Package" | "Per Person" | "Per Item";
export type LeadTime = "Same Day" | "H-1" | "H-2" | "H-3";

export type Experience = {
  id: string;
  name: string;
  description: string;
  type: ExperienceType;
  price: number; // IDR
  pricingType: PricingType;
  leadTime: LeadTime;
  minQty: number;
  maxQty: number | null; // null = no limit
  availableDays: string[]; // ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
  roomTypes: string[]; // empty = all room types
  status: "Active" | "Inactive";
  internalNote: string;
  iconKey: ExperienceIcon;
};

export type ExperienceIcon =
  | "grill"
  | "restaurant"
  | "dinner"
  | "birthday"
  | "celebration"
  | "florist";

export const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const ALL_ROOM_TYPES_EXP = ["Deluxe Room", "Family Room", "Suite Room"] as const;

export const experiences: Experience[] = [
  {
    id: "exp-001",
    name: "BBQ & Grill Package",
    description: "Family BBQ package with meat, sausages, corn & seasonings",
    type: "Dining",
    price: 1249000,
    pricingType: "Per Package",
    leadTime: "H-1",
    minQty: 1,
    maxQty: null,
    availableDays: [...ALL_DAYS],
    roomTypes: [],
    status: "Active",
    internalNote:
      "Requires coordination with kitchen team one day before arrival. Confirm guest arrival time.",
    iconKey: "grill",
  },
  {
    id: "exp-002",
    name: "Kambing Guling",
    description: "Whole roasted lamb specialty for family gatherings (min. 20 pax)",
    type: "Dining",
    price: 2500000,
    pricingType: "Per Package",
    leadTime: "H-2",
    minQty: 1,
    maxQty: null,
    availableDays: ["Fri", "Sat", "Sun"],
    roomTypes: [],
    status: "Active",
    internalNote: "Min 20 pax required. Coordinate with kitchen 2 days before.",
    iconKey: "restaurant",
  },
  {
    id: "exp-003",
    name: "Ayam Bakar Package",
    description: "Traditional marinated grilled chicken set with rice and sambal",
    type: "Dining",
    price: 150000,
    pricingType: "Per Person",
    leadTime: "Same Day",
    minQty: 2,
    maxQty: null,
    availableDays: [...ALL_DAYS],
    roomTypes: [],
    status: "Active",
    internalNote: "Can be ordered on arrival day. Minimum 2 persons.",
    iconKey: "dinner",
  },
  {
    id: "exp-004",
    name: "Birthday Decoration",
    description: "Room or gazebo balloon setup, banner, and festive table decor",
    type: "Celebrate",
    price: 500000,
    pricingType: "Per Package",
    leadTime: "H-1",
    minQty: 1,
    maxQty: 1,
    availableDays: [...ALL_DAYS],
    roomTypes: [],
    status: "Active",
    internalNote: "Housekeeping sets up before guest check-in. Confirm room number.",
    iconKey: "birthday",
  },
  {
    id: "exp-005",
    name: "Anniversary Setup",
    description: "Romantic candlelit dinner setup with fresh highland flower petals",
    type: "Celebrate",
    price: 750000,
    pricingType: "Per Package",
    leadTime: "H-1",
    minQty: 1,
    maxQty: 1,
    availableDays: [...ALL_DAYS],
    roomTypes: [],
    status: "Active",
    internalNote:
      "Includes rose petals, candles, and a chilled mocktail. Setup takes 45 minutes.",
    iconKey: "celebration",
  },
  {
    id: "exp-006",
    name: "Room Decoration",
    description: "Welcome flower garland and customized greeting card in room",
    type: "Celebrate",
    price: 250000,
    pricingType: "Per Item",
    leadTime: "Same Day",
    minQty: 1,
    maxQty: null,
    availableDays: [...ALL_DAYS],
    roomTypes: [],
    status: "Inactive",
    internalNote: "Currently paused — supplier availability issue.",
    iconKey: "florist",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatPrice(price: number): string {
  return "Rp" + new Intl.NumberFormat("id-ID").format(price);
}

export function formatLeadTime(lead: LeadTime): string {
  return lead;
}
