import { localeText } from '@/lib/i18n/text';

import {
  carryOverInheritedCustomProperties,
  loadDomSnapshot,
  waitForDomSnapshotAssets,
} from '@/lib/dom-snapshot';
import { downloadPng } from '@/lib/download';
import { resolvePlayerServer } from '@tof-hub/contracts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProfileAvatar, type ProfileAvatarImage } from '@tof-hub/ui';
import type { WishLocale } from './wish-i18n';
import styles from './components/wish-banner-card.module.css';

export interface WishExportProfile {
  nickname: string;
  uid: string;
  server: string;
  serverId?: string;
  serverRegion: string;
  avatar?: string;
  avatarCosmetic?: ProfileAvatarImage;
  avatarFrameCosmetic?: ProfileAvatarImage;
}

/** "EU / Kuura", as on the Build card; profiles without a known server keep their own label. */
function serverLine(profile: WishExportProfile): string {
  const { server } = resolvePlayerServer({ uid: profile.uid, serverId: profile.serverId });
  if (!server) return profile.server;
  return `${server.regionCode} / ${server.name}${server.nativeName ? ` [${server.nativeName}]` : ''}`;
}

const EXPORT_WIDTH = 1216;
const EXPORT_SCALE = 2;

function pngAssetCandidate(source: string): string | null {
  try {
    const url = new URL(source, document.baseURI);
    if (!url.pathname.startsWith('/game-assets/webp/')) return null;
    url.pathname = url.pathname
      .replace('/game-assets/webp/', '/game-assets/png/')
      .replace(/\.webp$/i, '.png');
    return url.href;
  } catch {
    return null;
  }
}

async function loadExportImage(source: string): Promise<HTMLImageElement | null> {
  const candidates = [pngAssetCandidate(source), source].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = candidate;
    try {
      await image.decode();
      if (image.naturalWidth > 0 && image.naturalHeight > 0) return image;
    } catch {
      // Try the original asset when a higher-quality PNG variant is unavailable.
    }
  }
  return null;
}

async function imageAsPngDataUrl(source: string): Promise<string | null> {
  const image = await loadExportImage(source);
  if (!image) return null;
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(image, 0, 0);
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

async function prepareExportPngAssets(root: HTMLElement): Promise<void> {
  const converted = new Map<string, Promise<string | null>>();
  const asPng = (source: string): Promise<string | null> => {
    if (source.startsWith('data:image/png;')) return Promise.resolve(source);
    const cached = converted.get(source);
    if (cached) return cached;
    const task = imageAsPngDataUrl(source);
    converted.set(source, task);
    return task;
  };
  const imageTasks = Array.from(root.querySelectorAll('img')).map(async (image) => {
    const png = await asPng(image.currentSrc || image.src);
    if (png) image.src = png;
  });
  const backgroundTasks = Array.from(root.querySelectorAll<HTMLElement>('*')).map(async (element) => {
    const background = element.style.backgroundImage;
    if (!background || background === 'none') return;
    const urls = Array.from(background.matchAll(/url\(["']?(.*?)["']?\)/g));
    if (urls.length === 0) return;
    let prepared = background;
    for (const match of urls) {
      const source = match[1];
      if (!source) continue;
      const png = await asPng(source);
      if (png) prepared = prepared.replace(match[0], `url("${png}")`);
    }
    element.style.backgroundImage = prepared;
  });
  await Promise.all([...imageTasks, ...backgroundTasks]);
}

function makeLine(label: string, value: string): HTMLSpanElement {
  const line = document.createElement('span');
  const labelNode = document.createElement('span');
  labelNode.className = styles.exportProfileLabel;
  labelNode.textContent = label;
  const valueNode = document.createElement('span');
  valueNode.textContent = value;
  line.append(labelNode, valueNode);
  return line;
}

export function buildWishBannerExportScene(
  sourceCard: HTMLElement,
  profile: WishExportProfile,
  locale: WishLocale,
): HTMLElement {
  document.querySelector('[data-wish-export-root]')?.remove();
  const root = document.createElement('div');
  root.className = styles.exportRoot;
  root.dataset.wishExportRoot = '';
  root.setAttribute('aria-hidden', 'true');

  const card = sourceCard.cloneNode(true) as HTMLElement;
  carryOverInheritedCustomProperties(sourceCard, card);
  card.querySelector('[data-wish-artwork-controls]')?.remove();
  card.removeAttribute('id');
  card.classList.remove(styles.collapsedShowcase);
  card.style.width = `${EXPORT_WIDTH}px`;
  card.style.maxWidth = 'none';
  card.style.transform = 'none';

  const identity = document.createElement('div');
  identity.className = styles.exportProfile;
  const eyebrow = document.createElement('div');
  eyebrow.className = styles.exportProfileEyebrow;
  eyebrow.textContent = localeText(locale)('PLAYER PROFILE');
  const name = document.createElement('strong');
  name.className = styles.exportProfileName;
  name.textContent = profile.nickname;
  // The same avatar and frame as the profile switcher (generated canvas alignment); inline styles only.
  const avatar = profile.avatarCosmetic ?? (profile.avatar ? { icon: profile.avatar } : undefined);
  const heading = document.createElement('div');
  heading.className = styles.exportProfileHeading;
  if (avatar) {
    const avatarNode = document.createElement('span');
    avatarNode.className = styles.exportProfileAvatar;
    avatarNode.innerHTML = renderToStaticMarkup(createElement(ProfileAvatar, { size: 42, avatar, frame: profile.avatarFrameCosmetic }));
    heading.append(avatarNode);
  }
  heading.append(name);
  const details = document.createElement('div');
  details.className = styles.exportProfileDetails;
  // The author mark shares the server row (export only).
  const server = makeLine(localeText(locale)('SERVER'), serverLine(profile));
  const brand = document.createElement('span');
  brand.className = styles.exportProfileBrand;
  brand.textContent = '@kritik';
  server.classList.add(styles.exportProfileBranded);
  server.append(brand);
  details.append(makeLine('UID', profile.uid), server);
  identity.append(eyebrow, heading, details);
  card.appendChild(identity);

  root.appendChild(card);
  document.body.appendChild(root);
  return root;
}

export function destroyWishBannerExportScene(): void {
  document.querySelector('[data-wish-export-root]')?.remove();
}

export async function exportWishBannerCard(
  sourceCard: HTMLElement,
  profile: WishExportProfile,
  bannerId: string,
  locale: WishLocale,
): Promise<void> {
  const snapshot = await loadDomSnapshot();
  const root = buildWishBannerExportScene(sourceCard, profile, locale);
  try {
    await waitForDomSnapshotAssets(root);
    await prepareExportPngAssets(root);
    await waitForDomSnapshotAssets(root);
    const card = root.firstElementChild as HTMLElement;
    const height = Math.ceil(card.getBoundingClientRect().height);
    const dataUrl = await snapshot.toPng(card, {
      backgroundColor: '#11151c',
      width: EXPORT_WIDTH,
      height,
      pixelRatio: EXPORT_SCALE,
      cacheBust: true,
    });
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    if (image.naturalWidth !== EXPORT_WIDTH * EXPORT_SCALE || image.naturalHeight !== height * EXPORT_SCALE) {
      throw new Error('Export rendered at an unexpected size');
    }
    // Named after the player like the Build card PNG (tof-build-<name>), plus the banner.
    const safe = (text: string) => text.replace(/[^\p{L}\p{N}_-]/gu, '-');
    downloadPng(dataUrl, `tof-wish-${safe(profile.nickname || 'wanderer')}-${safe(bannerId)}.png`);
  } finally {
    destroyWishBannerExportScene();
  }
}
