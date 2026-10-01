"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "../ui/FormField";
import { PrimaryButton } from "../ui/PrimaryButton";
import { credentials, hasSession, saveSession } from "../../lib/auth";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState(credentials.username);
  const [password, setPassword] = useState(credentials.password);
  const [remember, setRemember] = useState(true);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hasSession()) router.replace("/dashboard");
  }, [router]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (username.trim() !== credentials.username || password !== credentials.password) {
      setError("Username atau password tidak sesuai.");
      return;
    }
    setLoading(true);
    saveSession(remember);
    sessionStorage.setItem("green-hero-demo-notice-pending", "true");
    router.replace("/dashboard");
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      {error && <div className="form-alert" role="alert"><strong>Login gagal</strong><span>{error}</span></div>}
      <FormField id="username" label="Username / ID Staff" name="username" type="text" autoComplete="username" required value={username} onChange={event => setUsername(event.target.value)} />
      <FormField id="password" label="Password" name="password" type={visible ? "text" : "password"} autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} trailing={
        <button type="button" className="password-toggle" aria-label={visible ? "Sembunyikan password" : "Tampilkan password"} aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? "◉" : "◎"}</button>
      } />
      <div className="login-form__options">
        <label className="remember-option"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} />Remember me</label>
        <span className="access-caption">Staff access</span>
      </div>
      <PrimaryButton type="submit" loading={loading}>{loading ? "Signing in..." : "Sign In"}</PrimaryButton>
    </form>
  );
}
