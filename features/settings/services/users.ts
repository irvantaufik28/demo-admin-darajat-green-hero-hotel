import { apiRequest } from "../../../lib/api/client";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  phone: string | null;
  roleId: string;
  roleName: string;
  isActive: boolean;
  lastLoginAt: string | null;
};

export type UserRole = { id: string; name: string };

export function getUsers(signal?: AbortSignal) {
  return apiRequest<{ items: AdminUser[] }>("users", { signal });
}

export function getUserRoles(signal?: AbortSignal) {
  return apiRequest<{ items: UserRole[] }>("users/roles", { signal });
}

export function createUser(input: {
  name: string;
  email: string;
  username: string | null;
  phone: string | null;
  roleId: string;
  password: string;
  isActive: boolean;
}) {
  return apiRequest<{ user: AdminUser }>("users", { method: "POST", body: input });
}

export function setUserStatus(id: string, isActive: boolean) {
  return apiRequest<{ user: AdminUser }>(`users/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: { isActive },
  });
}
