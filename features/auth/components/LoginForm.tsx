"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "../../../components/ui/FormField";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { hasSession, login, restoreSession } from "../../../lib/auth";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hasSession()) {
      router.replace("/dashboard");
      return;
    }
    let active = true;
    void restoreSession().then((restored) => {
      if (active && restored) router.replace("/dashboard");
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
      router.replace("/dashboard");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Login gagal. Silakan coba lagi.");
      setLoading(false);
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      {error && <div className="form-alert" role="alert"><strong>Login gagal</strong><span>{error}</span></div>}
      <FormField id="username" label="Username / ID Staff" name="username" type="text" autoComplete="username" required value={username} onChange={event => setUsername(event.target.value)} />
      <FormField id="password" label="Password" name="password" type={visible ? "text" : "password"} autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} trailing={
        <button type="button" className="password-toggle" aria-label={visible ? "Sembunyikan password" : "Tampilkan password"} aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? "◉" : "◎"}</button>
      } />
      <div className="login-form__options"><span className="access-caption">Staff access</span></div>
      <PrimaryButton type="submit" loading={loading}>{loading ? "Signing in..." : "Sign In"}</PrimaryButton>
    </form>
  );
}
