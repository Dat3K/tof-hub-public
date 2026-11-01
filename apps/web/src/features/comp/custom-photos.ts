import {checkRasterFile} from '@/lib/raster-file';
const CUSTOM_PHOTO_KEY = 'tof_comp_custom_photos';
let customPhotoCache: Record<string, string> = {};
let isCacheLoaded = false;

function initCache() {
  if (isCacheLoaded || typeof window === 'undefined') return;
  try {
    const stored = localStorage.getItem(CUSTOM_PHOTO_KEY);
    if (stored) {
      customPhotoCache = JSON.parse(stored) || {};
    }
  } catch (_) {
    customPhotoCache = {};
  }
  isCacheLoaded = true;
}

function persistCache() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CUSTOM_PHOTO_KEY, JSON.stringify(customPhotoCache));
  } catch (_) {}
}

export function getCustomPhotoKey(pIdx: number, slotType: string, slotIdx = 0, chipIdx = 0): string {
  if (chipIdx === 1) return `${pIdx}_${slotType}_${slotIdx}_1`;
  return `${pIdx}_${slotType}_${slotIdx}`;
}

export function getCustomPhoto(pIdx: number, slotType: string, slotIdx = 0, chipIdx = 0): string | null {
  initCache();
  const cIdx = typeof chipIdx === 'number' ? chipIdx : 0;
  const key = getCustomPhotoKey(pIdx, slotType, slotIdx, cIdx);
  if (customPhotoCache[key]) return customPhotoCache[key];
  if (cIdx === 0 && customPhotoCache[`${pIdx}_${slotType}_${slotIdx}_0`]) {
    return customPhotoCache[`${pIdx}_${slotType}_${slotIdx}_0`];
  }
  return null;
}

export function setCustomPhoto(
  pIdx: number,
  slotType: string,
  slotIdx = 0,
  chipIdx = 0,
  dataUrl: string | null = null
) {
  initCache();
  const key = getCustomPhotoKey(pIdx, slotType, slotIdx, chipIdx);
  if (dataUrl) {
    customPhotoCache[key] = dataUrl;
  } else {
    delete customPhotoCache[key];
    if (chipIdx === 0) {
      delete customPhotoCache[`${pIdx}_${slotType}_${slotIdx}_0`];
    }
  }
  persistCache();
}

export function clearCustomPhoto(pIdx: number, slotType: string, slotIdx = 0, chipIdx?: number) {
  if (chipIdx === 0 || chipIdx === 1) {
    setCustomPhoto(pIdx, slotType, slotIdx, chipIdx, null);
  } else {
    setCustomPhoto(pIdx, slotType, slotIdx, 0, null);
    setCustomPhoto(pIdx, slotType, slotIdx, 1, null);
  }
}

export function clearAllCustomPhotos() {
  customPhotoCache = {};
  persistCache();
}

export function clearPlayerCustomPhotos(pIdx: number) {
  initCache();
  const prefix = `${pIdx}_`;
  Object.keys(customPhotoCache).forEach((k) => {
    if (k.startsWith(prefix)) {
      delete customPhotoCache[k];
    }
  });
  persistCache();
}

/** Swap custom photos between two slots (both chips, mirrors legacy swapCustomPhotos). */
export function swapCustomPhotos(
  pIdx1: number,
  slotType: string,
  slotIdx1: number,
  pIdx2: number,
  slotIdx2: number
) {
  initCache();
  for (const chipIdx of [0, 1]) {
    const val1 = getCustomPhoto(pIdx1, slotType, slotIdx1, chipIdx);
    const val2 = getCustomPhoto(pIdx2, slotType, slotIdx2, chipIdx);
    setCustomPhoto(pIdx1, slotType, slotIdx1, chipIdx, val2);
    setCustomPhoto(pIdx2, slotType, slotIdx2, chipIdx, val1);
  }
}

export async function processUploadedImageFile(file: File, callback: (dataUrl: string) => void):Promise<boolean> {
  if (!file || !await checkRasterFile(file,6*1024*1024)) return false;
  const reader = new FileReader();
  reader.onload = (e) => {
    const src = e.target?.result;
    if (typeof src === 'string') {
      callback(src);
    }
  };
  reader.readAsDataURL(file);
  return true;
}
