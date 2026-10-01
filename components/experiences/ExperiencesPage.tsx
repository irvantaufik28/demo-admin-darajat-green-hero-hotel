"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AdminShell } from "../layout/AdminShell";
import { Icon } from "../ui/Icon";
import type { IconName } from "../ui/Icon";
import {
  ALL_DAYS,
  ALL_ROOM_TYPES_EXP,
  experiences as initialExperiences,
  formatPrice,
  type Experience,
  type ExperienceIcon,
  type ExperienceType,
  type LeadTime,
  type PricingType,
} from "../../lib/experiences-data";

// ─── Icon mapping ─────────────────────────────────────────────────────────────

const iconMap: Record<ExperienceIcon, IconName> = {
  grill:       "expGrill",
  restaurant:  "expRestaurant",
  dinner:      "expDinner",
  birthday:    "expBirthday",
  celebration: "expCelebration",
  florist:     "expFlorist",
};

function ExperienceIconBox({
  iconKey,
  type,
  inactive,
}: {
  iconKey: ExperienceIcon;
  type: ExperienceType;
  inactive?: boolean;
}) {
  const bg = inactive
    ? "exp-icon-box--inactive"
    : type === "Dining"
      ? "exp-icon-box--dining"
      : "exp-icon-box--celebrate";

  return (
    <span className={`exp-icon-box ${bg}`} aria-hidden="true">
      <Icon name={iconMap[iconKey]} width={15} height={15} />
    </span>
  );
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: ExperienceType }) {
  return (
    <span className={type === "Dining" ? "exp-type-badge exp-type-badge--dining" : "exp-type-badge exp-type-badge--celebrate"}>
      {type}
    </span>
  );
}

function StatusBadge({ status }: { status: "Active" | "Inactive" }) {
  return (
    <span className={status === "Active" ? "exp-status-badge exp-status-badge--active" : "exp-status-badge exp-status-badge--inactive"}>
      {status}
    </span>
  );
}

function LeadChip({ lead }: { lead: LeadTime }) {
  return <span className="exp-lead-chip">{lead}</span>;
}

// ─── Blank experience ─────────────────────────────────────────────────────────

