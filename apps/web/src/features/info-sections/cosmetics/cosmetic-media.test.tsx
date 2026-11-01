import React from 'react';
import {describe, expect, it, vi} from 'vitest';
import {fireEvent, render, renderHook, screen} from '@testing-library/react';
import type {CosmeticAnimation, CosmeticsDataset} from '@tof-hub/contracts';
import {CosmeticCardItem} from './cosmetic-card-item';
import {CosmeticDetailModal} from './cosmetic-detail-modal';
import {useCosmeticsCatalog} from './use-cosmetics-catalog';
import {getCosmeticsStrings} from './copy';
import {ProfileCosmeticPreview} from '../../build/profile-cosmetic-preview';

const animation: CosmeticAnimation = {status: 'ready', posterPng: '/fixture/poster.png', posterWebp: '/fixture/poster.webp',
  gif: '/fixture/play.gif', webp: '/fixture/play.animated.webp', frameCount: 2, durationMs: 200, timing: 'inferred'};
const item = {id: 'fixture', category: 'chatStickers', name_en: 'Fixture sticker', icon: '/Game/Fixture/Poster.Poster', animation};

describe('cosmetic media consumers', () => {
  it('keeps a static card with an honest format caption and passes animation to keyboard full-view opening', () => {
    const strings = getCosmeticsStrings('en');
    const card = render(<CosmeticCardItem item={item} isRu={false} strings={strings} onClick={() => {}}/>);
    expect(screen.getByText('GIF')).toBeTruthy();
    expect(screen.getByAltText('Fixture sticker').getAttribute('src')).not.toContain('animated');
    expect(screen.queryByText('SSR')).toBeNull();
    card.unmount();
    const open = vi.fn();
    render(<CosmeticDetailModal isOpen item={item} isRu={false} strings={strings} onClose={() => {}} onOpenLightbox={open}/>);
    fireEvent.keyDown(screen.getByRole('button', {name: 'Fixture sticker'}), {key: 'Enter'});
    expect(open).toHaveBeenCalledWith(animation.posterPng, 'Fixture sticker', animation.posterWebp, animation);
  });
  it('plays a ready animation when the details open and offers the GIF download', () => {
    const strings = getCosmeticsStrings('en');
    render(<CosmeticDetailModal isOpen item={item} isRu={false} strings={strings} onClose={() => {}} onOpenLightbox={() => {}}/>);
    expect(screen.getByAltText('Fixture sticker').getAttribute('src')).toBe(animation.webp);
    expect(screen.getByRole('link', {name: /Download GIF/}).getAttribute('href')).toBe(animation.gif);
    fireEvent.error(screen.getByAltText('Fixture sticker'));
    expect(screen.getByAltText('Fixture sticker').getAttribute('src')).not.toBe(animation.webp);
  });
  it('retains known stickers/badges with missing pixels and shows an unavailable image without inventing rarity', () => {
    const badge = {id: 'missing', category: 'badges', name_en: 'Missing badge'};
    const {result} = renderHook(() => useCosmeticsCatalog({locale: 'en', initialData: {items: [badge]} as unknown as CosmeticsDataset}));
    expect(result.current.visibleItems).toHaveLength(1);
    render(<CosmeticCardItem item={badge} isRu strings={getCosmeticsStrings('ru')} onClick={() => {}}/>);
    expect(screen.getByRole('img', {name: 'Изображение недоступно'})).toBeTruthy();
    expect(screen.queryByText('SSR')).toBeNull();
  });
  it('Build account details play the avatar when opened and keep the GIF full view', () => {
    render(<ProfileCosmeticPreview animation={animation} name="Fixture avatar" locale="en"/>);
    expect(screen.getByAltText('Fixture avatar').getAttribute('src')).toBe(animation.webp);
    fireEvent.click(screen.getByRole('button', {name: 'Avatar · GIF'}));
    expect(screen.getByRole('button', {name: 'Download GIF'})).toBeTruthy();
  });
});
