"use client";

import { ReservationApiForm } from "./ReservationApiForm";

export function ReservationPage({ mode }: { mode: "walk-in" | "phone" }) {
  return <ReservationApiForm source={mode === "phone" ? "phone" : "walk_in"} />;
}
