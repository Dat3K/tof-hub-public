'use client';

import { localeText } from '@/lib/i18n/text';
import { createLocaleCopies } from '@tof-hub/i18n';
import React from 'react';
import { PITY_BANNER_TYPES, PITY_MAX_WEAPON, PITY_MAX_MATRIX } from '@tof-hub/game-domain';
import { Button, Modal } from '@tof-hub/ui';
import Link from 'next/link';
import { useLocale } from '@/lib/i18n';
import { rememberImportedProfileId, rememberProfileToken,readImportedProfileIds,readProfileToken } from './imported-profiles';
import { CaptureAppModal } from '@/components/tool-rail/capture-app-modal';
import { queueMessage, type QueueJob } from '../../queue/client';
import { submitSealedFile } from '../../queue/sealed-upload';
import { QueueNotice } from '../../queue/queue-notice';


/** The import's job in the shared queue (docs/architecture/job-queue.md). */
type JobStatus = QueueJob & {
  result?: { profileId: string; inserted: number; duplicates: number; unresolved: number; accessToken?: string };
};

const copy = createLocaleCopies({
  ru: {
    back: 'История круток',
    cancel: 'Отмена',
    eyebrow: 'WISH TRACKER / ИМПОРТ',
    title: 'Перенесите историю заказов',
    intro: 'Получите файл истории в игре, затем загрузите его здесь. Перед сохранением мы проверим формат и покажем ход обработки.',
    steps: [
      { label: 'Запустите приложение', body: 'Скачайте ToF Hub Capture, запустите его и нажмите «Начать» до входа в игру.' },
      { label: 'Откройте историю', body: 'В игре откройте Особые заказы → История, выберите баннер и пролистайте все страницы. Повторите для каждого нужного баннера. Для аватара и рамки откройте также свою карточку персонажа.' },
      { label: 'Загрузите файл', body: 'Нажмите «Сохранить историю круток» и загрузите полученный .tofwish здесь. Повторный импорт не удваивает крутки.' },
    ],
    sourceTitle: 'Что делает программа',
    sourceText: 'ToF Hub Capture только читает пакеты процесса игры (WinDivert в режиме прослушивания) и собирает из них историю заказов. Игра не изменяется, прокси и сертификаты не ставятся, приложение само ничего не отправляет. Все баннеры сохраняются в один запечатанный файл.',
    appLink: 'Скачать и подробнее о безопасности',
    uploadTitle: 'Файл истории',
    uploadLead: 'Только .tofwish, до 4 МиБ. Исходный файл не сохраняется на сервере после обработки.',
    counters: 'Текущая полоска гаранта',
    counterHelp: 'Если файл не содержит счётчика, укажите число с полоски в игре на момент последней крутки в файле. История привяжется к нему; пропущенные крутки считаются без SSR при расчёте удачи.',
    counterLabels: ['Лимитное оружие', 'Лимитные матрицы', 'Стандартное оружие', 'Стандартные матрицы'],
    choose: 'Выбрать файл',
    submit: 'Начать импорт',
    complete: 'Импорт завершён',
    inserted: 'новых записей',
    duplicates: 'уже были',
    unresolved: 'без точного баннера',
    openProfile: 'Открыть историю профиля',
    error: 'Не удалось импортировать файл.',
    invalid: 'Выберите файл .tofwish размером не больше 4 МиБ.',
    apiUnavailable: 'Импорт пока не настроен на сервере. Файл не отправлен.',
    privacy: 'Файл содержит игровой UID и историю заказов. Отправляйте только файл своего аккаунта.',
    FAQ: 'Вопросы',
    questions: [
      { q: 'Нужно ли что-то устанавливать?', a: 'Только само приложение. Драйвер WinDivert входит в него; для чтения пакетов Windows попросит права администратора.' },
      { q: 'Почему нужно открыть историю в игре?', a: 'Игра присылает историю только по страницам, когда вы их открываете. Пролистайте баннер до самой первой крутки.' },
      { q: 'Что происходит при повторном импорте?', a: 'Одинаковые записи определяются по UID, исходному коду баннера, времени группы и позиции внутри десятки. Они не добавляются второй раз.' },
    ],
  },
  en: {
    back: 'Wish history',
    cancel: 'Cancel',
    eyebrow: 'WISH TRACKER / IMPORT',
    title: 'Bring in your order history',
    intro: 'Capture your game history, then upload its file here. We validate the format and show the processing status before saving.',
    steps: [
      { label: 'Start the app', body: 'Download ToF Hub Capture, run it and press Start before you enter the game.' },
      { label: 'Open the history', body: 'In game, open Special Orders → History, pick a banner and page through every page. Repeat for each banner you want. Also open your own Personal Card to capture the avatar and frame.' },
      { label: 'Upload the file', body: 'Press Save pull history and upload the .tofwish here. Importing again never duplicates pulls.' },
    ],
    sourceTitle: 'What the app does',
    sourceText: 'ToF Hub Capture only reads packets of the game process (WinDivert in sniff mode) and builds the order history from them. The game is not modified, no proxy or certificate is installed, and the app sends nothing by itself. All banners go into one sealed file.',
    appLink: 'Download and safety details',
    uploadTitle: 'History file',
    uploadLead: '.tofwish only, up to 4 MiB. The source file is not retained on the server after processing.',
    counters: 'Current game pity',
    counterHelp: 'If the file has no counter, enter the game bar number at the time of the file’s latest pull. History is anchored to it; missing pulls are assumed to have no SSR for luck calculations.',
    counterLabels: ['Limited weapons', 'Limited matrices', 'Standard weapons', 'Standard matrices'],
    choose: 'Choose file',
    submit: 'Start import',
    complete: 'Import complete',
    inserted: 'new records',
    duplicates: 'already present',
    unresolved: 'without an exact banner',
    openProfile: 'Open profile history',
    error: 'Could not import this file.',
    invalid: 'Choose a .tofwish file no larger than 4 MiB.',
    apiUnavailable: 'Import is not configured on the server yet. No file was sent.',
    privacy: 'The file contains your game UID and order history. Upload only a file from your own account.',
    FAQ: 'Questions',
    questions: [
      { q: 'Do I need to install anything else?', a: 'Only the app. The WinDivert driver ships inside it; Windows asks for administrator rights to read packets.' },
      { q: 'Why open the history in game?', a: 'The game sends history page by page only when you open it. Page back to your very first pull.' },
      { q: 'What happens when I import twice?', a: 'Matching records are identified by UID, original banner code, group time and position in the ten-pull batch. They are not added twice.' },
    ],
  },
} as const);

