export type RoomType = "deluxe" | "family" | "suite";

export const roomTypes: {
  id: RoomType;
  name: string;
  rate: number;
  available: number;
  capacity: string;
  numbers: string[];
}[] = [
  {
    id: "deluxe",
    name: "Deluxe Room",
    rate: 850000,
    available: 6,
    capacity: "Max 2 Adults + 1 Child",
    numbers: ["201", "202", "203", "204", "205", "206"],
  },
  {
    id: "family",
    name: "Family Room",
    rate: 1250000,
    available: 3,
    capacity: "Max 4 Adults",
    numbers: ["105", "106", "107"],
  },
  {
    id: "suite",
    name: "Suite Room",
    rate: 1650000,
    available: 1,
    capacity: "Max 2 Adults",
    numbers: ["301"],
  },
];

export const extraBedRates: Record<RoomType, number> = {
  deluxe: 150000,
  family: 200000,
  suite: 250000,
};

export function getRoomExtraBedsTotal(
  extraBeds: Record<string, number> | undefined,
) {
  return Object.entries(extraBeds ?? {}).reduce((sum, [unitKey, nights]) => {
    const type = roomTypes.find((room) => unitKey.startsWith(`${room.id}-`));
    return (
      sum + (type ? (extraBedRates[type.id] ?? 0) * Math.max(0, nights) : 0)
    );
  }, 0);
}

export const extras = [
  {
    id: "family-grill",
    label: "BBQ & Grill – Family Grill Package",
    price: 1249000,
    unit: "/ paket",
    perNight: false,
  },
  {
    id: "ayam-bakar",
    label: "Food & Grill – Ayam Bakar Gathering",
    price: 649000,
    unit: "/ paket",
    perNight: false,
  },
  {
    id: "birthday",
    label: "Birthday Celebration – Celebration Setup",
    price: 949000,
    unit: "/ paket",
    perNight: false,
  },
  {
    id: "extra-bed",
    label: "Extra Bed",
    price: 250000,
    unit: "/ bed / malam",
    perNight: true,
  },
  {
    id: "breakfast",
    label: "Additional Breakfast",
    price: 100000,
    unit: "/ orang / malam",
    perNight: true,
  },
] as const;

export function getExtraCost(id: string, quantity: number, nights: number) {
  const extra = extras.find((item) => item.id === id);
  return extra ? extra.price * quantity * (extra.perNight ? nights : 1) : 0;
}

export function formatRupiah(value: number) {
  return "Rp" + new Intl.NumberFormat("id-ID").format(value);
}

export function formatStayDate(value: string) {
  const date = new Date(value + "T00:00:00");
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(date);
}

export function calculateNights(checkIn: string, checkOut: string) {
  const start = Date.parse(checkIn + "T00:00:00Z");
  const end = Date.parse(checkOut + "T00:00:00Z");
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86400000));
}
