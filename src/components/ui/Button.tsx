import * as React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  asChild?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-active)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2",
  secondary:
    "bg-[var(--color-primary-subtle)] text-[var(--color-text)] border border-[var(--color-primary-muted)] hover:bg-[var(--color-primary-muted)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2",
  ghost:
    "text-[var(--color-text)] hover:bg-[var(--color-primary-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2",
};

export function Button({
  variant = "primary",
  className = "",
  asChild,
  children,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50";
  const styles = `${base} ${variantStyles[variant]} ${className}`;

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ className?: string }>, {
      className: `${styles} ${(children.props as { className?: string }).className ?? ""}`.trim(),
    });
  }

  return (
    <button type="button" className={styles} {...props}>
      {children}
    </button>
  );
}
