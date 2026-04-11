import type { ComponentPropsWithoutRef } from "react";

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
  sizes: _sizes = "100vw",
  priority = false,
  ...restProps
}: PropagandaFrameProps) {
  const rootClassName = ["relative isolate overflow-hidden bg-white/10", className].filter(Boolean).join(" ");
  const imageContainerClassName = ["relative z-10 h-full w-full", paddingClassName].filter(Boolean).join(" ");
  const foregroundFitClassName = fitMode === "cover" ? "object-cover" : "object-contain";
  const foregroundClassName = [foregroundFitClassName, imageClassName].filter(Boolean).join(" ");
  const imageLoading = priority ? "eager" : "lazy";

  return (
    <div className={rootClassName} {...restProps}>
      <img
        src={src}
        alt=""
        loading={imageLoading}
        decoding="async"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 block h-full w-full scale-110 object-cover opacity-40 blur-xl"
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
        <img
          src={src}
          alt={alt}
          loading={imageLoading}
          decoding="async"
          draggable={false}
          className={`block h-full w-full ${foregroundClassName}`}
        />
      </div>
    </div>
  );
}
