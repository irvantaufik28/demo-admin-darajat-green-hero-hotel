"use client";
import type { ReactNode } from "react";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

export function LoginShell({ children }: { children: ReactNode }) {
  const { t } = useTranslations({ en, id });
  return (
    <div className="auth-shell">
      <header className="auth-shell__header">
        <div className="shift-badge"><i aria-hidden="true" /><strong>{t("shell.shiftBadge")}</strong><span>•</span><span>{t("shell.deskLabel")}</span></div>
      </header>
      <main className="auth-shell__main">{children}</main>
      <footer className="auth-shell__footer">
        <p>{t("shell.footerTitle")}</p>
        <small>{t("shell.footerNote")}</small>
      </footer>
    </div>
  );
}
