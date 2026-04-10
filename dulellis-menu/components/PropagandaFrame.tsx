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
        className="pointer-events-none absolute inset-0 bg-slate-950/25"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-amber-50/10"
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
