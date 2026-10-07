import { apiRequest } from "../../../lib/api/client";

export type Profile = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  phone: string | null;
  photoUrl: string | null;
  roleId: string;
  roleName: string;
  isActive: boolean;
  lastLoginAt: string | null;
};

export type UpdateProfileInput = {
  name?: string;
  phone?: string | null;
  photoUrl?: string | null;
};

export async function getProfile(signal?: AbortSignal): Promise<Profile> {
  const result = await apiRequest<{ profile: Profile }>("profile", { signal });
  return result.profile;
}

export async function updateProfile(input: UpdateProfileInput): Promise<Profile> {
  const result = await apiRequest<{ profile: Profile }>("profile", {
    method: "PATCH",
    body: input,
  });
  return result.profile;
}

export async function uploadProfilePhoto(file: File): Promise<string> {
  const formData = new FormData();
  formData.set("file", file);
  const result = await apiRequest<{ file: { url: string } }>("uploads", {
    method: "POST",
    body: formData,
  });
  return result.file.url;
}
