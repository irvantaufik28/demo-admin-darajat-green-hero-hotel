import { permissions, roles } from "./roles-permissions-data";

export type StoredRole = {
  name: string;
  slug: string;
  permissions: boolean[];
};

const storageKey = "green-hero-custom-roles";

export const roleSlug = (name: string) => name.trim().toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function readCustomRoles(): StoredRole[] {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(storageKey) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is StoredRole =>
      typeof item?.name === "string" && typeof item?.slug === "string" &&
      Array.isArray(item?.permissions) &&
      item.permissions.length === permissions.length &&
      item.permissions.every((value: unknown) => typeof value === "boolean"),
    );
  } catch {
    return [];
  }
}

export function saveCustomRole(role: StoredRole) {
  const existing = readCustomRoles();
  const next = existing.some((item) => item.slug === role.slug)
    ? existing.map((item) => item.slug === role.slug ? role : item)
    : [...existing, role];
  sessionStorage.setItem(storageKey, JSON.stringify(next));
}

export function roleNameTaken(name: string, customRoles: StoredRole[]) {
  const slug = roleSlug(name);
  return roles.some((role) => roleSlug(role) === slug) ||
    customRoles.some((role) => role.slug === slug);
}
