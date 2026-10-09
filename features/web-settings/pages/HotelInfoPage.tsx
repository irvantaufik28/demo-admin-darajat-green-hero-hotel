"use client";

import "../styles/hotel-info.css";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import { AdminShell } from "../../../components/layout/AdminShell";
import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { restoreSession } from "../../../lib/auth";
import { useTranslations } from "../../../lib/i18n";
import {
  getHotelInfo,
  saveHotelInfo,
  uploadHotelAsset,
  type HotelInfo,
  type HotelInfoInput,
} from "../services/hotel-info";
import en from "../locales/en.json";
import id from "../locales/id.json";

type FormState = {
  name: string;
  shortDescription: string;
  description: string;
  address: string;
  district: string;
  city: string;
  province: string;
  postalCode: string;
  googleMapsUrl: string;
  latitude: string;
  longitude: string;
  phone: string;
  whatsappNumber: string;
  email: string;
  logoUrl: string;
  faviconUrl: string;
  logoPublicId: string | null;
  faviconPublicId: string | null;
};

const emptyForm: FormState = {
  name: "",
  shortDescription: "",
  description: "",
  address: "",
  district: "",
  city: "",
  province: "",
  postalCode: "",
  googleMapsUrl: "",
  latitude: "",
  longitude: "",
  phone: "",
  whatsappNumber: "",
  email: "",
  logoUrl: "",
  faviconUrl: "",
  logoPublicId: null,
  faviconPublicId: null,
};

const text = (value: string) => value.trim() || null;

function fromHotel(hotel: HotelInfo | null): FormState {
  if (!hotel) return emptyForm;
  return {
    name: hotel.name,
    shortDescription: hotel.shortDescription ?? "",
    description: hotel.description ?? "",
    address: hotel.address,
    district: hotel.district ?? "",
    city: hotel.city,
    province: hotel.province,
    postalCode: hotel.postalCode ?? "",
    googleMapsUrl: hotel.googleMapsUrl ?? "",
    latitude: hotel.latitude ?? "",
    longitude: hotel.longitude ?? "",
    phone: hotel.phone ?? "",
    whatsappNumber: hotel.whatsappNumber ?? "",
    email: hotel.email ?? "",
    logoUrl: hotel.logoUrl ?? "",
    faviconUrl: hotel.faviconUrl ?? "",
    logoPublicId: hotel.logoPublicId,
    faviconPublicId: hotel.faviconPublicId,
  };
}

function payload(form: FormState): HotelInfoInput {
  return {
    name: form.name.trim(),
    shortDescription: text(form.shortDescription),
    description: text(form.description),
    address: form.address.trim(),
    district: text(form.district),
    city: form.city.trim(),
    province: form.province.trim(),
    postalCode: text(form.postalCode),
    googleMapsUrl: text(form.googleMapsUrl),
    latitude: form.latitude.trim() ? Number(form.latitude) : null,
    longitude: form.longitude.trim() ? Number(form.longitude) : null,
    phone: text(form.phone),
    whatsappNumber: text(form.whatsappNumber),
    email: text(form.email),
    logoUrl: text(form.logoUrl),
    logoPublicId: form.logoPublicId,
    faviconUrl: text(form.faviconUrl),
    faviconPublicId: form.faviconPublicId,
  };
}

