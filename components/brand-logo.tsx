"use client";

import Image from "next/image";
import Link from "next/link";

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
  const imageHeight = Math.round(imageSize * (317 / 344));

  return (
    <Link
      href="/"
      className={`flex rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 ${
        centered ? "flex-col items-center text-center" : "items-center gap-3"
      }`}
    >
      <Image
        src="/miqyas-logo.png"
        alt="شعار مقياس"
        width={imageSize}
        height={imageHeight}
        priority={size === "lg"}
        className="shrink-0 object-contain"
      />
      {(contextTitle || contextSubtitle) && (
        <span className={centered ? "mt-2 block" : "block"}>
          {contextTitle && (
            <span className="block font-bold text-gray-900">{contextTitle}</span>
          )}
          {contextSubtitle && (
            <span className="mt-0.5 block text-xs text-gray-500">{contextSubtitle}</span>
          )}
        </span>
      )}
    </Link>
  );
}
