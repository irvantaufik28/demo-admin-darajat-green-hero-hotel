export const roles = ["Owner", "Manager", "Admin", "Front Office", "Staff"] as const;

export type Permission = {
  group: string;
  label: string;
  allowed: readonly (boolean | null)[];
};

const all = [true, true, true, true, true];
const operations = [true, true, true, true, false];
const management = [true, true, true, false, false];
const ownerAdmin = [true, false, true, false, false];
const senior = [true, true, false, false, false];

export const permissions: Permission[] = [
  { group: "Dashboard", label: "View Dashboard", allowed: all },
  { group: "Reservations", label: "View Reservations", allowed: all },
  ...[
    "Create Reservation", "Edit Reservation", "Confirm Reservation",
    "Cancel Reservation",
  ].map((label) => ({ group: "Reservations", label, allowed: operations })),
  ...["View Arrivals Today", "View Departures Today", "View In House"]
    .map((label) => ({ group: "Reservations", label, allowed: all })),
  ...["Check In Guest", "Check Out Guest"]
    .map((label) => ({ group: "Reservations", label, allowed: operations })),
  { group: "Reservations", label: "Checkout With Outstanding Override", allowed: senior },
  ...[
    "Extend Stay", "Change Room", "Assign Room", "Manage Extra Bed",
    "Add Experience to Reservation",
  ].map((label) => ({ group: "Reservations", label, allowed: operations })),
  { group: "Rooms", label: "View Room Types", allowed: all },
  ...["Create Room Type", "Edit Room Type", "Disable Room Type"]
    .map((label) => ({ group: "Rooms", label, allowed: ownerAdmin })),
  { group: "Rooms", label: "View Room Numbers", allowed: all },
  { group: "Rooms", label: "Create Room Number", allowed: ownerAdmin },
  { group: "Rooms", label: "Edit Room Number", allowed: [true, true, true, false, false] },
  { group: "Rooms", label: "Change Room Operational Status", allowed: operations },
  { group: "Prices & Stocks", label: "View Prices & Stocks", allowed: all },
  ...["Update Room Price", "Update Stock", "Manage Stop Sell", "Manage Minimum Night"]
    .map((label) => ({ group: "Prices & Stocks", label, allowed: management })),
  { group: "Cancellation Policies", label: "View Cancellation Policies", allowed: all },
  ...["Create Policy", "Edit Policy", "Disable Policy"]
    .map((label) => ({ group: "Cancellation Policies", label, allowed: ownerAdmin })),
  { group: "Campaigns & Promotions", label: "View Campaigns", allowed: all },
  ...[
    "Create Campaign", "Edit Campaign", "Disable Campaign", "Set Campaign Priority",
  ].map((label) => ({ group: "Campaigns & Promotions", label, allowed: management })),
  { group: "Experiences", label: "View Experiences", allowed: all },
  ...["Create Experience", "Edit Experience", "Disable Experience"]
    .map((label) => ({ group: "Experiences", label, allowed: ownerAdmin })),
  ...["View Payments", "Record Payment", "View Payment Detail"]
    .map((label) => ({ group: "Payments", label, allowed: operations })),
  ...["Refund Payment", "Checkout With Unpaid Balance"]
    .map((label) => ({ group: "Payments", label, allowed: senior })),
  { group: "Payments", label: "Export Payments", allowed: management },
  { group: "Guests", label: "View Guests", allowed: all },
  { group: "Guests", label: "Edit Guest", allowed: operations },
  { group: "Guests", label: "View Guest Stay History", allowed: all },
  ...["View Reservations Report", "Export Reservations Report"]
    .map((label) => ({ group: "Reports — Reservations", label, allowed: management })),
  {
    group: "Reports — Revenue",
    label: "View Revenue Report",
    allowed: [true, true, false, null, null],
  },
];
