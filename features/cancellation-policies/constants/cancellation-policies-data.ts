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
