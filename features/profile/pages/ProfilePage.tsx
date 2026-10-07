"use client";
import "../../settings/styles/settings.css";
import "../styles/profile.css";

import Link from "next/link";
import { useEffect, useState, type ChangeEvent } from "react";
import { AdminShell } from "../../../components/layout/AdminShell";
import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { restoreSession } from "../../../lib/auth";
import { useTranslations } from "../../../lib/i18n";
import {
  getProfile,
  updateProfile,
  uploadProfilePhoto,
  type Profile,
} from "../services/profile";
import en from "../locales/en.json";
import id from "../locales/id.json";

function initialsOf(name: string): string {
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "GH"
  );
}

export function ProfilePage() {
  const { t } = useTranslations({ en, id });
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        if (!(await restoreSession())) return;
        const data = await getProfile(controller.signal);
        if (!controller.signal.aborted) setProfile(data);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setProfile(null);
          setError(cause instanceof Error ? cause.message : t("profile.states.loadFailed"));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [reloadKey]);

  async function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
      setPhotoError(t("profile.photo.error"));
      return;
    }
    setPhotoError("");
    setPhotoBusy(true);
    try {
      const url = await uploadProfilePhoto(file);
      const updated = await updateProfile({ photoUrl: url });
      setProfile(updated);
    } catch (cause) {
      setPhotoError(cause instanceof Error ? cause.message : t("profile.photo.uploadFailed"));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    setPhotoError("");
    setPhotoBusy(true);
    try {
      const updated = await updateProfile({ photoUrl: null });
      setProfile(updated);
    } catch (cause) {
      setPhotoError(cause instanceof Error ? cause.message : t("profile.photo.removeFailed"));
    } finally {
      setPhotoBusy(false);
    }
  }

  const empty = t("profile.states.empty");

  return (
    <AdminShell title={t("shell.title")} context={t("shell.profileContext")}>
      <main className="account-page">
        <header>
          <h1>{profile?.name ?? empty}</h1>
          <p>{t("profile.description")}</p>
        </header>

        {loading && <LoadingSkeleton variant="detail" />}

        {!loading && error && (
          <div className="roles-notice" role="alert">
            {error}{" "}
            <button type="button" onClick={() => setReloadKey((value) => value + 1)}>
              {t("profile.states.retry")}
            </button>
          </div>
        )}

        {!loading && !error && profile && (
          <>
            <section className="account-panel">
              <div className="account-owner-header">
                <div className="account-owner-photo">
                  {profile.photoUrl ? (
                    <img src={profile.photoUrl} alt={t("profile.photo.alt")} />
                  ) : (
                    <span aria-hidden="true">{initialsOf(profile.name)}</span>
                  )}
                </div>
                <div className="account-owner-identity">
                  <h2>{profile.name}</h2>
                  <span>{profile.roleName}</span>
                  <div className="account-photo-actions">
                    <input
                      id="owner-photo-upload"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={selectPhoto}
                      disabled={photoBusy}
                    />
                    <label htmlFor="owner-photo-upload">
                      {photoBusy ? t("profile.photo.uploading") : t("profile.photo.upload")}
                    </label>
                    {profile.photoUrl && !photoBusy && (
                      <button type="button" onClick={removePhoto}>
                        {t("profile.photo.remove")}
                      </button>
                    )}
                  </div>
                  <small>{t("profile.photo.hint")}</small>
                  {photoError && (
                    <small className="account-photo-error" role="alert">
                      {photoError}
                    </small>
                  )}
                </div>
              </div>
            </section>

            <section className="account-panel">
              <div className="account-panel__heading">
                <h2>{t("profile.personalInformation.title")}</h2>
              </div>
              <dl className="account-details">
                <div>
                  <dt>{t("profile.personalInformation.fullName")}</dt>
                  <dd>{profile.name}</dd>
                </div>
                <div>
                  <dt>{t("profile.personalInformation.role")}</dt>
                  <dd>{profile.roleName}</dd>
                </div>
                <div>
                  <dt>{t("profile.personalInformation.email")}</dt>
                  <dd>{profile.email}</dd>
                </div>
                <div>
                  <dt>{t("profile.personalInformation.phone")}</dt>
                  <dd>{profile.phone || empty}</dd>
                </div>
                <div>
                  <dt>{t("profile.personalInformation.property")}</dt>
                  <dd>{t("profile.personalInformation.propertyValue")}</dd>
                </div>
                <div>
                  <dt>{t("profile.personalInformation.location")}</dt>
                  <dd>{t("profile.personalInformation.locationValue")}</dd>
                </div>
              </dl>
            </section>

            <section className="account-panel">
              <div className="account-panel__heading">
                <h2>{t("profile.accountAccess.title")}</h2>
              </div>
              <dl className="account-details">
                <div>
                  <dt>{t("profile.accountAccess.username")}</dt>
                  <dd>{profile.username || empty}</dd>
                </div>
                <div>
                  <dt>{t("profile.accountAccess.status")}</dt>
                  <dd>
                    <span
                      className={
                        profile.isActive
                          ? "users-status users-status--active"
                          : "users-status users-status--inactive"
                      }
                    >
                      {profile.isActive ? t("profile.status.active") : t("profile.status.inactive")}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>{t("profile.accountAccess.lastLogin")}</dt>
                  <dd>{profile.lastLoginAt ?? empty}</dd>
                </div>
                <div>
                  <dt>{t("profile.accountAccess.access")}</dt>
                  <dd>{t("profile.accountAccess.accessValue")}</dd>
                </div>
              </dl>
              <div className="account-profile-footer">
                <Link href="/change-password">{t("profile.changePassword")}</Link>
              </div>
            </section>
          </>
        )}
      </main>
    </AdminShell>
  );
}
