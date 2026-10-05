export type PriceStock = {
  date: string;
  day: string;
  sellableStock: number | null;
  remainingStock: number | null;
  availableRooms: number | null;
  price: number | null;
  websitePromo: string | null;
  webPrice: number | null;
  frontDeskPromo: string | null;
  frontDeskPrice: number | null;
  minNight: number | null;
  stopSell: boolean | null;
  version?: number | null;
  isConfigured?: boolean;
  bookedRooms?: number;
};

export function formatStockDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export function formatStockPrice(value: number) {
  return "Rp" + new Intl.NumberFormat("id-ID").format(value);
}
