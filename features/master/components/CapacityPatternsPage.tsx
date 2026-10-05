"use client";

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

function patternLabel(pattern: Pick<CapacityPattern, "adults" | "children">) {
  return `${pattern.adults} ${pattern.adults === 1 ? "Adult" : "Adults"} + ${pattern.children} ${pattern.children === 1 ? "Child" : "Children"}`;
}

export function CapacityPatternsPage() {
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
    patternLabel(item).toLowerCase().includes(search.trim().toLowerCase())),
  [items, search]);

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
          setLoadError(cause instanceof Error ? cause.message : "Capacity patterns gagal dimuat.");
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
      setFormError("Isi Adults (1–99), Children (0–99), dan Sort Order (0–10000).");
      return;
    }
    if (items.some((item) =>
      item.id !== editingId && item.adults === adults && item.children === children)) {
      setFormError("Kombinasi kapasitas ini sudah ada.");
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
      setNotice(editingId ? "Capacity pattern updated." : "Capacity pattern added.");
      setModalOpen(false);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Capacity pattern gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: CapacityPattern) {
    if (!window.confirm(`Delete ${patternLabel(item)}?`)) return;
    setDeletingId(item.id);
    setLoadError("");
    setNotice("");
    try {
      await deleteCapacityPattern(item.id);
      setItems((current) => current.filter((value) => value.id !== item.id));
      setNotice("Capacity pattern deleted.");
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "Capacity pattern gagal dihapus.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AdminShell title="Master" context="Capacity Patterns">
      <main className="master-page">
        <header className="master-heading">
          <div>
            <span className="roles-eyebrow">MASTER DATA</span>
            <h1>Capacity Patterns</h1>
            <p>Manage adult and child combinations available for room types.</p>
          </div>
          <button type="button" className="roles-add-button" onClick={openAdd}>+ Add Capacity Pattern</button>
        </header>

        <section className="master-panel">
          <div className="master-toolbar">
            <h2>Capacity Patterns <span>{items.length} items</span></h2>
            <input
              aria-label="Search capacity patterns"
              placeholder="Search capacity patterns..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {loadError && <div className="master-message" role="alert">
            {loadError} <button type="button" onClick={() => setReloadKey((value) => value + 1)}>Retry</button>
          </div>}
          <div className="master-table-scroll">
            <table className="master-table">
              <thead><tr><th>No.</th><th>Capacity</th><th>Sort Order</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {!loading && visible.map((item, index) => <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td><strong>{patternLabel(item)}</strong></td>
                  <td>{item.sortOrder}</td>
                  <td><span className={`master-status master-status--${item.isActive ? "active" : "inactive"}`}>
                    {item.isActive ? "Active" : "Inactive"}
                  </span></td>
                  <td><div className="master-row-actions">
                    <button type="button" onClick={() => openEdit(item)}>Edit</button>
                    <button type="button" disabled={deletingId === item.id} onClick={() => void remove(item)}>
                      {deletingId === item.id ? "Deleting..." : "Delete"}
                    </button>
                  </div></td>
                </tr>)}
                {(loading || !visible.length) && <tr><td colSpan={5} className="master-empty">
                  {loading ? <LoadingSkeleton /> : loadError ? "Unable to load items." : "No capacity patterns found."}
                </td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        {notice && <p className="roles-notice" role="status">{notice}</p>}

        {modalOpen && <div className="roles-modal-backdrop" onMouseDown={() => { if (!saving) setModalOpen(false); }}>
          <form className="roles-modal master-capacity-modal" onSubmit={(event) => void save(event)} onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <h2>{editingId ? "Edit" : "Add"} Capacity Pattern</h2>
              <button type="button" aria-label="Close" disabled={saving} onClick={() => setModalOpen(false)}>×</button>
            </header>
            <p>Set a valid guest combination for room type capacity.</p>
            <label>Adults
              <input type="number" min={1} max={99} required value={draft.adults} disabled={saving}
                onChange={(event) => setDraft((current) => ({ ...current, adults: event.target.value }))} />
            </label>
            <label>Children
              <input type="number" min={0} max={99} required value={draft.children} disabled={saving}
                onChange={(event) => setDraft((current) => ({ ...current, children: event.target.value }))} />
            </label>
            <label>Sort Order
              <input type="number" min={0} max={10000} required value={draft.sortOrder} disabled={saving}
                onChange={(event) => setDraft((current) => ({ ...current, sortOrder: event.target.value }))} />
            </label>
            {editingId && <label className="master-checkbox-label">
              <input type="checkbox" checked={draft.isActive} disabled={saving}
                onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))} />
              Active
            </label>}
            {formError && <span className="roles-form-error" role="alert">{formError}</span>}
            <footer>
              <button type="button" disabled={saving} onClick={() => setModalOpen(false)}>Cancel</button>
              <button type="submit" disabled={saving}>{saving ? "Saving..." : editingId ? "Save Changes" : "Add"}</button>
            </footer>
          </form>
        </div>}
      </main>
    </AdminShell>
  );
}
