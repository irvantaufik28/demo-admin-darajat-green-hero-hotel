"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AdminShell } from "../../../components/layout/AdminShell";
import { getCurrentUser, restoreSession } from "../../../lib/auth";
import {
  defaultReservationSettings,
  type ReservationSettings,
} from "../constants/reservation-settings";
import { getReservationSettings, updateReservationSettings } from "../services/reservation-settings";

function SettingToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="reservation-setting-row">
      <div>
        <strong>{label}</strong>
        <p>{description}</p>
      </div>
      <label className="reservation-setting-switch">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} aria-label={label} />
        <span aria-hidden="true" />
        <small>{checked ? "ON" : "OFF"}</small>
      </label>
    </div>
  );
}

export function ReservationSettingsPage() {
  const [settings, setSettings] = useState<ReservationSettings>(defaultReservationSettings);
  const [saved, setSaved] = useState<ReservationSettings>(defaultReservationSettings);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const changed = JSON.stringify(settings) !== JSON.stringify(saved);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        if (!(await restoreSession())) throw new Error("Sesi login tidak tersedia.");
        const result = await getReservationSettings(controller.signal);
        if (controller.signal.aborted) return;
        setSettings(result.settings);
        setSaved(result.settings);
        setCanEdit(getCurrentUser()?.permissions.includes("master.edit") ?? false);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Pengaturan reservasi gagal dimuat.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  function change<Key extends keyof ReservationSettings>(key: Key, value: ReservationSettings[Key]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setError("");
    setNotice("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings.checkInTime || !settings.checkOutTime) {
      setError("Check-in and check-out times are required.");
      return;
    }
    if (!Number.isInteger(settings.websitePaymentExpiryMinutes) ||
      settings.websitePaymentExpiryMinutes < 1 || settings.websitePaymentExpiryMinutes > 1440) {
      setError("Website payment expiry must be between 1 and 1,440 minutes.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await updateReservationSettings(settings);
      setSettings(result.settings);
      setSaved(result.settings);
      setNotice("Reservation settings saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pengaturan reservasi gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell title="Settings" context="Reservation Settings">
      <main className="reservation-settings-page">
        <header className="reservation-settings-heading">
          <h1>Reservation Settings</h1>
          <p>Configure the main reservation and stay rules.</p>
        </header>

        <form className="reservation-settings-panel" onSubmit={(event) => void save(event)}>
          {loading && <p className="reservation-setting-help" role="status">Memuat pengaturan...</p>}
          <section className="reservation-settings-section">
            <h2>Stay Time</h2>
            <div className="reservation-setting-times">
              <label>Default Check-in Time
                <input type="time" value={settings.checkInTime}
                  onChange={(event) => change("checkInTime", event.target.value)} />
              </label>
              <label>Default Check-out Time
                <input type="time" value={settings.checkOutTime}
                  onChange={(event) => change("checkOutTime", event.target.value)} />
              </label>
            </div>
          </section>

          <section className="reservation-settings-section">
            <h2>Reservation Rules</h2>
            <SettingToggle
              label="Auto Confirm Website Booking After Payment"
              description="Website reservations are automatically confirmed after successful full payment."
              checked={settings.autoConfirmWebsiteAfterPayment}
              onChange={(value) => change("autoConfirmWebsiteAfterPayment", value)}
            />
            <SettingToggle
              label="Allow Partial / Unpaid Check-in"
              description="Staff may check in guests with an outstanding balance. A warning is always shown before check-in."
              checked={settings.allowOutstandingCheckIn}
              onChange={(value) => change("allowOutstandingCheckIn", value)}
            />
            <SettingToggle
              label="Allow Checkout with Outstanding Balance"
              description="Staff may check out guests with an unpaid balance. A warning is always shown, and the balance remains in Payments."
              checked={settings.allowOutstandingCheckOut}
              onChange={(value) => change("allowOutstandingCheckOut", value)}
            />
          </section>

          <section className="reservation-settings-section">
            <h2>Website Booking</h2>
            <label className="reservation-setting-expiry">Website Payment Expiry
              <span>
                <input type="number" min={1} max={1440} step={1}
                  value={settings.websitePaymentExpiryMinutes}
                  onChange={(event) => change("websitePaymentExpiryMinutes", Number(event.target.value))} />
                <span>Minutes</span>
              </span>
            </label>
            <p className="reservation-setting-help">Unpaid website reservations expire after this duration.</p>
            <p className="reservation-setting-help">After expiry, the reservation and payment become Expired, and direct room inventory is released.</p>
          </section>

          <section className="reservation-settings-section">
            <h2>No-show</h2>
            <div className="reservation-setting-fixed">
              <strong>No-show Handling</strong>
              <span>Manual by Staff</span>
            </div>
            <p className="reservation-setting-help">Staff manually marks a confirmed guest as no-show when the guest does not arrive.</p>
          </section>

          {error && <p className="reservation-settings-error" role="alert">{error}</p>}
          {notice && <p className="reservation-settings-notice" role="status">{notice}</p>}
          <footer className="reservation-settings-actions">
            <button type="button" disabled={loading || saving} onClick={() => {
              setSettings({ ...saved }); setError(""); setNotice("");
            }}>Cancel</button>
            <button type="submit" disabled={!changed || loading || saving || !canEdit}>{saving ? "Saving..." : "Save Changes"}</button>
          </footer>
        </form>
      </main>
    </AdminShell>
  );
}
