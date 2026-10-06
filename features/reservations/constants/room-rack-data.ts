// Static demo data for the Room Rack / Tape Chart view.
// No API calls — purely for the visual front-desk slice.

export type RoomStatus =
  | "vacant"
  | "occupied"
  | "reserved"
  | "due-out"
  | "maintenance";

export type BookingSource =
  | "Walk-in"
  | "Website"
  | "OTA Agoda"
  | "OTA Booking.com"
  | "Phone"
  | "Direct";

export type ReservationStatus =
  | "in-house"
  | "confirmed"
  | "deposit-paid"
  | "vip-paid";

export type Reservation = {
  id: string;
  guestName: string;
  source: BookingSource;
  status: ReservationStatus;
  checkIn: string; // ISO date (YYYY-MM-DD)
  checkOut: string; // ISO date (YYYY-MM-DD)
};

export type RoomUnit = {
  number: string;
  bedType: string;
  floor: string;
  status: RoomStatus;
  maintenanceNote?: string;
  reservations: Reservation[];
};

export type RoomTypeGroup = {
  name: string;
  unitCount: number;
  rooms: RoomUnit[];
  dailyRates: number[]; // 14 days of rates
};

export type RoomRackSummary = {
  vacantClean: number;
  reservedUpcoming: number;
  occupiedInHouse: number;
  dueOutToday: number;
  outOfOrder: number;
};

// The design anchors "today" at 07 Oct 2026 and shows a 14-day window.
export const RACK_START_DATE = "2026-10-07";
export const RACK_DAYS = 14;

export const roomRackSummary: RoomRackSummary = {
  vacantClean: 6,
  reservedUpcoming: 8,
  occupiedInHouse: 5,
  dueOutToday: 2,
  outOfOrder: 1,
};

// Helper to build a 14-day rate row quickly.
const rate = (base: number, weekend: number): number[] =>
  Array.from({ length: RACK_DAYS }, (_, i) => {
    // Window starts Wed 07 Oct 2026 (index 0). Sat/Sun are indexes 3,4 and 10,11.
    const weekendIdx = new Set([3, 4, 10, 11]);
    return weekendIdx.has(i) ? weekend : base;
  });

