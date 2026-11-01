"use client";
import React from "react";
import { Lightbox, type LightboxProps } from "@tof-hub/ui";

export interface InfoLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  src: string;
  webpSrc?: string;
  animation?: LightboxProps['animation'];
  caption?: string;
  alt?: string;
  isRu?: boolean;
}
export function InfoLightbox({ isRu = false, ...props }: InfoLightboxProps) {
  return (
    <Lightbox
      {...props}
      zoomable={false}
      locale={isRu ? "ru" : "en"}
      downloadPngLabel={isRu ? "Скачать PNG" : "Download PNG"}
      downloadWebpLabel={isRu ? "Скачать WebP" : "Download WebP"}
    />
  );
}
