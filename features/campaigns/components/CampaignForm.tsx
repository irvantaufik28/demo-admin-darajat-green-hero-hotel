"use client";

import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminShell } from "../../../components/layout/AdminShell";
import { Icon } from "../../../components/ui/Icon";
import { DateRangePicker } from "./DateRangePicker";
import { restoreSession } from "../../../lib/auth";
import {
  ALL_DAYS,
  type BlackoutDate,
  type DiscountType,
} from "../constants/campaigns-data";
import {
  createCampaign,
  getCampaign,
  listCampaignRoomTypes,
  listCancellationPolicyOptions,
  updateCampaign,
  type CampaignChannel,
  type CampaignDetail,
  type CampaignInput,
  type CampaignRoomTypeOption,
  type CancellationPolicyOption,
} from "../services/campaigns";

// ─── Types ────────────────────────────────────────────────────────────────────

type FormState = {
  name: string;
  status: "Active" | "Inactive";
  priority: number;
  channel: CampaignChannel;
  roomTypes: string[];
  bookingStart: string;
  bookingEnd: string;
  stayStart: string;
  stayEnd: string;
  applicableDays: string[];
  minNights: number;
  minRooms: number;
  discountType: DiscountType;
  discountValue: number;
  cancellationPolicy: string;
  requirePromoCode: boolean;
  promoCode: string;
  useBlackoutDates: boolean;
  blackoutDates: BlackoutDate[];
};

type Props = {
  mode: "add" | "edit";
  campaignId?: string;
};

// ─── Default state ────────────────────────────────────────────────────────────

function buildDefault(data?: CampaignDetail): FormState {
  if (data) {
    return {
      name: data.name,
      status: data.isActive ? "Active" : "Inactive",
      priority: data.priority,
      channel: data.channel,
      roomTypes: data.roomTypes.map((room) => room.id),
      bookingStart: data.bookingStart ?? "",
      bookingEnd: data.bookingEnd ?? "",
      stayStart: data.stayStart ?? "",
      stayEnd: data.stayEnd ?? "",
      applicableDays: data.weekdays.map((weekday) => ALL_DAYS[weekday - 1]),
      minNights: data.minNights,
      minRooms: data.minRooms,
      discountType: data.discountType,
      discountValue: data.discountValue,
      cancellationPolicy: data.cancellationPolicyId ?? "",
      requirePromoCode: data.requiresCode,
      promoCode: data.promoCode ?? "",
      useBlackoutDates: data.blackoutDates.length > 0,
      blackoutDates:
        data.blackoutDates.length > 0
          ? data.blackoutDates.map((item) => ({
              id: item.id,
              from: item.dateFrom,
              to: item.dateTo,
              label: item.label ?? "",
            }))
          : [{ id: "empty", from: "", to: "", label: "" }],
    };
  }

  return {
    name: "",
    status: "Active",
    priority: 1,
    channel: "website",
    roomTypes: [],
    bookingStart: "",
    bookingEnd: "",
    stayStart: "",
    stayEnd: "",
    applicableDays: [...ALL_DAYS],
    minNights: 1,
    minRooms: 1,
    discountType: "percent",
    discountValue: 10,
    cancellationPolicy: "",
    requirePromoCode: false,
    promoCode: "",
    useBlackoutDates: false,
    blackoutDates: [{ id: "empty", from: "", to: "", label: "" }],
  };
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  children,
  last,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={last ? "cf-section cf-section--last" : "cf-section"}>
      <h3 className="cf-section__title">{title}</h3>
      {children}
    </div>
  );
}

// ─── Checkbox group helper ────────────────────────────────────────────────────

