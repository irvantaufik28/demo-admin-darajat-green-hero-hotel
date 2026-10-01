"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AdminShell } from "../layout/AdminShell";
import { masterCategories } from "../../lib/master-data";

function readItems(slug: string, defaults: string[]) {
  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(`green-hero-master-${slug}`) || "null");
    return Array.isArray(stored) && stored.every((item) => typeof item === "string")
      ? stored as string[] : defaults;
  } catch {
    return defaults;
  }
}

export function MasterListPage({ categorySlug }: { categorySlug: string }) {
  const category = masterCategories.find((item) => item.slug === categorySlug);
  const [items, setItems] = useState<string[]>(category?.items ?? []);
  const [search, setSearch] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const visible = useMemo(() => items.map((value, index) => ({ value, index }))
    .filter(({ value }) => value.toLowerCase().includes(search.toLowerCase())),
  [items, search]);

  useEffect(() => {
    if (category) setItems(readItems(category.slug, category.items));
  }, [category]);

  if (!category) return <AdminShell title="Master" context="Not Found">
    <main className="master-page"><h1>Master category not found</h1></main>
  </AdminShell>;

  function persist(next: string[]) {
    setItems(next);
    sessionStorage.setItem(`green-hero-master-${category!.slug}`, JSON.stringify(next));
  }

  function openAdd() {
    setEditingIndex(null);
    setName("");
    setError("");
    setModalOpen(true);
  }

  function openEdit(index: number) {
    setEditingIndex(index);
    setName(items[index]);
    setError("");
    setModalOpen(true);
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required.");
      return;
    }
    if (items.some((item, index) =>
      index !== editingIndex && item.toLowerCase() === trimmed.toLowerCase())) {
      setError("This name already exists.");
      return;
    }
    persist(editingIndex === null
      ? [...items, trimmed]
      : items.map((item, index) => index === editingIndex ? trimmed : item));
    setNotice(editingIndex === null ? `${trimmed} added.` : `${trimmed} updated.`);
    setModalOpen(false);
  }

  function remove(index: number) {
    const item = items[index];
    if (!window.confirm(`Delete ${item}?`)) return;
    persist(items.filter((_, position) => position !== index));
    setNotice(`${item} deleted.`);
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
            <h2>{category.title} <span>{visible.length} items</span></h2>
            <input aria-label={`Search ${category.title}`} placeholder={`Search ${category.title.toLowerCase()}...`}
              value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="master-table-scroll">
            <table className="master-table">
              <thead><tr><th>No.</th><th>Name</th><th>Action</th></tr></thead>
              <tbody>
                {visible.map(({ value, index }) => <tr key={`${index}-${value}`}>
                  <td>{index + 1}</td><td><strong>{value}</strong></td>
                  <td><div className="master-row-actions">
                    <button type="button" onClick={() => openEdit(index)}>Edit</button>
                    <button type="button" onClick={() => remove(index)}>Delete</button>
                  </div></td>
                </tr>)}
                {visible.length === 0 && <tr><td colSpan={3} className="master-empty">No items found.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        {notice && <p className="roles-notice" role="status">{notice}</p>}

        {modalOpen && <div className="roles-modal-backdrop" onMouseDown={() => setModalOpen(false)}>
          <form className="roles-modal" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <h2>{editingIndex === null ? "Add" : "Edit"} {category.title}</h2>
              <button type="button" aria-label="Close" onClick={() => setModalOpen(false)}>×</button>
            </header>
            <p>Enter the name to display in {category.title.toLowerCase()}.</p>
            <label>Name
              <input autoFocus value={name} maxLength={80}
                onChange={(event) => { setName(event.target.value); setError(""); }} />
            </label>
            {error && <span className="roles-form-error" role="alert">{error}</span>}
            <footer>
              <button type="button" onClick={() => setModalOpen(false)}>Cancel</button>
              <button type="submit">{editingIndex === null ? "Add" : "Save Changes"}</button>
            </footer>
          </form>
        </div>}
      </main>
    </AdminShell>
  );
}
