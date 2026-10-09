export function normalizeGuestNik(value: string) {
  return value.replace(/\D/g, "").slice(0, 16);
}

export function isValidGuestNik(value: string) {
  return /^\d{16}$/.test(value);
}
