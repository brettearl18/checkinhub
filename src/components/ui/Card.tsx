import * as React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Card({ className = "", ...props }: CardProps) {
  return (
    <div
      className={`rounded-[var(--radius-card,var(--radius-lg))] border-0 bg-[var(--color-bg-elevated)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}
      {...props}
    />
  );
}