export const roomTypeGroups: RoomTypeGroup[] = [
  {
    name: "Deluxe Room",
    unitCount: 4,
    dailyRates: rate(850_000, 1_050_000),
    rooms: [
      {
        number: "101",
        bedType: "King Bed",
        floor: "Floor 1",
        status: "occupied",
        reservations: [
          {
            id: "RES-10492",
            guestName: "Hendra Pratama",
            source: "Website",
            status: "in-house",
            checkIn: "2026-10-07",
            checkOut: "2026-10-11",
          },
        ],
      },
      {
        number: "102",
        bedType: "Twin Bed",
        floor: "Floor 1",
        status: "due-out",
        reservations: [
          {
            id: "RES-10488",
            guestName: "Clara Wijaya",
            source: "OTA Agoda",
            status: "in-house",
            checkIn: "2026-10-06",
            checkOut: "2026-10-07",
          },
          {
            id: "RES-10511",
            guestName: "Michael Tan",
            source: "Phone",
            status: "confirmed",
            checkIn: "2026-10-09",
            checkOut: "2026-10-13",
          },
        ],
      },
      {
        number: "103",
        bedType: "King Bed",
        floor: "Floor 1",
        status: "reserved",
        reservations: [
          {
            id: "RES-10520",
            guestName: "Aisyah Rahman",
            source: "OTA Booking.com",
            status: "deposit-paid",
            checkIn: "2026-10-08",
            checkOut: "2026-10-12",
          },
          {
            id: "RES-10547",
            guestName: "David Kurniawan",
            source: "Website",
            status: "confirmed",
            checkIn: "2026-10-15",
            checkOut: "2026-10-19",
          },
        ],
      },
      {
        number: "104",
        bedType: "Twin Bed",
        floor: "Floor 1",
        status: "vacant",
        reservations: [
          {
            id: "RES-10559",
            guestName: "Siti Nurhaliza",
            source: "Walk-in",
            status: "confirmed",
            checkIn: "2026-10-12",
            checkOut: "2026-10-16",
          },
        ],
      },
    ],
  },
  {
    name: "Family Room",
    unitCount: 3,
    dailyRates: rate(1_350_000, 1_650_000),
    rooms: [
      {
        number: "201",
        bedType: "2 Queen Beds",
        floor: "Floor 2",
        status: "occupied",
        reservations: [
          {
            id: "RES-10470",
            guestName: "Budi Santoso",
            source: "Direct",
            status: "in-house",
            checkIn: "2026-10-05",
            checkOut: "2026-10-10",
          },
          {
            id: "RES-10534",
            guestName: "Nadia Permata",
            source: "OTA Agoda",
            status: "confirmed",
            checkIn: "2026-10-13",
            checkOut: "2026-10-18",
          },
        ],
      },
      {
        number: "202",
        bedType: "2 Queen Beds",
        floor: "Floor 2",
        status: "maintenance",
        maintenanceNote: "AC unit replacement",
        reservations: [
          {
            id: "MNT-2026-14",
            guestName: "Maintenance Block",
            source: "Direct",
            status: "confirmed",
            checkIn: "2026-10-07",
            checkOut: "2026-10-10",
          },
          {
            id: "RES-10562",
            guestName: "Reza Fadillah",
            source: "Website",
            status: "deposit-paid",
            checkIn: "2026-10-11",
            checkOut: "2026-10-15",
          },
        ],
      },
      {
        number: "203",
        bedType: "1 King + Sofa",
        floor: "Floor 2",
        status: "reserved",
        reservations: [
          {
            id: "RES-10505",
            guestName: "Grace Halim",
            source: "OTA Booking.com",
            status: "vip-paid",
            checkIn: "2026-10-07",
            checkOut: "2026-10-09",
          },
          {
            id: "RES-10571",
            guestName: "Fajar Nugroho",
            source: "Phone",
            status: "confirmed",
            checkIn: "2026-10-16",
            checkOut: "2026-10-20",
          },
        ],
      },
    ],
  },
  {
    name: "Suite Room",
    unitCount: 2,
    dailyRates: rate(2_400_000, 2_900_000),
    rooms: [
      {
        number: "301",
        bedType: "King Suite",
        floor: "Floor 3",
        status: "occupied",
        reservations: [
          {
            id: "RES-10456",
            guestName: "Anwar Ibrahim",
            source: "Direct",
            status: "vip-paid",
            checkIn: "2026-10-06",
            checkOut: "2026-10-12",
          },
        ],
      },
      {
        number: "302",
        bedType: "Presidential",
        floor: "Floor 3",
        status: "due-out",
        reservations: [
          {
            id: "RES-10499",
            guestName: "Lina Marlina",
            source: "Website",
            status: "in-house",
            checkIn: "2026-10-04",
            checkOut: "2026-10-07",
          },
          {
            id: "RES-10588",
            guestName: "Yusuf Maulana",
            source: "OTA Agoda",
            status: "deposit-paid",
            checkIn: "2026-10-14",
            checkOut: "2026-10-19",
          },
        ],
      },
    ],
  },
];

// Build the 14-day date array as ISO strings based on RACK_START_DATE.
export function buildDateWindow(startISO: string, days: number): Date[] {
  const [y, m, d] = startISO.split("-").map(Number);
  const base = new Date(y, m - 1, d);
  return Array.from({ length: days }, (_, i) => {
    const next = new Date(base);
    next.setDate(base.getDate() + i);
    return next;
  });
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatDayLabel(date: Date): string {
  return SHORT_DAYS[date.getDay()];
}

export function formatDateNumber(date: Date): string {
  return String(date.getDate()).padStart(2, "0");
}

export function formatMonthLabel(date: Date): string {
  return SHORT_MONTHS[date.getMonth()];
}

export function formatRangeLabel(start: Date, end: Date): string {
  return `${formatDateNumber(start)} ${formatMonthLabel(start)} ${start.getFullYear()} - ${formatDateNumber(
    end,
  )} ${formatMonthLabel(end)} ${end.getFullYear()}`;
}

export function formatRupiah(value: number): string {
  return "Rp " + value.toLocaleString("id-ID");
}

// Source label short display used on reservation bars.
export const sourceShort: Record<BookingSource, string> = {
  "Walk-in": "Walk-in",
  Website: "Web",
  "OTA Agoda": "Agoda",
  "OTA Booking.com": "Booking",
  Phone: "Phone",
  Direct: "Direct",
};
