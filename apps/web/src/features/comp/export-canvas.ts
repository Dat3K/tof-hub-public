import { localized } from '@tof-hub/i18n';
import { createLocaleCopies } from '@tof-hub/i18n';
import type { Locale } from '@tof-hub/i18n';
import { downloadCanvasPng } from '@/lib/download';
import type {WeaponOptionsCatalog} from '../info-sections/common/weapon-options';
import type { SquadState, SquadPlayer } from './types';
import { formatRelicRank, formatStars } from './format';
import type {
  CompCatalogView,
  CompWeaponView,
  CompMatrixView,
  CompRelicView,
  CompSimulacrumView,
} from './data';
import {
  resolveCompTraitIcon,
  resolveCompWeaponIcon,
  resolveCompMatrixIcon,
  resolveCompRelicIcon,
  resolveCompRoleIcon,
  resolveCompElementIcon,
} from './data';
import { gameAsset } from '@tof-hub/game-assets';
import { getPlayerActiveRole } from './state';
import { serializeSquadState } from './codecs';
import { getCustomPhoto } from './custom-photos';
import { isCustomPhoto, isCustomText } from './types';
import {COMP_TRAIT_IMAGE_SCALE,coverImageRect} from './image-layout';


const EXPORT_I18N: Record<Locale, (Record<Locale, Record<string, string>>)['en']> = createLocaleCopies(({
  en: {
    thPlayer: '# • ROLE & PLAYER',
    thTrait: 'TRAIT',
    thWeapons: 'WEAPONS (3 SLOTS)',
    thMatrices: 'MATRIX CHIPSETS',
    thRelics: 'RELICS (R0–R5)',
    roleTank: 'FORTITUDE',
    roleHealer: 'BENEDICTION',
    roleDps: 'ATTACK',
    roleBalance: 'BALANCE',
    emptyWeapon: '+ WEAPON',
    emptyMatrix: '+ MATRIX',
    emptyRelic: '+ RELIC',
    emptyTrait: '+ TRAIT',
  },
  ru: {
    thPlayer: '# • РОЛЬ И ИГРОК',
    thTrait: 'ЧЕРТА',
    thWeapons: 'ОРУЖИЕ',
    thMatrices: 'МАТРИЦЫ',
    thRelics: 'РЕЛИКВИИ',
    roleTank: 'ЗАЩИТА',
    roleHealer: 'БЛАГОСЛОВЕНИЕ',
    roleDps: 'НАПАДЕНИЕ',
    roleBalance: 'БАЛАНС',
    emptyWeapon: '+ ОРУЖИЕ',
    emptyMatrix: '+ МАТРИЦА',
    emptyRelic: '+ РЕЛИКВИЯ',
    emptyTrait: '+ ЧЕРТА',
  },
}) satisfies Pick<Record<Locale, Record<string, string>>, 'en' | 'ru'>);

function t(key: string, locale: Locale): string {
  return EXPORT_I18N[locale][key] ?? EXPORT_I18N.en[key] ?? key;
}

function loadImage(src: string, timeoutMs = 3500): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src || typeof Image === 'undefined') {
      resolve(null);
      return;
    }
    let settled = false;
    const done = (img: HTMLImageElement | null) => {
      if (settled) return;
      settled = true;
      resolve(img);
    };
    const timer = window.setTimeout(() => done(null), timeoutMs);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      window.clearTimeout(timer);
      done(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      done(null);
    };
    img.src = src;
  });
}

type RoundRadius = number | { tl?: number; tr?: number; br?: number; bl?: number };

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: RoundRadius,
  fill = false,
  stroke = false
) {
  const r = typeof radius === 'number' ? { tl: radius, tr: radius, br: radius, bl: radius } : radius;
  const tl = r.tl ?? 0;
  const tr = r.tr ?? 0;
  const br = r.br ?? 0;
  const bl = r.bl ?? 0;
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + width - tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + tr);
  ctx.lineTo(x + width, y + height - br);
  ctx.quadraticCurveTo(x + width, y + height, x + width - br, y + height);
  ctx.lineTo(x + bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function drawImageFit(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  padding = 4
) {
  const availW = Math.max(1, width - padding * 2);
  const availH = Math.max(1, height - padding * 2);
  const scale = Math.min(availW / img.width, availH / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  ctx.drawImage(img, x + (width - drawW) / 2, y + (height - drawH) / 2, drawW, drawH);
}

function drawCircularImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  radius: number
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  const size = radius * 2;
  const rect=coverImageRect(img.width,img.height,size,size,COMP_TRAIT_IMAGE_SCALE);
  ctx.drawImage(img,cx-radius+rect.x,cy-radius+rect.y,rect.width,rect.height);
  ctx.restore();
}

function drawSlotImage(ctx:CanvasRenderingContext2D,img:HTMLImageElement,x:number,y:number,width:number,height:number) {
  const rect=coverImageRect(img.width,img.height,width-2,height-2);
  ctx.save();
  drawRoundRect(ctx,x+1,y+1,width-2,height-2,7);
  ctx.clip();
  ctx.drawImage(img,x+1+rect.x,y+1+rect.y,rect.width,rect.height);
  ctx.restore();
}

function drawEmptySlot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string
) {
  ctx.save();
  ctx.fillStyle = 'rgba(12, 16, 26, 0.92)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 1;
  drawRoundRect(ctx, x, y, w, h, 8, true, true);
  ctx.font = "bold 9px 'JetBrains Mono', Consolas, monospace";
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label.length > 9 ? label.substring(0, 8) + '…' : label, x + w / 2, y + h / 2);
  ctx.restore();
}

