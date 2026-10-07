"use client";
import "../styles/settings.css";

import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "../../../components/layout/AdminShell";
import { restoreSession } from "../../../lib/auth";
import { createRole, getPermissions, getRoles, type Role } from "../services/roles";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

export function RolesPermissionsPage() {
  const { t } = useTranslations({ en, id });
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissionCount, setPermissionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setLoadError("");
      try {
        if (!(await restoreSession())) {
          setLoadError(t("common.sessionExpired"));
          return;
        }
        const [roleList, permissionList] = await Promise.all([
          getRoles(controller.signal), getPermissions(controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setRoles(roleList.items);
        setPermissionCount(permissionList.items.length);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setLoadError(cause instanceof Error ? cause.message : t("roles.errors.loadFailed"));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [reloadKey]);

  async function addRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError(t("roles.errors.nameTooShort"));
      return;
    }
    if (roles.some((role) => role.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(t("roles.errors.duplicate"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await createRole(trimmed);
      router.push(`/settings/roles-permissions/${response.role.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("roles.errors.createFailed"));
      setSaving(false);
    }
  }

  return (
    <AdminShell title={t("shell.title")} context={t("shell.rolesContext")}>
      <main className="roles-page">
        <header className="roles-heading">
          <div>
            <span className="roles-eyebrow">{t("roles.eyebrow")}</span>
            <h1>{t("roles.title")}</h1>
            <p>{t("roles.description")}</p>
          </div>
          <button className="roles-add-button" type="button" onClick={() => {
            setName(""); setError(""); setAdding(true);
          }}>{t("roles.addRole")}</button>
        </header>
        {loadError && <p className="roles-notice" role="alert">
          {loadError} <button type="button" onClick={() => setReloadKey((value) => value + 1)}>{t("common.retry")}</button>
        </p>}
        <section className="roles-list" aria-label={t("roles.listTitle")}>
          <header><h2>{t("roles.listTitle")}</h2><span>{t("roles.count", { total: roles.length })}</span></header>
          {!loading && roles.map((role) => <div className="roles-list-row" key={role.id}>
            <div className="roles-avatar" aria-hidden="true">{role.name.slice(0, 1).toUpperCase()}</div>
            <div className="roles-list-name">
              <strong>{role.name}</strong>
              <span>{t("roles.permissionsGranted", { granted: role.permissionCodes.length, total: permissionCount })}</span>
            </div>
            <Link href={`/settings/roles-permissions/${role.id}`}>{t("roles.edit")}</Link>
          </div>)}
          {(loading || !roles.length) && <div className="roles-empty">
            {loading ? <LoadingSkeleton variant="cards" rows={4} /> : loadError ? t("roles.errors.unableToLoad") : t("roles.empty")}
          </div>}
        </section>
        {adding && <div className="roles-modal-backdrop" onMouseDown={() => { if (!saving) setAdding(false); }}>
          <form className="roles-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => void addRole(event)}>
            <header><h2>{t("roles.modal.title")}</h2><button type="button" aria-label={t("common.close")} disabled={saving} onClick={() => setAdding(false)}>×</button></header>
            <p>{t("roles.modal.description")}</p>
            <label>{t("roles.modal.nameLabel")}
              <input autoFocus value={name} maxLength={80} disabled={saving} placeholder={t("roles.modal.namePlaceholder")}
                onChange={(event) => { setName(event.target.value); setError(""); }} />
            </label>
            {error && <span className="roles-form-error" role="alert">{error}</span>}
            <footer>
              <button type="button" disabled={saving} onClick={() => setAdding(false)}>{t("common.cancel")}</button>
              <button type="submit" disabled={saving}>{saving ? t("roles.modal.creating") : t("roles.modal.create")}</button>
            </footer>
          </form>
        </div>}
      </main>
    </AdminShell>
  );
}
