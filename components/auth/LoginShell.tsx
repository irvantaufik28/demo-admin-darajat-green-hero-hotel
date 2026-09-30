import type { ReactNode } from "react";

export function LoginShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <header className="auth-shell__header">
        <div className="shift-badge"><i aria-hidden="true" /><strong>Shift A (07:00 - 15:00)</strong><span>•</span><span>Darajat Desk #01</span></div>
      </header>
      <main className="auth-shell__main">{children}</main>
      <footer className="auth-shell__footer">
        <p>Green Hero Darajat Admin System • Operational Back-Office</p>
        <small>Authorized staff access only. Green Hero Darajat operational workspace.</small>
      </footer>
    </div>
  );
}
