import { apiRequest } from "../../../lib/api/client";

export type CapacityPattern = {
  id: string;
  adults: number;
  children: number;
  sortOrder: number;
  isActive: boolean;
};

export type CapacityPatternInput = {
  adults: number;
  children: number;
  sortOrder: number;
};

export function getCapacityPatterns(signal?: AbortSignal) {
  return apiRequest<{ items: CapacityPattern[] }>("master/capacity-patterns", { signal });
}

export function createCapacityPattern(input: CapacityPatternInput) {
  return apiRequest<{ item: CapacityPattern }>("master/capacity-patterns", {
    method: "POST",
    body: input,
  });
}

export function updateCapacityPattern(
  id: string,
  input: CapacityPatternInput & { isActive: boolean },
) {
  return apiRequest<{ item: CapacityPattern }>(
    `master/capacity-patterns/${encodeURIComponent(id)}`,
    { method: "PATCH", body: input },
  );
}

export function deleteCapacityPattern(id: string) {
  return apiRequest<void>(`master/capacity-patterns/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
