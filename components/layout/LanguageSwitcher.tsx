"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { LANGUAGES, useLang, type Lang } from "../../lib/i18n";

export function LanguageSwitcher() {
  const [lang, setLang] = useLang();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!anchorRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const current = LANGUAGES.find((item) => item.code === lang) ?? LANGUAGES[0];

  function choose(code: Lang) {
    setLang(code);
    setOpen(false);
  }

  return (
    <div className="navbar-popover-anchor" ref={anchorRef}>
      <button
        type="button"
        className="navbar-lang"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Language: ${current.label}`}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="globe" width={18} height={18} />
        <span className="navbar-lang__code">{current.short}</span>
        <Icon
          name="chevron"
          width={14}
          height={14}
          className="navbar-lang__caret"
        />
      </button>
      {open && (
        <div
          className="navbar-popover navbar-popover--lang"
          role="listbox"
          aria-label="Select language"
        >
          {LANGUAGES.map((item) => (
            <button
              key={item.code}
              type="button"
              role="option"
              aria-selected={item.code === lang}
              className={
                item.code === lang
                  ? "navbar-lang__option navbar-lang__option--active"
                  : "navbar-lang__option"
              }
              onClick={() => choose(item.code)}
            >
              <span className="navbar-lang__badge">{item.short}</span>
              <span>{item.label}</span>
              {item.code === lang && (
                <span className="navbar-lang__check" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
