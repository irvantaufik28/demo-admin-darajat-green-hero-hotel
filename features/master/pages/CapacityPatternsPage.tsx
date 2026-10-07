"use client";
import "../../settings/styles/settings.css";
import "../styles/master.css";

import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AdminShell } from "../../../components/layout/AdminShell";
import { restoreSession } from "../../../lib/auth";
import {
  createCapacityPattern,
  deleteCapacityPattern,
  getCapacityPatterns,
  updateCapacityPattern,
  type CapacityPattern,
} from "../services/capacity-patterns";
import { useTranslations, type Translate } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

type Draft = {
  adults: string;
  children: string;
  sortOrder: string;
  isActive: boolean;
};

const emptyDraft: Draft = {
  adults: "1",
  children: "0",
  sortOrder: "0",
  isActive: true,
};

function patternLabel(pattern: Pick<CapacityPattern, "adults" | "children">, t: Translate) {
  const adults = pattern.adults === 1
    ? t("capacityPatterns.label.adult", { count: pattern.adults })
    : t("capacityPatterns.label.adults", { count: pattern.adults });
  const children = pattern.children === 1
    ? t("capacityPatterns.label.child", { count: pattern.children })
    : t("capacityPatterns.label.children", { count: pattern.children });
  return `${adults} + ${children}`;
}

