import type { InputHTMLAttributes, ReactNode } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  trailing?: ReactNode;
};

export function FormField({ id, label, trailing, ...inputProps }: Props) {
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <div className="form-field__control">
        <input id={id} {...inputProps} />
        {trailing}
      </div>
    </div>
  );
}
