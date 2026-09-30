"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { clearSession, hasSession } from "../../lib/auth";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";

type Props = { title: string; context: string; badge?: string; children: ReactNode };

export function AdminShell({ title, context, badge, children }: Props) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!hasSession()) { router.replace("/"); return; }
    localStorage.removeItem("green-hero-reservation-operations");
    localStorage.removeItem("green-hero-reservation-statuses");
    setAuthorized(true);
    setPinned(localStorage.getItem("green-hero-sidebar-pinned") === "true");
  }, [router]);

  function togglePin() {
    setPinned(value => {
      localStorage.setItem("green-hero-sidebar-pinned", String(!value));
      return !value;
    });
  }

  function signOut() {
    clearSession();
    router.replace("/");
  }

  function showUnavailable(label: string) {
    setNotice(label + " akan tersedia pada tahap berikutnya.");
    setMobileOpen(false);
  }

  if (!authorized) return <main className="dashboard-loading">Memuat area admin...</main>;

  return (
    <div className={pinned ? "admin-shell admin-shell--pinned" : "admin-shell"}>
      <Sidebar pinned={pinned} onTogglePin={togglePin} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} onUnavailable={showUnavailable} />
      <Navbar title={title} context={context} badge={badge} onOpenMobile={() => setMobileOpen(true)} onSignOut={signOut} />
      <main className="admin-main">{children}</main>
      {notice && <div className="admin-notice" role="status">{notice}<button type="button" aria-label="Tutup pesan" onClick={() => setNotice("")}><IconClose /></button></div>}
    </div>
  );
}

function IconClose() {
  return <span aria-hidden="true">×</span>;
}
