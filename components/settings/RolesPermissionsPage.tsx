"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "../layout/AdminShell";
import { permissions, roles } from "../../lib/roles-permissions-data";
import {
  readCustomRoles, roleNameTaken, roleSlug, saveCustomRole,
  type StoredRole,
} from "../../lib/role-settings";

export function RolesPermissionsPage() {
  const router = useRouter();
  const [customRoles, setCustomRoles] = useState<StoredRole[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => setCustomRoles(readCustomRoles()), []);

  function addRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    const slug = roleSlug(trimmed);
    if (!slug || trimmed.length < 2) {
      setError("Enter a role name with at least 2 characters.");
      return;
    }
    if (roleNameTaken(trimmed, customRoles)) {
      setError("This role name already exists.");
      return;
    }
    saveCustomRole({ name: trimmed, slug, permissions: permissions.map(() => false) });
    router.push(`/settings/roles-permissions/${slug}`);
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
          <button className="roles-add-button" type="button" onClick={() => setAdding(true)}>+ Add Role</button>
        </header>
        <section className="roles-list" aria-label="Roles">
          <header><h2>Roles</h2><span>{roles.length + customRoles.length} roles</span></header>
          {roles.map((role, index) => {
            const granted = permissions.filter((permission) => permission.allowed[index] === true).length;
            return <div className="roles-list-row" key={role}>
              <div className="roles-avatar" aria-hidden="true">{role.slice(0, 1)}</div>
              <div className="roles-list-name">
                <strong>{role}</strong>
                <span>{granted} of {permissions.length} permissions granted</span>
              </div>
              <Link href={`/settings/roles-permissions/${roleSlug(role)}`}>Edit</Link>
            </div>;
          })}
          {customRoles.map((role) => <div className="roles-list-row" key={role.slug}>
            <div className="roles-avatar" aria-hidden="true">{role.name.slice(0, 1).toUpperCase()}</div>
            <div className="roles-list-name">
              <strong>{role.name}</strong>
              <span>{role.permissions.filter(Boolean).length} of {permissions.length} permissions granted</span>
            </div>
            <Link href={`/settings/roles-permissions/${role.slug}`}>Edit</Link>
          </div>)}
        </section>
        {adding && <div className="roles-modal-backdrop" onMouseDown={() => setAdding(false)}>
          <form className="roles-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={addRole}>
            <header><h2>Add Role</h2><button type="button" aria-label="Close" onClick={() => setAdding(false)}>×</button></header>
            <p>Create a role, then choose its permissions on the detail page.</p>
            <label>Role Name
              <input autoFocus value={name} maxLength={50} placeholder="e.g. Housekeeping"
                onChange={(event) => { setName(event.target.value); setError(""); }} />
            </label>
            {error && <span className="roles-form-error" role="alert">{error}</span>}
            <footer>
              <button type="button" onClick={() => setAdding(false)}>Cancel</button>
              <button type="submit">Create Role</button>
            </footer>
          </form>
        </div>}
      </main>
    </AdminShell>
  );
}
