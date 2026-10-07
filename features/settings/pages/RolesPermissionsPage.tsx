"use client";
import "../styles/settings.css";

import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "../../../components/layout/AdminShell";
import { restoreSession } from "../../../lib/auth";
import { createRole, getPermissions, getRoles, type Role } from "../services/roles";

export function RolesPermissionsPage() {
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
          setLoadError("Sesi login berakhir. Silakan login kembali.");
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
          setLoadError(cause instanceof Error ? cause.message : "Roles gagal dimuat.");
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
      setError("Enter a role name with at least 2 characters.");
      return;
    }
    if (roles.some((role) => role.name.toLowerCase() === trimmed.toLowerCase())) {
      setError("This role name already exists.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await createRole(trimmed);
      router.push(`/settings/roles-permissions/${response.role.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Role gagal dibuat.");
      setSaving(false);
    }
  }

  return (
    <AdminShell title="Settings" context="Roles & Permissions">
      <main className="roles-page">
        <header className="roles-heading">
          <div>
            <span className="roles-eyebrow">ACCESS CONTROL</span>
            <h1>Roles & Permissions</h1>
            <p>Select a role to view and manage its permissions.</p>
          </div>
          <button className="roles-add-button" type="button" onClick={() => {
            setName(""); setError(""); setAdding(true);
          }}>+ Add Role</button>
        </header>
        {loadError && <p className="roles-notice" role="alert">
          {loadError} <button type="button" onClick={() => setReloadKey((value) => value + 1)}>Retry</button>
        </p>}
        <section className="roles-list" aria-label="Roles">
          <header><h2>Roles</h2><span>{roles.length} roles</span></header>
          {!loading && roles.map((role) => <div className="roles-list-row" key={role.id}>
            <div className="roles-avatar" aria-hidden="true">{role.name.slice(0, 1).toUpperCase()}</div>
            <div className="roles-list-name">
              <strong>{role.name}</strong>
              <span>{role.permissionCodes.length} of {permissionCount} permissions granted</span>
            </div>
            <Link href={`/settings/roles-permissions/${role.id}`}>Edit</Link>
          </div>)}
          {(loading || !roles.length) && <div className="roles-empty">
            {loading ? <LoadingSkeleton variant="cards" rows={4} /> : loadError ? "Unable to load roles." : "No roles found."}
          </div>}
        </section>
        {adding && <div className="roles-modal-backdrop" onMouseDown={() => { if (!saving) setAdding(false); }}>
          <form className="roles-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => void addRole(event)}>
            <header><h2>Add Role</h2><button type="button" aria-label="Close" disabled={saving} onClick={() => setAdding(false)}>×</button></header>
            <p>Create a role, then choose its permissions on the detail page.</p>
            <label>Role Name
              <input autoFocus value={name} maxLength={80} disabled={saving} placeholder="e.g. Housekeeping"
                onChange={(event) => { setName(event.target.value); setError(""); }} />
            </label>
            {error && <span className="roles-form-error" role="alert">{error}</span>}
            <footer>
              <button type="button" disabled={saving} onClick={() => setAdding(false)}>Cancel</button>
              <button type="submit" disabled={saving}>{saving ? "Creating..." : "Create Role"}</button>
            </footer>
          </form>
        </div>}
      </main>
    </AdminShell>
  );
}
