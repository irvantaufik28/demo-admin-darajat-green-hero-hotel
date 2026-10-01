import { roomTypes } from "./walk-in-data";

export type RoomPhoto = {
  id: string;
  name: string;
  url: string;
  size: string;
};

export type CapacityPattern = {
  adults: number;
  children: number;
  selected: boolean;
  extraBeds: number;
};

export type RoomTypeEntry = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  size: number;
  bedType: string;
  bedCount: number;
  mealType: string;
  adultBreakfastPrice: number;
  childBreakfastPrice: number;
  extraBedEnabled: boolean;
  extraBedPrice: number;
  maxExtraBeds: number;
  cover: RoomPhoto | null;
  gallery: RoomPhoto[];
  amenities: string[];
  capacityPatterns: CapacityPattern[];
};

export const amenityGroups = [
  {
    title: "Room Features",
    items: ["Air Conditioning", "Balcony", "Mountain View", "Wardrobe", "Work Desk", "Fireplace"],
  },
  {
    title: "Bathroom",
    items: ["Hot Water", "Shower", "Towels", "Toiletries", "Bathtub", "Hairdryer"],
  },
  {
    title: "Entertainment & Connectivity",
    items: ["WiFi", "Television", "Cable Channels", "Smart TV / Streaming"],
  },
  {
    title: "Food & Beverage",
    items: ["Kettle", "Refrigerator", "Drinking Water", "Minibar", "Tea & Coffee Set"],
  },
];

export const defaultCapacityPatterns: CapacityPattern[] = [
  [1, 0, true, 0],
  [1, 1, true, 0],
  [1, 2, true, 0],
  [1, 3, false, 0],
  [2, 0, true, 0],
  [2, 1, true, 0],
  [2, 2, false, 1],
  [2, 3, false, 1],
  [3, 0, false, 1],
  [3, 1, false, 1],
].map(([adults, children, selected, extraBeds]) => ({
  adults: Number(adults),
  children: Number(children),
  selected: Boolean(selected),
  extraBeds: Number(extraBeds),
}));

export const initialRoomTypes: RoomTypeEntry[] = roomTypes.map((room) => ({
  id: room.id,
  name: room.name,
  description: `Kamar ${room.name.toLowerCase()} dengan fasilitas untuk ${room.capacity.toLowerCase()}.`,
  active: true,
  size: room.id === "deluxe" ? 28 : room.id === "family" ? 36 : 42,
  bedType: room.id === "family" ? "Twin Bed" : "King Bed",
  bedCount: room.id === "family" ? 2 : 1,
  mealType: "With Breakfast",
  adultBreakfastPrice: 75000,
  childBreakfastPrice: 50000,
  extraBedEnabled: true,
  extraBedPrice: room.id === "deluxe" ? 150000 : room.id === "family" ? 200000 : 250000,
  maxExtraBeds: 1,
  cover: null,
  gallery: [],
  amenities: ["Air Conditioning", "Hot Water", "Shower", "Towels", "WiFi", "Television"],
  capacityPatterns: defaultCapacityPatterns,
}));

const createdRoomTypes: RoomTypeEntry[] = [];
const editedRoomTypes = new Map<string, RoomTypeEntry>();

export function getRoomTypeCatalog() {
  return [...initialRoomTypes, ...createdRoomTypes].map(
    (room) => editedRoomTypes.get(room.id) ?? room,
  );
}

export function getRoomTypeById(id: string) {
  return getRoomTypeCatalog().find((room) => room.id === id);
}

export function addRoomType(entry: RoomTypeEntry) {
  createdRoomTypes.push(entry);
}

export function updateRoomType(entry: RoomTypeEntry) {
  if (!getRoomTypeById(entry.id)) return false;
  editedRoomTypes.set(entry.id, entry);
  return true;
}
