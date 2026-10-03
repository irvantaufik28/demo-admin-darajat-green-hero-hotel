"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminShell } from "../../../components/layout/AdminShell";
import { Icon } from "../../../components/ui/Icon";
import {
  ALL_DAYS,
  ALL_ROOM_TYPE_OPTIONS,
  ALL_SOURCES,
  CANCELLATION_POLICIES,
  type BlackoutDate,
  type Campaign,
  type DiscountType,
} from "../constants/campaigns-data";

// ─── Types ────────────────────────────────────────────────────────────────────

type FormState = {
  name: string;
  status: "Active" | "Inactive";
  priority: number;
  sources: string[];
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
  initialData?: Campaign;
};

// ─── Default state ────────────────────────────────────────────────────────────

function buildDefault(data?: Campaign): FormState {
  if (data) {
    return {
      name: data.name,
      status: data.status,
      priority: data.priority,
      sources: data.sources,
      roomTypes: data.roomTypes,
      bookingStart: data.bookingStart,
      bookingEnd: data.bookingEnd,
      stayStart: data.stayStart,
      stayEnd: data.stayEnd,
      applicableDays: data.applicableDays,
      minNights: data.minNights,
      minRooms: data.minRooms,
      discountType: data.discountType,
      discountValue: data.discountValue,
      cancellationPolicy: data.cancellationPolicy,
      requirePromoCode: data.requirePromoCode,
      promoCode: data.promoCode ?? "",
      useBlackoutDates: data.blackoutDates.length > 0,
      blackoutDates:
        data.blackoutDates.length > 0
          ? data.blackoutDates
          : [{ id: crypto.randomUUID(), from: "", to: "", label: "" }],
    };
  }

  return {
    name: "",
    status: "Active",
    priority: 1,
    sources: ["Website", "Walk-in"],
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
    cancellationPolicy: CANCELLATION_POLICIES[0],
    requirePromoCode: false,
    promoCode: "",
    useBlackoutDates: false,
    blackoutDates: [{ id: crypto.randomUUID(), from: "", to: "", label: "" }],
  };
}

// ─── Overlap check (simple static check against existing campaigns) ──────────

