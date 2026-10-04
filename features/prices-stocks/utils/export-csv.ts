import type { PriceStock } from "../constants/prices-stocks-data";

type ExportInput = {
  roomName: string;
  fromDate: string;
  toDate: string;
  dates: string[];
  rows: Record<string, PriceStock>;
};

function csvCell(value: string | number | boolean | null | undefined): string {
  const raw = String(value ?? "");
  const safe = typeof value === "string" && /^[=+\-@]/.test(raw)
    ? `'${raw}`
    : raw;

  return `"${safe.replaceAll('"', '""')}"`;
}

export function downloadPricesStocksCsv({
  roomName,
  fromDate,
  toDate,
  dates,
  rows,
}: ExportInput): void {
  const headers = [
    "Room Type",
    "Day",
    "Date",
    "Sellable Stock",
    "Sold",
    "Remaining Stock",
    "Available Rooms",
    "Price (IDR)",
    "Website Promo",
    "Web Price",
    "Front Desk Promo",
    "Front Desk Price",
    "Min. Night",
    "Stop Sell",
  ];

  const records = dates.map((date) => {
    const row = rows[date];
    return [
      roomName,
      row?.day,
      date,
      row?.sellableStock,
      row?.bookedRooms,
      row?.remainingStock,
      row?.availableRooms,
      row?.price,
      row?.websitePromo,
      row?.webPrice,
      row?.frontDeskPromo,
      row?.frontDeskPrice,
      row?.minNight,
      row?.stopSell == null ? "" : row.stopSell ? "Yes" : "No",
    ].map(csvCell).join(",");
  });

  const csv = [headers.map(csvCell).join(","), ...records].join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  const slug = roomName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  link.href = url;
  link.download = `prices-stocks-${slug}-${fromDate}-to-${toDate}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
