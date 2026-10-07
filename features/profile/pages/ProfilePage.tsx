"use client";
import "../../settings/styles/settings.css";
import "../styles/profile.css";

import Link from "next/link";
import { useEffect, useState, type ChangeEvent } from "react";
import { AdminShell } from "../../../components/layout/AdminShell";
import { initialUsers } from "../../settings/constants/users-data";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

const owner = initialUsers[0];

export function ProfilePage() {
  const { t } = useTranslations({ en, id });
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState("");

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
      setPhotoError(t("profile.photo.error"));
      event.target.value = "";
      return;
    }
    setPhotoUrl(URL.createObjectURL(file));
    setPhotoError("");
    event.target.value = "";
  }

  return (
    <AdminShell title={t("shell.title")} context={t("shell.profileContext")}>
      <main className="account-page">
        <header>
          <h1>Jhon Doe</h1>
          <p>{t("profile.description")}</p>
        </header>

        <section className="account-panel">
          <div className="account-owner-header">
            <div className="account-owner-photo">
              {photoUrl ? <img src={photoUrl} alt={t("profile.photo.alt")} /> : <span aria-hidden="true">JD</span>}
            </div>
            <div className="account-owner-identity">
              <h2>{owner.name}</h2>
              <span>{t("profile.photo.ownerRole")}</span>
              <div className="account-photo-actions">
                <input id="owner-photo-upload" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} />
                <label htmlFor="owner-photo-upload">{t("profile.photo.upload")}</label>
                {photoUrl && <button type="button" onClick={() => setPhotoUrl(null)}>{t("profile.photo.remove")}</button>}
              </div>
              <small>{t("profile.photo.hint")}</small>
              {photoError && <small className="account-photo-error" role="alert">{photoError}</small>}
            </div>
          </div>
        </section>

        <section className="account-panel">
          <div className="account-panel__heading"><h2>{t("profile.personalInformation.title")}</h2></div>
          <dl className="account-details">
            <div><dt>{t("profile.personalInformation.fullName")}</dt><dd>{owner.name}</dd></div>
            <div><dt>{t("profile.personalInformation.role")}</dt><dd>{owner.role}</dd></div>
            <div><dt>{t("profile.personalInformation.email")}</dt><dd>{owner.email}</dd></div>
            <div><dt>{t("profile.personalInformation.phone")}</dt><dd>{owner.phone}</dd></div>
            <div><dt>{t("profile.personalInformation.property")}</dt><dd>{t("profile.personalInformation.propertyValue")}</dd></div>
            <div><dt>{t("profile.personalInformation.location")}</dt><dd>{t("profile.personalInformation.locationValue")}</dd></div>
          </dl>
        </section>

        <section className="account-panel">
          <div className="account-panel__heading"><h2>{t("profile.accountAccess.title")}</h2></div>
          <dl className="account-details">
            <div><dt>{t("profile.accountAccess.username")}</dt><dd>{t("profile.accountAccess.usernameValue")}</dd></div>
            <div><dt>{t("profile.accountAccess.status")}</dt><dd><span className="users-status users-status--active">{owner.status}</span></dd></div>
            <div><dt>{t("profile.accountAccess.lastLogin")}</dt><dd>{owner.lastLogin}</dd></div>
            <div><dt>{t("profile.accountAccess.access")}</dt><dd>{t("profile.accountAccess.accessValue")}</dd></div>
          </dl>
          <div className="account-profile-footer">
            <Link href="/change-password">{t("profile.changePassword")}</Link>
          </div>
        </section>
      </main>
    </AdminShell>
  );
}
