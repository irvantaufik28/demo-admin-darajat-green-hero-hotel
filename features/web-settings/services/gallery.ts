import { apiRequest } from "../../../lib/api/client";

export const galleryCategories = [
  "rooms",
  "pools",
  "resort",
  "dining",
  "experiences",
  "landscape",
] as const;

export type GalleryCategory = (typeof galleryCategories)[number];

export type GalleryImage = {
  id: string;
  imageUrl: string;
  cloudinaryPublicId: string | null;
  category: GalleryCategory;
  titleId: string | null;
  titleEn: string | null;
  captionId: string | null;
  captionEn: string | null;
  altTextId: string;
  altTextEn: string;
  showOnHomepage: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GalleryImageInput = Omit<
  GalleryImage,
  "id" | "createdAt" | "updatedAt"
>;

export function listGalleryImages(signal?: AbortSignal) {
  return apiRequest<{
    items: GalleryImage[];
    page: number;
    limit: number;
    total: number;
  }>("gallery?limit=100", { signal });
}

export function createGalleryImage(body: GalleryImageInput) {
  return apiRequest<{ image: GalleryImage }>("gallery", {
    method: "POST",
    body,
  });
}

export function updateGalleryImage(id: string, body: GalleryImageInput) {
  return apiRequest<{ image: GalleryImage }>(
    `gallery/${encodeURIComponent(id)}`,
    { method: "PATCH", body },
  );
}

export function deleteGalleryImage(id: string) {
  return apiRequest<void>(`gallery/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function uploadGalleryImage(file: File) {
  const body = new FormData();
  body.set("file", file);
  const result = await apiRequest<{
    file: { url: string; publicId: string };
  }>("uploads", { method: "POST", body });
  return result.file;
}
