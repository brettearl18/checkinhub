import Image from "next/image";

export function ProgressPhotoEmptySlot({
  label,
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center bg-stone-200/90 px-3 text-center ${
        compact ? "gap-1" : "gap-2"
      }`}
    >
      <Image
        src="/Vana Logo-1-Black-RGB.png"
        alt=""
        width={compact ? 48 : 64}
        height={compact ? 16 : 20}
        className={`w-auto opacity-30 grayscale ${compact ? "h-4" : "h-5"}`}
        aria-hidden
      />
      {label ? (
        <p className={`text-stone-500 ${compact ? "text-[10px]" : "text-[11px]"}`}>{label}</p>
      ) : null}
    </div>
  );
}