function drawCustomPhotoSlot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  img: HTMLImageElement | null,
  customText: string | null | undefined,
  slotType: string,
  starOrRank: number | string | undefined,
  count?: number
) {
  ctx.save();
  if (img) {
    const accent = slotType === 'matrix' ? 'rgba(192, 132, 252, 0.4)' : 'rgba(56, 189, 248, 0.4)';
    drawSlotImage(ctx, img, x, y, w, h);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    drawRoundRect(ctx, x, y, w, h, 8, false, true);
  } else {
    const isMatrix = slotType === 'matrix';
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.strokeStyle = isMatrix ? 'rgba(192, 132, 252, 0.4)' : 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1;
    drawRoundRect(ctx, x, y, w, h, 8, true, true);
    ctx.font = "bold 9px 'JetBrains Mono', Consolas, monospace";
    ctx.fillStyle = isMatrix ? '#c084fc' : '#38bdf8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PHOTO', x + w / 2, y + h / 2 - (customText && customText.trim() ? 6 : 0));
    if (customText && customText.trim()) {
      const label = customText.trim();
      ctx.font = "bold 7px 'JetBrains Mono', Consolas, monospace";
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(label.length > 10 ? label.substring(0, 9) + '…' : label, x + w / 2, y + h / 2 + 8);
    }
  }
  if (starOrRank !== undefined && starOrRank !== null && starOrRank !== '') {
    if (slotType === 'matrix') {
      drawMatrixBadge(ctx, x + w - 26, y + 3, `${count === 2 ? 2 : 4}pc`);
      drawStarBadge(ctx, x + w - 26, y + h - 17, starOrRank);
    } else if (slotType === 'relic') {
      drawRelicBadge(ctx, x + w - 26, y + 2, starOrRank);
    } else {
      drawStarBadge(ctx, x + w - 26, y + h - 17, starOrRank);
    }
  }
  ctx.restore();
}

function drawStarBadge(ctx: CanvasRenderingContext2D, x: number, y: number, stars: number | string) {
  const text = formatStars(stars);
  ctx.save();
  ctx.font = "bold 9px 'JetBrains Mono', Consolas, monospace";
  const metrics = ctx.measureText(text);
  const w = Math.max(24, Math.round(metrics.width + 8));
  const h = 15;
  const r = 3;
  const drawX = x - (w - 24);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
  ctx.lineWidth = 1;
  drawRoundRect(ctx, drawX, y, w, h, r, true, true);
  ctx.fillStyle = '#fbbf24';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, drawX + w / 2, y + h / 2 + 0.5);
  ctx.restore();
}

function drawMatrixBadge(ctx: CanvasRenderingContext2D, x: number, y: number, count: string | number) {
  const text =
    typeof count === 'string' ? (count.includes('pc') || count.includes('+') ? count : `${count}pc`) : `${count}pc`;
  const w = 24;
  const h = 14;
  const r = 3;
  ctx.save();
  ctx.fillStyle = 'rgba(192, 132, 252, 0.35)';
  ctx.strokeStyle = 'rgba(192, 132, 252, 0.65)';
  ctx.lineWidth = 1;
  drawRoundRect(ctx, x, y, w, h, r, true, true);
  ctx.font = "bold 8.5px 'JetBrains Mono', Consolas, monospace";
  ctx.fillStyle = '#e9d5ff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2 + 0.5);
  ctx.restore();
}

function drawElementBadge(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  elemIconImg: HTMLImageElement | null
) {
  const r = 8.5;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(8, 12, 20, 0.85)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1;
  ctx.fill();
  ctx.stroke();
  if (elemIconImg) {
    const iconSize = 12;
    ctx.drawImage(elemIconImg, cx - iconSize / 2, cy - iconSize / 2, iconSize, iconSize);
  }
  ctx.restore();
}

function drawRelicBadge(ctx: CanvasRenderingContext2D, x: number, y: number, rank: number | string) {
  const str = String(rank).trim();
  const num = typeof rank === 'number' ? rank : parseInt(str.replace(/\D/g, ''), 10);
  const text = formatRelicRank(rank);
  ctx.save();
  ctx.font = "bold 10px 'JetBrains Mono', Consolas, monospace";
  const metrics = ctx.measureText(text);
  const w = Math.max(24, Math.round(metrics.width + 6));
  const h = 17;
  const r = 4;
  const drawX = x - (w - 24);

  if (rank === 5 || num === 5 || str.toUpperCase() === 'MAX') {
    const grad = ctx.createLinearGradient(drawX, y, drawX + w, y + h);
    grad.addColorStop(0, '#f59e0b');
    grad.addColorStop(1, '#d97706');
    ctx.fillStyle = grad;
    ctx.shadowColor = 'rgba(245, 158, 11, 0.55)';
    ctx.shadowBlur = 6;
    drawRoundRect(ctx, drawX, y, w, h, r, true, false);
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#000000';
  } else if (num === 4) {
    const grad = ctx.createLinearGradient(drawX, y, drawX + w, y + h);
    grad.addColorStop(0, '#c084fc');
    grad.addColorStop(1, '#9333ea');
    ctx.fillStyle = grad;
    ctx.shadowColor = 'rgba(192, 132, 252, 0.4)';
    ctx.shadowBlur = 5;
    drawRoundRect(ctx, drawX, y, w, h, r, true, false);
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#ffffff';
  } else if (num === 3) {
    const grad = ctx.createLinearGradient(drawX, y, drawX + w, y + h);
    grad.addColorStop(0, '#38bdf8');
    grad.addColorStop(1, '#0284c7');
    ctx.fillStyle = grad;
    ctx.shadowColor = 'rgba(56, 189, 248, 0.4)';
    ctx.shadowBlur = 5;
    drawRoundRect(ctx, drawX, y, w, h, r, true, false);
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#000000';
  } else if (num >= 1) {
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    drawRoundRect(ctx, drawX, y, w, h, r, true, true);
    ctx.fillStyle = '#94a3b8';
  } else {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    drawRoundRect(ctx, drawX, y, w, h, r, true, true);
    ctx.fillStyle = '#64748b';
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, drawX + w / 2, y + h / 2 + 0.5);
  ctx.restore();
}

function drawRoleBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  roleId: string,
  roleLabel: string,
  roleIconImg: HTMLImageElement | null
): number {
  const h = 20;
  ctx.save();
  ctx.font = "bold 10px 'JetBrains Mono', Consolas, monospace";
  const textW = ctx.measureText(roleLabel).width;
  const hasIcon = Boolean(roleIconImg);
  const iconW = hasIcon ? 13 : 0;
  const gap = hasIcon ? 5 : 0;
  const pad = 7;
  const w = pad * 2 + iconW + gap + textW;
  let bg = 'rgba(239, 68, 68, 0.2)';
  let border = 'rgba(239, 68, 68, 0.4)';
  let textCol = '#fca5a5';
  if (roleId === 'tank') {
    bg = 'rgba(234, 179, 8, 0.2)';
    border = 'rgba(234, 179, 8, 0.4)';
    textCol = '#fde047';
  } else if (roleId === 'healer') {
    bg = 'rgba(16, 185, 129, 0.2)';
    border = 'rgba(16, 185, 129, 0.4)';
    textCol = '#6ee7b7';
  } else if (roleId === 'balance') {
    bg = 'rgba(148, 163, 184, 0.2)';
    border = 'rgba(148, 163, 184, 0.4)';
    textCol = '#e2e8f0';
  }
  ctx.fillStyle = bg;
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  drawRoundRect(ctx, x, y, w, h, 4, true, true);
  let currentX = x + pad;
  if (hasIcon && roleIconImg) {
    ctx.drawImage(roleIconImg, currentX, y + (h - 13) / 2, 13, 13);
    currentX += 13 + gap;
  }
  ctx.fillStyle = textCol;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(roleLabel, currentX, y + h / 2 + 1);
  ctx.restore();
  return w;
}

function drawRowBackground(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  roleId: string
) {
  ctx.save();
  let leftStripeColor = '#ef4444';
  let borderColor = 'rgba(239, 68, 68, 0.38)';
  let bgStart = 'rgba(239, 68, 68, 0.18)';
  let bgMid = 'rgba(28, 20, 32, 0.95)';
  if (roleId === 'tank') {
    leftStripeColor = '#eab308';
    borderColor = 'rgba(234, 179, 8, 0.38)';
    bgStart = 'rgba(202, 160, 48, 0.18)';
    bgMid = 'rgba(20, 24, 36, 0.95)';
  } else if (roleId === 'healer') {
    leftStripeColor = '#10b981';
    borderColor = 'rgba(16, 185, 129, 0.38)';
    bgStart = 'rgba(16, 185, 129, 0.18)';
    bgMid = 'rgba(18, 26, 36, 0.95)';
  } else if (roleId === 'balance') {
    leftStripeColor = '#94a3b8';
    borderColor = 'rgba(148, 163, 184, 0.38)';
    bgStart = 'rgba(148, 163, 184, 0.18)';
    bgMid = 'rgba(24, 18, 36, 0.95)';
  }
  const grad = ctx.createLinearGradient(x, y, x + width, y);
  grad.addColorStop(0, bgStart);
  grad.addColorStop(0.28, bgMid);
  grad.addColorStop(1, 'rgba(15, 20, 32, 0.98)');
  ctx.fillStyle = grad;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  drawRoundRect(ctx, x, y, width, height, 10, true, true);
  ctx.save();
  drawRoundRect(ctx, x, y, width, height, 10, false, false);
  ctx.clip();
  ctx.fillStyle = leftStripeColor;
  ctx.fillRect(x, y, 4, height);
  ctx.restore();
  ctx.restore();
}

function getFileName(state: SquadState): string {
  const mode = state && state.mode === 8 ? 8 : 4;
  return mode === 8 ? 'squad-comp-8p.png' : 'squad-comp-4p.png';
}

interface SlotLookups {
  sims: Map<string, CompSimulacrumView>;
  weapons: Map<string, CompWeaponView>;
  matrices: Map<string, CompMatrixView>;
  relics: Map<string, CompRelicView>;
}

function buildLookups(catalog: CompCatalogView): SlotLookups {
  const sims = new Map<string, CompSimulacrumView>();
  const weapons = new Map<string, CompWeaponView>();
  const matrices = new Map<string, CompMatrixView>();
  const relics = new Map<string, CompRelicView>();
  for (const s of catalog.simulacra || []) sims.set(s.id, s);
  for (const w of catalog.weapons || []) weapons.set(w.id, w);
  for (const m of catalog.matrices || []) matrices.set(m.id, m);
  for (const r of catalog.relics || []) relics.set(r.id, r);
  return { sims, weapons, matrices, relics };
}

