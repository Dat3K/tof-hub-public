import { useEffect, useId, useRef, useState } from 'react';
import type { Locale } from '@tof-hub/i18n';
import { useToast } from '@tof-hub/ui';
import { recognizeGearImage } from '@/features/build/gear-ocr-engine';
import { fillText, localeText } from '@/lib/i18n/text';
import { prepareDamageSidebar, prepareTableImage } from './parse-table';

export type ScreenshotTarget = number | 'titan' | 'others';
export type ScreenshotQueueTarget = ScreenshotTarget | 'auto';
type Phase = 'queued' | 'reading';
interface Screenshot { url: string; name: string }
interface ImportJob { target: ScreenshotQueueTarget; file: File; explicit?: boolean; detectTitan?: boolean }
interface SupplementalImage { image: File; selected: number|null; kind?: 'titan'|'damage' }
export const TITAN_SCREENSHOT_MAX_MB = 20;
const screenshotLimits = { maxBytes: TITAN_SCREENSHOT_MAX_MB * 1024 * 1024 };

export function useScreenshotImport(locale: Locale,
  applyText: (job: ImportJob, text: string, extra: string, selected: number|null) => ScreenshotTarget | { error: string } | false,
  supplement: (job: ImportJob, file: File, text: string) => Promise<SupplementalImage|null>) {
  const t = localeText(locale);
  const { notify } = useToast();
  const noticeId = useId();
  const [pending, setPending] = useState(new Map<ScreenshotQueueTarget, Phase>());
  const [screenshots, setScreenshots] = useState(new Map<ScreenshotTarget, Screenshot>());
  const reserved = useRef(new Set<ScreenshotQueueTarget>());
  const previews = useRef(new Map<ScreenshotTarget, Screenshot>());
  const queue = useRef(Promise.resolve());
  const lifetime = useRef<AbortController>(null);

  useEffect(() => {
    const controller = new AbortController();
    const urls = previews.current;
    lifetime.current = controller;
    return () => {
      controller.abort();
      urls.forEach(({ url }) => { if (url.startsWith('blob:')) URL.revokeObjectURL(url); });
      urls.clear();
    };
  }, []);

  function report(message: string) {
    notify(message, { id: noticeId, tone: 'error' });
  }

  function removePreview(target: ScreenshotTarget) {
    const screenshot = previews.current.get(target);
    if (screenshot?.url.startsWith('blob:')) URL.revokeObjectURL(screenshot.url);
    previews.current.delete(target);
    setScreenshots(new Map(previews.current));
  }

  function showPreview(target: ScreenshotTarget, url: string, name: string) {
    const old=previews.current.get(target);
    if(old?.url.startsWith('blob:'))URL.revokeObjectURL(old.url);
    previews.current.set(target,{url,name});
    setScreenshots(new Map(previews.current));
  }

  function enqueue(jobs: ImportJob[]) {
    const signal = lifetime.current?.signal;
    for (const job of jobs) {
      const {target,file}=job;
      if (reserved.current.has(target)) {
        report(t('This screenshot slot is already in the queue.', 'Для этой карточки скриншот уже в очереди.'));
        continue;
      }
      reserved.current.add(target);
      setPending(current => new Map(current).set(target, 'queued'));
      queue.current = queue.current.then(async () => {
        if (signal?.aborted) return;
        setPending(current => new Map(current).set(target, 'reading'));
        try {
          let damageSidebar: Awaited<ReturnType<typeof prepareDamageSidebar>> = null;
          const prepare = async (image: File) => {
            if (target === 'titan') return prepareTableImage(image, null);
            if (!job.detectTitan) return prepareTableImage(image);
            damageSidebar = await prepareDamageSidebar(image);
            return damageSidebar?.selected != null ? prepareTableImage(image) : prepareTableImage(image, null);
          };
          let selected: number|null=null;
          let kind: SupplementalImage['kind'];
          const readExtra = async (image: File, text: string) => {
            if (damageSidebar?.selected != null) {
              selected = damageSidebar.selected;
              return damageSidebar.image;
            }
            const prepared=await supplement(job,image,text);
            selected=prepared?.selected??null;
            kind=prepared?.kind;
            return prepared?.image??null;
          };
          let result = await recognizeGearImage(file, prepare, readExtra, screenshotLimits);
          if (!result.ok && result.reason === 'gap') {
            const delay = result.retryAfterMs;
            await new Promise(resolve => setTimeout(resolve, delay));
            if (signal?.aborted) return;
            result = await recognizeGearImage(file, prepare, readExtra, screenshotLimits);
          }
          if (signal?.aborted) return;
          if (!result.ok) {
            report({
              type: t('Choose a PNG, JPEG or WebP image.', 'Выберите изображение PNG, JPEG или WebP.'),
              size: fillText(t('Choose a screenshot up to {0} MB.', 'Выберите скриншот размером до {0} МБ.'), [TITAN_SCREENSHOT_MAX_MB]),
              dimensions: t('The image size is outside the supported range.', 'Размер изображения выходит за допустимые пределы.'),
              busy: t('The screenshot reader is busy. Try again shortly.', 'Распознавание уже идёт. Повторите через несколько секунд.'),
              gap: t('Wait a moment and try again.', 'Подождите немного и повторите.'),
              rate: t('Screenshot limit reached. Try again in a minute.', 'Достигнут лимит распознавания. Повторите через минуту.'),
              engine: t('Could not read the image. Try again or enter the values manually.', 'Не удалось прочитать изображение. Повторите попытку или введите значения вручную.'),
            }[result.reason]);
            return;
          }
          const recognizedJob=kind==='titan'?{...job,target:'titan' as const}:job;
          const damageText=kind==='damage'?result.extra||result.text:result.text;
          const destination=applyText(recognizedJob,damageText,kind==='damage'?'':result.extra??'',selected);
          if (typeof destination === 'object') {
            report(destination.error);
            return;
          }
          if (destination === false) {
            report(target === 'titan'
              ? t('No Titan levels found. Crop the image to the Titan stats and try again.', 'Уровни титанки не найдены. Обрежьте скриншот до блока статов и попробуйте снова.')
              : t('No damage rows found. Crop the image to the damage table and try again.', 'Строки урона не найдены. Обрежьте скриншот до таблицы и попробуйте снова.'));
            return;
          }
          showPreview(destination, URL.createObjectURL(file), file.name);
        } catch {
          if (!signal?.aborted) report(t('Could not import this screenshot.', 'Не удалось добавить скриншот.'));
        } finally {
          reserved.current.delete(target);
          if (!signal?.aborted) setPending(current => {
            const next = new Map(current);
            next.delete(target);
            return next;
          });
        }
      });
    }
  }

  return { enqueue, pending, reserved, screenshots, showPreview, removePreview, report };
}
