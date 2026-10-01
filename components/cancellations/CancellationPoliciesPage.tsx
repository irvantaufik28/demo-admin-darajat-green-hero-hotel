"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AdminShell } from "../layout/AdminShell";
import { Icon } from "../ui/Icon";
import {
  ALL_ROOM_TYPES,
  cancellationPolicies as initialPolicies,
  formatRoomTypes,
  formatStayPeriod,
  getPolicySummary,
  type CancellationPolicy,
  type CancellationSource,
  type CancellationRule,
  type ChargeType,
  type NoShowChargeType,
  type TimingType,
} from "../../lib/cancellation-policies-data";

// ─── Types ────────────────────────────────────────────────────────────────────

type ModalMode = "add" | "edit";

type ModalState = {
  open: boolean;
  mode: ModalMode;
  policy: CancellationPolicy;
};

// ─── Blank policy factory ─────────────────────────────────────────────────────

function blankPolicy(): CancellationPolicy {
  return {
    id: "",
    name: "",
    status: "Active",
    sources: ["Website", "Phone"],
    roomTypes: [],
    stayStart: "",
    stayEnd: "",
    applyToAllDates: false,
    rules: [
      { id: crypto.randomUUID(), timing: "More than", days: 3, chargeType: "Percentage", chargeValue: 0 },
    ],
    noShowChargeType: "Percentage",
    noShowChargeValue: 100,
  };
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "Active" | "Inactive" }) {
  return (
    <span className={status === "Active" ? "cp-badge cp-badge--active" : "cp-badge cp-badge--inactive"}>
      <i />
      {status}
    </span>
  );
}

// ─── Cancellation summary cell ────────────────────────────────────────────────

function PolicySummaryCell({ policy }: { policy: CancellationPolicy }) {
  const { main, sub } = getPolicySummary(policy);
  const isDanger = main.includes("100%") && policy.name === "Non Refundable";
  return (
    <div className="cp-summary-cell">
      <span className={isDanger ? "cp-summary-cell__main cp-summary-cell__main--danger" : "cp-summary-cell__main"}>
        {main}
      </span>
      <span className="cp-summary-cell__sub">{sub}</span>
    </div>
  );
}

// ─── Rule row inside modal ────────────────────────────────────────────────────

