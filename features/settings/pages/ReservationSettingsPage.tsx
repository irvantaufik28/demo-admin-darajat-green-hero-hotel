"use client";
import "../styles/settings.css";

import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { useEffect, useState, type FormEvent } from "react";
import { AdminShell } from "../../../components/layout/AdminShell";
import { getCurrentUser, restoreSession } from "../../../lib/auth";
import {
  defaultReservationSettings,
  type ReservationSettings,
} from "../constants/reservation-settings";
import { getReservationSettings, updateReservationSettings } from "../services/reservation-settings";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

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
  const { t } = useTranslations({ en, id });
  return (
    <div className="reservation-setting-row">
      <div>
        <strong>{label}</strong>
        <p>{description}</p>
      </div>
      <label className="reservation-setting-switch">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} aria-label={label} />
        <span aria-hidden="true" />
        <small>{checked ? t("reservationSettings.toggle.on") : t("reservationSettings.toggle.off")}</small>
      </label>
    </div>
  );
}

export function ReservationSettingsPage() {
  const { t } = useTranslations({ en, id });
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
        if (!(await restoreSession())) throw new Error(t("reservationSettings.errors.sessionUnavailable"));
        const result = await getReservationSettings(controller.signal);
        if (controller.signal.aborted) return;
        setSettings(result.settings);
        setSaved(result.settings);
        setCanEdit(getCurrentUser()?.permissions.includes("master.edit") ?? false);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : t("reservationSettings.errors.loadFailed"));
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
      setError(t("reservationSettings.errors.timesRequired"));
      return;
    }
    if (!Number.isInteger(settings.websitePaymentExpiryMinutes) ||
      settings.websitePaymentExpiryMinutes < 1 || settings.websitePaymentExpiryMinutes > 1440) {
      setError(t("reservationSettings.errors.expiryRange"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await updateReservationSettings(settings);
      setSettings(result.settings);
      setSaved(result.settings);
      setNotice(t("reservationSettings.saved"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("reservationSettings.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell title={t("shell.title")} context={t("shell.reservationContext")}>
      <main className="reservation-settings-page">
        <header className="reservation-settings-heading">
          <h1>{t("reservationSettings.title")}</h1>
          <p>{t("reservationSettings.description")}</p>
        </header>

        {loading ? <LoadingSkeleton variant="form" rows={8} /> : <form className="reservation-settings-panel" onSubmit={(event) => void save(event)}>
          <section className="reservation-settings-section">
            <h2>{t("reservationSettings.stayTime.title")}</h2>
            <div className="reservation-setting-times">
              <label>{t("reservationSettings.stayTime.checkInTime")}
                <input type="time" value={settings.checkInTime}
                  onChange={(event) => change("checkInTime", event.target.value)} />
              </label>
              <label>{t("reservationSettings.stayTime.checkOutTime")}
                <input type="time" value={settings.checkOutTime}
                  onChange={(event) => change("checkOutTime", event.target.value)} />
              </label>
            </div>
          </section>

          <section className="reservation-settings-section">
            <h2>{t("reservationSettings.rules.title")}</h2>
            <SettingToggle
              label={t("reservationSettings.rules.autoConfirm.label")}
              description={t("reservationSettings.rules.autoConfirm.description")}
              checked={settings.autoConfirmWebsiteAfterPayment}
              onChange={(value) => change("autoConfirmWebsiteAfterPayment", value)}
            />
            <SettingToggle
              label={t("reservationSettings.rules.allowCheckIn.label")}
              description={t("reservationSettings.rules.allowCheckIn.description")}
              checked={settings.allowOutstandingCheckIn}
              onChange={(value) => change("allowOutstandingCheckIn", value)}
            />
            <SettingToggle
              label={t("reservationSettings.rules.allowCheckOut.label")}
              description={t("reservationSettings.rules.allowCheckOut.description")}
              checked={settings.allowOutstandingCheckOut}
              onChange={(value) => change("allowOutstandingCheckOut", value)}
            />
          </section>

          <section className="reservation-settings-section">
            <h2>{t("reservationSettings.websiteBooking.title")}</h2>
            <label className="reservation-setting-expiry">{t("reservationSettings.websiteBooking.expiryLabel")}
              <span>
                <input type="number" min={1} max={1440} step={1}
                  value={settings.websitePaymentExpiryMinutes}
                  onChange={(event) => change("websitePaymentExpiryMinutes", Number(event.target.value))} />
                <span>{t("reservationSettings.websiteBooking.minutes")}</span>
              </span>
            </label>
            <p className="reservation-setting-help">{t("reservationSettings.websiteBooking.help1")}</p>
            <p className="reservation-setting-help">{t("reservationSettings.websiteBooking.help2")}</p>
          </section>

          <section className="reservation-settings-section">
            <h2>{t("reservationSettings.noShow.title")}</h2>
            <div className="reservation-setting-fixed">
              <strong>{t("reservationSettings.noShow.handlingLabel")}</strong>
              <span>{t("reservationSettings.noShow.handlingValue")}</span>
            </div>
            <p className="reservation-setting-help">{t("reservationSettings.noShow.help")}</p>
          </section>

          {error && <p className="reservation-settings-error" role="alert">{error}</p>}
          {notice && <p className="reservation-settings-notice" role="status">{notice}</p>}
          <footer className="reservation-settings-actions">
            <button type="button" disabled={loading || saving} onClick={() => {
              setSettings({ ...saved }); setError(""); setNotice("");
            }}>{t("common.cancel")}</button>
            <button type="submit" disabled={!changed || loading || saving || !canEdit}>{saving ? t("common.saving") : t("common.saveChanges")}</button>
          </footer>
        </form>}
      </main>
    </AdminShell>
  );
}
