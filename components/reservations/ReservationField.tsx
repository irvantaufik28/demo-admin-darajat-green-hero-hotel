import type { ReactNode } from "react";

type Props = { label: string; htmlFor: string; children: ReactNode; optional?: boolean; required?: boolean };

export function ReservationField({ label, htmlFor, children, optional, required }: Props) {
  return (
    <div className="reservation-field">
      <label htmlFor={htmlFor}>{label} {required && <span className="required-mark">*</span>}{optional && <span className="optional-mark">(Optional)</span>}</label>
      {children}
    </div>
  );
}
