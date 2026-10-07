"use client";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

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
  const { t } = useTranslations({ en, id });
  return (
    <div className="quantity-control" aria-label={label}>
      <button
        type="button"
        aria-label={t("common.decrease", { label })}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <span aria-live="polite">{value}</span>
      <button
        type="button"
        aria-label={t("common.increase", { label })}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}
