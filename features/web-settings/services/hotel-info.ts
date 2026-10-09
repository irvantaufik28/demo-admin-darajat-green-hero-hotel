import { apiRequest } from "../../../lib/api/client";

export type HotelInfo = {
  id: number;
  name: string;
  shortDescription: string | null;
  description: string | null;
  address: string;
  district: string | null;
  city: string;
  province: string;
  postalCode: string | null;
  googleMapsUrl: string | null;
  latitude: string | null;
  longitude: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  email: string | null;
  logoUrl: string | null;
  logoPublicId: string | null;
  faviconUrl: string | null;
  faviconPublicId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type HotelInfoInput = {
  name: string;
  shortDescription: string | null;
  description: string | null;
  address: string;
  district: string | null;
  city: string;
  province: string;
  postalCode: string | null;
  googleMapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  whatsappNumber: string | null;
  email: string | null;
  logoUrl: string | null;
  logoPublicId: string | null;
  faviconUrl: string | null;
  faviconPublicId: string | null;
};

type HotelInfoResponse = {
  data: { hotel: HotelInfo; facilities: unknown[] } | null;
};

export function getHotelInfo(signal?: AbortSignal) {
  return apiRequest<HotelInfoResponse>("hotel-info", { signal });
}

export function saveHotelInfo(body: HotelInfoInput) {
  return apiRequest<HotelInfoResponse>("hotel-info", { method: "PUT", body });
}

export async function uploadHotelAsset(file: File) {
  const body = new FormData();
  body.set("file", file);
  const response = await apiRequest<{
    file: { url: string; publicId: string };
  }>("uploads", { method: "POST", body });
  return response.file;
}
