"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "../../../components/ui/Icon";
import type {
  ExperienceCategory,
  ExperienceInput,
  ExperienceRecord,
} from "../services/experiences";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

type VariantDraft = { key: string; subName: string; description: string; price: string };
type Draft = Omit<ExperienceInput, "variants"> & { variants: VariantDraft[] };

type Props = {
  initial: ExperienceRecord | null;
  categories: ExperienceCategory[];
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: (input: ExperienceInput) => Promise<void>;
};

function slugify(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
}

function codeFromName(value: string) {
  return slugify(value).replace(/-/g, "_").toUpperCase();
}

function initialDraft(initial: ExperienceRecord | null): Draft {
  return initial
    ? {
        categoryId: initial.categoryId,
        code: initial.code,
        slug: initial.slug,
        name: initial.name,
        description: initial.description,
        maxQuantity: initial.maxQuantity,
        imageUrl: initial.imageUrl,
        isActive: initial.isActive,
        variants: initial.variants.map((variant) => ({
          key: variant.id,
          subName: variant.subName,
          description: variant.description ?? "",
          price: String(variant.price),
        })),
      }
    : {
        categoryId: "",
        code: "",
        slug: "",
        name: "",
        description: "",
        maxQuantity: 1,
        imageUrl: null,
        isActive: true,
        variants: [{ key: "first", subName: "", description: "", price: "" }],
      };
}

