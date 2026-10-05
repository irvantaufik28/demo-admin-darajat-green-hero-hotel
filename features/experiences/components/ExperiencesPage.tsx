"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../../../components/layout/AdminShell";
import { Icon } from "../../../components/ui/Icon";
import { restoreSession } from "../../../lib/auth";
import { ExperienceModal } from "./ExperienceModal";
import {
  createExperience,
  getExperience,
  listExperienceCategories,
  listExperiences,
  setExperienceStatus,
  updateExperience,
  type ExperienceCategory,
  type ExperienceInput,
  type ExperienceRecord,
} from "../services/experiences";

const formatPrice = (value: number) => `Rp${new Intl.NumberFormat("id-ID").format(value)}`;

function priceRange(experience: ExperienceRecord) {
  const prices = experience.variants.map((variant) => variant.price);
  if (prices.length === 0) return "—";
  const minimum = Math.min(...prices);
  const maximum = Math.max(...prices);
  return minimum === maximum ? formatPrice(minimum) : `${formatPrice(minimum)} – ${formatPrice(maximum)}`;
}

export function ExperiencesPage() {
  const [items, setItems] = useState<ExperienceRecord[]>([]);
  const [categories, setCategories] = useState<ExperienceCategory[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [modal, setModal] = useState<{ initial: ExperienceRecord | null } | null>(null);
  const [reload, setReload] = useState(0);
  const limit = 20;

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        if (!(await restoreSession())) return;
        const result = await listExperienceCategories(controller.signal);
        if (!controller.signal.aborted) setCategories(result);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Kategori gagal dimuat.");
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
          if (categoryFilter !== "all") query.set("categoryId", categoryFilter);
          if (statusFilter !== "all") query.set("isActive", String(statusFilter === "active"));
          const result = await listExperiences(query, controller.signal);
          if (controller.signal.aborted) return;
          if (page > 1 && result.items.length === 0 && result.total > 0) {
            setPage(page - 1);
            return;
          }
          setItems(result.items);
          setTotal(result.total);
        } catch (cause) {
          if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Experiences gagal dimuat.");
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      })();
    }, search ? 250 : 0);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [search, categoryFilter, statusFilter, page, reload]);

  async function openEdit(experience: ExperienceRecord) {
    setBusyId(experience.id);
    setError("");
    setModalError("");
    try {
      const result = await getExperience(experience.id);
      setModal({ initial: result.experience });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Detail experience gagal dimuat.");
    } finally {
      setBusyId("");
    }
  }

  async function save(input: ExperienceInput) {
    if (!modal) return;
    setSaving(true);
    setModalError("");
    try {
      if (modal.initial) await updateExperience(modal.initial.id, input);
      else await createExperience(input);
      setModal(null);
      setReload((current) => current + 1);
    } catch (cause) {
      setModalError(cause instanceof Error ? cause.message : "Experience gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(experience: ExperienceRecord) {
    setBusyId(experience.id);
    setError("");
    try {
      await setExperienceStatus(experience.id, !experience.isActive);
      setReload((current) => current + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Status experience gagal diubah.");
    } finally {
      setBusyId("");
    }
  }

  const hasFilter = Boolean(search || categoryFilter !== "all" || statusFilter !== "all");

  return (
    <AdminShell title="Admin" context="Experiences">
      <div className="exp-page">
        <div className="exp-heading">
          <div>
            <h1>Experiences</h1>
            <p>Kelola add-on dan pilihan paket untuk reservasi tamu</p>
          </div>
          <button type="button" className="action-button" disabled={!categories.some((category) => category.isActive)}
            onClick={() => { setModalError(""); setModal({ initial: null }); }}>
            <Icon name="plus" />
            <span>+ Add Experience</span>
          </button>
        </div>

        <div className="exp-filter-bar">
          <div className="exp-filter-bar__left">
            <div className="campaigns-search-wrap">
              <Icon name="search" className="campaigns-search-icon" width={16} height={16} />
              <input type="text" className="campaigns-search" placeholder="Search experience..." value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
            </div>
            <div className="campaigns-select-wrap">
              <select className="campaigns-select" value={categoryFilter}
                onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); }}>
                <option value="all">All Types</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              <Icon name="chevron" className="campaigns-select-chevron" width={14} height={14} />
            </div>
            <div className="campaigns-select-wrap">
              <select className="campaigns-select" value={statusFilter}
                onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}>
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <Icon name="chevron" className="campaigns-select-chevron" width={14} height={14} />
            </div>
            {hasFilter && <button type="button" className="campaigns-reset-button"
              onClick={() => { setSearch(""); setCategoryFilter("all"); setStatusFilter("all"); setPage(1); }}>
              <Icon name="reset" width={14} height={14} /><span>Reset</span>
            </button>}
          </div>
          <span className="exp-filter-bar__count">Total <strong>{total}</strong> experiences recorded</span>
        </div>

        {error && <div className="campaigns-api-message" role="alert">{error}</div>}

        <div className="data-panel">
          <div className="table-scroll">
            <table className="exp-table">
              <thead><tr className="exp-table__head-row">
                <th className="exp-table__th exp-table__th--exp">Experience</th>
                <th className="exp-table__th">Category</th>
                <th className="exp-table__th">Packages</th>
                <th className="exp-table__th exp-table__th--right">Price Range</th>
                <th className="exp-table__th">Max Qty</th>
                <th className="exp-table__th exp-table__th--center">Status</th>
                <th className="exp-table__th exp-table__th--right">Action</th>
              </tr></thead>
              <tbody>
                {items.length > 0 ? items.map((experience) => (
                  <tr key={experience.id} className="exp-table__row">
                    <td className="exp-table__td">
                      <div className="exp-name-cell">
                        <span className={`exp-icon-box ${!experience.isActive ? "exp-icon-box--inactive" : experience.category.name.toLowerCase() === "celebrate" ? "exp-icon-box--celebrate" : "exp-icon-box--dining"}`} aria-hidden="true">
                          <Icon name="experiences" width={15} height={15} />
                        </span>
                        <div>
                          <div className="exp-name-cell__name">{experience.name}</div>
                          <div className="exp-name-cell__desc">{experience.description || experience.code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="exp-table__td"><span className={`exp-type-badge exp-type-badge--${experience.category.name.toLowerCase() === "celebrate" ? "celebrate" : "dining"}`}>{experience.category.name}</span></td>
                    <td className="exp-table__td exp-table__td--muted">
                      <strong>{experience.variants.length} package{experience.variants.length === 1 ? "" : "s"}</strong>
                      <span className="exp-variant-summary">{experience.variants.map((variant) => variant.subName).join(", ")}</span>
                    </td>
                    <td className="exp-table__td exp-table__td--right exp-table__td--price">{priceRange(experience)}</td>
                    <td className="exp-table__td exp-table__td--muted">{experience.maxQuantity}</td>
                    <td className="exp-table__td exp-table__td--center">
                      <span className={`exp-status-badge exp-status-badge--${experience.isActive ? "active" : "inactive"}`}>
                        {experience.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="exp-table__td exp-table__td--right">
                      <div className="exp-actions">
                        <button type="button" className="exp-edit-btn" disabled={busyId === experience.id}
                          onClick={() => void openEdit(experience)}>Edit</button>
                        <button type="button" className="text-action" disabled={busyId === experience.id}
                          onClick={() => void toggleStatus(experience)}>
                          {experience.isActive ? "Disable" : "Enable"}
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : <tr><td colSpan={7} className="campaigns-table__empty">
                  {loading ? "Memuat experiences..." : "Tidak ada experience yang sesuai filter."}
                </td></tr>}
              </tbody>
            </table>
          </div>
          <div className="campaigns-pagination">
            <span className="campaigns-pagination__info">
              Showing <strong>{total ? (page - 1) * limit + 1 : 0}–{Math.min(page * limit, total)}</strong> of <strong>{total}</strong> experiences
            </span>
            <div className="campaigns-pagination__controls">
              <button type="button" className="campaigns-pagination__btn" disabled={page <= 1 || loading}
                onClick={() => setPage((current) => current - 1)}>
                <Icon name="chevronLeft" width={14} height={14} /><span>Previous</span>
              </button>
              <button type="button" className="campaigns-pagination__page campaigns-pagination__page--active">{page}</button>
              <button type="button" className="campaigns-pagination__btn" disabled={page * limit >= total || loading}
                onClick={() => setPage((current) => current + 1)}>
                <span>Next</span><Icon name="chevronRight" width={14} height={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="campaigns-notice">
          <Icon name="info" className="campaigns-notice__icon" width={18} height={18} />
          <p><strong>Informasi Operasional:</strong> Harga paket experience disalin ke reservasi saat pemesanan.
            Perubahan harga berikutnya tidak mengubah transaksi sebelumnya.</p>
        </div>
      </div>

      {modal && <ExperienceModal initial={modal.initial} categories={categories} saving={saving}
        error={modalError} onClose={() => setModal(null)} onSave={save} />}
    </AdminShell>
  );
}
