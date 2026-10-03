"use client";

import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@/lib/brand";

type BrandLogoProps = {
  contextTitle?: string;
  contextSubtitle?: string;
  centered?: boolean;
  size?: "sm" | "md" | "lg";
};

const logoSize = {
  sm: 56,
  md: 76,
  lg: 180,
};

export function BrandLogo({
  contextTitle,
  contextSubtitle,
  centered = false,
  size = "md",
}: BrandLogoProps) {
  const imageSize = logoSize[size];
  const imageHeight = Math.round(imageSize / BRAND.logoAspect);

  return (
    <Link
      href="/"
      className={`flex rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/30 ${
        centered ? "flex-col items-center text-center" : "min-w-0 items-center gap-2 sm:gap-3"
      }`}
    >
      <Image
        src={BRAND.logoSrc}
        alt={`شعار ${BRAND.nameAr}`}
        width={imageSize}
        height={imageHeight}
        priority={size === "lg"}
        className={`shrink-0 object-contain ${size === "sm" ? "h-auto w-11 sm:w-14" : ""}`}
      />
      {(contextTitle || contextSubtitle) && (
        <span className={centered ? "mt-2 block" : "block min-w-0"}>
          {contextTitle && (
            <span className="block truncate text-sm font-bold text-gray-900 sm:text-base">{contextTitle}</span>
          )}
          {contextSubtitle && (
            <span className="mt-0.5 block truncate text-xs text-gray-500">{contextSubtitle}</span>
          )}
        </span>
      )}
    </Link>
  );
}
