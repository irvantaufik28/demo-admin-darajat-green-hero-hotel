"use client";
import "../../settings/styles/settings.css";
import "../styles/profile.css";

import { AdminShell } from "../../../components/layout/AdminShell";

export function ChangePasswordPage() {
  return (
    <AdminShell title="Account" context="Change Password">
      <main className="account-page">
        <header>
          <h1>Change Password</h1>
          <p>Form password untuk tampilan demo.</p>
        </header>
        <section className="account-panel">
          <div className="account-panel__heading"><h2>Password</h2></div>
          <div className="account-password-form">
            <label>Current Password<input type="password" autoComplete="current-password" /></label>
            <label>New Password<input type="password" autoComplete="new-password" /></label>
            <label>Confirm New Password<input type="password" autoComplete="new-password" /></label>
            <p>Form demo ini belum mengubah password login.</p>
            <button type="button" disabled>Save Changes</button>
          </div>
        </section>
      </main>
    </AdminShell>
  );
}
