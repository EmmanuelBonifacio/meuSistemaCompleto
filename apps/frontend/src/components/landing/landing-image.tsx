"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  /** Caminhos em public/landing/ a tentar, por ordem (ex.: .png e .jpg) */
  paths: string[];
  alt: string;
  className?: string;
  priority?: boolean;
};

export function LandingImage({ paths, alt, className, priority }: Props) {
  const [index, setIndex] = useState(0);
  const src = paths[index] ?? paths[0];
  const failedAll = index >= paths.length;

  if (failedAll || !src) {
    return (
      <div
        className={`flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-gradient-to-br from-slate-100 to-slate-50 text-slate-500 ${className ?? ""}`}
      >
        <ImageOff className="h-10 w-10 opacity-50" aria-hidden />
        <p className="max-w-xs px-4 text-center text-xs leading-relaxed">
          Coloque a imagem em <code className="rounded bg-slate-200 px-1">public/landing/</code>{" "}
          com um destes nomes:{" "}
          <code className="rounded bg-slate-200 px-1">{paths[0]?.split("/").pop()}</code>
        </p>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={800}
      height={600}
      className={cn(
        "block h-auto w-full max-w-full object-cover align-middle",
        className,
      )}
      style={{ maxWidth: "100%", height: "auto" }}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={() =>
        setIndex((i) => (i < paths.length - 1 ? i + 1 : paths.length))
      }
    />
  );
}
