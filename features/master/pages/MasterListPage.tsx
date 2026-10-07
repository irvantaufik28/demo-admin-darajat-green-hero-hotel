"use client";
import "../../settings/styles/settings.css";
import "../styles/master.css";

import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AdminShell } from "../../../components/layout/AdminShell";
import { restoreSession } from "../../../lib/auth";
import { masterCategories } from "../constants/master-data";
import {
  createMasterItem,
  deleteMasterItem,
  getMasterItems,
  updateMasterItem,
  type MasterItem,
} from "../services/master";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

export function MasterListPage({ categorySlug }: { categorySlug: string }) {
  const { t } = useTranslations({ en, id });
  const category = masterCategories.find((item) => item.slug === categorySlug);
  const [items, setItems] = useState<MasterItem[]>([]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const visible = useMemo(() => items.filter((item) =>
    item.name.toLowerCase().includes(search.trim().toLowerCase())),
  [items, search]);

  useEffect(() => {
    if (!category) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setLoadError("");
      setItems([]);
      try {
        if (!(await restoreSession())) return;
        const response = await getMasterItems(categorySlug, controller.signal);
        if (!controller.signal.aborted) setItems(response.items);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setLoadError(cause instanceof Error ? cause.message : t("list.errors.loadFailed"));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [categorySlug, reloadKey]);

  useEffect(() => {
    setSearch("");
    setModalOpen(false);
    setNotice("");
  }, [categorySlug]);

  if (!category) return <AdminShell title={t("shell.title")} context={t("shell.notFoundContext")}>
    <main className="master-page"><h1>{t("list.notFound")}</h1></main>
  </AdminShell>;

  function openAdd() {
    setEditingId(null);
    setName("");
    setError("");
    setModalOpen(true);
  }

  function openEdit(item: MasterItem) {
    setEditingId(item.id);
    setName(item.name);
    setError("");
    setModalOpen(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("list.errors.nameRequired"));
      return;
    }
    if (items.some((item) =>
      item.id !== editingId && item.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(t("list.errors.duplicate"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = editingId === null
        ? await createMasterItem(categorySlug, trimmed)
        : await updateMasterItem(categorySlug, editingId, trimmed);
      setItems((current) => {
        const next = editingId === null
          ? [...current, response.item]
          : current.map((item) => item.id === editingId ? response.item : item);
        return next.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
      });
      setNotice(editingId === null ? t("list.notices.added", { name: trimmed }) : t("list.notices.updated", { name: trimmed }));
      setModalOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("list.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: MasterItem) {
    if (!window.confirm(t("list.deleteConfirm", { name: item.name }))) return;
    setDeletingId(item.id);
    setNotice("");
    setLoadError("");
    try {
      await deleteMasterItem(categorySlug, item.id);
      setItems((current) => current.filter((value) => value.id !== item.id));
      setNotice(t("list.notices.deleted", { name: item.name }));
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : t("list.errors.deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AdminShell title={t("shell.title")} context={category.title}>
      <main className="master-page">
        <header className="master-heading">
          <div>
            <span className="roles-eyebrow">{t("list.eyebrow")}</span>
            <h1>{category.title}</h1>
            <p>{t("list.descriptionPrefix")} {category.title.toLowerCase()} {t("list.descriptionSuffix")}</p>
          </div>
          <button type="button" className="roles-add-button" onClick={openAdd}>{t("list.addButton", { category: category.title })}</button>
        </header>

        <section className="master-panel">
          <div className="master-toolbar">
            <h2>{category.title} <span>{t("list.count", { total: items.length })}</span></h2>
            <input aria-label={t("list.searchAriaLabel", { category: category.title })} placeholder={t("list.searchPlaceholder", { category: category.title.toLowerCase() })}
              value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          {loadError && <div className="master-message" role="alert">
            {loadError} <button type="button" onClick={() => setReloadKey((value) => value + 1)}>{t("common.retry")}</button>
          </div>}
          <div className="master-table-scroll">
            <table className="master-table">
              <thead><tr><th>{t("list.table.no")}</th><th>{t("list.table.name")}</th><th>{t("list.table.action")}</th></tr></thead>
              <tbody>
                {!loading && visible.map((item, index) => <tr key={item.id}>
                  <td>{index + 1}</td><td><strong>{item.name}</strong>{!item.isActive && <span className="master-inactive">{t("list.inactive")}</span>}</td>
                  <td><div className="master-row-actions">
                    <button type="button" onClick={() => openEdit(item)}>{t("common.edit")}</button>
                    <button type="button" disabled={deletingId === item.id} onClick={() => void remove(item)}>
                      {deletingId === item.id ? t("common.deleting") : t("common.delete")}
                    </button>
                  </div></td>
                </tr>)}
                {(loading || visible.length === 0) && <tr><td colSpan={3} className="master-empty">
                  {loading ? <LoadingSkeleton /> : loadError ? t("list.errors.unableToLoad") : t("list.empty")}
                </td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        {notice && <p className="roles-notice" role="status">{notice}</p>}

        {modalOpen && <div className="roles-modal-backdrop" onMouseDown={() => { if (!saving) setModalOpen(false); }}>
          <form className="roles-modal" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <h2>{editingId === null ? t("list.modal.addTitle", { category: category.title }) : t("list.modal.editTitle", { category: category.title })}</h2>
              <button type="button" aria-label={t("common.close")} disabled={saving} onClick={() => setModalOpen(false)}>×</button>
            </header>
            <p>{t("list.modal.description", { category: category.title.toLowerCase() })}</p>
            <label>{t("list.modal.name")}
              <input autoFocus value={name} maxLength={80} disabled={saving}
                onChange={(event) => { setName(event.target.value); setError(""); }} />
            </label>
            {error && <span className="roles-form-error" role="alert">{error}</span>}
            <footer>
              <button type="button" disabled={saving} onClick={() => setModalOpen(false)}>{t("common.cancel")}</button>
              <button type="submit" disabled={saving}>{saving ? t("common.saving") : editingId === null ? t("common.add") : t("common.saveChanges")}</button>
            </footer>
          </form>
        </div>}
      </main>
    </AdminShell>
  );
}
