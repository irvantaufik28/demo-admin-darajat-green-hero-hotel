"use client";

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

export function MasterListPage({ categorySlug }: { categorySlug: string }) {
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
          setLoadError(cause instanceof Error ? cause.message : "Master data gagal dimuat.");
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

  if (!category) return <AdminShell title="Master" context="Not Found">
    <main className="master-page"><h1>Master category not found</h1></main>
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
      setError("Name is required.");
      return;
    }
    if (items.some((item) =>
      item.id !== editingId && item.name.toLowerCase() === trimmed.toLowerCase())) {
      setError("This name already exists.");
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
      setNotice(editingId === null ? `${trimmed} added.` : `${trimmed} updated.`);
      setModalOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Master data gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: MasterItem) {
    if (!window.confirm(`Delete ${item.name}?`)) return;
    setDeletingId(item.id);
    setNotice("");
    setLoadError("");
    try {
      await deleteMasterItem(categorySlug, item.id);
      setItems((current) => current.filter((value) => value.id !== item.id));
      setNotice(`${item.name} deleted.`);
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "Master data gagal dihapus.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AdminShell title="Master" context={category.title}>
      <main className="master-page">
        <header className="master-heading">
          <div>
            <span className="roles-eyebrow">MASTER DATA</span>
            <h1>{category.title}</h1>
            <p>Manage the available {category.title.toLowerCase()} for Green Hero.</p>
          </div>
          <button type="button" className="roles-add-button" onClick={openAdd}>+ Add {category.title}</button>
        </header>

        <section className="master-panel">
          <div className="master-toolbar">
            <h2>{category.title} <span>{items.length} items</span></h2>
            <input aria-label={`Search ${category.title}`} placeholder={`Search ${category.title.toLowerCase()}...`}
              value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          {loadError && <div className="master-message" role="alert">
            {loadError} <button type="button" onClick={() => setReloadKey((value) => value + 1)}>Retry</button>
          </div>}
          <div className="master-table-scroll">
            <table className="master-table">
              <thead><tr><th>No.</th><th>Name</th><th>Action</th></tr></thead>
              <tbody>
                {visible.map((item, index) => <tr key={item.id}>
                  <td>{index + 1}</td><td><strong>{item.name}</strong>{!item.isActive && <span className="master-inactive">Inactive</span>}</td>
                  <td><div className="master-row-actions">
                    <button type="button" onClick={() => openEdit(item)}>Edit</button>
                    <button type="button" disabled={deletingId === item.id} onClick={() => void remove(item)}>
                      {deletingId === item.id ? "Deleting..." : "Delete"}
                    </button>
                  </div></td>
                </tr>)}
                {visible.length === 0 && <tr><td colSpan={3} className="master-empty">
                  {loading ? "Loading items..." : loadError ? "Unable to load items." : "No items found."}
                </td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        {notice && <p className="roles-notice" role="status">{notice}</p>}

        {modalOpen && <div className="roles-modal-backdrop" onMouseDown={() => { if (!saving) setModalOpen(false); }}>
          <form className="roles-modal" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <h2>{editingId === null ? "Add" : "Edit"} {category.title}</h2>
              <button type="button" aria-label="Close" disabled={saving} onClick={() => setModalOpen(false)}>×</button>
            </header>
            <p>Enter the name to display in {category.title.toLowerCase()}.</p>
            <label>Name
              <input autoFocus value={name} maxLength={80} disabled={saving}
                onChange={(event) => { setName(event.target.value); setError(""); }} />
            </label>
            {error && <span className="roles-form-error" role="alert">{error}</span>}
            <footer>
              <button type="button" disabled={saving} onClick={() => setModalOpen(false)}>Cancel</button>
              <button type="submit" disabled={saving}>{saving ? "Saving..." : editingId === null ? "Add" : "Save Changes"}</button>
            </footer>
          </form>
        </div>}
      </main>
    </AdminShell>
  );
}
