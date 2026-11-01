/**
 * The sealed files of the capture app (docs/imports.md): extension, envelope format and
 * the upload limit of each. The browser gate (apps/web lib/sealed-file.ts) and the API import services read them here.
 */
export const SEALED_FILES = {
  build: { extension: '.tofbuild', format: 'tof-hub-build-sealed', maxBytes: 1024 * 1024 },
  wish: { extension: '.tofwish', format: 'tof-hub-wish-sealed', maxBytes: 4 * 1024 * 1024 },
  players: { extension: '.tofplayers', format: 'tof-hub-players-sealed', maxBytes: 64 * 1024 * 1024 },
} as const;
export type SealedFileKind = keyof typeof SEALED_FILES;

/** The capture app writes the format first: `{"format":"<format>"` (an optional BOM and spaces before it). */
export const SEALED_FILE_SIGNATURE = /^﻿?\s*\{\s*"format"\s*:\s*"([a-z0-9-]{1,64})"/;