function CheckboxGroup({
  options,
  selected,
  onChange,
}: {
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(value: string) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  }
  return (
    <div className="cf-checkbox-row">
      {options.map((opt) => (
        <label key={opt} className="cf-checkbox-label">
          <input
            type="checkbox"
            className="cf-checkbox"
            checked={selected.includes(opt)}
            onChange={() => toggle(opt)}
          />
          <span>{opt}</span>
        </label>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CampaignForm({ mode, campaignId }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => buildDefault());
  const [roomOptions, setRoomOptions] = useState<CampaignRoomTypeOption[]>([]);
  const [policyOptions, setPolicyOptions] = useState<CancellationPolicyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedCampaign, setHasLoadedCampaign] = useState(mode === "add");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        if (!(await restoreSession())) return;
        const [rooms, policies, detail] = await Promise.all([
          listCampaignRoomTypes(controller.signal),
          listCancellationPolicyOptions(controller.signal),
          mode === "edit" && campaignId
            ? getCampaign(campaignId, controller.signal)
            : Promise.resolve(null),
        ]);
        if (controller.signal.aborted) return;
        setRoomOptions(rooms);
        setPolicyOptions(policies);
        if (detail) {
          setForm(buildDefault(detail.campaign));
          setHasLoadedCampaign(true);
        }
        if (mode === "edit" && !detail) setError("Campaign tidak ditemukan.");
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Campaign gagal dimuat.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [mode, campaignId]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ── Room types helpers ──
  const allRoomsChecked = form.roomTypes.length === 0;

  function toggleRoomType(rt: string) {
    set(
      "roomTypes",
      form.roomTypes.includes(rt)
        ? form.roomTypes.filter((r) => r !== rt)
        : [...form.roomTypes, rt],
    );
  }

  function toggleSelectAll() {
    set("roomTypes", []);
  }

  // ── Blackout dates helpers ──
  function addBlackout() {
    set("blackoutDates", [
      ...form.blackoutDates,
      { id: crypto.randomUUID(), from: "", to: "", label: "" },
    ]);
  }

  function updateBlackoutRange(id: string, from: string, to: string) {
    set(
      "blackoutDates",
      form.blackoutDates.map((bd) =>
        bd.id === id ? { ...bd, from, to } : bd,
      ),
    );
  }

  function removeBlackout(id: string) {
    set(
      "blackoutDates",
      form.blackoutDates.filter((bd) => bd.id !== id),
    );
  }

  // ── Submit ──
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || loading) return;
    setError("");
    if (!form.name.trim() || form.applicableDays.length === 0) {
      setError("Isi nama campaign dan pilih minimal satu Applicable Day.");
      return;
    }
    if (form.requirePromoCode && !form.promoCode.trim()) {
      setError("Isi promo code ketika Require Promo Code aktif.");
      return;
    }
    if (form.useBlackoutDates && form.blackoutDates.some((item) => !item.from || !item.to)) {
      setError("Lengkapi tanggal From dan To pada setiap Blackout Date.");
      return;
    }
    const input: CampaignInput = {
      name: form.name.trim(),
      promoCode: form.requirePromoCode ? form.promoCode.trim().toUpperCase() : null,
      requiresCode: form.requirePromoCode,
      bookingStart: form.bookingStart || null,
      bookingEnd: form.bookingEnd || null,
      stayStart: form.stayStart || null,
      stayEnd: form.stayEnd || null,
      discountType: form.discountType,
      discountValue: form.discountValue,
      minNights: form.minNights,
      minRooms: form.minRooms,
      priority: form.priority,
      cancellationPolicyId: form.cancellationPolicy || null,
      isActive: form.status === "Active",
      channel: form.channel,
      roomTypeIds: form.roomTypes,
      weekdays: form.applicableDays.map((day) => ALL_DAYS.indexOf(day as typeof ALL_DAYS[number]) + 1),
      blackoutDates: form.useBlackoutDates
        ? form.blackoutDates.map((item) => ({
            dateFrom: item.from,
            dateTo: item.to,
            label: item.label?.trim() || null,
          }))
        : [],
    };
    setSaving(true);
    try {
      if (mode === "edit" && campaignId) {
        await updateCampaign(campaignId, input);
      } else {
        await createCampaign(input);
      }
      router.push("/campaigns");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Campaign gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  const isEdit = mode === "edit";
  const availablePolicies = policyOptions.filter((policy) =>
    policy.id === form.cancellationPolicy ||
    (policy.isActive && (form.channel === "website" ? policy.appliesWebsite : policy.appliesPhone)),
  );

  return (
    <AdminShell
      title="Campaigns & Promotions"
      context={isEdit ? "Edit Campaign" : "Add Campaign"}
    >
      <div className="cf-page">
        {/* Page header */}
        <div className="cf-heading">
          <h1>{isEdit ? "Edit Campaign" : "Add Campaign"}</h1>
          <p>
            {isEdit
              ? "Perbarui pengaturan promo yang sudah ada"
              : "Buat promo berdasarkan periode, tipe kamar, dan aturan booking"}
          </p>
        </div>

        {error && <div className="campaigns-api-message" role="alert">{error}</div>}
        {loading ? (
          <LoadingSkeleton variant="form" rows={8} />
        ) : hasLoadedCampaign ? (
        <form className="cf-form" onSubmit={handleSubmit} noValidate>
          <div className="cf-card">

            {/* ── 1. Campaign Information ─────────────────────────────── */}
            <Section title="Campaign Information">
              <div className="cf-info-grid">
                {/* Name */}
                <div className="cf-field cf-field--name">
                  <label className="cf-label" htmlFor="cf-name">
                    Campaign Name <span className="cf-required">*</span>
                  </label>
                  <input
                    id="cf-name"
                    type="text"
                    className="cf-input"
                    placeholder="Enter campaign name"
                    required
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                  />
                </div>

                {/* Status toggle */}
                <div className="cf-field cf-field--status">
                  <span className="cf-label">Status</span>
                  <div className="cf-status-toggle">
                    <button
                      type="button"
                      className={
                        form.status === "Active"
                          ? "cf-status-btn cf-status-btn--active"
                          : "cf-status-btn"
                      }
                      onClick={() => set("status", "Active")}
                    >
                      <i />
                      Active
                    </button>
                    <button
                      type="button"
                      className={
                        form.status === "Inactive"
                          ? "cf-status-btn cf-status-btn--selected"
                          : "cf-status-btn"
                      }
                      onClick={() => set("status", "Inactive")}
                    >
                      Inactive
                    </button>
                  </div>
                </div>

                {/* Priority */}
                <div className="cf-field cf-field--priority">
                  <label className="cf-label" htmlFor="cf-priority">
                    Priority <span className="cf-required">*</span>
                  </label>
                  <input
                    id="cf-priority"
                    type="number"
                    className="cf-input cf-input--narrow"
                    min={1}
                    max={99}
                    required
                    value={form.priority}
                    onChange={(e) =>
                      set("priority", Math.max(1, Number(e.target.value)))
                    }
                  />
                  <p className="cf-hint">Lower number = higher priority</p>
                </div>
              </div>
            </Section>

            {/* ── 2. Applicable Source ────────────────────────────────── */}
            <Section title="Applicable Source">
              <div className="cf-checkbox-row">
                {([
                  ["website", "Website"],
                  ["front_desk", "Front Desk (Walk-in & Phone)"],
                ] as const).map(([channel, label]) => (
                  <label key={channel} className="cf-checkbox-label">
                    <input
                      type="radio"
                      name="campaign-channel"
                      className="cf-checkbox"
                      checked={form.channel === channel}
                      onChange={() => {
                        set("channel", channel);
                        set("cancellationPolicy", "");
                      }}
                    />
                    <span>{label}</span>
                  </label>
                ))}
                <span className="cf-hint-inline">
                  (Satu channel per campaign)
                </span>
              </div>
            </Section>

            {/* ── 3. Applicable Room Types ────────────────────────────── */}
            <Section title="Applicable Room Types">
              <div className="cf-checkbox-row">
                {roomOptions.map((room) => (
                  <label key={room.id} className="cf-checkbox-label">
                    <input
                      type="checkbox"
                      className="cf-checkbox"
                      checked={form.roomTypes.includes(room.id)}
                      onChange={() => toggleRoomType(room.id)}
                    />
                    <span>{room.name}{!room.isActive ? " (Inactive)" : ""}</span>
                  </label>
                ))}
                <label className="cf-checkbox-label cf-checkbox-label--secondary">
                  <input
                    type="checkbox"
                    className="cf-checkbox"
                    checked={allRoomsChecked}
                    onChange={toggleSelectAll}
                  />
                  <span>All Room Types</span>
                </label>
              </div>
            </Section>

            {/* ── 4. Period ───────────────────────────────────────────── */}
            <Section title="Period">
              <div className="cf-period-grid">
                {/* Booking Period */}
                <div className="cf-period-row">
                  <span className="cf-period-label">Booking Period</span>
                  <DateRangePicker
                    label="Booking Period"
                    start={form.bookingStart}
                    end={form.bookingEnd}
                    onChange={(bookingStart, bookingEnd) => setForm((current) => ({ ...current, bookingStart, bookingEnd }))}
                  />
                  <span className="cf-period-note">Periode pemesanan dibuat</span>
                </div>
                {/* Stay Period */}
                <div className="cf-period-row">
                  <span className="cf-period-label">Stay Period</span>
                  <DateRangePicker
                    label="Stay Period"
                    start={form.stayStart}
                    end={form.stayEnd}
                    onChange={(stayStart, stayEnd) => setForm((current) => ({ ...current, stayStart, stayEnd }))}
                  />
                  <span className="cf-period-note">Periode tamu menginap</span>
                </div>
              </div>
            </Section>

            {/* ── 5. Applicable Days ──────────────────────────────────── */}
            <Section title="Applicable Days">
              <CheckboxGroup
                options={ALL_DAYS}
                selected={form.applicableDays}
                onChange={(next) => set("applicableDays", next)}
              />
            </Section>

            {/* ── 6. Booking Requirement ──────────────────────────────── */}
            <Section title="Booking Requirement">
              <div className="cf-inline-fields">
                <div className="cf-inline-field">
                  <label className="cf-label-inline" htmlFor="cf-min-nights">
                    Minimum Stay:
                  </label>
                  <input
                    id="cf-min-nights"
                    type="number"
                    className="cf-input cf-input--small"
                    min={1}
                    value={form.minNights}
                    onChange={(e) =>
                      set("minNights", Math.max(1, Number(e.target.value)))
                    }
                  />
                  <span className="cf-unit">Nights</span>
                </div>
                <div className="cf-inline-field">
                  <label className="cf-label-inline" htmlFor="cf-min-rooms">
                    Minimum Rooms (Optional):
                  </label>
                  <input
                    id="cf-min-rooms"
                    type="number"
                    className="cf-input cf-input--small"
                    min={1}
                    value={form.minRooms}
                    onChange={(e) =>
                      set("minRooms", Math.max(1, Number(e.target.value)))
                    }
                  />
                  <span className="cf-unit">Rooms</span>
                </div>
              </div>
            </Section>

            {/* ── 7. Discount ─────────────────────────────────────────── */}
            <Section title="Discount">
              <div className="cf-inline-fields">
                <div className="cf-radio-group">
                  <label className="cf-radio-label">
                    <input
                      type="radio"
                      className="cf-radio"
                      name="discount_type"
                      checked={form.discountType === "percent"}
                      onChange={() => set("discountType", "percent")}
                    />
                    <span>Percentage</span>
                  </label>
                  <label className="cf-radio-label">
                    <input
                      type="radio"
                      className="cf-radio"
                      name="discount_type"
                      checked={form.discountType === "fixed"}
                      onChange={() => set("discountType", "fixed")}
                    />
                    <span>Fixed Amount</span>
                  </label>
                </div>
                <div className="cf-inline-field">
                  <span className="cf-label-inline">Value:</span>
                  <div className="cf-discount-input-wrap">
                    <input
                      type="number"
                      className="cf-input cf-input--discount"
                      min={1}
                      max={form.discountType === "percent" ? 100 : undefined}
                      value={form.discountValue}
                      onChange={(e) =>
                        set("discountValue", Math.max(1, Number(e.target.value)))
                      }
                    />
                    <span className="cf-discount-unit">
                      {form.discountType === "percent" ? "%" : "Rp"}
                    </span>
                  </div>
                </div>
              </div>
            </Section>

            {/* ── 8. Cancellation Policy ──────────────────────────────── */}
            <Section title="Cancellation Policy">
              <div className="cf-select-wrap">
                <select
                  className="cf-select"
                  value={form.cancellationPolicy}
                  onChange={(e) => set("cancellationPolicy", e.target.value)}
                >
                  <option value="">Default cancellation policy</option>
                  {availablePolicies.map((policy) => (
                    <option key={policy.id} value={policy.id}>
                      {policy.name}{!policy.isActive ? " (Inactive)" : ""}
                    </option>
                  ))}
                </select>
                <Icon
                  name="chevron"
                  className="cf-select-chevron"
                  width={16}
                  height={16}
                />
              </div>
            </Section>

            {/* ── 9. Promo Code ───────────────────────────────────────── */}
            <Section title="Promo Code">
              <label className="cf-checkbox-label" style={{ marginBottom: 10 }}>
                <input
                  type="checkbox"
                  className="cf-checkbox"
                  checked={form.requirePromoCode}
                  onChange={(e) => set("requirePromoCode", e.target.checked)}
                />
                <span>Require Promo Code</span>
              </label>
                <div className="cf-promo-code-row">
                  <span className="cf-label-inline">Code:</span>
                  <input
                    type="text"
                    id="cf-promo-code"
                    className="cf-input cf-input--code"
                    placeholder="e.g. PROMO2026"
                    value={form.promoCode}
                    disabled={!form.requirePromoCode}
                    onChange={(e) =>
                      set("promoCode", e.target.value.toUpperCase())
                    }
                  />
                </div>
            </Section>

            {/* ── 10. Blackout Dates ──────────────────────────────────── */}
            <Section title="Blackout Dates" last>
              <label className="cf-checkbox-label" style={{ marginBottom: 10 }}>
                <input
                  type="checkbox"
                  className="cf-checkbox"
                  checked={form.useBlackoutDates}
                  onChange={(e) => set("useBlackoutDates", e.target.checked)}
                />
                <span>Use Blackout Dates</span>
              </label>

                <>
                  <div className="cf-blackout-list">
                    {form.blackoutDates.map((bd) => (
                      <div key={bd.id} className="cf-blackout-row">
                        <DateRangePicker
                          label="Blackout Date"
                          start={bd.from}
                          end={bd.to}
                          disabled={!form.useBlackoutDates}
                          onChange={(from, to) => updateBlackoutRange(bd.id, from, to)}
                        />
                        {bd.label && (
                          <span className="cf-blackout-label">
                            ({bd.label})
                          </span>
                        )}
                        <button
                          type="button"
                          className="cf-blackout-delete"
                          aria-label="Hapus blackout date"
                          disabled={!form.useBlackoutDates}
                          onClick={() => removeBlackout(bd.id)}
                        >
                          <Icon name="trash" width={15} height={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="cf-add-blackout"
                    disabled={!form.useBlackoutDates}
                    onClick={addBlackout}
                  >
                    <Icon name="plus" width={14} height={14} />
                    <span>Add Blackout Date</span>
                  </button>
                </>

            </Section>
          </div>

          {/* Bottom actions */}
          <div className="cf-actions">
            <button
              type="button"
              className="cf-btn-cancel"
              onClick={() => router.push("/campaigns")}
            >
              Cancel
            </button>
            <button type="submit" className="cf-btn-save" disabled={saving}>
              {saving ? "Saving..." : isEdit ? "Save Changes" : "Save Campaign"}
            </button>
          </div>
        </form>
        ) : null}
      </div>
    </AdminShell>
  );
}
