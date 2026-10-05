export function guestDate(date: string | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`));
}

export function guestMoney(value: number) {
  return `Rp${Number(value).toLocaleString("id-ID")}`;
}

export function guestStatus(status: string) {
  return status === "blacklisted" ? "Blacklisted" : "Active";
}

export function guestSource(source: string) {
  if (source === "walk_in") return "Walk-in";
  if (source === "ota") return "OTA";
  return source.charAt(0).toUpperCase() + source.slice(1);
}

export function reservationStatus(status: string) {
  return status.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("-");
}
