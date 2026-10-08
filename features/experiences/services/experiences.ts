import { apiRequest } from "../../../lib/api/client";

export type ExperienceCategory = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
};

export type ExperienceVariant = {
  id: string;
  experienceId: string;
  subName: string;
  description: string | null;
  price: number;
  sortOrder: number;
  imageUrl: string | null;
};

export type ExperienceRecord = {
  id: string;
  categoryId: string;
  category: ExperienceCategory;
  code: string;
  slug: string;
  name: string;
  description: string | null;
  price: number;
  maxQuantity: number;
  imageUrl: string | null;
  coverImageUrl: string | null;
  isActive: boolean;
  variants: ExperienceVariant[];
};

export type ExperienceInput = {
  categoryId: string;
  code: string;
  slug: string;
  name: string;
  description: string | null;
  maxQuantity: number;
  imageUrl: string | null;
  coverImageUrl: string | null;
  isActive: boolean;
  variants: { subName: string; description: string | null; price: number; imageUrl: string | null }[];
};

export async function uploadExperiencePhoto(file: File): Promise<string> {
  const body = new FormData();
  body.set("file", file);
  const result = await apiRequest<{ file: { url: string } }>("uploads", { method: "POST", body });
  return result.file.url;
}

export function listExperiences(query: URLSearchParams, signal?: AbortSignal) {
  return apiRequest<{
    items: ExperienceRecord[];
    page: number;
    limit: number;
    total: number;
  }>(`experiences?${query}`, { signal });
}

export function getExperience(id: string, signal?: AbortSignal) {
  return apiRequest<{ experience: ExperienceRecord }>(`experiences/${encodeURIComponent(id)}`, { signal });
}

export function createExperience(body: ExperienceInput) {
  return apiRequest<{ experience: ExperienceRecord }>("experiences", { method: "POST", body });
}

export function updateExperience(id: string, body: ExperienceInput) {
  return apiRequest<{ experience: ExperienceRecord }>(`experiences/${encodeURIComponent(id)}`, {
    method: "PUT",
    body,
  });
}

export function setExperienceStatus(id: string, isActive: boolean) {
  return apiRequest<{ experience: ExperienceRecord }>(`experiences/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: { isActive },
  });
}

export async function listExperienceCategories(signal?: AbortSignal) {
  const result = await apiRequest<{ items: ExperienceCategory[] }>("master/experience-categories", { signal });
  return result.items;
}
