// Static demo data for the Room Rack / Tape Chart view.
// No API calls — purely for the visual front-desk slice.

export type RoomStatus =
  | "vacant"
  | "occupied"
  | "reserved"
  | "due-out"
  | "cleaning"
  | "maintenance"
  | "out_of_service";

export type BookingSource = string;

export type ReservationStatus =
  | "in-house"
  | "awaiting-confirmation"
  | "confirmed"
  | "deposit-paid"
  | "vip-paid"
  | "due-out"
  | "overdue"
  | "checked-out"
  | "maintenance";

export type Reservation = {
  id: string;
  reservationId?: string;
  reservationRoomId?: string;
  guestName: string;
  source: BookingSource;
  status: ReservationStatus;
  reservationStatus?: "pending" | "confirmed" | "checked_in" | "checked_out";
  paymentStatus?: "unpaid" | "partial" | "paid" | "failed" | "expired" | "refunded";
  paidAmount?: number;
  bookingTotal?: number;
  operationalStatus?: { code: string; label: string } | null;
  maintenanceNote?: string;
  checkIn: string; // ISO date (YYYY-MM-DD)
  checkOut: string; // ISO date (YYYY-MM-DD)
};

export type RoomUnit = {
  id?: string;
  number: string;
  bedType: string;
  floor: string;
  status: RoomStatus;
  isActive?: boolean;
  maintenanceNote?: string;
  reservations: Reservation[];
};

export type RoomTypeGroup = {
  id?: string;
  name: string;
  unitCount: number;
  rooms: RoomUnit[];
  unassignedReservations: Reservation[];
  dailyRates: (number | null)[]; // 14 days of rates
  inventory?: { stayDate: string; isConfigured: boolean; availableRooms: number | null; heldForUnassigned: boolean; stopSell: boolean | null }[];
};

export type RoomRackSummary = {
  availableRooms: number;
  readyToCheckIn: number;
  inHouse: number;
  dueOut: number;
  unavailable: number;
};

// The design anchors "today" at 07 Oct 2026 and shows a 14-day window.
export const RACK_START_DATE = "2026-10-07";
export const RACK_DAYS = 14;

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
    unassignedReservations: [
      {
        id: "RES-10601",
        guestName: "Rina Kusuma",
        source: "Phone",
        status: "confirmed",
        reservationStatus: "confirmed",
        paymentStatus: "partial",
        paidAmount: 400_000,
        checkIn: "2026-10-07",
        checkOut: "2026-10-09",
      },
      {
        id: "RES-10602",
        guestName: "Andi Saputra",
        source: "Website",
        status: "confirmed",
        reservationStatus: "confirmed",
        paymentStatus: "paid",
        checkIn: "2026-10-17",
        checkOut: "2026-10-19",
      },
    ],
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
            reservationStatus: "checked_in",
            paymentStatus: "paid",
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
            reservationStatus: "checked_in",
            paymentStatus: "paid",
            checkIn: "2026-10-06",
            checkOut: "2026-10-07",
          },
          {
            id: "RES-10511",
            guestName: "Michael Tan",
            source: "Phone",
            status: "confirmed",
            reservationStatus: "confirmed",
            paymentStatus: "unpaid",
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
            reservationStatus: "confirmed",
            paymentStatus: "partial",
            paidAmount: 500_000,
            checkIn: "2026-10-08",
            checkOut: "2026-10-12",
          },
          {
            id: "RES-10547",
            guestName: "David Kurniawan",
            source: "Website",
            status: "confirmed",
            reservationStatus: "confirmed",
            paymentStatus: "paid",
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
            reservationStatus: "confirmed",
            paymentStatus: "unpaid",
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
    unassignedReservations: [
      {
        id: "RES-10603",
        guestName: "Maya Salsabila",
        source: "OTA Agoda",
        status: "confirmed",
        reservationStatus: "confirmed",
        paymentStatus: "paid",
        checkIn: "2026-10-13",
        checkOut: "2026-10-15",
      },
    ],
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
            reservationStatus: "checked_in",
            paymentStatus: "partial",
            paidAmount: 1_500_000,
            checkIn: "2026-10-05",
            checkOut: "2026-10-10",
          },
          {
            id: "RES-10534",
            guestName: "Nadia Permata",
            source: "OTA Agoda",
            status: "confirmed",
            reservationStatus: "confirmed",
            paymentStatus: "paid",
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
            reservationStatus: "confirmed",
            paymentStatus: "partial",
            paidAmount: 750_000,
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
            reservationStatus: "confirmed",
            paymentStatus: "paid",
            checkIn: "2026-10-07",
            checkOut: "2026-10-09",
          },
          {
            id: "RES-10571",
            guestName: "Fajar Nugroho",
            source: "Phone",
            status: "confirmed",
            reservationStatus: "confirmed",
            paymentStatus: "unpaid",
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
    unassignedReservations: [
      {
        id: "RES-10604",
        guestName: "Kevin Hartono",
        source: "Phone",
        status: "confirmed",
        reservationStatus: "confirmed",
        paymentStatus: "unpaid",
        checkIn: "2026-10-07",
        checkOut: "2026-10-10",
      },
    ],
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
            reservationStatus: "checked_in",
            paymentStatus: "paid",
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
            reservationStatus: "checked_in",
            paymentStatus: "unpaid",
            checkIn: "2026-10-04",
            checkOut: "2026-10-07",
          },
          {
            id: "RES-10588",
            guestName: "Yusuf Maulana",
            source: "OTA Agoda",
            status: "deposit-paid",
            reservationStatus: "confirmed",
            paymentStatus: "partial",
            paidAmount: 1_000_000,
            checkIn: "2026-10-14",
            checkOut: "2026-10-19",
          },
        ],
      },
    ],
  },
];

const rackRooms = roomTypeGroups.flatMap((group) => group.rooms);

export const roomRackSummary: RoomRackSummary = {
  availableRooms: rackRooms.filter(
    (room) => room.status === "vacant" || room.status === "reserved",
  ).length,
  readyToCheckIn: rackRooms
    .flatMap((room) => room.reservations)
    .concat(roomTypeGroups.flatMap((group) => group.unassignedReservations))
    .filter(
      (reservation) =>
        reservation.checkIn === RACK_START_DATE &&
        reservation.status !== "in-house" &&
        !reservation.id.startsWith("MNT"),
    ).length,
  inHouse: rackRooms.filter((room) => room.status === "occupied").length,
  dueOut: rackRooms.filter((room) => room.status === "due-out").length,
  unavailable: rackRooms.filter(
    (room) =>
      room.status === "cleaning" ||
      room.status === "maintenance" ||
      room.status === "out_of_service",
  ).length,
};

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
export const sourceShort: Record<string, string> = {
  "Walk-in": "Walk-in",
  Website: "Web",
  "OTA Agoda": "Agoda",
  "OTA Booking.com": "Booking",
  Phone: "Phone",
  Direct: "Direct",
};
