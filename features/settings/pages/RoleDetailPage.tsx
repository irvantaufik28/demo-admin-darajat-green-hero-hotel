"use client";
import "../styles/settings.css";

import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "../../../components/layout/AdminShell";
import { restoreSession } from "../../../lib/auth";
import {
  getPermissions,
  getRole,
  saveRolePermissions,
  type Permission,
  type Role,
} from "../services/roles";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

export function RoleDetailPage({ slug }: { slug: string }) {
  const { t } = useTranslations({ en, id });
  const [role, setRole] = useState<Role | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [values, setValues] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const changed = JSON.stringify([...values].sort()) !== JSON.stringify([...saved].sort());
  const visible = useMemo(() => permissions.filter((permission) =>
    `${permission.module} ${permission.label} ${permission.code}`
      .toLowerCase().includes(query.toLowerCase()),
  ), [permissions, query]);
  let previousGroup = "";

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        if (!(await restoreSession())) {
          setError(t("common.sessionExpired"));
          return;
        }
        const [detail, catalog] = await Promise.all([
          getRole(slug, controller.signal), getPermissions(controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setRole(detail.role);
        setPermissions(catalog.items);
        setValues(detail.role.permissionCodes);
        setSaved(detail.role.permissionCodes);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : t("roleDetail.errors.loadFailed"));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [slug, reloadKey]);

  async function save() {
    if (!role || !changed || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await saveRolePermissions(role.id, values);
      setRole(response.role);
      setValues(response.role.permissionCodes);
      setSaved(response.role.permissionCodes);
      setNotice(t("roleDetail.saved"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("roleDetail.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (!role) return <AdminShell title={t("shell.title")} context={t("shell.rolesContext")}>
    <main className="roles-page">{loading ? <LoadingSkeleton variant="detail" /> : <h1>{error || t("roleDetail.notFound")}</h1>}
      <Link href="/settings/roles-permissions">{t("roleDetail.backToRoles")}</Link>
      {!loading && <button type="button" onClick={() => setReloadKey((value) => value + 1)}>{t("common.retry")}</button>}
    </main>
  </AdminShell>;

  return (
    <AdminShell title={t("shell.title")} context={t("shell.rolesContext")}>
      <main className="roles-page">
        <Link className="roles-back" href="/settings/roles-permissions">{t("roleDetail.allRoles")}</Link>
        <header className="roles-heading">
          <div>
            <span className="roles-eyebrow">{t("roleDetail.eyebrow")}</span>
            <h1>{role.name}</h1>
            <p>{t("roleDetail.description")}</p>
          </div>
          <div className="roles-actions">
            <button type="button" disabled={!changed || saving} onClick={() => {
              setValues([...saved]); setNotice("");
            }}>{t("roleDetail.discardChanges")}</button>
            <button type="button" className="roles-save" disabled={!changed || saving} onClick={() => void save()}>
              {saving ? t("common.saving") : t("common.saveChanges")}
            </button>
          </div>
        </header>
        <section className="roles-matrix-panel">
          <div className="roles-toolbar">
            <div><h2>{t("roleDetail.matrixTitle")}</h2><p>{t("roleDetail.matrixDescription", { role: role.name })}</p></div>
            <input aria-label={t("roleDetail.searchAriaLabel")} placeholder={t("roleDetail.searchPlaceholder")}
              value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <div className="roles-table-scroll">
            <table className="roles-table roles-table--detail">
              <thead><tr><th scope="col">{t("roleDetail.table.modulePermission")}</th><th scope="col">{role.name}</th></tr></thead>
              <tbody>
                {visible.map((permission) => {
                  const showGroup = previousGroup !== permission.module;
                  previousGroup = permission.module;
                  const allowed = values.includes(permission.code);
                  return [
                    showGroup && <tr className="roles-group" key={`${permission.module}-group`}>
                      <th colSpan={2} scope="colgroup">{permission.module}</th>
                    </tr>,
                    <tr key={permission.code}>
                      <th scope="row">{permission.label}</th>
                      <td><label className="roles-checkbox">
                        <input type="checkbox" checked={allowed} disabled={saving}
                          onChange={() => {
                            setValues((current) => allowed
                              ? current.filter((code) => code !== permission.code)
                              : [...current, permission.code]);
                            setNotice("");
                          }}
                          aria-label={`${permission.label} — ${role.name}`} />
                        <span aria-hidden="true">{allowed ? "✓" : "×"}</span>
                      </label></td>
                    </tr>,
                  ];
                })}
                {!visible.length && <tr><td colSpan={2} className="roles-empty">
                  {loading ? <LoadingSkeleton /> : t("roleDetail.empty")}
                </td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        {error && <p className="roles-notice" role="alert">{error}</p>}
        {notice && <p className="roles-notice" role="status">{notice}</p>}
      </main>
    </AdminShell>
  );
}