function blankExp(): Experience {
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

// ─── Modal ────────────────────────────────────────────────────────────────────

function ExperienceModal({
  mode,
  initial,
  onClose,
  onSave,
}: {
  mode: "add" | "edit";
  initial: Experience;
  onClose: () => void;
  onSave: (exp: Experience) => void;
}) {
  const [form, setForm] = useState<Experience>(initial);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setForm(initial); }, [initial]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function set<K extends keyof Experience>(key: K, value: Experience[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleDay(day: string) {
    set("availableDays", form.availableDays.includes(day)
      ? form.availableDays.filter((d) => d !== day)
      : [...form.availableDays, day]);
  }

  const isEdit = mode === "edit";

  return (
    <div
      className="exp-modal-overlay"
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className="exp-modal">
        {/* Header */}
        <div className="exp-modal__header">
          <div className="exp-modal__header-left">
            <Icon name="experiences" width={18} height={18} className="exp-modal__header-icon" />
            <h3>{isEdit ? "Edit Experience" : "Add Experience"}</h3>
          </div>
          <button type="button" className="exp-modal__close" onClick={onClose} aria-label="Tutup">
            <Icon name="close" width={18} height={18} />
          </button>
        </div>

        {/* Body */}
        <div className="exp-modal__body">
          {/* Name */}
          <div className="exp-modal-field">
            <label className="exp-modal-label" htmlFor="exp-name">
              Experience Name <span className="exp-required">*</span>
            </label>
            <input id="exp-name" type="text" className="exp-modal-input"
              placeholder="e.g. BBQ & Grill Package" value={form.name}
              onChange={(e) => set("name", e.target.value)} />
          </div>

          {/* Type */}
          <div className="exp-modal-field">
            <span className="exp-modal-label">Type Category <span className="exp-required">*</span></span>
            <div className="exp-type-grid">
              <label className={form.type === "Dining" ? "exp-type-option exp-type-option--active" : "exp-type-option"}>
                <input type="radio" className="exp-radio" name="exp-type" value="Dining"
                  checked={form.type === "Dining"} onChange={() => set("type", "Dining" as ExperienceType)} />
                <div>
                  <div className="exp-type-option__title">Dining</div>
                  <div className="exp-type-option__sub">Food, beverages, and culinary packages</div>
                </div>
              </label>
              <label className={form.type === "Celebrate" ? "exp-type-option exp-type-option--active exp-type-option--celebrate" : "exp-type-option"}>
                <input type="radio" className="exp-radio" name="exp-type" value="Celebrate"
                  checked={form.type === "Celebrate"} onChange={() => set("type", "Celebrate" as ExperienceType)} />
                <div>
                  <div className="exp-type-option__title">Celebrate</div>
                  <div className="exp-type-option__sub">Decorations, birthday setups & flowers</div>
                </div>
              </label>
            </div>
          </div>

          {/* Description */}
          <div className="exp-modal-field">
            <label className="exp-modal-label" htmlFor="exp-desc">
              Short Description <span className="exp-modal-label--hint">(Display in front-office & booking engine)</span>
            </label>
            <textarea id="exp-desc" className="exp-modal-textarea" rows={2}
              placeholder="Ringkasan paket layanan..." value={form.description}
              onChange={(e) => set("description", e.target.value)} />
          </div>

          {/* Price + Pricing Type */}
          <div className="exp-modal-2col">
            <div className="exp-modal-field">
              <label className="exp-modal-label" htmlFor="exp-price">
                Price (IDR) <span className="exp-required">*</span>
              </label>
              <div className="exp-price-wrap">
                <span className="exp-price-prefix">Rp</span>
                <input id="exp-price" type="number" className="exp-modal-input exp-modal-input--price"
                  min={0} value={form.price || ""}
                  onChange={(e) => set("price", Math.max(0, Number(e.target.value)))} />
              </div>
            </div>
            <div className="exp-modal-field">
              <label className="exp-modal-label" htmlFor="exp-pricing-type">
                Pricing Type <span className="exp-required">*</span>
              </label>
              <div className="exp-select-wrap">
                <select id="exp-pricing-type" className="exp-modal-select"
                  value={form.pricingType} onChange={(e) => set("pricingType", e.target.value as PricingType)}>
                  <option>Per Package</option>
                  <option>Per Person</option>
                  <option>Per Item</option>
                </select>
                <Icon name="chevron" className="exp-select-chevron" width={14} height={14} />
              </div>
            </div>
          </div>

          {/* Qty + Lead Time */}
          <div className="exp-modal-3col">
            <div className="exp-modal-field">
              <label className="exp-modal-label" htmlFor="exp-min-qty">Min Qty</label>
              <input id="exp-min-qty" type="number" className="exp-modal-input" min={1}
                value={form.minQty} onChange={(e) => set("minQty", Math.max(1, Number(e.target.value)))} />
            </div>
            <div className="exp-modal-field">
              <label className="exp-modal-label" htmlFor="exp-max-qty">Max Qty</label>
              <input id="exp-max-qty" type="number" className="exp-modal-input" min={1}
                placeholder="No limit" value={form.maxQty ?? ""}
                onChange={(e) => set("maxQty", e.target.value === "" ? null : Math.max(1, Number(e.target.value)))} />
            </div>
            <div className="exp-modal-field">
              <label className="exp-modal-label" htmlFor="exp-lead">Lead Time</label>
              <div className="exp-select-wrap">
                <select id="exp-lead" className="exp-modal-select"
                  value={form.leadTime} onChange={(e) => set("leadTime", e.target.value as LeadTime)}>
                  <option value="Same Day">Same Day</option>
                  <option value="H-1">H-1 (24 Hours)</option>
                  <option value="H-2">H-2 (48 Hours)</option>
                  <option value="H-3">H-3 (72 Hours)</option>
                </select>
                <Icon name="chevron" className="exp-select-chevron" width={14} height={14} />
              </div>
            </div>
          </div>

          {/* Available Days */}
          <div className="exp-modal-field">
            <span className="exp-modal-label">Available Days</span>
            <div className="exp-days-row">
              {ALL_DAYS.map((day) => (
                <label key={day} className={form.availableDays.includes(day) ? "exp-day-chip exp-day-chip--on" : "exp-day-chip"}>
                  <input type="checkbox" className="sr-only"
                    checked={form.availableDays.includes(day)} onChange={() => toggleDay(day)} />
                  {day}
                </label>
              ))}
            </div>
          </div>

          {/* Room Types */}
          <div className="exp-modal-field">
            <span className="exp-modal-label">Applicable Room Types</span>
            <div className="exp-room-row">
              <label className="exp-checkbox-label">
                <input type="checkbox" className="exp-checkbox"
                  checked={form.roomTypes.length === 0} onChange={() => set("roomTypes", [])} />
                <span>All Room Types</span>
              </label>
              {ALL_ROOM_TYPES_EXP.map((rt) => (
                <label key={rt} className="exp-checkbox-label exp-checkbox-label--secondary">
                  <input type="checkbox" className="exp-checkbox"
                    checked={form.roomTypes.includes(rt)}
                    onChange={() => set("roomTypes", form.roomTypes.includes(rt)
                      ? form.roomTypes.filter((r) => r !== rt)
                      : [...form.roomTypes, rt])} />
                  <span>{rt}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="exp-modal-field">
            <span className="exp-modal-label">Status</span>
            <div className="exp-status-row">
              <label className="exp-status-radio-label">
                <input type="radio" className="exp-radio" name="exp-status" value="Active"
                  checked={form.status === "Active"} onChange={() => set("status", "Active")} />
                <span className="exp-status-badge exp-status-badge--active">Active</span>
              </label>
              <label className="exp-status-radio-label">
                <input type="radio" className="exp-radio" name="exp-status" value="Inactive"
                  checked={form.status === "Inactive"} onChange={() => set("status", "Inactive")} />
                <span className="exp-status-badge exp-status-badge--inactive">Inactive</span>
              </label>
            </div>
          </div>

          {/* Internal Note */}
          <div className="exp-modal-field">
            <label className="exp-modal-label" htmlFor="exp-note">
              Internal Note <span className="exp-modal-label--hint">(Staff only - kitchen coordination)</span>
            </label>
            <textarea id="exp-note" className="exp-modal-textarea" rows={2}
              placeholder="Catatan khusus operasional dapur atau housekeeping..."
              value={form.internalNote} onChange={(e) => set("internalNote", e.target.value)} />
          </div>
        </div>

        {/* Footer */}
        <div className="exp-modal__footer">
          <button type="button" className="exp-btn-cancel" onClick={onClose}>Cancel</button>
          <button type="button" className="exp-btn-save"
            onClick={() => { onSave(form); onClose(); }}>
            {isEdit ? "Save Changes" : "Save Experience"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ExperiencesPage() {
  const [exps, setExps] = useState<Experience[]>(initialExperiences);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modal, setModal] = useState<{ open: boolean; mode: "add" | "edit"; data: Experience } | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return exps.filter((e) => {
      if (term && !e.name.toLowerCase().includes(term) && !e.description.toLowerCase().includes(term)) return false;
      if (typeFilter !== "all" && e.type.toLowerCase() !== typeFilter.toLowerCase()) return false;
      if (statusFilter !== "all" && e.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      return true;
    });
  }, [exps, search, typeFilter, statusFilter]);

  const hasFilter = search || typeFilter !== "all" || statusFilter !== "all";

  function openAdd() { setModal({ open: true, mode: "add", data: blankExp() }); }
  function openEdit(exp: Experience) { setModal({ open: true, mode: "edit", data: { ...exp } }); }
  function closeModal() { setModal(null); }
  function handleSave(updated: Experience) {
    if (modal?.mode === "add") {
      setExps((prev) => [...prev, { ...updated, id: "exp-" + Date.now() }]);
    } else {
      setExps((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    }
  }

  return (
    <AdminShell title="Admin" context="Experiences">
      <div className="exp-page">
        {/* Heading */}
        <div className="exp-heading">
          <div>
            <h1>Experiences</h1>
            <p>Kelola add-on tambahan untuk reservasi tamu</p>
          </div>
          <button type="button" className="action-button" onClick={openAdd}>
            <Icon name="plus" />
            <span>+ Add Experience</span>
          </button>
        </div>

        {/* Filter bar */}
        <div className="exp-filter-bar">
          <div className="exp-filter-bar__left">
            <div className="campaigns-search-wrap">
              <Icon name="search" className="campaigns-search-icon" width={16} height={16} />
              <input type="text" className="campaigns-search" placeholder="Search experience..."
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="campaigns-select-wrap">
              <select className="campaigns-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="all">All Types</option>
                <option value="Dining">Dining</option>
                <option value="Celebrate">Celebrate</option>
              </select>
              <Icon name="chevron" className="campaigns-select-chevron" width={14} height={14} />
            </div>
            <div className="campaigns-select-wrap">
              <select className="campaigns-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
              <Icon name="chevron" className="campaigns-select-chevron" width={14} height={14} />
            </div>
            {hasFilter && (
              <button type="button" className="campaigns-reset-button"
                onClick={() => { setSearch(""); setTypeFilter("all"); setStatusFilter("all"); }}>
                <Icon name="reset" width={14} height={14} />
                <span>Reset</span>
              </button>
            )}
          </div>
          <span className="exp-filter-bar__count">
            Total <strong>{filtered.length}</strong> experiences recorded
          </span>
        </div>

        {/* Table */}
        <div className="data-panel">
          <div className="table-scroll">
            <table className="exp-table">
              <thead>
                <tr className="exp-table__head-row">
                  <th className="exp-table__th exp-table__th--exp">Experience</th>
                  <th className="exp-table__th">Type</th>
                  <th className="exp-table__th exp-table__th--right">Price</th>
                  <th className="exp-table__th">Pricing Type</th>
                  <th className="exp-table__th">Lead Time</th>
                  <th className="exp-table__th exp-table__th--center">Status</th>
                  <th className="exp-table__th exp-table__th--right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? (
                  filtered.map((exp) => {
                    const inactive = exp.status === "Inactive";
                    return (
                      <tr key={exp.id} className="exp-table__row">
                        <td className="exp-table__td">
                          <div className="exp-name-cell">
                            <ExperienceIconBox iconKey={exp.iconKey} type={exp.type} inactive={inactive} />
                            <div>
                              <div className={inactive ? "exp-name-cell__name exp-name-cell__name--inactive" : "exp-name-cell__name"}>
                                {exp.name}
                              </div>
                              <div className={inactive ? "exp-name-cell__desc exp-name-cell__desc--inactive" : "exp-name-cell__desc"}>
                                {exp.description}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="exp-table__td"><TypeBadge type={exp.type} /></td>
                        <td className="exp-table__td exp-table__td--right exp-table__td--price">
                          {formatPrice(exp.price)}
                        </td>
                        <td className="exp-table__td exp-table__td--muted">{exp.pricingType}</td>
                        <td className="exp-table__td"><LeadChip lead={exp.leadTime} /></td>
                        <td className="exp-table__td exp-table__td--center">
                          <StatusBadge status={exp.status} />
                        </td>
                        <td className="exp-table__td exp-table__td--right">
                          <button type="button" className="exp-edit-btn" onClick={() => openEdit(exp)}>
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="campaigns-table__empty">
                      Tidak ada experience yang sesuai filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="campaigns-pagination">
            <span className="campaigns-pagination__info">
              Showing <strong>1–{filtered.length}</strong> of <strong>{filtered.length}</strong> experiences
            </span>
            <div className="campaigns-pagination__controls">
              <button type="button" className="campaigns-pagination__btn" disabled>
                <Icon name="chevronLeft" width={14} height={14} /><span>Previous</span>
              </button>
              <button type="button" className="campaigns-pagination__page campaigns-pagination__page--active">1</button>
              <button type="button" className="campaigns-pagination__btn" disabled>
                <span>Next</span><Icon name="chevronRight" width={14} height={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Notice */}
        <div className="campaigns-notice">
          <Icon name="info" className="campaigns-notice__icon" width={18} height={18} />
          <p>
            <strong>Informasi Operasional:</strong> Add-on yang berstatus aktif akan muncul di
            formulir reservasi (Website, Walk-in, Phone, OTA) dan disimpan sebagai snapshot harga
            saat reservasi dibuat. Penyesuaian harga setelah pemesanan tidak akan mengubah riwayat
            transaksi yang sedang berjalan.
          </p>
        </div>
      </div>

      {modal?.open && (
        <ExperienceModal
          mode={modal.mode}
          initial={modal.data}
          onClose={closeModal}
          onSave={handleSave}
        />
      )}
    </AdminShell>
  );
}
