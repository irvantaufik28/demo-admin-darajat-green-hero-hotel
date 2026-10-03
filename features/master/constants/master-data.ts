export type MasterCategory = {
  slug: string;
  title: string;
  items: string[];
};

export const masterCategories: MasterCategory[] = [
  { slug: "amenities", title: "Amenities", items: ["WiFi", "AC", "TV", "Hot Water", "Balcony"] },
  { slug: "bed-types", title: "Bed Types", items: ["King Bed", "Queen Bed", "Twin Bed", "Single Bed"] },
  { slug: "meal-types", title: "Meal Types", items: ["Room Only", "Breakfast Included"] },
  { slug: "room-view-types", title: "Room View Types", items: ["Mountain View", "Pool View", "Garden View"] },
  { slug: "floor", title: "Floor", items: ["Ground Floor", "1st Floor", "2nd Floor"] },
  { slug: "experience-categories", title: "Experience Categories", items: ["Dining", "Celebrate"] },
  { slug: "ota-channels", title: "OTA Channels", items: ["Agoda", "Traveloka", "Booking.com", "Tiket.com"] },
  { slug: "payment-methods", title: "Payment Methods", items: ["Cash", "Transfer", "QRIS", "Payment Gateway"] },
  { slug: "cancellation-policy-types", title: "Cancellation Policy Types", items: ["Flexible", "Non-refundable", "Custom"] },
];