function roleExportLabel(roleId: string, locale: Locale): string {
  if (roleId === 'tank') return t('roleTank', locale);
  if (roleId === 'healer') return t('roleHealer', locale);
  if (roleId === 'balance') return t('roleBalance', locale);
  return t('roleDps', locale);
}

function drawWeaponChip(
  ctx: CanvasRenderingContext2D,
  images: Map<string, HTMLImageElement>,
  lookups: SlotLookups,
  chipX: number,
  chipY: number,
  chipW: number,
  chipH: number,
  chipId: string | null | undefined,
  stars: number | string | undefined,
  customText: string | null | undefined,
  chipIdx: number,
  pIdx: number,
  wIdx: number,
  locale: Locale
) {
  ctx.save();
  const id = chipId || '';
  const photo = isCustomPhoto(id);
  const text = isCustomText(id) || id === '__EMPTY__';
  const weapon = !photo && !text && id ? lookups.weapons.get(id) ?? null : null;
  const weaponImg = weapon ? images.get(resolveCompWeaponIcon(weapon)) ?? null : null;

  if (photo) {
    const customUrl = getCustomPhoto(pIdx, 'weapon', wIdx, chipIdx) || '';
    const customImg = customUrl ? images.get(customUrl) ?? null : null;
    if (customImg) {
      drawSlotImage(ctx, customImg, chipX, chipY, chipW, chipH);
    } else {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1;
      drawRoundRect(ctx, chipX, chipY, chipW, chipH, 2, true, true);
      ctx.font = "bold 7px 'JetBrains Mono', Consolas, monospace";
      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PHOTO', chipX + chipW / 2, chipY + chipH / 2);
    }
  } else if (weapon && weaponImg) {
    drawSlotImage(ctx, weaponImg, chipX, chipY, chipW, chipH);
    const elemIconSrc = resolveCompElementIcon(weapon.element || 'Altered');
    const elemIconImg = elemIconSrc ? images.get(elemIconSrc) ?? null : null;
    if (elemIconImg) {
      drawElementBadge(ctx, chipX + 8, chipY + 8, elemIconImg);
    }
  } else {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 1;
    drawRoundRect(ctx, chipX, chipY, chipW, chipH, 2, true, true);
    const label = customText && customText.trim() ? customText.trim() : chipIdx === 1 ? '+' : t('emptyWeapon', locale);
    ctx.font = "bold 8px 'JetBrains Mono', Consolas, monospace";
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label.length > 7 ? label.substring(0, 6) + '…' : label, chipX + chipW / 2, chipY + chipH / 2);
  }

  const starVal = typeof stars === 'number' ? stars : 6;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
  ctx.lineWidth = 1;
  drawRoundRect(ctx, chipX + chipW - 18, chipY + chipH - 12, 16, 10, 2, true, true);
  ctx.font = "bold 8px 'JetBrains Mono', Consolas, monospace";
  ctx.fillStyle = '#fbbf24';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★' + starVal, chipX + chipW - 10, chipY + chipH - 7);
  ctx.restore();
}

function drawMatrixChip(
  ctx: CanvasRenderingContext2D,
  images: Map<string, HTMLImageElement>,
  lookups: SlotLookups,
  chipX: number,
  chipY: number,
  chipW: number,
  chipH: number,
  chipId: string | null | undefined,
  stars: number | string | undefined,
  customText: string | null | undefined,
  chipIdx: number,
  pIdx: number,
  mIdx: number,
  locale: Locale
) {
  ctx.save();
  const id = chipId || '';
  const photo = isCustomPhoto(id);
  const text = isCustomText(id) || id === '__EMPTY__';
  const matrixMeta = !photo && !text && id ? lookups.matrices.get(id) ?? null : null;
  const matrixImg = matrixMeta
    ? images.get(gameAsset(matrixMeta.icon || matrixMeta.suitPortrait || '')) ?? null
    : null;

  if (photo) {
    const customUrl = getCustomPhoto(pIdx, 'matrix', mIdx, chipIdx) || '';
    const customImg = customUrl ? images.get(customUrl) ?? null : null;
    if (customImg) {
      drawSlotImage(ctx, customImg, chipX, chipY, chipW, chipH);
    } else {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.4)';
      ctx.lineWidth = 1;
      drawRoundRect(ctx, chipX, chipY, chipW, chipH, 2, true, true);
      ctx.font = "bold 7px 'JetBrains Mono', Consolas, monospace";
      ctx.fillStyle = '#c084fc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PHOTO', chipX + chipW / 2, chipY + chipH / 2);
    }
  } else if (matrixMeta && matrixImg) {
    drawSlotImage(ctx, matrixImg, chipX, chipY, chipW, chipH);
  } else {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.38)';
    ctx.lineWidth = 1;
    drawRoundRect(ctx, chipX, chipY, chipW, chipH, 2, true, true);
    const label = customText && customText.trim() ? customText.trim() : chipIdx === 1 ? '+' : t('emptyMatrix', locale);
    ctx.font = "bold 8px 'JetBrains Mono', Consolas, monospace";
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label.length > 7 ? label.substring(0, 6) + '…' : label, chipX + chipW / 2, chipY + chipH / 2);
  }

  const starVal = typeof stars === 'number' ? stars : 3;
  const badgeX = chipIdx === 0 ? chipX + 2 : chipX + chipW - 20;
  const badgeY = chipIdx === 0 ? chipY + 2 : chipY + chipH - 13;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
  ctx.lineWidth = 1;
  drawRoundRect(ctx, badgeX, badgeY, 18, 11, 2, true, true);
  ctx.font = "bold 8px 'JetBrains Mono', Consolas, monospace";
  ctx.fillStyle = '#fbbf24';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★' + starVal, badgeX + 9, badgeY + 5.5);
  ctx.restore();
}

