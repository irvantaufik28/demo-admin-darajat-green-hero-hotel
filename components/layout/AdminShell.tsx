"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { clearSession, getSessionRemainingMs, hasSession } from "../../lib/auth";
import { Navbar } from "./Navbar";
import { Sidebar, hydrateSidebarOpenGroups } from "./Sidebar";

let authorizedInTab = false;
let pinnedInTab: boolean | null = null;

type Props = {
  title: string;
  context: string;
  badge?: string;
  children: ReactNode;
};

export function AdminShell({ title, context, badge, children }: Props) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(authorizedInTab);
  const [pinned, setPinned] = useState(pinnedInTab ?? true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [demoNoticeOpen, setDemoNoticeOpen] = useState(false);

  useEffect(() => {
    if (!hasSession()) {
      authorizedInTab = false;
      setAuthorized(false);
      router.replace("/");
      return;
    }
    localStorage.removeItem("green-hero-reservation-operations");
    localStorage.removeItem("green-hero-reservation-statuses");
    hydrateSidebarOpenGroups();
    pinnedInTab = sessionStorage.getItem("green-hero-sidebar-pinned") !== "false";
    setPinned(pinnedInTab);
    if (sessionStorage.getItem("green-hero-demo-notice-pending") === "true") {
      sessionStorage.removeItem("green-hero-demo-notice-pending");
      setDemoNoticeOpen(true);
    }
    authorizedInTab = true;
    setAuthorized(true);
  }, [router]);

  useEffect(() => {
    if (!authorized) return;

    function expireSession() {
      if (getSessionRemainingMs() > 0) return;
      authorizedInTab = false;
      setAuthorized(false);
      router.replace("/");
    }

    const timer = window.setTimeout(expireSession, getSessionRemainingMs());
    window.addEventListener("focus", expireSession);
    document.addEventListener("visibilitychange", expireSession);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", expireSession);
      document.removeEventListener("visibilitychange", expireSession);
    };
  }, [authorized, router]);

  function togglePin() {
    setPinned((value) => {
      pinnedInTab = !value;
      sessionStorage.setItem("green-hero-sidebar-pinned", String(!value));
      return !value;
    });
  }

  function signOut() {
    authorizedInTab = false;
    clearSession();
    router.replace("/");
  }

  function showUnavailable(label: string) {
    setNotice(label + " akan tersedia pada tahap berikutnya.");
    setMobileOpen(false);
  }

  if (!authorized)
    return <main className="dashboard-loading">Memuat area admin...</main>;

  return (
    <div className={pinned ? "admin-shell admin-shell--pinned" : "admin-shell"}>
      <Sidebar
        pinned={pinned}
        onTogglePin={togglePin}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onUnavailable={showUnavailable}
      />
      <Navbar
        title={title}
        context={context}
        badge={badge}
        onOpenMobile={() => setMobileOpen(true)}
        onSignOut={signOut}
      />
      <main className="admin-main">{children}</main>
      {notice && (
        <div className="admin-notice" role="status">
          {notice}
          <button
            type="button"
            aria-label="Tutup pesan"
            onClick={() => setNotice("")}
          >
            <IconClose />
          </button>
        </div>
      )}
      {demoNoticeOpen && (
        <div className="demo-notice-backdrop">
          <section className="demo-notice-modal" role="dialog" aria-modal="true" aria-labelledby="demo-notice-title" aria-describedby="demo-notice-description">
            <span className="demo-notice-eyebrow">GREEN HERO DARAJAT</span>
            <h2 id="demo-notice-title">Selamat datang di versi demo</h2>
            <p id="demo-notice-description">
              Sistem ini dibuat untuk memperlihatkan alur kerja admin hotel.
              Data reservasi, tamu, kamar, dan pembayaran yang tampil adalah data contoh.
              Perubahan tertentu hanya tersimpan selama sesi browser dan belum memproses transaksi nyata.
            </p>
            <button type="button" autoFocus onClick={() => setDemoNoticeOpen(false)}>Mulai Jelajahi</button>
          </section>
        </div>
      )}
    </div>
  );
}

function IconClose() {
  return <span aria-hidden="true">×</span>;
}
