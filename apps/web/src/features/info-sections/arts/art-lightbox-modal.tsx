"use client";
import React, { useMemo } from "react";
import { Lightbox } from "@tof-hub/ui";
import { gameAsset } from "@tof-hub/game-assets";
import type { ArtLightboxModalProps } from "./types";
import { cleanArtTitle, formatFileSize } from "./constants";

export function ArtLightboxModal({
  isOpen,
  artworks,
  activeIndex,
  onClose,
  onNavigate,
  strings,
  isRu,
  locale,
}: ArtLightboxModalProps) {
  const activeArtwork = artworks[activeIndex];
  const images = useMemo(
    () =>
      artworks.map((artwork) => ({
        src: gameAsset(artwork.pngUrl || artwork.sourcePath || artwork.url || "", "png"),
        webpSrc: gameAsset(artwork.webpUrl || artwork.sourcePath || artwork.url || "", "webp"),
        title: cleanArtTitle(artwork.title, isRu, locale),
        alt: cleanArtTitle(artwork.title, isRu, locale),
      })),
    [artworks, isRu, locale],
  );
  return (
    <Lightbox
      variant="art"
      zoomable={false}
      isOpen={isOpen}
      onClose={onClose}
      images={images}
      currentIndex={activeIndex}
      onIndexChange={(next) => onNavigate(next === (activeIndex + 1) % artworks.length ? 1 : -1)}
      downloadName={artworks[activeIndex]?.originalFileName || artworks[activeIndex]?.id}
      locale={isRu ? "ru" : "en"}
      downloadPngLabel={isRu ? "Скачать PNG" : "Download PNG"}
      resolution={
        activeArtwork?.width && activeArtwork.height
          ? `${activeArtwork.width} × ${activeArtwork.height}`
          : undefined
      }
      resolutionMeta={
        activeArtwork?.width && activeArtwork.height
          ? `${activeArtwork.width} × ${activeArtwork.height}${activeArtwork.category === "characters" ? " (Splash Art)" : ""}`
          : undefined
      }
      fileSize={formatFileSize(activeArtwork?.pngSizeBytes || activeArtwork?.sizeBytes)}
      gameFile={(activeArtwork?.sourcePath || activeArtwork?.originalFileName || "").replace(
        /\.(?:png|webp|jpg|jpeg)$/i,
        "",
      )}
      copyPathLabel={strings.copyPath}
      copiedLabel={strings.copied}
      zoomLabel={strings.zoom}
      closeLabel={strings.close}
      resolutionLabel={strings.resolution}
      fileSizeLabel={strings.fileSize}
      gameFileLabel={strings.gamePath}
    />
  );
}
