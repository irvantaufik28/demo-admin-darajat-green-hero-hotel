import { BrandMark } from "../../../components/ui/BrandMark";
import { LoginForm } from "./LoginForm";

export function LoginCard() {
  return (
    <section className="login-card" aria-labelledby="login-title">
      <div className="login-card__intro">
        <BrandMark />
        <p className="brand-eyebrow">GREEN HERO DARAJAT</p>
        <h1 id="login-title">Welcome back</h1>
        <p className="login-card__description">Sign in to manage reservations, rooms, payments, and hotel operations.</p>
      </div>
      <LoginForm />
      <div className="server-status">
        <span><i aria-hidden="true" />PMS Server Online</span>
        <span>v3.4.12-darajat</span>
      </div>
    </section>
  );
}
