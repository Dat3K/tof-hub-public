'use client';
import {useEffect, useState} from 'react';
import {Button, Lightbox} from '@tof-hub/ui';
import type {CosmeticAnimation} from '@tof-hub/contracts';
import type {Locale} from '@tof-hub/i18n';
import {localeText} from '@/lib/i18n/text';
import styles from './build.module.css';

/**
 * Mounted in the account detail dialog only; cards, tooltips and exports retain their static poster.
 * Opening the dialog plays the animation; a failed animation falls back to the poster.
 */
export function ProfileCosmeticPreview({animation, name, locale}: {animation?: CosmeticAnimation; name?: string; locale: Locale}) {
  const [open, setOpen] = useState(false);
  const [play, setPlay] = useState(true);
  const animatedSrc = animation?.status === 'ready' ? animation.webp : null;
  useEffect(() => setPlay(true), [animatedSrc]);
  const t = localeText(locale);
  if (!animation) return null;
  if (animation.status === 'unresolved') return <p>{t('Animation source found; playback is not available yet.', 'Источник анимации найден; воспроизведение пока недоступно.')}</p>;
  return <>
    <img className={styles.profileCosmeticAnimation} src={play ? animation.webp : animation.posterWebp} alt={name}
      onError={play ? () => setPlay(false) : undefined}/>
    <Button variant="secondary" onClick={() => setOpen(true)}>{t('Avatar', 'Аватар')} · GIF</Button>
    {open && <Lightbox isOpen onClose={() => setOpen(false)} locale={locale} title={name} alt={name}
      zoomable={false} src={animation.posterPng} webpSrc={animation.posterWebp}
      animation={{src: animation.webp, gifSrc: animation.gif}}/>}
  </>;
}
