type Props = {
  label: string;
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
};

export function QuantityControl({
  label,
  value,
  min = 0,
  max,
  onChange,
}: Props) {
  return (
    <div className="quantity-control" aria-label={label}>
      <button
        type="button"
        aria-label={"Kurangi " + label}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <span aria-live="polite">{value}</span>
      <button
        type="button"
        aria-label={"Tambah " + label}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}
