"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AdminShell } from "../../../components/layout/AdminShell";
import { getCurrentUser, restoreSession } from "../../../lib/auth";
import { createUser, getUserRoles, getUsers, setUserStatus, type AdminUser, type UserRole } from "../services/users";

type Draft = { name: string; email: string; username: string; phone: string; roleId: string; password: string; isActive: boolean };
const emptyDraft: Draft = { name: "", email: "", username: "", phone: "", roleId: "", password: "", isActive: true };

function lastLogin(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

export function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingId, setChangingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const visible = useMemo(() => users.filter((user) =>
    (!statusFilter || (statusFilter === "Active") === user.isActive) &&
    (!query || `${user.name} ${user.email} ${user.username ?? ""} ${user.phone ?? ""} ${user.roleName}`
      .toLowerCase().includes(query.toLowerCase())),
  ), [users, statusFilter, query]);

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
        const [userList, roleList] = await Promise.all([
          getUsers(controller.signal), getUserRoles(controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setUsers(userList.items);
        setRoles(roleList.items);
      } catch (cause) {
        if (!controller.signal.aborted) setLoadError(cause instanceof Error ? cause.message : "Users gagal dimuat.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [reloadKey]);

  function openAdd() {
    setDraft({ ...emptyDraft, roleId: roles[0]?.id ?? "" });
    setError("");
    setModalOpen(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draft.name.trim();
    const email = draft.email.trim().toLowerCase();
    if (!name || !email || !draft.roleId || draft.password.length < 5) {
      setError("Name, email, role, and password of at least 5 characters are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await createUser({
        name, email, username: draft.username.trim() || null, phone: draft.phone.trim() || null,
        roleId: draft.roleId, password: draft.password, isActive: draft.isActive,
      });
      setUsers((current) => [...current, response.user].sort((a, b) => a.name.localeCompare(b.name)));
      setNotice(`${name} added.`);
      setModalOpen(false);
      setDraft(emptyDraft);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "User gagal dibuat.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(user: AdminUser) {
    setChangingId(user.id);
    setLoadError("");
    setNotice("");
    try {
      const response = await setUserStatus(user.id, !user.isActive);
      setUsers((current) => current.map((item) => item.id === user.id ? response.user : item));
      setNotice(`${user.name} is now ${response.user.isActive ? "active" : "inactive"}.`);
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "Status user gagal diubah.");
    } finally {
      setChangingId(null);
    }
  }

  return (
    <AdminShell title="Settings" context="Users">
      <main className="users-page">
        <header className="users-heading">
          <div><span className="roles-eyebrow">TEAM ACCESS</span><h1>Users</h1>
            <p>Manage admin accounts, assigned roles, and access status.</p></div>
          <button type="button" className="roles-add-button" disabled={!roles.length} onClick={openAdd}>+ Add User</button>
        </header>
        <section className="users-panel">
          <div className="users-toolbar">
            <h2>User List <span>{visible.length} users</span></h2>
            <div><input aria-label="Search users" placeholder="Search name, email, phone..."
              value={query} onChange={(event) => setQuery(event.target.value)} />
              <select aria-label="Filter status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">All Status</option><option value="Active">Active</option><option value="Inactive">Inactive</option>
              </select></div>
          </div>
          {loadError && <p className="roles-notice" role="alert">{loadError}{" "}
            <button type="button" onClick={() => setReloadKey((value) => value + 1)}>Retry</button></p>}
          <div className="users-table-scroll"><table className="users-table">
            <thead><tr><th>Name</th><th>Email / Username</th><th>Phone</th><th>Role</th>
              <th>Status</th><th>Last Login</th><th>Action</th></tr></thead>
            <tbody>
              {visible.map((user) => <tr key={user.id}>
                <td><strong>{user.name}</strong></td>
                <td>{user.email}{user.username && <small className="users-username">@{user.username}</small>}</td>
                <td>{user.phone || "—"}</td><td><span className="users-role">{user.roleName}</span></td>
                <td><span className={`users-status users-status--${user.isActive ? "active" : "inactive"}`}>
                  {user.isActive ? "Active" : "Inactive"}</span></td>
                <td>{lastLogin(user.lastLoginAt)}</td>
                <td><div className="users-row-actions"><button type="button"
                  disabled={changingId === user.id || user.id === getCurrentUser()?.id}
                  onClick={() => void toggleStatus(user)}>
                  {changingId === user.id ? "Saving..." : user.id === getCurrentUser()?.id ? "Current User" : user.isActive ? "Disable" : "Enable"}
                </button></div></td>
              </tr>)}
              {!visible.length && <tr><td colSpan={7} className="users-empty">
                {loading ? "Loading users..." : loadError ? "Unable to load users." : "No users found."}
              </td></tr>}
            </tbody>
          </table></div>
        </section>
        {notice && <p className="roles-notice" role="status">{notice}</p>}
        {modalOpen && <div className="roles-modal-backdrop" onMouseDown={() => { if (!saving) setModalOpen(false); }}>
          <form className="roles-modal users-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => void save(event)}>
            <header><h2>Add User</h2><button type="button" aria-label="Close" disabled={saving}
              onClick={() => setModalOpen(false)}>×</button></header>
            <p>Set account information and assign a role.</p>
            <div className="users-form-grid">
              <label>Name<input value={draft.name} disabled={saving} maxLength={160} required
                onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
              <label>Email<input type="email" value={draft.email} disabled={saving} maxLength={255} required
                onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></label>
              <label>Username<input value={draft.username} disabled={saving} maxLength={80}
                onChange={(event) => setDraft({ ...draft, username: event.target.value })} /></label>
              <label>Phone<input value={draft.phone} disabled={saving} maxLength={40}
                onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></label>
              <label>Role<select value={draft.roleId} disabled={saving} required
                onChange={(event) => setDraft({ ...draft, roleId: event.target.value })}>
                {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
              <label>Password<input type="password" value={draft.password} disabled={saving} minLength={5} required
                autoComplete="new-password" onChange={(event) => setDraft({ ...draft, password: event.target.value })} /></label>
              <label>Status<select value={draft.isActive ? "Active" : "Inactive"} disabled={saving}
                onChange={(event) => setDraft({ ...draft, isActive: event.target.value === "Active" })}>
                <option value="Active">Active</option><option value="Inactive">Inactive</option></select></label>
            </div>
            {error && <span className="roles-form-error" role="alert">{error}</span>}
            <footer><button type="button" disabled={saving} onClick={() => setModalOpen(false)}>Cancel</button>
              <button type="submit" disabled={saving}>{saving ? "Saving..." : "Add User"}</button></footer>
          </form>
        </div>}
      </main>
    </AdminShell>
  );
}