export function HotelInfoPage() {
  const { t } = useTranslations({ en, id });
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saved, setSaved] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "favicon" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        if (!(await restoreSession())) return;
        const response = await getHotelInfo(controller.signal);
        if (controller.signal.aborted) return;
        const next = fromHotel(response.data?.hotel ?? null);
        setForm(next);
        setSaved(next);
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "Hotel info could not be loaded.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(saved),
    [form, saved],
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
    setNotice("");
  }

  async function uploadAsset(kind: "logo" | "favicon", file?: File) {
    if (!file || uploading) return;
    setUploading(kind);
    setError("");
    setNotice("");
    try {
      const asset = await uploadHotelAsset(file);
      setForm((current) =>
        kind === "logo"
          ? { ...current, logoUrl: asset.url, logoPublicId: asset.publicId }
          : {
              ...current,
              faviconUrl: asset.url,
              faviconPublicId: asset.publicId,
            },
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t("hotelInfo.uploadError"),
      );
    } finally {
      setUploading(null);
    }
  }

  function removeAsset(kind: "logo" | "favicon") {
    setForm((current) =>
      kind === "logo"
        ? { ...current, logoUrl: "", logoPublicId: null }
        : { ...current, faviconUrl: "", faviconPublicId: null },
    );
    setError("");
    setNotice("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || loading || uploading) return;
    if (
      !form.name.trim() ||
      !form.address.trim() ||
      !form.city.trim() ||
      !form.province.trim()
    ) {
      setError(t("hotelInfo.requiredError"));
      return;
    }
    if (Boolean(form.latitude.trim()) !== Boolean(form.longitude.trim())) {
      setError(t("hotelInfo.coordinatesError"));
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await saveHotelInfo(payload(form));
      const next = fromHotel(response.data?.hotel ?? null);
      setForm(next);
      setSaved(next);
      setNotice(t("hotelInfo.saved"));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t("hotelInfo.saveError"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell title={t("hotelInfo.context")} context={t("hotelInfo.title")}>
      <form className="hotel-info-page" onSubmit={submit}>
        <header className="hotel-info-header">
          <div>
            <span>{t("hotelInfo.eyebrow")}</span>
            <h1>{t("hotelInfo.title")}</h1>
            <p>{t("hotelInfo.description")}</p>
          </div>
          <div className="hotel-info-actions">
            {dirty && <small>● {t("hotelInfo.unsaved")}</small>}
            <button
              type="button"
              className="hotel-info-secondary"
              disabled={!dirty || saving || Boolean(uploading)}
              onClick={() => {
                setForm(saved);
                setError("");
                setNotice("");
              }}
            >
              {t("hotelInfo.reset")}
            </button>
            <button
              type="submit"
              className="action-button"
              disabled={!dirty || saving || loading || Boolean(uploading)}
            >
              {saving ? t("hotelInfo.saving") : t("hotelInfo.save")}
            </button>
          </div>
        </header>

        {error && (
          <p
            className="hotel-info-message hotel-info-message--error"
            role="alert"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            className="hotel-info-message hotel-info-message--success"
            role="status"
          >
            {notice}
          </p>
        )}
        {loading ? (
          <LoadingSkeleton variant="form" rows={8} />
        ) : (
          <>
            <section className="hotel-info-card">
              <div className="hotel-info-card-heading">
                <h2>{t("hotelInfo.identity.title")}</h2>
                <p>{t("hotelInfo.identity.description")}</p>
              </div>
              <div className="hotel-info-grid">
                <label className="hotel-info-span-2">
                  <span>{t("hotelInfo.fields.name")} *</span>
                  <input
                    value={form.name}
                    maxLength={160}
                    onChange={(event) => update("name", event.target.value)}
                  />
                </label>
                <label className="hotel-info-span-2">
                  <span>{t("hotelInfo.fields.shortDescription")}</span>
                  <input
                    value={form.shortDescription}
                    maxLength={300}
                    onChange={(event) =>
                      update("shortDescription", event.target.value)
                    }
                  />
                </label>
                <label className="hotel-info-span-2">
                  <span>{t("hotelInfo.fields.description")}</span>
                  <textarea
                    rows={5}
                    value={form.description}
                    onChange={(event) =>
                      update("description", event.target.value)
                    }
                  />
                </label>
              </div>
            </section>

            <section className="hotel-info-card">
              <div className="hotel-info-card-heading">
                <h2>{t("hotelInfo.location.title")}</h2>
                <p>{t("hotelInfo.location.description")}</p>
              </div>
              <div className="hotel-info-grid">
                <label className="hotel-info-span-2">
                  <span>{t("hotelInfo.fields.address")} *</span>
                  <textarea
                    rows={3}
                    value={form.address}
                    onChange={(event) => update("address", event.target.value)}
                  />
                </label>
                <label>
                  <span>{t("hotelInfo.fields.district")}</span>
                  <input
                    value={form.district}
                    maxLength={120}
                    onChange={(event) => update("district", event.target.value)}
                  />
                </label>
                <label>
                  <span>{t("hotelInfo.fields.city")} *</span>
                  <input
                    value={form.city}
                    maxLength={120}
                    onChange={(event) => update("city", event.target.value)}
                  />
                </label>
                <label>
                  <span>{t("hotelInfo.fields.province")} *</span>
                  <input
                    value={form.province}
                    maxLength={120}
                    onChange={(event) => update("province", event.target.value)}
                  />
                </label>
                <label>
                  <span>{t("hotelInfo.fields.postalCode")}</span>
                  <input
                    value={form.postalCode}
                    maxLength={12}
                    onChange={(event) =>
                      update("postalCode", event.target.value)
                    }
                  />
                </label>
                <label className="hotel-info-span-2">
                  <span>{t("hotelInfo.fields.googleMapsUrl")}</span>
                  <input
                    type="url"
                    value={form.googleMapsUrl}
                    onChange={(event) =>
                      update("googleMapsUrl", event.target.value)
                    }
                  />
                </label>
                <label>
                  <span>{t("hotelInfo.fields.latitude")}</span>
                  <input
                    type="number"
                    step="any"
                    min="-90"
                    max="90"
                    value={form.latitude}
                    onChange={(event) => update("latitude", event.target.value)}
                  />
                </label>
                <label>
                  <span>{t("hotelInfo.fields.longitude")}</span>
                  <input
                    type="number"
                    step="any"
                    min="-180"
                    max="180"
                    value={form.longitude}
                    onChange={(event) =>
                      update("longitude", event.target.value)
                    }
                  />
                </label>
              </div>
            </section>

            <section className="hotel-info-card">
              <div className="hotel-info-card-heading">
                <h2>{t("hotelInfo.contact.title")}</h2>
                <p>{t("hotelInfo.contact.description")}</p>
              </div>
              <div className="hotel-info-grid">
                <label>
                  <span>{t("hotelInfo.fields.phone")}</span>
                  <input
                    type="tel"
                    value={form.phone}
                    maxLength={30}
                    onChange={(event) => update("phone", event.target.value)}
                  />
                </label>
                <label>
                  <span>{t("hotelInfo.fields.whatsapp")}</span>
                  <input
                    type="tel"
                    value={form.whatsappNumber}
                    maxLength={30}
                    onChange={(event) =>
                      update("whatsappNumber", event.target.value)
                    }
                  />
                </label>
                <label className="hotel-info-span-2">
                  <span>{t("hotelInfo.fields.email")}</span>
                  <input
                    type="email"
                    value={form.email}
                    maxLength={254}
                    onChange={(event) => update("email", event.target.value)}
                  />
                </label>
              </div>
            </section>

            <section className="hotel-info-card">
              <div className="hotel-info-card-heading">
                <h2>{t("hotelInfo.branding.title")}</h2>
                <p>{t("hotelInfo.branding.description")}</p>
              </div>
              <div className="hotel-info-grid">
                <div className="hotel-info-upload-field">
                  <span>{t("hotelInfo.fields.logo")}</span>
                  {form.logoUrl ? (
                    <Image
                      className="hotel-info-logo-preview"
                      src={form.logoUrl}
                      alt={t("hotelInfo.logoPreview")}
                      width={220}
                      height={90}
                      unoptimized
                    />
                  ) : (
                    <div className="hotel-info-upload-empty">
                      {t("hotelInfo.noLogo")}
                    </div>
                  )}
                  <div className="hotel-info-upload-actions">
                    <label className="hotel-info-upload-button">
                      {uploading === "logo"
                        ? t("hotelInfo.uploading")
                        : form.logoUrl
                          ? t("hotelInfo.replaceFile")
                          : t("hotelInfo.chooseFile")}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={Boolean(uploading)}
                        onChange={(event) => {
                          void uploadAsset("logo", event.target.files?.[0]);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                    {form.logoUrl && (
                      <button
                        type="button"
                        disabled={Boolean(uploading)}
                        onClick={() => removeAsset("logo")}
                      >
                        {t("hotelInfo.removeFile")}
                      </button>
                    )}
                  </div>
                  <small>{t("hotelInfo.logoHint")}</small>
                </div>
                <div className="hotel-info-upload-field">
                  <span>{t("hotelInfo.fields.favicon")}</span>
                  {form.faviconUrl ? (
                    <Image
                      className="hotel-info-favicon-preview"
                      src={form.faviconUrl}
                      alt={t("hotelInfo.faviconPreview")}
                      width={54}
                      height={54}
                      unoptimized
                    />
                  ) : (
                    <div className="hotel-info-upload-empty hotel-info-upload-empty--favicon">
                      {t("hotelInfo.noFavicon")}
                    </div>
                  )}
                  <div className="hotel-info-upload-actions">
                    <label className="hotel-info-upload-button">
                      {uploading === "favicon"
                        ? t("hotelInfo.uploading")
                        : form.faviconUrl
                          ? t("hotelInfo.replaceFile")
                          : t("hotelInfo.chooseFile")}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={Boolean(uploading)}
                        onChange={(event) => {
                          void uploadAsset("favicon", event.target.files?.[0]);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                    {form.faviconUrl && (
                      <button
                        type="button"
                        disabled={Boolean(uploading)}
                        onClick={() => removeAsset("favicon")}
                      >
                        {t("hotelInfo.removeFile")}
                      </button>
                    )}
                  </div>
                  <small>{t("hotelInfo.faviconHint")}</small>
                </div>
              </div>
            </section>
          </>
        )}
      </form>
    </AdminShell>
  );
}