export function ExperienceModal({ initial, categories, saving, error, onClose, onSave }: Props) {
  const { t } = useTranslations({ en, id });
  const [form, setForm] = useState<Draft>(() => initialDraft(initial));
  const [validation, setValidation] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setForm(initialDraft(initial));
    setValidation("");
  }, [initial]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  function setName(name: string) {
    setForm((current) => ({
      ...current,
      name,
      code: !current.code || current.code === codeFromName(current.name)
        ? codeFromName(name) : current.code,
      slug: !current.slug || current.slug === slugify(current.name)
        ? slugify(name) : current.slug,
    }));
  }

  function updateVariant(key: string, field: "subName" | "description" | "price", value: string) {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant) => variant.key === key
        ? { ...variant, [field]: value } : variant),
    }));
  }

  function submit() {
    setValidation("");
    if (!form.name.trim() || !form.categoryId || !form.code.trim() || !form.slug.trim()) {
      setValidation(t("modal.validation.requireBasics"));
      return;
    }
    if (form.variants.some((variant) => !variant.subName.trim() || variant.price.trim() === "")) {
      setValidation(t("modal.validation.requirePackageNameAndPrice"));
      return;
    }
    const names = form.variants.map((variant) => variant.subName.trim().toLowerCase());
    if (new Set(names).size !== names.length) {
      setValidation(t("modal.validation.duplicatePackageName"));
      return;
    }
    if (form.variants.some((variant) => !Number.isSafeInteger(Number(variant.price)) || Number(variant.price) < 0)) {
      setValidation(t("modal.validation.invalidPrice"));
      return;
    }
    void onSave({
      categoryId: form.categoryId,
      code: form.code.trim(),
      slug: form.slug.trim(),
      name: form.name.trim(),
      description: form.description?.trim() || null,
      maxQuantity: form.maxQuantity,
      imageUrl: form.imageUrl?.trim() || null,
      isActive: form.isActive,
      variants: form.variants.map((variant) => ({
        subName: variant.subName.trim(),
        description: variant.description.trim() || null,
        price: Number(variant.price),
      })),
    });
  }

  return (
    <div
      className="exp-modal-overlay"
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={initial ? t("modal.titleEdit") : t("modal.titleAdd")}
      onClick={(event) => { if (event.target === overlayRef.current && !saving) onClose(); }}
    >
      <div className="exp-modal exp-modal--variants">
        <div className="exp-modal__header">
          <div className="exp-modal__header-left">
            <Icon name="experiences" width={18} height={18} className="exp-modal__header-icon" />
            <h3>{initial ? t("modal.titleEdit") : t("modal.titleAdd")}</h3>
          </div>
          <button type="button" className="exp-modal__close" disabled={saving} onClick={onClose} aria-label={t("modal.closeAria")}>
            <Icon name="close" width={18} height={18} />
          </button>
        </div>

        <div className="exp-modal__body">
          <div className="exp-modal-field">
            <label className="exp-modal-label" htmlFor="exp-name">{t("modal.fields.experienceName")} <span className="exp-required">{t("modal.required")}</span></label>
            <input id="exp-name" className="exp-modal-input" value={form.name} onChange={(event) => setName(event.target.value)} placeholder={t("modal.fields.experienceNamePlaceholder")} />
          </div>

          <div className="exp-modal-field">
            <span className="exp-modal-label">{t("modal.fields.typeCategory")} <span className="exp-required">{t("modal.required")}</span></span>
            <div className="exp-type-grid">
              {categories.map((category) => (
                <label key={category.id} className={form.categoryId === category.id ? "exp-type-option exp-type-option--active" : "exp-type-option"}>
                  <input type="radio" className="exp-radio" name="exp-category" checked={form.categoryId === category.id}
                    disabled={!category.isActive && form.categoryId !== category.id}
                    onChange={() => setForm((current) => ({ ...current, categoryId: category.id }))} />
                  <div>
                    <div className="exp-type-option__title">{category.name}</div>
                    {!category.isActive && <div className="exp-type-option__sub">{t("modal.fields.inactive")}</div>}
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="exp-modal-field">
            <label className="exp-modal-label" htmlFor="exp-description">{t("modal.fields.shortDescription")}</label>
            <textarea id="exp-description" className="exp-modal-textarea" rows={2} value={form.description ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          </div>

          <div className="exp-modal-field">
            <div className="exp-variants-heading">
              <div><span className="exp-modal-label">{t("modal.fields.packagesAndPrices")} <span className="exp-required">{t("modal.required")}</span></span>
                <p>{t("modal.fields.packagesHint")}</p></div>
              <button type="button" className="cf-add-blackout" disabled={form.variants.length >= 100}
                onClick={() => setForm((current) => ({ ...current, variants: [...current.variants, { key: crypto.randomUUID(), subName: "", description: "", price: "" }] }))}>
                <Icon name="plus" width={14} height={14} /> {t("modal.fields.addPackage")}
              </button>
            </div>
            <div className="exp-variants-list">
              {form.variants.map((variant, index) => (
                <div className="exp-variant-card" key={variant.key}>
                  <div className="exp-variant-card__heading">
                    <strong>{t("modal.fields.packageHeading", { index: index + 1 })}</strong>
                    <button type="button" className="exp-variant-remove" aria-label={t("modal.fields.removePackageAria", { index: index + 1 })}
                      disabled={form.variants.length === 1}
                      onClick={() => setForm((current) => ({ ...current, variants: current.variants.filter((item) => item.key !== variant.key) }))}>
                      <Icon name="trash" width={15} height={15} />
                    </button>
                  </div>
                  <div className="exp-modal-2col">
                    <div className="exp-modal-field">
                      <label className="exp-modal-label" htmlFor={`exp-variant-name-${variant.key}`}>{t("modal.fields.packageName")}</label>
                      <input id={`exp-variant-name-${variant.key}`} className="exp-modal-input" value={variant.subName}
                        onChange={(event) => updateVariant(variant.key, "subName", event.target.value)} placeholder={t("modal.fields.packageNamePlaceholder")} />
                    </div>
                    <div className="exp-modal-field">
                      <label className="exp-modal-label" htmlFor={`exp-variant-price-${variant.key}`}>{t("modal.fields.price")}</label>
                      <div className="exp-price-wrap"><span className="exp-price-prefix">Rp</span>
                        <input id={`exp-variant-price-${variant.key}`} className="exp-modal-input exp-modal-input--price"
                          type="number" min={0} value={variant.price} placeholder={t("modal.fields.pricePlaceholder")}
                          onChange={(event) => updateVariant(variant.key, "price", event.target.value)} />
                      </div>
                    </div>
                  </div>
                  <div className="exp-modal-field">
                    <label className="exp-modal-label" htmlFor={`exp-variant-desc-${variant.key}`}>{t("modal.fields.description")}</label>
                    <textarea id={`exp-variant-desc-${variant.key}`} className="exp-modal-textarea" rows={2}
                      value={variant.description} onChange={(event) => updateVariant(variant.key, "description", event.target.value)}
                      placeholder={t("modal.fields.descriptionPlaceholder")} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="exp-modal-2col">
            <div className="exp-modal-field">
              <label className="exp-modal-label" htmlFor="exp-max-quantity">{t("modal.fields.maxQuantity")}</label>
              <input id="exp-max-quantity" className="exp-modal-input" type="number" min={1} max={32767}
                value={form.maxQuantity} onChange={(event) => setForm((current) => ({ ...current, maxQuantity: Math.max(1, Number(event.target.value)) }))} />
            </div>
            <div className="exp-modal-field">
              <label className="exp-modal-label" htmlFor="exp-image-url">{t("modal.fields.imageUrl")}</label>
              <input id="exp-image-url" className="exp-modal-input" value={form.imageUrl ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))} placeholder={t("modal.fields.imageUrlPlaceholder")} />
            </div>
          </div>

          <div className="exp-modal-2col">
            <div className="exp-modal-field">
              <label className="exp-modal-label" htmlFor="exp-code">{t("modal.fields.code")}</label>
              <input id="exp-code" className="exp-modal-input" maxLength={120} value={form.code}
                onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} />
            </div>
            <div className="exp-modal-field">
              <label className="exp-modal-label" htmlFor="exp-slug">{t("modal.fields.slug")}</label>
              <input id="exp-slug" className="exp-modal-input" maxLength={120} value={form.slug}
                onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} />
            </div>
          </div>

          <div className="exp-modal-field">
            <span className="exp-modal-label">{t("modal.fields.status")}</span>
            <div className="exp-status-row">
              {[true, false].map((active) => (
                <label className="exp-status-radio-label" key={String(active)}>
                  <input type="radio" className="exp-radio" name="exp-status" checked={form.isActive === active}
                    onChange={() => setForm((current) => ({ ...current, isActive: active }))} />
                  <span className={`exp-status-badge exp-status-badge--${active ? "active" : "inactive"}`}>
                    {active ? t("modal.fields.statusActive") : t("modal.fields.statusInactive")}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="exp-modal__footer">
          {(validation || error) && <span className="exp-modal-error" role="alert">{validation || error}</span>}
          <button type="button" className="exp-btn-cancel" disabled={saving} onClick={onClose}>{t("modal.actions.cancel")}</button>
          <button type="button" className="exp-btn-save" disabled={saving} onClick={submit}>
            {saving ? t("modal.actions.saving") : initial ? t("modal.actions.saveChanges") : t("modal.actions.saveExperience")}
          </button>
        </div>
      </div>
    </div>
  );
}
