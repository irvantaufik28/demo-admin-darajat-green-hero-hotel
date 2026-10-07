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

export function RoleDetailPage({ slug }: { slug: string }) {
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
          setError("Sesi login berakhir. Silakan login kembali.");
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
          setError(cause instanceof Error ? cause.message : "Role gagal dimuat.");
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
      setNotice("Role permissions saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Permission gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  if (!role) return <AdminShell title="Settings" context="Roles & Permissions">
    <main className="roles-page">{loading ? <LoadingSkeleton variant="detail" /> : <h1>{error || "Role not found"}</h1>}
      <Link href="/settings/roles-permissions">← Back to Roles</Link>
      {!loading && <button type="button" onClick={() => setReloadKey((value) => value + 1)}>Retry</button>}
    </main>
  </AdminShell>;

  return (
    <AdminShell title="Settings" context="Roles & Permissions">
      <main className="roles-page">
        <Link className="roles-back" href="/settings/roles-permissions">← All Roles</Link>
        <header className="roles-heading">
          <div>
            <span className="roles-eyebrow">ROLE DETAILS</span>
            <h1>{role.name}</h1>
            <p>Review and adjust this role&apos;s access to hotel operations.</p>
          </div>
          <div className="roles-actions">
            <button type="button" disabled={!changed || saving} onClick={() => {
              setValues([...saved]); setNotice("");
            }}>Discard Changes</button>
            <button type="button" className="roles-save" disabled={!changed || saving} onClick={() => void save()}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </header>
        <section className="roles-matrix-panel">
          <div className="roles-toolbar">
            <div><h2>Permission Matrix</h2><p>Set access for {role.name}.</p></div>
            <input aria-label="Search permissions" placeholder="Search permissions..."
              value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <div className="roles-table-scroll">
            <table className="roles-table roles-table--detail">
              <thead><tr><th scope="col">Module / Permission</th><th scope="col">{role.name}</th></tr></thead>
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
                  {loading ? <LoadingSkeleton /> : "No permissions found."}
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