function checkImportReady(): Promise<boolean> {
  return fetch('/api/v1/wish/import/public-key', { cache: 'no-store' })
    .then((response) => response.ok ? response.json() as Promise<{ ready?: boolean }> : { ready: false })
    .then((status) => status.ready === true)
    .catch(() => false);
}

export function WishImportView({presentation='page',isOpen=true,onClose=()=>{}}:{presentation?:'page'|'dialog';isOpen?:boolean;onClose?:()=>void}={}) {
  const dialogMode=presentation==='dialog';
  const { locale } = useLocale();
  const t = copy[locale];
  const [file, setFile] = React.useState<File | null>(null);
  const [job, setJob] = React.useState<JobStatus | null>(null);
  const [error, setError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [importReady, setImportReady] = React.useState<boolean | null>(null);
  const [counters, setCounters] = React.useState(['', '', '', '']);
  const [appOpen, setAppOpen] = React.useState(false);
  const fileInput = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    checkImportReady().then((ready) => { if (!cancelled) setImportReady(ready); });
    return () => { cancelled = true; };
  }, []);

  // A page left while the import waits stops polling its job.
  const polling = React.useRef<AbortController | null>(null);
  React.useEffect(() => () => polling.current?.abort(), []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) { setError(t.invalid); return; }
    // The API may have started after this page loaded: check again before refusing.
    const ready = importReady || await checkImportReady();
    setImportReady(ready);
    if (!ready) { setError(t.apiUnavailable); return; }
    setError('');
    setSubmitting(true);
    polling.current?.abort();
    polling.current = new AbortController();
    let lastJob: JobStatus | null = null;
    try {
      const manual = counters.flatMap((value, index) => value === '' ? [] : [{
        banner_type: PITY_BANNER_TYPES[index], current_pity: Number(value), captured_at: new Date().toISOString(),
      }]);
      // The browser gate (extension, size, format signature, complete text) refuses a file before it is sent.
      const result = await submitSealedFile<NonNullable<JobStatus['result']>>('wish', file, {
        url: '/api/v1/wish/import/jobs', locale,
        headers:{'x-wish-import-tokens':readImportedProfileIds().flatMap(id=>{const token=readProfileToken(id);return token?[token]:[];}).join(',')},
        encode: (envelope) => manual.length ? { ...envelope, manual_pity: manual } : envelope,
        onUpdate: (next) => { lastJob = next as JobStatus; setJob(lastJob); },
        signal: polling.current.signal,
      });
      if (result?.profileId) {
        rememberImportedProfileId(result.profileId);
        // The device token is returned once: keep it for reads from other IPs.
        if (result.accessToken) rememberProfileToken(result.profileId, result.accessToken);
        try {
          const hidden: unknown = JSON.parse(window.localStorage.getItem('tof-wish-hidden-profiles') ?? '[]');
          if (Array.isArray(hidden)) window.localStorage.setItem('tof-wish-hidden-profiles', JSON.stringify(hidden.filter((id) => id !== result.profileId)));
        } catch { /* Browser storage is optional. */ }
      }
    } catch (reason) {
      if (polling.current?.signal.aborted) return;
      // A failed job shows its own message in the result box.
      if ((lastJob as JobStatus | null)?.state !== 'failed') { setError(queueMessage(reason, locale === 'ru', t.error)); setJob(null); }
    } finally {
      setSubmitting(false);
    }
  }

  const closeDialog=()=>{if(!submitting)onClose();};
  const uploadForm=<form onSubmit={submit} className={dialogMode?'space-y-4':'rounded-2xl border border-amber-300/20 bg-[linear-gradient(155deg,#22212a,#141820_55%,#11151c)] p-6 shadow-xl shadow-black/20'}>
    {!dialogMode&&<h2 className="text-xl font-bold text-white">{t.uploadTitle}</h2>}
    {!dialogMode&&<p className="mt-2 text-sm leading-6 text-slate-300">{t.uploadLead}</p>}
    <label className={`${dialogMode?'':'mt-6'} flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-amber-200/35 bg-black/15 px-4 text-center transition-colors hover:border-amber-200/70 hover:bg-amber-300/5 focus-within:outline focus-within:outline-2 focus-within:outline-amber-300`}>
      <span aria-hidden="true" className="text-3xl text-amber-200">⇧</span>
      <span className="mt-2 text-sm font-semibold text-amber-100">{file?.name ?? t.choose}</span>
      <input ref={fileInput} type="file" accept=".tofwish,application/json" className="sr-only" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setJob(null); setError(''); }} />
    </label>
    <fieldset className="mt-5">
      <legend className="text-sm font-semibold text-white">{t.counters}</legend>
      <p className="mt-2 text-xs leading-5 text-slate-300">{t.counterHelp}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {t.counterLabels.map((label, index) => <label key={label} className="text-xs text-slate-300">
          {label}
          <input data-testid={`wish-pity-${index}`} type="number" min={0} max={(index % 2 ? PITY_MAX_MATRIX : PITY_MAX_WEAPON) - 1} step={1}
            value={counters[index]} onChange={event => setCounters(values => values.map((value, i) => i === index ? event.target.value : value))}
            className="mt-1 w-full rounded-md border border-white/20 bg-black/20 px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300" />
        </label>)}
      </div>
    </fieldset>
    <button type="submit" disabled={!file || importReady === null || submitting || (job?.state === 'queued' || job?.state === 'processing')} className="mt-5 w-full cursor-pointer rounded-lg bg-amber-300 px-5 py-3 text-sm font-bold text-[#171414] transition-colors hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 disabled:cursor-not-allowed disabled:opacity-45">{t.submit}</button>
    {importReady === false && <p role="status" className="mt-3 text-xs leading-5 text-amber-200/80">{t.apiUnavailable}</p>}
    {error && <p role="alert" className="mt-4 rounded-lg border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
    <QueueNotice job={job} locale={locale} className="mt-4" />
    {(job?.state === 'failed' || job?.state === 'complete') && <div role="status" aria-live="polite" className="mt-4 rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-200">
      {job.state === 'failed' && (job.error?.message ?? t.error)}
      {job.state === 'complete' && job.result && <><strong className="block text-emerald-300">{t.complete}</strong><span className="mt-1 block">{job.result.inserted} {t.inserted} · {job.result.duplicates} {t.duplicates} · {job.result.unresolved} {t.unresolved}</span><a href={`/tools/wish/?profileId=${encodeURIComponent(job.result.profileId)}&tab=history`} className="mt-3 inline-block font-bold text-amber-200 underline underline-offset-4">{t.openProfile} →</a></>}
    </div>}
    <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-5 text-slate-400">{t.privacy}</p>
  </form>;

  if(dialogMode)return <Modal isOpen={isOpen} onClose={closeDialog} size="md" appearance="tool" closeOnEsc={!submitting} closeOnBackdropClick={!submitting} ariaLabel={t.uploadTitle}>
    <Modal.Header><Modal.Title>{t.uploadTitle}</Modal.Title></Modal.Header>
    <Modal.Body><p className="mb-4 text-sm leading-6 text-slate-300">{t.uploadLead}</p>{uploadForm}</Modal.Body>
    <Modal.Footer><Button variant="secondary" onClick={closeDialog} disabled={submitting}>{t.cancel}</Button></Modal.Footer>
  </Modal>;

  return (
    <main className="info-ui min-h-screen bg-[#0b0d13] px-4 pb-20 pt-8 text-[#e8e6e5] md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between gap-3"><Link href="/tools/wish/" className="text-sm text-amber-200/80 hover:text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">← {t.back}</Link></div>
        <header className="mb-9 mt-9 border-l-2 border-amber-400/70 pl-5">
          <p className="text-[0.6875rem] font-bold tracking-[0.23em] text-amber-300">{t.eyebrow}</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-white md:text-5xl">{t.title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">{t.intro}</p>
        </header>

        <div className="grid gap-7 lg:grid-cols-[minmax(0,1.3fr)_minmax(18.75rem,0.85fr)]">
          <div className="space-y-7">
            <section aria-label={t.eyebrow} className="overflow-hidden rounded-2xl border border-white/10 bg-[var(--surface-panel)]">
              {t.steps.map((step, index) => (
                <div key={step.label} className="grid grid-cols-[2.75rem_1fr] gap-4 border-b border-white/10 px-6 py-6 last:border-b-0">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-300/40 text-sm font-bold text-amber-200">{index + 1}</span>
                  <div><h2 className="font-bold text-white">{step.label}</h2><p className="mt-2 text-sm leading-6 text-slate-300">{step.body}</p></div>
                </div>
              ))}
            </section>
            <section className="rounded-2xl border border-white/10 bg-[var(--surface-panel)] px-6 py-6">
              <h2 className="text-lg font-bold text-white">{t.sourceTitle}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">{t.sourceText}</p>
              <button type="button" onClick={() => setAppOpen(true)} className="mt-3 inline-block text-sm text-amber-200 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">{t.appLink}</button>
            </section>
            <section className="rounded-2xl border border-white/10 bg-[var(--surface-panel)] px-6 py-6">
              <h2 className="text-lg font-bold text-white">{t.FAQ}</h2>
              <div className="mt-4 divide-y divide-white/10">
                {t.questions.map(({ q, a }) => <details key={q} className="group py-4"><summary className="cursor-pointer font-semibold text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">{q}</summary><p className="mt-3 text-sm leading-6 text-slate-300">{a}</p></details>)}
              </div>
            </section>
          </div>

          <div className="lg:sticky lg:top-8 lg:self-start">
            {uploadForm}
          </div>
        </div>
      </div>
      {/* Already on the import page: the step's button opens this page's file field. */}
      <CaptureAppModal isOpen={appOpen} onClose={() => setAppOpen(false)} locale={locale}
        upload={{ label: localeText(locale)('Choose .tofwish'), onClick: () => fileInput.current?.click() }} />
    </main>
  );
}
