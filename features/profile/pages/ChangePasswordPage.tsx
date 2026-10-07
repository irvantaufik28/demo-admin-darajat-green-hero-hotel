"use client";
import "../../settings/styles/settings.css";
import "../styles/profile.css";

import { AdminShell } from "../../../components/layout/AdminShell";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

export function ChangePasswordPage() {
  const { t } = useTranslations({ en, id });
  return (
    <AdminShell title={t("shell.title")} context={t("shell.changePasswordContext")}>
      <main className="account-page">
        <header>
          <h1>{t("changePassword.title")}</h1>
          <p>{t("changePassword.description")}</p>
        </header>
        <section className="account-panel">
          <div className="account-panel__heading"><h2>{t("changePassword.panelTitle")}</h2></div>
          <div className="account-password-form">
            <label>{t("changePassword.currentPassword")}<input type="password" autoComplete="current-password" /></label>
            <label>{t("changePassword.newPassword")}<input type="password" autoComplete="new-password" /></label>
            <label>{t("changePassword.confirmNewPassword")}<input type="password" autoComplete="new-password" /></label>
            <p>{t("changePassword.demoNote")}</p>
            <button type="button" disabled>{t("changePassword.saveChanges")}</button>
          </div>
        </section>
      </main>
    </AdminShell>
  );
}
