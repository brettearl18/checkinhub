"use client";

const KNOWN = [
  "home",
  "dumbbell",
  "clipboard-check",
  "calendar-check",
  "footprints",
  "droplet",
  "bed",
  "scale",
  "flame",
  "chart-line",
  "ruler",
  "goal",
  "cycle",
  "image",
  "camera",
  "bell",
  "message",
  "notes",
  "check-circle",
  "alert-circle",
  "award",
  "chef-hat",
  "activity",
  "check-square",
  "weight-trend",
  "search",
  "calendar",
  "user",
  "arrow-right",
  "chevron-right",
  "heart-pulse",
] as const;

export type VanaIconName = (typeof KNOWN)[number];

export function VanaIcon({
  name,
  label,
  size = 20,
  className = "",
}: {
  name: VanaIconName;
  label?: string;
  size?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- local SVG pack; currentColor via CSS filter not needed
    <img
      src={`/icons/vana/${name}.svg`}
      width={size}
      height={size}
      alt={label ?? ""}
      aria-hidden={!label}
      className={`inline-block shrink-0 opacity-80 ${className}`}
    />
  );
}
