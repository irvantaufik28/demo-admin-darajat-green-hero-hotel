"use client";

import "../styles/gallery-admin.css";

import Image from "next/image";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AdminShell } from "../../../components/layout/AdminShell";
import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { restoreSession } from "../../../lib/auth";
import { useTranslations } from "../../../lib/i18n";
import {
  createGalleryImage,
  deleteGalleryImage,
  galleryCategories,
  listGalleryImages,
  updateGalleryImage,
  uploadGalleryImage,
  type GalleryCategory,
  type GalleryImage,
  type GalleryImageInput,
} from "../services/gallery";
import en from "../locales/en.json";
import id from "../locales/id.json";

type FormState = {
  imageUrl: string;
  cloudinaryPublicId: string | null;
  category: GalleryCategory;
  titleId: string;
  titleEn: string;
  captionId: string;
  captionEn: string;
  altTextId: string;
  altTextEn: string;
  showOnHomepage: boolean;
  sortOrder: string;
  isActive: boolean;
};

const emptyForm: FormState = {
  imageUrl: "",
  cloudinaryPublicId: null,
  category: "resort",
  titleId: "",
  titleEn: "",
  captionId: "",
  captionEn: "",
  altTextId: "",
  altTextEn: "",
  showOnHomepage: false,
  sortOrder: "0",
  isActive: true,
};

const nullable = (value: string) => value.trim() || null;

function toForm(image: GalleryImage): FormState {
  return {
    imageUrl: image.imageUrl,
    cloudinaryPublicId: image.cloudinaryPublicId,
    category: image.category,
    titleId: image.titleId ?? "",
    titleEn: image.titleEn ?? "",
    captionId: image.captionId ?? "",
    captionEn: image.captionEn ?? "",
    altTextId: image.altTextId,
    altTextEn: image.altTextEn,
    showOnHomepage: image.showOnHomepage,
    sortOrder: String(image.sortOrder),
    isActive: image.isActive,
  };
}

function toInput(form: FormState): GalleryImageInput {
  return {
    imageUrl: form.imageUrl,
    cloudinaryPublicId: form.cloudinaryPublicId,
    category: form.category,
    titleId: nullable(form.titleId),
    titleEn: nullable(form.titleEn),
    captionId: nullable(form.captionId),
    captionEn: nullable(form.captionEn),
    altTextId: form.altTextId.trim(),
    altTextEn: form.altTextEn.trim(),
    showOnHomepage: form.showOnHomepage,
    sortOrder: Math.max(0, Number(form.sortOrder) || 0),
    isActive: form.isActive,
  };
}

