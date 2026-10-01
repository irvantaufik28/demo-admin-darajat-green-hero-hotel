"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "../layout/AdminShell";
import { permissions, roles } from "../../lib/roles-permissions-data";
import { readCustomRoles, roleSlug, saveCustomRole, type StoredRole } from "../../lib/role-settings";

export function RoleDetailPage({ slug }: { slug: string }) {
  const roleIndex = roles.findIndex((role) => roleSlug(role) === slug);
  const [customRole, setCustomRole] = useState<StoredRole | null>(null);
  const [loaded, setLoaded] = useState(false);
  const role = roles[roleIndex] ?? customRole?.name;
  const [values, setValues] = useState<(boolean | null)[]>(
    () => permissions.map((permission) => permission.allowed[roleIndex] ?? false),
  );
  const [saved, setSaved] = useState<(boolean | null)[]>(
    () => permissions.map((permission) => permission.allowed[roleIndex] ?? false),
  );
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const changed = JSON.stringify(values) !== JSON.stringify(saved);
  const visible = useMemo(() => permissions.map((permission, index) => ({ permission, index }))
    .filter(({ permission }) =>
      `${permission.group} ${permission.label}`.toLowerCase().includes(query.toLowerCase()),
    ), [query]);
  let previousGroup = "";

  useEffect(() => {
    if (roleIndex < 0) {
      const found = readCustomRoles().find((item) => item.slug === slug) ?? null;
      setCustomRole(found);
      if (found) {
        setValues([...found.permissions]);
        setSaved([...found.permissions]);
      }
    }
    setLoaded(true);
  }, [roleIndex, slug]);

  if (!loaded) return <AdminShell title="Settings" context="Roles & Permissions">
    <main className="roles-page">Loading role...</main>
  </AdminShell>;

  if (!role) {
    return <AdminShell title="Settings" context="Roles & Permissions">
      <main className="roles-page"><h1>Role not found</h1>
        <Link href="/settings/roles-permissions">← Back to Roles</Link>
      </main>
    </AdminShell>;
  }

  return (
    <AdminShell title="Settings" context="Roles & Permissions">
      <main className="roles-page">
        <Link className="roles-back" href="/settings/roles-permissions">← All Roles</Link>
        <header className="roles-heading">
          <div>
            <span className="roles-eyebrow">ROLE DETAILS</span>
            <h1>{role}</h1>
            <p>Review and adjust this role&apos;s access to hotel operations.</p>
          </div>
          <div className="roles-actions">
            <button type="button" disabled={!changed} onClick={() => {
              setValues([...saved]); setNotice("");
            }}>Discard Changes</button>
            <button type="button" className="roles-save" disabled={!changed} onClick={() => {
              setSaved([...values]);
              if (customRole) saveCustomRole({
                ...customRole,
                permissions: values.map((value) => value === true),
              });
              setNotice("Changes saved for this demo session.");
            }}>Save Changes</button>
          </div>
        </header>
        <section className="roles-matrix-panel">
          <div className="roles-toolbar">
            <div>
              <h2>Permission Matrix</h2>
              <p>Set access for {role}. A dash means the rule was not specified.</p>
            </div>
            <input aria-label="Search permissions" placeholder="Search permissions..."
              value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <div className="roles-table-scroll">
            <table className="roles-table roles-table--detail">
              <thead><tr><th scope="col">Module / Permission</th><th scope="col">{role}</th></tr></thead>
              <tbody>
                {visible.map(({ permission, index }) => {
                  const showGroup = previousGroup !== permission.group;
                  previousGroup = permission.group;
                  return [
                    showGroup && <tr className="roles-group" key={`${permission.group}-group`}>
                      <th colSpan={2} scope="colgroup">{permission.group}</th>
                    </tr>,
                    <tr key={permission.label}>
                      <th scope="row">{permission.label}</th>
                      <td>{values[index] === null ?
                        <span className="roles-unspecified" title="Not specified">—</span> :
                        <label className="roles-checkbox">
                          <input type="checkbox" checked={values[index] === true}
                            onChange={() => {
                              setValues((current) => current.map((value, position) =>
                                position === index ? !value : value,
                              ));
                              setNotice("");
                            }}
                            aria-label={`${permission.label} — ${role}`} />
                          <span aria-hidden="true">{values[index] ? "✓" : "×"}</span>
                        </label>}
                      </td>
                    </tr>,
                  ];
                })}
                {visible.length === 0 && <tr><td colSpan={2} className="roles-empty">No permissions found.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        {notice && <p className="roles-notice" role="status">{notice}</p>}
      </main>
    </AdminShell>
  );
}
