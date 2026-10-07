"use client";
import "../styles/settings.css";

import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AdminShell } from "../../../components/layout/AdminShell";
import { getCurrentUser, restoreSession } from "../../../lib/auth";
import { createUser, getUserRoles, getUsers, setUserStatus, type AdminUser, type UserRole } from "../services/users";
import { useTranslations, type Translate } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

type Draft = { name: string; email: string; username: string; phone: string; roleId: string; password: string; isActive: boolean };
const emptyDraft: Draft = { name: "", email: "", username: "", phone: "", roleId: "", password: "", isActive: true };

function lastLogin(value: string | null, t: Translate) {
  if (!value) return t("users.neverLoggedIn");
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

export function UsersPage() {
  const { t } = useTranslations({ en, id });
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
          setLoadError(t("common.sessionExpired"));
          return;
        }
        const [userList, roleList] = await Promise.all([
          getUsers(controller.signal), getUserRoles(controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setUsers(userList.items);
        setRoles(roleList.items);
      } catch (cause) {
        if (!controller.signal.aborted) setLoadError(cause instanceof Error ? cause.message : t("users.errors.loadFailed"));
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
      setError(t("users.errors.validation"));
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
      setNotice(t("users.notices.added", { name }));
      setModalOpen(false);
      setDraft(emptyDraft);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("users.errors.createFailed"));
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
      setNotice(t("users.notices.statusChanged", {
        name: user.name,
        status: response.user.isActive ? t("users.status.active").toLowerCase() : t("users.status.inactive").toLowerCase(),
      }));
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : t("users.errors.statusChangeFailed"));
    } finally {
      setChangingId(null);
    }
  }

  return (
    <AdminShell title={t("shell.title")} context={t("shell.usersContext")}>
      <main className="users-page">
        <header className="users-heading">
          <div><span className="roles-eyebrow">{t("users.eyebrow")}</span><h1>{t("users.title")}</h1>
            <p>{t("users.description")}</p></div>
          <button type="button" className="roles-add-button" disabled={!roles.length} onClick={openAdd}>{t("users.addUser")}</button>
        </header>
        <section className="users-panel">
          <div className="users-toolbar">
            <h2>{t("users.listTitle")} <span>{t("users.count", { total: visible.length })}</span></h2>
            <div><input aria-label={t("users.searchAriaLabel")} placeholder={t("users.searchPlaceholder")}
              value={query} onChange={(event) => setQuery(event.target.value)} />
              <select aria-label={t("users.statusFilterAriaLabel")} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">{t("users.statusOptions.all")}</option><option value="Active">{t("users.statusOptions.active")}</option><option value="Inactive">{t("users.statusOptions.inactive")}</option>
              </select></div>
          </div>
          {loadError && <p className="roles-notice" role="alert">{loadError}{" "}
            <button type="button" onClick={() => setReloadKey((value) => value + 1)}>{t("common.retry")}</button></p>}
          <div className="users-table-scroll"><table className="users-table">
            <thead><tr><th>{t("users.table.name")}</th><th>{t("users.table.emailUsername")}</th><th>{t("users.table.phone")}</th><th>{t("users.table.role")}</th>
              <th>{t("users.table.status")}</th><th>{t("users.table.lastLogin")}</th><th>{t("users.table.action")}</th></tr></thead>
            <tbody>
              {!loading && visible.map((user) => <tr key={user.id}>
                <td><strong>{user.name}</strong></td>
                <td>{user.email}{user.username && <small className="users-username">@{user.username}</small>}</td>
                <td>{user.phone || "—"}</td><td><span className="users-role">{user.roleName}</span></td>
                <td><span className={`users-status users-status--${user.isActive ? "active" : "inactive"}`}>
                  {user.isActive ? t("users.status.active") : t("users.status.inactive")}</span></td>
                <td>{lastLogin(user.lastLoginAt, t)}</td>
                <td><div className="users-row-actions"><button type="button"
                  disabled={changingId === user.id || user.id === getCurrentUser()?.id}
                  onClick={() => void toggleStatus(user)}>
                  {changingId === user.id ? t("users.actions.saving") : user.id === getCurrentUser()?.id ? t("users.actions.currentUser") : user.isActive ? t("users.actions.disable") : t("users.actions.enable")}
                </button></div></td>
              </tr>)}
              {(loading || !visible.length) && <tr><td colSpan={7} className="users-empty">
                {loading ? <LoadingSkeleton /> : loadError ? t("users.errors.unableToLoad") : t("users.empty")}
              </td></tr>}
            </tbody>
          </table></div>
        </section>
        {notice && <p className="roles-notice" role="status">{notice}</p>}
        {modalOpen && <div className="roles-modal-backdrop" onMouseDown={() => { if (!saving) setModalOpen(false); }}>
          <form className="roles-modal users-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => void save(event)}>
            <header><h2>{t("users.modal.title")}</h2><button type="button" aria-label={t("common.close")} disabled={saving}
              onClick={() => setModalOpen(false)}>×</button></header>
            <p>{t("users.modal.description")}</p>
            <div className="users-form-grid">
              <label>{t("users.modal.name")}<input value={draft.name} disabled={saving} maxLength={160} required
                onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
              <label>{t("users.modal.email")}<input type="email" value={draft.email} disabled={saving} maxLength={255} required
                onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></label>
              <label>{t("users.modal.username")}<input value={draft.username} disabled={saving} maxLength={80}
                onChange={(event) => setDraft({ ...draft, username: event.target.value })} /></label>
              <label>{t("users.modal.phone")}<input value={draft.phone} disabled={saving} maxLength={40}
                onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></label>
              <label>{t("users.modal.role")}<select value={draft.roleId} disabled={saving} required
                onChange={(event) => setDraft({ ...draft, roleId: event.target.value })}>
                {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
              <label>{t("users.modal.password")}<input type="password" value={draft.password} disabled={saving} minLength={5} required
                autoComplete="new-password" onChange={(event) => setDraft({ ...draft, password: event.target.value })} /></label>
              <label>{t("users.modal.status")}<select value={draft.isActive ? "Active" : "Inactive"} disabled={saving}
                onChange={(event) => setDraft({ ...draft, isActive: event.target.value === "Active" })}>
                <option value="Active">{t("users.status.active")}</option><option value="Inactive">{t("users.status.inactive")}</option></select></label>
            </div>
            {error && <span className="roles-form-error" role="alert">{error}</span>}
            <footer><button type="button" disabled={saving} onClick={() => setModalOpen(false)}>{t("common.cancel")}</button>
              <button type="submit" disabled={saving}>{saving ? t("users.actions.saving") : t("users.modal.addUser")}</button></footer>
          </form>
        </div>}
      </main>
    </AdminShell>
  );
}