function RuleRow({
  rule,
  onChange,
  onRemove,
}: {
  rule: CancellationRule;
  onChange: (updated: CancellationRule) => void;
  onRemove: () => void;
}) {
  const isPercent = rule.chargeType === "Percentage";
  const unit = rule.chargeType === "Percentage" ? "%" : rule.chargeType === "Nights Count" ? "night(s)" : "Rp";

  return (
    <div className="cp-rule-row">
      <div className="cp-rule-row__fields">
        <span className="cp-rule-row__label">Cancellation Time:</span>
        <select
          className="cp-rule-select"
          value={rule.timing}
          onChange={(e) => onChange({ ...rule, timing: e.target.value as TimingType })}
        >
          <option>More than</option>
          <option>Within</option>
        </select>
        <input
          type="number"
          className="cp-rule-number"
          min={0}
          value={rule.days}
          onChange={(e) => onChange({ ...rule, days: Math.max(0, Number(e.target.value)) })}
        />
        <span className="cp-rule-row__label">Days Before Check-in</span>
        <span className="cp-rule-row__divider">|</span>
        <span className="cp-rule-row__label">Charge Type:</span>
        <select
          className="cp-rule-select"
          value={rule.chargeType}
          onChange={(e) => onChange({ ...rule, chargeType: e.target.value as ChargeType })}
        >
          <option>Percentage</option>
          <option>Fixed Amount</option>
          <option>Nights Count</option>
        </select>
        <div className="cp-rule-value-wrap">
          <input
            type="number"
            className="cp-rule-value"
            min={0}
            max={isPercent ? 100 : undefined}
            value={rule.chargeValue}
            onChange={(e) => onChange({ ...rule, chargeValue: Math.max(0, Number(e.target.value)) })}
          />
          <span className="cp-rule-unit">{unit}</span>
        </div>
      </div>
      <button type="button" className="cp-rule-delete" onClick={onRemove} aria-label="Hapus rule">
        <Icon name="trash" width={16} height={16} />
      </button>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function PolicyModal({
  state,
  onClose,
  onSave,
  onDelete,
}: {
  state: ModalState;
  onClose: () => void;
  onSave: (policy: CancellationPolicy) => void;
  onDelete: (id: string) => void;
}) {
  const [form, setForm] = useState<CancellationPolicy>(state.policy);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Sync form when modal opens with new data
  useEffect(() => {
    setForm(state.policy);
  }, [state.policy]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function set<K extends keyof CancellationPolicy>(key: K, value: CancellationPolicy[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Room type toggles
  const allSelected = ALL_ROOM_TYPES.every((r) => form.roomTypes.includes(r));
  function toggleRoom(rt: string) {
    set("roomTypes", form.roomTypes.includes(rt)
      ? form.roomTypes.filter((r) => r !== rt)
      : [...form.roomTypes, rt]);
  }

  function toggleSource(source: CancellationSource) {
    set("sources", form.sources.includes(source)
      ? form.sources.filter((item) => item !== source)
      : [...form.sources, source]);
  }

  // Rules
  function addRule() {
    set("rules", [
      ...form.rules,
      { id: crypto.randomUUID(), timing: "Within" as TimingType, days: 3, chargeType: "Percentage" as ChargeType, chargeValue: 50 },
    ]);
  }
  function updateRule(id: string, updated: CancellationRule) {
    set("rules", form.rules.map((r) => (r.id === id ? updated : r)));
  }
  function removeRule(id: string) {
    set("rules", form.rules.filter((r) => r.id !== id));
  }

  const isEdit = state.mode === "edit";
  const activeRules = form.rules.length;

  return (
    <div
      className="cp-modal-overlay"
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? "Edit Cancellation Policy" : "Add Cancellation Policy"}
    >
      <div className="cp-modal">
        {/* Header */}
        <div className="cp-modal__header">
          <div>
            <h3>{isEdit ? "Edit Cancellation Policy" : "Add Cancellation Policy"}</h3>
            <p>{isEdit ? "Perbarui aturan pembatalan dan denda no-show" : "Buat kebijakan pembatalan baru"}</p>
          </div>
          <button type="button" className="cp-modal__close" onClick={onClose} aria-label="Tutup modal">
            <Icon name="close" width={18} height={18} />
          </button>
        </div>

        {/* Body */}
        <div className="cp-modal__body">

          {/* 1. Policy Information */}
          <div className="cp-modal-section">
            <div className="cp-modal-section__title">1. Policy Information</div>
            <div className="cp-modal-info-grid">
              <div className="cp-modal-field cp-modal-field--name">
                <label className="cp-modal-label" htmlFor="cp-policy-name">Policy Name</label>
                <input
                  id="cp-policy-name"
                  type="text"
                  className="cp-modal-input"
                  placeholder="e.g. Flexible Cancellation"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                />
              </div>
              <div className="cp-modal-field">
                <span className="cp-modal-label">Status</span>
                <div className="cp-status-toggle">
                  <button
                    type="button"
                    className={form.status === "Active" ? "cp-status-btn cp-status-btn--on" : "cp-status-btn"}
                    onClick={() => set("status", "Active")}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    className={form.status === "Inactive" ? "cp-status-btn cp-status-btn--on" : "cp-status-btn"}
                    onClick={() => set("status", "Inactive")}
                  >
                    Inactive
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="cp-modal-section">
            <div className="cp-modal-section__title">Booking Source</div>
            <div className="cp-source-options">
              {(["Website", "Phone"] as const).map((source) => (
                <label key={source} className={form.sources.includes(source) ? "cp-room-option cp-room-option--checked" : "cp-room-option"}>
                  <input type="checkbox" className="cp-checkbox" checked={form.sources.includes(source)} onChange={() => toggleSource(source)} />
                  <span>{source}</span>
                </label>
              ))}
            </div>
            <small className="cp-source-hint">Pilih satu atau keduanya. Kebijakan berlaku untuk kanal yang dipilih.</small>
          </div>

          {/* 2. Applicable Room Types */}
          <div className="cp-modal-section">
            <div className="cp-modal-section__title">2. Applicable Room Types</div>
            <div className="cp-room-grid">
              <label className="cp-room-option cp-room-option--secondary">
                <input
                  type="checkbox"
                  className="cp-checkbox"
                  checked={allSelected}
                  onChange={() =>
                    set("roomTypes", allSelected ? [] : [...ALL_ROOM_TYPES])
                  }
                />
                <span>Select All</span>
              </label>
              {ALL_ROOM_TYPES.map((rt) => {
                const checked = form.roomTypes.includes(rt);
                return (
                  <label key={rt} className={checked ? "cp-room-option cp-room-option--checked" : "cp-room-option"}>
                    <input
                      type="checkbox"
                      className="cp-checkbox"
                      checked={checked}
                      onChange={() => toggleRoom(rt)}
                    />
                    <span>{rt}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 3. Stay Period */}
          <div className="cp-modal-section">
            <div className="cp-modal-section__title-row">
              <span className="cp-modal-section__title" style={{ margin: 0 }}>3. Stay Period</span>
              <label className="cp-checkbox-label-inline">
                <input
                  type="checkbox"
                  className="cp-checkbox"
                  checked={form.applyToAllDates}
                  onChange={(e) => set("applyToAllDates", e.target.checked)}
                />
                <span>Apply to All Dates</span>
              </label>
            </div>
            {!form.applyToAllDates && (
              <div className="cp-date-grid">
                <div className="cp-modal-field">
                  <label className="cp-modal-label">From</label>
                  <input
                    type="date"
                    className="cp-modal-input cp-modal-input--date"
                    value={form.stayStart ?? ""}
                    onChange={(e) => set("stayStart", e.target.value)}
                  />
                </div>
                <div className="cp-modal-field">
                  <label className="cp-modal-label">To</label>
                  <input
                    type="date"
                    className="cp-modal-input cp-modal-input--date"
                    value={form.stayEnd ?? ""}
                    onChange={(e) => set("stayEnd", e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 4. Cancellation Rules */}
          <div className="cp-modal-section">
            <div className="cp-modal-section__title-row">
              <span className="cp-modal-section__title" style={{ margin: 0 }}>4. Cancellation Rules</span>
              <span className="cp-modal-section__meta">{activeRules} active tier{activeRules !== 1 ? "s" : ""}</span>
            </div>
            <div className="cp-rules-list">
              {form.rules.map((rule) => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  onChange={(updated) => updateRule(rule.id, updated)}
                  onRemove={() => removeRule(rule.id)}
                />
              ))}
            </div>
            <button type="button" className="cp-add-rule-btn" onClick={addRule}>
              <Icon name="plus" width={15} height={15} />
              <span>+ Add Rule</span>
            </button>
          </div>

          {/* 5. No-show Rule */}
          <div className="cp-modal-section cp-modal-section--last">
            <div className="cp-modal-section__title">5. No-show Rule</div>
            <div className="cp-noshow-row">
              <div className="cp-noshow-left">
                <span className="cp-noshow-label">No-show Charge</span>
                <span className="cp-noshow-dot">•</span>
                <span className="cp-rule-row__label">Charge Type:</span>
                <select
                  className="cp-rule-select"
                  value={form.noShowChargeType}
                  onChange={(e) => set("noShowChargeType", e.target.value as NoShowChargeType)}
                >
                  <option>Percentage</option>
                  <option>First Night Charge</option>
                  <option>Full Stay Amount</option>
                </select>
                <div className="cp-rule-value-wrap">
                  <input
                    type="number"
                    className="cp-rule-value"
                    min={0}
                    max={form.noShowChargeType === "Percentage" ? 100 : undefined}
                    value={form.noShowChargeValue}
                    onChange={(e) => set("noShowChargeValue", Math.max(0, Number(e.target.value)))}
                  />
                  <span className="cp-rule-unit">
                    {form.noShowChargeType === "Percentage" ? "%" : ""}
                  </span>
                </div>
              </div>
              <span className="cp-noshow-hint">
                {form.noShowChargeType === "Percentage"
                  ? `${form.noShowChargeValue}% of entire stay charged`
                  : form.noShowChargeType === "First Night Charge"
                    ? "First night charged"
                    : "Full stay amount charged"}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="cp-modal__footer">
          {isEdit ? (
            <button
              type="button"
              className="cp-delete-btn"
              onClick={() => { onDelete(form.id); onClose(); }}
            >
              <Icon name="trash" width={14} height={14} />
              <span>Delete Policy</span>
            </button>
          ) : (
            <span />
          )}
          <div className="cp-modal__footer-actions">
            <button type="button" className="cp-btn-cancel" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="cp-btn-save"
              disabled={form.sources.length === 0}
              onClick={() => { onSave(form); onClose(); }}
            >
              {isEdit ? "Save Changes" : "Add Policy"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function CancellationPoliciesPage() {
  const [policies, setPolicies] = useState<CancellationPolicy[]>(initialPolicies);
  const [search, setSearch] = useState("");
  const [roomFilter, setRoomFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modal, setModal] = useState<ModalState>({
    open: false,
    mode: "add",
    policy: blankPolicy(),
  });

  const filtered = useMemo(() => {
    return policies.filter((p) => {
      const term = search.trim().toLowerCase();
      if (term && !p.name.toLowerCase().includes(term) &&
          !formatRoomTypes(p).toLowerCase().includes(term)) return false;
      if (statusFilter !== "all" && p.status.toLowerCase() !== statusFilter) return false;
      if (roomFilter !== "all") {
        if (p.roomTypes.length > 0 && !p.roomTypes.includes(roomFilter)) return false;
      }
      return true;
    });
  }, [policies, search, roomFilter, statusFilter]);

  const activeCount = policies.filter((p) => p.status === "Active").length;
  const inactiveCount = policies.filter((p) => p.status === "Inactive").length;

  function openAdd() {
    setModal({ open: true, mode: "add", policy: blankPolicy() });
  }
  function openEdit(policy: CancellationPolicy) {
    setModal({ open: true, mode: "edit", policy: { ...policy } });
  }
  function closeModal() {
    setModal((prev) => ({ ...prev, open: false }));
  }
  function handleSave(updated: CancellationPolicy) {
    if (modal.mode === "add") {
      setPolicies((prev) => [...prev, { ...updated, id: "cp-" + Date.now() }]);
    } else {
      setPolicies((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    }
  }
  function handleDelete(id: string) {
    setPolicies((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <AdminShell title="Operations" context="Cancellation Policies">
      <div className="cp-page">
        {/* Page header */}
        <div className="cp-heading">
          <div>
            <h1>Cancellation Policies</h1>
            <p>Kelola aturan pembatalan berdasarkan tipe kamar dan periode menginap</p>
          </div>
          <button type="button" className="action-button" onClick={openAdd}>
            <Icon name="plus" />
            <span>Add Cancellation Policy</span>
          </button>
        </div>

        {/* Filter bar */}
        <div className="cp-filter-bar">
          <div className="cp-filter-bar__left">
            <div className="campaigns-search-wrap">
              <Icon name="search" className="campaigns-search-icon" width={16} height={16} />
              <input
                type="text"
                className="campaigns-search"
                placeholder="Search policy name or room type"
                value={search}
                onChange={(e) => { setSearch(e.target.value); }}
              />
            </div>
            <div className="campaigns-select-wrap">
              <select
                className="campaigns-select"
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
              >
                <option value="all">All Room Types</option>
                {ALL_ROOM_TYPES.map((rt) => (
                  <option key={rt} value={rt}>{rt}</option>
                ))}
              </select>
              <Icon name="chevron" className="campaigns-select-chevron" width={14} height={14} />
            </div>
            <div className="campaigns-select-wrap">
              <select
                className="campaigns-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <Icon name="chevron" className="campaigns-select-chevron" width={14} height={14} />
            </div>
            {(search || roomFilter !== "all" || statusFilter !== "all") && (
              <button
                type="button"
                className="campaigns-reset-button"
                onClick={() => { setSearch(""); setRoomFilter("all"); setStatusFilter("all"); }}
              >
                <Icon name="reset" width={14} height={14} />
                <span>Reset</span>
              </button>
            )}
          </div>
          <div className="cp-filter-bar__counts">
            <span className="cp-count cp-count--active">
              <i />
              {activeCount} Active
            </span>
            <span className="cp-count-divider">|</span>
            <span className="cp-count cp-count--inactive">
              <i />
              {inactiveCount} Inactive
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="data-panel">
          <div className="table-scroll">
            <table className="cp-table">
              <thead>
                <tr className="cp-table__head-row">
                  <th className="cp-table__th">Policy Name</th>
                  <th className="cp-table__th">Stay Period</th>
                  <th className="cp-table__th">Room Type</th>
                  <th className="cp-table__th">Booking Source</th>
                  <th className="cp-table__th">Cancellation Policy</th>
                  <th className="cp-table__th">Status</th>
                  <th className="cp-table__th cp-table__th--right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? (
                  filtered.map((policy) => (
                    <tr key={policy.id} className="cp-table__row">
                      <td className="cp-table__td cp-table__td--name">
                        <div className="cp-name-cell">
                          <Icon name="policy" width={16} height={16} className="cp-name-cell__icon" />
                          <span>{policy.name}</span>
                        </div>
                      </td>
                      <td className="cp-table__td cp-table__td--period">
                        {formatStayPeriod(policy)}
                      </td>
                      <td className="cp-table__td cp-table__td--room">
                        {policy.roomTypes.length === 0 ? (
                          <span className="campaign-room-all">All Room Types</span>
                        ) : (
                          formatRoomTypes(policy)
                        )}
                      </td>
                      <td className="cp-table__td cp-table__td--source">{policy.sources.join(" / ")}</td>
                      <td className="cp-table__td">
                        <PolicySummaryCell policy={policy} />
                      </td>
                      <td className="cp-table__td">
                        <StatusBadge status={policy.status} />
                      </td>
                      <td className="cp-table__td cp-table__td--right">
                        <div className="campaign-actions">
                          <button
                            type="button"
                            className="text-action"
                            onClick={() => openEdit(policy)}
                          >
                            Edit
                          </button>
                          <button type="button" className="campaign-more-button" aria-label="Aksi lainnya">
                            <Icon name="more" width={18} height={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="campaigns-table__empty">
                      Tidak ada kebijakan yang sesuai filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div className="campaigns-pagination">
            <span className="campaigns-pagination__info">
              Showing <strong>1–{filtered.length}</strong> of <strong>{filtered.length}</strong> policies
            </span>
            <div className="campaigns-pagination__controls">
              <button type="button" className="campaigns-pagination__btn" disabled>
                <Icon name="chevronLeft" width={14} height={14} />
                <span>Previous</span>
              </button>
              <button type="button" className="campaigns-pagination__page campaigns-pagination__page--active">1</button>
              <button type="button" className="campaigns-pagination__btn" disabled>
                <span>Next</span>
                <Icon name="chevronRight" width={14} height={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Operational notice */}
        <div className="campaigns-notice">
          <Icon name="info" className="campaigns-notice__icon" width={18} height={18} />
          <p>
            <strong>Catatan Kebijakan Pembatalan:</strong> Kebijakan pembatalan yang dipilih pada
            reservasi atau kampanye promo akan disimpan sebagai snapshot riwayat pemesanan. Perubahan
            kebijakan di halaman ini tidak akan mengubah syarat reservasi yang sudah dibuat sebelumnya.
          </p>
        </div>
      </div>

      {/* Modal */}
      {modal.open && (
        <PolicyModal
          state={modal}
          onClose={closeModal}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </AdminShell>
  );
}
