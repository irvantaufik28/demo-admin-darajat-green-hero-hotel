"use client";
import "../../dashboard/styles/dashboard.css";
import "../styles/reservations.css";

import { ReservationApiForm } from "../components/ReservationApiForm";

export function ReservationPage({ mode }: { mode: "walk-in" | "phone" }) {
  return <ReservationApiForm source={mode === "phone" ? "phone" : "walk_in"} />;
}
