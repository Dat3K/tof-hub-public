import type { Locale } from '@tof-hub/i18n';
import type { QueueKind, QueueState } from '@tof-hub/contracts';
import { localeText } from '@/lib/i18n/text';

/** Queue labels are site-owned UI copy; keep their source phrases visible to the localization gate. */
export function queueKindLabel(kind: QueueKind, locale: Locale): string {
  const t = localeText(locale);
  switch (kind) {
    case 'wish-import': return t('Wish history import', 'Импорт круток');
    case 'players-import': return t('Players upload', 'Загрузка игроков');
    case 'build-import': return t('Build card import', 'Импорт билда');
    case 'build-profile': return t('Saving a build', 'Сохранение билда');
  }
}

export function queueStateLabel(state: QueueState, locale: Locale): string {
  const t = localeText(locale);
  switch (state) {
    case 'queued': return t('Waiting', 'Ждёт');
    case 'processing': return t('Processing', 'Обрабатывается');
    case 'complete': return t('Done', 'Готово');
    case 'failed': return t('Failed', 'Ошибка');
  }
}
