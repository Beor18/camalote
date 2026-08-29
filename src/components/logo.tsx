import Image from "next/image";

export function CamaloteMark({ className = "size-8" }: { className?: string }) {
  return (
    <Image
      src="/img/logo-camalote.png"
      alt=""
      width={64}
      height={64}
      className={className}
      aria-hidden="true"
    />
  );
}

export function CamaloteLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <CamaloteMark />
      <span className="font-display text-xl font-semibold tracking-tight">
        camalote
      </span>
    </span>
  );
}
