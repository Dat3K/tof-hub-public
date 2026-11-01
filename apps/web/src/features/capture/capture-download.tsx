'use client';
import {Button} from '@tof-hub/ui';
import {useLocale} from '@/lib/i18n';
import {localeText} from '@/lib/i18n/text';
export function CaptureDownload() {
  const {locale}=useLocale();
  const t=localeText(locale);
  const url=process.env.NEXT_PUBLIC_CAPTURE_APP_URL;
  return <main className="info-ui mx-auto max-w-3xl px-4 py-8 text-slate-200">
    <h1 className="mb-4 text-2xl font-bold text-white">{t('Data import', 'Импорт данных')}</h1>
    <p className="mb-6 leading-relaxed">{t('Build, Wish and Ranking accept JSON in their documented formats. Each installation keeps its own database and keys.', 'Build, Wish и Ranking принимают JSON в документированных форматах. У каждой установки собственная база и ключи.')}</p>
    {url ? <section className="mb-6"><p className="mb-4">{t('Encrypted files must target this installation’s public key. Check compatibility with the collector provider.', 'Зашифрованные файлы должны быть адресованы публичному ключу этой установки. Совместимость уточняйте у поставщика сборщика.')}</p><Button href={url}>{t('Collector download', 'Скачать сборщик')}</Button></section> : null}
    <Button href="/tools/ranking/" variant="secondary">{t('Back to Ranking', 'Вернуться к рейтингу')}</Button>
  </main>;
}
