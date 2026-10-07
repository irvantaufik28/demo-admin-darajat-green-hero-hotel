"use client";

import { useEffect, useState } from "react";

/** Supported application languages. */
export type Lang = "id" | "en";

export const LANGUAGES: ReadonlyArray<{
  code: Lang;
  label: string;
  short: string;
}> = [
  { code: "id", label: "Bahasa Indonesia", short: "ID" },
  { code: "en", label: "English", short: "EN" },
];

const STORAGE_KEY = "green-hero-lang";
const DEFAULT_LANG: Lang = "id";
const EVENT = "green-hero-lang-change";

function isLang(value: unknown): value is Lang {
  return value === "id" || value === "en";
}

/** Read the currently selected language (falls back to the default). */
export function getLang(): Lang {
  if (typeof window === "undefined") return DEFAULT_LANG;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isLang(stored) ? stored : DEFAULT_LANG;
}

/** Persist the selected language and notify subscribers in the same tab. */
export function setLang(lang: Lang): void {
  if (typeof window === "undefined" || !isLang(lang)) return;
  window.localStorage.setItem(STORAGE_KEY, lang);
  document.documentElement.lang = lang;
  window.dispatchEvent(new CustomEvent<Lang>(EVENT, { detail: lang }));
}

/** Subscribe to language changes (same tab via custom event, other tabs via storage). */
export function subscribe(listener: (lang: Lang) => void): () => void {
  const onCustom = (event: Event) => {
    const detail = (event as CustomEvent<Lang>).detail;
    listener(isLang(detail) ? detail : getLang());
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener(getLang());
  };
  window.addEventListener(EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * React hook exposing the active language and a setter.
 * Reactive across components in the same tab and synced across tabs.
 */
export function useLang(): [Lang, (lang: Lang) => void] {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    setLangState(getLang());
    document.documentElement.lang = getLang();
    return subscribe(setLangState);
  }, []);

  return [lang, setLang];
}

/** A nested dictionary of translation strings. */
export type Messages = { [key: string]: string | Messages };

/** A bundle holding both language dictionaries for a feature/page. */
export type MessageBundle = Record<Lang, Messages>;

function resolve(dict: Messages, path: string): string | undefined {
  const value = path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Messages)) {
      return (acc as Messages)[key];
    }
    return undefined;
  }, dict);
  return typeof value === "string" ? value : undefined;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    name in vars ? String(vars[name]) : match,
  );
}

/** Translator function: resolve a dotted key path with optional {placeholder} vars. */
export type Translate = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Hook returning a translator bound to the active language.
 * Pass a bundle `{ en, id }` (typically imported from a feature's locales).
 * Falls back to the other language, then to the key itself, if a string is missing.
 */
export function useTranslations(bundle: MessageBundle): { t: Translate; lang: Lang } {
  const [lang] = useLang();
  const t: Translate = (key, vars) => {
    const primary = resolve(bundle[lang], key);
    const fallback = primary ?? resolve(bundle[lang === "id" ? "en" : "id"], key);
    return interpolate(fallback ?? key, vars);
  };
  return { t, lang };
}
