"use client";
import { useEffect, useRef } from "react";
import type { ImageLike } from "@/lib/coverage/phi";

export function ImageCanvas({
  image,
  label,
  className = "",
}: {
  image: ImageLike;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const pixels = ctx.createImageData(image.width, image.height);
    pixels.data.set(image.data);
    ctx.putImageData(pixels, 0, 0);
  }, [image]);
  return (
    <canvas
      ref={ref}
      width={image.width}
      height={image.height}
      role="img"
      aria-label={label}
      className={`h-auto w-full bg-white ${className}`}
    />
  );
}