export function GalleryAdminPage() {
  const { t } = useTranslations({ en, id });
  const [items, setItems] = useState<GalleryImage[]>([]);
  const [filter, setFilter] = useState<"all" | GalleryCategory>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        if (!(await restoreSession())) return;
        const result = await listGalleryImages(controller.signal);
        if (!controller.signal.aborted) setItems(result.items);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Gallery could not be loaded.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  const visibleItems = useMemo(
    () =>
      filter === "all"
        ? items
        : items.filter((item) => item.category === filter),
    [filter, items],
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
    setNotice("");
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
    setError("");
    setNotice("");
  }

  function openEdit(image: GalleryImage) {
    setEditingId(image.id);
    setForm(toForm(image));
    setFormOpen(true);
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function upload(file?: File) {
    if (!file || uploading) return;
    setUploading(true);
    setError("");
    try {
      const asset = await uploadGalleryImage(file);
      setForm((current) => ({
        ...current,
        imageUrl: asset.url,
        cloudinaryPublicId: asset.publicId,
      }));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t("galleryAdmin.uploadError"),
      );
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || uploading) return;
    if (!form.imageUrl || !form.altTextId.trim() || !form.altTextEn.trim()) {
      setError(t("galleryAdmin.requiredError"));
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = editingId
        ? await updateGalleryImage(editingId, toInput(form))
        : await createGalleryImage(toInput(form));
      setItems((current) => {
        const next = editingId
          ? current.map((item) =>
              item.id === result.image.id ? result.image : item,
            )
          : [...current, result.image];
        return next.sort(
          (left, right) => left.sortOrder - right.sortOrder,
        );
      });
      setFormOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setNotice(t(editingId ? "galleryAdmin.updated" : "galleryAdmin.created"));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t("galleryAdmin.saveError"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(image: GalleryImage) {
    if (!window.confirm(t("galleryAdmin.deleteConfirm", { name: image.titleId || image.altTextId }))) return;
    setDeletingId(image.id);
    setError("");
    setNotice("");
    try {
      await deleteGalleryImage(image.id);
      setItems((current) => current.filter((item) => item.id !== image.id));
      setNotice(t("galleryAdmin.deleted"));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t("galleryAdmin.deleteError"),
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AdminShell title={t("galleryAdmin.context")} context={t("galleryAdmin.title")}>
      <div className="gallery-admin-page">
        <header className="gallery-admin-header">
          <div>
            <span>{t("galleryAdmin.eyebrow")}</span>
            <h1>{t("galleryAdmin.title")}</h1>
            <p>{t("galleryAdmin.description")}</p>
          </div>
          <button type="button" className="action-button" onClick={openCreate}>
            ＋ {t("galleryAdmin.add")}
          </button>
        </header>

        {error && <p className="gallery-admin-message gallery-admin-message--error" role="alert">{error}</p>}
        {notice && <p className="gallery-admin-message gallery-admin-message--success" role="status">{notice}</p>}

        {formOpen && (
          <form className="gallery-admin-form" onSubmit={submit}>
            <div className="gallery-admin-form-heading">
              <div>
                <h2>{t(editingId ? "galleryAdmin.editTitle" : "galleryAdmin.createTitle")}</h2>
                <p>{t("galleryAdmin.formDescription")}</p>
              </div>
              <button type="button" className="gallery-admin-secondary" onClick={() => setFormOpen(false)}>{t("galleryAdmin.cancel")}</button>
            </div>

            <div className="gallery-admin-form-grid">
              <div className="gallery-admin-upload">
                {form.imageUrl ? (
                  <Image src={form.imageUrl} alt={form.altTextId || t("galleryAdmin.preview")} width={520} height={320} unoptimized />
                ) : (
                  <div>{t("galleryAdmin.noImage")}</div>
                )}
                <label className="gallery-admin-secondary">
                  {uploading ? t("galleryAdmin.uploading") : form.imageUrl ? t("galleryAdmin.replaceImage") : t("galleryAdmin.chooseImage")}
                  <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading || saving} onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = ""; }} />
                </label>
                <small>{t("galleryAdmin.uploadHint")}</small>
              </div>

              <div className="gallery-admin-fields">
                <label><span>{t("galleryAdmin.fields.category")}</span><select value={form.category} onChange={(event) => update("category", event.target.value as GalleryCategory)}>{galleryCategories.map((category) => <option key={category} value={category}>{t(`galleryAdmin.categories.${category}`)}</option>)}</select></label>
                <label><span>{t("galleryAdmin.fields.sortOrder")}</span><input type="number" min="0" max="100000" value={form.sortOrder} onChange={(event) => update("sortOrder", event.target.value)} /></label>
                <label><span>{t("galleryAdmin.fields.titleId")}</span><input value={form.titleId} maxLength={160} onChange={(event) => update("titleId", event.target.value)} /></label>
                <label><span>{t("galleryAdmin.fields.titleEn")}</span><input value={form.titleEn} maxLength={160} onChange={(event) => update("titleEn", event.target.value)} /></label>
                <label><span>{t("galleryAdmin.fields.altId")} *</span><input required value={form.altTextId} maxLength={255} onChange={(event) => update("altTextId", event.target.value)} /></label>
                <label><span>{t("galleryAdmin.fields.altEn")} *</span><input required value={form.altTextEn} maxLength={255} onChange={(event) => update("altTextEn", event.target.value)} /></label>
                <label className="gallery-admin-span-2"><span>{t("galleryAdmin.fields.captionId")}</span><textarea rows={3} value={form.captionId} onChange={(event) => update("captionId", event.target.value)} /></label>
                <label className="gallery-admin-span-2"><span>{t("galleryAdmin.fields.captionEn")}</span><textarea rows={3} value={form.captionEn} onChange={(event) => update("captionEn", event.target.value)} /></label>
                <div className="gallery-admin-checks gallery-admin-span-2">
                  <label><input type="checkbox" checked={form.isActive} onChange={(event) => update("isActive", event.target.checked)} />{t("galleryAdmin.fields.active")}</label>
                  <label><input type="checkbox" checked={form.showOnHomepage} onChange={(event) => update("showOnHomepage", event.target.checked)} />{t("galleryAdmin.fields.homepage")}</label>
                </div>
                <div className="gallery-admin-form-actions gallery-admin-span-2">
                  <button type="button" className="gallery-admin-secondary" disabled={saving || uploading} onClick={() => setFormOpen(false)}>{t("galleryAdmin.cancel")}</button>
                  <button type="submit" className="action-button" disabled={saving || uploading}>{saving ? t("galleryAdmin.saving") : t("galleryAdmin.save")}</button>
                </div>
              </div>
            </div>
          </form>
        )}

        <section className="gallery-admin-panel">
          <div className="gallery-admin-toolbar">
            <div>
              <h2>{t("galleryAdmin.listTitle")}</h2>
              <p>{t("galleryAdmin.total", { count: visibleItems.length })}</p>
            </div>
            <select value={filter} onChange={(event) => setFilter(event.target.value as "all" | GalleryCategory)} aria-label={t("galleryAdmin.filterLabel")}>
              <option value="all">{t("galleryAdmin.allCategories")}</option>
              {galleryCategories.map((category) => <option key={category} value={category}>{t(`galleryAdmin.categories.${category}`)}</option>)}
            </select>
          </div>

          {loading ? <LoadingSkeleton variant="table" rows={5} /> : visibleItems.length === 0 ? (
            <p className="gallery-admin-empty">{t("galleryAdmin.empty")}</p>
          ) : (
            <div className="gallery-admin-grid">
              {visibleItems.map((image) => (
                <article className="gallery-admin-card" key={image.id}>
                  <div className="gallery-admin-card-image"><Image src={image.imageUrl} alt={image.altTextId} fill sizes="(max-width: 760px) 100vw, 300px" unoptimized /><span>{t(`galleryAdmin.categories.${image.category}`)}</span></div>
                  <div className="gallery-admin-card-body">
                    <div><h3>{image.titleId || image.altTextId}</h3><small>#{image.sortOrder}</small></div>
                    <p>{image.captionId || image.altTextId}</p>
                    <div className="gallery-admin-badges">
                      <span className={image.isActive ? "is-active" : "is-inactive"}>{t(image.isActive ? "galleryAdmin.active" : "galleryAdmin.inactive")}</span>
                      {image.showOnHomepage && <span>{t("galleryAdmin.homepage")}</span>}
                    </div>
                    <div className="gallery-admin-card-actions">
                      <button type="button" className="gallery-admin-secondary" onClick={() => openEdit(image)}>{t("galleryAdmin.edit")}</button>
                      <button type="button" className="gallery-admin-delete" disabled={deletingId === image.id} onClick={() => void remove(image)}>{deletingId === image.id ? t("galleryAdmin.deleting") : t("galleryAdmin.delete")}</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
