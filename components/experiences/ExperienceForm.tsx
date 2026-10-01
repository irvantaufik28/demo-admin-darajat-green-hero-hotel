"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminShell } from "../layout/AdminShell";
import { Icon } from "../ui/Icon";
import {
  ALL_DAYS,
  ALL_ROOM_TYPES_EXP,
  type Experience,
  type ExperienceType,
  type LeadTime,
  type PricingType,
} from "../../lib/experiences-data";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  mode: "add" | "edit";
  initialData?: Experience;
};

// ─── Default state ────────────────────────────────────────────────────────────

function buildDefault(data?: Experience): Experience {
  if (data) return { ...data };
  return {
    id: "",
    name: "",
    description: "",
    type: "Dining",
    price: 0,
    pricingType: "Per Package",
    leadTime: "H-1",
    minQty: 1,
    maxQty: null,
    availableDays: [...ALL_DAYS],
    roomTypes: [],
    status: "Active",
    internalNote: "",
    iconKey: "grill",
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
    <div className={last ? "expf-section expf-section--last" : "expf-section"}>
      <h3 className="expf-section__title">{title}</h3>
      {children}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ExperienceForm({ mode, initialData }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<Experience>(() => buildDefault(initialData));

  function set<K extends keyof Experience>(key: K, value: Experience[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleDay(day: string) {
    set(
      "availableDays",
      form.availableDays.includes(day)
        ? form.availableDays.filter((d) => d !== day)
        : [...form.availableDays, day],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push("/experiences");
  }

  const isEdit = mode === "edit";

  return (
    <AdminShell title="Experiences" context={isEdit ? "Edit Experience" : "Add Experience"}>
      <div className="expf-page">
        {/* Page heading */}
        <div className="expf-heading">
          <h1>{isEdit ? "Edit Experience" : "Add Experience"}</h1>
          <p>
            {isEdit
              ? "Perbarui detail add-on untuk reservasi tamu"
              : "Tambah add-on baru yang tersedia untuk reservasi tamu"}
          </p>
        </div>

        <form className="expf-form" onSubmit={handleSubmit} noValidate>
          <div className="expf-card">

            {/* ── 1. Basic Information ──────────────────────────────── */}
            <Section title="Basic Information">
              <div className="expf-2col">
                {/* Name */}
                <div className="expf-field expf-field--span2">
                  <label className="expf-label" htmlFor="expf-name">
                    Experience Name <span className="expf-required">*</span>
                  </label>
                  <input
                    id="expf-name"
                    type="text"
                    className="expf-input"
                    placeholder="e.g. BBQ & Grill Package"
                    required
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                  />
                </div>

                {/* Type */}
                <div className="expf-field expf-field--span2">
                  <span className="expf-label">
                    Type Category <span className="expf-required">*</span>
                  </span>
                  <div className="expf-type-grid">
                    <label className={form.type === "Dining" ? "expf-type-card expf-type-card--active" : "expf-type-card"}>
                      <input
                        type="radio"
                        className="expf-radio"
                        name="expf-type"
                        value="Dining"
                        checked={form.type === "Dining"}
                        onChange={() => set("type", "Dining" as ExperienceType)}
                      />
                      <div>
                        <div className="expf-type-card__title">Dining</div>
                        <div className="expf-type-card__sub">Food, beverages, and culinary packages</div>
                      </div>
                    </label>
                    <label className={form.type === "Celebrate" ? "expf-type-card expf-type-card--active expf-type-card--celebrate" : "expf-type-card"}>
                      <input
                        type="radio"
                        className="expf-radio"
                        name="expf-type"
                        value="Celebrate"
                        checked={form.type === "Celebrate"}
                        onChange={() => set("type", "Celebrate" as ExperienceType)}
                      />
                      <div>
                        <div className="expf-type-card__title">Celebrate</div>
                        <div className="expf-type-card__sub">Decorations, birthday setups & flowers</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Description */}
                <div className="expf-field expf-field--span2">
                  <label className="expf-label" htmlFor="expf-desc">
                    Short Description{" "}
                    <span className="expf-label--hint">(Display in front-office & booking engine)</span>
                  </label>
                  <textarea
                    id="expf-desc"
                    className="expf-textarea"
                    rows={2}
                    placeholder="Ringkasan paket layanan..."
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                  />
                </div>
              </div>
            </Section>

            {/* ── 2. Pricing ────────────────────────────────────────── */}
            <Section title="Pricing">
              <div className="expf-3col">
                {/* Price */}
                <div className="expf-field">
                  <label className="expf-label" htmlFor="expf-price">
                    Price (IDR) <span className="expf-required">*</span>
                  </label>
                  <div className="expf-price-wrap">
                    <span className="expf-price-prefix">Rp</span>
                    <input
                      id="expf-price"
                      type="number"
                      className="expf-input expf-input--price"
                      min={0}
                      value={form.price || ""}
                      onChange={(e) => set("price", Math.max(0, Number(e.target.value)))}
                    />
                  </div>
                </div>

                {/* Pricing Type */}
                <div className="expf-field">
                  <label className="expf-label" htmlFor="expf-pricing-type">
                    Pricing Type <span className="expf-required">*</span>
                  </label>
                  <div className="expf-select-wrap">
                    <select
                      id="expf-pricing-type"
                      className="expf-select"
                      value={form.pricingType}
                      onChange={(e) => set("pricingType", e.target.value as PricingType)}
                    >
                      <option>Per Package</option>
                      <option>Per Person</option>
                      <option>Per Item</option>
                    </select>
                    <Icon name="chevron" className="expf-select-chevron" width={14} height={14} />
                  </div>
                </div>

                {/* Status */}
                <div className="expf-field">
                  <span className="expf-label">Status</span>
                  <div className="cf-status-toggle">
                    <button
                      type="button"
                      className={form.status === "Active" ? "cf-status-btn cf-status-btn--active" : "cf-status-btn"}
                      onClick={() => set("status", "Active")}
                    >
                      <i />
                      Active
                    </button>
                    <button
                      type="button"
                      className={form.status === "Inactive" ? "cf-status-btn cf-status-btn--selected" : "cf-status-btn"}
                      onClick={() => set("status", "Inactive")}
                    >
                      Inactive
                    </button>
                  </div>
                </div>
              </div>
            </Section>

            {/* ── 3. Availability ──────────────────────────────────── */}
            <Section title="Availability">
              <div className="expf-3col">
                {/* Min Qty */}
                <div className="expf-field">
                  <label className="expf-label" htmlFor="expf-min-qty">Min Qty</label>
                  <input
                    id="expf-min-qty"
                    type="number"
                    className="expf-input"
                    min={1}
                    value={form.minQty}
                    onChange={(e) => set("minQty", Math.max(1, Number(e.target.value)))}
                  />
                </div>

                {/* Max Qty */}
                <div className="expf-field">
                  <label className="expf-label" htmlFor="expf-max-qty">Max Qty</label>
                  <input
                    id="expf-max-qty"
                    type="number"
                    className="expf-input"
                    min={1}
                    placeholder="No limit"
                    value={form.maxQty ?? ""}
                    onChange={(e) =>
                      set("maxQty", e.target.value === "" ? null : Math.max(1, Number(e.target.value)))
                    }
                  />
                </div>

                {/* Lead Time */}
                <div className="expf-field">
                  <label className="expf-label" htmlFor="expf-lead">Lead Time</label>
                  <div className="expf-select-wrap">
                    <select
                      id="expf-lead"
                      className="expf-select"
                      value={form.leadTime}
                      onChange={(e) => set("leadTime", e.target.value as LeadTime)}
                    >
                      <option value="Same Day">Same Day</option>
                      <option value="H-1">H-1 (24 Hours)</option>
                      <option value="H-2">H-2 (48 Hours)</option>
                      <option value="H-3">H-3 (72 Hours)</option>
                    </select>
                    <Icon name="chevron" className="expf-select-chevron" width={14} height={14} />
                  </div>
                </div>
              </div>

              {/* Available Days */}
              <div className="expf-field" style={{ marginTop: 14 }}>
                <span className="expf-label">Available Days</span>
                <div className="expf-days-row">
                  {ALL_DAYS.map((day) => (
                    <label
                      key={day}
                      className={form.availableDays.includes(day) ? "expf-day-chip expf-day-chip--on" : "expf-day-chip"}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={form.availableDays.includes(day)}
                        onChange={() => toggleDay(day)}
                      />
                      {day}
                    </label>
                  ))}
                </div>
              </div>

              {/* Room Types */}
              <div className="expf-field" style={{ marginTop: 14 }}>
                <span className="expf-label">Applicable Room Types</span>
                <div className="expf-room-row">
                  <label className="exp-checkbox-label">
                    <input
                      type="checkbox"
                      className="exp-checkbox"
                      checked={form.roomTypes.length === 0}
                      onChange={() => set("roomTypes", [])}
                    />
                    <span>All Room Types</span>
                  </label>
                  {ALL_ROOM_TYPES_EXP.map((rt) => (
                    <label key={rt} className="exp-checkbox-label exp-checkbox-label--secondary">
                      <input
                        type="checkbox"
                        className="exp-checkbox"
                        checked={form.roomTypes.includes(rt)}
                        onChange={() =>
                          set(
                            "roomTypes",
                            form.roomTypes.includes(rt)
                              ? form.roomTypes.filter((r) => r !== rt)
                              : [...form.roomTypes, rt],
                          )
                        }
                      />
                      <span>{rt}</span>
                    </label>
                  ))}
                </div>
              </div>
            </Section>

            {/* ── 4. Internal Note ─────────────────────────────────── */}
            <Section title="Internal Note" last>
              <div className="expf-field">
                <label className="expf-label" htmlFor="expf-note">
                  Staff Note{" "}
                  <span className="expf-label--hint">(Kitchen coordination — not visible to guests)</span>
                </label>
                <textarea
                  id="expf-note"
                  className="expf-textarea"
                  rows={3}
                  placeholder="Catatan khusus operasional dapur atau housekeeping..."
                  value={form.internalNote}
                  onChange={(e) => set("internalNote", e.target.value)}
                />
              </div>
            </Section>
          </div>

          {/* Actions */}
          <div className="expf-actions">
            <button
              type="button"
              className="expf-btn-cancel"
              onClick={() => router.push("/experiences")}
            >
              Cancel
            </button>
            <button type="submit" className="expf-btn-save">
              {isEdit ? "Save Changes" : "Save Experience"}
            </button>
          </div>
        </form>
      </div>
    </AdminShell>
  );
}
