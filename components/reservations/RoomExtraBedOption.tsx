import { extraBedRates, formatRupiah, type RoomType } from "../../lib/walk-in-data";

type Props = {
  roomType: RoomType;
  roomLabel: string;
  nights: number;
  selected: boolean;
  onChange: (selected: boolean) => void;
};

export function RoomExtraBedOption({ roomType, roomLabel, nights, selected, onChange }: Props) {
  const rate = extraBedRates[roomType];

  return (
    <label className="room-extra-bed-option">
      <input type="checkbox" checked={selected} onChange={(event) => onChange(event.target.checked)} />
      <span>
        <strong>Extra Bed · {roomLabel}</strong>
        <small>1 bed · {nights} malam × {formatRupiah(rate)} / malam</small>
      </span>
      <strong>{formatRupiah(selected ? rate * nights : 0)}</strong>
    </label>
  );
}
