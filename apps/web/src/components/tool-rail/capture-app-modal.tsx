'use client';

import React from 'react';
import type { Locale } from '@tof-hub/i18n';
import { localeText } from '@/lib/i18n/text';
import { Button } from '@tof-hub/ui';
import { InfoCard, InfoNote, SectionHeading, ToolInfoModal } from './tool-info-modal';

export interface CaptureUploadAction { label: string; href?: string; onClick?: () => void }

/** Import help is shared by Build, Wish and Ranking. External collectors are optional. */
export function CaptureAppModal({ isOpen, onClose, locale, upload }: {
  isOpen: boolean; onClose: () => void; locale: Locale; upload?: CaptureUploadAction;
}) {
  const t = localeText(locale);
  const url = process.env.NEXT_PUBLIC_CAPTURE_APP_URL;
  return <ToolInfoModal isOpen={isOpen} onClose={onClose}
    eyebrow={t('Data import', 'Импорт данных')}
    title={t('Import your JSON file', 'Импорт своего JSON-файла')}
    intro={t('Build, Wish and Ranking accept JSON in their documented formats. Each installation keeps its own database and keys.', 'Build, Wish и Ranking принимают JSON в документированных форматах. У каждой установки собственная база и ключи.')}
    closeLabel={t('Close', 'Закрыть')}>
    <InfoCard>
      <SectionHeading>{t('Choose the matching file', 'Выберите подходящий файл')}</SectionHeading>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">{t(
        'Use the Build card JSON for Build, the version 2 pull-history JSON for Wish, or the version 1 player bundle for Ranking. The server validates the contents and reports progress in the processing queue.',
        'Для Build нужен JSON карточки, для Wish — история круток версии 2, для Ranking — пакет игроков версии 1. Сервер проверит содержимое и покажет результат в очереди обработки.',
      )}</p>
      {upload ? <Button className="mt-4" href={upload.href} onClick={() => { onClose(); upload.onClick?.(); }}>{upload.label}</Button> : null}
    </InfoCard>
    <InfoNote>{t('Submitted JSON is user-provided data. A server signature records acceptance and later changes; it does not prove that values came from a game server.', 'Загружаемый JSON предоставлен пользователем. Подпись сервера фиксирует приём и последующие изменения; она не доказывает происхождение значений с игрового сервера.')}</InfoNote>
    {url ? <InfoCard><SectionHeading>{t('External collector', 'Внешний сборщик')}</SectionHeading>
      <p className="my-3 text-sm text-slate-300">{t('Encrypted files must target this installation’s public key. Check compatibility with the collector provider.', 'Зашифрованные файлы должны быть адресованы публичному ключу этой установки. Совместимость уточняйте у поставщика сборщика.')}</p>
      <Button href={url}>{t('Collector download', 'Скачать сборщик')}</Button>
    </InfoCard> : null}
  </ToolInfoModal>;
}
