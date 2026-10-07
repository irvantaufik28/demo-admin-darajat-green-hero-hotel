"use client";
import { BrandMark } from "../../../components/ui/BrandMark";
import { LoginForm } from "./LoginForm";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

export function LoginCard() {
  const { t } = useTranslations({ en, id });
  return (
    <section className="login-card" aria-labelledby="login-title">
      <div className="login-card__intro">
        <BrandMark />
        <p className="brand-eyebrow">{t("card.brandEyebrow")}</p>
        <h1 id="login-title">{t("card.title")}</h1>
        <p className="login-card__description">{t("card.description")}</p>
      </div>
      <LoginForm />
      <div className="server-status">
        <span><i aria-hidden="true" />{t("card.serverStatus")}</span>
        <span>{t("card.version")}</span>
      </div>
    </section>
  );
}
