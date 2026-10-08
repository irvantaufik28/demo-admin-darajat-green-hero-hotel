import { apiRequest } from "../../../lib/api/client";

export type MasterItem = {
  id: string;
  code: string;
  name: string;
  iconKey: string | null;
  sortOrder: number;
  isActive: boolean;
};

function categoryPath(slug: string) {
  return `master/${encodeURIComponent(slug)}`;
}

export function getMasterItems(slug: string, signal?: AbortSignal) {
  return apiRequest<{ category: string; items: MasterItem[] }>(categoryPath(slug), { signal });
}

export function createMasterItem(slug: string, name: string, iconKey: string | null) {
  return apiRequest<{ item: MasterItem }>(categoryPath(slug), {
    method: "POST",
    body: { name, iconKey },
  });
}

export function updateMasterItem(slug: string, id: string, name: string, iconKey: string | null) {
  return apiRequest<{ item: MasterItem }>(`${categoryPath(slug)}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { name, iconKey },
  });
}

export function deleteMasterItem(slug: string, id: string) {
  return apiRequest<void>(`${categoryPath(slug)}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
