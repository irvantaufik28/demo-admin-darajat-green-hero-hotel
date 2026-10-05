import type { AvailableRoom, SelectedRoom } from "../services/create";

type AllocationRoom = Pick<SelectedRoom, "roomTypeId" | "adults" | "children" | "extraBeds">;

export function roomAllocationError(
  rooms: AllocationRoom[],
  available: AvailableRoom[],
  totalAdults: number,
  totalChildren: number,
) {
  if (!rooms.length) return "Pilih minimal satu kamar.";
  for (const [index, room] of rooms.entries()) {
    const option = available.find((item) => item.roomType.id === room.roomTypeId);
    if (!option?.bookable) return `Kamar ${index + 1} tidak tersedia untuk tanggal ini.`;
    if (!option.capacityPatterns.some((pattern) =>
      pattern.adults === room.adults &&
      pattern.children === room.children &&
      pattern.extraBeds <= room.extraBeds,
    )) {
      return `Kamar ${index + 1} (${option.roomType.name}) tidak sesuai kapasitas. Ubah pembagian dewasa, anak, atau extra bed.`;
    }
  }
  const allocatedAdults = rooms.reduce((sum, room) => sum + room.adults, 0);
  const allocatedChildren = rooms.reduce((sum, room) => sum + room.children, 0);
  if (allocatedAdults !== totalAdults || allocatedChildren !== totalChildren) {
    return `Pembagian tamu: ${allocatedAdults}/${totalAdults} dewasa dan ${allocatedChildren}/${totalChildren} anak. Total tiap kamar harus sama dengan total tamu.`;
  }
  return "";
}

export function autoAllocateRooms<T extends AllocationRoom>(
  rooms: T[],
  available: AvailableRoom[],
  totalAdults: number,
  totalChildren: number,
): T[] {
  type Pattern = AvailableRoom["capacityPatterns"][number];
  type Solution = { cost: number; patterns: Pattern[] };

  const choices = rooms.map((room) => {
    const option = available.find((item) => item.roomType.id === room.roomTypeId);
    return (option?.capacityPatterns ?? []).filter(
      (pattern) => pattern.extraBeds <= (option?.roomType.maxExtraBeds ?? 0),
    );
  });
  if (!rooms.length || choices.some((patterns) => !patterns.length)) return rooms;

  const memo = new Map<string, Solution>();
  function distribute(index: number, adults: number, children: number): Solution {
    if (index === rooms.length) {
      return {
        cost: (Math.abs(totalAdults - adults) + Math.abs(totalChildren - children)) * 10_000,
        patterns: [],
      };
    }

    const key = `${index}:${adults}:${children}`;
    const cached = memo.get(key);
    if (cached) return cached;

    const room = rooms[index];
    let best: Solution | undefined;
    for (const pattern of choices[index]) {
      const next = distribute(index + 1, adults + pattern.adults, children + pattern.children);
      const changeCost =
        (Math.abs(room.adults - pattern.adults) + Math.abs(room.children - pattern.children)) * 10 +
        Math.max(0, pattern.extraBeds - room.extraBeds) * 25;
      const cost = next.cost + changeCost;
      if (!best || cost < best.cost) {
        best = { cost, patterns: [pattern, ...next.patterns] };
      }
    }

    memo.set(key, best!);
    return best!;
  }

  const allocation = distribute(0, 0, 0).patterns;
  return rooms.map((room, index) => ({
    ...room,
    adults: allocation[index].adults,
    children: allocation[index].children,
    extraBeds: Math.max(room.extraBeds, allocation[index].extraBeds),
  }));
}
