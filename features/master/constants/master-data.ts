export type MasterCategory = {
  slug: string;
  title: string;
};

export const masterCategories: MasterCategory[] = [
  { slug: "amenities", title: "Amenities" },
  { slug: "bed-types", title: "Bed Types" },
  { slug: "meal-types", title: "Meal Types" },
  { slug: "room-view-types", title: "Room View Types" },
  { slug: "floor", title: "Floor" },
  { slug: "experience-categories", title: "Experience Categories" },
  { slug: "ota-channels", title: "OTA Channels" },
  { slug: "payment-methods", title: "Payment Methods" },
  { slug: "cancellation-policy-types", title: "Cancellation Policy Types" },
];
