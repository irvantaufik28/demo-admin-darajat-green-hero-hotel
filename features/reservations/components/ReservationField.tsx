"use client";
import type { ReactNode } from "react";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

type Props = {
  label: string;
  htmlFor: string;
  children: ReactNode;
  optional?: boolean;
  required?: boolean;
  invalid?: boolean;
};

export function ReservationField({
  label,
  htmlFor,
  children,
  optional,
  required,
  invalid,
}: Props) {
  const { t } = useTranslations({ en, id });
  return (
    <div
      className={
        invalid
          ? "reservation-field reservation-field--invalid"
          : "reservation-field"
      }
    >
      <label htmlFor={htmlFor}>
        {label} {required && <span className="required-mark">*</span>}
        {optional && <span className="optional-mark">{t("common.optional")}</span>}
      </label>
      {children}
    </div>
  );
}
