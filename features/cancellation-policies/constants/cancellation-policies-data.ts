import { formatStayDate } from "../../reservations/constants/walk-in-data";

export type ChargeType = "Percentage" | "Fixed Amount" | "Nights Count";
export type TimingType = "More than" | "Within";

export type CancellationRule = {
  id: string;
  timing: TimingType;
  days: number;
  chargeType: ChargeType;
  chargeValue: number; // percent, IDR, or nights
};

export type NoShowChargeType = "None" | "Percentage" | "First Night Charge" | "Full Stay Amount";
export type CancellationSource = "Website" | "Phone";

export type CancellationPolicy = {
  id: string;
  policyTypeId?: string;
  name: string;
  status: "Active" | "Inactive";
  sources: CancellationSource[];
  roomTypes: string[]; // empty = all room types
  roomTypeIds?: string[];
  stayStart: string | null; // null = all dates
  stayEnd: string | null;
  applyToAllDates: boolean;
  rules: CancellationRule[];
  noShowChargeType: NoShowChargeType;
  noShowChargeValue: number;
};

export const ALL_ROOM_TYPES = ["Deluxe Room", "Family Room", "Suite Room"] as const;

export const cancellationPolicies: CancellationPolicy[] = [
  {
    id: "cp-001",
    name: "Flexible Cancellation",
    status: "Active",
    sources: ["Website", "Phone"],
    roomTypes: ["Deluxe Room", "Family Room"],
    stayStart: "2026-09-29",
    stayEnd: "2026-10-31",
    applyToAllDates: false,
    rules: [
      { id: "r-001-1", timing: "More than", days: 3, chargeType: "Percentage", chargeValue: 0 },
      { id: "r-001-2", timing: "Within",    days: 3, chargeType: "Percentage", chargeValue: 50 },
    ],
    noShowChargeType: "Percentage",
    noShowChargeValue: 100,
  },
  {
    id: "cp-002",
    name: "High Season Policy",
    status: "Active",
    sources: ["Website"],
    roomTypes: [], // all room types
    stayStart: "2026-11-01",
    stayEnd: "2026-12-31",
    applyToAllDates: false,
    rules: [
      { id: "r-002-1", timing: "Within", days: 7, chargeType: "Percentage", chargeValue: 50 },
    ],
    noShowChargeType: "Percentage",
    noShowChargeValue: 100,
  },
  {
    id: "cp-003",
    name: "Non Refundable",
    status: "Inactive",
    sources: ["Phone"],
    roomTypes: ["Suite Room"],
    stayStart: null,
    stayEnd: null,
    applyToAllDates: true,
    rules: [
      { id: "r-003-1", timing: "Within", days: 999, chargeType: "Percentage", chargeValue: 100 },
    ],
    noShowChargeType: "Full Stay Amount",
    noShowChargeValue: 100,
  },
  {
    id: "cp-004",
    name: "Early Bird Special Policy",
    status: "Active",
    sources: ["Website", "Phone"],
    roomTypes: ["Deluxe Room", "Suite Room"],
    stayStart: "2027-01-05",
    stayEnd: "2027-04-30",
    applyToAllDates: false,
    rules: [
      { id: "r-004-1", timing: "More than", days: 14, chargeType: "Percentage",   chargeValue: 0 },
      { id: "r-004-2", timing: "Within",    days: 7,  chargeType: "Nights Count", chargeValue: 1 },
    ],
    noShowChargeType: "First Night Charge",
    noShowChargeValue: 1,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatStayPeriod(policy: CancellationPolicy): string {
  if (policy.applyToAllDates || (!policy.stayStart && !policy.stayEnd)) {
    return "All Dates";
  }
  return `${policy.stayStart ? formatStayDate(policy.stayStart) : "Any date"} — ${policy.stayEnd ? formatStayDate(policy.stayEnd) : "Any date"}`;
}

export function formatRoomTypes(policy: CancellationPolicy): string {
  if (policy.roomTypes.length === 0) return "All Room Types";
  return policy.roomTypes.join(", ");
}

export function getPolicySummary(policy: CancellationPolicy): { main: string; sub: string } {
  const firstFreeRule = policy.rules.find(
    (r) => r.chargeValue === 0 && r.timing === "More than",
  );
  const chargeRule = policy.rules.find((r) => r.chargeValue > 0);

  if (policy.name === "Non Refundable" || (chargeRule?.chargeValue === 100 && policy.rules.length === 1)) {
    return {
      main: "100% cancellation charge",
      sub: "Instant lock • Non-refundable",
    };
  }

  const mainText = firstFreeRule
    ? `Free until ${firstFreeRule.days} days before check-in`
    : chargeRule
      ? `${chargeRule.chargeType === "Percentage" ? `${chargeRule.chargeValue}%` : chargeRule.chargeType === "Nights Count" ? `${chargeRule.chargeValue} night(s)` : `Rp${new Intl.NumberFormat("id-ID").format(chargeRule.chargeValue)}`} charge ${chargeRule.timing.toLowerCase()} ${chargeRule.days} days`
      : "See policy details";

  const ruleCount = policy.rules.length;
  const noShowText = policy.noShowChargeType === "Percentage"
    ? `No-show: ${policy.noShowChargeValue}%`
    : policy.noShowChargeType === "None"
      ? "No-show: no charge"
      : `No-show: ${policy.noShowChargeType}`;
  const sub = firstFreeRule && chargeRule
    ? `${ruleCount} rules • ${noShowText}`
    : noShowText;

  return { main: mainText, sub };
}

export function getPolicyById(id: string): CancellationPolicy | undefined {
  return cancellationPolicies.find((p) => p.id === id);
}
