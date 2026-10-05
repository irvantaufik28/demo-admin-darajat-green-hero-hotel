"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "../ui/Icon";
import type { AuthUser } from "../../lib/auth";

type Props = {
  user: AuthUser | null;
  title: string;
  context: string;
  badge?: string;
  onOpenMobile: () => void;
  onSignOut: () => void;
};

export function Navbar({
  user,
  title,
  context,
  badge,
  onOpenMobile,
  onSignOut,
}: Props) {
  const [menu, setMenu] = useState<"notifications" | "profile" | null>(null);
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    });
    const updateDate = () => setCurrentDate(formatter.format(new Date()));

    updateDate();
    const interval = window.setInterval(updateDate, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <header className="admin-navbar">
      <div className="navbar-location">
        <button
          type="button"
          className="navbar-mobile-button"
          onClick={onOpenMobile}
          aria-label="Buka navigasi"
        >
          <Icon name="menu" />
        </button>
        <strong>{title}</strong>
        <span className="navbar-divider">/</span>
        <span className="navbar-context">{context}</span>
        {badge && <span className="navbar-mode">{badge}</span>}
      </div>
      <div className="navbar-actions">
        <div className="navbar-date">
          <Icon name="calendar" width={16} height={16} />
          <span>{currentDate || "—"}</span>
        </div>
        {badge && (
          <span className="navbar-shift">
            <i />
            Shift A (07:00 - 15:00)
          </span>
        )}
        <div className="navbar-popover-anchor">
          <button
            type="button"
            className="navbar-icon-button"
            aria-label="Notifikasi"
            aria-expanded={menu === "notifications"}
            onClick={() =>
              setMenu((value) =>
                value === "notifications" ? null : "notifications",
              )
            }
          >
            <Icon name="bell" width={20} height={20} />
            <i aria-hidden="true" />
          </button>
          {menu === "notifications" && (
            <div className="navbar-popover">
              <strong>Notifications</strong>
              <p>4 tindakan operasional menunggu hari ini.</p>
            </div>
          )}
        </div>
        <span className="navbar-separator" />
        <div className="navbar-popover-anchor">
          <button
            type="button"
            className="navbar-profile"
            aria-expanded={menu === "profile"}
            onClick={() =>
              setMenu((value) => (value === "profile" ? null : "profile"))
            }
          >
            <span className="navbar-avatar">{user?.name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "GH"}</span>
            <span className="navbar-profile__text">
              <strong>{user?.name ?? "User"}</strong>
              <small>{user?.roleName ?? "Green Hero Darajat"}</small>
            </span>
          </button>
          {menu === "profile" && (
            <div className="navbar-popover navbar-popover--profile">
              <strong>{user?.name ?? "User"}</strong>
              <Link href="/profile" onClick={() => setMenu(null)}>Profile</Link>
              <Link href="/change-password" onClick={() => setMenu(null)}>Change Password</Link>
              <button type="button" onClick={onSignOut}>
                <Icon name="logout" width={16} height={16} />
                Keluar
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
