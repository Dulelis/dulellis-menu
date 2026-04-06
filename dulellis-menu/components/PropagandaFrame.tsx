import type { ComponentPropsWithoutRef } from "react";
import Image from "next/image";

type PropagandaFrameProps = {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  paddingClassName?: string;
  fitMode?: "contain" | "cover";
  sizes?: string;
  priority?: boolean;
} & Omit<ComponentPropsWithoutRef<"div">, "children" | "className">;

export function PropagandaFrame({
  src,
  alt,
  className = "",
  imageClassName = "",
  paddingClassName = "p-3",
  fitMode = "contain",
  sizes = "100vw",
  priority = false,
  ...restProps
}: PropagandaFrameProps) {
  const rootClassName = ["relative isolate overflow-hidden bg-white/10", className].filter(Boolean).join(" ");
  const imageContainerClassName = ["relative z-10 h-full w-full", paddingClassName].filter(Boolean).join(" ");
  const foregroundFitClassName = fitMode === "cover" ? "object-cover" : "object-contain";
  const foregroundClassName = [foregroundFitClassName, imageClassName].filter(Boolean).join(" ");

  return (
    <div className={rootClassName} {...restProps}>
      <Image
        src={src}
        alt=""
        fill
        aria-hidden="true"
        sizes={sizes}
        className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_58%),linear-gradient(135deg,rgba(255,255,255,0.14),rgba(15,23,42,0.42))]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(135deg,rgba(255,255,255,0.16)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.16)_50%,rgba(255,255,255,0.16)_75%,transparent_75%,transparent)] [background-size:18px_18px]"
      />
      <div className={imageContainerClassName}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className={foregroundClassName}
        />
      </div>
    </div>
  );
}
