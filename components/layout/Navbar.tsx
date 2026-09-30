"use client";

import { useState } from "react";
import { Icon } from "../ui/Icon";

type Props = {
  title: string;
  context: string;
  badge?: string;
  onOpenMobile: () => void;
  onSignOut: () => void;
};

export function Navbar({ title, context, badge, onOpenMobile, onSignOut }: Props) {
  const [menu, setMenu] = useState<"notifications" | "profile" | null>(null);
  return (
    <header className="admin-navbar">
      <div className="navbar-location">
        <button type="button" className="navbar-mobile-button" onClick={onOpenMobile} aria-label="Buka navigasi"><Icon name="menu" /></button>
        <strong>{title}</strong><span className="navbar-divider">/</span><span className="navbar-context">{context}</span>{badge && <span className="navbar-mode">{badge}</span>}
      </div>
      <div className="navbar-actions">
        <div className="navbar-date"><Icon name="calendar" width={16} height={16} /><span>29 Sep 2026</span></div>
        {badge && <span className="navbar-shift"><i />Shift A (07:00 - 15:00)</span>}
        <div className="navbar-popover-anchor">
          <button type="button" className="navbar-icon-button" aria-label="Notifikasi" aria-expanded={menu === "notifications"} onClick={() => setMenu(value => value === "notifications" ? null : "notifications")}>
            <Icon name="bell" width={20} height={20} /><i aria-hidden="true" />
          </button>
          {menu === "notifications" && <div className="navbar-popover"><strong>Notifications</strong><p>4 tindakan operasional menunggu hari ini.</p></div>}
        </div>
        <span className="navbar-separator" />
        <div className="navbar-popover-anchor">
          <button type="button" className="navbar-profile" aria-expanded={menu === "profile"} onClick={() => setMenu(value => value === "profile" ? null : "profile")}>
            <span className="navbar-avatar">FO</span>
            <span className="navbar-profile__text"><strong>Front Office</strong><small>Darajat Reception</small></span>
          </button>
          {menu === "profile" && <div className="navbar-popover navbar-popover--profile"><strong>Front Office</strong><button type="button" onClick={onSignOut}><Icon name="logout" width={16} height={16} />Keluar</button></div>}
        </div>
      </div>
    </header>
  );
}
