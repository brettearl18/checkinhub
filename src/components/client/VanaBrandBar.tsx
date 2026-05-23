import Link from "next/link";
import Image from "next/image";

/** Gold strip with white Vana mark — THEME_DESIGN logo treatment */
export function VanaBrandBar({ href = "/client" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-center bg-[#daa450] px-4 py-3 min-h-[52px]"
    >
      <Image
        src="/Vana Logo-1-Black-RGB.png"
        alt="Vana"
        width={88}
        height={28}
        className="h-7 w-auto brightness-0 invert"
        priority
      />
    </Link>
  );
}
