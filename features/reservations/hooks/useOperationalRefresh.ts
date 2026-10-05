"use client";

import { useEffect, useState } from "react";

export function useOperationalRefresh() {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") {
        setRevision((current) => current + 1);
      }
    };
    let timer: number;
    const scheduleNextMinute = () => {
      timer = window.setTimeout(() => {
        refresh();
        scheduleNextMinute();
      }, 60_000 - (Date.now() % 60_000) + 250);
    };
    scheduleNextMinute();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  return revision;
}