/**
 * Copies shareable link to clipboard and returns URL string.
 */
export async function copyShareLink(state: SquadState): Promise<string> {
  const code = serializeSquadState(state);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/tools/comp';
  const url = `${origin}${pathname}?c=${code}`;

  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(url);
  }
  return url;
}

/**
 * Renders the legacy table-card infographic to canvas and downloads it as
 * squad-comp-4p.png / squad-comp-8p.png. Returns the filename.
 */
export async function exportCompToPng(
  state: SquadState,
  catalog: CompCatalogView,
  options: { locale?: Locale } = {}
): Promise<string> {
  if (typeof document === 'undefined') return '';
  const locale: Locale = options.locale ?? 'en';
  const lookups = buildLookups(catalog);
  const mode = state && state.mode === 8 ? 8 : 4;
  const activePlayers: SquadPlayer[] = (state.players || []).slice(0, mode);

  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch (_) {}
  }

  // 1. Preload every image up front (mirrors legacy imageLoadMap).
  const queued = new Map<string, Promise<HTMLImageElement | null>>();
  const queueImage = (src: string) => {
    if (!src || queued.has(src)) return;
    queued.set(src, loadImage(src));
  };
  for (const roleId of ['tank', 'healer', 'dps', 'balance']) {
    queueImage(resolveCompRoleIcon(roleId));
  }
  for (const elem of ['Flame', 'Frost', 'Volt', 'Physical', 'Altered']) {
    queueImage(resolveCompElementIcon(elem));
  }
  activePlayers.forEach((p, pIdx) => {
    if (!p) return;
    if (isCustomPhoto(p.trait)) {
      const url = getCustomPhoto(pIdx, 'trait', 0) || '';
      if (url) queueImage(url);
    } else if (p.trait) {
      const sim = lookups.sims.get(p.trait);
      if (sim) queueImage(resolveCompTraitIcon(sim));
    }
    (p.weapons || []).forEach((w, wIdx) => {
      if (!w) return;
      if (w.id) {
        if (isCustomPhoto(w.id)) {
          const url = getCustomPhoto(pIdx, 'weapon', wIdx, 0) || '';
          if (url) queueImage(url);
        } else {
          const weapon = lookups.weapons.get(w.id);
          if (weapon) queueImage(resolveCompWeaponIcon(weapon));
        }
      }
      if (w.id2) {
        if (isCustomPhoto(w.id2)) {
          const url = getCustomPhoto(pIdx, 'weapon', wIdx, 1) || '';
          if (url) queueImage(url);
        } else {
          const weapon2 = lookups.weapons.get(w.id2);
          if (weapon2) queueImage(resolveCompWeaponIcon(weapon2));
        }
      }
      if (w.matrix) {
        if (w.matrix.id) {
          if (isCustomPhoto(w.matrix.id)) {
            const url = getCustomPhoto(pIdx, 'matrix', wIdx, 0) || '';
            if (url) queueImage(url);
          } else {
            const matrix = lookups.matrices.get(w.matrix.id);
            if (matrix) queueImage(gameAsset(matrix.icon || matrix.suitPortrait || ''));
          }
        }
        if (w.matrix.id2) {
          if (isCustomPhoto(w.matrix.id2)) {
            const url = getCustomPhoto(pIdx, 'matrix', wIdx, 1) || '';
            if (url) queueImage(url);
          } else {
            const matrix2 = lookups.matrices.get(w.matrix.id2);
            if (matrix2) queueImage(gameAsset(matrix2.icon || matrix2.suitPortrait || ''));
          }
        }
      }
    });
    (p.relics || []).forEach((r, rIdx) => {
      if (!r || !r.id) return;
      if (isCustomPhoto(r.id)) {
        const url = getCustomPhoto(pIdx, 'relic', rIdx) || '';
        if (url) queueImage(url);
      } else {
        const relic = lookups.relics.get(r.id);
        if (relic) queueImage(resolveCompRelicIcon(relic));
      }
    });
  });
  const weaponOptions:WeaponOptionsCatalog|null=state.server==='standard'?await fetch('/game-data/runtime/weapon-options.json').then(response=>response.ok?response.json():null).catch(()=>null):null;
  for(const player of activePlayers)for(const weapon of player.weapons)for(const secondary of [false,true]) {
    const id=secondary?weapon.id2:weapon.id,selected=[...(secondary?weapon.skills2:weapon.skills)??[],(secondary?weapon.mode2:weapon.mode)??''];
    const options=id?weaponOptions?.weapons[id]:undefined;
    for(const skill of [...options?.selectableSkills??[],...options?.selectableModes??[]])if(selected.includes(skill.id))queueImage(skill.icon);
  }
  const images = new Map<string, HTMLImageElement>();
  await Promise.all(
    Array.from(queued.entries()).map(async ([src, promise]) => {
      try {
        const img = await promise;
        if (img) images.set(src, img);
      } catch (_) {}
    })
  );

  // 2. Geometry (legacy table-only export).
  const margin = 20;
  const cardX = margin;
  const cardY = margin;
  const cardWidth = 1080;
  const theadHeight = 36;
  const hasTechniques=state.server==='standard'&&activePlayers.some(player=>player.weapons.some(weapon=>weapon.skills?.some(Boolean)||weapon.skills2?.some(Boolean)||!!weapon.mode||!!weapon.mode2));
  const rowHeight = hasTechniques?122:84;
  const rowGap = 8;
  const innerPadding = 8;
  const rowsTotalHeight = activePlayers.length * rowHeight + Math.max(0, activePlayers.length - 1) * rowGap;
  const cardHeight = theadHeight + innerPadding * 2 + rowsTotalHeight;
  const canvasWidth = cardWidth + margin * 2;
  const totalHeight = cardHeight + margin * 2;
  const scale = 3840 / canvasWidth;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(canvasWidth * scale);
  canvas.height = Math.round(totalHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.save();
  ctx.scale(scale, scale);

  // 3. Background + ambient glows.
  ctx.fillStyle = '#0a0d14';
  ctx.fillRect(0, 0, canvasWidth, totalHeight);
  const rad1 = ctx.createRadialGradient(240, 100, 10, 240, 100, 650);
  rad1.addColorStop(0, 'rgba(56, 189, 248, 0.08)');
  rad1.addColorStop(1, 'rgba(56, 189, 248, 0)');
  ctx.fillStyle = rad1;
  ctx.fillRect(0, 0, canvasWidth, totalHeight);
  const rad2 = ctx.createRadialGradient(
    canvasWidth - 260,
    totalHeight - 100,
    10,
    canvasWidth - 260,
    totalHeight - 100,
    600
  );
  rad2.addColorStop(0, 'rgba(168, 85, 247, 0.06)');
  rad2.addColorStop(1, 'rgba(168, 85, 247, 0)');
  ctx.fillStyle = rad2;
  ctx.fillRect(0, 0, canvasWidth, totalHeight);

  // 4. Card container + column headers.
  ctx.fillStyle = 'rgba(15, 20, 32, 0.95)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  drawRoundRect(ctx, cardX, cardY, cardWidth, cardHeight, 14, true, true);

  ctx.fillStyle = 'rgba(10, 14, 22, 0.9)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  drawRoundRect(ctx, cardX, cardY, cardWidth, theadHeight, { tl: 14, tr: 14, br: 0, bl: 0 }, true, true);

  ctx.font = "bold 11px 'JetBrains Mono', Consolas, monospace";
  ctx.fillStyle = '#94a3b8';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(t('thPlayer', locale), cardX + 24, cardY + theadHeight / 2);
  ctx.textAlign = 'center';
  ctx.fillText(t('thTrait', locale), cardX + 275, cardY + theadHeight / 2);
  ctx.fillText(t('thWeapons', locale), cardX + 346 + 107, cardY + theadHeight / 2);
  ctx.fillText(t('thMatrices', locale), cardX + 606 + 107, cardY + theadHeight / 2);
  ctx.fillText(t('thRelics', locale), cardX + 866 + 70, cardY + theadHeight / 2);
  ctx.textAlign='right';
  ctx.fillStyle='#94a3b8';
  ctx.fillText('@kritik',cardX+cardWidth-16,cardY+theadHeight/2);

  // 5. Player rows.
  const rowsStartY = cardY + theadHeight + innerPadding;
  const rowWidth = cardWidth - innerPadding * 2;
  const rowX = cardX + innerPadding;
  const slotSize = 66;
  const slotGap = 8;

  activePlayers.forEach((player, pIdx) => {
    const rowY = rowsStartY + pIdx * (rowHeight + rowGap);
    const roleId = getPlayerActiveRole(player, catalog);
    drawRowBackground(ctx, rowX, rowY, rowWidth, rowHeight, roleId);

    ctx.font = "800 13px 'JetBrains Mono', Consolas, monospace";
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(pIdx + 1).padStart(2, '0'), rowX + 16, rowY + 34);

    const roleIconImg = images.get(resolveCompRoleIcon(roleId)) ?? null;
    drawRoleBadge(ctx, rowX + 44, rowY + 16, roleId, roleExportLabel(roleId, locale), roleIconImg);

    const playerName = player.name || `Player ${pIdx + 1}`;
    ctx.font = "bold 13px 'Barlow', system-ui, sans-serif";
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const displayName = playerName.length > 20 ? playerName.substring(0, 18) + '...' : playerName;
    ctx.fillText(displayName, rowX + 46, rowY + 58);

    // Trait circle.
    const traitCenterX = cardX + 275;
    const traitCenterY = rowY + rowHeight / 2;
    const traitRadius = 26;
    const customTrait = isCustomPhoto(player.trait);
    let traitImg: HTMLImageElement | null = null;
    if (customTrait) {
      const url = getCustomPhoto(pIdx, 'trait', 0) || '';
      traitImg = url ? images.get(url) ?? null : null;
    } else if (player.trait) {
      const sim = lookups.sims.get(player.trait);
      if (sim) traitImg = images.get(resolveCompTraitIcon(sim)) ?? null;
    }
    if (customTrait) {
      if (traitImg) {
        drawCircularImage(ctx, traitImg, traitCenterX, traitCenterY, traitRadius);
        ctx.save();
        ctx.beginPath();
        ctx.arc(traitCenterX, traitCenterY, traitRadius, 0, Math.PI * 2);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#38bdf8';
        ctx.shadowColor = 'rgba(56, 189, 248, 0.45)';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.save();
        ctx.beginPath();
        ctx.arc(traitCenterX, traitCenterY, traitRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();
        ctx.font = "bold 8.5px 'JetBrains Mono', Consolas, monospace";
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CUSTOM', traitCenterX, traitCenterY - 5.5);
        ctx.fillText('PHOTO', traitCenterX, traitCenterY + 5.5);
        ctx.restore();
      }
      if (player.traitCustomText && player.traitCustomText.trim()) {
        ctx.save();
        ctx.font = "bold 8px 'JetBrains Mono', Consolas, monospace";
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = player.traitCustomText.trim();
        ctx.fillText(label.length > 10 ? label.substring(0, 9) + '…' : label, traitCenterX, traitCenterY + traitRadius + 9);
        ctx.restore();
      }
    } else if (traitImg) {
      drawCircularImage(ctx, traitImg, traitCenterX, traitCenterY, traitRadius);
      ctx.save();
      ctx.beginPath();
      ctx.arc(traitCenterX, traitCenterY, traitRadius, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#fbbf24';
      ctx.shadowColor = 'rgba(251, 191, 36, 0.45)';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.save();
      ctx.beginPath();
      ctx.arc(traitCenterX, traitCenterY, traitRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 1;
      if (ctx.setLineDash) ctx.setLineDash([3, 3]);
      ctx.fill();
      ctx.stroke();
      if (ctx.setLineDash) ctx.setLineDash([]);
      ctx.font = "bold 9px 'JetBrains Mono', Consolas, monospace";
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label =
        player.traitCustomText && player.traitCustomText.trim()
          ? player.traitCustomText.trim()
          : t('emptyTrait', locale);
      ctx.fillText(label, traitCenterX, traitCenterY);
      ctx.restore();
    }

    // Weapons.
    const weaponsStartX = cardX + 346;
    const slotY = rowY + (rowHeight - slotSize - (hasTechniques?34:0)) / 2;
    for (let wIdx = 0; wIdx < 3; wIdx++) {
      const sx = weaponsStartX + wIdx * (slotSize + slotGap);
      const wSlot = (player.weapons || [])[wIdx];
      const weaponData = wSlot && wSlot.id ? lookups.weapons.get(wSlot.id) ?? null : null;
      const weaponImg = weaponData ? images.get(resolveCompWeaponIcon(weaponData)) ?? null : null;
      if (wSlot && wSlot.id2) {
        ctx.fillStyle = 'rgba(12, 16, 26, 0.92)';
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 1;
        drawRoundRect(ctx, sx, slotY, slotSize, slotSize, 8, true, true);
        const chipW = Math.round(slotSize * 0.62);
        const chipH = Math.round(slotSize * 0.62);
        drawWeaponChip(ctx, images, lookups, sx + 3, slotY + slotSize - chipH - 3, chipW, chipH,
          wSlot.id, wSlot.stars, wSlot.customText, 0, pIdx, wIdx, locale);
        drawWeaponChip(ctx, images, lookups, sx + slotSize - chipW - 3, slotY + 3, chipW, chipH,
          wSlot.id2, wSlot.stars2, wSlot.customText2, 1, pIdx, wIdx, locale);
      } else if (wSlot && isCustomPhoto(wSlot.id)) {
        const customUrl = getCustomPhoto(pIdx, 'weapon', wIdx, 0) || '';
        const customImg = customUrl ? images.get(customUrl) ?? null : null;
        drawCustomPhotoSlot(ctx, sx, slotY, slotSize, slotSize, customImg, wSlot.customText, 'weapon', wSlot.stars);
      } else if (weaponData && (weaponImg || wSlot.id)) {
        ctx.fillStyle = 'rgba(12, 16, 26, 0.92)';
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 1;
        drawRoundRect(ctx, sx, slotY, slotSize, slotSize, 8, true, true);
        if (weaponImg) {
          drawSlotImage(ctx, weaponImg, sx, slotY, slotSize, slotSize);
        }
        const elemIconSrc = resolveCompElementIcon(weaponData.element || 'Altered');
        const elemIconImg = elemIconSrc ? images.get(elemIconSrc) ?? null : null;
        drawElementBadge(ctx, sx + 11, slotY + 11, elemIconImg);
        drawStarBadge(ctx, sx + slotSize - 26, slotY + slotSize - 17, wSlot.stars ?? 6);
      } else {
        const label =
          wSlot && wSlot.customText && wSlot.customText.trim() ? wSlot.customText.trim() : t('emptyWeapon', locale);
        drawEmptySlot(ctx, sx, slotY, slotSize, slotSize, label);
      }
    }

    if(hasTechniques&&weaponOptions)for(const [index,weapon]of player.weapons.entries()) {
      let line=0;
      for(const secondary of [false,true]) {
        const id=secondary?weapon.id2:weapon.id,selected=[...(secondary?weapon.skills2:weapon.skills)??[],(secondary?weapon.mode2:weapon.mode)??''];
        const options=id?weaponOptions.weapons[id]:undefined;
        for(const skillId of selected) {
          // Scatter techniques and the selected skill mode share one line format under the weapon.
          const skill=[...options?.selectableSkills??[],...options?.selectableModes??[]].find(skill=>skill.id===skillId);
          if(!skill)continue;
          const x=weaponsStartX+index*(slotSize+slotGap),y=slotY+slotSize+3+line*14;
          const image=images.get(skill.icon);if(image)drawImageFit(ctx,image,x,y,12,12,0);
          ctx.font='9px sans-serif';ctx.fillStyle='#2ba6df';ctx.textAlign='left';ctx.textBaseline='middle';
          ctx.fillText(localized(skill.name, locale),x+15,y+6,slotSize-15);line++;
        }
      }
    }
    // Matrices.
    const matricesStartX = cardX + 606;
    for (let mIdx = 0; mIdx < 3; mIdx++) {
      const sx = matricesStartX + mIdx * (slotSize + slotGap);
      const wSlot = (player.weapons || [])[mIdx];
      const mData = wSlot && wSlot.matrix;
      const matrixMeta = mData && mData.id ? lookups.matrices.get(mData.id) ?? null : null;
      const matrixImg = matrixMeta
        ? images.get(gameAsset(matrixMeta.icon || matrixMeta.suitPortrait || '')) ?? null
        : null;
      if (mData && mData.id2) {
        ctx.fillStyle = 'rgba(12, 16, 26, 0.92)';
        ctx.strokeStyle = 'rgba(192, 132, 252, 0.38)';
        ctx.lineWidth = 1;
        drawRoundRect(ctx, sx, slotY, slotSize, slotSize, 8, true, true);
        const chipW = Math.round(slotSize * 0.62);
        const chipH = Math.round(slotSize * 0.62);
        drawMatrixChip(ctx, images, lookups, sx + 3, slotY + 3, chipW, chipH,
          mData.id, mData.stars, mData.customText, 0, pIdx, mIdx, locale);
        drawMatrixChip(ctx, images, lookups, sx + slotSize - chipW - 3, slotY + slotSize - chipH - 3, chipW, chipH,
          mData.id2, mData.stars2, mData.customText2, 1, pIdx, mIdx, locale);
        drawMatrixBadge(ctx, sx + slotSize - 26, slotY + 3, '2+2');
      } else if (mData && isCustomPhoto(mData.id)) {
        const customUrl = getCustomPhoto(pIdx, 'matrix', mIdx, 0) || '';
        const customImg = customUrl ? images.get(customUrl) ?? null : null;
        drawCustomPhotoSlot(ctx, sx, slotY, slotSize, slotSize, customImg, mData.customText, 'matrix', mData.stars, mData.count);
      } else if (mData && matrixMeta && (matrixImg || mData.id)) {
        ctx.fillStyle = 'rgba(12, 16, 26, 0.92)';
        ctx.strokeStyle = 'rgba(192, 132, 252, 0.38)';
        ctx.lineWidth = 1;
        drawRoundRect(ctx, sx, slotY, slotSize, slotSize, 8, true, true);
        if (matrixImg) {
          drawSlotImage(ctx, matrixImg, sx, slotY, slotSize, slotSize);
        }
        const count = mData.count === 2 ? 2 : 4;
        drawMatrixBadge(ctx, sx + slotSize - 26, slotY + 3, `${count}pc`);
        drawStarBadge(ctx, sx + slotSize - 26, slotY + slotSize - 17, mData.stars ?? 3);
      } else {
        const label =
          mData && mData.customText && mData.customText.trim() ? mData.customText.trim() : t('emptyMatrix', locale);
        drawEmptySlot(ctx, sx, slotY, slotSize, slotSize, label);
      }
    }

    // Relics.
    const relicsStartX = cardX + 866;
    for (let rIdx = 0; rIdx < 2; rIdx++) {
      const sx = relicsStartX + rIdx * (slotSize + slotGap);
      const rSlot = (player.relics || [])[rIdx];
      const relicMeta = rSlot && rSlot.id ? lookups.relics.get(rSlot.id) ?? null : null;
      const relicImg = relicMeta ? images.get(resolveCompRelicIcon(relicMeta)) ?? null : null;
      if (rSlot && isCustomPhoto(rSlot.id)) {
        const customUrl = getCustomPhoto(pIdx, 'relic', rIdx) || '';
        const customImg = customUrl ? images.get(customUrl) ?? null : null;
        drawCustomPhotoSlot(ctx, sx, slotY, slotSize, slotSize, customImg, rSlot.customText, 'relic', rSlot.rank);
      } else if (relicMeta && (relicImg || rSlot.id)) {
        const ssr = ((relicMeta.quality || 'SSR') as string).toUpperCase() === 'SSR';
        ctx.fillStyle = 'rgba(12, 16, 26, 0.92)';
        ctx.strokeStyle = ssr ? 'rgba(251, 191, 36, 0.38)' : 'rgba(192, 132, 252, 0.38)';
        ctx.lineWidth = 1;
        drawRoundRect(ctx, sx, slotY, slotSize, slotSize, 8, true, true);
        if (relicImg) {
          drawSlotImage(ctx, relicImg, sx, slotY, slotSize, slotSize);
        }
        drawRelicBadge(ctx, sx + slotSize - 26, slotY + 2, typeof rSlot.rank === 'number' ? rSlot.rank : 5);
      } else {
        const label =
          rSlot && rSlot.customText && rSlot.customText.trim() ? rSlot.customText.trim() : t('emptyRelic', locale);
        drawEmptySlot(ctx, sx, slotY, slotSize, slotSize, label);
      }
    }
  });

  ctx.restore();

  const filename = getFileName(state);
  downloadCanvasPng(canvas, filename);
  return filename;
}
