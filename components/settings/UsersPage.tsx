"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AdminShell } from "../layout/AdminShell";
import { readCustomRoles } from "../../lib/role-settings";
import { roles } from "../../lib/roles-permissions-data";
import { initialUsers, type AdminUser } from "../../lib/users-data";

type ModalMode = "view" | "edit" | "add";
type Draft = Pick<AdminUser, "name" | "email" | "phone" | "role" | "status">;
const emptyDraft: Draft = { name: "", email: "", phone: "", role: "Staff", status: "Active" };
const storageKey = "green-hero-admin-users";

function readUsers(): AdminUser[] {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(storageKey) || "null");
    if (!Array.isArray(parsed)) return initialUsers;
    return parsed.filter((item): item is AdminUser =>
      typeof item?.id === "number" && typeof item?.name === "string" &&
      typeof item?.email === "string" && typeof item?.role === "string" &&
      (item?.status === "Active" || item?.status === "Inactive"),
    );
  } catch {
    return initialUsers;
  }
}

export function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [availableRoles, setAvailableRoles] = useState<string[]>([...roles]);
  const [modal, setModal] = useState<{ mode: ModalMode; id?: number } | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selected = users.find((user) => user.id === modal?.id);
  const visible = useMemo(() => users.filter((user) =>
    (!statusFilter || user.status === statusFilter) &&
    (!query || `${user.name} ${user.email} ${user.phone} ${user.role}`
      .toLowerCase().includes(query.toLowerCase())),
  ), [users, statusFilter, query]);

  useEffect(() => {
    setUsers(readUsers());
    setAvailableRoles([...roles, ...readCustomRoles().map((role) => role.name)]);
  }, []);

  function persist(next: AdminUser[]) {
    setUsers(next);
    sessionStorage.setItem(storageKey, JSON.stringify(next));
  }

  function open(mode: ModalMode, user?: AdminUser) {
    setDraft(user ? {
      name: user.name, email: user.email, phone: user.phone,
      role: user.role, status: user.status,
    } : { ...emptyDraft });
    setError("");
    setModal({ mode, id: user?.id });
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal || modal.mode === "view") return;
    const nextDraft = {
      ...draft,
      name: draft.name.trim(),
      email: draft.email.trim().toLowerCase(),
      phone: draft.phone.trim(),
    };
    if (!nextDraft.name || !nextDraft.email || !nextDraft.phone) {
      setError("Name, email / username, and phone are required.");
      return;
    }
    if (users.some((user) => user.email.toLowerCase() === nextDraft.email && user.id !== modal.id)) {
      setError("Email / username is already used.");
      return;
    }
    if (modal.mode === "add") {
      const id = Math.max(0, ...users.map((user) => user.id)) + 1;
      persist([...users, { id, ...nextDraft, lastLogin: "Never" }]);
      setNotice(`${nextDraft.name} added.`);
    } else {
      persist(users.map((user) => user.id === modal.id ? { ...user, ...nextDraft } : user));
      setNotice(`${nextDraft.name} updated.`);
    }
    setModal(null);
  }

  function toggleStatus(user: AdminUser) {
    const nextStatus = user.status === "Active" ? "Inactive" : "Active";
    persist(users.map((item) => item.id === user.id ? { ...item, status: nextStatus } : item));
    setNotice(`${user.name} is now ${nextStatus.toLowerCase()}.`);
  }

  return (
    <AdminShell title="Settings" context="Users">
      <main className="users-page">
        <header className="users-heading">
          <div>
            <span className="roles-eyebrow">TEAM ACCESS</span>
            <h1>Users</h1>
            <p>Manage admin accounts, assigned roles, and access status.</p>
          </div>
          <button type="button" className="roles-add-button" onClick={() => open("add")}>+ Add User</button>
        </header>

        <section className="users-panel">
          <div className="users-toolbar">
            <h2>User List <span>{visible.length} users</span></h2>
            <div>
              <input aria-label="Search users" placeholder="Search name, email, phone..."
                value={query} onChange={(event) => setQuery(event.target.value)} />
              <select aria-label="Filter status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="users-table-scroll">
            <table className="users-table">
              <thead><tr>
                <th>Name</th><th>Email / Username</th><th>Phone</th><th>Role</th>
                <th>Status</th><th>Last Login</th><th>Action</th>
              </tr></thead>
              <tbody>
                {visible.map((user) => <tr key={user.id}>
                  <td><strong>{user.name}</strong></td>
                  <td>{user.email}</td><td>{user.phone}</td>
                  <td><span className="users-role">{user.role}</span></td>
                  <td><span className={`users-status users-status--${user.status.toLowerCase()}`}>{user.status}</span></td>
                  <td>{user.lastLogin}</td>
                  <td><div className="users-row-actions">
                    <button type="button" onClick={() => toggleStatus(user)}>{user.status === "Active" ? "Disable" : "Enable"}</button>
                  </div></td>
                </tr>)}
                {visible.length === 0 && <tr><td colSpan={7} className="users-empty">No users found.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        {notice && <p className="roles-notice" role="status">{notice}</p>}

        {modal && <div className="roles-modal-backdrop" onMouseDown={() => setModal(null)}>
          <form className="roles-modal users-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={save}>
            <header>
              <h2>{modal.mode === "add" ? "Add User" : modal.mode === "edit" ? "Edit User" : "User Details"}</h2>
              <button type="button" aria-label="Close" onClick={() => setModal(null)}>×</button>
            </header>
            <p>{modal.mode === "view" ? "Account information and access status." : "Set account information and assign a role."}</p>
            <div className="users-form-grid">
              <label>Name
                <input value={draft.name} disabled={modal.mode === "view"} maxLength={80}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
              </label>
              <label>Email / Username
                <input value={draft.email} disabled={modal.mode === "view"} maxLength={120}
                  onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
              </label>
              <label>Phone
                <input value={draft.phone} disabled={modal.mode === "view"} maxLength={30}
                  onChange={(event) => setDraft({ ...draft, phone: event.target.value })} />
              </label>
              <label>Role
                <select value={draft.role} disabled={modal.mode === "view"}
                  onChange={(event) => setDraft({ ...draft, role: event.target.value })}>
                  {availableRoles.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </label>
              <label>Status
                <select value={draft.status} disabled={modal.mode === "view"}
                  onChange={(event) => setDraft({ ...draft, status: event.target.value as AdminUser["status"] })}>
                  <option value="Active">Active</option><option value="Inactive">Inactive</option>
                </select>
              </label>
              {modal.mode !== "add" && <label>Last Login
                <input value={selected?.lastLogin ?? "Never"} disabled />
              </label>}
            </div>
            {error && <span className="roles-form-error" role="alert">{error}</span>}
            <footer>
              <button type="button" onClick={() => setModal(null)}>{modal.mode === "view" ? "Close" : "Cancel"}</button>
              {modal.mode === "view" ?
                <button type="button" onClick={() => selected && open("edit", selected)}>Edit User</button> :
                <button type="submit">{modal.mode === "add" ? "Add User" : "Save Changes"}</button>}
            </footer>
          </form>
        </div>}
      </main>
    </AdminShell>
  );
}
