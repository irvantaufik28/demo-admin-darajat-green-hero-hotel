"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "../../../components/ui/FormField";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { hasSession, login, restoreSession } from "../../../lib/auth";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

export function LoginForm() {
  const { t } = useTranslations({ en, id });
  const router = useRouter();
  const [username, setUsername] = useState("owner");
  const [password, setPassword] = useState("admin123");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hasSession()) {
      router.replace("/reservations/room-rack");
      return;
    }
    let active = true;
    void restoreSession().then((restored) => {
      if (active && restored) router.replace("/reservations/room-rack");
    });
    return () => { active = false; };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      sessionStorage.setItem("green-hero-demo-notice-pending", "true");
      router.replace("/reservations/room-rack");
    } catch (error) {
      setError(error instanceof Error ? error.message : t("form.loginFailed"));
      setLoading(false);
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      {error && <div className="form-alert" role="alert"><strong>{t("form.loginFailedTitle")}</strong><span>{error}</span></div>}
      <FormField id="username" label={t("form.usernameLabel")} name="username" type="text" autoComplete="username" required value={username} onChange={event => setUsername(event.target.value)} />
      <FormField id="password" label={t("form.passwordLabel")} name="password" type={visible ? "text" : "password"} autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} trailing={
        <button type="button" className="password-toggle" aria-label={visible ? t("form.hidePassword") : t("form.showPassword")} aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? "◉" : "◎"}</button>
      } />
      <div className="login-form__options"><span className="access-caption">{t("form.demoCaption")}</span></div>
      <PrimaryButton type="submit" loading={loading}>{loading ? t("form.signingIn") : t("form.signIn")}</PrimaryButton>
    </form>
  );
}
