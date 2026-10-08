"use client";
import "../../reservations/styles/reservations.css";
import "../../dashboard/styles/dashboard.css";
import "../../campaigns/styles/campaigns.css";
import "../styles/cancellation-policies.css";

import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { useEffect, useRef, useState } from "react";
import { AdminShell } from "../../../components/layout/AdminShell";
import { Icon } from "../../../components/ui/Icon";
import { restoreSession } from "../../../lib/auth";
import {
  formatRoomTypes,
  formatStayPeriod,
  getPolicySummary,
  type CancellationPolicy,
  type CancellationSource,
  type CancellationRule,
  type ChargeType,
  type NoShowChargeType,
  type TimingType,
} from "../constants/cancellation-policies-data";
import {
  createPolicy,
  deletePolicy,
  getPolicy,
  listPolicies,
  listPolicyRoomTypes,
  listPolicyTypes,
  setPolicyStatus,
  updatePolicy,
  type PolicyInput,
  type PolicyRecord,
  type PolicyRoomTypeOption,
  type PolicyTypeOption,
} from "../services/cancellation-policies";
import { useTranslations, type Translate } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

// ─── Types ────────────────────────────────────────────────────────────────────

type ModalMode = "add" | "edit";

type ModalState = {
  open: boolean;
  mode: ModalMode;
  policy: CancellationPolicy;
};

function toPolicy(record: PolicyRecord): CancellationPolicy {
  return {
    id: record.id,
    policyTypeId: record.policyTypeId,
    name: record.name,
    status: record.isActive ? "Active" : "Inactive",
    sources: [
      ...(record.appliesWebsite ? ["Website" as const] : []),
      ...(record.appliesPhone ? ["Phone" as const] : []),
    ],
    roomTypes: record.roomTypes.map((room) => room.name),
    roomTypeIds: record.roomTypes.map((room) => room.id),
    stayStart: record.stayStart,
    stayEnd: record.stayEnd,
    applyToAllDates: !record.stayStart && !record.stayEnd,
    rules: record.rules.map((rule) => ({
      id: rule.id,
      timing: rule.timingType === "more_than" ? "More than" : "Within",
      days: rule.daysBefore,
      chargeType: rule.chargeType === "percentage" ? "Percentage" : rule.chargeType === "fixed" ? "Fixed Amount" : "Nights Count",
      chargeValue: rule.chargeValue,
    })),
    noShowChargeType: record.noShowChargeType === "first_night"
      ? "First Night Charge"
      : record.noShowChargeType === "full_stay"
        ? "Full Stay Amount"
        : record.noShowChargeType === "percentage"
          ? "Percentage"
          : "None",
    noShowChargeValue: record.noShowChargeValue,
  };
}

function toPolicyInput(policy: CancellationPolicy): PolicyInput {
  return {
    policyTypeId: policy.policyTypeId ?? "",
    appliesWebsite: policy.sources.includes("Website"),
    appliesPhone: policy.sources.includes("Phone"),
    stayStart: policy.applyToAllDates ? null : policy.stayStart || null,
    stayEnd: policy.applyToAllDates ? null : policy.stayEnd || null,
    noShowChargeType: policy.noShowChargeType === "None"
      ? null
      : policy.noShowChargeType === "First Night Charge"
        ? "first_night"
        : policy.noShowChargeType === "Full Stay Amount"
          ? "full_stay"
          : "percentage",
    noShowChargeValue: policy.noShowChargeType === "None" ? 0
      : policy.noShowChargeType === "First Night Charge" ? 1
        : policy.noShowChargeType === "Full Stay Amount" ? 100
          : policy.noShowChargeValue,
    isActive: policy.status === "Active",
    roomTypeIds: policy.roomTypeIds ?? [],
    rules: policy.rules.map((rule, index) => ({
      timingType: rule.timing === "More than" ? "more_than" : "within",
      daysBefore: rule.days,
      chargeType: rule.chargeType === "Percentage" ? "percentage" : rule.chargeType === "Fixed Amount" ? "fixed" : "nights",
      chargeValue: rule.chargeValue,
      sortOrder: index,
    })),
  };
}

// ─── Blank policy factory ─────────────────────────────────────────────────────

