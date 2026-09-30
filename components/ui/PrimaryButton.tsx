import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; loading?: boolean };

export function PrimaryButton({ children, loading = false, disabled, ...props }: Props) {
  return (
    <button className="primary-button" disabled={disabled || loading} {...props}>
      {loading && <span className="button-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