function hasOverlap(form: FormState, currentId?: string): boolean {
  // Stub: in a real system this would query the server.
  // For demo: just return true to show the warning banner when all key fields filled.
  if (!form.bookingStart || !form.stayStart || form.name.length < 2) return false;
  return false; // disable by default; set true to demo the warning
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

export function CampaignForm({ mode, initialData }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => buildDefault(initialData));

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ── Room types helpers ──
  const allRoomsChecked =
    ALL_ROOM_TYPE_OPTIONS.every((r) => form.roomTypes.includes(r));

  function toggleRoomType(rt: string) {
    set(
      "roomTypes",
      form.roomTypes.includes(rt)
        ? form.roomTypes.filter((r) => r !== rt)
        : [...form.roomTypes, rt],
    );
  }

  function toggleSelectAll() {
    set(
      "roomTypes",
      allRoomsChecked ? [] : [...ALL_ROOM_TYPE_OPTIONS],
    );
  }

  // ── Blackout dates helpers ──
  function addBlackout() {
    set("blackoutDates", [
      ...form.blackoutDates,
      { id: crypto.randomUUID(), from: "", to: "", label: "" },
    ]);
  }

  function updateBlackout(id: string, field: keyof BlackoutDate, value: string) {
    set(
      "blackoutDates",
      form.blackoutDates.map((bd) =>
        bd.id === id ? { ...bd, [field]: value } : bd,
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
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // In a real app: call API / dispatch action
    router.push("/campaigns");
  }

  const isEdit = mode === "edit";
  const overlap = hasOverlap(form, initialData?.id);

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
                {ALL_SOURCES.map((src) => (
                  <label key={src} className="cf-checkbox-label">
                    <input
                      type="checkbox"
                      className="cf-checkbox"
                      checked={form.sources.includes(src)}
                      onChange={() =>
                        set(
                          "sources",
                          form.sources.includes(src)
                            ? form.sources.filter((s) => s !== src)
                            : [...form.sources, src],
                        )
                      }
                    />
                    <span>{src}</span>
                  </label>
                ))}
                <span className="cf-hint-inline">
                  (Pilih minimal satu saluran pemesanan)
                </span>
              </div>
            </Section>

            {/* ── 3. Applicable Room Types ────────────────────────────── */}
            <Section title="Applicable Room Types">
              <div className="cf-checkbox-row">
                {ALL_ROOM_TYPE_OPTIONS.map((rt) => (
                  <label key={rt} className="cf-checkbox-label">
                    <input
                      type="checkbox"
                      className="cf-checkbox"
                      checked={form.roomTypes.includes(rt)}
                      onChange={() => toggleRoomType(rt)}
                    />
                    <span>{rt}</span>
                  </label>
                ))}
                <label className="cf-checkbox-label cf-checkbox-label--secondary">
                  <input
                    type="checkbox"
                    className="cf-checkbox"
                    checked={allRoomsChecked}
                    onChange={toggleSelectAll}
                  />
                  <span>Select All</span>
                </label>
              </div>
            </Section>

            {/* ── 4. Period ───────────────────────────────────────────── */}
            <Section title="Period">
              <div className="cf-period-grid">
                {/* Booking Period */}
                <div className="cf-period-row">
                  <span className="cf-period-label">Booking Period</span>
                  <div className="cf-date-range">
                    <span className="cf-date-sep">From</span>
                    <input
                      type="date"
                      className="cf-input-date"
                      value={form.bookingStart}
                      onChange={(e) => set("bookingStart", e.target.value)}
                    />
                    <span className="cf-date-sep">To</span>
                    <input
                      type="date"
                      className="cf-input-date"
                      value={form.bookingEnd}
                      onChange={(e) => set("bookingEnd", e.target.value)}
                    />
                  </div>
                  <span className="cf-period-note">Periode pemesanan dibuat</span>
                </div>
                {/* Stay Period */}
                <div className="cf-period-row">
                  <span className="cf-period-label">Stay Period</span>
                  <div className="cf-date-range">
                    <span className="cf-date-sep">From</span>
                    <input
                      type="date"
                      className="cf-input-date"
                      value={form.stayStart}
                      onChange={(e) => set("stayStart", e.target.value)}
                    />
                    <span className="cf-date-sep">To</span>
                    <input
                      type="date"
                      className="cf-input-date"
                      value={form.stayEnd}
                      onChange={(e) => set("stayEnd", e.target.value)}
                    />
                  </div>
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
                  {CANCELLATION_POLICIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
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
              {form.requirePromoCode && (
                <div className="cf-promo-code-row">
                  <span className="cf-label-inline">Code:</span>
                  <input
                    type="text"
                    id="cf-promo-code"
                    className="cf-input cf-input--code"
                    placeholder="e.g. PROMO2026"
                    value={form.promoCode}
                    onChange={(e) =>
                      set("promoCode", e.target.value.toUpperCase())
                    }
                  />
                </div>
              )}
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

              {form.useBlackoutDates && (
                <>
                  <div className="cf-blackout-list">
                    {form.blackoutDates.map((bd) => (
                      <div key={bd.id} className="cf-blackout-row">
                        <span className="cf-date-sep">From</span>
                        <input
                          type="date"
                          className="cf-input-date cf-input-date--sm"
                          value={bd.from}
                          onChange={(e) =>
                            updateBlackout(bd.id, "from", e.target.value)
                          }
                        />
                        <span className="cf-date-sep">To</span>
                        <input
                          type="date"
                          className="cf-input-date cf-input-date--sm"
                          value={bd.to}
                          onChange={(e) =>
                            updateBlackout(bd.id, "to", e.target.value)
                          }
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
                    onClick={addBlackout}
                  >
                    <Icon name="plus" width={14} height={14} />
                    <span>Add Blackout Date</span>
                  </button>
                </>
              )}

              {/* Overlap warning */}
              {overlap && (
                <div className="cf-overlap-warning">
                  <Icon name="warning" width={16} height={16} className="cf-overlap-warning__icon" />
                  <span>
                    Another active campaign overlaps this configuration (Source,
                    Room Type, &amp; Period). Priority determines which campaign
                    is applied.
                  </span>
                </div>
              )}
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
            <button type="submit" className="cf-btn-save">
              {isEdit ? "Save Changes" : "Save Campaign"}
            </button>
          </div>
        </form>
      </div>
    </AdminShell>
  );
}
