import { apiRequest } from "../../../lib/api/client";

export type Role = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  permissionCodes: string[];
};

export type Permission = {
  id: string;
  code: string;
  module: string;
  label: string;
};

export function getRoles(signal?: AbortSignal) {
  return apiRequest<{ items: Role[] }>("roles", { signal });
}

export function getRole(id: string, signal?: AbortSignal) {
  return apiRequest<{ role: Role }>(`roles/${encodeURIComponent(id)}`, { signal });
}

export function getPermissions(signal?: AbortSignal) {
  return apiRequest<{ items: Permission[] }>("roles/permissions", { signal });
}

export function createRole(name: string) {
  return apiRequest<{ role: Role }>("roles", { method: "POST", body: { name } });
}

export function saveRolePermissions(id: string, permissionCodes: string[]) {
  return apiRequest<{ role: Role }>(`roles/${encodeURIComponent(id)}/permissions`, {
    method: "PUT",
    body: { permissionCodes },
  });
}