export function CapacityPatternsPage() {
  const { t } = useTranslations({ en, id });
  const [items, setItems] = useState<CapacityPattern[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const visible = useMemo(() => items.filter((item) =>
    patternLabel(item, t).toLowerCase().includes(search.trim().toLowerCase())),
  [items, search, t]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setLoadError("");
      try {
        if (!(await restoreSession())) return;
        const response = await getCapacityPatterns(controller.signal);
        if (!controller.signal.aborted) setItems(response.items);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setLoadError(cause instanceof Error ? cause.message : t("capacityPatterns.errors.loadFailed"));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [reloadKey]);

  function openAdd() {
    setEditingId(null);
    setDraft(emptyDraft);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(item: CapacityPattern) {
    setEditingId(item.id);
    setDraft({
      adults: String(item.adults),
      children: String(item.children),
      sortOrder: String(item.sortOrder),
      isActive: item.isActive,
    });
    setFormError("");
    setModalOpen(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const adults = Number(draft.adults);
    const children = Number(draft.children);
    const sortOrder = Number(draft.sortOrder);
    if (
      !draft.adults || !draft.children || !draft.sortOrder ||
      !Number.isInteger(adults) || adults < 1 || adults > 99 ||
      !Number.isInteger(children) || children < 0 || children > 99 ||
      !Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000
    ) {
      setFormError(t("capacityPatterns.errors.validation"));
      return;
    }
    if (items.some((item) =>
      item.id !== editingId && item.adults === adults && item.children === children)) {
      setFormError(t("capacityPatterns.errors.duplicate"));
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const input = { adults, children, sortOrder };
      const response = editingId
        ? await updateCapacityPattern(editingId, { ...input, isActive: draft.isActive })
        : await createCapacityPattern(input);
      setItems((current) => {
        const next = editingId
          ? current.map((item) => item.id === editingId ? response.item : item)
          : [...current, response.item];
        return next.sort((a, b) => a.sortOrder - b.sortOrder || a.adults - b.adults || a.children - b.children);
      });
      setNotice(editingId ? t("capacityPatterns.notices.updated") : t("capacityPatterns.notices.added"));
      setModalOpen(false);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : t("capacityPatterns.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: CapacityPattern) {
    if (!window.confirm(t("capacityPatterns.deleteConfirm", { label: patternLabel(item, t) }))) return;
    setDeletingId(item.id);
    setLoadError("");
    setNotice("");
    try {
      await deleteCapacityPattern(item.id);
      setItems((current) => current.filter((value) => value.id !== item.id));
      setNotice(t("capacityPatterns.notices.deleted"));
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : t("capacityPatterns.errors.deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AdminShell title={t("shell.title")} context={t("shell.capacityContext")}>
      <main className="master-page">
        <header className="master-heading">
          <div>
            <span className="roles-eyebrow">{t("common.eyebrow")}</span>
            <h1>{t("capacityPatterns.title")}</h1>
            <p>{t("capacityPatterns.description")}</p>
          </div>
          <button type="button" className="roles-add-button" onClick={openAdd}>{t("capacityPatterns.addButton")}</button>
        </header>

        <section className="master-panel">
          <div className="master-toolbar">
            <h2>{t("capacityPatterns.panelTitle")} <span>{t("capacityPatterns.count", { total: items.length })}</span></h2>
            <input
              aria-label={t("capacityPatterns.searchAriaLabel")}
              placeholder={t("capacityPatterns.searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {loadError && <div className="master-message" role="alert">
            {loadError} <button type="button" onClick={() => setReloadKey((value) => value + 1)}>{t("common.retry")}</button>
          </div>}
          <div className="master-table-scroll">
            <table className="master-table">
              <thead><tr><th>{t("capacityPatterns.table.no")}</th><th>{t("capacityPatterns.table.capacity")}</th><th>{t("capacityPatterns.table.sortOrder")}</th><th>{t("capacityPatterns.table.status")}</th><th>{t("capacityPatterns.table.action")}</th></tr></thead>
              <tbody>
                {!loading && visible.map((item, index) => <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td><strong>{patternLabel(item, t)}</strong></td>
                  <td>{item.sortOrder}</td>
                  <td><span className={`master-status master-status--${item.isActive ? "active" : "inactive"}`}>
                    {item.isActive ? t("common.status.active") : t("common.status.inactive")}
                  </span></td>
                  <td><div className="master-row-actions">
                    <button type="button" onClick={() => openEdit(item)}>{t("common.edit")}</button>
                    <button type="button" disabled={deletingId === item.id} onClick={() => void remove(item)}>
                      {deletingId === item.id ? t("common.deleting") : t("common.delete")}
                    </button>
                  </div></td>
                </tr>)}
                {(loading || !visible.length) && <tr><td colSpan={5} className="master-empty">
                  {loading ? <LoadingSkeleton /> : loadError ? t("capacityPatterns.errors.unableToLoad") : t("capacityPatterns.empty")}
                </td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        {notice && <p className="roles-notice" role="status">{notice}</p>}

        {modalOpen && <div className="roles-modal-backdrop" onMouseDown={() => { if (!saving) setModalOpen(false); }}>
          <form className="roles-modal master-capacity-modal" onSubmit={(event) => void save(event)} onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <h2>{editingId ? t("capacityPatterns.modal.editTitle") : t("capacityPatterns.modal.addTitle")}</h2>
              <button type="button" aria-label={t("common.close")} disabled={saving} onClick={() => setModalOpen(false)}>×</button>
            </header>
            <p>{t("capacityPatterns.modal.description")}</p>
            <label>{t("capacityPatterns.modal.adults")}
              <input type="number" min={1} max={99} required value={draft.adults} disabled={saving}
                onChange={(event) => setDraft((current) => ({ ...current, adults: event.target.value }))} />
            </label>
            <label>{t("capacityPatterns.modal.children")}
              <input type="number" min={0} max={99} required value={draft.children} disabled={saving}
                onChange={(event) => setDraft((current) => ({ ...current, children: event.target.value }))} />
            </label>
            <label>{t("capacityPatterns.modal.sortOrder")}
              <input type="number" min={0} max={10000} required value={draft.sortOrder} disabled={saving}
                onChange={(event) => setDraft((current) => ({ ...current, sortOrder: event.target.value }))} />
            </label>
            {editingId && <label className="master-checkbox-label">
              <input type="checkbox" checked={draft.isActive} disabled={saving}
                onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))} />
              {t("capacityPatterns.modal.active")}
            </label>}
            {formError && <span className="roles-form-error" role="alert">{formError}</span>}
            <footer>
              <button type="button" disabled={saving} onClick={() => setModalOpen(false)}>{t("common.cancel")}</button>
              <button type="submit" disabled={saving}>{saving ? t("common.saving") : editingId ? t("common.saveChanges") : t("common.add")}</button>
            </footer>
          </form>
        </div>}
      </main>
    </AdminShell>
  );
}
