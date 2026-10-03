import { initialReservations, type ReservationRecord } from "../../reservations/constants/reservation-list-data";

export type GuestProfile = {
  key: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  status: "Active" | "Blacklisted";
  totalStays: number;
  totalNights: number;
  totalSpend: number;
  lastStay: string | null;
  history: ReservationRecord[];
};

const details: Record<string, { email: string; address: string; notes: string }> = {
  "Andi Pratama": { email: "andi.pratama@email.com", address: "Bandung, Jawa Barat", notes: "Prefers a quiet room." },
  "Dimas Prakoso": { email: "dimas.prakoso@email.com", address: "Garut, Jawa Barat", notes: "" },
  "Intan Permata": { email: "intan.permata@email.com", address: "Jakarta Selatan", notes: "" },
  "Raka Wijaya": { email: "raka.wijaya@email.com", address: "Bandung, Jawa Barat", notes: "" },
  "Tasya Kirana": { email: "tasya.kirana@email.com", address: "Jakarta Barat", notes: "" },
};

const daysBetween = (start: string, end: string) => Math.max(0,
  Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000),
);

function guestKey(name: string, phone: string) {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${phone.replace(/\D/g, "").slice(-4)}`;
}

export const guests: GuestProfile[] = [...new Map(initialReservations.map((row) =>
  [`${row.guestName}|${row.whatsapp}`, { name: row.guestName, phone: row.whatsapp }],
)).values()].map(({ name, phone }) => {
  const history = initialReservations.filter((row) =>
    row.guestName === name && row.whatsapp === phone,
  ).sort((a, b) => b.checkIn.localeCompare(a.checkIn));
  const stays = history.filter((row) =>
    row.status === "Checked-in" || row.status === "Checked-out",
  );
  const bookable = history.filter((row) =>
    row.status === "Confirmed" || row.status === "Checked-in" || row.status === "Checked-out",
  );
  const extra = details[name];
  return {
    key: guestKey(name, phone), name, phone,
    email: history.find((row) => row.email)?.email || extra?.email || "—",
    address: extra?.address || "—",
    notes: extra?.notes || "",
    status: "Active" as const,
    totalStays: stays.length,
    totalNights: stays.reduce((sum, row) => sum + daysBetween(row.checkIn, row.checkOut), 0),
    totalSpend: bookable.reduce((sum, row) => sum + (row.total || 0), 0),
    lastStay: stays.reduce<string | null>((latest, row) =>
      !latest || row.checkOut > latest ? row.checkOut : latest, null),
    history,
  };
}).sort((a, b) => a.name.localeCompare(b.name));

export const guestDate = (date: string | null) => date ?
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`)) : "—";

export const guestMoney = (value: number) => `Rp${value.toLocaleString("id-ID")}`;
