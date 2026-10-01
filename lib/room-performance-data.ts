import { initialReservations } from "./reservation-list-data";
import { roomTypes } from "./walk-in-data";

export type OccupancyMode = "actual" | "projected";
export type PerformanceRow = {
  name: string;
  rooms: number;
  available: number;
  sold: number;
  cancelled: number;
  revenue: number;
};

export function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function weekDates(start: string) {
  return Array.from({ length: 7 }, (_, index) => shiftDate(start, index));
}

export function summarizePerformance(
  dates: string[],
  roomId: string,
  source: string,
  mode: OccupancyMode,
) {
  const selectedRooms = roomTypes.filter((room) => !roomId || room.id === roomId);
  const reservations = initialReservations.filter((row) => !source || row.source === source);
  const daily = dates.map((date) => {
    const rows = selectedRooms.map((room): PerformanceRow => {
      const occupied = reservations.filter((row) =>
        row.checkIn <= date && date < row.checkOut &&
        (row.status === "Checked-in" || row.status === "Checked-out" ||
          (mode === "projected" && row.status === "Confirmed")),
      );
      const cancelled = reservations.filter((row) =>
        row.checkIn <= date && date < row.checkOut && row.status === "Cancelled",
      );
      const quantity = (row: (typeof reservations)[number]) =>
        row.quantities?.[room.id] ?? (row.room === room.name ? 1 : 0);
      const sold = Math.min(room.available, occupied.reduce((sum, row) => sum + quantity(row), 0));
      return {
        name: room.name,
        rooms: room.available,
        available: room.available,
        sold,
        cancelled: cancelled.reduce((sum, row) => sum + quantity(row), 0),
        revenue: sold * room.rate,
      };
    });
    return { date, rows, total: combineRows(rows, "Total") };
  });
  const byRoom = selectedRooms.map((room) =>
    combineRows(daily.map((day) => day.rows.find((row) => row.name === room.name)!), room.name),
  );
  const total = combineRows(byRoom, "Total");
  total.rooms = byRoom.reduce((sum, row) => sum + row.rooms, 0);
  return { daily, byRoom, total };
}

export function combineRows(rows: PerformanceRow[], name: string): PerformanceRow {
  return {
    name,
    rooms: Math.max(0, ...rows.map((row) => row.rooms)),
    available: rows.reduce((sum, row) => sum + row.available, 0),
    sold: rows.reduce((sum, row) => sum + row.sold, 0),
    cancelled: rows.reduce((sum, row) => sum + row.cancelled, 0),
    revenue: rows.reduce((sum, row) => sum + row.revenue, 0),
  };
}

export const occupancy = (row: PerformanceRow) =>
  row.available ? (row.sold / row.available) * 100 : 0;

export const averageRate = (row: PerformanceRow) =>
  row.sold ? row.revenue / row.sold : 0;
