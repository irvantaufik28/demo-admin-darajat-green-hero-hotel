export type PriceStock = {
  date: string;
  day: string;
  stock: number | null;
  price: number | null;
  webPromo: string | null;
  webDiscount: number;
  walkInPromo: string | null;
  walkInDiscount: number;
  minNight: number | null;
  stopSell: boolean | null;
};

export const priceStockRoomTypes = [
  { id: "deluxe", name: "Deluxe Room", units: 5, numbers: "201, 202, 203, 204, 205", basePrice: 1500000 },
  { id: "family", name: "Family Room", units: 3, numbers: "101, 102, 103", basePrice: 1850000 },
  { id: "suite", name: "Suite Room", units: 2, numbers: "301, 302", basePrice: 2400000 },
] as const;

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Fixed demo dates: 29 Sep–28 Oct 2026. No current-date dependency.
export const initialPriceStocks: PriceStock[] = Array.from({ length: 30 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 8, 29 + index));
  const day = dayNames[date.getUTCDay()];
  const weekend = day === "Fri" || day === "Sat";
  const webPromo = index % 7 === 1 || weekend ? "Weekend Promo" : index % 7 === 5 ? "Stay Longer Save More" : null;
  const walkInPromo = weekend ? "Walk-in Weekend" : index % 7 === 0 || index % 7 === 5 ? "Front Desk Promo" : null;
  return {
    date: date.toISOString().slice(0, 10),
    day,
    stock: index % 11 === 2 ? 0 : index % 9 === 5 ? 2 : index % 4 === 1 ? 4 : 5,
    price: weekend ? 1750000 : index % 7 === 2 || index % 7 === 5 ? 1600000 : 1500000,
    webPromo,
    webDiscount: webPromo ? 10 : 0,
    walkInPromo,
    walkInDiscount: walkInPromo ? (weekend ? 5 : 5) : 0,
    minNight: weekend || index % 7 === 2 ? 2 : 1,
    stopSell: index % 14 === 3,
  };
});

export function formatStockDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export function formatStockPrice(value: number) {
  return "Rp" + new Intl.NumberFormat("id-ID").format(value);
}