function blankPolicy(): CancellationPolicy {
  return {
    id: "",
    policyTypeId: "",
    name: "",
    status: "Active",
    sources: ["Website", "Phone"],
    roomTypes: [],
    roomTypeIds: [],
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

function StatusBadge({ status, t }: { status: "Active" | "Inactive"; t: Translate }) {
  return (
    <span className={status === "Active" ? "cp-badge cp-badge--active" : "cp-badge cp-badge--inactive"}>
      <i />
      {status === "Active" ? t("status.active") : t("status.inactive")}
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
  t,
}: {
  rule: CancellationRule;
  onChange: (updated: CancellationRule) => void;
  onRemove: () => void;
  t: Translate;
}) {
  const isPercent = rule.chargeType === "Percentage";
  const unit = rule.chargeType === "Percentage" ? t("modal.rule.unit.percent") : rule.chargeType === "Nights Count" ? t("modal.rule.unit.nights") : t("modal.rule.unit.currency");

  return (
    <div className="cp-rule-row">
      <div className="cp-rule-row__fields">
        <span className="cp-rule-row__label">{t("modal.rule.cancellationTime")}</span>
        <select
          className="cp-rule-select"
          value={rule.timing}
          onChange={(e) => onChange({ ...rule, timing: e.target.value as TimingType })}
        >
          <option value="More than">{t("modal.rule.timing.moreThan")}</option>
          <option value="Within">{t("modal.rule.timing.within")}</option>
        </select>
        <input
          type="number"
          className="cp-rule-number"
          min={0}
          value={rule.days}
          onChange={(e) => onChange({ ...rule, days: Math.max(0, Number(e.target.value)) })}
        />
        <span className="cp-rule-row__label">{t("modal.rule.daysBeforeCheckin")}</span>
        <span className="cp-rule-row__divider">|</span>
        <span className="cp-rule-row__label">{t("modal.rule.chargeType")}</span>
        <select
          className="cp-rule-select"
          value={rule.chargeType}
          onChange={(e) => onChange({ ...rule, chargeType: e.target.value as ChargeType })}
        >
          <option value="Percentage">{t("modal.rule.charge.percentage")}</option>
          <option value="Fixed Amount">{t("modal.rule.charge.fixedAmount")}</option>
          <option value="Nights Count">{t("modal.rule.charge.nightsCount")}</option>
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
      <button type="button" className="cp-rule-delete" onClick={onRemove} aria-label={t("modal.rule.removeAria")}>
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
  policyTypes,
  roomTypeOptions,
  saving,
  error,
  t,
}: {
  state: ModalState;
  onClose: () => void;
  onSave: (policy: CancellationPolicy) => Promise<void>;
  policyTypes: PolicyTypeOption[];
  roomTypeOptions: PolicyRoomTypeOption[];
  saving: boolean;
  error: string;
  t: Translate;
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
  const selectedRoomIds = form.roomTypeIds ?? [];
  function toggleRoom(id: string) {
    set("roomTypeIds", selectedRoomIds.includes(id)
      ? selectedRoomIds.filter((roomId) => roomId !== id)
      : [...selectedRoomIds, id]);
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
      aria-label={isEdit ? t("modal.titleEdit") : t("modal.titleAdd")}
    >
      <div className="cp-modal">
        {/* Header */}
        <div className="cp-modal__header">
          <div>
            <h3>{isEdit ? t("modal.titleEdit") : t("modal.titleAdd")}</h3>
            <p>{isEdit ? t("modal.descriptionEdit") : t("modal.descriptionAdd")}</p>
          </div>
          <button type="button" className="cp-modal__close" onClick={onClose} aria-label={t("modal.closeAria")}>
            <Icon name="close" width={18} height={18} />
          </button>
        </div>

        {/* Body */}
        <div className="cp-modal__body">

          {/* 1. Policy Information */}
          <div className="cp-modal-section">
            <div className="cp-modal-section__title">{t("modal.sections.policyInformation")}</div>
            <div className="cp-modal-info-grid">
              <div className="cp-modal-field cp-modal-field--name">
                <label className="cp-modal-label" htmlFor="cp-policy-name">{t("modal.fields.policyName")}</label>
                <select
                  id="cp-policy-name"
                  className="cp-modal-input"
                  value={form.policyTypeId ?? ""}
                  onChange={(e) => setForm((current) => ({
                    ...current,
                    policyTypeId: e.target.value,
                    name: policyTypes.find((item) => item.id === e.target.value)?.name ?? "",
                  }))}
                >
                  <option value="">{t("modal.fields.selectPolicyType")}</option>
                  {policyTypes.map((item) => <option key={item.id} value={item.id} disabled={!item.isActive && item.id !== form.policyTypeId}>
                    {item.name}{!item.isActive ? t("modal.fields.inactiveSuffix") : ""}
                  </option>)}
                </select>
              </div>
              <div className="cp-modal-field">
                <span className="cp-modal-label">{t("modal.fields.status")}</span>
                <div className="cp-status-toggle">
                  <button
                    type="button"
                    className={form.status === "Active" ? "cp-status-btn cp-status-btn--on" : "cp-status-btn"}
                    onClick={() => set("status", "Active")}
                  >
                    {t("modal.fields.statusActive")}
                  </button>
                  <button
                    type="button"
                    className={form.status === "Inactive" ? "cp-status-btn cp-status-btn--on" : "cp-status-btn"}
                    onClick={() => set("status", "Inactive")}
                  >
                    {t("modal.fields.statusInactive")}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="cp-modal-section">
            <div className="cp-modal-section__title">{t("modal.sections.bookingSource")}</div>
            <div className="cp-source-options">
              {(["Website", "Phone"] as const).map((source) => (
                <label key={source} className={form.sources.includes(source) ? "cp-room-option cp-room-option--checked" : "cp-room-option"}>
                  <input type="checkbox" className="cp-checkbox" checked={form.sources.includes(source)} onChange={() => toggleSource(source)} />
                  <span>{source === "Website" ? t("modal.fields.sourceWebsite") : t("modal.fields.sourcePhone")}</span>
                </label>
              ))}
            </div>
            <small className="cp-source-hint">{t("modal.fields.sourceHint")}</small>
          </div>

          {/* 2. Applicable Room Types */}
          <div className="cp-modal-section">
            <div className="cp-modal-section__title">{t("modal.sections.applicableRoomTypes")}</div>
            <div className="cp-room-grid">
              {roomTypeOptions.map((rt) => {
                const checked = selectedRoomIds.includes(rt.id);
                return (
                  <label key={rt.id} className={checked ? "cp-room-option cp-room-option--checked" : "cp-room-option"}>
                    <input
                      type="checkbox"
                      className="cp-checkbox"
                      checked={checked}
                      onChange={() => toggleRoom(rt.id)}
                    />
                    <span>{rt.name}{!rt.isActive ? t("modal.fields.inactiveSuffix") : ""}</span>
                  </label>
                );
              })}
            </div>
            <small className="cp-source-hint">{t("modal.fields.roomTypeHint")}</small>
          </div>

          {/* 3. Stay Period */}
          <div className="cp-modal-section">
            <div className="cp-modal-section__title-row">
              <span className="cp-modal-section__title" style={{ margin: 0 }}>{t("modal.sections.stayPeriod")}</span>
              <label className="cp-checkbox-label-inline">
                <input
                  type="checkbox"
                  className="cp-checkbox"
                  checked={form.applyToAllDates}
                  onChange={(e) => set("applyToAllDates", e.target.checked)}
                />
                <span>{t("modal.fields.applyToAllDates")}</span>
              </label>
            </div>
            {!form.applyToAllDates && (
              <div className="cp-date-grid">
                <div className="cp-modal-field">
                  <label className="cp-modal-label">{t("modal.fields.from")}</label>
                  <input
                    type="date"
                    className="cp-modal-input cp-modal-input--date"
                    value={form.stayStart ?? ""}
                    onChange={(e) => set("stayStart", e.target.value)}
                  />
                </div>
                <div className="cp-modal-field">
                  <label className="cp-modal-label">{t("modal.fields.to")}</label>
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
              <span className="cp-modal-section__title" style={{ margin: 0 }}>{t("modal.sections.cancellationRules")}</span>
              <span className="cp-modal-section__meta">{activeRules !== 1 ? t("modal.fields.activeTiers", { count: activeRules }) : t("modal.fields.activeTier", { count: activeRules })}</span>
            </div>
            <div className="cp-rules-list">
              {form.rules.map((rule) => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  onChange={(updated) => updateRule(rule.id, updated)}
                  onRemove={() => removeRule(rule.id)}
                  t={t}
                />
              ))}
            </div>
            <button type="button" className="cp-add-rule-btn" onClick={addRule}>
              <Icon name="plus" width={15} height={15} />
              <span>{t("modal.fields.addRule")}</span>
            </button>
          </div>

          {/* 5. No-show Rule */}
          <div className="cp-modal-section cp-modal-section--last">
            <div className="cp-modal-section__title">{t("modal.sections.noShowRule")}</div>
            <div className="cp-noshow-row">
              <div className="cp-noshow-left">
                <span className="cp-noshow-label">{t("modal.fields.noShowCharge")}</span>
                <span className="cp-noshow-dot">•</span>
                <span className="cp-rule-row__label">{t("modal.fields.chargeType")}</span>
                <select
                  className="cp-rule-select"
                  value={form.noShowChargeType}
                  onChange={(e) => setForm((current) => ({
                    ...current,
                    noShowChargeType: e.target.value as NoShowChargeType,
                    noShowChargeValue: e.target.value === "First Night Charge" ? 1
                      : e.target.value === "Full Stay Amount" ? 100
                        : e.target.value === "None" ? 0 : current.noShowChargeValue,
                  }))}
                >
                  <option value="None">{t("modal.noShow.options.none")}</option>
                  <option value="Percentage">{t("modal.noShow.options.percentage")}</option>
                  <option value="First Night Charge">{t("modal.noShow.options.firstNightCharge")}</option>
                  <option value="Full Stay Amount">{t("modal.noShow.options.fullStayAmount")}</option>
                </select>
                <div className="cp-rule-value-wrap">
                  <input
                    type="number"
                    className="cp-rule-value"
                    min={0}
                    max={form.noShowChargeType === "Percentage" ? 100 : undefined}
                    value={form.noShowChargeValue}
                    disabled={form.noShowChargeType !== "Percentage"}
                    onChange={(e) => set("noShowChargeValue", Math.max(0, Number(e.target.value)))}
                  />
                  <span className="cp-rule-unit">
                    {form.noShowChargeType === "Percentage" ? t("modal.rule.unit.percent") : ""}
                  </span>
                </div>
              </div>
              <span className="cp-noshow-hint">
                {form.noShowChargeType === "Percentage"
                  ? t("modal.noShow.hintPercentage", { value: form.noShowChargeValue })
                  : form.noShowChargeType === "None"
                    ? t("modal.noShow.hintNone")
                  : form.noShowChargeType === "First Night Charge"
                    ? t("modal.noShow.hintFirstNight")
                    : t("modal.noShow.hintFullStay")}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="cp-modal__footer">
          <span />
          <div className="cp-modal__footer-actions">
            {error && <span className="cp-modal-error" role="alert">{error}</span>}
            <button type="button" className="cp-btn-cancel" disabled={saving} onClick={onClose}>{t("modal.actions.cancel")}</button>
            <button
              type="button"
              className="cp-btn-save"
              disabled={saving || !form.policyTypeId || form.sources.length === 0 || !form.roomTypeIds?.length || form.rules.length === 0}
              onClick={() => void onSave(form)}
            >
              {saving ? t("modal.actions.saving") : isEdit ? t("modal.actions.saveChanges") : t("modal.actions.addPolicy")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function CancellationPoliciesPage() {
  const { t } = useTranslations({ en, id });
  const [policies, setPolicies] = useState<CancellationPolicy[]>([]);
  const [policyTypes, setPolicyTypes] = useState<PolicyTypeOption[]>([]);
  const [roomTypeOptions, setRoomTypeOptions] = useState<PolicyRoomTypeOption[]>([]);
  const [search, setSearch] = useState("");
  const [roomFilter, setRoomFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ active: 0, inactive: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [policyToDelete, setPolicyToDelete] = useState<CancellationPolicy | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [reload, setReload] = useState(0);
  const limit = 20;
  const [modal, setModal] = useState<ModalState>({
    open: false,
    mode: "add",
    policy: blankPolicy(),
  });

  useEffect(() => {
    if (!policyToDelete) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busyId) setPolicyToDelete(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [policyToDelete, busyId]);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        if (!(await restoreSession())) return;
        const [types, rooms] = await Promise.all([
          listPolicyTypes(controller.signal),
          listPolicyRoomTypes(controller.signal),
        ]);
        if (!controller.signal.aborted) {
          setPolicyTypes(types);
          setRoomTypeOptions(rooms);
        }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : t("messages.optionsLoadFailed"));
      }
    })();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError("");
        try {
          if (!(await restoreSession())) return;
          const query = new URLSearchParams({ page: String(page), limit: String(limit) });
          if (search.trim()) query.set("search", search.trim());
          if (roomFilter !== "all") query.set("roomTypeId", roomFilter);
          if (statusFilter !== "all") query.set("isActive", String(statusFilter === "active"));
          const result = await listPolicies(query, controller.signal);
          if (controller.signal.aborted) return;
          if (page > 1 && result.items.length === 0 && result.total > 0) {
            setPage(page - 1);
            return;
          }
          setPolicies(result.items.map(toPolicy));
          setTotal(result.total);
          setCounts(result.counts);
        } catch (cause) {
          if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : t("messages.policiesLoadFailed"));
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      })();
    }, search ? 250 : 0);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [search, roomFilter, statusFilter, page, reload]);

  function openAdd() {
    setFormError("");
    setModal({ open: true, mode: "add", policy: blankPolicy() });
  }
  async function openEdit(policy: CancellationPolicy) {
    setBusyId(policy.id);
    setError("");
    setFormError("");
    try {
      const result = await getPolicy(policy.id);
      setModal({ open: true, mode: "edit", policy: toPolicy(result.policy) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("messages.detailLoadFailed"));
    } finally {
      setBusyId("");
    }
  }
  function closeModal() {
    setModal((prev) => ({ ...prev, open: false }));
  }
  async function handleSave(updated: CancellationPolicy) {
    setSaving(true);
    setFormError("");
    try {
      const body = toPolicyInput(updated);
      if (modal.mode === "add") await createPolicy(body);
      else await updatePolicy(updated.id, body);
      closeModal();
      setReload((current) => current + 1);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : t("messages.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(policy: CancellationPolicy) {
    setBusyId(policy.id);
    setError("");
    try {
      await setPolicyStatus(policy.id, policy.status !== "Active");
      setReload((current) => current + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("messages.statusChangeFailed"));
    } finally {
      setBusyId("");
    }
  }

  async function confirmDelete() {
    const policy = policyToDelete;
    if (!policy) return;
    setBusyId(policy.id);
    setDeleteError("");
    try {
      await deletePolicy(policy.id);
      setPolicyToDelete(null);
      setReload((current) => current + 1);
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : t("messages.deleteFailed"));
    } finally {
      setBusyId("");
    }
  }

  return (
    <AdminShell title={t("shell.title")} context={t("shell.context")}>
      <div className="cp-page">
        {/* Page header */}
        <div className="cp-heading">
          <div>
            <h1>{t("page.title")}</h1>
            <p>{t("page.description")}</p>
          </div>
          <button type="button" className="action-button" disabled={policyTypes.length === 0} onClick={openAdd}>
            <Icon name="plus" />
            <span>{t("actions.addPolicy")}</span>
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
                placeholder={t("filters.searchPlaceholder")}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <div className="campaigns-select-wrap">
              <select
                className="campaigns-select"
                value={roomFilter}
                onChange={(e) => { setRoomFilter(e.target.value); setPage(1); }}
              >
                <option value="all">{t("filters.allRoomTypes")}</option>
                {roomTypeOptions.map((rt) => (
                  <option key={rt.id} value={rt.id}>{rt.name}</option>
                ))}
              </select>
              <Icon name="chevron" className="campaigns-select-chevron" width={14} height={14} />
            </div>
            <div className="campaigns-select-wrap">
              <select
                className="campaigns-select"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              >
                <option value="all">{t("filters.status.all")}</option>
                <option value="active">{t("filters.status.active")}</option>
                <option value="inactive">{t("filters.status.inactive")}</option>
              </select>
              <Icon name="chevron" className="campaigns-select-chevron" width={14} height={14} />
            </div>
            {(search || roomFilter !== "all" || statusFilter !== "all") && (
              <button
                type="button"
                className="campaigns-reset-button"
                onClick={() => { setSearch(""); setRoomFilter("all"); setStatusFilter("all"); setPage(1); }}
              >
                <Icon name="reset" width={14} height={14} />
                <span>{t("actions.reset")}</span>
              </button>
            )}
          </div>
          <div className="cp-filter-bar__counts">
            <span className="cp-count cp-count--active">
              <i />
              {t("filters.counts.active", { count: counts.active })}
            </span>
            <span className="cp-count-divider">|</span>
            <span className="cp-count cp-count--inactive">
              <i />
              {t("filters.counts.inactive", { count: counts.inactive })}
            </span>
          </div>
        </div>

        {error && <div className="campaigns-api-message" role="alert">{error}</div>}

        {/* Table */}
        <div className="data-panel">
          <div className="table-scroll">
            <table className="cp-table">
              <thead>
                <tr className="cp-table__head-row">
                  <th className="cp-table__th">{t("table.policyName")}</th>
                  <th className="cp-table__th">{t("table.stayPeriod")}</th>
                  <th className="cp-table__th">{t("table.roomType")}</th>
                  <th className="cp-table__th">{t("table.bookingSource")}</th>
                  <th className="cp-table__th">{t("table.cancellationPolicy")}</th>
                  <th className="cp-table__th">{t("table.status")}</th>
                  <th className="cp-table__th cp-table__th--right">{t("table.action")}</th>
                </tr>
              </thead>
              <tbody>
                {!loading && policies.length > 0 ? (
                  policies.map((policy) => (
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
                          <span className="campaign-room-all">{t("table.noRoomTypes")}</span>
                        ) : (
                          formatRoomTypes(policy)
                        )}
                      </td>
                      <td className="cp-table__td cp-table__td--source">{policy.sources.join(" / ")}</td>
                      <td className="cp-table__td">
                        <PolicySummaryCell policy={policy} />
                      </td>
                      <td className="cp-table__td">
                        <StatusBadge status={policy.status} t={t} />
                      </td>
                      <td className="cp-table__td cp-table__td--right">
                        <div className="campaign-actions">
                          <button
                            type="button"
                            className="text-action"
                            disabled={busyId === policy.id}
                            onClick={() => void openEdit(policy)}
                          >
                            {t("actions.edit")}
                          </button>
                          <button
                            type="button"
                            className="text-action"
                            disabled={busyId === policy.id}
                            onClick={() => void handleStatus(policy)}
                          >
                            {policy.status === "Active" ? t("actions.disable") : t("actions.enable")}
                          </button>
                          <button
                            type="button"
                            className="text-action cp-text-action--danger"
                            disabled={busyId === policy.id}
                            onClick={() => { setDeleteError(""); setPolicyToDelete(policy); }}
                          >
                            {t("actions.delete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="campaigns-table__empty">
                      {loading ? <LoadingSkeleton /> : t("messages.empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div className="campaigns-pagination">
            <span className="campaigns-pagination__info">
              {t("pagination.showing", { from: total > 0 ? (page - 1) * limit + 1 : 0, to: Math.min(page * limit, total), total })}
            </span>
            <div className="campaigns-pagination__controls">
              <button type="button" className="campaigns-pagination__btn" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>
                <Icon name="chevronLeft" width={14} height={14} />
                <span>{t("actions.previous")}</span>
              </button>
              <button type="button" className="campaigns-pagination__page campaigns-pagination__page--active">{page}</button>
              <button type="button" className="campaigns-pagination__btn" disabled={page * limit >= total || loading} onClick={() => setPage((current) => current + 1)}>
                <span>{t("actions.next")}</span>
                <Icon name="chevronRight" width={14} height={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Operational notice */}
        <div className="campaigns-notice">
          <Icon name="info" className="campaigns-notice__icon" width={18} height={18} />
          <p>
            <strong>{t("notice.title")}</strong> {t("notice.body")}
          </p>
        </div>
      </div>

      {/* Modal */}
      {modal.open && (
        <PolicyModal
          state={modal}
          onClose={closeModal}
          onSave={handleSave}
          policyTypes={policyTypes}
          roomTypeOptions={roomTypeOptions}
          saving={saving}
          error={formError}
          t={t}
        />
      )}
      {policyToDelete && (
        <div className="cp-delete-overlay">
          <section className="cp-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="cp-delete-title" aria-describedby="cp-delete-description">
            <h2 id="cp-delete-title">{t("deleteDialog.title")}</h2>
            <p id="cp-delete-description">{t("deleteDialog.description")}</p>
            <dl className="cp-delete-dialog__details">
              <div><dt>{t("table.policyName")}</dt><dd>{policyToDelete.name}</dd></div>
              <div><dt>{t("table.roomType")}</dt><dd>{policyToDelete.roomTypes.length ? policyToDelete.roomTypes.join(", ") : t("table.noRoomTypes")}</dd></div>
              <div><dt>{t("table.stayPeriod")}</dt><dd>{formatStayPeriod(policyToDelete)}</dd></div>
            </dl>
            {deleteError && <p className="cp-delete-dialog__error" role="alert">{deleteError}</p>}
            <div className="cp-delete-dialog__actions">
              <button type="button" autoFocus disabled={busyId === policyToDelete.id} onClick={() => setPolicyToDelete(null)}>{t("deleteDialog.cancel")}</button>
              <button type="button" className="cp-delete-dialog__confirm" disabled={busyId === policyToDelete.id} onClick={() => void confirmDelete()}>{busyId === policyToDelete.id ? t("deleteDialog.deleting") : t("deleteDialog.confirm")}</button>
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
